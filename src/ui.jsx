import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { X, Check, AlertTriangle, Info, Loader2 } from 'lucide-react'
import { ESTADOS } from './utils.js'

// ---------- Toasts ----------
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((texto, tipo = 'ok') => {
    const id = Math.random().toString(36).slice(2)
    setItems((s) => [...s, { id, texto, tipo }])
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), tipo === 'error' ? 6000 : 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={'toast ' + t.tipo}>
            {t.tipo === 'error' ? <AlertTriangle size={18} /> : t.tipo === 'info' ? <Info size={18} /> : <Check size={18} />}
            <span>{t.texto}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------- Botón ----------
export function Btn({ variant = 'primary', size, icon: Icon, loading, children, className = '', ...p }) {
  return (
    <button className={`btn ${variant} ${size || ''} ${className}`} disabled={p.disabled || loading} {...p}>
      {loading ? <Loader2 size={16} className="spin" /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  )
}

// ---------- Campos ----------
export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={'field ' + className}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}
// Input numérico que deja escribir libremente (acepta vacío mientras se tipea)
export function NumInput({ value, onChange, min = 0, max, step = 1, prefix, suffix, ...p }) {
  const [txt, setTxt] = useState(value === '' || value == null ? '' : String(value))
  const ult = useRef(value)
  useEffect(() => {
    if (Number(txt) !== Number(value) || (value === '' && txt !== '')) setTxt(value === '' || value == null ? '' : String(value))
    ult.current = value
    // eslint-disable-next-line
  }, [value])
  return (
    <div className="numwrap">
      {prefix && <span className="pre">{prefix}</span>}
      <input type="number" inputMode="decimal" min={min} max={max} step={step} value={txt}
        onChange={(e) => {
          setTxt(e.target.value)
          const v = e.target.value === '' ? '' : Number(e.target.value)
          onChange(v === '' ? 0 : v)
        }}
        {...p} />
      {suffix && <span className="suf">{suffix}</span>}
    </div>
  )
}

// ---------- Modal ----------
export function Modal({ titulo, onClose, children, footer, ancho = 560 }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: ancho }} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-head">
          <h3>{titulo}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Confirmar({ titulo, texto, confirmarLabel = 'Confirmar', peligro, onConfirm, onClose }) {
  const [cargando, setCargando] = useState(false)
  return (
    <Modal titulo={titulo} onClose={onClose} ancho={440}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant={peligro ? 'danger' : 'primary'} loading={cargando}
          onClick={async () => { setCargando(true); try { await onConfirm() } finally { setCargando(false); onClose() } }}>{confirmarLabel}</Btn>
      </>}>
      <p className="muted" style={{ margin: 0 }}>{texto}</p>
    </Modal>
  )
}

// ---------- Varios ----------
export const Badge = ({ color = 'gris', children, icon: Icon }) => (
  <span className={'badge ' + color}>{Icon && <Icon size={12} />}{children}</span>
)
export const EstadoBadge = ({ estado }) => <Badge color={ESTADOS[estado]?.color}>{ESTADOS[estado]?.label || estado}</Badge>
export const Spinner = ({ texto }) => <div className="spinner"><Loader2 className="spin" size={22} />{texto && <span>{texto}</span>}</div>
export const Vacio = ({ icon: Icon, titulo, texto, children }) => (
  <div className="vacio">{Icon && <Icon size={34} />}<strong>{titulo}</strong>{texto && <p>{texto}</p>}{children}</div>
)
export const Seg = ({ value, onChange, opciones }) => (
  <div className="seg" role="tablist">
    {opciones.map((o) => (
      <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
        {o.icon && <o.icon size={15} />}{o.label}
      </button>
    ))}
  </div>
)
export function Stat({ label, value, sub, tono, icon: Icon }) {
  return (
    <div className={'stat ' + (tono || '')}>
      <div className="stat-top">{Icon && <Icon size={16} />}<span>{label}</span></div>
      <div className="stat-val">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}
export function Alertas({ errores = [], avisos = [] }) {
  if (!errores.length && !avisos.length) return null
  return (
    <div className="alertas">
      {errores.map((e, i) => <div key={'e' + i} className="alerta error"><AlertTriangle size={15} />{e}</div>)}
      {avisos.map((e, i) => <div key={'a' + i} className="alerta aviso"><Info size={15} />{e}</div>)}
    </div>
  )
}

// Hook para cargar datos con loading/error
export function useCarga(fn, deps = []) {
  const [estado, setEstado] = useState({ data: null, cargando: true, error: null })
  const [n, setN] = useState(0)
  useEffect(() => {
    let vivo = true
    setEstado((s) => ({ ...s, cargando: true, error: null }))
    Promise.resolve().then(fn).then((data) => vivo && setEstado({ data, cargando: false, error: null }))
      .catch((error) => vivo && setEstado({ data: null, cargando: false, error }))
    return () => { vivo = false }
    // eslint-disable-next-line
  }, [...deps, n])
  return { ...estado, recargar: () => setN((x) => x + 1) }
}
