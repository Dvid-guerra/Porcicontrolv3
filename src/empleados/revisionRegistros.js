import { actualizarCatalogoEnTransaccion } from '../domain/granja/publicarCatalogo.js';
import { doc, runTransaction } from 'firebase/firestore';
import { aplicarCapturas, ESTADO_CAPTURA } from '../domain/capturasEmpleado.js';
import { calcularInventarioCentral, calcularInventarioProductos } from '../domain/inventario.js';
import { calculateLotStatistics } from '../domain/lotStatistics.js';
import { colCapturas } from './accesos.js';

const DOCUMENTOS = {
  concentrado: ['agro_catalogo', 'agro_bodega', 'agro_alimentos'],
  medicamento: ['agro_catalogo_medico', 'agro_compras_medicas', 'agro_usos_medicos', 'agro_vacunas'],
  insumo: ['agro_catalogo_insumos', 'agro_compras_insumos', 'agro_usos_insumos', 'agro_gastosextra'],
  baja: ['agro_bajas', 'agro_ventas'],
  peso: ['agro_pesos'] // Solicitudes pendientes de versiones anteriores.
};
const DESTINO = {
  alimentos: 'agro_alimentos', vacunas: 'agro_vacunas', usosMedicos: 'agro_usos_medicos',
  usosInsumos: 'agro_usos_insumos', gastosExtra: 'agro_gastosextra', bajas: 'agro_bajas', pesos: 'agro_pesos'
};

const revisor = (user) => ({
  revisadaEn: Date.now(),
  revisadaPorUid: user.uid,
  revisadaPor: user.displayName || user.email || user.uid
});

async function aprobarRegistro(db, appId, user, id, iniciales) {
  const capturaRef = doc(colCapturas(db, appId), id);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(capturaRef);
    if (!snap.exists() || snap.data().estado !== ESTADO_CAPTURA.pendiente) {
      return { capturaId: id, ok: false, error: 'El registro ya fue revisado o retirado.' };
    }
    const captura = { ...snap.data(), id };
    const claves = ['agro_lotes', ...(DOCUMENTOS[captura.tipo] || [])];
    const refs = Object.fromEntries(claves.map((k) => [k, doc(db, 'artifacts', appId, 'public', 'data', 'granja_compartida', k)]));
    const datos = {};
    await Promise.all(claves.map(async (k) => {
      const fuente = await tx.get(refs[k]);
      datos[k] = fuente.exists() ? fuente.data().data : iniciales[k] || [];
      if (!Array.isArray(datos[k])) throw new Error('Datos de granja inválidos.');
    }));
    const existentes = Object.fromEntries(Object.entries(DESTINO).map(([lista, k]) => [lista, datos[k] || []]));
    const { cambios, resultados: [resultado] } = aplicarCapturas([captura], {
      lotes: datos.agro_lotes,
      catalogoAlimento: datos.agro_catalogo,
      inventarioCentral: calcularInventarioCentral(datos.agro_bodega || [], existentes.alimentos, datos.agro_catalogo || []),
      inventarioMedico: calcularInventarioProductos(datos.agro_catalogo_medico || [], datos.agro_compras_medicas, existentes.usosMedicos),
      inventarioInsumos: calcularInventarioProductos(datos.agro_catalogo_insumos || [], datos.agro_compras_insumos, existentes.usosInsumos),
      vivosPorLote: (loteId) => calculateLotStatistics({
        lot: datos.agro_lotes.find((lote) => lote.id === loteId), deaths: existentes.bajas, sales: datos.agro_ventas
      }).cantidadActual,
      existentes
    });
    if (!resultado.ok) return resultado;
    const actualizados = {};
    for (const [lista, registros] of Object.entries(cambios)) {
      if (!registros.length) continue;
      const previos = existentes[lista];
      const ids = new Set(previos.map((r) => r.id));
      actualizados[DESTINO[lista]] = [...previos, ...registros.filter((r) => !ids.has(r.id))];
    }
    await actualizarCatalogoEnTransaccion(tx, db, appId, actualizados);
    for (const [clave, data] of Object.entries(actualizados)) {
      tx.set(refs[clave], {
        data,
        updatedAt: Date.now(), updatedBy: user.uid
      });
    }
    tx.update(capturaRef, { estado: ESTADO_CAPTURA.aplicada, registroId: resultado.registroId, ...revisor(user) });
    return resultado;
  });
}

export async function aprobarRegistros(db, appId, user, capturas, iniciales = {}) {
  const resultados = [];
  for (const { id } of capturas) {
    resultados.push(await aprobarRegistro(db, appId, user, id, iniciales));
  }
  return resultados;
}

export function rechazarRegistro(db, appId, user, id, motivo) {
  const ref = doc(colCapturas(db, appId), id);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().estado !== ESTADO_CAPTURA.pendiente) throw new Error('El registro ya no está pendiente.');
    tx.update(ref, { estado: ESTADO_CAPTURA.rechazada, motivoRechazo: motivo, ...revisor(user) });
  });
}
