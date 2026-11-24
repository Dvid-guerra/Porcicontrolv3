// Lado administrador de la plataforma de empleados (lo usa la app principal).
import { useEffect, useState, useCallback } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { ESTADO_CAPTURA } from '../domain/capturasEmpleado.js';
import { colCapturas, mensajeFirestore } from './accesos.js';

import { publicarCatalogo } from '../domain/granja/publicarCatalogo.js';

export function usePublicacionCatalogo(db, appId) {
  const [estado, setEstado] = useState({ ocupado: true, mensaje: '' });
  const publicar = useCallback(async () => {
    setEstado({ ocupado: true, mensaje: 'Publicando catálogo…' });
    try {
      await publicarCatalogo(db, appId);
      setEstado({ ocupado: false, mensaje: 'Catálogo disponible para los empleados.' });
    } catch (err) {
      setEstado({ ocupado: false, mensaje: mensajeFirestore(err, 'publicar el catálogo') });
    }
  }, [db, appId]);
  useEffect(() => {
    publicar();
    window.addEventListener('online', publicar);
    return () => window.removeEventListener('online', publicar);
  }, [publicar]);
  return { ...estado, publicar };
}

// Capturas que los empleados enviaron y todavía nadie revisó (más viejas primero).
export function useCapturasPendientes(db, appId) {
  const [estado, setEstado] = useState({ pendientes: [], cargando: true, error: '' });
  useEffect(() => onSnapshot(
    query(colCapturas(db, appId), where('estado', '==', ESTADO_CAPTURA.pendiente)),
    (snap) => setEstado({ cargando: false, error: '', pendientes: snap.docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .sort((a, b) => (Number(a.creadaEn) || 0) - (Number(b.creadaEn) || 0))
    }),
    (err) => setEstado({ pendientes: [], cargando: false, error: mensajeFirestore(err, 'cargar los registros pendientes') })
  ), [db, appId]);
  return estado;
}
