import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarPlus, Flag, Disc3, Tent } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ir } from '../router.js'
import { Btn, Field, Modal, Spinner, Badge, useCarga, useToast } from '../ui.jsx'
import { feriadoDe, sumarDias, diaSemana, hoyAR, mesLabel, fechaLarga, DIAS_SEMANA } from '../utils.js'

const LUN_PRIMERO = [1, 2, 3, 4, 5, 6, 0]
const mesDe = (iso) => iso.slice(0, 7)
const mover = (ym, n) => { const d = new Date(ym + '-15T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7) }

export default function Calendario() {
  const { puedeEditar } = useAuth()
  const toast = useToast()
  const [mes, setMes] = useState(mesDe(hoyAR()))
  const [lugarId, setLugarId] = useState('')
  const [dia, setDia] = useState(null)
  const [gen, setGen] = useState(false)

  const hoy = hoyAR()
  const primero = mes + '-01'
  const offset = (diaSemana(primero) + 6) % 7
  const inicio = sumarDias(primero, -offset)
  const celdas = useMemo(() => Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i)), [inicio])
  const desde = celdas[0], hasta = celdas[41]

  const { data: lugares } = useCarga(() => api('/boliches'), [])
  const { data, cargando, recargar } = useCarga(async () => {
    const [evs, fechas] = await Promise.all([
      api('/calendario/eventos', { params: { desde, hasta } }),
      lugarId ? api(`/boliches/${lugarId}/calendario`, { params: { desde, hasta } }) : Promise.resolve([]),
    ])
    return { evs, fechas }
  }, [desde, lugarId])

  const eventos = (data?.evs || []).filter((e) => !lugarId || e.boliche_id === Number(lugarId))
  const fechasMap = new Map((data?.fechas || []).map((f) => [f.fecha, f]))
  const lugar = lugares?.find((l) => l.id === Number(lugarId))

  const accion = async (fn, ok) => {
    try { await fn(); toast(ok); setDia(null); recargar() } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Calendario</h1><p>Eventos, feriados nacionales y disponibilidad de cada lugar.</p></div>
        <div className="spacer" />
        {puedeEditar && <Btn variant="ghost" icon={CalendarPlus} disabled={!lugarId} title={lugarId ? '' : 'Elegí un lugar'} onClick={() => setGen(true)}>Habilitar fechas</Btn>}
      </div>

      <div className="filters">
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn" onClick={() => setMes(mover(mes, -1))} aria-label="Mes anterior"><ChevronLeft size={20} /></button>
          <h2 style={{ minWidth: 190, textAlign: 'center' }}>{mesLabel(mes)}</h2>
          <button className="icon-btn" onClick={() => setMes(mover(mes, 1))} aria-label="Mes siguiente"><ChevronRight size={20} /></button>
          <Btn variant="ghost" size="sm" onClick={() => setMes(mesDe(hoy))}>Hoy</Btn>
        </div>
        <div className="spacer" />
        <select value={lugarId} onChange={(e) => setLugarId(e.target.value)} aria-label="Lugar" style={{ minWidth: 240 }}>
          <option value="">Todos los lugares (solo eventos)</option>
          {(lugares || []).map((l) => <option key={l.id} value={l.id}>{l.nombre} · {l.ciudad}</option>)}
        </select>
      </div>

      <div className="cal-legend" style={{ marginBottom: 12 }}>
        <span><Flag size={13} color="var(--celeste)" />Feriado</span>
        <span><i className="cal-ev" style={{ padding: '2px 8px' }}>Boliche</i></span>
        <span><i className="cal-ev festival" style={{ padding: '2px 8px' }}>Festival</i></span>
        {lugarId && <><span><i className="dot libre" />Libre</span><span><i className="dot ocup" />Con evento</span><span><i className="dot bloq" />Bloqueada</span></>}
      </div>

      {cargando && !data ? <Spinner /> : (
        <div className="cal">
          {LUN_PRIMERO.map((d) => <div key={d} className="cal-dow">{DIAS_SEMANA[d]}</div>)}
          {celdas.map((f) => {
            const fe = feriadoDe(f), fila = fechasMap.get(f)
            const evs = eventos.filter((e) => e.fecha <= f && e.fecha_fin >= f)
            const clic = lugarId && puedeEditar && !fila?.evento_id && f >= hoy
            return (
              <div key={f} className={'cal-day' + (mesDe(f) !== mes ? ' out' : '') + (f === hoy ? ' hoy' : '') + (fe ? ' feriado' : '') + (clic ? ' clic' : '')}
                onClick={() => clic && setDia(f)}>
                <div className="dn"><span>{Number(f.slice(8))}</span>
                  {lugarId && fila && <i className={'dot ' + (fila.evento_id ? 'ocup' : fila.disponible ? 'libre' : 'bloq')} title={fila.nota || ''} />}</div>
                {fe && <div className="fer">{fe.nombre}</div>}
                {evs.slice(0, 3).map((e) => (
                  <button key={e.id} className={'cal-ev ' + e.tipo + (e.estado === 'borrador' ? ' borrador' : '')} title={`${e.nombre} · ${e.lugar?.nombre}`}
                    onClick={(ev) => { ev.stopPropagation(); ir('eventos/' + e.id) }}>{e.nombre}</button>
                ))}
                {evs.length > 3 && <span className="muted small">+{evs.length - 3} más</span>}
              </div>
            )
          })}
        </div>
      )}

      {dia && lugar && (() => {
        const fila = fechasMap.get(dia), fe = feriadoDe(dia)
        return (
          <Modal titulo={fechaLarga(dia)} onClose={() => setDia(null)} ancho={460}>
            <div className="stack">
              <div className="row" style={{ gap: 8 }}><b>{lugar.nombre}</b>{fe && <Badge color="celeste" icon={Flag}>{fe.nombre}</Badge>}
                <Badge color={!fila ? 'gris' : fila.disponible ? 'verde' : 'warn'}>{!fila ? 'No habilitada' : fila.disponible ? 'Libre' : 'Bloqueada'}</Badge></div>
              {fila?.nota && <div className="muted small">Nota: {fila.nota}</div>}
              {(!fila || fila.disponible) && (
                <div className="grid g2">
                  <Btn icon={Disc3} disabled={!fila} onClick={() => ir(`eventos/nuevo?tipo=boliche&lugar=${lugar.id}&fecha=${dia}`)}>Boliche acá</Btn>
                  <Btn variant="sol" icon={Tent} disabled={!fila} onClick={() => ir(`eventos/nuevo?tipo=festival&lugar=${lugar.id}&fecha=${dia}`)}>Festival acá</Btn>
                </div>
              )}
              <div className="row">
                {!fila && <Btn variant="ghost" onClick={() => accion(() => api(`/boliches/${lugar.id}/fechas/${dia}`, { method: 'PATCH', body: { disponible: true } }), 'Fecha habilitada')}>Habilitar esta fecha</Btn>}
                {fila?.disponible && <Btn variant="ghost" onClick={() => accion(() => api(`/boliches/${lugar.id}/fechas/${dia}`, { method: 'PATCH', body: { disponible: false, nota: 'Bloqueada manualmente' } }), 'Fecha bloqueada')}>Bloquear</Btn>}
                {fila && !fila.disponible && <Btn variant="ghost" onClick={() => accion(() => api(`/boliches/${lugar.id}/fechas/${dia}`, { method: 'PATCH', body: { disponible: true, nota: '' } }), 'Fecha liberada')}>Liberar</Btn>}
                {fila && <Btn variant="danger" onClick={() => accion(() => api(`/boliches/${lugar.id}/fechas/${dia}`, { method: 'DELETE' }), 'Fecha deshabilitada')}>Deshabilitar</Btn>}
              </div>
            </div>
          </Modal>
        )
      })()}

      {gen && lugar && <GenerarFechas lugar={lugar} onClose={() => setGen(false)} onHecho={() => { setGen(false); recargar() }} />}
    </div>
  )
}

