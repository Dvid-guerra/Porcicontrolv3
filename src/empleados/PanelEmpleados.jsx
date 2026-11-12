import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle, Copy, Inbox, Package, Plus, Scale, ShieldCheck,
  Skull, Syringe, Trash2, UserRound, Wheat, X, XCircle
} from 'lucide-react';
import { deleteDoc, doc, limit, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { Button, Card, EmptyState } from '../design-system/primitives.jsx';
import { ESTADO_CAPTURA, ETIQUETA_TIPO, describirCaptura } from '../domain/capturasEmpleado.js';
import { ROL, colCapturas, colMiembros, refMiembro, refPersonal, resolverRol } from './accesos.js';

const ICONO_TIPO = { concentrado: Wheat, medicamento: Syringe, insumo: Package, peso: Scale, baja: Skull };
const CAMPO = 'h-11 px-3 rounded-ds-md border border-line-strong bg-surface-raised text-ink type-body outline-none focus:border-primary';

const fechaCorta = (iso) => {
  if (!iso) return '';
  const [, mes, dia] = String(iso).split('-');
  return `${dia}/${mes}`;
};
const cuando = (ms) => (ms
  ? new Date(ms).toLocaleString('es-GT', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
  : '');

function FilaPendiente({ captura, error, ocupado, onAprobar, onRechazar }) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const Icono = ICONO_TIPO[captura.tipo] || Package;

  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <span className="h-10 w-10 shrink-0 rounded-ds-md bg-primary-soft text-on-primary-soft flex items-center justify-center">
            <Icono size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="type-strong text-ink">{captura.corralNombre} · {ETIQUETA_TIPO[captura.tipo] || captura.tipo}</p>
            <p className="type-body text-ink">{describirCaptura(captura)}</p>
            <p className="type-small text-ink-muted mt-0.5">
              {captura.empleado || 'Sin nombre'} · fecha {fechaCorta(captura.fecha)} · enviado {cuando(captura.creadaEn)}
            </p>
            {captura.nota && <p className="type-small text-ink-muted mt-0.5">Nota: {captura.nota}</p>}
          </div>
        </div>
        {!rechazando && (
          <div className="flex gap-2 sm:shrink-0">
            <Button variant="secondary" icon={X} disabled={ocupado} onClick={() => setRechazando(true)} className="flex-1 sm:flex-none">Rechazar</Button>
            <Button variant="primary" icon={Check} disabled={ocupado} onClick={() => onAprobar(captura)} className="flex-1 sm:flex-none">Aprobar</Button>
          </div>
        )}
      </div>

      {rechazando && (
        <form
          className="mt-3 flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => { e.preventDefault(); onRechazar(captura, motivo.trim()); }}
        >
          <input
            aria-label="Motivo del rechazo (lo ve el empleado)"
            placeholder="Motivo (lo ve el empleado), opcional"
            value={motivo}
            maxLength={200}
            onChange={(e) => setMotivo(e.target.value)}
            className={`${CAMPO} flex-1`}
          />
          <div className="flex gap-2">
            <Button variant="quiet" onClick={() => setRechazando(false)} className="flex-1 sm:flex-none">Cancelar</Button>
            <Button variant="primary" type="submit" className="flex-1 sm:flex-none">Confirmar rechazo</Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2.5 flex items-start gap-2 rounded-ds-md border border-danger bg-danger-soft text-danger px-3 py-2 type-small">
          <AlertTriangle size={14} aria-hidden="true" className="mt-0.5" /> {error}
        </p>
      )}
    </li>
  );
}

