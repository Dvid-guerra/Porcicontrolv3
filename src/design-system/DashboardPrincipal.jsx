import { AppShell } from './AppShell.jsx';
import { PanelPrincipal } from './PanelPrincipal.jsx';
import { DATOS_DEMO } from './mockData.js';
import { WifiOff } from 'lucide-react';

/**
 * Panel principal con marco y datos de prueba, para el sistema de diseño.
 * La app real usa PanelPrincipal directamente, dentro de su propio marco.
 * estado: 'normal' | 'cargando' | 'vacio' | 'sinSenal'
 */
export function DashboardPrincipal({ estado = 'normal', markSrc, onNavegar, onRegistrar }) {
  const sinSenal = estado === 'sinSenal';
  const datos = estado === 'vacio' ? { ...DATOS_DEMO, lotes: [] } : DATOS_DEMO;
  return (
    <AppShell vista="dashboard" titulo="Panel principal" sinSenal={sinSenal} enCola={sinSenal ? 3 : 0} markSrc={markSrc} onNavegar={onNavegar} onRegistrar={onRegistrar}>
      {sinSenal && (
        <div className="px-4 lg:px-6 pt-4 bg-surface">
          <p role="status" className="flex items-start gap-2 rounded-ds-lg border border-warning bg-warning-soft text-warning p-3 type-body">
            <WifiOff size={18} aria-hidden="true" className="shrink-0 mt-px" />
            <span>Modo Galpón sin señal. Hay 3 registros guardados en este equipo; se envían solos al volver la señal.</span>
          </p>
        </div>
      )}
      <PanelPrincipal
        datos={datos}
        cargando={estado === 'cargando'}
        onVerHoy={() => onNavegar?.('hoy')}
        onVerCalendario={() => onNavegar?.('calendario')}
        onAbrirCorral={() => {}}
        onCrearLote={() => {}}
      />
    </AppShell>
  );
}
