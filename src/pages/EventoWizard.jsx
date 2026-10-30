import { useEffect, useMemo, useRef, useState } from 'react'
import { Disc3, Tent, Check, Plus, Trash2, Star, Wand2, Search, ChevronLeft, ChevronRight, Save, Info, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react'
import { api } from '../api.js'
import { ir } from '../router.js'
import { Btn, Field, NumInput, Spinner, Vacio, Alertas, Modal, Confirmar, Badge, useToast } from '../ui.jsx'
import { Barra } from '../charts.jsx'
import { PresupuestoTabla, Equilibrio, FeriadosChips } from '../components.jsx'
import { $, $c, num, pct, usd, hoyAR, sumarDias, diasEntre, fechaCorta, fechaLarga, rangoFechas, mesLabel, feriadoDe, esFindeLargo, CATEGORIAS_COSTO, TIPOS_LUGAR, debounce } from '../utils.js'

const PASOS = ['Tipo y lugar', 'Fecha', 'Line-up', 'Entradas', 'Bebidas', 'Costos y sponsors', 'Resumen']
const TIPOS_POR_EVENTO = { boliche: ['boliche', 'salon_eventos', 'teatro'], festival: ['predio_festival', 'estadio', 'salon_eventos'] }
const hm = (h) => (h ? String(h).slice(0, 5) : '')
const redondear = (v, paso = 500) => Math.max(0, Math.round(v / paso) * paso)

const PLANTILLAS = {
  boliche: [{ nombre: 'General', precio: 15000, p: 0.7 }, { nombre: 'VIP', precio: 28000, p: 0.2 }],
  festival: [{ nombre: 'Early Bird 2 días', precio: 60000, p: 0.2 }, { nombre: 'General 2 días', precio: 90000, p: 0.55 }, { nombre: 'VIP 2 días', precio: 170000, p: 0.1 }],
}
const RUBROS = ['Bebidas', 'Cervecería', 'Fernet', 'Telecomunicaciones', 'Banca y finanzas', 'Indumentaria', 'Medios', 'Alimentos', 'Tecnología', 'Automotriz']

// Arma un line-up sugerido con el presupuesto disponible para artistas
function sugerirLineup({ candidatos, presupuesto, tipo, dias, fecha, escenarios }) {
  const aptos = candidatos.filter((a) => a.encaja).sort((a, b) => b.cache - a.cache)
  const principales = aptos.filter((a) => a.rol === 'principal')
  const out = []
  let gastado = 0
  const usados = new Set()
  const tomar = (a, extra) => { usados.add(a.id); gastado += Number(a.cache); out.push({ artista_id: a.id, cache_acordado: Number(a.cache), es_headliner: false, fecha: null, escenario: '', horario: '', ...extra }) }
  const cabe = (a, tope) => !usados.has(a.id) && gastado + Number(a.cache) <= tope

  if (tipo === 'boliche') {
    const head = principales.find((a) => cabe(a, presupuesto))
    if (head) tomar(head, { es_headliner: true, horario: '01:30' })
    const soporte = [...aptos].reverse().find((a) => cabe(a, presupuesto))
    if (soporte) tomar(soporte, { horario: '00:00' })
    return out
  }
  const nHead = Math.min(dias, principales.length)
  for (const a of principales) { if (out.filter((x) => x.es_headliner).length >= nHead) break; if (cabe(a, presupuesto * 0.85)) tomar(a, { es_headliner: true }) }
  const heads = out.filter((x) => x.es_headliner)
  const medios = aptos.filter((a) => !usados.has(a.id))
  for (const a of medios) { if (out.length - heads.length >= dias * 2) break; if (cabe(a, presupuesto * 0.97)) tomar(a) }
  for (const a of [...aptos].reverse()) { if (out.length >= dias * 4) break; if (cabe(a, presupuesto)) tomar(a) }
  // repartir por día y horario
  const porDia = Array.from({ length: dias }, () => [])
  heads.forEach((h, i) => porDia[i % dias].push(h))
  out.filter((x) => !x.es_headliner).sort((a, b) => b.cache_acordado - a.cache_acordado).forEach((x, i) => porDia[i % dias].push(x))
  const horas = ['17:00', '19:00', '21:00', '23:00']
  porDia.forEach((lista, d) => {
    lista.sort((a, b) => Number(a.es_headliner) - Number(b.es_headliner) || a.cache_acordado - b.cache_acordado)
    const off = horas.length - lista.length
    lista.forEach((x, i) => { x.fecha = sumarDias(fecha, d); x.horario = horas[Math.max(0, off + i)]; x.escenario = x.es_headliner || escenarios < 2 ? 'Principal' : i % 2 ? 'Escenario 2' : 'Principal' })
  })
  return out
}

export default function EventoWizard({ editarId, query = {} }) {
  const toast = useToast()
  const [paso, setPaso] = useState(0)
  const [listo, setListo] = useState(false)
  const [errCarga, setErrCarga] = useState(null)
  const [cfg, setCfg] = useState({})
  const [lugares, setLugares] = useState([])
  const [catBebidas, setCatBebidas] = useState([])
  const [artistasFit, setArtistasFit] = useState([])
  const [fechasDisp, setFechasDisp] = useState([])
  const [form, setForm] = useState(null)
  const [bebidasAuto, setBebidasAuto] = useState(true)
  const [previa, setPrevia] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [verTodos, setVerTodos] = useState(false)
  const [busqLugar, setBusqLugar] = useState('')
  const [busqArt, setBusqArt] = useState('')
  const [dlg, setDlg] = useState(null)
  const upd = (patch) => setForm((f) => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) }))

  // ---------- carga inicial ----------
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [c, ls, bs] = await Promise.all([api('/config'), api('/boliches'), api('/bebidas?activo=true')])
        const cv = c.valores
        let f = {
          tipo: query.tipo === 'festival' ? 'festival' : 'boliche', nombre: '', boliche_id: query.lugar ? Number(query.lugar) : null,
          fecha: query.fecha || '', dias: query.tipo === 'festival' ? 2 : 1, hora_inicio: query.tipo === 'festival' ? '16:00' : '23:30', hora_fin: query.tipo === 'festival' ? '02:00' : '05:30',
          descripcion: '', notas: '', tragos_por_persona: cv.tragos_default, ocupacion: query.tipo === 'festival' ? cv.ocupacion_festival_pct : 100, estado: 'borrador',
          iva_pct: cv.iva_pct, sadaic_pct: cv.sadaic_pct, iibb_pct: cv.iibb_pct, ticketera_pct: cv.ticketera_pct, pct_online: cv.pct_online,
          artistas: [], bebidas: [], entradas: [], costos: [], sponsors: [],
        }
        const origen = editarId || Number(query.copiar) || null
        if (origen) {
          const d = await api('/eventos/' + origen)
          const ev = d.evento, dias = diasEntre(ev.fecha, ev.fecha_fin || ev.fecha)
          f = {
            ...f, tipo: ev.tipo, nombre: editarId ? ev.nombre : ev.nombre + ' (copia)', boliche_id: ev.boliche_id, fecha: editarId ? ev.fecha : '', dias,
            hora_inicio: hm(ev.hora_inicio), hora_fin: hm(ev.hora_fin), descripcion: ev.descripcion || '', notas: ev.notas || '',
            tragos_por_persona: ev.tragos_por_persona, ocupacion: Math.min(100, (ev.asistentes_estimados / (d.lugar.capacidad * dias)) * 100),
            estado: editarId ? ev.estado : 'borrador',
            iva_pct: Number(ev.iva_pct), sadaic_pct: Number(ev.sadaic_pct), iibb_pct: Number(ev.iibb_pct), ticketera_pct: Number(ev.ticketera_pct), pct_online: Number(ev.pct_online),
            artistas: d.artistas.map((a, i) => ({ artista_id: a.artista_id, cache_acordado: Number(a.cache_acordado), fecha: editarId ? a.fecha : null, escenario: a.escenario || '', horario: hm(a.horario), es_headliner: a.es_headliner, orden: i })),
            bebidas: d.bebidas.map((b) => ({ bebida_id: b.bebida_id, cantidad: b.cantidad })),
            entradas: d.entradas.map((e) => ({ nombre: e.nombre, precio: Number(e.precio), cantidad: e.cantidad })),
            costos: d.costos.map((c) => ({ concepto: c.concepto, categoria: c.categoria, monto: Number(c.monto) })),
            sponsors: d.sponsors.map((s) => ({ nombre: s.nombre, rubro: s.rubro || '', aporte: Number(s.aporte), tipo: s.tipo })),
          }
          setBebidasAuto(false)
          if (editarId) setPaso(6)
        }
        if (!vivo) return
        setCfg(cv); setLugares(ls); setCatBebidas(bs); setForm(f); setListo(true)
        if (f.boliche_id && !origen && f.fecha) setPaso(2)
        else if (f.boliche_id && !origen) setPaso(1)
      } catch (e) { if (vivo) setErrCarga(e) }
    })()
    return () => { vivo = false }
    // eslint-disable-next-line
  }, [])

  const lugar = useMemo(() => lugares.find((l) => l.id === form?.boliche_id) || null, [lugares, form?.boliche_id])
  const dias = form?.tipo === 'festival' ? form.dias : 1
  const fechaFin = form?.fecha ? sumarDias(form.fecha, dias - 1) : ''
  const asistentes = lugar ? Math.round((lugar.capacidad * dias * (form?.ocupacion ?? 100)) / 100) : 0
  const capTotal = lugar ? lugar.capacidad * dias : 0

  // artistas que encajan / fechas libres cuando cambia el lugar, tipo o duración
  useEffect(() => {
    if (!lugar) return setArtistasFit([])
    api(`/boliches/${lugar.id}/artistas`, { params: { tipo: form.tipo } }).then((lista) => {
      setArtistasFit(lista)
      const ok = new Set(lista.filter((a) => a.encaja).map((a) => a.id))
      setForm((f) => {
        const quedan = f.artistas.filter((a) => ok.has(a.artista_id))
        if (quedan.length !== f.artistas.length) toast(`Se quitaron ${f.artistas.length - quedan.length} artista(s) que no encajan en este lugar`, 'info')
        return quedan.length !== f.artistas.length ? { ...f, artistas: quedan } : f
      })
    }).catch((e) => toast(e.message, 'error'))
    // eslint-disable-next-line
  }, [lugar?.id, form?.tipo])

  useEffect(() => {
    if (!lugar) return setFechasDisp([])
    api(`/boliches/${lugar.id}/fechas`, { params: { dias, evento_id: editarId } }).then((l) => {
      setFechasDisp(l.map((x) => x.fecha))
      setForm((f) => (f.fecha && !l.some((x) => x.fecha === f.fecha) ? { ...f, fecha: '' } : f))
    }).catch((e) => toast(e.message, 'error'))
    // eslint-disable-next-line
  }, [lugar?.id, dias])

  // bebidas sugeridas (mientras no las toques a mano)
  useEffect(() => {
    if (!bebidasAuto || !lugar) return
    const t = setTimeout(() => {
      api('/bebidas-sugeridas', { params: { asistentes, tragos: form.tragos_por_persona } })
        .then((l) => upd({ bebidas: l.filter((b) => b.cantidad > 0).map((b) => ({ bebida_id: b.id, cantidad: b.cantidad })) }))
        .catch(() => {})
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line
  }, [bebidasAuto, lugar?.id, asistentes, form?.tragos_por_persona, catBebidas.length])

  // ---------- presupuesto en vivo ----------
  const payload = (extra = {}) => ({
    nombre: form.nombre, tipo: form.tipo, boliche_id: form.boliche_id, fecha: form.fecha || null, fecha_fin: fechaFin || null,
    hora_inicio: form.hora_inicio || null, hora_fin: form.hora_fin || null, descripcion: form.descripcion, notas: form.notas,
    tragos_por_persona: form.tragos_por_persona, asistentes_estimados: asistentes, estado: form.estado,
    iva_pct: form.iva_pct, sadaic_pct: form.sadaic_pct, iibb_pct: form.iibb_pct, ticketera_pct: form.ticketera_pct, pct_online: form.pct_online,
    artistas: form.artistas.map((a, i) => ({ ...a, orden: i, fecha: form.tipo === 'festival' ? a.fecha || null : null, escenario: form.tipo === 'festival' ? a.escenario : '' })),
    bebidas: form.bebidas, entradas: form.entradas, costos: form.costos, sponsors: form.sponsors, ...extra,
  })
  const seq = useRef(0)
  const pedir = useRef(null)
  pedir.current = debounce((body) => {
    const n = ++seq.current
    api('/presupuesto', { method: 'POST', body, params: { evento_id: editarId } })
      .then((r) => n === seq.current && setPrevia(r)).catch(() => {})
  }, 280)
  useEffect(() => {
    if (!form || !lugar) return setPrevia(null)
    pedir.current(payload())
    return () => pedir.current.cancel()
    // eslint-disable-next-line
  }, [form, asistentes, fechaFin])

  if (errCarga) return <Vacio icon={AlertTriangle} titulo="No se pudo abrir el asistente" texto={errCarga.message}><Btn variant="ghost" onClick={() => ir('eventos')}>Volver</Btn></Vacio>
  if (!listo) return <Spinner texto="Preparando el asistente…" />

  const p = previa?.presupuesto
  const errores = previa?.errores || (lugar ? [] : ['Elegí el lugar'])
  const avisos = previa?.avisos || []
  const fit = (id) => artistasFit.find((a) => a.id === id)

  // ---------- acciones ----------
  const guardar = async (confirmar) => {
    setGuardando(true)
    try {
      const body = payload({ estado: confirmar ? 'confirmado' : form.estado })
      const r = editarId ? await api('/eventos/' + editarId, { method: 'PUT', body }) : await api('/eventos', { method: 'POST', body })
      toast(editarId ? 'Cambios guardados' : confirmar ? 'Evento confirmado 🎉' : 'Evento guardado como borrador')
      ir('eventos/' + (editarId || r.id))
    } catch (e) { toast(e.message, 'error'); if (e.detalles?.length > 1) setDlg({ errores: e.detalles }) } finally { setGuardando(false) }
  }
  const elegirTipo = (tipo) => {
    if (tipo === form.tipo) return
    upd({ tipo, dias: tipo === 'festival' ? 2 : 1, ocupacion: tipo === 'festival' ? cfg.ocupacion_festival_pct : 100, hora_inicio: tipo === 'festival' ? '16:00' : '23:30', hora_fin: tipo === 'festival' ? '02:00' : '05:30', entradas: [], fecha: '' })
  }
  const toggleArtista = (a) => {
    const ya = form.artistas.some((x) => x.artista_id === a.id)
    if (ya) return upd({ artistas: form.artistas.filter((x) => x.artista_id !== a.id) })
    const fest = form.tipo === 'festival'
    upd({ artistas: [...form.artistas, { artista_id: a.id, cache_acordado: Number(a.cache), fecha: fest ? form.fecha || null : null, escenario: fest ? (a.rol === 'principal' ? 'Principal' : 'Escenario 2') : '', horario: '', es_headliner: !fest ? false : a.rol === 'principal' && !form.artistas.some((x) => x.es_headliner), orden: form.artistas.length }] })
  }
  const setArt = (id, patch) => upd({ artistas: form.artistas.map((a) => (a.artista_id === id ? { ...a, ...patch } : a)) })
  const setLinea = (campo, i, patch) => upd({ [campo]: form[campo].map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const quitar = (campo, i) => upd({ [campo]: form[campo].filter((_, j) => j !== i) })

  const cargarPlantilla = () => {
    const base = PLANTILLAS[form.tipo]
    upd({ entradas: base.map((t) => ({ nombre: t.nombre, precio: t.precio, cantidad: Math.round(asistentes * t.p) })) })
  }
  const repartirEntradas = () => {
    const tot = form.entradas.reduce((t, e) => t + e.cantidad, 0)
    if (!tot) return
    upd({ entradas: form.entradas.map((e) => ({ ...e, cantidad: Math.round((e.cantidad / tot) * asistentes) })) })
  }
  const ajustarPrecios = (factor) => {
    if (!p || p.precio_equilibrio == null || !p.precio_promedio_entrada) return toast('Primero cargá precios y cantidades de entradas para calcular el equilibrio', 'info')
    if (p.precio_equilibrio < 1) return toast('Con estos números ya cubrís los costos aun con entradas gratis (las bebidas y sponsors alcanzan). No hace falta tocar los precios', 'info')
    const m = (p.precio_equilibrio * factor) / p.precio_promedio_entrada
    upd({ entradas: form.entradas.map((e) => ({ ...e, precio: redondear(e.precio * m) })) })
  }
  const cargarCostos = async () => {
    try {
      const r = await api('/costos-sugeridos', { method: 'POST', body: { boliche_id: lugar.id, asistentes, dias, artistas_cant: form.artistas.length, entradas_brutas: p?.entradas_brutas || 0, tipo: form.tipo } })
      upd({ costos: r.map((c) => ({ concepto: c.concepto, categoria: c.categoria, monto: c.monto })) })
      toast('Costos sugeridos cargados: ajustalos a tus presupuestos reales')
    } catch (e) { toast(e.message, 'error') }
  }
  const autoLineup = (presupuesto) => {
    const l = sugerirLineup({ candidatos: artistasFit, presupuesto, tipo: form.tipo, dias, fecha: form.fecha || hoyAR(), escenarios: lugar.escenarios })
    if (!l.length) return toast('No encontramos artistas que entren en ese presupuesto', 'info')
    upd({ artistas: l.map((a, i) => ({ ...a, orden: i, fecha: form.tipo === 'festival' ? (form.fecha ? a.fecha : null) : null })) })
    setDlg(null); toast(`Line-up sugerido con ${l.length} artista(s). Ajustalo a gusto`)
  }

  // ---------- estado de cada paso ----------
  const hecho = [!!lugar, !!form.fecha && !!form.nombre.trim(), form.artistas.length > 0, form.entradas.length > 0, form.bebidas.length > 0, form.costos.length > 0, false]
  const lugaresVisibles = lugares.filter((l) => (l.activo || l.id === form.boliche_id) && (verTodos || TIPOS_POR_EVENTO[form.tipo].includes(l.tipo) || l.id === form.boliche_id)
    && (!busqLugar || `${l.nombre} ${l.ciudad} ${l.provincia || ''}`.toLowerCase().includes(busqLugar.toLowerCase())))
  const fechasPorMes = fechasDisp.slice(0, 120).reduce((m, f) => { (m[f.slice(0, 7)] ||= []).push(f); return m }, {})
  const diasEvento = form.fecha ? Array.from({ length: dias }, (_, i) => sumarDias(form.fecha, i)) : []
  const totalBebidas = form.bebidas.reduce((t, b) => { const c = catBebidas.find((x) => x.id === b.bebida_id); return { costo: t.costo + b.cantidad * (c?.costo || 0), venta: t.venta + b.cantidad * (c?.precio_venta || 0) } }, { costo: 0, venta: 0 })
  const entradasTot = form.entradas.reduce((t, e) => t + (Number(e.cantidad) || 0), 0)
  const sumaPct = catBebidas.reduce((t, b) => t + Number(b.consumo_pct), 0)

  return (
    <div>
      <div className="page-head">
        <div><h1>{editarId ? 'Editar evento' : 'Nuevo evento'}</h1><p>{form.tipo === 'festival' ? 'Festival de varios días' : 'Noche de boliche'}{lugar ? ` · ${lugar.nombre}` : ''}</p></div>
        <div className="spacer" />
        <Btn variant="ghost" onClick={() => ir(editarId ? 'eventos/' + editarId : 'eventos')}>Cancelar</Btn>
      </div>

      <div className="steps" role="tablist">
        {PASOS.map((n, i) => (
          <button key={n} role="tab" aria-selected={paso === i} className={'step' + (paso === i ? ' on' : '') + (hecho[i] && paso !== i ? ' done' : '')} onClick={() => setPaso(i)}>
            <span className="n">{hecho[i] && paso !== i ? <Check size={13} /> : i + 1}</span>{n}
          </button>
        ))}
      </div>

      <div className="wiz">
        <div className="stack" style={{ gap: 16 }}>
          {/* ============ 1. TIPO Y LUGAR ============ */}
          {paso === 0 && (<>
            <section className="card">
              <div className="card-head"><h2>¿Qué tipo de evento es?</h2></div>
              <div className="tipo-cards">
                <button className={'tipo-card' + (form.tipo === 'boliche' ? ' on' : '')} onClick={() => elegirTipo('boliche')}>
                  <Disc3 size={28} /><b>Noche de boliche</b><span>Una sola fecha, uno o dos artistas, barra y VIP.</span>
                </button>
                <button className={'tipo-card festival' + (form.tipo === 'festival' ? ' on' : '')} onClick={() => elegirTipo('festival')}>
                  <Tent size={28} /><b>Festival</b><span>Varios días, escenarios, line-up grande, entradas por tipo y sponsors.</span>
                </button>
              </div>
            </section>
            <section className="card">
              <div className="card-head"><h2>Elegí el lugar</h2><div className="spacer" />
                <label className="row small muted" style={{ gap: 6 }}><input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} />Mostrar todos los tipos</label>
              </div>
              <div className="search" style={{ marginBottom: 12 }}><Search size={16} /><input placeholder="Buscar por nombre, ciudad o provincia…" value={busqLugar} onChange={(e) => setBusqLugar(e.target.value)} /></div>
              {lugaresVisibles.length === 0 ? <Vacio titulo="No hay lugares de este tipo" texto="Cargá uno en Lugares, o activá “Mostrar todos los tipos”." /> : (
                <div className="lugares">
                  {lugaresVisibles.map((l) => (
                    <button key={l.id} className={'lugar' + (form.boliche_id === l.id ? ' on' : '')} onClick={() => upd({ boliche_id: l.id, fecha: '' })}>
                      <b>{l.nombre}</b><small>{l.ciudad}{l.provincia ? `, ${l.provincia}` : ''}</small>
                      <small>{TIPOS_LUGAR[l.tipo]} · {num(l.capacidad)} personas{l.escenarios > 1 ? ` · ${l.escenarios} escenarios` : ''}</small>
                      <small className="sol">Alquiler {$c(l.costo_alquiler)} / día</small>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>)}

          {/* ============ 2. FECHA ============ */}
          {paso === 1 && (<>
            <section className="card">
              <div className="card-head"><h2>Datos del evento</h2></div>
              <div className="form-grid">
                <Field label="Nombre del evento" className="full"><input value={form.nombre} onChange={(e) => upd({ nombre: e.target.value })} placeholder={form.tipo === 'festival' ? 'Ej: Festival Córdoba Suena' : 'Ej: Noche de Cuarteto'} /></Field>
                <Field label="Descripción (opcional)" className="full"><textarea value={form.descripcion} onChange={(e) => upd({ descripcion: e.target.value })} /></Field>
                {form.tipo === 'festival' && (
                  <Field label="Duración" hint="Los días tienen que estar consecutivos y libres en el predio">
                    <select value={form.dias} onChange={(e) => upd({ dias: Number(e.target.value), fecha: '' })}>
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{d} día{d > 1 ? 's' : ''}</option>)}
                    </select>
                  </Field>
                )}
                <Field label="Hora de inicio"><input type="time" value={form.hora_inicio} onChange={(e) => upd({ hora_inicio: e.target.value })} /></Field>
                <Field label="Hora de cierre"><input type="time" value={form.hora_fin} onChange={(e) => upd({ hora_fin: e.target.value })} /></Field>
              </div>
            </section>
            <section className="card">
              <div className="card-head"><h2>{form.tipo === 'festival' ? 'Fecha de inicio' : 'Fecha'}</h2>
                {lugar && <span className="muted small">{fechasDisp.length} disponibles en {lugar.nombre}</span>}</div>
              {!lugar ? <Vacio titulo="Primero elegí el lugar" /> : fechasDisp.length === 0 ? (
                <Vacio titulo="No hay fechas libres" texto={form.tipo === 'festival' && dias > 1 ? `No encontramos ${dias} días seguidos libres. Probá con menos días o habilitá más fechas en el Calendario.` : 'Habilitá más fechas desde el Calendario.'}>
                  <a className="btn ghost" href="#/calendario">Ir al calendario</a>
                </Vacio>
              ) : (
                <div className="fechas-grid">
                  {Object.entries(fechasPorMes).map(([mes, fs]) => (
                    <div key={mes} style={{ display: 'contents' }}>
                      <div className="mes-label">{mesLabel(mes)}</div>
                      {fs.map((f) => {
                        const fe = feriadoDe(f), largo = esFindeLargo(f)
                        return (
                          <button key={f} className={'fecha-chip' + (form.fecha === f ? ' on' : '') + (largo || fe ? ' largo' : '')} onClick={() => upd({ fecha: f })} title={fe?.nombre}>
                            <small>{fechaCorta(f).split(' ')[0]}</small><b>{Number(f.slice(8))}</b>{(fe || largo) && <em>{fe ? 'Feriado' : 'Finde largo'}</em>}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
              {form.fecha && <div className="helper" style={{ marginTop: 14 }}><Info size={16} /><div>
                <b>{dias > 1 ? `${fechaLarga(form.fecha)} → ${fechaLarga(fechaFin)}` : fechaLarga(form.fecha)}</b>
                <div className="row" style={{ gap: 6, marginTop: 6 }}><FeriadosChips desde={form.fecha} hasta={fechaFin} /></div>
              </div></div>}
            </section>
            {lugar && (
              <section className="card">
                <div className="card-head"><h2>Asistencia estimada</h2></div>
                <div className="slider-row">
                  <div><input type="range" min="10" max="100" value={Math.round(form.ocupacion)} onChange={(e) => upd({ ocupacion: Number(e.target.value) })} />
                    <div className="muted small">Ocupación {Math.round(form.ocupacion)}% de {num(capTotal)} lugares{dias > 1 ? ` (${num(lugar.capacidad)} × ${dias} días)` : ''}</div></div>
                  <Field label="Asistentes"><NumInput value={asistentes} max={capTotal} onChange={(v) => upd({ ocupacion: Math.min(100, Math.max(1, (v / capTotal) * 100)) })} /></Field>
                </div>
              </section>
            )}
          </>)}

          {/* ============ 3. LINE-UP ============ */}
          {paso === 2 && (<>
            {!lugar ? <Vacio titulo="Primero elegí el lugar" /> : (<>
              <section className="card">
                <div className="card-head">
                  <h2>Artistas para {lugar.nombre}</h2><span className="muted small">{artistasFit.filter((a) => a.encaja).length} encajan con {num(lugar.capacidad)} personas</span>
                  <div className="spacer" /><Btn variant="ghost" size="sm" icon={Wand2} onClick={() => setDlg({ lineup: true })}>Sugerir line-up</Btn>
                </div>
                <div className="search" style={{ marginBottom: 12 }}><Search size={16} /><input placeholder="Buscar artista o género…" value={busqArt} onChange={(e) => setBusqArt(e.target.value)} /></div>
                <div className="art-grid">
                  {artistasFit.filter((a) => !busqArt || `${a.nombre} ${a.genero || ''} ${a.ciudad_origen || ''}`.toLowerCase().includes(busqArt.toLowerCase())).map((a) => {
                    const on = form.artistas.some((x) => x.artista_id === a.id)
                    return (
                      <button key={a.id} className={'art' + (on ? ' on' : '')} disabled={!a.encaja} onClick={() => toggleArtista(a)} title={a.motivo || ''}>
                        <b>{a.nombre}{a.rol === 'soporte' && <Badge color="violeta">soporte</Badge>}</b>
                        <small>{a.genero || '—'}{a.ciudad_origen ? ` · ${a.ciudad_origen}` : ''}</small>
                        <small className="sol">{$c(a.cache)}</small>
                        {!a.encaja && <small className="neg">{a.motivo}</small>}
                        {on && <Check size={17} className="tick" />}
                      </button>
                    )
                  })}
                </div>
              </section>
              <section className="card">
                <div className="card-head"><h2>Line-up del evento</h2><span className="muted small">{form.artistas.length} artista(s) · {$c(form.artistas.reduce((t, a) => t + a.cache_acordado, 0))}</span></div>
                {form.artistas.length === 0 ? <Vacio titulo="Todavía no elegiste artistas" texto="Tocá los que quieras arriba, o pedí un line-up sugerido." /> : (
                  <div className="tablewrap"><table>
                    <thead><tr><th>Artista</th><th>Caché acordado</th>{form.tipo === 'festival' && dias > 1 && <th>Día</th>}{form.tipo === 'festival' && <th>Escenario</th>}<th>Horario</th><th /></tr></thead>
                    <tbody>
                      {form.artistas.map((a) => (
                        <tr key={a.artista_id}>
                          <td><div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                            <button className="icon-btn" title="Marcar como headliner" onClick={() => setArt(a.artista_id, { es_headliner: !a.es_headliner })}><Star size={17} fill={a.es_headliner ? 'var(--sol)' : 'none'} color={a.es_headliner ? 'var(--sol)' : 'currentColor'} /></button>
                            <b>{fit(a.artista_id)?.nombre || `#${a.artista_id}`}</b></div></td>
                          <td style={{ minWidth: 150 }}><NumInput prefix="$" value={a.cache_acordado} onChange={(v) => setArt(a.artista_id, { cache_acordado: v })} /></td>
                          {form.tipo === 'festival' && dias > 1 && <td><select value={a.fecha || ''} onChange={(e) => setArt(a.artista_id, { fecha: e.target.value || null })}><option value="">Sin asignar</option>{diasEvento.map((d) => <option key={d} value={d}>{fechaCorta(d)}</option>)}</select></td>}
                          {form.tipo === 'festival' && <td><input list="escenarios" value={a.escenario || ''} onChange={(e) => setArt(a.artista_id, { escenario: e.target.value })} placeholder="Principal" /></td>}
                          <td><input type="time" value={a.horario || ''} onChange={(e) => setArt(a.artista_id, { horario: e.target.value })} /></td>
                          <td><button className="icon-btn bad" onClick={() => toggleArtista({ id: a.artista_id })} aria-label="Quitar"><Trash2 size={16} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                )}
                <datalist id="escenarios">{Array.from({ length: Math.max(lugar.escenarios, 2) }, (_, i) => <option key={i} value={i === 0 ? 'Principal' : `Escenario ${i + 1}`} />)}</datalist>
              </section>
            </>)}
          </>)}

          {/* ============ 4. ENTRADAS ============ */}
          {paso === 3 && (
            <section className="card">
              <div className="card-head"><h2>Tipos de entrada</h2><div className="spacer" />
                <Btn variant="ghost" size="sm" icon={Sparkles} onClick={cargarPlantilla}>Plantilla {form.tipo === 'festival' ? 'festival' : 'boliche'}</Btn>
                <Btn size="sm" icon={Plus} onClick={() => upd({ entradas: [...form.entradas, { nombre: '', precio: 0, cantidad: 0 }] })}>Agregar</Btn>
              </div>
              {form.entradas.length === 0 ? <Vacio titulo="Sin entradas" texto="Cargá los tipos de ticket (General, VIP, Early Bird…) con su precio final y cuántas pensás vender."><Btn onClick={cargarPlantilla}>Usar plantilla</Btn></Vacio> : (<>
                <div className="tablewrap"><table>
                  <thead><tr><th>Tipo</th><th>Precio final</th><th>Cantidad</th><th className="num">Recaudación</th><th /></tr></thead>
                  <tbody>
                    {form.entradas.map((e, i) => (
                      <tr key={i}>
                        <td><input value={e.nombre} onChange={(ev) => setLinea('entradas', i, { nombre: ev.target.value })} placeholder="General" /></td>
                        <td style={{ minWidth: 140 }}><NumInput prefix="$" value={e.precio} onChange={(v) => setLinea('entradas', i, { precio: v })} /></td>
                        <td style={{ minWidth: 110 }}><NumInput value={e.cantidad} onChange={(v) => setLinea('entradas', i, { cantidad: v })} /></td>
                        <td className="num">{$(e.precio * e.cantidad)}</td>
                        <td><button className="icon-btn bad" onClick={() => quitar('entradas', i)} aria-label="Quitar"><Trash2 size={16} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
                <div style={{ marginTop: 14 }}>
                  <div className="row small"><span className="muted">Entradas: {num(entradasTot)} de {num(capTotal)} lugares</span><div className="spacer" /><span className="muted">Asistencia estimada: {num(asistentes)}</span></div>
                  <Barra valor={entradasTot} max={capTotal} tono="verde" />
                </div>
                <div className="row" style={{ marginTop: 14 }}>
                  <Btn variant="ghost" size="sm" icon={RefreshCw} onClick={repartirEntradas}>Repartir según asistentes</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => ajustarPrecios(1)}>Precios al punto de equilibrio</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => ajustarPrecios(1.25)}>Equilibrio + 25%</Btn>
                </div>
              </>)}
              <div className="helper" style={{ marginTop: 14 }}><Info size={16} /><span>Cargá el <b>precio final al público</b> (con IVA incluido). El IVA, SADAIC, Ingresos Brutos y la comisión de la ticketera se calculan solos.</span></div>
            </section>
          )}

          {/* ============ 5. BEBIDAS ============ */}
          {paso === 4 && (
            <section className="card">
              <div className="card-head"><h2>Bebidas</h2><div className="spacer" />
                <Btn variant="ghost" size="sm" icon={RefreshCw} onClick={() => { setBebidasAuto(true); toast('Cantidades recalculadas', 'info') }}>Recalcular sugeridas</Btn></div>
              <div className="form-grid" style={{ marginBottom: 14 }}>
                <Field label="Tragos por persona" hint={`Cantidad sugerida = ${num(asistentes)} asistentes × tragos × % de consumo de cada bebida`}>
                  <NumInput value={form.tragos_por_persona} min={0} max={30} onChange={(v) => upd({ tragos_por_persona: v })} /></Field>
              </div>
              <div className="tablewrap"><table>
                <thead><tr><th>Bebida</th><th className="num">% consumo</th><th>Cantidad</th><th className="num">Costo total</th><th className="num">Venta total</th><th className="num">Ganancia</th></tr></thead>
                <tbody>
                  {catBebidas.map((b) => {
                    const cant = form.bebidas.find((x) => x.bebida_id === b.id)?.cantidad || 0
                    return (
                      <tr key={b.id}>
                        <td><b>{b.nombre}</b><div className="muted small">{b.categoria}</div></td><td className="num">{pct(b.consumo_pct, 0)}</td>
                        <td style={{ minWidth: 110 }}><NumInput value={cant} onChange={(v) => { setBebidasAuto(false); upd({ bebidas: [...form.bebidas.filter((x) => x.bebida_id !== b.id), ...(v > 0 ? [{ bebida_id: b.id, cantidad: v }] : [])] }) }} /></td>
                        <td className="num">{$(cant * b.costo)}</td><td className="num">{$(cant * b.precio_venta)}</td><td className="num pos">{$(cant * (b.precio_venta - b.costo))}</td>
                      </tr>
                    )
                  })}
                  <tr className="total"><td colSpan={3}>Total</td><td className="num">{$(totalBebidas.costo)}</td><td className="num">{$(totalBebidas.venta)}</td><td className="num pos">{$(totalBebidas.venta - totalBebidas.costo)}</td></tr>
                </tbody>
              </table></div>
              {Math.abs(sumaPct - 100) > 0.5 && <div className="alerta aviso" style={{ marginTop: 12 }}><Info size={15} />Los % de consumo de tus bebidas suman {pct(sumaPct, 0)} (deberían sumar 100%). Ajustalos en Catálogos → Bebidas.</div>}
            </section>
          )}

          {/* ============ 6. COSTOS Y SPONSORS ============ */}
          {paso === 5 && (<>
            <section className="card">
              <div className="card-head"><h2>Costos de producción</h2><div className="spacer" />
                <Btn variant="ghost" size="sm" icon={Wand2} onClick={() => (form.costos.length ? setDlg({ confirmarCostos: true }) : cargarCostos())}>Cargar sugeridos</Btn>
                <Btn size="sm" icon={Plus} onClick={() => upd({ costos: [...form.costos, { concepto: '', categoria: 'otros', monto: 0 }] })}>Agregar</Btn></div>
              {form.costos.length === 0 ? <Vacio titulo="Sin costos extra" texto="Seguridad, ambulancia, sonido, limpieza, seguros, publicidad… Podés cargar valores sugeridos según el tamaño del evento."><Btn onClick={cargarCostos}>Cargar sugeridos</Btn></Vacio> : (
                <div className="tablewrap"><table>
                  <thead><tr><th>Concepto</th><th>Categoría</th><th>Monto</th><th /></tr></thead>
                  <tbody>
                    {form.costos.map((c, i) => (
                      <tr key={i}>
                        <td><input value={c.concepto} onChange={(e) => setLinea('costos', i, { concepto: e.target.value })} placeholder="Concepto" /></td>
                        <td><select value={c.categoria} onChange={(e) => setLinea('costos', i, { categoria: e.target.value })}>{Object.entries(CATEGORIAS_COSTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                        <td style={{ minWidth: 150 }}><NumInput prefix="$" value={c.monto} onChange={(v) => setLinea('costos', i, { monto: v })} /></td>
                        <td><button className="icon-btn bad" onClick={() => quitar('costos', i)} aria-label="Quitar"><Trash2 size={16} /></button></td>
                      </tr>
                    ))}
                    <tr className="total"><td colSpan={2}>Total</td><td>{$(form.costos.reduce((t, c) => t + c.monto, 0))}</td><td /></tr>
                  </tbody>
                </table></div>
              )}
            </section>
            <section className="card">
              <div className="card-head"><h2>Sponsors</h2><span className="muted small">en efectivo suman caja · en canje no</span><div className="spacer" />
                <Btn size="sm" icon={Plus} onClick={() => upd({ sponsors: [...form.sponsors, { nombre: '', rubro: '', aporte: 0, tipo: 'efectivo' }] })}>Agregar</Btn></div>
              {form.sponsors.length === 0 ? <Vacio titulo="Sin sponsors" texto="Marcas que aportan plata o canje (bebidas, tecnología, telefonía…). Aportes netos de IVA." /> : (
                <div className="tablewrap"><table>
                  <thead><tr><th>Marca</th><th>Rubro</th><th>Aporte</th><th>Tipo</th><th /></tr></thead>
                  <tbody>
                    {form.sponsors.map((s, i) => (
                      <tr key={i}>
                        <td><input value={s.nombre} onChange={(e) => setLinea('sponsors', i, { nombre: e.target.value })} placeholder="Marca" /></td>
                        <td><input list="rubros" value={s.rubro} onChange={(e) => setLinea('sponsors', i, { rubro: e.target.value })} /></td>
                        <td style={{ minWidth: 150 }}><NumInput prefix="$" value={s.aporte} onChange={(v) => setLinea('sponsors', i, { aporte: v })} /></td>
                        <td><select value={s.tipo} onChange={(e) => setLinea('sponsors', i, { tipo: e.target.value })}><option value="efectivo">Efectivo</option><option value="canje">Canje</option></select></td>
                        <td><button className="icon-btn bad" onClick={() => quitar('sponsors', i)} aria-label="Quitar"><Trash2 size={16} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
              <datalist id="rubros">{RUBROS.map((r) => <option key={r} value={r} />)}</datalist>
            </section>
            <section className="card flat">
              <div className="card-head"><h2>Impuestos y comisiones</h2><span className="muted small">valores de referencia: confirmalos con tu contador</span></div>
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
                <Field label="IVA"><NumInput suffix="%" step={0.5} max={100} value={form.iva_pct} onChange={(v) => upd({ iva_pct: v })} /></Field>
                <Field label="SADAIC / AADI-CAPIF"><NumInput suffix="%" step={0.5} max={100} value={form.sadaic_pct} onChange={(v) => upd({ sadaic_pct: v })} /></Field>
                <Field label="Ingresos Brutos"><NumInput suffix="%" step={0.5} max={100} value={form.iibb_pct} onChange={(v) => upd({ iibb_pct: v })} /></Field>
                <Field label="Comisión ticketera"><NumInput suffix="%" step={0.5} max={100} value={form.ticketera_pct} onChange={(v) => upd({ ticketera_pct: v })} /></Field>
                <Field label="% venta online"><NumInput suffix="%" max={100} value={form.pct_online} onChange={(v) => upd({ pct_online: v })} /></Field>
              </div>
            </section>
          </>)}

          {/* ============ 7. RESUMEN ============ */}
          {paso === 6 && (<>
            <Alertas errores={errores} avisos={avisos} />
            {!errores.length && p && <div className="alerta" style={{ background: 'rgba(62,207,142,.1)', border: '1px solid rgba(62,207,142,.3)', color: '#a8efce' }}><Check size={15} />Todo en orden para guardar.</div>}
            <section className="card">
              <div className="card-head"><h2>{form.nombre || 'Sin nombre'}</h2></div>
              <div className="ev-meta" style={{ marginBottom: 14 }}>
                <span>{lugar?.nombre}</span><span>{form.fecha ? rangoFechas(form.fecha, fechaFin) : 'Sin fecha'}</span><span>{num(asistentes)} asistentes</span>
                <span>{form.artistas.length} artistas</span><span>{form.entradas.length} tipos de entrada</span>
              </div>
              {p ? <PresupuestoTabla p={p} dolar={cfg.dolar_ref} /> : <Spinner />}
            </section>
            {p && <section className="card flat"><div className="card-head"><h2>Punto de equilibrio</h2></div><Equilibrio p={p} /></section>}
            <section className="card"><Field label="Notas internas (opcional)"><textarea value={form.notas} onChange={(e) => upd({ notas: e.target.value })} placeholder="Contratos pendientes, contactos, riders…" /></Field></section>
            <div className="row">
              <div className="spacer" />
              <Btn variant="ghost" icon={Save} loading={guardando} disabled={errores.length > 0} onClick={() => guardar(false)}>{editarId ? 'Guardar cambios' : 'Guardar borrador'}</Btn>
              {form.estado !== 'confirmado' && <Btn icon={Check} loading={guardando} disabled={errores.length > 0 || !form.artistas.length || !form.entradas.length} onClick={() => guardar(true)}>{editarId ? 'Guardar y confirmar' : 'Guardar y confirmar'}</Btn>}
            </div>
          </>)}

          <div className="wiz-nav">
            <Btn variant="ghost" icon={ChevronLeft} disabled={paso === 0} onClick={() => setPaso(paso - 1)}>Anterior</Btn>
            {paso < 6 && <Btn icon={ChevronRight} onClick={() => setPaso(paso + 1)} disabled={paso === 0 && !lugar}>{paso === 5 ? 'Ver resumen' : 'Siguiente'}</Btn>}
          </div>
        </div>

        {/* ============ PANEL EN VIVO ============ */}
        <aside className="live">
          <div className="card">
            <div className="muted small">Ganancia estimada</div>
            <div className={'big ' + (p ? (p.ganancia >= 0 ? 'pos' : 'neg') : '')}>{p ? $(p.ganancia) : '—'}</div>
            {p && <div className="muted small">{usd(p.ganancia, cfg.dolar_ref)} · margen {pct(p.margen_pct)}</div>}
            {p && (<div style={{ marginTop: 10 }}>
              <div className="live-row"><span>Ingresos netos</span><b>{$c(p.ingresos_neto)}</b></div>
              <div className="live-row"><span>Artistas</span><b>{$c(p.costo_artistas)}</b></div>
              <div className="live-row"><span>Alquiler{dias > 1 ? ` × ${dias}` : ''}</span><b>{$c(p.costo_alquiler)}</b></div>
              <div className="live-row"><span>Bebidas (costo)</span><b>{$c(p.costo_bebidas)}</b></div>
              <div className="live-row"><span>Producción y extras</span><b>{$c(p.costo_extras)}</b></div>
              <div className="live-row"><span>Impuestos y comisiones</span><b>{$c(p.impuestos_total)}</b></div>
              <div className="live-row" style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 8 }}><span>Costo total</span><b>{$c(p.costo_total)}</b></div>
            </div>)}
          </div>
          {p && <div className="card flat"><div className="muted small" style={{ marginBottom: 6, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.05em' }}>Equilibrio</div><Equilibrio p={p} /></div>}
          {(errores.length > 0 || avisos.length > 0) && paso !== 6 && <Alertas errores={errores.slice(0, 3)} avisos={avisos.slice(0, 3)} />}
        </aside>
      </div>

      <div className="mobile-live">
        <div><div className="muted small">Ganancia estimada</div><b className={p && p.ganancia < 0 ? 'neg' : 'pos'} style={{ fontSize: 18 }}>{p ? $c(p.ganancia) : '—'}</b></div>
        <Btn size="sm" variant="ghost" onClick={() => setPaso(6)}>Ver resumen{errores.length ? ` (${errores.length})` : ''}</Btn>
      </div>

      {dlg?.lineup && <LineupDialog onClose={() => setDlg(null)} onOk={autoLineup} sugerido={Math.round((lugar?.costo_alquiler || 0) * 2 || 5000000)} />}
      {dlg?.confirmarCostos && <Confirmar titulo="Reemplazar costos" texto="Esto reemplaza los costos que ya cargaste por los sugeridos." confirmarLabel="Reemplazar" onConfirm={cargarCostos} onClose={() => setDlg(null)} />}
      {dlg?.errores && (
        <Modal titulo="No se pudo guardar" onClose={() => setDlg(null)} footer={<Btn onClick={() => setDlg(null)}>Entendido</Btn>}>
          <Alertas errores={dlg.errores} />
        </Modal>
      )}
    </div>
  )
}

function LineupDialog({ onClose, onOk, sugerido }) {
  const [v, setV] = useState(sugerido)
  return (
    <Modal titulo="Sugerir line-up" onClose={onClose} ancho={460} footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={Wand2} onClick={() => onOk(v)}>Armar line-up</Btn></>}>
      <div className="stack">
        <p className="muted" style={{ margin: 0 }}>Elegimos artistas que encajan con el lugar y entran en tu presupuesto: headliners primero, después soportes. Reemplaza el line-up actual.</p>
        <Field label="Presupuesto máximo para artistas"><NumInput prefix="$" value={v} onChange={setV} /></Field>
      </div>
    </Modal>
  )
}
