import { $c, mesLabel } from './utils.js'

// Barras de ganancia por mes (positivas verdes, negativas rojas)
export function BarrasMes({ datos }) {
  if (!datos.length) return null
  const W = 560, H = 210, pad = { l: 8, r: 8, t: 18, b: 30 }
  const max = Math.max(...datos.map((d) => Math.abs(d.ganancia)), 1)
  const hasNeg = datos.some((d) => d.ganancia < 0)
  const base = hasNeg ? pad.t + (H - pad.t - pad.b) / 2 : H - pad.b
  const alto = hasNeg ? (H - pad.t - pad.b) / 2 : H - pad.t - pad.b
  const bw = Math.min(54, (W - pad.l - pad.r) / datos.length - 14)
  const paso = (W - pad.l - pad.r) / datos.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Ganancia por mes">
      <line x1={pad.l} x2={W - pad.r} y1={base} y2={base} stroke="var(--border)" />
      {datos.map((d, i) => {
        const h = (Math.abs(d.ganancia) / max) * (alto - 14)
        const x = pad.l + paso * i + (paso - bw) / 2
        const y = d.ganancia >= 0 ? base - h : base
        return (
          <g key={d.mes}>
            <rect x={x} y={y} width={bw} height={Math.max(h, 2)} rx="6" fill={d.ganancia >= 0 ? 'var(--ok)' : 'var(--bad)'} opacity=".9" />
            <text x={x + bw / 2} y={d.ganancia >= 0 ? y - 6 : y + h + 13} textAnchor="middle" className="chart-val">{$c(d.ganancia)}</text>
            <text x={x + bw / 2} y={H - 10} textAnchor="middle" className="chart-lab">{mesLabel(d.mes).split(' ')[0].slice(0, 3)} {d.mes.slice(2, 4)}</text>
          </g>
        )
      })}
    </svg>
  )
}

const COLORES = ['#75aadb', '#f6b40e', '#b184ff', '#3ecf8e', '#ff7a90']
export function Dona({ partes, formato = $c }) {
  const total = partes.reduce((t, p) => t + p.valor, 0)
  if (total <= 0) return null
  const R = 62, C = 2 * Math.PI * R
  let acum = 0
  return (
    <div className="dona">
      <svg viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="Distribución de costos">
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--surface2)" strokeWidth="22" />
        {partes.map((p, i) => {
          const len = (p.valor / total) * C
          const el = <circle key={p.label} cx="80" cy="80" r={R} fill="none" stroke={COLORES[i % COLORES.length]} strokeWidth="22"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acum} transform="rotate(-90 80 80)" />
          acum += len
          return el
        })}
        <text x="80" y="76" textAnchor="middle" className="chart-lab">Costos</text>
        <text x="80" y="95" textAnchor="middle" className="chart-big">{formato(total)}</text>
      </svg>
      <ul className="leyenda">
        {partes.map((p, i) => (
          <li key={p.label}><i style={{ background: COLORES[i % COLORES.length] }} />{p.label}<b>{Math.round((p.valor / total) * 100)}%</b></li>
        ))}
      </ul>
    </div>
  )
}

// Barra de progreso simple (ocupación, etc.)
export const Barra = ({ valor, max, tono }) => {
  const p = Math.min(100, max > 0 ? (valor / max) * 100 : 0)
  return <div className={'barra ' + (tono || (valor > max ? 'rojo' : ''))}><i style={{ width: p + '%' }} /></div>
}
