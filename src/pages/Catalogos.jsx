import { useState } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Btn, Field, NumInput, Modal, Confirmar, Badge, Spinner, Vacio, useCarga, useToast } from '../ui.jsx'
import { $, $c, num, pct, TIPOS_LUGAR, PROVINCIAS } from '../utils.js'

// Pantalla genérica de catálogo: lista + buscador + alta/edición en modal + baja
function Catalogo({ titulo, subtitulo, ruta, vacio, cols, campos, nuevo, filtros, extra }) {
  const { puedeEditar, esAdmin } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('')
  const [edit, setEdit] = useState(null)
  const [borrar, setBorrar] = useState(null)
  const { data, cargando, error, recargar } = useCarga(() => api('/' + ruta), [])

  const lista = (data || []).filter((x) => (!q || x.nombre.toLowerCase().includes(q.toLowerCase()) || (x.ciudad || x.genero || '').toLowerCase().includes(q.toLowerCase())) && (!filtro || filtros.fn(x, filtro)))
  const eliminar = async () => {
    try { await api(`/${ruta}/${borrar.id}`, { method: 'DELETE' }); toast('Eliminado'); recargar() } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>{titulo}</h1><p>{subtitulo}</p></div><div className="spacer" />
        {puedeEditar && <Btn icon={Plus} onClick={() => setEdit({ ...nuevo })}>Agregar</Btn>}
      </div>
      <div className="filters">
        <div className="search"><Search size={16} /><input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {filtros && <div className="row" style={{ gap: 6 }}>{filtros.opciones.map(([v, l]) => <button key={v} className={'chip sm' + (filtro === v ? ' on' : '')} onClick={() => setFiltro(v)}>{l}</button>)}</div>}
      </div>
      {extra?.(data || [])}
      {cargando ? <Spinner /> : error ? <Vacio titulo="Error" texto={error.message} /> : lista.length === 0 ? <Vacio titulo={vacio} /> : (
        <div className="card" style={{ padding: 6 }}><div className="tablewrap"><table>
          <thead><tr>{cols.map((c) => <th key={c.h} className={c.num ? 'num' : ''}>{c.h}</th>)}<th /></tr></thead>
          <tbody>
            {lista.map((x) => (
              <tr key={x.id} style={x.activo === false ? { opacity: .5 } : null}>
                {cols.map((c) => <td key={c.h} className={c.num ? 'num' : ''}>{c.r(x)}</td>)}
                <td><div className="acciones">
                  {puedeEditar && <button className="icon-btn" onClick={() => setEdit({ ...x })} aria-label="Editar"><Pencil size={16} /></button>}
                  {esAdmin && <button className="icon-btn bad" onClick={() => setBorrar(x)} aria-label="Eliminar"><Trash2 size={16} /></button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}
      {edit && <Formulario titulo={edit.id ? `Editar ${titulo.toLowerCase().replace(/s$/, '')}` : 'Agregar'} campos={campos} inicial={edit} ruta={ruta} onClose={() => setEdit(null)} onHecho={() => { setEdit(null); recargar() }} />}
      {borrar && <Confirmar titulo="Eliminar" texto={`¿Eliminar "${borrar.nombre}"? Si ya se usó en un evento no se va a poder; en ese caso desactivalo.`} confirmarLabel="Eliminar" peligro onConfirm={eliminar} onClose={() => setBorrar(null)} />}
    </div>
  )
}

function Formulario({ titulo, campos, inicial, ruta, onClose, onHecho }) {
  const toast = useToast()
  const [f, setF] = useState(inicial)
  const [cargando, setCargando] = useState(false)
  const guardar = async () => {
    setCargando(true)
    try {
      if (f.id) await api(`/${ruta}/${f.id}`, { method: 'PUT', body: f })
      else await api('/' + ruta, { method: 'POST', body: f })
      toast('Guardado'); onHecho()
    } catch (e) { toast(e.message, 'error') } finally { setCargando(false) }
  }
  return (
    <Modal titulo={titulo} onClose={onClose} ancho={620} footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn loading={cargando} onClick={guardar}>Guardar</Btn></>}>
      <div className="form-grid">
        {campos.map((c) => (
          <Field key={c.k} label={c.l} hint={c.hint} className={c.full ? 'full' : ''}>
            {c.t === 'num' ? <NumInput value={f[c.k] ?? 0} prefix={c.pre} suffix={c.suf} max={c.max} min={c.min ?? 0} onChange={(v) => setF({ ...f, [c.k]: v })} />
              : c.t === 'select' ? <select value={f[c.k] ?? ''} onChange={(e) => setF({ ...f, [c.k]: e.target.value })}>{c.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              : c.t === 'area' ? <textarea value={f[c.k] ?? ''} onChange={(e) => setF({ ...f, [c.k]: e.target.value })} />
              : c.t === 'check' ? <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={f[c.k] !== false} onChange={(e) => setF({ ...f, [c.k]: e.target.checked })} />{c.txt}</label>
              : <input value={f[c.k] ?? ''} onChange={(e) => setF({ ...f, [c.k]: e.target.value })} />}
          </Field>
        ))}
      </div>
    </Modal>
  )
}

const Activo = ({ x }) => (x.activo === false ? <Badge>Inactivo</Badge> : null)

export const Lugares = () => (
  <Catalogo titulo="Lugares" subtitulo="Boliches, predios de festival, salones y estadios." ruta="boliches" vacio="No hay lugares"
    nuevo={{ tipo: 'boliche', provincia: 'Córdoba', capacidad: 500, costo_alquiler: 0, escenarios: 1, activo: true }}
    filtros={{ opciones: [['', 'Todos'], ...Object.entries(TIPOS_LUGAR)], fn: (x, f) => x.tipo === f }}
    cols={[
      { h: 'Nombre', r: (x) => <><b>{x.nombre}</b> <Activo x={x} /><div className="muted small">{x.direccion}</div></> },
      { h: 'Ciudad', r: (x) => <>{x.ciudad}<div className="muted small">{x.provincia}</div></> },
      { h: 'Tipo', r: (x) => <Badge color={x.tipo === 'predio_festival' ? 'sol' : 'celeste'}>{TIPOS_LUGAR[x.tipo]}</Badge> },
      { h: 'Capacidad', num: true, r: (x) => num(x.capacidad) },
      { h: 'Escenarios', num: true, r: (x) => x.escenarios },
      { h: 'Alquiler / día', num: true, r: (x) => $c(x.costo_alquiler) },
    ]}
    campos={[
      { k: 'nombre', l: 'Nombre', full: true }, { k: 'tipo', l: 'Tipo de lugar', t: 'select', opts: Object.entries(TIPOS_LUGAR) },
      { k: 'capacidad', l: 'Capacidad (personas)', t: 'num', min: 1 }, { k: 'ciudad', l: 'Ciudad' },
      { k: 'provincia', l: 'Provincia', t: 'select', opts: [['', '—'], ...PROVINCIAS.map((p) => [p, p])] },
      { k: 'barrio', l: 'Barrio / zona' }, { k: 'direccion', l: 'Dirección' },
      { k: 'costo_alquiler', l: 'Alquiler por día', t: 'num', pre: '$' }, { k: 'escenarios', l: 'Escenarios', t: 'num', min: 1, hint: 'Para festivales' },
      { k: 'telefono', l: 'Teléfono' }, { k: 'email_contacto', l: 'Email de contacto' },
      { k: 'descripcion', l: 'Descripción', t: 'area', full: true }, { k: 'activo', l: 'Estado', t: 'check', txt: 'Activo (aparece al armar eventos)' },
    ]} />
)

export const Artistas = () => (
  <Catalogo titulo="Artistas" subtitulo="Cachés y el tamaño de público con el que funciona cada uno." ruta="artistas" vacio="No hay artistas"
    nuevo={{ cache: 0, capacidad_min: 100, capacidad_max: 1000, duracion_min: 60, activo: true }}
    cols={[
      { h: 'Artista', r: (x) => <><b>{x.nombre}</b> <Activo x={x} /><div className="muted small">{x.ciudad_origen}</div></> },
      { h: 'Género', r: (x) => x.genero },
      { h: 'Caché', num: true, r: (x) => <b className="sol">{$(x.cache)}</b> },
      { h: 'Público ideal', r: (x) => `${num(x.capacidad_min)} – ${num(x.capacidad_max)}` },
      { h: 'Show', num: true, r: (x) => `${x.duracion_min} min` },
    ]}
    campos={[
      { k: 'nombre', l: 'Nombre artístico', full: true }, { k: 'genero', l: 'Género' }, { k: 'ciudad_origen', l: 'Ciudad de origen' },
      { k: 'cache', l: 'Caché de lista', t: 'num', pre: '$' }, { k: 'duracion_min', l: 'Duración del show', t: 'num', suf: 'min', min: 10 },
      { k: 'capacidad_min', l: 'Capacidad mínima', t: 'num', min: 1, hint: 'Menos público que esto y no le sirve' },
      { k: 'capacidad_max', l: 'Capacidad máxima', t: 'num', min: 1, hint: 'Más que esto: solo entra como soporte en festivales' },
      { k: 'contacto', l: 'Contacto / manager', full: true }, { k: 'activo', l: 'Estado', t: 'check', txt: 'Activo (aparece al armar line-ups)' },
    ]} />
)

export const Bebidas = () => (
  <Catalogo titulo="Bebidas" subtitulo="Costos, precios y qué porcentaje del consumo representa cada una." ruta="bebidas" vacio="No hay bebidas"
    nuevo={{ costo: 0, precio_venta: 0, consumo_pct: 0, activo: true }}
    extra={(d) => { const s = d.filter((b) => b.activo !== false).reduce((t, b) => t + Number(b.consumo_pct), 0); return Math.abs(s - 100) > 0.5 && d.length ? <div className="alerta aviso" style={{ marginBottom: 14 }}>Los % de consumo suman {pct(s, 0)}: para que las cantidades sugeridas cierren tienen que sumar 100%.</div> : null }}
    cols={[
      { h: 'Bebida', r: (x) => <><b>{x.nombre}</b> <Activo x={x} /><div className="muted small">{x.categoria}</div></> },
      { h: 'Costo', num: true, r: (x) => $(x.costo) }, { h: 'Precio', num: true, r: (x) => $(x.precio_venta) },
      { h: 'Margen', num: true, r: (x) => <span className="pos">{x.precio_venta > 0 ? pct(((x.precio_venta - x.costo) / x.precio_venta) * 100, 0) : '—'}</span> },
      { h: '% consumo', num: true, r: (x) => pct(x.consumo_pct, 0) },
    ]}
    campos={[
      { k: 'nombre', l: 'Nombre', full: true }, { k: 'categoria', l: 'Categoría' }, { k: 'consumo_pct', l: '% del consumo total', t: 'num', suf: '%', max: 100 },
      { k: 'costo', l: 'Costo por unidad', t: 'num', pre: '$' }, { k: 'precio_venta', l: 'Precio de venta (con IVA)', t: 'num', pre: '$' },
      { k: 'activo', l: 'Estado', t: 'check', txt: 'Activa (se vende)' },
    ]} />
)
