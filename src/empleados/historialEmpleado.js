import { limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { colCapturas } from './accesos.js';

const MAX_REGISTROS = 50;

export function escucharHistorialEmpleado(db, appId, uid, recibir, fallar) {
  const propios = query(colCapturas(db, appId), where('creadaPorUid', '==', uid));
  const recientes = query(propios, orderBy('creadaEn', 'desc'), limit(MAX_REGISTROS));
  let activo = true;
  let cancelarAlternativa;

  function escuchar(consulta, ordenarLocalmente) {
    return onSnapshot(consulta, { includeMetadataChanges: true }, snap => {
      if (!activo) return;
      const registros = snap.docs.map(d => ({ ...d.data(), id: d.id, sinEnviar: d.metadata.hasPendingWrites }));
      if (ordenarLocalmente) {
        registros.sort((a, b) => b.creadaEn - a.creadaEn || b.id.localeCompare(a.id));
      }
      recibir(registros.slice(0, MAX_REGISTROS), snap.metadata.fromCache);
    }, err => {
      if (!activo) return;
      if (!ordenarLocalmente && err.code === 'failed-precondition') {
        // El índice por empleado y fecha puede estar todavía en construcción.
        cancelarAlternativa = escuchar(propios, true);
      } else {
        fallar(err);
      }
    });
  }

  const cancelar = escuchar(recientes, false);
  return () => {
    activo = false;
    cancelar();
    cancelarAlternativa?.();
  };
}