function GenerarFechas({ lugar, onClose, onHecho }) {
  const toast = useToast()
  const hoy = hoyAR()
  const [f, setF] = useState({ desde: hoy, hasta: sumarDias(hoy, 120), dias: lugar.tipo === 'predio_festival' || lugar.tipo === 'estadio' ? [5, 6, 0] : [5, 6] })
  const [cargando, setCargando] = useState(false)
  const toggle = (d) => setF((s) => ({ ...s, dias: s.dias.includes(d) ? s.dias.filter((x) => x !== d) : [...s.dias, d] }))
  const ok = async () => {
    setCargando(true)
    try {
      const r = await api(`/boliches/${lugar.id}/fechas/generar`, { method: 'POST', body: { desde: f.desde, hasta: f.hasta, dias_semana: f.dias } })
      toast(`${r.fechas} fecha(s) procesadas (las que ya existían no se tocan)`); onHecho()
    } catch (e) { toast(e.message, 'error') } finally { setCargando(false) }
  }
  return (
    <Modal titulo={`Habilitar fechas · ${lugar.nombre}`} onClose={onClose} ancho={480} footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn loading={cargando} onClick={ok}>Habilitar</Btn></>}>
      <div className="stack">
        <div className="form-grid">
          <Field label="Desde"><input type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></Field>
          <Field label="Hasta"><input type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></Field>
        </div>
        <Field label="Días de la semana">
          <div className="dias-check">{LUN_PRIMERO.map((d) => <button key={d} type="button" className={'chip' + (f.dias.includes(d) ? ' on' : '')} onClick={() => toggle(d)}>{DIAS_SEMANA[d]}</button>)}</div>
        </Field>
        <div className="row"><button className="link" onClick={() => setF({ ...f, dias: [5, 6] })}>Vie y Sáb</button><button className="link" onClick={() => setF({ ...f, dias: [5, 6, 0] })}>Vie a Dom</button><button className="link" onClick={() => setF({ ...f, dias: [0, 1, 2, 3, 4, 5, 6] })}>Todos</button></div>
      </div>
    </Modal>
  )
}
