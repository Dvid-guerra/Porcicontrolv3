import { doc, runTransaction } from 'firebase/firestore';
import { construirCatalogoEmpleados, firmaCatalogo } from './catalogo.js';
import { CORRALES_INICIALES, INITIAL_CATALOGO, INITIAL_CATALOGO_MEDICO, INITIAL_CATALOGO_INSUMOS, CRONOGRAMA_ALIMENTACION } from './catalogosIniciales.js';
import { calcularInventarioCentral } from './inventarioCentral.js';
import { etapaAlimentacion } from './etapa.js';

const FUENTES = {
  agro_corrales: CORRALES_INICIALES, agro_lotes: [], agro_bajas: [], agro_ventas: [],
  agro_catalogo: INITIAL_CATALOGO, agro_catalogo_medico: INITIAL_CATALOGO_MEDICO,
  agro_catalogo_insumos: INITIAL_CATALOGO_INSUMOS, agro_bodega: [], agro_alimentos: []
};
export const afectaCatalogo = (clave) => Object.hasOwn(FUENTES, clave);

export function proyectarCatalogo(datos, ahora = new Date()) {
  const infoPorLote = {};
  for (const lote of datos.agro_lotes.filter(l => l.estado === 'Activo')) {
    const bajas = datos.agro_bajas.filter(b => b.loteId === lote.id).reduce((s, b) => s + Number(b.cantidad || 0), 0);
    const vendidos = datos.agro_ventas.filter(v => v.loteId === lote.id && !v.anulada).reduce((s, v) => s + Number(v.cantidadCerdos || 0), 0);
    const ingreso = new Date(lote.fechaIngreso + 'T00:00:00-06:00');
    const dias = Math.max(1, Math.ceil((ahora - ingreso) / 86400000) || 1);
    const { faseActual, alimentoSugerido } = etapaAlimentacion(lote, dias, CRONOGRAMA_ALIMENTACION, datos.agro_catalogo);
    infoPorLote[lote.id] = { cerdos: Number(lote.cantidad || 0) - bajas - vendidos, fase: faseActual, alimentoSugerido };
  }
  return construirCatalogoEmpleados({
    corrales: datos.agro_corrales, lotes: datos.agro_lotes, infoPorLote,
    catalogoAlimento: datos.agro_catalogo, catalogoMedico: datos.agro_catalogo_medico, catalogoInsumos: datos.agro_catalogo_insumos,
    inventarioCentral: calcularInventarioCentral(datos.agro_bodega, datos.agro_alimentos, datos.agro_catalogo)
  });
}

// Lee la versión vigente en la misma transacción que los movimientos de bodega.
export async function actualizarCatalogoEnTransaccion(tx, db, appId, cambios = null) {
  if (cambios && !Object.keys(cambios).some(afectaCatalogo)) return;
  const base = ['artifacts', appId, 'public', 'data'];
  const destino = doc(db, ...base, 'granja_empleados', 'catalogo');
  const anterior = await tx.get(destino);
  const datos = Object.fromEntries(await Promise.all(Object.entries(FUENTES).map(async ([clave, inicial]) => {
    let valor = cambios?.[clave];
    if (valor === undefined) {
      const snap = await tx.get(doc(db, ...base, 'granja_compartida', clave));
      valor = snap.exists() ? snap.data().data : inicial;
    }
    if (!Array.isArray(valor)) throw new Error('Formato de datos inválido en ' + clave);
    return [clave, valor];
  })));
  const nuevo = proyectarCatalogo(datos);
  const previo = { ...anterior.data() };
  delete previo.actualizadoEn;
  if (firmaCatalogo(nuevo) !== firmaCatalogo(previo)) tx.set(destino, { ...nuevo, actualizadoEn: Date.now() });
}
export function publicarCatalogo(db, appId) {
  return runTransaction(db, tx => actualizarCatalogoEnTransaccion(tx, db, appId));
}
