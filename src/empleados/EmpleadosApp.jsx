import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle, ChevronLeft, Clock, CloudOff, CloudUpload, LogOut,
  Minus, Package, Plus, QrCode, Scale, Skull, Syringe, Trash2, UserRound, Wheat, XCircle
} from 'lucide-react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { deleteDoc, doc, onSnapshot, orderBy, query, setDoc, where } from 'firebase/firestore';
import marcaGuerraFarm from '../design-system/assets/guerra-farm-marca-sobre-bosque.png';
import { formatLocalIsoDate } from '../domain/fieldUx.js';
import { ESTADO_CAPTURA, ETIQUETA_TIPO, construirCaptura, describirCaptura } from '../domain/capturasEmpleado.js';
import { APP_ID_GRANJA, ROL, colCapturas, refCatalogoEmpleados, refPersonal, useAcceso } from './accesos.js';
import { auth, db } from './firebaseEmpleados.js';
import EscanerCorral from './EscanerCorral.jsx';

const CLAVE_NOMBRE = 'porci_empleado_nombre';

const ACCIONES = [
  { tipo: 'concentrado', titulo: 'Concentrado', ayuda: 'Lo que serviste en la tolva', icon: Wheat },
  { tipo: 'medicamento', titulo: 'Medicamento', ayuda: 'Lo que le aplicaste a los cerdos', icon: Syringe },
  { tipo: 'insumo', titulo: 'Insumo', ayuda: 'Viruta, cal, desinfectante…', icon: Package },
  { tipo: 'peso', titulo: 'Pesaje', ayuda: 'Peso de los cerdos en libras', icon: Scale },
  { tipo: 'baja', titulo: 'Baja', ayuda: 'Cerdos que murieron', icon: Skull }
];

const CAUSAS_BAJA = ['Neumonía', 'Diarrea', 'Aplastado', 'Pelea', 'No se sabe'];

const CAMPO = 'w-full h-14 px-4 rounded-ds-md border border-line-strong bg-surface-raised text-ink text-[17px] font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/30';
const ETIQUETA = 'block type-label uppercase text-ink-muted mb-1.5';

const leerNombreGuardado = () => {
  try { return window.localStorage.getItem(CLAVE_NOMBRE) || ''; } catch { return ''; }
};
const guardarNombre = (nombre) => {
  try {
    if (nombre) window.localStorage.setItem(CLAVE_NOMBRE, nombre);
    else window.localStorage.removeItem(CLAVE_NOMBRE);
  } catch { /* almacenamiento no disponible */ }
};

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

function useDocumento(ref) {
  const [estado, setEstado] = useState({ datos: null, listo: false });
  useEffect(() => onSnapshot(
    ref,
    (snap) => setEstado({ datos: snap.exists() ? snap.data() : null, listo: true }),
    () => setEstado({ datos: null, listo: true })
  ), [ref]);
  return estado;
}

function useCapturasDeHoy(hoy) {
  const [capturas, setCapturas] = useState([]);
  useEffect(() => {
    const inicioDelDia = new Date(`${hoy}T00:00:00`).getTime();
    const consulta = query(colCapturas(db, APP_ID_GRANJA), where('creadaEn', '>=', inicioDelDia), orderBy('creadaEn', 'desc'));
    return onSnapshot(
      consulta,
      { includeMetadataChanges: true },
      (snap) => setCapturas(snap.docs.map((d) => ({ id: d.id, ...d.data(), sinEnviar: d.metadata.hasPendingWrites }))),
      () => setCapturas([])
    );
  }, [hoy]);
  return capturas;
}

// --- Piezas de interfaz --------------------------------------------------------

