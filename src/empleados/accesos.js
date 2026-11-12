// ============================================================================
// ACCESOS Y RUTAS COMPARTIDAS ENTRE LA APP PRINCIPAL Y LA APP DE EMPLEADOS
// ----------------------------------------------------------------------------
// Cada cuenta tiene un documento en artifacts/{appId}/members/{uid}:
//   { active: boolean, role: 'admin' | 'empleado' | 'pendiente', email, nombre }
// - admin:    entra a la app principal (y puede probar la de empleados).
// - empleado: solo entra a la app de empleados; Firestore le niega lo demás.
// - pendiente (o sin documento): no entra a nada hasta que un admin lo apruebe.
// Lo que ves aquí es la parte visual; quien de verdad bloquea es firestore.rules.
// ============================================================================

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';

export const APP_ID_GRANJA = 'agrocontrol-local';

export const ROL = { admin: 'admin', empleado: 'empleado', pendiente: 'pendiente' };

export const refMiembro = (db, appId, uid) => doc(db, 'artifacts', appId, 'members', uid);
export const colMiembros = (db, appId) => collection(db, 'artifacts', appId, 'members');
export const refCatalogoEmpleados = (db, appId) => doc(db, 'artifacts', appId, 'public', 'data', 'granja_empleados', 'catalogo');
export const refPersonal = (db, appId) => doc(db, 'artifacts', appId, 'public', 'data', 'granja_empleados', 'personal');
export const colCapturas = (db, appId) => collection(db, 'artifacts', appId, 'public', 'data', 'granja_capturas');

// Misma regla que firestore.rules: activo sin rol cuenta como admin (membresías
// creadas antes de que existieran los roles); activo con rol 'empleado' es empleado.
export function resolverRol(datosMiembro) {
  if (!datosMiembro || datosMiembro.active !== true) return ROL.pendiente;
  if (datosMiembro.role === ROL.empleado) return ROL.empleado;
  if (datosMiembro.role === undefined || datosMiembro.role === null || datosMiembro.role === ROL.admin) return ROL.admin;
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
      setAcceso({ estado: 'cargando', error: '' });
      return undefined;
    }

    let solicitudEnviada = false;
    const ref = refMiembro(db, appId, uid);

    return onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.exists()) {
          setAcceso({ estado: resolverRol(snap.data()), error: '' });
          return;
        }
        // Sin documento en caché no se puede saber si la cuenta está aprobada.
        if (snap.metadata.fromCache) {
          setAcceso({ estado: 'sin-conexion', error: '' });
          return;
        }
        setAcceso({ estado: ROL.pendiente, error: '' });
        if (solicitudEnviada) return;
        solicitudEnviada = true;
        setDoc(ref, {
          active: false,
          role: ROL.pendiente,
          email,
          nombre,
          solicitadoEn: Date.now()
        }).catch((err) => {
          if (err?.code === 'permission-denied') setAcceso({ estado: 'sin-reglas', error: err.code });
        });
      },
      (err) => {
        setAcceso({ estado: err?.code === 'permission-denied' ? 'sin-reglas' : 'error', error: err?.code || 'desconocido' });
      }
    );
  }, [db, appId, uid, email, nombre]);

  return acceso;
}
