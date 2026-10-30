import { useState } from 'react'
import { Pencil, Copy, Printer, Download, Trash2, MapPin, CalendarDays, Clock, Users, Check, Ban, RotateCcw, Flag, AlertTriangle, Star, ArrowLeft } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ir } from '../router.js'
import { Btn, Stat, Spinner, Vacio, Alertas, Confirmar, EstadoBadge, Badge, useCarga, useToast } from '../ui.jsx'
import { Barra } from '../charts.jsx'
import { TipoBadge, FeriadosChips, PresupuestoTabla, Equilibrio } from '../components.jsx'
import { $, $c, num, pct, usd, fechaLarga, cap1, rangoFechas, hoyAR, CATEGORIAS_COSTO, TIPOS_LUGAR } from '../utils.js'

const hm = (h) => (h ? h.slice(0, 5) : '')
const fin = (h, dur) => { if (!h) return ''; const [a, b] = h.split(':').map(Number); const t = (a * 60 + b + dur) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` }

export default function EventoDetalle({ id }) {
  const { puedeEditar } = useAuth()
  const toast = useToast()
  const [dlg, setDlg] = useState(null)
  const { data, cargando, error, recargar } = useCarga(async () => {
    const [d, c] = await Promise.all([api('/eventos/' + id), api('/config')])
    return { ...d, dolar: c.valores.dolar_ref }
  }, [id])

  if (cargando) return <Spinner />
  if (error) return <Vacio icon={AlertTriangle} titulo="No se pudo abrir el evento" texto={error.message}><Btn variant="ghost" onClick={() => ir('eventos')}>Volver</Btn></Vacio>
  const { evento: ev, lugar, artistas, bebidas, entradas, costos, sponsors, presupuesto: p, avisos, dolar } = data
  const dias = p.dias

  const cambiarEstado = async (estado) => {
    try { await api(`/eventos/${id}/estado`, { method: 'PATCH', body: { estado } }); toast('Estado actualizado'); recargar() }
    catch (e) { toast(e.message, 'error') }
  }
  const borrar = async () => {
    try { await api('/eventos/' + id, { method: 'DELETE' }); toast('Evento eliminado'); ir('eventos') } catch (e) { toast(e.message, 'error') }
  }
  const csv = () => {
    const filas = [
      ['Evento', ev.nombre], ['Tipo', ev.tipo], ['Lugar', lugar.nombre], ['Fecha', rangoFechas(ev.fecha, ev.fecha_fin)], [],
      ['Concepto', 'Monto ARS'],
      ['Entradas (bruto)', p.entradas_brutas], ['Bebidas (bruto)', p.bebidas_brutas], ['Sponsors efectivo', p.sponsors_efectivo],
      ['Ingresos brutos', p.ingresos_brutos], ['IVA', -p.iva_total], ['Ingresos netos', p.ingresos_neto],
      ['Alquiler', p.costo_alquiler], ['Artistas', p.costo_artistas], ['Bebidas (costo)', p.costo_bebidas], ['Producción y extras', p.costo_extras],
      ['SADAIC', p.sadaic], ['Ingresos Brutos', p.iibb], ['Ticketera', p.ticketera], ['Costos totales', p.costo_total],
      ['Ganancia', p.ganancia], ['Margen %', p.margen_pct], [],
      ['Artista', 'Caché'], ...artistas.map((a) => [a.artista?.nombre, Math.round(a.cache_acordado)]), [],
      ['Costo extra', 'Monto'], ...costos.map((c) => [c.concepto, Math.round(c.monto)]),
    ]
    const txt = '\ufeff' + filas.map((f) => f.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }))
    a.download = `presupuesto-${ev.nombre.replace(/[^\w]+/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // line-up agrupado: día → escenario
  const porDia = {}
  for (const a of artistas) {
    const d = a.fecha || ev.fecha
    ;((porDia[d] ||= {})[a.escenario || ''] ||= []).push(a)
  }
  const capTotal = lugar.capacidad * dias
  const entradasTotal = entradas.reduce((t, e) => t + e.cantidad, 0)
  const puedeFinalizar = ev.fecha_fin <= hoyAR()

  return (
    <div className="stack" style={{ gap: 20 }}>
      <a href="#/eventos" className="small no-print" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ArrowLeft size={14} />Eventos</a>
      <div className="hero">
        <div className="row" style={{ gap: 8 }}><TipoBadge tipo={ev.tipo} /><EstadoBadge estado={ev.estado} /><FeriadosChips desde={ev.fecha} hasta={ev.fecha_fin} /></div>
        <h1>{ev.nombre}</h1>
        <div className="ev-meta" style={{ fontSize: 15 }}>
          <span><MapPin size={15} />{lugar.nombre} · {lugar.ciudad}{lugar.provincia ? `, ${lugar.provincia}` : ''}</span>
          <span><CalendarDays size={15} />{dias > 1 ? `${fechaLarga(ev.fecha)} al ${fechaLarga(ev.fecha_fin)}` : fechaLarga(ev.fecha)}</span>
          {ev.hora_inicio && <span><Clock size={15} />{hm(ev.hora_inicio)}{ev.hora_fin ? ` a ${hm(ev.hora_fin)}` : ''} hs</span>}
          <span><Users size={15} />{num(ev.asistentes_estimados)} asistentes estimados</span>
        </div>
        {ev.descripcion && <p className="muted" style={{ margin: 0, maxWidth: 760 }}>{ev.descripcion}</p>}
        <div className="row no-print">
          {puedeEditar && (
            <div className="estado-actions">
              {ev.estado === 'borrador' && <Btn icon={Check} onClick={() => cambiarEstado('confirmado')}>Confirmar evento</Btn>}
              {ev.estado === 'confirmado' && <>
                <Btn icon={Check} disabled={!puedeFinalizar} title={puedeFinalizar ? '' : 'Se puede finalizar después de la última fecha'} onClick={() => cambiarEstado('finalizado')}>Marcar finalizado</Btn>
                <Btn variant="ghost" icon={RotateCcw} onClick={() => cambiarEstado('borrador')}>Volver a borrador</Btn>
              </>}
              {ev.estado === 'cancelado' && <Btn icon={RotateCcw} onClick={() => cambiarEstado('borrador')}>Reactivar</Btn>}
              {(ev.estado === 'borrador' || ev.estado === 'confirmado') && <Btn variant="danger" icon={Ban} onClick={() => setDlg('cancelar')}>Cancelar evento</Btn>}
            </div>
          )}
          <div className="spacer" />
          {puedeEditar && <>
            <Btn variant="ghost" icon={Pencil} onClick={() => ir(`eventos/${id}/editar`)}>Editar</Btn>
            <Btn variant="ghost" icon={Copy} onClick={() => ir(`eventos/nuevo?copiar=${id}`)}>Duplicar</Btn>
          </>}
          <Btn variant="ghost" icon={Download} onClick={csv}>CSV</Btn>
          <Btn variant="ghost" icon={Printer} onClick={() => window.print()}>Imprimir / PDF</Btn>
          {puedeEditar && <Btn variant="danger" icon={Trash2} onClick={() => setDlg('borrar')} aria-label="Eliminar" />}
        </div>
      </div>

      <div className="grid g4">
        <Stat label="Ganancia" tono={p.ganancia >= 0 ? 'ok' : 'bad'} value={$c(p.ganancia)} sub={`margen ${pct(p.margen_pct)} · ${usd(p.ganancia, dolar)}`} />
        <Stat label="Ingresos netos" value={$c(p.ingresos_neto)} sub={`${$c(p.ingresos_brutos)} brutos`} />
        <Stat label="Costos totales" value={$c(p.costo_total)} sub={`${$c(p.impuestos_total)} en impuestos y comisiones`} />
        <Stat label="Por asistente" tono="sol" value={$(p.por_asistente.ganancia)} sub={`costo ${$(p.por_asistente.costo)} · ingreso ${$(p.por_asistente.ingreso)}`} />
      </div>

      <Alertas avisos={avisos} />

      <div className="grid g-main">
        <div className="stack">
          <section className="card">
            <div className="card-head"><h2>Line-up</h2><span className="muted small">{artistas.length} artista(s)</span></div>
            {artistas.length === 0 ? <Vacio titulo="Sin artistas cargados" /> : (
              <div className="timeline">
                {Object.entries(porDia).sort().map(([dia, escs]) => (
                  <div key={dia} className="tl-dia">
                    {(dias > 1 || Object.keys(porDia).length > 1) && <h4>{cap1(fechaLarga(dia))}</h4>}
                    {Object.entries(escs).map(([esc, lista]) => (
                      <div key={esc} className="tl-esc">
                        {esc && <small>{esc}</small>}
                        {lista.map((a) => (
                          <div key={a.artista_id} className={'slot' + (a.es_headliner ? ' hl' : '')}>
                            <span className="hora">{hm(a.horario) || '—'}</span>
                            <div className="grow">
                              <b>{a.artista?.nombre}</b> {a.es_headliner && <Badge color="sol" icon={Star}>Headliner</Badge>}
                              <div className="muted small">{a.artista?.genero}{a.horario ? ` · ${hm(a.horario)}–${fin(a.horario, a.artista?.duracion_min || 60)}` : ''}</div>
                            </div>
                            <b className="nowrap">{$c(a.cache_acordado)}</b>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head"><h2>Entradas</h2><span className="muted small">{num(entradasTotal)} de {num(capTotal)} lugares</span></div>
            <Barra valor={entradasTotal} max={capTotal} tono="verde" />
            <div className="tablewrap" style={{ marginTop: 12 }}>
              <table>
                <thead><tr><th>Tipo</th><th className="num">Precio</th><th className="num">Cantidad</th><th className="num">Recaudación</th></tr></thead>
                <tbody>
                  {entradas.map((e) => <tr key={e.id}><td>{e.nombre}</td><td className="num">{$(e.precio)}</td><td className="num">{num(e.cantidad)}</td><td className="num">{$(e.precio * e.cantidad)}</td></tr>)}
                  {!entradas.length && <tr><td colSpan={4} className="muted">Sin entradas cargadas</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {bebidas.length > 0 && (
            <section className="card">
              <div className="card-head"><h2>Bebidas</h2><span className="muted small">{ev.tragos_por_persona} tragos por persona</span></div>
              <div className="tablewrap"><table>
                <thead><tr><th>Bebida</th><th className="num">Cantidad</th><th className="num">Costo</th><th className="num">Venta</th><th className="num">Ganancia</th></tr></thead>
                <tbody>
                  {bebidas.map((b) => (
                    <tr key={b.bebida_id}><td>{b.bebida?.nombre}</td><td className="num">{num(b.cantidad)}</td>
                      <td className="num">{$(b.cantidad * b.bebida?.costo)}</td><td className="num">{$(b.cantidad * b.bebida?.precio_venta)}</td>
                      <td className="num pos">{$(b.cantidad * (b.bebida?.precio_venta - b.bebida?.costo))}</td></tr>
                  ))}
                </tbody>
              </table></div>
            </section>
          )}

          {(costos.length > 0 || sponsors.length > 0) && (
            <div className="grid g2">
              {costos.length > 0 && <section className="card">
                <div className="card-head"><h2>Costos de producción</h2></div>
                <div className="tablewrap"><table><tbody>
                  {costos.map((c) => <tr key={c.id}><td>{c.concepto}<div className="muted small">{CATEGORIAS_COSTO[c.categoria] || c.categoria}</div></td><td className="num">{$(c.monto)}</td></tr>)}
                </tbody></table></div>
              </section>}
              {sponsors.length > 0 && <section className="card">
                <div className="card-head"><h2>Sponsors</h2></div>
                <div className="tablewrap"><table><tbody>
                  {sponsors.map((s) => <tr key={s.id}><td>{s.nombre}<div className="muted small">{s.rubro || ''}</div></td>
                    <td className="num">{$(s.aporte)}<div className="small"><Badge color={s.tipo === 'canje' ? 'warn' : 'verde'}>{s.tipo}</Badge></div></td></tr>)}
                </tbody></table></div>
              </section>}
            </div>
          )}
          {ev.notas && <section className="card"><div className="card-head"><h2>Notas</h2></div><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{ev.notas}</p></section>}
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-head"><h2>Presupuesto</h2></div>
            <PresupuestoTabla p={p} dolar={dolar} />
          </section>
          <section className="card flat">
            <div className="card-head"><h2>Punto de equilibrio</h2></div>
            <Equilibrio p={p} />
          </section>
          <section className="card">
            <div className="card-head"><h2>El lugar</h2></div>
            <b>{lugar.nombre}</b>
            <div className="muted small">{TIPOS_LUGAR[lugar.tipo]} · {num(lugar.capacidad)} personas{lugar.escenarios > 1 ? ` · ${lugar.escenarios} escenarios` : ''}</div>
            {lugar.direccion && <div className="muted small">{lugar.direccion}, {lugar.ciudad}</div>}
            <div className="muted small">Alquiler {$(lugar.costo_alquiler)} por día</div>
          </section>
        </div>
      </div>

      {dlg === 'cancelar' && <Confirmar titulo="Cancelar el evento" texto="Las fechas del lugar quedan libres de nuevo. Después podés reactivarlo si las fechas siguen disponibles." confirmarLabel="Sí, cancelar" peligro onConfirm={() => cambiarEstado('cancelado')} onClose={() => setDlg(null)} />}
      {dlg === 'borrar' && <Confirmar titulo="Eliminar el evento" texto="Se borra el evento con su line-up, entradas y costos. Esta acción no se puede deshacer." confirmarLabel="Eliminar" peligro onConfirm={borrar} onClose={() => setDlg(null)} />}
    </div>
  )
}