function PantallaCentrada({ children }) {
  return (
    <div className="min-h-dvh bg-sidebar text-sidebar-ink flex flex-col items-center justify-center px-5 py-8">
      <img src={marcaGuerraFarm} alt="Guerra Farm" className="h-20 w-auto mb-4" />
      <h1 className="type-title text-sidebar-ink">Porcicontrol</h1>
      <p className="type-label uppercase text-wheat mt-1 mb-6">Registro de granja</p>
      <div className="w-full max-w-sm bg-surface-raised text-ink rounded-ds-lg shadow-pop p-5">{children}</div>
    </div>
  );
}

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

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setError('');
    setEntrando(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const credencialMala = ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password', 'auth/invalid-email'].includes(err?.code);
      setError(credencialMala
        ? 'Correo o contraseña incorrectos.'
        : err?.code === 'auth/network-request-failed'
          ? 'No hay internet. Conectate para entrar la primera vez.'
          : 'No se pudo entrar. Probá de nuevo.');
    } finally {
      setEntrando(false);
    }
  };

  return (
    <PantallaCentrada>
      <form onSubmit={entrar} className="space-y-4">
        <h2 className="type-heading">Entrar</h2>
        {error && <Aviso tono="danger">{error}</Aviso>}
        <div>
          <label htmlFor="emp-correo" className={ETIQUETA}>Correo de la granja</label>
          <input id="emp-correo" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="emp-clave" className={ETIQUETA}>Contraseña</label>
          <input id="emp-clave" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={CAMPO} />
        </div>
        <BotonPrincipal type="submit" disabled={entrando}>{entrando ? 'Entrando…' : 'Entrar'}</BotonPrincipal>
      </form>
    </PantallaCentrada>
  );
}

function SinAcceso({ estado, user }) {
  const mensajes = {
    [ROL.pendiente]: {
      titulo: 'Cuenta sin autorizar',
      texto: 'Esta cuenta todavía no está aprobada. Pedile al encargado que la autorice en Porcicontrol, sección Empleados.'
    },
    'sin-conexion': {
      titulo: 'Hace falta internet',
      texto: 'Conectate una vez para comprobar el acceso de esta cuenta. Después vas a poder registrar sin señal.'
    },
    'sin-reglas': {
      titulo: 'Falta configurar la granja',
      texto: 'El encargado todavía no publicó los permisos de la granja (reglas de Firestore).'
    },
    error: {
      titulo: 'No se pudo comprobar el acceso',
      texto: 'Revisá la conexión y volvé a abrir la app.'
    }
  };
  const { titulo, texto } = mensajes[estado] || mensajes.error;
  return (
    <PantallaCentrada>
      <div className="space-y-4">
        <h2 className="type-heading">{titulo}</h2>
        <p className="type-body text-ink-muted">{texto}</p>
        <p className="type-small text-ink-muted break-all">Cuenta: {user.email}</p>
        <button type="button" onClick={() => signOut(auth)} className="w-full h-12 rounded-ds-md border border-line-strong type-strong flex items-center justify-center gap-2">
          <LogOut size={16} aria-hidden="true" /> Salir
        </button>
      </div>
    </PantallaCentrada>
  );
}

