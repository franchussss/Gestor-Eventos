import { PartyPopper, Wallet, CalendarCheck, TrendingUp, Plus, Tent, Disc3, AlertTriangle, Mic2 } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ir } from '../router.js'
import { Btn, Stat, Spinner, Vacio, useCarga } from '../ui.jsx'
import { BarrasMes, Dona } from '../charts.jsx'
import { TipoBadge, FeriadosChips } from '../components.jsx'
import { $c, usd, fechaMini, fechaCorta, diaSemana, DIAS_SEMANA, hoyAR } from '../utils.js'

export default function Dashboard() {
  const { usuario, puedeEditar } = useAuth()
  const { data, cargando, error } = useCarga(async () => {
    const [d, c] = await Promise.all([api('/dashboard'), api('/config')])
    return { ...d, dolar: c.valores.dolar_ref }
  })
  if (cargando) return <Spinner texto="Armando tu panel…" />
  if (error) return <Vacio icon={AlertTriangle} titulo="No se pudo cargar el panel" texto={error.message} />
  const d = data, f = d.finanzas
  const meses = d.por_mes.filter((m) => m.mes >= hoyAR().slice(0, 7) || true).slice(-8)
  const mix = [
    { label: 'Artistas', valor: d.mix_costos.artistas }, { label: 'Alquiler', valor: d.mix_costos.alquiler },
    { label: 'Producción y extras', valor: d.mix_costos.produccion }, { label: 'Bebidas', valor: d.mix_costos.bebidas },
    { label: 'Impuestos y comisiones', valor: d.mix_costos.impuestos },
  ].filter((x) => x.valor > 0)

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <h1>Hola, {(usuario.nombre || '').split(' ')[0] || 'bienvenido'} 👋</h1>
          <p>Así viene la temporada de eventos.</p>
        </div>
        <div className="spacer" />
        {puedeEditar && <>
          <Btn variant="ghost" icon={Disc3} onClick={() => ir('eventos/nuevo?tipo=boliche')}>Nuevo boliche</Btn>
          <Btn variant="sol" icon={Tent} onClick={() => ir('eventos/nuevo?tipo=festival')}>Nuevo festival</Btn>
        </>}
      </div>

      <div className="grid g4">
        <Stat icon={PartyPopper} label="Próximos eventos" value={d.totales.proximos} sub={`${d.totales.boliches} boliches · ${d.totales.festivales} festivales`} />
        <Stat icon={Wallet} tono={f.confirmados.ganancia >= 0 ? 'ok' : 'bad'} label="Ganancia confirmada" value={$c(f.confirmados.ganancia)} sub={usd(f.confirmados.ganancia, d.dolar) + ' · neta de impuestos'} />
        <Stat icon={TrendingUp} tono="sol" label="Ganancia en borradores" value={$c(f.borradores.ganancia)} sub={`${d.totales.por_estado.borrador} evento(s) por cerrar`} />
        <Stat icon={CalendarCheck} label="Fechas libres (30 días)" value={d.fechas_libres_30d} sub="entre todos los lugares" />
      </div>

      {d.alertas.length > 0 && (
        <div className="alertas">
          {d.alertas.map((a, i) => (
            <div key={i} className="alerta aviso" style={{ cursor: 'pointer' }} onClick={() => ir('eventos/' + a.evento_id)}><AlertTriangle size={15} />{a.texto}</div>
          ))}
        </div>
      )}

      <div className="grid g-main">
        <section className="card">
          <div className="card-head"><h2>Próximos eventos</h2><div className="spacer" /><a href="#/eventos" className="small">Ver todos</a></div>
          {d.proximos.length === 0
            ? <Vacio icon={PartyPopper} titulo="Todavía no hay eventos próximos" texto="Armá tu primer boliche o festival.">{puedeEditar && <Btn icon={Plus} onClick={() => ir('eventos/nuevo')}>Nuevo evento</Btn>}</Vacio>
            : <div className="lista-prox">
              {d.proximos.map((e) => (
                <div key={e.id} className="prox" onClick={() => ir('eventos/' + e.id)}>
                  <div className="fecha-box"><small>{DIAS_SEMANA[diaSemana(e.fecha)]}</small><b>{Number(e.fecha.slice(8))}</b><small>{fechaMini(e.fecha).split(' ')[1]}</small></div>
                  <div className="grow">
                    <div className="row" style={{ gap: 8 }}><b>{e.nombre}</b><TipoBadge tipo={e.tipo} /></div>
                    <div className="muted small">{e.lugar?.nombre} · {e.lugar?.ciudad}{e.estado === 'borrador' ? ' · borrador' : ''}</div>
                    <div className="row" style={{ gap: 6, marginTop: 4 }}><FeriadosChips desde={e.fecha} hasta={e.fecha_fin} /></div>
                  </div>
                  <div className="right"><b className={e.resumen.ganancia >= 0 ? 'pos' : 'neg'}>{$c(e.resumen.ganancia)}</b><div className="muted small">ganancia</div></div>
                </div>
              ))}
            </div>}
        </section>

        <section className="card">
          <div className="card-head"><h2>Dónde se va la plata</h2></div>
          {mix.length ? <Dona partes={mix} /> : <Vacio titulo="Sin datos todavía" />}
        </section>
      </div>

      <div className="grid g-main">
        <section className="card">
          <div className="card-head"><h2>Ganancia por mes</h2><span className="muted small">confirmados y finalizados</span></div>
          {meses.length ? <BarrasMes datos={meses} /> : <Vacio titulo="Confirmá un evento para ver su ganancia acá" />}
        </section>
        <section className="card">
          <div className="card-head"><h2>Artistas más contratados</h2></div>
          {d.top_artistas.length ? (
            <div className="stack" style={{ gap: 10 }}>
              {d.top_artistas.map((a, i) => (
                <div key={a.nombre} className="row" style={{ gap: 10 }}>
                  <span className="avatar" style={{ width: 28, height: 28, fontSize: 13, background: i === 0 ? 'var(--sol)' : 'var(--surface3)', color: i === 0 ? '#1c1400' : 'var(--text)' }}>{i + 1}</span>
                  <span className="grow">{a.nombre}</span><span className="muted small">{a.eventos} evento{a.eventos > 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          ) : <Vacio icon={Mic2} titulo="Sin line-ups todavía" />}
        </section>
      </div>
    </div>
  )
}
