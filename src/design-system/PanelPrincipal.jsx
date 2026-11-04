import { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  LineChart,
  PiggyBank,
  Plus,
  Scale,
  Settings,
  Syringe,
  Wheat,
} from 'lucide-react';
import { Button, Card, EmptyState, Skeleton } from './primitives.jsx';
import { AttentionList, CorralesTable, FeedStock, GrowthChart, KpiCard, PanelCargando } from './DashboardParts.jsx';
import { FOCUS_RING } from './uiConstants.js';
import { ICA_REVISION, MORTALIDAD_MAXIMA_PCT } from './panelData.js';

const fmt = (n, d = 0) => n.toLocaleString('es-GT', { minimumFractionDigits: d, maximumFractionDigits: d });
const ICONO_EVENTO = { dosis: Syringe, tarea: Syringe, pesar: Scale, param: Settings, alimento: Wheat, venta: Scale, sanidad: Syringe };
const ALERTAS_VISIBLES = 4;

function Encabezado({ hoyTexto, total, onVerHoy }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
      <div>
        <p className="type-label uppercase text-ink-muted">{hoyTexto}</p>
        <h1 className="type-title text-ink mt-1">
          {total > 0 ? `${total} ${total === 1 ? 'asunto requiere' : 'asuntos requieren'} tu atención` : 'Todo al día'}
        </h1>
      </div>
      {onVerHoy && <Button variant="secondary" icon={ClipboardList} className="max-md:w-full" onClick={onVerHoy}>Ver pendientes en Hoy</Button>}
    </div>
  );
}

function Kpis({ r, loading }) {
  const cob = r?.menorCobertura;
  const icaAlta = r?.ica > ICA_REVISION;
  const mortAlta = r?.mortalidad > MORTALIDAD_MAXIMA_PCT;
  const cobBaja = cob && cob.estado !== 'ok';
  return (
    <section aria-label="Indicadores de la granja" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <KpiCard loading={loading} label="Cerdos en engorda" value={r && fmt(r.totalCerdos)} unit="cabezas" context={r && `${r.corralesActivos} de ${r.corralesTotales} corrales activos`} />
      <KpiCard loading={loading} label="Peso promedio" value={r && (r.pesoPromedio > 0 ? fmt(r.pesoPromedio, 1) : '—')} unit={r?.pesoPromedio > 0 ? 'lb' : undefined} context={r && (r.pesoPromedio > 0 ? `Biomasa ${fmt(r.biomasaQq, 1)} qq` : 'Sin pesajes todavía')} />
      <KpiCard loading={loading} label="GMD" value={r && (r.gmd > 0 ? fmt(r.gmd, 2) : '—')} unit={r?.gmd > 0 ? 'lb/día' : undefined} context="Promedio por cabeza" />
      <KpiCard
        loading={loading}
        label="ICA acumulado"
        value={r && (r.ica > 0 ? fmt(r.ica, 2) : '—')}
        tone={icaAlta ? 'warning' : 'neutral'}
        icon={icaAlta ? AlertTriangle : undefined}
        context={`Revisar arriba de ${fmt(ICA_REVISION, 1)}`}
      />
      <KpiCard
        loading={loading}
        label="Mortalidad"
        value={r && fmt(r.mortalidad, 1)}
        unit="%"
        tone={mortAlta ? 'danger' : 'success'}
        icon={mortAlta ? AlertTriangle : CheckCircle2}
        context={r && `${fmt(r.bajasTotales)} bajas · máximo ${MORTALIDAD_MAXIMA_PCT} %`}
      />
      <KpiCard
        loading={loading}
        label="Cobertura mínima"
        value={cob ? fmt(Math.floor(cob.dias)) : '—'}
        unit={cob ? 'días' : undefined}
        tone={cobBaja ? (cob.estado === 'critico' ? 'danger' : 'warning') : 'neutral'}
        icon={cobBaja ? AlertTriangle : undefined}
        context={cob ? `${cob.alimento} · ${fmt(cob.sacos, Number.isInteger(cob.sacos) ? 0 : 1)} sacos` : 'Sin consumo en 14 días'}
      />
    </section>
  );
}

