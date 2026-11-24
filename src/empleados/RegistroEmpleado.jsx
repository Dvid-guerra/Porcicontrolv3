import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle, ChevronDown, ChevronLeft, Clock, CloudOff, CloudUpload, LogOut,
  Minus, Package, Plus, QrCode, Skull, Syringe, Trash2, UserRound, Wheat, XCircle
} from 'lucide-react';
import { deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import marcaGuerraFarm from '../design-system/assets/guerra-farm-marca-sobre-bosque.png';
import { formatLocalIsoDate } from '../domain/fieldUx.js';
import { ESTADO_CAPTURA, ETIQUETA_TIPO, construirCaptura, describirCaptura } from '../domain/capturasEmpleado.js';
import { colCapturas, refCatalogoEmpleados, mensajeFirestore } from './accesos.js';
import { escucharHistorialEmpleado } from './historialEmpleado.js';
import EscanerCorral from './EscanerCorral.jsx';

const ACCIONES = [
  { tipo: 'concentrado', titulo: 'Concentrado', ayuda: 'Lo que serviste en la tolva', icon: Wheat },
  { tipo: 'medicamento', titulo: 'Medicamento', ayuda: 'Lo que le aplicaste a los cerdos', icon: Syringe },
  { tipo: 'insumo', titulo: 'Insumo', ayuda: 'Viruta, cal, desinfectante…', icon: Package },
  { tipo: 'baja', titulo: 'Baja', ayuda: 'Cerdos que murieron', icon: Skull }
];

const CAUSAS_BAJA = ['Neumonía', 'Diarrea', 'Aplastado', 'Pelea', 'No se sabe'];

const CAMPO = 'w-full h-14 px-4 rounded-ds-md border border-line-strong bg-surface-raised text-ink text-[17px] font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/30';
const ETIQUETA = 'block type-label uppercase text-ink-muted mb-1.5';

const fechaLarga = (iso) => {
  const texto = new Date(`${iso}T12:00:00`).toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};
const horaCorta = (ms) => new Date(ms).toLocaleTimeString('es-GT', { hour: 'numeric', minute: '2-digit' });

// --- Datos en vivo -----------------------------------------------------------

function useEnLinea() {
  const [enLinea, setEnLinea] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return enLinea;
}

// La fecha de "hoy" se refresca sola para un teléfono que queda abierto de un día a otro.
function useHoy() {
  const [hoy, setHoy] = useState(() => formatLocalIsoDate());
  useEffect(() => {
    const revisar = () => setHoy((previo) => {
      const actual = formatLocalIsoDate();
      return actual === previo ? previo : actual;
    });
    const intervalo = setInterval(revisar, 60_000);
    document.addEventListener('visibilitychange', revisar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', revisar);
    };
  }, []);
  return hoy;
}

function useCatalogo(ref) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => onSnapshot(ref, { includeMetadataChanges: true }, snap => {
    setDatos(snap.data() || null);
    setError(!snap.exists() && !snap.metadata.fromCache
      ? 'El catálogo está pendiente de publicación. Pedile al administrador que abra Porcicontrol una vez con conexión.'
      : '');
  }, err => {
    setDatos(null);
    setError(mensajeFirestore(err, 'leer los corrales'));
  }), [ref, intento]);
  return { datos, error, reintentar: () => setIntento(i => i + 1) };
}

function useMisCapturas(db, appId, uid) {
  const [estado, setEstado] = useState({ capturas: [], error: '', cargando: true, deCache: false });
  const [intento, setIntento] = useState(0);
  useEffect(() => escucharHistorialEmpleado(db, appId, uid,
    (capturas, deCache) => setEstado({ capturas, deCache, cargando: false, error: '' }),
    err => setEstado({ capturas: [], cargando: false, deCache: false, error: mensajeFirestore(err, 'leer tu historial') })
  ), [db, appId, uid, intento]);
  const reintentar = () => {
    setEstado(prev => ({ ...prev, cargando: true, error: '' }));
    setIntento(i => i + 1);
  };
  return { ...estado, reintentar };
}

