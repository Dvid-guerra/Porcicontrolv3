import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { Button, Card, Skeleton, StatusBadge } from './primitives.jsx';
import { HORIZONTE_VENTA_DIAS, ICA_REVISION, MORTALIDAD_MAXIMA_PCT } from './panelData.js';
import { FOCUS_RING } from './uiConstants.js';
import { STATUS } from './status.js';

const fmt = (n, d = 0) => n.toLocaleString('es-GT', { minimumFractionDigits: d, maximumFractionDigits: d });

/* ---------- KPI ---------- */

const KPI_TONE = { success: 'text-success', warning: 'text-warning', danger: 'text-danger', neutral: 'text-ink-muted' };

export function KpiCard({ label, value, unit, context, tone = 'neutral', icon: Icon, loading = false }) {
  return (
    <div className="bg-surface-raised border border-line rounded-ds-lg shadow-card p-4 min-w-0">
      <p className="type-label uppercase text-ink-muted">{label}</p>
      {loading ? (
        <div className="mt-2 space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : (
        <>
          <p className="mt-1 text-ink flex items-baseline gap-1.5 flex-wrap">
            <span className="type-kpi">{value}</span>
            {unit && <span className="type-small text-ink-muted">{unit}</span>}
          </p>
          <p className={`mt-1 type-small flex items-start gap-1 ${KPI_TONE[tone]}`}>
            {Icon && <Icon size={14} aria-hidden="true" className="shrink-0 mt-px" />}
            <span>{context}</span>
          </p>
        </>
      )}
    </div>
  );
}

/* ---------- Alertas ---------- */

const GRUPOS = { atrasado: 'Atrasado', hoy: 'Para hoy', semana: 'Esta semana' };
const SEVERIDAD_ESTADO = { danger: 'critico', warning: 'sinPesar', info: 'aviso' };
const SEVERIDAD_TEXTO = { danger: 'text-danger', warning: 'text-warning', info: 'text-info' };

