import { useEffect, useState } from 'react';
import {
  Archive,
  Calendar,
  CheckCircle,
  Cloud,
  ClipboardList,
  DollarSign,
  HeartPulse,
  LayoutDashboard,
  Menu,
  Plus,
  Scale,
  Settings,
  Syringe,
  Wheat,
  WifiOff,
  X,
} from 'lucide-react';
import { Button } from './primitives.jsx';
import { FOCUS_RING } from './uiConstants.js';

// Mismas vistas y etiquetas que App.jsx
const NAV_PRINCIPAL = [
  { id: 'hoy', label: 'Hoy', icon: CheckCircle, badge: 4 },
  { id: 'dashboard', label: 'Panel principal', corto: 'Panel', icon: LayoutDashboard },
  { id: 'bodega', label: 'Bodega central', corto: 'Bodega', icon: Archive },
  { id: 'finanzasGlobales', label: 'Finanzas globales', icon: DollarSign },
  { id: 'calendario', label: 'Calendario', icon: Calendar },
];
const NAV_SECUNDARIA = [
  { id: 'historial', label: 'Historial de lotes', icon: ClipboardList },
  { id: 'config', label: 'Ajustes y fórmulas', icon: Settings },
];

const REGISTROS = [
  { id: 'alimento', label: 'Descarga de alimento', icon: Wheat },
  { id: 'pesaje', label: 'Pesaje', icon: Scale },
  { id: 'baja', label: 'Baja', icon: HeartPulse },
  { id: 'tratamiento', label: 'Tratamiento', icon: Syringe },
];

const SIDEBAR_FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-wheat';

function SidebarLink({ item, activa, onNavegar }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      aria-current={activa ? 'page' : undefined}
      onClick={() => onNavegar?.(item.id)}
      className={`relative w-full h-control-md px-3 flex items-center gap-3 rounded-ds-md text-left type-body transition-colors ${SIDEBAR_FOCUS} ${activa ? 'bg-sidebar-active text-sidebar-ink font-bold' : 'text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-ink'}`}
    >
      {activa && <span aria-hidden="true" className="absolute left-0 inset-y-2 w-0.5 rounded-full bg-wheat" />}
      <Icon size={18} aria-hidden="true" className="shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && <span className="type-small font-data text-sidebar-ink">{item.badge}</span>}
    </button>
  );
}

function Sidebar({ vista, onNavegar, markSrc }) {
  return (
    <aside className="hidden lg:flex flex-col bg-sidebar sticky top-0 self-start w-sidebar h-dvh" aria-label="Navegación principal">
      <div className="flex items-center gap-2.5 px-4 h-20 border-b border-sidebar-line">
        {markSrc && <img src={markSrc} alt="Guerra Farm" className="h-12 w-auto" />}
        <div className="min-w-0">
          <p className="font-display font-bold text-[19px] leading-6 text-sidebar-ink">Porcicontrol</p>
          <p className="type-small text-sidebar-muted">Guerra Farm</p>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV_PRINCIPAL.map((item) => <SidebarLink key={item.id} item={item} activa={vista === item.id} onNavegar={onNavegar} />)}
        <div className="my-3 border-t border-sidebar-line" />
        {NAV_SECUNDARIA.map((item) => <SidebarLink key={item.id} item={item} activa={vista === item.id} onNavegar={onNavegar} />)}
      </nav>
    </aside>
  );
}