// --- Piezas de interfaz --------------------------------------------------------

function BotonPrincipal({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`w-full min-h-14 px-5 rounded-ds-md bg-primary text-on-primary text-[17px] font-bold flex items-center justify-center gap-2.5 hover:bg-primary-hover disabled:opacity-50 transition-colors ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Aviso({ tono = 'warning', children }) {
  const clases = tono === 'danger' ? 'bg-danger-soft text-danger border-danger' : 'bg-warning-soft text-warning border-warning';
  return (
    <div role="alert" className={`flex items-start gap-2.5 rounded-ds-md border px-3.5 py-3 type-strong ${clases}`}>
      <AlertTriangle size={18} aria-hidden="true" className="mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function SelectorCorral({ corrales, corralId, onElegir, onEscanear }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-1.5">
        <span className={`${ETIQUETA} mb-0`}>Corral</span>
        <button type="button" onClick={onEscanear} className="h-10 px-3 rounded-ds-md border border-line-strong bg-surface-raised type-strong flex items-center gap-2">
          <QrCode size={16} aria-hidden="true" /> Escanear QR
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {corrales.map((corral) => {
          const vacio = !corral.loteId;
          const activo = corral.id === corralId;
          return (
            <button
              key={corral.id}
              type="button"
              disabled={vacio}
              aria-pressed={activo}
              onClick={() => onElegir(corral)}
              className={`min-h-16 px-3.5 py-2.5 rounded-ds-md border-2 text-left transition-colors ${activo ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface-raised text-ink'} ${vacio ? 'opacity-45' : ''}`}
            >
              <span className="block text-[17px] font-bold leading-tight">{corral.nombre}</span>
              <span className={`block type-small mt-0.5 ${activo ? 'text-on-primary' : 'text-ink-muted'}`}>
                {vacio ? 'Vacío' : `${corral.cerdos} cerdos`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CampoCantidad({ id, etiqueta, valor, onCambio, sufijo, paso = 1 }) {
  const actual = parseFloat(String(valor).replace(',', '.')) || 0;
  const mover = (delta) => onCambio(String(Math.max(0, Number((actual + delta).toFixed(2)))));
  return (
    <div>
      <label htmlFor={id} className={ETIQUETA}>{etiqueta}</label>
      <div className="flex items-stretch gap-2">
        <button type="button" onClick={() => mover(-paso)} aria-label="Quitar" className="h-14 w-14 shrink-0 rounded-ds-md border border-line-strong bg-surface-raised flex items-center justify-center">
          <Minus size={22} aria-hidden="true" />
        </button>
        <div className="relative flex-1">
          <input id={id} inputMode="decimal" autoComplete="off" value={valor} onChange={(e) => onCambio(e.target.value)} placeholder="0" className={`${CAMPO} text-center font-data text-[22px] ${sufijo ? 'pr-16' : ''}`} />
          {sufijo && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 type-strong text-ink-muted pointer-events-none">{sufijo}</span>}
        </div>
        <button type="button" onClick={() => mover(paso)} aria-label="Agregar" className="h-14 w-14 shrink-0 rounded-ds-md border border-line-strong bg-surface-raised flex items-center justify-center">
          <Plus size={22} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function Segmentos({ opciones, valor, onCambio, etiqueta }) {
  return (
    <div role="group" aria-label={etiqueta} className="grid grid-flow-col auto-cols-fr gap-1 p-1 rounded-ds-md bg-surface-sunken">
      {opciones.map((op) => (
        <button key={op.valor} type="button" aria-pressed={valor === op.valor} onClick={() => onCambio(op.valor)} className={`h-11 rounded-ds-sm type-strong ${valor === op.valor ? 'bg-surface-raised text-ink shadow-card' : 'text-ink-muted'}`}>
          {op.texto}
        </button>
      ))}
    </div>
  );
}

// --- Formulario de registro ---------------------------------------------------

const datosIniciales = (tipo) => {
  if (tipo === 'concentrado') return { alimento: '', cantidad: '', unidad: 'sacos', nota: '' };
  if (tipo === 'medicamento') return { productoId: '', nombre: '', unidad: '', cantidad: '', nota: '' };
  if (tipo === 'insumo') return { productoId: '', nombre: '', unidad: '', cantidad: '', nota: '' };
  return { cantidad: '1', causa: '', nota: '' };
};

const OTRO = '__otro__';

function Formulario({ db, appId, onError, accion, catalogo, hoy, empleado, uid, onGuardado, onVolver }) {
  const { tipo } = accion;
  const [corral, setCorral] = useState(null);
  const [fecha, setFecha] = useState(hoy);
  const [datos, setDatos] = useState(() => datosIniciales(tipo));
  const [error, setError] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const cambiar = (parcial) => setDatos((previo) => ({ ...previo, ...parcial }));

  const elegirCorral = useCallback((nuevo) => {
    setCorral(nuevo);
    setEscaneando(false);
    setError('');
    if (tipo === 'concentrado' && nuevo.alimentoSugerido) {
      setDatos((previo) => ({ ...previo, alimento: nuevo.alimentoSugerido }));
    }
  }, [tipo]);
  const cerrarEscaner = useCallback(() => setEscaneando(false), []);

  const productos = tipo === 'medicamento' ? catalogo.medicamentos : tipo === 'insumo' ? catalogo.insumos : [];
  const esOtro = datos.productoId === OTRO;
  const elegirProducto = (id) => {
    if (id === OTRO) return cambiar({ productoId: OTRO, nombre: '', unidad: '' });
    const producto = productos.find((p) => p.id === id);
    cambiar({ productoId: id, nombre: producto?.nombre || '', unidad: producto?.unidad || '' });
  };

  const guardar = (e) => {
    e.preventDefault();
    const resultado = construirCaptura({
      tipo,
      corral,
      empleado,
      fecha,
      hoy,
      uid,
      datos: esOtro ? { ...datos, productoId: '' } : datos
    });
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    // No se espera la respuesta del servidor: sin señal, Firestore guarda la
    // captura en el teléfono y la envía sola cuando vuelve la conexión.
    const ref = doc(colCapturas(db, appId));
    setDoc(ref, resultado.captura).catch(() => onError('No se pudo enviar el registro. Revisá tu acceso y volvé a ingresarlo.'));
    onGuardado(resultado.captura);
  };

  return (
    <form onSubmit={guardar} className="space-y-5 pb-28">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onVolver} aria-label="Volver al inicio" className="h-12 w-12 shrink-0 rounded-ds-md border border-line-strong bg-surface-raised flex items-center justify-center">
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <div>
          <h1 className="type-title text-ink leading-tight">{accion.titulo}</h1>
          <p className="type-small text-ink-muted">{accion.ayuda}</p>
        </div>
      </div>

      <SelectorCorral corrales={catalogo.corrales} corralId={corral?.id} onElegir={elegirCorral} onEscanear={() => setEscaneando(true)} />

      {tipo === 'concentrado' && (
        <>
          <div>
            <label htmlFor="emp-alimento" className={ETIQUETA}>Concentrado</label>
            <select id="emp-alimento" value={datos.alimento} onChange={(e) => cambiar({ alimento: e.target.value })} className={CAMPO}>
              <option value="">Elegí…</option>
              {catalogo.concentrados.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
            </select>
            {corral?.alimentoSugerido && datos.alimento === corral.alimentoSugerido && (
              <p className="type-small text-ink-muted mt-1.5">Es el que le toca a {corral.nombre} en esta etapa.</p>
            )}
          </div>
          <Segmentos etiqueta="Unidad" valor={datos.unidad} onCambio={(unidad) => cambiar({ unidad })} opciones={[{ valor: 'sacos', texto: 'Sacos' }, { valor: 'lb', texto: 'Libras' }]} />
          <CampoCantidad id="emp-cantidad" etiqueta="¿Cuánto serviste?" valor={datos.cantidad} onCambio={(cantidad) => cambiar({ cantidad })} sufijo={datos.unidad === 'lb' ? 'lb' : 'sacos'} paso={datos.unidad === 'lb' ? 10 : 0.5} />
        </>
      )}

      {(tipo === 'medicamento' || tipo === 'insumo') && (
        <>
          <div>
            <label htmlFor="emp-producto" className={ETIQUETA}>{tipo === 'medicamento' ? 'Medicamento' : 'Insumo'}</label>
            <select id="emp-producto" value={datos.productoId} onChange={(e) => elegirProducto(e.target.value)} className={CAMPO}>
              <option value="">Elegí…</option>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              {tipo === 'medicamento' && <option value={OTRO}>Otro (no está en la lista)</option>}
            </select>
          </div>
          {esOtro && (
            <div className="grid grid-cols-[1fr_7rem] gap-2.5">
              <div>
                <label htmlFor="emp-otro" className={ETIQUETA}>¿Qué aplicaste?</label>
                <input id="emp-otro" value={datos.nombre} maxLength={80} onChange={(e) => cambiar({ nombre: e.target.value })} className={CAMPO} />
              </div>
              <div>
                <label htmlFor="emp-unidad" className={ETIQUETA}>Unidad</label>
                <input id="emp-unidad" value={datos.unidad} maxLength={20} placeholder="ml" onChange={(e) => cambiar({ unidad: e.target.value })} className={CAMPO} />
              </div>
            </div>
          )}
          <CampoCantidad id="emp-cantidad" etiqueta="¿Cuánto usaste?" valor={datos.cantidad} onCambio={(cantidad) => cambiar({ cantidad })} sufijo={esOtro ? '' : datos.unidad} />
        </>
      )}

      {tipo === 'baja' && (
        <>
          <CampoCantidad id="emp-cantidad" etiqueta="¿Cuántos murieron?" valor={datos.cantidad} onCambio={(cantidad) => cambiar({ cantidad })} sufijo="cerdos" />
          <div>
            <label htmlFor="emp-causa" className={ETIQUETA}>¿De qué?</label>
            <div className="flex flex-wrap gap-2 mb-2.5">
              {CAUSAS_BAJA.map((causa) => (
                <button key={causa} type="button" aria-pressed={datos.causa === causa} onClick={() => cambiar({ causa })} className={`h-11 px-3.5 rounded-full border type-strong ${datos.causa === causa ? 'bg-primary text-on-primary border-primary' : 'bg-surface-raised border-line-strong text-ink'}`}>
                  {causa}
                </button>
              ))}
            </div>
            <input id="emp-causa" value={datos.causa} maxLength={120} placeholder="O escribila aquí" onChange={(e) => cambiar({ causa: e.target.value })} className={CAMPO} />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-5">
        <div>
          <label htmlFor="emp-fecha" className={ETIQUETA}>Fecha</label>
          <input id="emp-fecha" type="date" value={fecha} max={hoy} required onChange={(e) => setFecha(e.target.value)} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="emp-nota" className={ETIQUETA}>Nota (opcional)</label>
          <input id="emp-nota" value={datos.nota} maxLength={300} onChange={(e) => cambiar({ nota: e.target.value })} className={CAMPO} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-surface border-t border-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="max-w-xl mx-auto space-y-2.5">
          {error && <Aviso tono="danger">{error}</Aviso>}
          <BotonPrincipal type="submit"><Check size={22} aria-hidden="true" /> Enviar a revisión</BotonPrincipal>
        </div>
      </div>

      {escaneando && <EscanerCorral corrales={catalogo.corrales} onCorral={elegirCorral} onCerrar={cerrarEscaner} />}
    </form>
  );
}

// --- Inicio --------------------------------------------------------------------

function EstadoCaptura({ captura }) {
  if (captura.sinEnviar) {
    return <span className="inline-flex items-center gap-1 type-small text-warning"><CloudUpload size={13} aria-hidden="true" /> Sin enviar</span>;
  }
  if (captura.estado === ESTADO_CAPTURA.aplicada) {
    return <span className="inline-flex items-center gap-1 type-small text-success"><CheckCircle size={13} aria-hidden="true" /> Aprobado</span>;
  }
  if (captura.estado === ESTADO_CAPTURA.rechazada) {
    return <span className="inline-flex items-center gap-1 type-small text-danger"><XCircle size={13} aria-hidden="true" /> Rechazado</span>;
  }
  return <span className="inline-flex items-center gap-1 type-small text-ink-muted"><Clock size={13} aria-hidden="true" /> En revisión</span>;
}

function FilaCaptura({ db, appId, captura, onError }) {
  const [confirmando, setConfirmando] = useState(false);
  const Icono = ACCIONES.find((a) => a.tipo === captura.tipo)?.icon || Package;
  const sePuedeBorrar = captura.estado === ESTADO_CAPTURA.pendiente;

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="h-10 w-10 shrink-0 rounded-ds-md bg-primary-soft text-on-primary-soft flex items-center justify-center">
          <Icono size={20} aria-hidden="true" />
        </span>
        <div className="flex-1">
          <p className="type-strong text-ink">{captura.corralNombre} · {ETIQUETA_TIPO[captura.tipo]}</p>
          <p className="type-body text-ink-muted">{describirCaptura(captura)}</p>
          <p className="type-small text-ink-muted mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <span>{captura.fecha} · {horaCorta(captura.creadaEn)}</span>
            <EstadoCaptura captura={captura} />
          </p>
          {captura.estado === ESTADO_CAPTURA.rechazada && captura.motivoRechazo && (
            <p className="type-small text-danger mt-1">Motivo: {captura.motivoRechazo}</p>
          )}
        </div>
        {sePuedeBorrar && !confirmando && (
          <button type="button" aria-label="Borrar este registro" onClick={() => setConfirmando(true)} className="h-11 w-11 shrink-0 rounded-ds-md flex items-center justify-center text-ink-muted hover:bg-surface-sunken">
            <Trash2 size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      {confirmando && (
        <div className="mt-2.5 flex items-center gap-2.5">
          <p className="flex-1 type-small text-ink-muted">¿Borrar este registro?</p>
          <button type="button" onClick={() => setConfirmando(false)} className="h-11 px-4 rounded-ds-md border border-line-strong type-strong">No</button>
          <button type="button" onClick={() => deleteDoc(doc(colCapturas(db, appId), captura.id)).catch(() => onError('No se pudo retirar el registro. Comprobá si ya fue revisado.'))} className="h-11 px-4 rounded-ds-md bg-danger text-surface-raised type-strong">Sí, borrar</button>
        </div>
      )}
    </li>
  );
}

function Consulta({ titulo, children }) {
  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
        {titulo}<ChevronDown size={17} aria-hidden="true" className="text-ink-muted group-open:rotate-180" />
      </summary>
      <div className="border-t border-line px-4">{children}</div>
    </details>
  );
}

function Inicio({ db, appId, onError, historial, catalogo, errorCatalogo, reintentar, enLinea, hoy, catalogoListo, onAccion }) {
  const { concentrados, corrales } = catalogo;
  const hayCorrales = corrales.some(c => c.loteId);
  const sinCatalogo = errorCatalogo ? 'Catálogo sin consultar.' : enLinea ? 'Cargando catálogo…' : 'Sin catálogo en este dispositivo.';
  let estadoHistorial = '';
  if (historial.cargando || (historial.deCache && enLinea && !historial.capturas.length)) estadoHistorial = 'Cargando registros…';
  else if (!historial.capturas.length) estadoHistorial = historial.deCache ? 'Sin registros guardados en este dispositivo.' : 'Todavía no enviaste registros.';

  return (
    <div className="space-y-5">
      <section aria-labelledby="emp-registrar">
        <p className="type-small text-ink-muted">{fechaLarga(hoy)}</p>
        <h1 id="emp-registrar" className="type-title mb-3">Registrar en corral</h1>
        {errorCatalogo && <div className="mb-3"><Aviso>{errorCatalogo} <button type="button" className="underline" onClick={reintentar}>Reintentar</button></Aviso></div>}
        <div className="grid grid-cols-2 gap-2">
          {ACCIONES.map(accion => (
            <button key={accion.tipo} type="button" disabled={!hayCorrales} onClick={() => onAccion(accion)}
              className="flex min-h-14 items-center gap-2 rounded-ds-md border border-line-strong bg-surface-raised px-3 text-left type-strong hover:border-primary focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">
              <accion.icon size={20} aria-hidden="true" className="shrink-0 text-primary" />{accion.titulo}
            </button>
          ))}
        </div>
        {!hayCorrales && !errorCatalogo && <p role="status" className="mt-2 type-small text-ink-muted">{catalogoListo ? 'Necesitás un corral con lote activo para registrar.' : sinCatalogo}</p>}
      </section>

      <div className="divide-y divide-line rounded-ds-md border border-line bg-surface-raised">
        <Consulta titulo="Corrales">
          {corrales.length ? <ul className="divide-y divide-line">{corrales.map(c => (
            <li key={c.id} className="py-2">
              <p className="type-strong">{c.nombre}</p>
              <p className="type-small text-ink-muted">{c.loteId ? [c.loteNombre, c.cerdos + ' cerdos', 'Etapa ' + c.fase, c.alimentoSugerido].filter(Boolean).join(' · ') : 'Sin lote activo'}</p>
            </li>
          ))}</ul> : <p className="py-3 type-small">{catalogoListo ? 'Sin corrales registrados.' : sinCatalogo}</p>}
        </Consulta>
        <Consulta titulo="Concentrado en bodega">
          {concentrados.length ? <ul className="divide-y divide-line">{concentrados.map(item => (
            <li key={item.nombre} className="flex items-baseline justify-between gap-3 py-2">
              <span className="type-body">{item.nombre}</span><span className="type-data shrink-0">{item.stockLbs == null ? 'Por actualizar' : item.stockLbs.toLocaleString('es-GT', { maximumFractionDigits: 2 }) + ' lb'}</span>
            </li>
          ))}</ul> : <p className="py-3 type-small">{catalogoListo ? 'Sin concentrado publicado.' : sinCatalogo}</p>}
        </Consulta>
      </div>

      <section aria-labelledby="emp-historial">
        <h2 id="emp-historial" className="type-heading mb-2">Mis registros</h2>
        {historial.error ? <Aviso>{historial.error} <button type="button" onClick={historial.reintentar} className="underline">Reintentar</button></Aviso>
          : estadoHistorial ? <p role="status" className="type-body text-ink-muted">{estadoHistorial}</p>
          : <ul className="divide-y divide-line rounded-ds-md border border-line bg-surface-raised">
              {historial.capturas.map(c => <FilaCaptura db={db} appId={appId} onError={onError} key={c.id} captura={c} />)}
            </ul>}
      </section>
    </div>
  );
}

// --- App -------------------------------------------------------------------------

export default function RegistroEmpleado({ db, appId, user, onSalir }) {
  const hoy = useHoy();
  const enLinea = useEnLinea();
  const refCatalogo = useMemo(() => refCatalogoEmpleados(db, appId), [db, appId]);
  const { datos: catalogoCrudo, error: errorCatalogo, reintentar } = useCatalogo(refCatalogo);
  const historial = useMisCapturas(db, appId, user.uid);
  const empleado = user.email || user.uid;
  const [errorEnvio, setErrorEnvio] = useState('');
  const [accion, setAccion] = useState(null);
  const [mensaje, setMensaje] = useState('');

  const catalogo = useMemo(() => ({
    corrales: Array.isArray(catalogoCrudo?.corrales) ? catalogoCrudo.corrales : [],
    concentrados: Array.isArray(catalogoCrudo?.concentrados) ? catalogoCrudo.concentrados : [],
    medicamentos: Array.isArray(catalogoCrudo?.medicamentos) ? catalogoCrudo.medicamentos : [],
    insumos: Array.isArray(catalogoCrudo?.insumos) ? catalogoCrudo.insumos : []
  }), [catalogoCrudo]);
  const sinEnviar = historial.capturas.filter((c) => c.sinEnviar).length;

  useEffect(() => {
    if (!mensaje) return undefined;
    const temporizador = setTimeout(() => setMensaje(''), 4000);
    return () => clearTimeout(temporizador);
  }, [mensaje]);

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <header className="sticky top-0 z-30 bg-sidebar text-sidebar-ink pt-[env(safe-area-inset-top)]">
        <div className="max-w-xl mx-auto h-14 px-4 flex items-center gap-3">
          <img src={marcaGuerraFarm} alt="" className="h-9 w-auto" />
          <div className="flex-1 flex items-center gap-2 truncate">
            <UserRound size={18} aria-hidden="true" className="text-wheat" />
            <span className="type-strong truncate">{empleado}</span>
          </div>
          <button type="button" onClick={onSalir} aria-label="Cerrar sesión" className="h-11 w-11 rounded-ds-md flex items-center justify-center hover:bg-sidebar-active">
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
        {(!enLinea || sinEnviar > 0) && (
          <div role="status" className="bg-wheat-100 text-wheat-700 type-small">
            <p className="max-w-xl mx-auto px-4 py-1.5 flex items-center gap-2">
              {enLinea ? <CloudUpload size={14} aria-hidden="true" /> : <CloudOff size={14} aria-hidden="true" />}
              {enLinea
                ? `Enviando ${sinEnviar} ${sinEnviar === 1 ? 'registro' : 'registros'}…`
                : `Sin señal. ${sinEnviar > 0 ? `${sinEnviar} ${sinEnviar === 1 ? 'registro se envía' : 'registros se envían'} cuando vuelva.` : 'Podés seguir registrando.'}`}
            </p>
          </div>
        )}
      </header>

      <main className="max-w-xl mx-auto px-4 py-5">
        {errorEnvio && <Aviso tono="danger">{errorEnvio}</Aviso>}
        {accion ? (
          <Formulario
            db={db} appId={appId} onError={setErrorEnvio}
            key={accion.tipo}
            accion={accion}
            catalogo={catalogo}
            hoy={hoy}
            empleado={empleado}
            uid={user.uid}
            onVolver={() => setAccion(null)}
            onGuardado={(captura) => {
              setAccion(null);
              setMensaje(`Registrado para revisión: ${captura.corralNombre} · ${describirCaptura(captura)}`);
              window.scrollTo({ top: 0 });
            }}
          />
        ) : (
          <Inicio
            db={db} appId={appId} onError={setErrorEnvio} historial={historial} catalogo={catalogo}
            errorCatalogo={errorCatalogo} reintentar={reintentar} enLinea={enLinea}
            hoy={hoy}
            catalogoListo={Boolean(catalogoCrudo)}
            onAccion={(nueva) => { setErrorEnvio(''); setAccion(nueva); window.scrollTo({ top: 0 }); }}
          />
        )}
      </main>

      {mensaje && (
        <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 max-w-xl mx-auto rounded-ds-md bg-forest-950 text-cream shadow-pop px-4 py-3.5 flex items-center gap-2.5 type-strong">
          <CheckCircle size={20} aria-hidden="true" className="text-wheat" /> {mensaje}
        </div>
      )}
    </div>
  );
}
