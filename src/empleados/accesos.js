import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, runTransaction } from 'firebase/firestore';

export const ROL = { admin: 'admin', empleado: 'empleado', pendiente: 'pendiente' };

export function mensajeFirestore(err, accion) {
  if (err?.code === 'permission-denied') return 'Firebase denegó el permiso para ' + accion + '. Revisá las reglas publicadas y el rol de la cuenta.';
  return 'No se pudo ' + accion + '. Revisá la conexión y volvé a intentar.';
}

export const refMiembro = (db, appId, uid) => doc(db, 'artifacts', appId, 'members', uid);
export const colInvitaciones = (db, appId) => collection(db, 'artifacts', appId, 'invitaciones');
export const refInvitacion = (db, appId, email) => doc(colInvitaciones(db, appId), email.trim().toLowerCase());
export const colMiembros = (db, appId) => collection(db, 'artifacts', appId, 'members');
export const refCatalogoEmpleados = (db, appId) => doc(db, 'artifacts', appId, 'public', 'data', 'granja_empleados', 'catalogo');
export const colCapturas = (db, appId) => collection(db, 'artifacts', appId, 'public', 'data', 'granja_capturas');

// Misma regla que firestore.rules: activo sin rol cuenta como admin (membresías
// creadas antes de que existieran los roles); activo con rol 'empleado' es empleado.
export function resolverRol(datosMiembro) {
  if (!datosMiembro || datosMiembro.active !== true) return ROL.pendiente;
  if (datosMiembro.role === ROL.empleado) return ROL.empleado;
  if (datosMiembro.role === undefined || datosMiembro.role === ROL.admin) return ROL.admin;
  return ROL.pendiente;
}

/**
 * Sigue en vivo el rol de la cuenta que inició sesión.
 * estado: 'cargando' | 'admin' | 'empleado' | 'pendiente' | 'sin-conexion' | 'sin-reglas' | 'error'
 * Si la cuenta todavía no tiene documento, deja una solicitud pendiente para
 * que el admin la vea en Ajustes de empleados y la apruebe.
 */
export function useAcceso(db, appId, user) {
  const [acceso, setAcceso] = useState({ estado: 'cargando', error: '' });
  const uid = user?.uid || '';
  const email = user?.email || '';
  const nombre = user?.displayName || '';

  useEffect(() => {
    if (!uid) {
      setAcceso({ uid, estado: 'cargando', error: '' });
      return undefined;
    }

    let solicitudEnviada = false;
    const ref = refMiembro(db, appId, uid);

    return onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites) {
          setAcceso({ uid, estado: ROL.pendiente, error: '' });
          return;
        }
        if (snap.exists()) {
          setAcceso({ uid, estado: resolverRol(snap.data()), error: '' });
          return;
        }
        // Sin documento en caché no se puede saber si la cuenta está aprobada.
        if (snap.metadata.fromCache) {
          setAcceso({ uid, estado: 'sin-conexion', error: '' });
          return;
        }
        setAcceso({ uid, estado: ROL.pendiente, error: '' });
        if (solicitudEnviada) return;
        solicitudEnviada = true;
        runTransaction(db, async tx => {
          if ((await tx.get(ref)).exists()) return;
          tx.set(ref, { active: false, role: ROL.pendiente, email, nombre, solicitadoEn: Date.now() });
        }).catch((err) => {
          solicitudEnviada = false;
          setAcceso({ uid, estado: err.code === 'permission-denied' ? 'sin-reglas' : 'error', error: err.code });
        });
      },
      (err) => {
        setAcceso({ uid, estado: err?.code === 'permission-denied' ? 'sin-reglas' : 'error', error: err?.code || 'desconocido' });
      }
    );
  }, [db, appId, uid, email, nombre]);

  return acceso.uid === uid ? acceso : { estado: 'cargando', error: '' };
}
