import { useState, useEffect, useRef, useCallback } from 'react';
import {
  clearIndexedDbPersistence,
  doc,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  runTransaction,
  terminate
} from 'firebase/firestore';
import {
  acumularCambioPendiente,
  esErrorDeRedFirestore,
  guardarCacheLocal,
  guardarColaPendiente,
  leerCacheLocal,
  leerColaPendiente,
  reconciliarCambioOffline
} from '../domain/offlineQueue.js';

export function crearFirestoreConCacheOffline(app) {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch {
    return getFirestore(app);
  }
}

const getLocalStorage = () => (typeof window !== 'undefined' ? window.localStorage : null);

// Suscriptores en memoria para actualizar el indicador de estado offline/sincronización
// y notificar a cada hook useCloudStorage cuando su clave pendiente se reconcilia.
const statusSubscribers = new Set();
const keySubscribers = new Map(); // `${appId}:${key}` -> Set<fn>
let isFlushingGlobal = false;
let lastSyncedAtGlobal = null;

// Salud de la conexión con la nube. Firestore no da error cuando su caché local queda
// trabada (p. ej. otra pestaña "líder" con la caché borrada): simplemente no llegan
// datos del servidor. Por eso se registra cuándo llegó el último dato real.
const INICIO_SESION_AT = Date.now();
export const ESPERA_DATOS_NUBE_MS = 12_000;
let ultimoDatoServidorAt = null;
let ultimoErrorNube = null;

function registrarDatoServidor() {
  const primeraVez = ultimoDatoServidorAt === null || ultimoErrorNube !== null;
  ultimoDatoServidorAt = Date.now();
  ultimoErrorNube = null;
  if (primeraVez) notificarEstadoCola();
}

function registrarErrorNube(error) {
  ultimoErrorNube = error?.code || 'desconocido';
  notificarEstadoCola();
}

/**
 * Diagnóstico puro (testeable): ¿la app debería avisar que no recibe datos de la nube?
 * - 'error': Firestore rechazó la lectura (permisos, App Check…).
 * - 'sinRespuesta': hay conexión pero no llegó ningún dato del servidor en el tiempo de espera.
 * - null: todo bien, o sin conexión (eso ya lo cubre el aviso de Modo Galpón).
 */
export function diagnosticarNube({ enLinea, ahora, inicioAt, ultimoDatoAt, error, esperaMs = ESPERA_DATOS_NUBE_MS }) {
  if (!enLinea) return null;
  if (error) return 'error';
  if (ultimoDatoAt === null && ahora - inicioAt >= esperaMs) return 'sinRespuesta';
  return null;
}

function notificarEstadoCola() {
  statusSubscribers.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignorar errores en listeners desmontados
    }
  });
}

function suscribirClave(appId, key, callback) {
  const id = `${appId}:${key}`;
  if (!keySubscribers.has(id)) keySubscribers.set(id, new Set());
  keySubscribers.get(id).add(callback);
  return () => {
    const set = keySubscribers.get(id);
    if (set) {
      set.delete(callback);
      if (set.size === 0) keySubscribers.delete(id);
    }
  };
}

function emitirActualizacionClave(appId, key, valor) {
  const id = `${appId}:${key}`;
  const set = keySubscribers.get(id);
  if (!set) return;
  set.forEach((fn) => {
    try {
      fn(valor);
    } catch {
      // Ignorar
    }
  });
}

export function encolarCambioLocal({ appId, key, baseActual, nuevoValor, userUid }) {
  const storage = getLocalStorage();
  const cola = leerColaPendiente(storage, appId);
  cola[key] = acumularCambioPendiente(cola[key] || null, {
    key,
    baseActual,
    nuevoValor,
    updatedAt: Date.now(),
    updatedBy: userUid || ''
  });
  guardarColaPendiente(storage, appId, cola);
  guardarCacheLocal(storage, appId, key, nuevoValor);
  emitirActualizacionClave(appId, key, nuevoValor);
  notificarEstadoCola();
}

