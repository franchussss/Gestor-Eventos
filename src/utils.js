// ---------- Formato argentino ----------
const TZ = 'America/Argentina/Buenos_Aires'
export const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })

export const $ = (n) => {
  const v = Math.round(Number(n) || 0)
  return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-AR')
}
// Montos grandes abreviados: $12,5 M
export const $c = (n) => {
  const v = Number(n) || 0, a = Math.abs(v), s = v < 0 ? '-' : ''
  if (a >= 1e9) return `${s}$${(a / 1e9).toLocaleString('es-AR', { maximumFractionDigits: 2 })} mil M`
  if (a >= 1e6) return `${s}$${(a / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  return $(v)
}
export const usd = (n, rate) => (rate > 0 ? 'US$ ' + Math.round((Number(n) || 0) / rate).toLocaleString('es-AR') : '')
export const num = (n) => (Number(n) || 0).toLocaleString('es-AR')
export const pct = (n, d = 1) => (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: d }) + '%'

const d12 = (iso) => new Date(iso + 'T12:00:00Z')
const fmt = (iso, o) => d12(iso).toLocaleDateString('es-AR', { timeZone: 'UTC', ...o })
export const fechaLarga = (iso) => (iso ? fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '')
export const fechaCorta = (iso) => (iso ? fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '') : '')
export const fechaMini = (iso) => (iso ? fmt(iso, { day: 'numeric', month: 'short' }).replace('.', '') : '')
export const diaSemana = (iso) => d12(iso).getUTCDay()
export const sumarDias = (iso, n) => { const t = d12(iso); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
export const diasEntre = (a, b) => Math.round((d12(b) - d12(a)) / 86400000) + 1
export const rangoFechas = (a, b) => (!b || a === b ? fechaCorta(a) : `${fechaMini(a)} → ${fechaMini(b)} ${d12(b).getUTCFullYear()}`)
export const mesLabel = (ym) => {
  const s = new Date(ym + '-15T12:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export const cap1 = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// ---------- Feriados nacionales de Argentina (orientativo) ----------
// Inamovibles: 1/1, Carnaval (lun y mar), 24/3, 2/4, Viernes Santo, 1/5, 25/5, 20/6, 9/7, 8/12, 25/12.
// Trasladables (Ley 27.399): 17/6, 17/8, 12/10, 20/11 → si caen martes/miércoles pasan al lunes anterior; jueves/viernes al lunes siguiente.
// Los "puentes turísticos" los define el Gobierno cada año: acá solo está cargado 2026.
const PUENTES = { 2026: [['03-23', 'Puente turístico'], ['07-10', 'Puente turístico'], ['12-07', 'Puente turístico']] }
const pascua = (y) => {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
  return `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}
const cache = new Map()
export function feriados(year) {
  if (cache.has(year)) return cache.get(year)
  const m = new Map()
  const add = (iso, nombre, tipo = 'feriado') => { if (!m.has(iso)) m.set(iso, { nombre, tipo }) }
  const fijo = (md, n) => add(`${year}-${md}`, n)
  fijo('01-01', 'Año Nuevo'); fijo('03-24', 'Día de la Memoria'); fijo('04-02', 'Día de Malvinas')
  fijo('05-01', 'Día del Trabajador'); fijo('05-25', 'Revolución de Mayo'); fijo('06-20', 'Día de la Bandera')
  fijo('07-09', 'Día de la Independencia'); fijo('12-08', 'Inmaculada Concepción'); fijo('12-25', 'Navidad')
  const p = pascua(year)
  add(sumarDias(p, -2), 'Viernes Santo'); add(sumarDias(p, -47), 'Carnaval'); add(sumarDias(p, -48), 'Carnaval')
  const trasl = (md, n) => {
    const iso = `${year}-${md}`, dow = diaSemana(iso)
    if (dow === 2 || dow === 3) add(sumarDias(iso, -(dow - 1)), n)
    else if (dow === 4 || dow === 5) add(sumarDias(iso, 8 - dow), n)
    else add(iso, n)
  }
  trasl('06-17', 'Paso a la Inmortalidad de Güemes'); trasl('08-17', 'Paso a la Inmortalidad de San Martín')
  trasl('10-12', 'Día del Respeto a la Diversidad Cultural'); trasl('11-20', 'Día de la Soberanía Nacional')
  for (const [md, n] of PUENTES[year] || []) add(`${year}-${md}`, n, 'puente')
  cache.set(year, m)
  return m
}
export const feriadoDe = (iso) => (iso ? feriados(Number(iso.slice(0, 4))).get(iso) || null : null)
// ¿La fecha cae en un fin de semana largo? (feriado el viernes o el lunes de ese finde)
export function esFindeLargo(iso) {
  const dow = diaSemana(iso)
  if (![5, 6, 0, 1].includes(dow)) return false
  const off = { 5: [0, 3], 6: [-1, 2], 0: [-2, 1], 1: [-3, 0] }[dow]
  return !!(feriadoDe(sumarDias(iso, off[0])) || feriadoDe(sumarDias(iso, off[1])))
}

// ---------- Constantes de dominio ----------
export const TIPOS_LUGAR = {
  boliche: 'Boliche', predio_festival: 'Predio de festival', salon_eventos: 'Salón de eventos', teatro: 'Teatro', estadio: 'Estadio',
}
export const ESTADOS = {
  borrador: { label: 'Borrador', color: 'gris' },
  confirmado: { label: 'Confirmado', color: 'verde' },
  finalizado: { label: 'Finalizado', color: 'celeste' },
  cancelado: { label: 'Cancelado', color: 'rojo' },
}
export const CATEGORIAS_COSTO = {
  seguridad: 'Seguridad', salud: 'Emergencias médicas', produccion: 'Producción', limpieza: 'Limpieza',
  seguros: 'Seguros', marketing: 'Marketing', logistica: 'Logística', otros: 'Otros',
}
export const PROVINCIAS = ['CABA', 'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán']
export const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export const debounce = (fn, ms) => { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) }; f.cancel = () => clearTimeout(t); return f }
