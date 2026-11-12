// Lado administrador de la plataforma de empleados (lo usa la app principal).
import { useEffect, useState } from 'react';
import { onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { ESTADO_CAPTURA, firmaCatalogo } from '../domain/capturasEmpleado.js';
import { colCapturas, refCatalogoEmpleados } from './accesos.js';

/**
 * Mantiene publicado el catálogo que lee la app de empleados (corrales con lote
 * activo y listas de productos, sin precios). Solo escribe cuando algo cambió.
 */
export function useSincronizarCatalogoEmpleados(db, appId, catalogo) {
  // El catálogo se recalcula en cada render; la firma (texto) es lo que decide si cambió.
  const firmaLocal = catalogo ? firmaCatalogo(catalogo) : null;
  // undefined = todavía no se sabe qué hay publicado; null = no hay nada publicado.
  const [firmaRemota, setFirmaRemota] = useState(undefined);

  useEffect(() => onSnapshot(
    refCatalogoEmpleados(db, appId),
    (snap) => {
      if (!snap.exists()) {
        setFirmaRemota(null);
        return;
      }
      const { actualizadoEn: _actualizadoEn, ...publicado } = snap.data();
      setFirmaRemota(firmaCatalogo(publicado));
    },
    () => setFirmaRemota(undefined)
  ), [db, appId]);

  useEffect(() => {
    if (!firmaLocal || firmaRemota === undefined || firmaRemota === firmaLocal) return undefined;
    const temporizador = setTimeout(() => {
      setDoc(refCatalogoEmpleados(db, appId), { ...JSON.parse(firmaLocal), actualizadoEn: Date.now() })
        .catch((err) => console.warn('No se pudo publicar el catálogo de empleados:', err?.code || err));
    }, 1500);
    return () => clearTimeout(temporizador);
  }, [db, appId, firmaLocal, firmaRemota]);
}

// Capturas que los empleados enviaron y todavía nadie revisó (más viejas primero).
export function useCapturasPendientes(db, appId) {
  const [pendientes, setPendientes] = useState([]);
  useEffect(() => onSnapshot(
    query(colCapturas(db, appId), where('estado', '==', ESTADO_CAPTURA.pendiente)),
    (snap) => setPendientes(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (Number(a.creadaEn) || 0) - (Number(b.creadaEn) || 0))
    ),
    () => setPendientes([])
  ), [db, appId]);
  return pendientes;
}