export async function sincronizarColaPendiente({ db, appId, userUid }) {
  if (!db || !appId || !userUid) return { sincronizados: 0, pendientes: 0 };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const actuales = Object.keys(leerColaPendiente(getLocalStorage(), appId)).length;
    return { sincronizados: 0, pendientes: actuales };
  }
  if (isFlushingGlobal) {
    const actuales = Object.keys(leerColaPendiente(getLocalStorage(), appId)).length;
    return { sincronizados: 0, pendientes: actuales };
  }

  const storage = getLocalStorage();
  const colaInicial = leerColaPendiente(storage, appId);
  const claves = Object.keys(colaInicial);
  if (claves.length === 0) return { sincronizados: 0, pendientes: 0 };

  isFlushingGlobal = true;
  notificarEstadoCola();
  let sincronizados = 0;

  try {
    for (const key of claves) {
      const colaVigente = leerColaPendiente(storage, appId);
      const entrada = colaVigente[key];
      if (!entrada) continue;

      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'granja_compartida', key);
      try {
        const timestampAntes = entrada.updatedAt;
        const reconciliado = await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(docRef);
          const remoto = snapshot.exists() ? snapshot.data().data : undefined;
          const mezclado = reconciliarCambioOffline({
            base: entrada.baseValue,
            local: entrada.targetValue,
            remoto
          });
          transaction.set(docRef, {
            data: mezclado,
            updatedAt: Date.now(),
            updatedBy: userUid
          });
          return mezclado;
        });

        // Verificar que el operario no haya hecho otro toque en la misma clave mientras subía
        const colaDespues = leerColaPendiente(storage, appId);
        if (colaDespues[key] && colaDespues[key].updatedAt === timestampAntes) {
          delete colaDespues[key];
          guardarColaPendiente(storage, appId, colaDespues);
          guardarCacheLocal(storage, appId, key, reconciliado);
          emitirActualizacionClave(appId, key, reconciliado);
          sincronizados += 1;
        }
      } catch (err) {
        if (esErrorDeRedFirestore(err)) {
          break;
        }
        console.error('Error sincronizando cambio offline en clave:', key, err);
      }
    }

    if (sincronizados > 0) {
      lastSyncedAtGlobal = Date.now();
    }
  } finally {
    isFlushingGlobal = false;
    notificarEstadoCola();
  }

  const restantes = Object.keys(leerColaPendiente(storage, appId)).length;
  return { sincronizados, pendientes: restantes };
}

export function useOfflineSyncStatus({ db, user, appId }) {
  const [enLinea, setEnLinea] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [, setTick] = useState(0);

  const refrescar = useCallback(() => {
    setEnLinea(typeof navigator !== 'undefined' ? navigator.onLine !== false : true);
    setTick((n) => n + 1);
  }, []);

  const sincronizarAhora = useCallback(async () => {
    if (!db || !user?.uid || !appId) return { sincronizados: 0, pendientes: 0 };
    return sincronizarColaPendiente({ db, appId, userUid: user.uid });
  }, [db, user?.uid, appId]);

  useEffect(() => {
    statusSubscribers.add(refrescar);
    const alConectar = () => {
      refrescar();
      sincronizarAhora();
    };
    const alDesconectar = () => refrescar();

    window.addEventListener('online', alConectar);
    window.addEventListener('offline', alDesconectar);

    // Si arranca con conexión y habían registros guardados en el galpón, subirlos solos
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      sincronizarAhora();
    }

    return () => {
      statusSubscribers.delete(refrescar);
      window.removeEventListener('online', alConectar);
      window.removeEventListener('offline', alDesconectar);
    };
  }, [refrescar, sincronizarAhora]);

  // Re-evalúa el diagnóstico cuando se cumple el tiempo de espera de la primera carga.
  useEffect(() => {
    if (ultimoDatoServidorAt !== null) return undefined;
    const restante = Math.max(0, INICIO_SESION_AT + ESPERA_DATOS_NUBE_MS - Date.now());
    const timer = setTimeout(refrescar, restante + 50);
    return () => clearTimeout(timer);
  }, [refrescar]);

  const cola = leerColaPendiente(getLocalStorage(), appId);
  const pendientesCount = Object.keys(cola).length;

  return {
    enLinea,
    sincronizando: isFlushingGlobal,
    pendientesCount,
    ultimoSyncAt: lastSyncedAtGlobal,
    sincronizarAhora,
    problemaNube: diagnosticarNube({
      enLinea,
      ahora: Date.now(),
      inicioAt: INICIO_SESION_AT,
      ultimoDatoAt: ultimoDatoServidorAt,
      error: ultimoErrorNube
    }),
    errorNube: ultimoErrorNube
  };
}