function Proximos({ eventos }) {
  if (eventos.length === 0) {
    return <p className="px-4 pb-4 type-small text-ink-muted">Nada programado para esta semana.</p>;
  }
  return (
    <ul className="px-4 pb-2">
      {eventos.map((ev) => {
        const Icon = ICONO_EVENTO[ev.tipo] || Calendar;
        const contenido = (
          <>
            <Icon size={16} aria-hidden="true" className="shrink-0 text-ink-muted mt-0.5" />
            <span className="min-w-0 flex-1 text-left">
              <span className="block type-small font-bold text-ink">{ev.titulo}</span>
              <span className="block type-small text-ink-muted">{ev.detalle}</span>
            </span>
          </>
        );
        return (
          <li key={ev.id} className="border-t border-line first:border-t-0">
            {ev.onAbrir ? (
              <button type="button" onClick={ev.onAbrir} className={`w-full flex items-start gap-3 py-2.5 rounded-ds-sm max-md:min-h-12 hover:bg-surface-sunken ${FOCUS_RING}`}>
                {contenido}
                <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-ink-muted mt-0.5" />
              </button>
            ) : (
              <div className="flex items-start gap-3 py-2.5">{contenido}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Actividad({ items }) {
  return (
    <ul className="px-4 pb-2">
      {items.map((it) => (
        <li key={it.id} className="py-2.5 border-t border-line first:border-t-0">
          <p className="type-small font-bold text-ink">{it.titulo}</p>
          <p className="type-small text-ink-muted">{[it.corral, it.mensaje].filter(Boolean).join(' · ')}</p>
          {(it.usuario || it.tiempo) && (
            <p className="type-small text-ink-muted mt-0.5">{[it.usuario && `por ${it.usuario}`, it.tiempo].filter(Boolean).join(' · ')}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Contenido del Panel principal, sin marco de navegación.
 * `datos` sale de construirPanelPrincipal().
 */
export function PanelPrincipal({ datos, cargando = false, onAbrirCorral, onVerHoy, onVerCalendario, onCrearLote }) {
  const [elegido, setElegido] = useState(null);
  const lotes = datos?.lotes ?? [];
  const lote = lotes.find((l) => l.id === elegido) ?? lotes[0] ?? null;

  if (!cargando && lotes.length === 0) {
    return (
      <div className="min-h-full bg-surface text-ink font-ui p-4 lg:p-6">
        <div className="max-w-[1600px] mx-auto">
          <Card>
            <EmptyState
              icon={PiggyBank}
              title="Todavía no hay lotes activos"
              action={onCrearLote && <Button variant="primary" icon={Plus} onClick={onCrearLote}>Ingresar primer lote</Button>}
            >
              Cuando ingreses un lote a un corral, acá vas a ver su peso, consumo y alertas.
            </EmptyState>
          </Card>
        </div>
      </div>
    );
  }

  const alertas = datos?.alertas ?? [];
  const visibles = alertas.slice(0, ALERTAS_VISIBLES);
  const ocultas = alertas.length - visibles.length;

  return (
    <div className="min-h-full bg-surface text-ink font-ui">
      <div className="p-4 lg:p-6 max-w-[1600px] mx-auto space-y-4 lg:space-y-6">
        {cargando ? (
          <div className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-8 w-80 max-w-full" /></div>
        ) : (
          <Encabezado hoyTexto={datos.hoyTexto} total={alertas.length} onVerHoy={onVerHoy} />
        )}

        {cargando ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full !rounded-ds-lg" />)}
          </div>
        ) : visibles.length > 0 && (
          <div>
            <AttentionList alertas={visibles} onAccion={(a) => a.onAccion?.()} />
            {ocultas > 0 && onVerHoy && (
              <button type="button" onClick={onVerHoy} className={`mt-2 type-small text-ink-muted underline underline-offset-4 rounded-ds-sm max-md:min-h-12 ${FOCUS_RING}`}>
                {ocultas === 1 ? 'Hay 1 asunto más' : `Hay ${ocultas} asuntos más`}. Revisá los pendientes en Hoy.
              </button>
            )}
          </div>
        )}

        <Kpis r={datos?.resumen} loading={cargando} />

        {cargando ? <PanelCargando /> : (
          <Card title="Corrales" subtitle="Ordenados por urgencia.">
            <CorralesTable
              lotes={lotes}
              libres={datos.libres}
              seleccionado={lote?.id}
              onSeleccionar={setElegido}
              onAbrir={onAbrirCorral}
            />
          </Card>
        )}

        <div className="grid gap-4 lg:gap-6 lg:grid-cols-2 xl:grid-cols-12 items-start">
          <div className="lg:col-span-2 xl:col-span-6 min-w-0">
            {cargando ? <PanelCargando /> : (
              <Card
                title={lote ? `Curva de peso · ${lote.corral}` : 'Curva de peso'}
                subtitle={lote && `${lote.lote} · ${fmt(lote.cerdos)} cerdos · día ${lote.dia}`}
                actions={lotes.length > 1 && (
                  <select
                    aria-label="Corral de la curva"
                    value={lote?.id ?? ''}
                    onChange={(e) => setElegido(e.target.value)}
                    className={`h-control-sm max-md:h-12 max-w-40 px-2 rounded-ds-md border border-line-strong bg-surface-raised text-ink type-small ${FOCUS_RING}`}
                  >
                    {lotes.map((l) => <option key={l.id} value={l.id}>{l.corral}</option>)}
                  </select>
                )}
              >
                {lote && lote.pesajes.length > 0 ? <GrowthChart lote={lote} /> : (
                  <EmptyState icon={LineChart} title="Este lote todavía no tiene pesajes">
                    Registrá un pesaje en el corral para ver su curva.
                  </EmptyState>
                )}
              </Card>
            )}
          </div>
          <div className="xl:col-span-3 min-w-0">
            {cargando ? <PanelCargando /> : (
              <Card title="Alimento en bodega" subtitle={`${fmt(datos.resumen.sacosTotales, Number.isInteger(datos.resumen.sacosTotales) ? 0 : 1)} sacos en total`}>
                {datos.bodega.length > 0 ? <FeedStock items={datos.bodega} /> : (
                  <p className="px-4 pb-4 type-small text-ink-muted">No hay concentrado en bodega.</p>
                )}
              </Card>
            )}
          </div>
          <div className="xl:col-span-3 min-w-0 space-y-4 lg:space-y-6">
            {cargando ? <PanelCargando /> : (
              <>
                <Card
                  title="Esta semana"
                  actions={onVerCalendario && <Button variant="quiet" size="sm" icon={Calendar} aria-label="Abrir calendario" onClick={onVerCalendario} />}
                >
                  <Proximos eventos={datos.eventos} />
                </Card>
                {datos.actividad.length > 0 && (
                  <Card title="Actividad reciente"><Actividad items={datos.actividad} /></Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