function ElegirNombre({ nombres, onElegir }) {
  const [texto, setTexto] = useState('');
  return (
    <PantallaCentrada>
      <div className="space-y-4">
        <div>
          <h2 className="type-heading">¿Quién sos?</h2>
          <p className="type-body text-ink-muted mt-1">Tu nombre queda en cada registro que hagás.</p>
        </div>
        {nombres.length > 0 ? (
          <div className="space-y-2.5">
            {nombres.map((nombre) => (
              <button key={nombre} type="button" onClick={() => onElegir(nombre)} className="w-full min-h-14 px-4 rounded-ds-md border border-line-strong bg-surface-raised text-[17px] font-bold text-left flex items-center gap-3 hover:bg-surface-sunken">
                <UserRound size={20} aria-hidden="true" className="text-primary" /> {nombre}
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); if (texto.trim()) onElegir(texto.trim()); }} className="space-y-3">
            <div>
              <label htmlFor="emp-nombre" className={ETIQUETA}>Tu nombre</label>
              <input id="emp-nombre" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={60} required className={CAMPO} />
            </div>
            <BotonPrincipal type="submit">Continuar</BotonPrincipal>
          </form>
        )}
      </div>
    </PantallaCentrada>
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
  if (tipo === 'peso') return { pesos: [''], nota: '' };
  return { cantidad: '1', causa: '', nota: '' };
};

const OTRO = '__otro__';

function Formulario({ accion, catalogo, hoy, empleado, uid, onGuardado, onVolver }) {
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

  const pesosValidos = tipo === 'peso' ? datos.pesos.map((p) => parseFloat(String(p).replace(',', '.'))).filter((p) => p > 0) : [];
  const promedio = pesosValidos.length > 0 ? pesosValidos.reduce((s, p) => s + p, 0) / pesosValidos.length : 0;

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
    const ref = doc(colCapturas(db, APP_ID_GRANJA));
    setDoc(ref, resultado.captura).catch((err) => console.error('No se pudo guardar la captura:', err));
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

      {tipo === 'peso' && (
        <div>
          <span className={ETIQUETA}>Peso de cada cerdo (libras)</span>
          <div className="space-y-2.5">
            {datos.pesos.map((peso, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-8 type-data text-ink-muted text-right">{idx + 1}.</span>
                <input
                  aria-label={`Peso del cerdo ${idx + 1} en libras`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={peso}
                  placeholder="0"
                  onChange={(e) => cambiar({ pesos: datos.pesos.map((p, i) => (i === idx ? e.target.value : p)) })}
                  className={`${CAMPO} font-data text-[20px]`}
                />
                {datos.pesos.length > 1 && (
                  <button type="button" aria-label={`Quitar el cerdo ${idx + 1}`} onClick={() => cambiar({ pesos: datos.pesos.filter((_, i) => i !== idx) })} className="h-14 w-12 shrink-0 rounded-ds-md border border-line-strong bg-surface-raised flex items-center justify-center text-danger">
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => cambiar({ pesos: [...datos.pesos, ''] })} className="mt-3 w-full h-12 rounded-ds-md border border-dashed border-line-strong type-strong flex items-center justify-center gap-2">
            <Plus size={18} aria-hidden="true" /> Pesar otro cerdo
          </button>
          {pesosValidos.length > 0 && (
            <p className="mt-3 type-body text-ink-muted">
              Promedio: <span className="type-data-lg text-ink">{promedio.toFixed(1)} lb</span> · {pesosValidos.length} {pesosValidos.length === 1 ? 'cerdo' : 'cerdos'}
            </p>
          )}
        </div>
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
          <BotonPrincipal type="submit"><Check size={22} aria-hidden="true" /> Guardar</BotonPrincipal>
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

function FilaCaptura({ captura }) {
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
            <span>{captura.empleado} · {horaCorta(captura.creadaEn)}</span>
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
          <button type="button" onClick={() => deleteDoc(doc(colCapturas(db, APP_ID_GRANJA), captura.id)).catch(() => undefined)} className="h-11 px-4 rounded-ds-md bg-danger text-surface-raised type-strong">Sí, borrar</button>
        </div>
      )}
    </li>
  );
}

function Inicio({ empleado, hoy, capturas, catalogoListo, hayCorrales, onAccion }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="type-small text-ink-muted">{fechaLarga(hoy)}</p>
        <h1 className="type-title text-ink">Hola, {empleado}</h1>
      </div>

      {catalogoListo && !hayCorrales && (
        <Aviso>Todavía no hay corrales publicados. El encargado tiene que abrir Porcicontrol con internet una vez.</Aviso>
      )}

      <section aria-labelledby="emp-registrar">
        <h2 id="emp-registrar" className="type-label uppercase text-ink-muted mb-2">¿Qué vas a registrar?</h2>
        <div className="grid grid-cols-2 gap-3">
          {ACCIONES.map((accion, idx) => (
            <button
              key={accion.tipo}
              type="button"
              disabled={!hayCorrales}
              onClick={() => onAccion(accion)}
              className={`min-h-[6.5rem] p-4 rounded-ds-lg border shadow-card text-left flex flex-col justify-between gap-3 disabled:opacity-50 transition-colors ${idx === 0 ? 'col-span-2 bg-primary text-on-primary border-primary hover:bg-primary-hover' : 'bg-surface-raised text-ink border-line hover:border-primary'}`}
            >
              <accion.icon size={28} aria-hidden="true" className={idx === 0 ? 'text-wheat' : 'text-primary'} />
              <span>
                <span className="block text-[18px] font-bold leading-tight">{accion.titulo}</span>
                <span className={`block type-small mt-0.5 ${idx === 0 ? 'text-forest-200' : 'text-ink-muted'}`}>{accion.ayuda}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="emp-hoy">
        <h2 id="emp-hoy" className="type-label uppercase text-ink-muted mb-2">Registrado hoy</h2>
        <div className="rounded-ds-lg border border-line bg-surface-raised shadow-card">
          {capturas.length === 0 ? (
            <p className="px-4 py-6 type-body text-ink-muted text-center">Todavía no hay registros hoy.</p>
          ) : (
            <ul className="divide-y divide-line">
              {capturas.map((captura) => <FilaCaptura key={captura.id} captura={captura} />)}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

// --- App -------------------------------------------------------------------------

function Registro({ user }) {
  const hoy = useHoy();
  const enLinea = useEnLinea();
  const refCatalogo = useMemo(() => refCatalogoEmpleados(db, APP_ID_GRANJA), []);
  const refNombres = useMemo(() => refPersonal(db, APP_ID_GRANJA), []);
  const { datos: catalogoCrudo, listo: catalogoListo } = useDocumento(refCatalogo);
  const { datos: personal, listo: personalListo } = useDocumento(refNombres);
  const capturas = useCapturasDeHoy(hoy);

  const [empleado, setEmpleado] = useState(leerNombreGuardado);
  const [accion, setAccion] = useState(null);
  const [mensaje, setMensaje] = useState('');

  const catalogo = useMemo(() => ({
    corrales: Array.isArray(catalogoCrudo?.corrales) ? catalogoCrudo.corrales : [],
    concentrados: Array.isArray(catalogoCrudo?.concentrados) ? catalogoCrudo.concentrados : [],
    medicamentos: Array.isArray(catalogoCrudo?.medicamentos) ? catalogoCrudo.medicamentos : [],
    insumos: Array.isArray(catalogoCrudo?.insumos) ? catalogoCrudo.insumos : []
  }), [catalogoCrudo]);
  const nombres = useMemo(() => (Array.isArray(personal?.nombres) ? personal.nombres.filter(Boolean) : []), [personal]);
  const sinEnviar = capturas.filter((c) => c.sinEnviar).length;

  useEffect(() => {
    if (!mensaje) return undefined;
    const temporizador = setTimeout(() => setMensaje(''), 4000);
    return () => clearTimeout(temporizador);
  }, [mensaje]);

  const elegirEmpleado = (nombre) => {
    guardarNombre(nombre);
    setEmpleado(nombre);
  };

  if (!empleado) {
    if (!personalListo) return <Cargando />;
    return <ElegirNombre nombres={nombres} onElegir={elegirEmpleado} />;
  }

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <header className="sticky top-0 z-30 bg-sidebar text-sidebar-ink pt-[env(safe-area-inset-top)]">
        <div className="max-w-xl mx-auto h-14 px-4 flex items-center gap-3">
          <img src={marcaGuerraFarm} alt="" className="h-9 w-auto" />
          <button type="button" onClick={() => { setAccion(null); elegirEmpleado(''); }} className="flex-1 h-11 flex items-center gap-2 text-left" aria-label={`Registrando como ${empleado}. Cambiar de persona`}>
            <UserRound size={18} aria-hidden="true" className="text-wheat" />
            <span className="type-strong truncate">{empleado}</span>
            <span className="type-small text-sidebar-muted underline underline-offset-2">cambiar</span>
          </button>
          <button type="button" onClick={() => signOut(auth)} aria-label="Cerrar sesión" className="h-11 w-11 rounded-ds-md flex items-center justify-center hover:bg-sidebar-active">
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
        {accion ? (
          <Formulario
            key={accion.tipo}
            accion={accion}
            catalogo={catalogo}
            hoy={hoy}
            empleado={empleado}
            uid={user.uid}
            onVolver={() => setAccion(null)}
            onGuardado={(captura) => {
              setAccion(null);
              setMensaje(`Guardado: ${captura.corralNombre} · ${describirCaptura(captura)}`);
              window.scrollTo({ top: 0 });
            }}
          />
        ) : (
          <Inicio
            empleado={empleado}
            hoy={hoy}
            capturas={capturas}
            catalogoListo={catalogoListo}
            hayCorrales={catalogo.corrales.some((c) => c.loteId)}
            onAccion={setAccion}
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

function Cargando() {
  return (
    <div className="min-h-dvh bg-sidebar text-sidebar-ink flex flex-col items-center justify-center">
      <img src={marcaGuerraFarm} alt="Guerra Farm" className="h-20 w-auto mb-4" />
      <p className="type-strong">Cargando…</p>
    </div>
  );
}

export default function EmpleadosApp() {
  const [sesion, setSesion] = useState({ user: null, lista: false });
  useEffect(() => onAuthStateChanged(auth, (user) => setSesion({ user, lista: true })), []);
  const acceso = useAcceso(db, APP_ID_GRANJA, sesion.user);

  if (!sesion.lista) return <Cargando />;
  if (!sesion.user) return <Login />;
  if (acceso.estado === 'cargando') return <Cargando />;
  if (acceso.estado !== ROL.empleado && acceso.estado !== ROL.admin) {
    return <SinAcceso estado={acceso.estado} user={sesion.user} />;
  }
  return <Registro user={sesion.user} />;
}