export function useCloudStorage(key, initialValue, user, dbInstance, appId) {
  const initialValueRef = useRef(initialValue);

  const leerEstadoInicial = () => {
    const storage = getLocalStorage();
    const cola = leerColaPendiente(storage, appId);
    if (cola[key] && cola[key].targetValue !== undefined) {
      return cola[key].targetValue;
    }
    const cache = leerCacheLocal(storage, appId, key, initialValueRef.current);
    if (cache.hit) {
      if (Array.isArray(initialValueRef.current) && !Array.isArray(cache.data)) {
        return initialValueRef.current;
      }
      return cache.data !== undefined ? cache.data : initialValueRef.current;
    }
    return initialValueRef.current;
  };

  const [state, setStateInternal] = useState(leerEstadoInicial);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [isLoaded, setIsLoaded] = useState(() => {
    const storage = getLocalStorage();
    const cola = leerColaPendiente(storage, appId);
    if (cola[key]) return true;
    return leerCacheLocal(storage, appId, key, null).hit;
  });

  useEffect(() => {
    return suscribirClave(appId, key, (nuevoValor) => {
      stateRef.current = nuevoValor;
      setStateInternal(nuevoValor);
    });
  }, [appId, key]);

  useEffect(() => {
    if (!user || !dbInstance || !appId) {
      setIsLoaded(true);
      return undefined;
    }

    const storage = getLocalStorage();
    const docRef = doc(dbInstance, 'artifacts', appId, 'public', 'data', 'granja_compartida', key);

    let ultimoJson = null;
    const unsubscribe = onSnapshot(
      docRef,
      // Con metadatos para enterarnos cuando el servidor confirma datos iguales a la caché.
      { includeMetadataChanges: true },
      (docSnap) => {
        if (!docSnap.metadata.fromCache) registrarDatoServidor();
        const cola = leerColaPendiente(storage, appId);
        // Si esta clave tiene cambios hechos sin señal aún pendientes de reconciliar,
        // respetamos el dato local del operario hasta que termine la fusión con la nube.
        if (cola[key]) {
          setIsLoaded(true);
          if (!docSnap.metadata.fromCache && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
            sincronizarColaPendiente({ db: dbInstance, appId, userUid: user.uid });
          }
          return;
        }

        let nextVal = initialValueRef.current;
        if (docSnap.exists()) {
          const data = docSnap.data().data;
          if (Array.isArray(initialValueRef.current) && !Array.isArray(data)) {
            nextVal = initialValueRef.current;
          } else {
            nextVal = data !== undefined ? data : initialValueRef.current;
          }
        }
        // Los avisos solo de metadatos traen los mismos datos: no re-renderizar por ellos.
        const json = JSON.stringify(nextVal);
        if (json === ultimoJson) {
          setIsLoaded(true);
          return;
        }
        ultimoJson = json;
        stateRef.current = nextVal;
        setStateInternal(nextVal);
        guardarCacheLocal(storage, appId, key, nextVal);
        setIsLoaded(true);
      },
      (error) => {
        console.warn('Modo offline / caché local activo para:', key, error?.code || error);
        if (!esErrorDeRedFirestore(error)) registrarErrorNube(error);
        setIsLoaded(true);
      }
    );

    return () => unsubscribe();
  }, [key, user, dbInstance, appId]);

  const setValue = useCallback(
    async (value) => {
      const previous = stateRef.current;
      const optimisticNext = value instanceof Function ? value(previous) : value;
      stateRef.current = optimisticNext;
      setStateInternal(optimisticNext);

      if (!user || !dbInstance || !appId) {
        return optimisticNext;
      }

      // Si sabemos que no hay señal en el galpón, guardamos de inmediato en la cola local
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        encolarCambioLocal({
          appId,
          key,
          baseActual: previous,
          nuevoValor: optimisticNext,
          userUid: user.uid
        });
        return optimisticNext;
      }

      const docRef = doc(dbInstance, 'artifacts', appId, 'public', 'data', 'granja_compartida', key);
      try {
        const next = await runTransaction(dbInstance, async (transaction) => {
          const snapshot = await transaction.get(docRef);
          const remoteValue = snapshot.exists() ? snapshot.data().data : initialValueRef.current;
          const valueToStore = value instanceof Function ? value(remoteValue) : value;
          transaction.set(docRef, {
            data: valueToStore,
            updatedAt: Date.now(),
            updatedBy: user.uid
          });
          return valueToStore;
        });

        stateRef.current = next;
        setStateInternal(next);
        guardarCacheLocal(getLocalStorage(), appId, key, next);
        lastSyncedAtGlobal = Date.now();
        notificarEstadoCola();
        return next;
      } catch (error) {
        if (esErrorDeRedFirestore(error)) {
          // En lugar de borrar el registro del operario cuando cae la señal en la galera,
          // lo protegemos en la cola local para reconciliar al volver la red.
          encolarCambioLocal({
            appId,
            key,
            baseActual: previous,
            nuevoValor: optimisticNext,
            userUid: user.uid
          });
          return optimisticNext;
        }
        console.error('Error guardando en la nube:', key, error);
        stateRef.current = previous;
        setStateInternal(previous);
        throw error;
      }
    },
    [key, user, dbInstance, appId]
  );

  return [state, setValue, isLoaded];
}