function SyncChip({ sinSenal, enCola = 0 }) {
  if (sinSenal) {
    return (
      <span className="inline-flex items-center gap-1.5 h-control-sm px-2.5 rounded-ds-sm border border-warning bg-warning-soft text-warning type-small whitespace-nowrap">
        <WifiOff size={14} aria-hidden="true" />
        Sin señal · <span className="font-data">{enCola}</span> en cola
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 type-small text-ink-muted whitespace-nowrap">
      <Cloud size={14} aria-hidden="true" />
      Sincronizado
    </span>
  );
}

function HojaRegistro({ abierta, onCerrar, onRegistrar }) {
  useEffect(() => {
    if (!abierta) return undefined;
    const alPulsar = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [abierta, onCerrar]);

  if (!abierta) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center" style={{ backgroundColor: 'rgba(26, 42, 26, 0.45)' }} onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registrar"
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-sm bg-surface-raised rounded-t-lg md:rounded-ds-lg shadow-pop p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="type-heading text-ink">Registrar</h2>
          <button type="button" aria-label="Cerrar" onClick={onCerrar} className={`w-12 h-12 -mr-2 flex items-center justify-center rounded-ds-md text-ink hover:bg-surface-sunken ${FOCUS_RING}`}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-2">
          {REGISTROS.map((r) => (
            <Button key={r.id} variant="secondary" size="field" icon={r.icon} className="!justify-start" onClick={() => { onRegistrar?.(r.id); onCerrar(); }}>
              {r.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BottomNav({ vista, onNavegar, onRegistrar }) {
  const izquierda = NAV_PRINCIPAL.slice(0, 2);
  const derecha = [NAV_PRINCIPAL[2], { id: 'mas', label: 'Más', icon: Menu }];
  const Item = ({ item }) => {
    const Icon = item.icon;
    const activa = vista === item.id;
    return (
      <button
        type="button"
        aria-current={activa ? 'page' : undefined}
        onClick={() => onNavegar?.(item.id)}
        className={`flex-1 h-16 flex flex-col items-center justify-center gap-1 type-small ${FOCUS_RING} ${activa ? 'text-ink font-bold' : 'text-ink-muted'}`}
      >
        <Icon size={22} aria-hidden="true" />
        {item.corto ?? item.label}
      </button>
    );
  };
  return (
    <nav aria-label="Navegación principal" className="lg:hidden fixed inset-x-0 bottom-0 z-30 flex items-center bg-surface-raised border-t border-line pb-[env(safe-area-inset-bottom)]">
      {izquierda.map((item) => <Item key={item.id} item={item} />)}
      <div className="flex-1 flex justify-center">
        <button
          type="button"
          aria-label="Registrar"
          onClick={onRegistrar}
          className={`w-14 h-14 -mt-6 rounded-full bg-primary text-on-primary hover:bg-primary-hover shadow-pop flex items-center justify-center ${FOCUS_RING}`}
        >
          <Plus size={26} aria-hidden="true" />
        </button>
      </div>
      {derecha.map((item) => <Item key={item.id} item={item} />)}
    </nav>
  );
}

export function AppShell({ vista = 'dashboard', titulo, sinSenal = false, enCola = 0, markSrc, onNavegar, onRegistrar, children }) {
  const [hoja, setHoja] = useState(false);
  return (
    <div className="min-h-dvh bg-surface text-ink font-ui lg:flex">
      <Sidebar vista={vista} onNavegar={onNavegar} markSrc={markSrc} />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-topbar flex items-center gap-3 px-4 lg:px-6 bg-surface border-b border-line max-lg:bg-sidebar max-lg:border-sidebar-line">
          {markSrc && <img src={markSrc} alt="Guerra Farm" className="h-9 w-auto lg:hidden" />}
          <p className="type-strong text-ink flex-1 truncate max-lg:text-sidebar-ink lg:text-ink-muted lg:font-medium">{titulo}</p>
          <span className="max-lg:hidden"><SyncChip sinSenal={sinSenal} enCola={enCola} /></span>
          <span className="lg:hidden inline-flex items-center gap-1.5 type-small text-sidebar-ink whitespace-nowrap">
            {sinSenal ? <WifiOff size={14} aria-hidden="true" /> : <Cloud size={14} aria-hidden="true" />}
            {sinSenal ? `${enCola} en cola` : 'Al día'}
          </span>
          <Button variant="primary" icon={Plus} className="max-lg:hidden" onClick={() => setHoja(true)}>Registrar</Button>
        </header>
        <main className="flex-1 min-w-0 pb-24 lg:pb-0">{children}</main>
      </div>
      <BottomNav vista={vista} onNavegar={onNavegar} onRegistrar={() => setHoja(true)} />
      <HojaRegistro abierta={hoja} onCerrar={() => setHoja(false)} onRegistrar={onRegistrar} />
    </div>
  );
}
