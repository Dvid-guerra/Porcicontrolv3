const texto = (valor, max = 200) => String(valor ?? '').trim().slice(0, max);

// "Corral 2" antes que "Corral 10": orden por el número del nombre, no alfabético.
export function ordenarCorralesPorNumero(corrales = []) {
  const numeroDe = (corral) => {
    const match = String(corral?.nombre || '').match(/\d+/);
    return match ? parseInt(match[0], 10) : Number.POSITIVE_INFINITY;
  };
  return [...corrales].sort((a, b) => {
    const diff = numeroDe(a) - numeroDe(b);
    if (diff !== 0 && !Number.isNaN(diff)) return diff;
    return String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { numeric: true });
  });
}

/**
 * Arma lo único que la app de empleados necesita leer: corrales con su lote
 * activo y las listas de productos. No incluye precios, costos, compras ni ventas.
 *
 * `infoPorLote[loteId]` = { cerdos, fase, alimentoSugerido }
 */
export function construirCatalogoEmpleados({
  corrales = [],
  lotes = [],
  infoPorLote = {},
  catalogoAlimento = [],
  inventarioCentral = [],
  catalogoMedico = [],
  catalogoInsumos = []
} = {}) {
  const lotesActivos = lotes.filter((l) => l && l.estado === 'Activo');

  return {
    version: 1,
    corrales: ordenarCorralesPorNumero(corrales).map((corral) => {
      const lote = lotesActivos.find((l) => String(l.corralId) === String(corral.id)) || null;
      const info = (lote && infoPorLote[lote.id]) || {};
      return {
        id: String(corral.id),
        nombre: texto(corral.nombre, 60) || 'Corral',
        loteId: lote ? String(lote.id) : '',
        loteNombre: lote ? texto(lote.nombre || lote.raza || 'Lote activo', 60) : '',
        cerdos: lote ? Math.max(0, Math.round(Number(info.cerdos) || 0)) : 0,
        fase: lote ? Number(info.fase) || Number(lote.faseActual) || 1 : 0,
        alimentoSugerido: lote ? texto(info.alimentoSugerido, 60) : ''
      };
    }),
    concentrados: catalogoAlimento
      .filter((a) => a && a.nombre)
      .map((a) => ({
        nombre: texto(a.nombre, 60),
        librasPorSaco: Number(a.librasPorSaco) || 50,
        stockLbs: inventarioCentral.find((item) => item.nombre === a.nombre)?.stockLbs ?? null
      })),
    medicamentos: catalogoMedico
      .filter((m) => m && m.id && m.nombre)
      .map((m) => ({ id: String(m.id), nombre: texto(m.nombre, 80), unidad: texto(m.unidad, 20), categoria: texto(m.categoria, 40) })),
    insumos: catalogoInsumos
      .filter((i) => i && i.id && i.nombre)
      .map((i) => ({ id: String(i.id), nombre: texto(i.nombre, 80), unidad: texto(i.unidad, 20), categoria: texto(i.categoria, 40) }))
  };
}

// Para saber si hay que volver a publicar el catálogo. Ordena las claves porque
// Firestore no devuelve los campos en el orden en que se escribieron.
const ordenarClaves = (valor) => {
  if (Array.isArray(valor)) return valor.map(ordenarClaves);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.keys(valor).sort().map((clave) => [clave, ordenarClaves(valor[clave])]));
  }
  return valor;
};
export const firmaCatalogo = (catalogo) => JSON.stringify(ordenarClaves(catalogo ?? null));
