import { useState } from 'react'
import { Search, Plus, PartyPopper } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ir } from '../router.js'
import { Btn, Seg, Spinner, Vacio, useCarga } from '../ui.jsx'
import { EventoCard } from '../components.jsx'
import { $c } from '../utils.js'

export default function Eventos() {
  const { puedeEditar } = useAuth()
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState('')
  const [estado, setEstado] = useState('')
  const [orden, setOrden] = useState('fecha')
  const { data, cargando, error } = useCarga(() => api('/eventos', { params: { q, tipo, estado } }), [q, tipo, estado])

  let lista = data || []
  lista = [...lista].sort((a, b) => orden === 'fecha' ? a.fecha.localeCompare(b.fecha) : orden === 'ganancia' ? b.resumen.ganancia - a.resumen.ganancia : b.resumen.costo_total - a.resumen.costo_total)
  const totalGan = lista.filter((e) => e.estado !== 'cancelado').reduce((t, e) => t + e.resumen.ganancia, 0)

  return (
    <div>
      <div className="page-head">
        <div><h1>Eventos</h1><p>{data ? `${lista.length} evento(s) · ganancia proyectada ${$c(totalGan)}` : 'Boliches y festivales'}</p></div>
        <div className="spacer" />
        {puedeEditar && <Btn icon={Plus} onClick={() => ir('eventos/nuevo')}>Nuevo evento</Btn>}
      </div>
      <div className="filters">
        <div className="search"><Search size={16} /><input placeholder="Buscar por nombre…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Seg value={tipo} onChange={setTipo} opciones={[{ value: '', label: 'Todos' }, { value: 'boliche', label: 'Boliches' }, { value: 'festival', label: 'Festivales' }]} />
        <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option><option value="borrador">Borrador</option><option value="confirmado">Confirmado</option>
          <option value="finalizado">Finalizado</option><option value="cancelado">Cancelado</option>
        </select>
        <select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Orden">
          <option value="fecha">Ordenar por fecha</option><option value="ganancia">Mayor ganancia</option><option value="costo">Mayor costo</option>
        </select>
      </div>
      {cargando ? <Spinner /> : error ? <Vacio titulo="Error" texto={error.message} /> : lista.length === 0
        ? <Vacio icon={PartyPopper} titulo="No hay eventos con esos filtros" texto="Probá limpiar la búsqueda o creá uno nuevo.">{puedeEditar && <Btn icon={Plus} onClick={() => ir('eventos/nuevo')}>Nuevo evento</Btn>}</Vacio>
        : <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }}>
          {lista.map((e) => <EventoCard key={e.id} e={e} onClick={() => ir('eventos/' + e.id)} />)}
        </div>}
    </div>
  )
}