function Bandeja({ db, appId, user, pendientes, onAplicar }) {
  const [errores, setErrores] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [recientes, setRecientes] = useState([]);
  const quien = user?.displayName || user?.email || 'Administrador';

  useEffect(() => onSnapshot(
    query(colCapturas(db, appId), orderBy('creadaEn', 'desc'), limit(40)),
    (snap) => setRecientes(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.estado !== ESTADO_CAPTURA.pendiente)),
    () => setRecientes([])
  ), [db, appId]);

  const aprobar = async (lista) => {
    if (ocupado || lista.length === 0) return;
    setOcupado(true);
    try {
      const resultados = await onAplicar(lista);
      const nuevosErrores = {};
      resultados.forEach((r) => {
        if (!r.ok) {
          nuevosErrores[r.capturaId] = r.error || 'No se pudo aplicar.';
          return;
        }
        // No se espera al servidor: sin señal, el cambio queda en cola local.
        updateDoc(doc(colCapturas(db, appId), r.capturaId), {
          estado: ESTADO_CAPTURA.aplicada,
          revisadaEn: Date.now(),
          revisadaPor: quien,
          registroId: r.registroId || ''
        }).catch((err) => console.warn('No se pudo marcar la captura como aplicada:', err?.code || err));
      });
      setErrores((previos) => {
        const limpio = { ...previos };
        lista.forEach((c) => { delete limpio[c.id]; });
        return { ...limpio, ...nuevosErrores };
      });
    } catch (err) {
      const mensaje = 'No se pudo guardar en la nube. Revisá la conexión y probá de nuevo.';
      console.error('Error al aplicar capturas de empleados:', err);
      setErrores((previos) => ({ ...previos, ...Object.fromEntries(lista.map((c) => [c.id, mensaje])) }));
    } finally {
      setOcupado(false);
    }
  };

  const rechazar = (captura, motivo) => {
    updateDoc(doc(colCapturas(db, appId), captura.id), {
      estado: ESTADO_CAPTURA.rechazada,
      motivoRechazo: motivo,
      revisadaEn: Date.now(),
      revisadaPor: quien
    }).catch((err) => console.warn('No se pudo rechazar la captura:', err?.code || err));
  };

  return (
    <Card
      title="Bandeja de registros"
      subtitle="Lo que anotaron los empleados. Al aprobar se descuenta de bodega y se carga el costo al lote."
      actions={pendientes.length > 1 && (
        <Button variant="primary" icon={CheckCircle} disabled={ocupado} onClick={() => aprobar(pendientes)} className="shrink-0">
          Aprobar todo ({pendientes.length})
        </Button>
      )}
    >
      {pendientes.length === 0 ? (
        <EmptyState icon={Inbox} title="No hay registros por revisar">
          Cuando un empleado guarde algo en su app, aparece aquí.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {pendientes.map((captura) => (
            <FilaPendiente
              key={captura.id}
              captura={captura}
              error={errores[captura.id]}
              ocupado={ocupado}
              onAprobar={(c) => aprobar([c])}
              onRechazar={rechazar}
            />
          ))}
        </ul>
      )}

      {recientes.length > 0 && (
        <details className="border-t border-line">
          <summary className="px-4 py-3 type-strong text-ink-muted cursor-pointer">Ya revisados ({recientes.length} más recientes)</summary>
          <ul className="divide-y divide-line border-t border-line">
            {recientes.map((captura) => {
              const aprobada = captura.estado === ESTADO_CAPTURA.aplicada;
              return (
                <li key={captura.id} className="px-4 py-2.5 flex items-start gap-3">
                  {aprobada
                    ? <CheckCircle size={16} aria-hidden="true" className="text-success mt-0.5" />
                    : <XCircle size={16} aria-hidden="true" className="text-danger mt-0.5" />}
                  <div className="flex-1">
                    <p className="type-body text-ink">{captura.corralNombre} · {ETIQUETA_TIPO[captura.tipo] || captura.tipo} · {describirCaptura(captura)}</p>
                    <p className="type-small text-ink-muted">
                      {captura.empleado || 'Sin nombre'} · {fechaCorta(captura.fecha)} · {aprobada ? 'aprobado' : 'rechazado'} por {captura.revisadaPor || '—'}
                      {!aprobada && captura.motivoRechazo ? ` · ${captura.motivoRechazo}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </Card>
  );
}

function Personal({ db, appId }) {
  const [nombres, setNombres] = useState([]);
  const [nuevo, setNuevo] = useState('');
  const ref = useMemo(() => refPersonal(db, appId), [db, appId]);

  useEffect(() => onSnapshot(
    ref,
    (snap) => setNombres(Array.isArray(snap.data()?.nombres) ? snap.data().nombres : []),
    () => setNombres([])
  ), [ref]);

  const guardar = (lista) => setDoc(ref, { nombres: lista, actualizadoEn: Date.now() })
    .catch((err) => console.warn('No se pudo guardar el personal:', err?.code || err));

  const agregar = (e) => {
    e.preventDefault();
    const nombre = nuevo.trim().slice(0, 60);
    if (!nombre || nombres.some((n) => n.toLowerCase() === nombre.toLowerCase())) return;
    guardar([...nombres, nombre]);
    setNuevo('');
  };

  return (
    <Card title="Personal de la granja" subtitle="Los nombres que cada empleado elige al abrir su app. Así sabés quién anotó cada cosa.">
      <div className="px-4 pb-4 space-y-3">
        {nombres.length === 0 ? (
          <p className="type-body text-ink-muted">Todavía no hay nombres. Sin lista, cada quien escribe el suyo.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {nombres.map((nombre) => (
              <li key={nombre} className="inline-flex items-center gap-1.5 h-10 pl-3 pr-1 rounded-full border border-line-strong bg-surface-raised type-strong">
                <UserRound size={14} aria-hidden="true" className="text-ink-muted" /> {nombre}
                <button type="button" aria-label={`Quitar a ${nombre}`} onClick={() => guardar(nombres.filter((n) => n !== nombre))} className="h-8 w-8 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface-sunken">
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={agregar} className="flex gap-2">
          <input aria-label="Nombre del empleado" placeholder="Nombre del empleado" value={nuevo} maxLength={60} onChange={(e) => setNuevo(e.target.value)} className={`${CAMPO} flex-1`} />
          <Button variant="secondary" icon={Plus} type="submit">Agregar</Button>
        </form>
      </div>
    </Card>
  );
}

const ETIQUETA_ROL = { [ROL.admin]: 'Administrador', [ROL.empleado]: 'Empleados', [ROL.pendiente]: 'Pendiente' };

function Cuentas({ db, appId, user }) {
  const [miembros, setMiembros] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => onSnapshot(
    colMiembros(db, appId),
    (snap) => setMiembros(
      snap.docs
        .map((d) => ({ uid: d.id, ...d.data(), rol: resolverRol(d.data()) }))
        .sort((a, b) => (a.rol === ROL.pendiente ? -1 : 0) - (b.rol === ROL.pendiente ? -1 : 0) || String(a.email || '').localeCompare(String(b.email || '')))
    ),
    () => setMiembros([])
  ), [db, appId]);

  const cambiar = (uid, cambios) => {
    setError('');
    updateDoc(refMiembro(db, appId, uid), { ...cambios, revisadoEn: Date.now() })
      .catch(() => setError('No se pudo cambiar el acceso. Revisá la conexión.'));
  };
  const borrar = (uid) => {
    setError('');
    deleteDoc(refMiembro(db, appId, uid)).catch(() => setError('No se pudo borrar la solicitud.'));
  };

  return (
    <Card title="Cuentas con acceso" subtitle="Quien no esté aprobado aquí no puede ver ni escribir nada, aunque cree una cuenta.">
      {error && <p role="alert" className="mx-4 mb-3 rounded-ds-md border border-danger bg-danger-soft text-danger px-3 py-2 type-small">{error}</p>}
      <ul className="divide-y divide-line border-t border-line">
        {miembros.map((m) => {
          const esYo = m.uid === user?.uid;
          return (
            <li key={m.uid} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="flex-1">
                <p className="type-strong text-ink break-all">{m.email || m.nombre || m.uid}{esYo ? ' (vos)' : ''}</p>
                <p className={`type-small ${m.rol === ROL.pendiente ? 'text-warning' : 'text-ink-muted'}`}>
                  {m.rol === ROL.pendiente ? 'Pidió acceso — sin aprobar' : ETIQUETA_ROL[m.rol]}
                </p>
              </div>
              {!esYo && (
                <div className="flex flex-wrap gap-2">
                  {m.rol !== ROL.empleado && (
                    <Button variant={m.rol === ROL.pendiente ? 'primary' : 'secondary'} icon={UserRound} onClick={() => cambiar(m.uid, { active: true, role: ROL.empleado })}>
                      {m.rol === ROL.pendiente ? 'Aprobar como empleados' : 'Pasar a empleados'}
                    </Button>
                  )}
                  {m.rol !== ROL.admin && (
                    <Button variant="secondary" icon={ShieldCheck} onClick={() => cambiar(m.uid, { active: true, role: ROL.admin })}>
                      {m.rol === ROL.pendiente ? 'Aprobar como admin' : 'Hacer admin'}
                    </Button>
                  )}
                  {m.rol === ROL.pendiente
                    ? <Button variant="quiet" icon={Trash2} onClick={() => borrar(m.uid)}>Descartar</Button>
                    : <Button variant="quiet" icon={X} onClick={() => cambiar(m.uid, { active: false, role: ROL.pendiente })}>Quitar acceso</Button>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ComoFunciona({ urlEmpleados }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(urlEmpleados);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* portapapeles no disponible */ }
  };
  return (
    <Card title="App de empleados">
      <div className="px-4 pb-4 space-y-3 type-body text-ink-muted">
        <p>
          Es un sitio aparte donde solo se registra concentrado, medicamentos, insumos, pesajes y bajas.
          No muestra precios, costos, ventas ni finanzas.
        </p>
        {urlEmpleados ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 h-11 px-3 flex items-center rounded-ds-md bg-surface-sunken text-ink type-data overflow-x-auto whitespace-nowrap">{urlEmpleados}</code>
            <Button variant="secondary" icon={copiado ? Check : Copy} onClick={copiar}>{copiado ? 'Copiado' : 'Copiar enlace'}</Button>
          </div>
        ) : (
          <p>Cuando la publiques, poné su dirección en la variable <code className="type-data text-ink">VITE_URL_APP_EMPLEADOS</code> para verla aquí.</p>
        )}
        <ol className="list-decimal pl-5 space-y-1">
          <li>Creá una cuenta para la granja (correo y contraseña) desde la pantalla de registro.</li>
          <li>Aprobala abajo como <strong className="text-ink">empleados</strong>.</li>
          <li>Entrá con esa cuenta en el teléfono de la granja y agregá los nombres del personal.</li>
        </ol>
      </div>
    </Card>
  );
}

// Vista "Empleados" de la app principal.
export default function PanelEmpleados({ db, appId, user, pendientes, onAplicar, urlEmpleados = '' }) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      <Bandeja db={db} appId={appId} user={user} pendientes={pendientes} onAplicar={onAplicar} />
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <Personal db={db} appId={appId} />
        <ComoFunciona urlEmpleados={urlEmpleados} />
      </div>
      <Cuentas db={db} appId={appId} user={user} />
    </div>
  );
}
