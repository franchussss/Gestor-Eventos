import { useState } from 'react'
import { Trash2, Save } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Btn, NumInput, Confirmar, Spinner, Vacio, Badge, useCarga, useToast } from '../ui.jsx'
import { fechaMini } from '../utils.js'

export function Usuarios() {
  const { usuario } = useAuth()
  const toast = useToast()
  const [borrar, setBorrar] = useState(null)
  const { data, cargando, error, recargar } = useCarga(() => api('/usuarios'), [])
  const cambiarRol = async (u, rol) => {
    try { await api('/usuarios/' + u.id, { method: 'PATCH', body: { rol } }); toast('Rol actualizado'); recargar() } catch (e) { toast(e.message, 'error') }
  }
  return (
    <div>
      <div className="page-head"><div><h1>Usuarios</h1><p>Quién puede entrar y qué puede hacer.</p></div></div>
      <div className="helper" style={{ marginBottom: 16 }}><span>
        <b>Administrador</b>: todo, incluidos usuarios, impuestos y borrados. <b>Productor</b>: crea y edita eventos y catálogos. <b>Solo lectura</b>: ve todo y no modifica nada.
      </span></div>
      {cargando ? <Spinner /> : error ? <Vacio titulo="Error" texto={error.message} /> : (
        <div className="card" style={{ padding: 6 }}><div className="tablewrap"><table>
          <thead><tr><th>Usuario</th><th>Email</th><th>Alta</th><th>Rol</th><th /></tr></thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id}>
                <td><b>{u.nombre}</b> {u.id === usuario.id && <Badge color="celeste">Vos</Badge>}</td>
                <td className="muted">{u.email}</td><td className="muted">{fechaMini(u.created_at.slice(0, 10))}</td>
                <td><select value={u.rol} disabled={u.id === usuario.id} onChange={(e) => cambiarRol(u, e.target.value)} style={{ width: 160 }}>
                  <option value="admin">Administrador</option><option value="productor">Productor</option><option value="lector">Solo lectura</option></select></td>
                <td><div className="acciones">{u.id !== usuario.id && <button className="icon-btn bad" onClick={() => setBorrar(u)} aria-label="Eliminar"><Trash2 size={16} /></button>}</div></td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}
      {borrar && <Confirmar titulo="Eliminar usuario" texto={`${borrar.email} no va a poder volver a ingresar.`} confirmarLabel="Eliminar" peligro
        onConfirm={async () => { try { await api('/usuarios/' + borrar.id, { method: 'DELETE' }); toast('Usuario eliminado'); recargar() } catch (e) { toast(e.message, 'error') } }} onClose={() => setBorrar(null)} />}
    </div>
  )
}

const GRUPOS = [
  { t: 'Impuestos y comisiones', n: 'Se copian a cada evento nuevo (los eventos ya creados conservan los suyos). Son valores de referencia: confirmalos con tu contador.', k: ['iva_pct', 'sadaic_pct', 'iibb_pct', 'ticketera_pct', 'pct_online'] },
  { t: 'Costos de producción sugeridos', n: 'Se usan para “Cargar costos sugeridos” al armar un evento.', k: ['costo_seguridad_persona', 'asistentes_por_guardia', 'costo_ambulancia', 'asistentes_por_ambulancia', 'costo_sonido_luces_persona', 'costo_sonido_luces_min', 'costo_limpieza', 'costo_seguro', 'costo_catering_artista', 'publicidad_pct'] },
  { t: 'Otros', n: '', k: ['tragos_default', 'ocupacion_festival_pct', 'dolar_ref'] },
]

export function Configuracion() {
  const toast = useToast()
  const { data, cargando, error, recargar } = useCarga(() => api('/config'), [])
  const [cambios, setCambios] = useState({})
  const [guardando, setGuardando] = useState(false)
  if (cargando) return <Spinner />
  if (error) return <Vacio titulo="Error" texto={error.message} />
  const desc = Object.fromEntries(data.filas.map((f) => [f.clave, f.descripcion]))
  const val = (k) => (cambios[k] !== undefined ? cambios[k] : data.valores[k])
  const guardar = async () => {
    setGuardando(true)
    try { await api('/config', { method: 'PUT', body: cambios }); toast('Configuración guardada'); setCambios({}); recargar() } catch (e) { toast(e.message, 'error') } finally { setGuardando(false) }
  }
  return (
    <div>
      <div className="page-head"><div><h1>Impuestos y costos</h1><p>Parámetros que usa el presupuesto.</p></div><div className="spacer" />
        <Btn icon={Save} loading={guardando} disabled={!Object.keys(cambios).length} onClick={guardar}>Guardar cambios</Btn></div>
      <div className="stack" style={{ gap: 18 }}>
        {GRUPOS.map((g) => (
          <section key={g.t} className="card">
            <div className="card-head"><h2>{g.t}</h2></div>
            {g.n && <p className="muted small" style={{ marginTop: -6 }}>{g.n}</p>}
            <div className="cfg-grid">
              {g.k.filter((k) => k in desc).map((k) => (
                <label key={k} className="field"><span className="field-label" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 13 }}>{desc[k]}</span>
                  <NumInput value={val(k)} step={k.endsWith('_pct') ? 0.5 : 1} max={k.endsWith('_pct') ? 100 : undefined} suffix={k.endsWith('_pct') ? '%' : undefined} prefix={k.startsWith('costo') || k === 'dolar_ref' ? '$' : undefined}
                    onChange={(v) => setCambios((c) => ({ ...c, [k]: v }))} /></label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
