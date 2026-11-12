// ============================================================================
// DOMINIO: CAPTURAS DE EMPLEADOS
// ----------------------------------------------------------------------------
// La app de empleados no toca los registros de la granja. Solo crea "capturas"
// (qué se hizo, en qué corral, cuánto) sin precios ni costos. La app principal
// las revisa y las convierte en registros reales con `aplicarCapturas`, que es
// donde se calcula el costo y se valida el stock.
// ============================================================================

import { calcularDescuentoTolva } from './qrTolva.js';

export const TIPOS_CAPTURA = ['concentrado', 'medicamento', 'insumo', 'peso', 'baja'];

export const ESTADO_CAPTURA = {
  pendiente: 'pendiente',
  aplicada: 'aplicada',
  rechazada: 'rechazada'
};

export const ETIQUETA_TIPO = {
  concentrado: 'Concentrado',
  medicamento: 'Medicamento',
  insumo: 'Insumo',
  peso: 'Pesaje',
  baja: 'Baja'
};

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const texto = (valor, max = 200) => String(valor ?? '').trim().slice(0, max);
const numero = (valor) => {
  const n = typeof valor === 'number' ? valor : parseFloat(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
const redondear = (n, decimales = 2) => Number(Number(n).toFixed(decimales));
const formatearCantidad = (n) => String(redondear(n, 2));

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
      .map((a) => ({ nombre: texto(a.nombre, 60), librasPorSaco: Number(a.librasPorSaco) || 50 })),
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

/**
 * Valida lo que llenó el empleado y arma el documento de captura.
 * Devuelve { ok, error, captura }.
 */
export function construirCaptura({ tipo, corral, empleado, fecha, datos = {}, hoy, uid = '', ahora = Date.now() } = {}) {
  const error = (mensaje) => ({ ok: false, error: mensaje, captura: null });

  if (!TIPOS_CAPTURA.includes(tipo)) return error('Tipo de registro no válido.');
  if (!corral?.id) return error('Elegí un corral.');
  if (!corral.loteId) return error(`${corral.nombre || 'El corral'} no tiene cerdos ahorita.`);
  const nombreEmpleado = texto(empleado, 60);
  if (!nombreEmpleado) return error('Falta decir quién registra.');
  if (!FECHA_ISO.test(String(fecha || ''))) return error('La fecha no es válida.');
  if (hoy && fecha > hoy) return error('La fecha no puede ser futura.');

  const base = {
    tipo,
    estado: ESTADO_CAPTURA.pendiente,
    corralId: String(corral.id),
    corralNombre: texto(corral.nombre, 60),
    loteId: String(corral.loteId),
    loteNombre: texto(corral.loteNombre, 60),
    fecha,
    empleado: nombreEmpleado,
    nota: texto(datos.nota, 300),
    creadaEn: ahora,
    creadaPorUid: texto(uid, 128)
  };

  if (tipo === 'concentrado') {
    const cantidad = numero(datos.cantidad);
    const unidad = datos.unidad === 'lb' ? 'lb' : 'sacos';
    const alimento = texto(datos.alimento, 60);
    if (!alimento) return error('Elegí el concentrado.');
    if (!(cantidad > 0)) return error('Poné cuánto concentrado serviste.');
    if (cantidad > (unidad === 'sacos' ? 200 : 20000)) return error('Esa cantidad es demasiado grande. Revisala.');
    return { ok: true, error: null, captura: { ...base, alimento, cantidad: redondear(cantidad), unidad, fase: Number(corral.fase) || 0 } };
  }

  if (tipo === 'medicamento' || tipo === 'insumo') {
    const cantidad = numero(datos.cantidad);
    const productoId = texto(datos.productoId, 80);
    const nombre = texto(datos.nombre, 80);
    if (!nombre) return error(tipo === 'medicamento' ? 'Elegí o escribí el medicamento.' : 'Elegí el insumo.');
    if (tipo === 'insumo' && !productoId) return error('Elegí el insumo de la lista.');
    if (!(cantidad > 0)) return error('Poné la cantidad que usaste.');
    if (cantidad > 10000) return error('Esa cantidad es demasiado grande. Revisala.');
    return { ok: true, error: null, captura: { ...base, productoId, nombre, unidad: texto(datos.unidad, 20), cantidad: redondear(cantidad) } };
  }

  if (tipo === 'peso') {
    const pesos = (Array.isArray(datos.pesos) ? datos.pesos : [])
      .map(numero)
      .filter((p) => p > 0);
    if (pesos.length === 0) return error('Anotá al menos un peso.');
    if (pesos.some((p) => p > 800)) return error('Hay un peso mayor a 800 lb. Revisalo.');
    const promedio = pesos.reduce((s, p) => s + p, 0) / pesos.length;
    return { ok: true, error: null, captura: { ...base, pesos: pesos.map((p) => redondear(p, 1)), pesoPromedio: redondear(promedio) } };
  }

  // baja
  const cantidad = Math.round(numero(datos.cantidad));
  const causa = texto(datos.causa, 120);
  if (!(cantidad > 0)) return error('Poné cuántos cerdos murieron.');
  if (corral.cerdos > 0 && cantidad > corral.cerdos) return error(`En ${corral.nombre} solo hay ${corral.cerdos} cerdos.`);
  if (!causa) return error('Escribí la causa.');
  return { ok: true, error: null, captura: { ...base, cantidad, causa } };
}

// Texto corto para listas: "2 sacos de VITACERDO 1".
export function describirCaptura(captura) {
  if (!captura) return '';
  switch (captura.tipo) {
    case 'concentrado':
      return `${formatearCantidad(captura.cantidad)} ${captura.unidad === 'lb' ? 'lb' : (Number(captura.cantidad) === 1 ? 'saco' : 'sacos')} de ${captura.alimento}`;
    case 'medicamento':
    case 'insumo':
      return `${formatearCantidad(captura.cantidad)} ${captura.unidad || ''} de ${captura.nombre}`.replace(/\s+/g, ' ').trim();
    case 'peso': {
      const n = Array.isArray(captura.pesos) ? captura.pesos.length : 0;
      return `${formatearCantidad(captura.pesoPromedio)} lb promedio${n > 1 ? ` (${n} cerdos)` : ''}`;
    }
    case 'baja':
      return `${captura.cantidad} cerdo${Number(captura.cantidad) === 1 ? '' : 's'} · ${captura.causa}`;
    default:
      return '';
  }
}

// Id del registro que nace de una captura. Es fijo para que aprobar dos veces
// la misma captura (por ejemplo, tras un corte de señal) no la duplique.
export const idRegistroDeCaptura = (capturaId, sufijo = '') => `emp_${capturaId}${sufijo}`;

const CLAVE_PRINCIPAL = {
  concentrado: 'alimentos',
  medicamento: 'vacunas',
  insumo: 'usosInsumos',
  peso: 'pesos',
  baja: 'bajas'
};

const cambiosVacios = () => ({
  alimentos: [], pesos: [], bajas: [], usosMedicos: [], vacunas: [], usosInsumos: [], gastosExtra: []
});

/**
 * Convierte capturas pendientes en registros de la app principal.
 *
 * ctx = {
 *   lotes, catalogoAlimento, inventarioCentral, inventarioMedico, inventarioInsumos,
 *   vivosPorLote: (loteId) => number,
 *   existentes: { alimentos, pesos, bajas, vacunas, usosInsumos }   // registros ya guardados
 * }
 *
 * Procesa en orden y va descontando stock y cerdos vivos entre una captura y la
 * siguiente, para que "aprobar todo" no deje pasar más de lo que hay en bodega.
 * No modifica nada: devuelve los registros a agregar por cada lista.
 */
export function aplicarCapturas(capturas = [], ctx = {}) {
  const {
    lotes = [],
    catalogoAlimento = [],
    inventarioCentral = [],
    inventarioMedico = [],
    inventarioInsumos = [],
    vivosPorLote = () => 0,
    existentes = {}
  } = ctx;

  const cambios = cambiosVacios();
  const resultados = [];

  const lbsUsadas = new Map();        // concentrado por nombre
  const medUsado = new Map();         // medicamento por id
  const insumoUsado = new Map();      // insumo por id
  const bajasNuevas = new Map();      // cerdos por lote

  const yaExiste = (clave, id) => Array.isArray(existentes[clave]) && existentes[clave].some((r) => r && r.id === id);

  for (const captura of capturas) {
    const falla = (mensaje) => resultados.push({ capturaId: captura?.id, ok: false, error: mensaje });

    if (!captura?.id || !TIPOS_CAPTURA.includes(captura.tipo)) {
      falla('Captura inválida.');
      continue;
    }

    const idPrincipal = idRegistroDeCaptura(captura.id);
    if (yaExiste(CLAVE_PRINCIPAL[captura.tipo], idPrincipal)) {
      resultados.push({ capturaId: captura.id, ok: true, yaAplicada: true, registroId: idPrincipal });
      continue;
    }

    const lote = lotes.find((l) => l && String(l.id) === String(captura.loteId));
    if (!lote || lote.estado !== 'Activo') {
      falla(`El lote de ${captura.corralNombre || 'ese corral'} ya no está activo.`);
      continue;
    }

    const origen = { origenRegistro: 'empleado', registradoPor: captura.empleado || '', capturaId: captura.id };
    const notaEmpleado = captura.nota ? ` · ${captura.nota}` : '';

    if (captura.tipo === 'concentrado') {
      const reservado = lbsUsadas.get(captura.alimento) || 0;
      const inventarioAjustado = inventarioCentral.map((item) => (
        item.nombre === captura.alimento
          ? { ...item, stockLbs: Math.max(0, (Number(item.stockLbs) || 0) - reservado) }
          : item
      ));
      const calculo = calcularDescuentoTolva({
        tipoAlimento: captura.alimento,
        cantidad: captura.cantidad,
        unidad: captura.unidad === 'lb' ? 'lb' : 'sacos',
        faseDestino: Number(lote.faseActual) || captura.fase,
        fecha: captura.fecha,
        loteActivo: lote,
        catalogoAlimento,
        inventarioCentral: inventarioAjustado,
        origenRegistro: 'empleado'
      });
      if (!calculo.ok) {
        falla(calculo.error);
        continue;
      }
      lbsUsadas.set(captura.alimento, reservado + calculo.librasSuministradas);
      cambios.alimentos.push({ id: idPrincipal, ...calculo.registro, ...origen });
      resultados.push({ capturaId: captura.id, ok: true, registroId: idPrincipal, costo: calculo.costoTotal });
      continue;
    }

    if (captura.tipo === 'medicamento') {
      const cantidad = Number(captura.cantidad) || 0;
      const producto = captura.productoId ? inventarioMedico.find((m) => m.id === captura.productoId) : null;
      let costo = 0;
      let usoMedicoId = null;

      if (captura.productoId && !producto) {
        falla(`${captura.nombre} ya no está en el catálogo médico.`);
        continue;
      }
      if (producto) {
        const usado = medUsado.get(producto.id) || 0;
        const disponible = (Number(producto.stock) || 0) - usado;
        if (disponible + 1e-6 < cantidad) {
          falla(`Stock insuficiente de ${producto.nombre}: quedan ${Math.max(0, disponible).toFixed(2)} ${producto.unidad || ''} en la farmacia.`.trim());
          continue;
        }
        medUsado.set(producto.id, usado + cantidad);
        costo = cantidad * (Number(producto.costoPromedio) || 0);
        usoMedicoId = idRegistroDeCaptura(captura.id, '_uso');
        cambios.usosMedicos.push({
          id: usoMedicoId,
          productoId: producto.id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          unidad: producto.unidad,
          fecha: captura.fecha,
          cantidad,
          costo,
          loteId: lote.id,
          tareaId: '',
          observacion: `Aplicado por ${captura.empleado || 'empleado'}${notaEmpleado}`,
          ...origen
        });
      }

      const unidad = producto?.unidad || captura.unidad || '';
      cambios.vacunas.push({
        id: idPrincipal,
        loteId: lote.id,
        fecha: captura.fecha,
        nombre: `${producto?.nombre || captura.nombre} (${formatearCantidad(cantidad)}${unidad ? ` ${unidad}` : ''})`,
        costo,
        usoMedicoId,
        ...origen
      });
      resultados.push({ capturaId: captura.id, ok: true, registroId: idPrincipal, costo, sinCosto: !producto });
      continue;
    }

    if (captura.tipo === 'insumo') {
      const cantidad = Number(captura.cantidad) || 0;
      const producto = inventarioInsumos.find((i) => i.id === captura.productoId);
      if (!producto) {
        falla(`${captura.nombre} ya no está en el catálogo de insumos.`);
        continue;
      }
      const usado = insumoUsado.get(producto.id) || 0;
      const disponible = (Number(producto.stock) || 0) - usado;
      if (disponible + 1e-6 < cantidad) {
        falla(`Stock insuficiente de ${producto.nombre}: quedan ${Math.max(0, disponible).toFixed(2)} ${producto.unidad || ''} en bodega.`.trim());
        continue;
      }
      insumoUsado.set(producto.id, usado + cantidad);
      const costo = cantidad * (Number(producto.costoPromedio) || 0);
      cambios.usosInsumos.push({
        id: idPrincipal,
        productoId: producto.id,
        nombre: producto.nombre,
        unidad: producto.unidad,
        fecha: captura.fecha,
        cantidad,
        costo,
        loteId: lote.id,
        observacion: `Usado por ${captura.empleado || 'empleado'}${notaEmpleado}`,
        ...origen
      });
      // Igual que en la app principal: el costo entra como gasto operativo del lote.
      cambios.gastosExtra.push({
        id: idRegistroDeCaptura(captura.id, '_gasto'),
        loteId: lote.id,
        fecha: captura.fecha,
        descripcion: `${producto.nombre} (${formatearCantidad(cantidad)} ${producto.unidad})`,
        monto: costo,
        usoInsumoId: idPrincipal
      });
      resultados.push({ capturaId: captura.id, ok: true, registroId: idPrincipal, costo });
      continue;
    }

    if (captura.tipo === 'peso') {
      const pesos = (Array.isArray(captura.pesos) ? captura.pesos : []).map(Number).filter((p) => p > 0);
      const promedio = pesos.length > 0
        ? pesos.reduce((s, p) => s + p, 0) / pesos.length
        : Number(captura.pesoPromedio) || 0;
      if (!(promedio > 0)) {
        falla('El pesaje no trae pesos válidos.');
        continue;
      }
      cambios.pesos.push({
        id: idPrincipal,
        loteId: lote.id,
        fecha: captura.fecha,
        pesoPromedio: redondear(promedio),
        metodo: 'directo',
        ...(pesos.length > 1
          ? {
              cantidadMuestra: pesos.length,
              muestraPesos: pesos.map((p, idx) => ({ numero: idx + 1, pesoLb: p, metodo: 'directo' }))
            }
          : {}),
        ...origen
      });
      resultados.push({ capturaId: captura.id, ok: true, registroId: idPrincipal });
      continue;
    }

    // baja
    const cantidad = Math.round(Number(captura.cantidad) || 0);
    const yaDescontados = bajasNuevas.get(lote.id) || 0;
    const vivos = (Number(vivosPorLote(lote.id)) || 0) - yaDescontados;
    if (!(cantidad > 0) || cantidad > vivos) {
      falla(`La baja (${cantidad}) supera los cerdos vivos del lote (${Math.max(0, vivos)}).`);
      continue;
    }
    bajasNuevas.set(lote.id, yaDescontados + cantidad);
    cambios.bajas.push({
      id: idPrincipal,
      loteId: lote.id,
      fecha: captura.fecha,
      causa: captura.causa || 'Sin especificar',
      cantidad,
      ...origen
    });
    resultados.push({ capturaId: captura.id, ok: true, registroId: idPrincipal });
  }

  return { cambios, resultados };
}

export const hayCambios = (cambios) => Object.values(cambios || {}).some((lista) => Array.isArray(lista) && lista.length > 0);