export function AttentionList({ alertas, onAccion }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {alertas.map((a) => {
        const Icon = STATUS[SEVERIDAD_ESTADO[a.severidad]].icon;
        return (
          <li key={a.id} className="bg-surface-raised border border-line rounded-ds-lg shadow-card p-4 flex flex-col min-w-0">
            <p className={`type-label uppercase flex items-center gap-1.5 ${SEVERIDAD_TEXTO[a.severidad]}`}>
              <Icon size={14} aria-hidden="true" />
              {GRUPOS[a.grupo]}
            </p>
            <p className="type-small text-ink-muted mt-2">{a.corral}</p>
            <p className="type-strong text-ink mt-0.5">{a.titulo}</p>
            <p className="type-small text-ink-muted mt-1 flex-1">{a.detalle}</p>
            {a.accion && <button
              type="button"
              onClick={() => onAccion?.(a)}
              className={`mt-3 self-start inline-flex items-center gap-1 type-strong text-ink underline underline-offset-4 decoration-line-strong hover:decoration-ink rounded-ds-sm max-md:min-h-12 ${FOCUS_RING}`}
            >
              {a.accion}
              <ChevronRight size={16} aria-hidden="true" />
            </button>}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Corrales ---------- */

const Num = ({ children, className = '' }) => (
  <td className={`px-3 py-2.5 text-right type-data text-ink whitespace-nowrap ${className}`}>{children}</td>
);

const Th = ({ children, align = 'right', className = '' }) => (
  <th scope="col" className={`px-3 py-2 type-label uppercase text-ink-muted whitespace-nowrap font-bold ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
    {children}
  </th>
);

function EtapaCell({ lote }) {
  return (
    <div className="min-w-[132px]">
      <p className="type-small text-ink">{lote.alimento}</p>
      <div className="mt-1 h-1.5 rounded-full bg-surface-sunken overflow-hidden" role="img" aria-label={`Fase ${lote.faseNumero} de 7, ${fmt(lote.avanceFase)} % completada`}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${lote.avanceFase}%` }} />
      </div>
      <p className="type-small text-ink-muted mt-1">Fase {lote.faseNumero} · día <span className="font-data">{lote.dia}</span></p>
    </div>
  );
}

function ventaTexto(lote) {
  if (lote.diasAVenta === null || lote.diasAVenta === undefined) return '—';
  if (lote.diasAVenta === 0) return 'En peso';
  if (lote.diasAVenta > HORIZONTE_VENTA_DIAS) return `${HORIZONTE_VENTA_DIAS}+ d`;
  return `${lote.diasAVenta} d`;
}

export function CorralesTable({ lotes, libres = [], seleccionado, onSeleccionar, onAbrir }) {
  // Ocupados y libres van juntos en el orden fijo de la granja (Corral 1, 2, 3…).
  const filas = [
    ...lotes.map((dato) => ({ libre: false, dato })),
    ...libres.map((dato) => ({ libre: true, dato })),
  ].sort((a, b) => (a.dato.orden ?? Number.MAX_SAFE_INTEGER) - (b.dato.orden ?? Number.MAX_SAFE_INTEGER));

  return (
    <>
      {/* Escritorio: tabla densa */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse tabular-nums">
          <thead className="bg-surface-sunken">
            <tr>
              <Th align="left" className="pl-4">Corral</Th>
              <Th align="left">Etapa</Th>
              <Th>Cerdos</Th>
              <Th>Peso lb</Th>
              <Th>GMD</Th>
              <Th className="hidden xl:table-cell">ICA</Th>
              <Th>Mort.</Th>
              <Th className="hidden xl:table-cell">A venta</Th>
              <Th align="left">Estado</Th>
              <th scope="col" className="pr-4"><span className="sr-only">Abrir</span></th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ libre, dato }) => {
              if (libre) {
                const c = dato;
                return (
              <tr key={c.id} className="border-t border-line">
                <td className="pl-4 pr-3 py-2.5 type-strong text-ink-muted">{c.corral}</td>
                <td colSpan={9} className="px-3 py-2.5 type-small text-ink-muted">
                  <span className="inline-flex items-center gap-3">
                    Disponible, sin lote activo
                    {onAbrir && <Button size="sm" variant="quiet" icon={Plus} onClick={() => onAbrir(c.id)}>Ingresar lote</Button>}
                  </span>
                </td>
              </tr>
                );
              }
              const lote = dato;
              const activo = seleccionado === lote.id;
              return (
                <tr key={lote.id} className={`border-t border-line ${activo ? 'bg-primary-soft' : 'hover:bg-surface-sunken'}`}>
                  <td className="pl-4 pr-3 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      aria-pressed={activo}
                      onClick={() => onSeleccionar?.(lote.id)}
                      className={`text-left rounded-ds-sm ${FOCUS_RING}`}
                    >
                      <span className="block type-strong text-ink underline-offset-4 hover:underline">{lote.corral}</span>
                      <span className="block type-small text-ink-muted">{lote.lote}</span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5"><EtapaCell lote={lote} /></td>
                  <Num>{lote.cerdos}</Num>
                  <Num>{lote.pesoEstimado ? '~' : ''}{lote.peso > 0 ? fmt(lote.peso, 1) : '—'}</Num>
                  <Num>{lote.gmd > 0 ? fmt(lote.gmd, 2) : '—'}</Num>
                  <Num className={`hidden xl:table-cell ${lote.icaConfiable && lote.ica > ICA_REVISION ? '!text-warning' : ''}`}>{lote.ica > 0 ? `${lote.icaConfiable ? '' : '~'}${fmt(lote.ica, 2)}` : '—'}</Num>
                  <Num className={lote.mortalidad > MORTALIDAD_MAXIMA_PCT ? '!text-danger font-semibold' : ''}>{fmt(lote.mortalidad, 1)} %</Num>
                  <Num className="hidden xl:table-cell">{ventaTexto(lote)}</Num>
                  <td className="px-3 py-2.5"><StatusBadge status={lote.estado} /></td>
                  <td className="pr-4 py-2.5 text-right">
                    {onAbrir && (
                      <button
                        type="button"
                        aria-label={`Abrir ${lote.corral}`}
                        title={`Abrir ${lote.corral}`}
                        onClick={() => onAbrir(lote.corralId)}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-ds-md text-ink hover:bg-surface-raised ${FOCUS_RING}`}
                      >
                        <ChevronRight size={18} aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Móvil: tarjetas con los 3 datos que deciden en el corral */}
      <ul className="md:hidden border-t border-line">
        {filas.map(({ libre, dato }) => (libre ? (() => {
          const c = dato;
          return (
          <li key={c.id} className="border-b border-line last:border-b-0">
            <button
              type="button"
              onClick={() => onAbrir?.(c.id)}
              className={`w-full text-left p-4 min-h-control-field flex items-center justify-between gap-3 active:bg-surface-sunken ${FOCUS_RING}`}
            >
              <span>
                <span className="block type-strong text-ink-muted">{c.corral}</span>
                <span className="block type-small text-ink-muted">Disponible, sin lote activo</span>
              </span>
              <span className="inline-flex items-center gap-1 type-strong text-ink whitespace-nowrap"><Plus size={16} aria-hidden="true" />Ingresar lote</span>
            </button>
          </li>
          );
        })() : (() => {
          const lote = dato;
          return (
          <li key={lote.id} className="border-b border-line last:border-b-0">
            <button
              type="button"
              onClick={() => (onAbrir ? onAbrir(lote.corralId) : onSeleccionar?.(lote.id))}
              className={`w-full text-left p-4 min-h-control-field active:bg-surface-sunken ${FOCUS_RING}`}
            >
              <span className="flex items-start justify-between gap-2">
                <span>
                  <span className="block type-strong text-ink">{lote.corral}</span>
                  <span className="block type-small text-ink-muted">{lote.alimento} · día <span className="font-data">{lote.dia}</span></span>
                </span>
                <StatusBadge status={lote.estado} />
              </span>
              <span className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ['Cerdos', lote.cerdos],
                  ['Peso lb', lote.peso > 0 ? `${lote.pesoEstimado ? '~' : ''}${fmt(lote.peso, 1)}` : '—'],
                  ['GMD', lote.gmd > 0 ? fmt(lote.gmd, 2) : '—'],
                ].map(([rotulo, valor]) => (
                  <span key={rotulo}>
                    <span className="block type-label uppercase text-ink-muted">{rotulo}</span>
                    <span className="block type-data-lg text-ink">{valor}</span>
                  </span>
                ))}
              </span>
            </button>
          </li>
          );
        })()))}
      </ul>
    </>
  );
}

/* ---------- Bodega ---------- */

const COBERTURA_MAX = 30;
const BARRA = { ok: 'bg-accent', bajo: 'bg-warning', critico: 'bg-danger', sinUso: 'bg-line-strong' };

export function FeedStock({ items }) {
  return (
    <ul className="px-4 pb-4 space-y-3">
      {items.map((item) => {
        const avance = item.dias === null ? 0 : Math.min(100, (item.dias / COBERTURA_MAX) * 100);
        return (
          <li key={item.alimento}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="type-small text-ink">{item.alimento}</span>
              <span className="type-data text-ink whitespace-nowrap">{fmt(item.sacos, Number.isInteger(item.sacos) ? 0 : 1)} sacos</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-surface-sunken overflow-hidden" aria-hidden="true">
              <div className={`h-full rounded-full ${BARRA[item.estado]}`} style={{ width: `${avance}%` }} />
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 min-h-5">
              <span className="type-small text-ink-muted">
                {item.dias === null ? 'Sin consumo en 14 días' : <><span className="font-data">{fmt(Math.floor(item.dias))}</span> días de cobertura</>}
              </span>
              {(item.estado === 'bajo' || item.estado === 'critico') && <StatusBadge status={item.estado} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Curva de crecimiento ---------- */

function useAncho() {
  const ref = useRef(null);
  const [ancho, setAncho] = useState(640);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(280, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho];
}

const ALTO = 260;
const M = { t: 12, r: 16, b: 32, l: 44 };
const DIAS_MINIMOS_EJE = 140;
const MARCAS_DIA = [0, 28, 49, 70, 105, 133];

const interpolar = (puntos, dia) => {
  if (dia <= puntos[0][0]) return puntos[0][1];
  for (let i = 1; i < puntos.length; i += 1) {
    const [d0, p0] = puntos[i - 1];
    const [d1, p1] = puntos[i];
    if (dia <= d1) return p0 + ((dia - d0) / (d1 - d0 || 1)) * (p1 - p0);
  }
  return puntos[puntos.length - 1][1];
};

export function GrowthChart({ lote }) {
  const [ref, ancho] = useAncho();
  const [hover, setHover] = useState(null);

  const objetivo = lote.pesoObjetivoLb;
  const reales = lote.pesajes.map((p) => [p.dia, p.peso]);
  const ultimo = reales[reales.length - 1];
  const hayEstimado = Boolean(lote.pesoEstimado) && lote.dia > ultimo[0];
  const puntos = hayEstimado ? [...reales, [lote.dia, lote.peso]] : reales;
  const ultimoDia = puntos[puntos.length - 1][0];

  const xMax = Math.max(DIAS_MINIMOS_EJE, ultimoDia + 7);
  const pesoMaximo = Math.max(objetivo, ...puntos.map((p) => p[1]));
  const yMax = Math.ceil((pesoMaximo * 1.08) / 50) * 50;
  const yTicks = Array.from({ length: yMax / 50 + 1 }, (_, i) => i * 50);
  const x = (d) => M.l + (d / xMax) * (ancho - M.l - M.r);
  const y = (p) => M.t + (1 - p / yMax) * (ALTO - M.t - M.b);
  const camino = (pts) => pts.map(([d, p], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)} ${y(p).toFixed(1)}`).join(' ');

  const mover = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * ancho;
    const dia = Math.round(((px - M.l) / (ancho - M.l - M.r)) * xMax);
    setHover(dia < reales[0][0] || dia > ultimoDia ? null : dia);
  };

  const hoverPeso = hover === null ? null : interpolar(puntos, hover);
  const pesajeExacto = hover === null ? null : lote.pesajes.find((p) => p.dia === hover);

  return (
    <div className="px-4 pb-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 type-small text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5 bg-chart-actual" aria-hidden="true" />Pesajes</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5 bg-chart-target" aria-hidden="true" />Peso de salida</span>
        {hayEstimado && (
          <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-chart-actual" aria-hidden="true" />Estimado por consumo</span>
        )}
      </div>
      <div ref={ref} className="relative">
        <svg
          width={ancho}
          height={ALTO}
          role="img"
          aria-label={`Peso de ${lote.corral}: ${fmt(lote.peso, 1)} libras en el día ${lote.dia}. Peso de salida: ${fmt(objetivo)} libras.`}
          onPointerMove={mover}
          onPointerLeave={() => setHover(null)}
          className="block touch-pan-y"
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={ancho - M.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
              <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fontFamily="var(--font-mono)" fill="var(--ink-muted)">{t}</text>
            </g>
          ))}
          {MARCAS_DIA.map((t) => (
            <text key={t} x={x(t)} y={ALTO - 12} textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill="var(--ink-muted)">{t}</text>
          ))}
          <line x1={M.l} x2={ancho - M.r} y1={y(objetivo)} y2={y(objetivo)} stroke="var(--chart-target)" strokeWidth="2" />
          <text x={ancho - M.r} y={y(objetivo) - 6} textAnchor="end" fontSize="11" fontFamily="var(--font-mono)" fill="var(--ink-muted)">{fmt(objetivo)} lb</text>
          <path d={camino(reales)} fill="none" stroke="var(--chart-actual)" strokeWidth="2" strokeLinejoin="round" />
          {hayEstimado && (
            <path d={camino([ultimo, [lote.dia, lote.peso]])} fill="none" stroke="var(--chart-actual)" strokeWidth="2" strokeDasharray="4 4" />
          )}
          {reales.map(([d, p]) => (
            <circle key={d} cx={x(d)} cy={y(p)} r="4" fill="var(--chart-actual)" stroke="var(--surface-raised)" strokeWidth="2" />
          ))}
          {hayEstimado && <circle cx={x(lote.dia)} cy={y(lote.peso)} r="5" fill="var(--surface-raised)" stroke="var(--chart-actual)" strokeWidth="2" />}
          {hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={ALTO - M.b} stroke="var(--line-strong)" strokeWidth="1" />
              <circle cx={x(hover)} cy={y(hoverPeso)} r="4" fill="var(--chart-actual)" stroke="var(--surface-raised)" strokeWidth="2" />
            </>
          )}
        </svg>
        {hover !== null && (
          <div
            className="absolute top-2 pointer-events-none bg-surface-raised border border-line-strong rounded-ds-md shadow-pop px-3 py-2 min-w-[150px]"
            style={x(hover) > ancho * 0.6 ? { right: ancho - x(hover) + 12 } : { left: x(hover) + 12 }}
          >
            <p className="type-small text-ink-muted">Día <span className="font-data">{hover}</span>{pesajeExacto ? ' · pesaje' : ' · entre pesajes'}</p>
            <p className="flex justify-between gap-4 type-small text-ink mt-1"><span>Peso</span><span className="font-data">{fmt(hoverPeso, 1)} lb</span></p>
            <p className="flex justify-between gap-4 type-small text-ink"><span>Falta</span><span className="font-data">{fmt(Math.max(0, objetivo - hoverPeso), 1)} lb</span></p>
          </div>
        )}
      </div>
      <p className="type-small text-ink-muted text-center mt-1">Días de lote · peso en libras</p>
      <details className="mt-3">
        <summary className={`type-small text-ink-muted cursor-pointer rounded-ds-sm inline-block ${FOCUS_RING}`}>Ver pesajes como tabla</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead>
            <tr><Th align="left">Día</Th><Th>Peso lb</Th></tr>
          </thead>
          <tbody>
            {lote.pesajes.map((p) => (
              <tr key={p.dia} className="border-t border-line">
                <td className="px-3 py-1 type-data text-ink">{p.dia}</td>
                <td className="px-3 py-1 type-data text-ink text-right">{fmt(p.peso, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export function PanelCargando() {
  return (
    <Card>
      <div className="p-4 space-y-3">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    </Card>
  );
}
