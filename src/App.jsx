import { useState, useEffect } from 'react'
import { LayoutDashboard, CalendarDays, PartyPopper, Building2, Mic2, Martini, Users, Settings, LogOut, Menu, Plus } from 'lucide-react'
import { useAuth } from './auth.jsx'
import { useRoute, ir } from './router.js'
import { Spinner } from './ui.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Eventos from './pages/Eventos.jsx'
import EventoDetalle from './pages/EventoDetalle.jsx'
import EventoWizard from './pages/EventoWizard.jsx'
import Calendario from './pages/Calendario.jsx'
import { Lugares, Artistas, Bebidas } from './pages/Catalogos.jsx'
import { Usuarios, Configuracion } from './pages/Admin.jsx'

const NAV = [
  { ruta: '', label: 'Panel', icon: LayoutDashboard },
  { ruta: 'eventos', label: 'Eventos', icon: PartyPopper },
  { ruta: 'calendario', label: 'Calendario', icon: CalendarDays },
  { sec: 'Catálogos' },
  { ruta: 'lugares', label: 'Lugares', icon: Building2 },
  { ruta: 'artistas', label: 'Artistas', icon: Mic2 },
  { ruta: 'bebidas', label: 'Bebidas', icon: Martini },
  { sec: 'Administración', admin: true },
  { ruta: 'usuarios', label: 'Usuarios', icon: Users, admin: true },
  { ruta: 'configuracion', label: 'Impuestos y costos', icon: Settings, admin: true },
]
const ROL = { admin: 'Administrador', productor: 'Productor', lector: 'Solo lectura' }

export default function App() {
  const { usuario, cargando } = useAuth()
  if (cargando) return <Spinner texto="Cargando…" />
  if (!usuario) return <Login />
  return <Shell />
}

function Shell() {
  const { usuario, salir, esAdmin, puedeEditar } = useAuth()
  const { segs, query } = useRoute()
  const [abierto, setAbierto] = useState(false)
  useEffect(() => setAbierto(false), [segs.join('/')])
  const [s0, s1, s2] = segs

  let pagina
  if (!s0) pagina = <Dashboard />
  else if (s0 === 'eventos' && !s1) pagina = <Eventos />
  else if (s0 === 'eventos' && s1 === 'nuevo') pagina = <EventoWizard key={'n' + (query.copiar || '') + (query.tipo || '')} query={query} />
  else if (s0 === 'eventos' && s2 === 'editar') pagina = <EventoWizard key={'e' + s1} editarId={Number(s1)} />
  else if (s0 === 'eventos') pagina = <EventoDetalle key={s1} id={Number(s1)} />
  else if (s0 === 'calendario') pagina = <Calendario />
  else if (s0 === 'lugares') pagina = <Lugares />
  else if (s0 === 'artistas') pagina = <Artistas />
  else if (s0 === 'bebidas') pagina = <Bebidas />
  else if (s0 === 'usuarios') pagina = esAdmin ? <Usuarios /> : <Sin />
  else if (s0 === 'configuracion') pagina = esAdmin ? <Configuracion /> : <Sin />
  else pagina = <Sin />

  const enWizard = s0 === 'eventos' && (s1 === 'nuevo' || s2 === 'editar')
  return (
    <div className="app">
      <aside className={'sidebar' + (abierto ? ' open' : '')}>
        <div className="brand"><div className="logo">🎤</div><div>Gestor de Eventos<small>Boliches y festivales</small></div></div>
        {puedeEditar && <button className="btn sol" style={{ margin: '0 4px 12px' }} onClick={() => ir('eventos/nuevo')}><Plus size={16} />Nuevo evento</button>}
        <nav className="nav">
          {NAV.filter((n) => !n.admin || esAdmin).map((n, i) => n.sec
            ? <div key={i} className="sec">{n.sec}</div>
            : <a key={n.ruta} href={'#/' + n.ruta} className={(s0 || '') === n.ruta ? 'on' : ''}><n.icon size={18} />{n.label}</a>)}
        </nav>
        <div className="userbox">
          <div className="avatar">{(usuario.nombre || usuario.email)[0].toUpperCase()}</div>
          <div className="who"><b>{usuario.nombre || usuario.email}</b><span className="muted small">{ROL[usuario.rol]}</span></div>
          <button className="icon-btn" onClick={salir} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={18} /></button>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="topbar">
          <button className="icon-btn" onClick={() => setAbierto(!abierto)} aria-label="Menú"><Menu size={22} /></button>
          <b style={{ fontFamily: 'var(--display)' }}>🎤 Gestor de Eventos</b>
        </div>
        <main className={'main' + (enWizard ? ' has-live' : '')}>{pagina}</main>
      </div>
    </div>
  )
}

const Sin = () => (
  <div className="vacio"><strong>Página no encontrada</strong><p>O no tenés permisos para verla.</p><a className="btn primary" href="#/">Ir al panel</a></div>
)
