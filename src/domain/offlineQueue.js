// Cola local y reconciliación de 3 vías (base / local / remoto) para operación
// 100% offline en los galpones sin sobrescribir cambios de otros usuarios.

export function esErrorDeRedFirestore(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  if (!error) return false;
  const code = String(error.code || '').toLowerCase();
  if (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'cancelled' ||
    code === 'FailedPrecondition'.toLowerCase() ||
    code === 'failed-precondition'
  ) {
    return true;
  }
  const msg = String(error.message || error || '').toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('unavailable') ||
    msg.includes('network') ||
    msg.includes('failed to get document') ||
    msg.includes('fetch')
  );
}

function esArregloConIds(arr) {
  if (!Array.isArray(arr)) return false;
  if (arr.length === 0) return true;
  return arr.every((item) => item && typeof item === 'object' && item.id !== undefined && item.id !== null);
}

function serializarEstable(valor) {
  try {
    return JSON.stringify(valor);
  } catch {
    return '';
  }
}

/**
 * Reconcilia de forma segura los cambios hechos sin señal en el teléfono (`local`)
 * contra el estado actual en Firestore (`remoto`), usando como referencia el estado
 * que tenía el teléfono antes de quedarse sin señal (`base`).
 *
 * Si son arreglos de registros con `id`:
 * - Conserva registros nuevos creados por otros dispositivos en `remoto`.
 * - Agrega registros nuevos creados offline en `local`.
 * - Aplica ediciones hechas en `local` respecto a `base`.
 * - Respeta eliminaciones hechas en `local` respecto a `base`.
 */
export function reconciliarCambioOffline({ base, local, remoto }) {
  const baseArr = Array.isArray(base) ? base : null;
  const localArr = Array.isArray(local) ? local : null;
  const remotoArr = Array.isArray(remoto) ? remoto : null;

  if (localArr && (remotoArr || remoto === undefined || remoto === null)) {
    const baseLista = baseArr || [];
    const remotoLista = remotoArr || [];

    if (esArregloConIds(baseLista) && esArregloConIds(localArr) && esArregloConIds(remotoLista)) {
      const baseMap = new Map(baseLista.map((item) => [String(item.id), item]));
      const localMap = new Map(localArr.map((item) => [String(item.id), item]));

      // IDs eliminados explícitamente en local
      const idsEliminadosLocal = new Set();
      for (const id of baseMap.keys()) {
        if (!localMap.has(id)) idsEliminadosLocal.add(id);
      }

      // IDs modificados en local respecto a base
      const editadosLocal = new Map();
      for (const [id, localItem] of localMap.entries()) {
        if (baseMap.has(id)) {
          if (serializarEstable(baseMap.get(id)) !== serializarEstable(localItem)) {
            editadosLocal.set(id, localItem);
          }
        }
      }

      const resultado = [];
      const idsYaIncluidos = new Set();

      // 1. Recorrer remoto preservando lo que otros usuarios agregaron/editaron,
      //    salvo lo eliminado o editado localmente.
      for (const remItem of remotoLista) {
        const id = String(remItem.id);
        if (idsEliminadosLocal.has(id)) continue;
        if (editadosLocal.has(id)) {
          resultado.push(editadosLocal.get(id));
        } else {
          resultado.push(remItem);
        }
        idsYaIncluidos.add(id);
      }

      // 2. Agregar registros creados offline en local (y ediciones cuyo registro no estaba aún)
      for (const localItem of localArr) {
        const id = String(localItem.id);
        if (!idsYaIncluidos.has(id) && !baseMap.has(id)) {
          resultado.push(localItem);
          idsYaIncluidos.add(id);
        }
      }

      return resultado;
    }
  }

  return local;
}

export function acumularCambioPendiente(entradaExistente, { key, baseActual, nuevoValor, updatedAt = Date.now(), updatedBy = '' }) {
  const baseValue = entradaExistente ? entradaExistente.baseValue : baseActual;
  return {
    key,
    baseValue,
    targetValue: nuevoValor,
    updatedAt,
    updatedBy: updatedBy || entradaExistente?.updatedBy || ''
  };
}

const prefijoCache = (appId, key) => `porci_cloud_cache_${appId || 'local'}_${key}`;
const claveCola = (appId) => `porci_offline_pending_${appId || 'local'}`;

export function leerCacheLocal(storage, appId, key, fallback) {
  if (!storage) return { hit: false, data: fallback };
  try {
    const raw = storage.getItem(prefijoCache(appId, key));
    if (!raw) return { hit: false, data: fallback };
    const parsed = JSON.parse(raw);
    if (parsed && 'data' in parsed) {
      return { hit: true, data: parsed.data };
    }
  } catch {
    // Ignorar caché corrupto
  }
  return { hit: false, data: fallback };
}

export function guardarCacheLocal(storage, appId, key, data) {
  if (!storage) return;
  try {
    storage.setItem(prefijoCache(appId, key), JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // Cuota de localStorage llena o modo privado estricto
  }
}

export function leerColaPendiente(storage, appId) {
  if (!storage) return {};
  try {
    const raw = storage.getItem(claveCola(appId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function guardarColaPendiente(storage, appId, mapaPendientes) {
  if (!storage) return;
  try {
    const entradas = mapaPendientes && typeof mapaPendientes === 'object' ? mapaPendientes : {};
    if (Object.keys(entradas).length === 0) {
      storage.removeItem(claveCola(appId));
    } else {
      storage.setItem(claveCola(appId), JSON.stringify(entradas));
    }
  } catch {
    // Ignorar error de cuota
  }
}
