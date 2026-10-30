import { MapPin, CalendarDays, Clock, Music2, Tent, Disc3, Flag, TrendingUp, TrendingDown } from 'lucide-react'
import { Badge, EstadoBadge } from './ui.jsx'
import { $, $c, num, pct, usd, rangoFechas, feriadoDe, esFindeLargo, sumarDias, diasEntre, hoyAR } from './utils.js'

export const TipoBadge = ({ tipo }) =>
  tipo === 'festival' ? <Badge color="sol" icon={Tent}>Festival</Badge> : <Badge color="celeste" icon={Disc3}>Boliche</Badge>

// Chips con los feriados / fin de semana largo que toca un rango de fechas
export function FeriadosChips({ desde, hasta }) {
  if (!desde) return null
  const out = []
  const fin = hasta || desde
  for (let i = 0; i < diasEntre(desde, fin); i++) {
    const f = sumarDias(desde, i), fe = feriadoDe(f)
    if (fe) out.push(<Badge key={f} color="celeste" icon={Flag}>{fe.nombre}</Badge>)
  }
  if (!out.length && esFindeLargo(desde)) out.push(<Badge key="fl" color="sol" icon={Flag}>Fin de semana largo</Badge>)
  return <>{out}</>
}

export function EventoCard({ e, onClick }) {
  const r = e.resumen
  return (
    <article className={'card ev-card ' + e.tipo} onClick={onClick} tabIndex={0} onKeyDown={(k) => k.key === 'Enter' && onClick()}>
      <div className="row" style={{ gap: 8 }}>
        <TipoBadge tipo={e.tipo} /><EstadoBadge estado={e.estado} />
        {e.estado === 'confirmado' && e.fecha_fin < hoyAR() && <Badge color="warn">Por finalizar</Badge>}
      </div>
      <h3>{e.nombre}</h3>
      <div className="ev-meta">
        <span><MapPin size={14} />{e.lugar?.nombre}{e.lugar?.ciudad ? ` · ${e.lugar.ciudad}` : ''}</span>
        <span><CalendarDays size={14} />{rangoFechas(e.fecha, e.fecha_fin)}</span>
        {e.hora_inicio && <span><Clock size={14} />{e.hora_inicio.slice(0, 5)} hs</span>}
      </div>
      {e.artistas.length > 0 && (
        <div className="ev-meta"><span><Music2 size={14} />{e.artistas.slice(0, 3).join(', ')}{e.artistas.length > 3 ? ` +${e.artistas.length - 3}` : ''}</span></div>
      )}
      <div className="ev-money">
        <div><small>Ingresos</small><b>{$c(r.ingresos_neto)}</b></div>
        <div><small>Costos</small><b>{$c(r.costo_total)}</b></div>
        <div><small>Ganancia</small><b className={r.ganancia >= 0 ? 'pos' : 'neg'}>{$c(r.ganancia)}</b></div>
      </div>
    </article>
  )
}

// Tabla completa del presupuesto
export function PresupuestoTabla({ p, dolar }) {
  const fila = (label, valor, cls = '', sub) => (
    <tr className={cls}><td>{label}</td><td className="num">{valor}</td></tr>
  )
  return (
    <div className="tablewrap">
      <table className="resumen-tabla">
        <tbody>
          {fila('Entradas (precio final)', $(p.entradas_brutas))}
          {fila('Bebidas (precio final)', $(p.bebidas_brutas))}
          {p.sponsors_efectivo > 0 && fila('Sponsors en efectivo', $(p.sponsors_efectivo))}
          {fila('Ingresos brutos', $(p.ingresos_brutos), 'total')}
          {fila(`(−) IVA incluido (${pct(p.pct.iva)})`, $(-p.iva_total), 'sub')}
          {fila('Ingresos netos', $(p.ingresos_neto), 'total')}
          <tr><td colSpan={2} style={{ height: 8, padding: 0 }} /></tr>
          {fila(`Alquiler del lugar${p.dias > 1 ? ` (× ${p.dias} días)` : ''}`, $(p.costo_alquiler))}
          {fila('Artistas', $(p.costo_artistas))}
          {fila('Bebidas (costo)', $(p.costo_bebidas))}
          {fila('Producción, seguridad y otros', $(p.costo_extras))}
          {fila(`SADAIC / AADI-CAPIF (${pct(p.pct.sadaic)} de entradas netas)`, $(p.sadaic), 'sub')}
          {fila(`Ingresos Brutos (${pct(p.pct.iibb)})`, $(p.iibb), 'sub')}
          {fila(`Ticketera (${pct(p.pct.ticketera)} sobre ${pct(p.pct.online, 0)} online)`, $(p.ticketera), 'sub')}
          {fila('Costos totales', $(p.costo_total), 'total')}
          <tr className="total">
            <td>Ganancia {dolar ? <span className="muted small">({usd(p.ganancia, dolar)})</span> : null}</td>
            <td className={'num ' + (p.ganancia >= 0 ? 'pos' : 'neg')}>{$(p.ganancia)} <span className="small muted">· margen {pct(p.margen_pct)}</span></td>
          </tr>
          {p.sponsors_canje > 0 && fila('Sponsors en canje (no suman caja)', $(p.sponsors_canje), 'sub')}
        </tbody>
      </table>
    </div>
  )
}

// "¿Cuánto tengo que vender para no perder?"
export function Equilibrio({ p }) {
  const e = p.equilibrio_ocupacion_pct
  let texto
  if (e === 0) texto = 'Con los sponsors ya cubrís los costos fijos: cada entrada suma ganancia.'
  else if (e == null) texto = 'Con estos precios y costos no hay ocupación que alcance para cubrir los costos.'
  else if (e > 100) texto = `Aun vendiendo todo lo estimado no llegás: necesitarías ${pct(e, 0)} de lo proyectado.`
  else texto = `Necesitás vender ${num(p.equilibrio_entradas)} entradas (${pct(e, 0)} de lo estimado) para no perder.`
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
        {e != null && e <= 100 ? <TrendingUp size={18} className="pos" /> : <TrendingDown size={18} className="neg" />}
        <span>{texto}</span>
      </div>
      {p.precio_equilibrio != null && p.entradas_cantidad > 0 && (
        <div className="muted small">
          Precio promedio de entrada para ganancia $0: <b className="sol">{$(p.precio_equilibrio)}</b> (hoy {$(p.precio_promedio_entrada)}).
        </div>
      )}
    </div>
  )
}
