import { useEffect, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle, Inbox, Package, Scale, ShieldCheck,
  Skull, Syringe, Trash2, UserRound, Wheat, X, XCircle
} from 'lucide-react';
import { deleteDoc, limit, onSnapshot, orderBy, query, runTransaction, setDoc, writeBatch } from 'firebase/firestore';
import { rechazarRegistro } from './revisionRegistros.js';
import { Button, Card, EmptyState } from '../design-system/primitives.jsx';
import { ESTADO_CAPTURA, ETIQUETA_TIPO, describirCaptura } from '../domain/capturasEmpleado.js';
import { ROL, colCapturas, colInvitaciones, refInvitacion, colMiembros, refMiembro, resolverRol, mensajeFirestore } from './accesos.js';

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
            <Button variant="primary" type="submit" disabled={ocupado} className="flex-1 sm:flex-none">Confirmar rechazo</Button>
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

function Bandeja({ db, appId, user, pendientes, errorPendientes, cargandoPendientes, onAplicar }) {
  const [errores, setErrores] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [recientes, setRecientes] = useState([]);

  useEffect(() => onSnapshot(
    query(colCapturas(db, appId), orderBy('creadaEn', 'desc'), limit(40)),
    (snap) => setRecientes(snap.docs.map((d) => ({ ...d.data(), id: d.id })).filter((c) => c.estado !== ESTADO_CAPTURA.pendiente)),
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
        }
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

  const rechazar = async (captura, motivo) => {
    setOcupado(true);
    try {
      await rechazarRegistro(db, appId, user, captura.id, motivo);
    } catch {
      setErrores((prev) => ({ ...prev, [captura.id]: 'No se pudo rechazar. Revisá la conexión y el estado del registro.' }));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Card
      title="Bandeja de registros"
      subtitle="Revisá los registros por corral. Al aprobar se actualiza el consumo o la cantidad de cerdos del lote."
      actions={pendientes.length > 1 && (
        <Button variant="primary" icon={CheckCircle} disabled={ocupado} onClick={() => aprobar(pendientes)} className="shrink-0">
          Aprobar todo ({pendientes.length})
        </Button>
      )}
    >
      {errorPendientes ? <p role="alert" className="px-4 pb-4 text-danger">{errorPendientes}</p>
       : cargandoPendientes ? <p role="status" className="px-4 pb-4">Cargando registros…</p>
       : pendientes.length === 0 ? (
        <EmptyState icon={Inbox} title="No hay registros por revisar">
          Cuando un empleado envíe un registro, aparece aquí.
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

const ETIQUETA_ROL = { [ROL.admin]: 'Administrador', [ROL.empleado]: 'Empleado', [ROL.pendiente]: 'Pendiente' };

function Cuentas({ db, appId, user }) {
  const [miembros, setMiembros] = useState(null);
  const [errorLista, setErrorLista] = useState('');
  const [correo, setCorreo] = useState('');
  const [invitaciones, setInvitaciones] = useState([]);
  useEffect(() => onSnapshot(colInvitaciones(db, appId),
    snap => setInvitaciones(snap.docs.map(d => d.id)),
    err => setErrorLista(mensajeFirestore(err, 'leer las autorizaciones por correo'))
  ), [db, appId]);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  useEffect(() => onSnapshot(
    colMiembros(db, appId),
    (snap) => setMiembros(
      snap.docs
        .map((d) => ({ ...d.data(), uid: d.id, rol: resolverRol(d.data()) }))
        .sort((a, b) => (a.rol === ROL.pendiente ? -1 : 0) - (b.rol === ROL.pendiente ? -1 : 0) || String(a.email || '').localeCompare(String(b.email || '')))
    ),
    (err) => { setMiembros([]); setErrorLista(mensajeFirestore(err, 'listar las cuentas')); }
  ), [db, appId]);

  const ejecutar = async (operacion, exito) => {
    if (guardando) return;
    setError('');
    setAviso('');
    setGuardando(true);
    try {
      await operacion();
      setAviso(exito);
    } catch (err) {
      setError(err.code ? mensajeFirestore(err, 'actualizar el acceso') : err.message);
    } finally {
      setGuardando(false);
    }
  };
  const actualizar = async (m, cambios) => {
    const batch = writeBatch(db);
    const ref = refMiembro(db, appId, m.uid);
    if (cambios) batch.update(ref, { ...cambios, revisadoEn: Date.now(), revisadoPorUid: user.uid });
    else batch.delete(ref);
    if (m.email) batch.delete(refInvitacion(db, appId, m.email));
    await batch.commit();
  };
  const cambiar = (m, cambios) => ejecutar(() => actualizar(m, cambios), 'Acceso actualizado.');
  const borrar = m => ejecutar(() => actualizar(m, null), 'Solicitud descartada.');
  const autorizarCorreo = event => {
    event.preventDefault();
    const email = correo.trim().toLowerCase();
    const m = miembros?.find(c => c.email?.toLowerCase() === email);
    ejecutar(async () => {
      if (!m) {
        await setDoc(refInvitacion(db, appId, email), { autorizadoPor: user.uid, creadoEn: Date.now() });
      } else {
        const ref = refMiembro(db, appId, m.uid);
        await runTransaction(db, async tx => {
          const snap = await tx.get(ref);
          if (!snap.exists()) throw Error('La solicitud ya no existe. Actualizá la lista.');
          if (resolverRol(snap.data()) === ROL.admin) throw Error('Esta cuenta ya es administradora.');
          tx.update(ref, { active: true, role: ROL.empleado, revisadoEn: Date.now(), revisadoPorUid: user.uid });
          tx.delete(refInvitacion(db, appId, email));
        });
      }
      setCorreo('');
    }, m ? 'Acceso de empleado autorizado para ' + email : 'Autorización preparada. El empleado puede activarla al ingresar con ese correo.');
  };

  return (
    <Card title="Cuentas y solicitudes de acceso" subtitle="Aprobá una solicitud de la lista o autorizá por correo a un empleado que ya tiene cuenta.">
      <fieldset disabled={guardando}>
        <form onSubmit={autorizarCorreo} className="px-4 pb-4 space-y-2">
          <label htmlFor="correo-empleado" className="type-strong">Correo del empleado</label>
          <div className="flex flex-wrap gap-2">
            <input id="correo-empleado" type="email" required value={correo} onChange={e => setCorreo(e.target.value)} className={CAMPO + ' flex-1 min-w-0'} />
            <Button type="submit" disabled={!miembros || !!errorLista} variant="primary" icon={UserRound}>Autorizar empleado</Button>
          </div>
        </form>
        {invitaciones.map(email => <div key={email} className="px-4 py-2 flex justify-between items-center">
          <span className="type-small">Pendiente de activación · {email}</span>
          <Button variant="quiet" onClick={() => ejecutar(() => deleteDoc(refInvitacion(db, appId, email)), 'Autorización retirada.')}>Retirar</Button>
        </div>)}
        {aviso && <p role="status" className="px-4 pb-3 text-success">{aviso}</p>}
        {error && <p role="alert" className="px-4 pb-3 text-danger">{error}</p>}
        {errorLista ? <p role="alert" className="px-4 pb-3 text-danger">{errorLista}</p>
          : !miembros ? <p role="status" className="px-4 pb-3">Cargando cuentas…</p>
          : !miembros.some(m => m.rol === ROL.pendiente) && <p className="px-4 pb-3 type-small text-ink-muted">Sin solicitudes pendientes.</p>}
        <ul className="divide-y divide-line border-t border-line">
          {miembros?.map((m) => {
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
                      <Button variant={m.rol === ROL.pendiente ? 'primary' : 'secondary'} icon={UserRound} onClick={() => cambiar(m, { active: true, role: ROL.empleado })}>
                        {m.rol === ROL.pendiente ? 'Aprobar como empleado' : 'Pasar a empleado'}
                      </Button>
                    )}
                    {m.rol !== ROL.admin && (
                      <Button variant="secondary" icon={ShieldCheck} onClick={() => cambiar(m, { active: true, role: ROL.admin })}>
                        {m.rol === ROL.pendiente ? 'Aprobar como admin' : 'Hacer admin'}
                      </Button>
                    )}
                    {m.rol === ROL.pendiente
                      ? <Button variant="quiet" icon={Trash2} onClick={() => borrar(m)}>Descartar</Button>
                      : <Button variant="quiet" icon={X} onClick={() => cambiar(m, { active: false, role: ROL.pendiente })}>Quitar acceso</Button>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>
    </Card>
  );
}

export default function PanelEmpleados({ db, publicacion, appId, user, pendientes, errorPendientes, cargandoPendientes, onAplicar }) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      {publicacion && <Card title="Catálogo de corrales" actions={<Button disabled={publicacion.ocupado} onClick={publicacion.publicar}>Publicar catálogo</Button>}>
        <p role="status" className="px-4 pb-4 type-small">{publicacion.mensaje}</p>
      </Card>}
      <Cuentas db={db} appId={appId} user={user} />
      <Bandeja errorPendientes={errorPendientes} cargandoPendientes={cargandoPendientes} db={db} appId={appId} user={user} pendientes={pendientes} onAplicar={onAplicar} />
    </div>
  );
}