export async function ejecutarTransaccionMultiClaveOffline({
  db,
  appId,
  userUid,
  updates,
  estadosActuales = {}
}) {
  const entries = Object.entries(updates || {});
  if (entries.length === 0) return;

  const guardarTodoOffline = () => {
    const storage = getLocalStorage();
    entries.forEach(([key, updater]) => {
      const baseActual =
        estadosActuales[key] !== undefined
          ? estadosActuales[key]
          : leerCacheLocal(storage, appId, key, []).data;
      const nuevoValor = updater(baseActual);
      encolarCambioLocal({
        appId,
        key,
        baseActual,
        nuevoValor,
        userUid
      });
    });
  };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    guardarTodoOffline();
    return;
  }

  try {
    await runTransaction(db, async (transaction) => {
      const snapshots = await Promise.all(
        entries.map(([key]) => {
          const ref = doc(db, 'artifacts', appId, 'public', 'data', 'granja_compartida', key);
          return transaction.get(ref).then((snapshot) => ({ key, ref, snapshot }));
        })
      );

      const storage = getLocalStorage();
      snapshots.forEach(({ key, ref, snapshot }) => {
        const current = snapshot.exists() ? snapshot.data().data : [];
        const next = updates[key](current);
        transaction.set(ref, {
          data: next,
          updatedAt: Date.now(),
          updatedBy: userUid
        });
        guardarCacheLocal(storage, appId, key, next);
      });
    });
    lastSyncedAtGlobal = Date.now();
    notificarEstadoCola();
  } catch (error) {
    if (esErrorDeRedFirestore(error)) {
      guardarTodoOffline();
      return;
    }
    throw error;
  }
}

/**
 * Borra la copia local de la app en este navegador y recarga, para volver a bajar todo de la nube.
 * Conserva la cola de cambios hechos sin señal (no se pierde trabajo del galpón).
 */
export async function reiniciarCacheLocal(dbInstance, appId) {
  try {
    await terminate(dbInstance);
  } catch {
    // Si ya estaba cerrada, seguimos
  }
  try {
    await clearIndexedDbPersistence(dbInstance);
  } catch (error) {
    // Falla si otra pestaña de la app sigue abierta y usando la caché
    console.warn('No se pudo borrar la caché de Firestore:', error?.code || error);
  }

  const storage = getLocalStorage();
  if (storage) {
    const prefijo = `porci_cloud_cache_${appId || 'local'}_`;
    Object.keys(storage)
      .filter((k) => k.startsWith(prefijo))
      .forEach((k) => storage.removeItem(k));
  }

  if (typeof caches !== 'undefined') {
    try {
      const claves = await caches.keys();
      await Promise.all(claves.filter((k) => k.startsWith('porcicontrol-shell-')).map((k) => caches.delete(k)));
    } catch {
      // Sin acceso a Cache Storage: no es crítico
    }
  }

  window.location.reload();
}
