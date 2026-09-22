import { parseLocalDate } from './lotStatistics.js';

const DAY_MS = 86_400_000;

// Planes de Innosure segun el plan de corrales de la granja. Las semanas se cuentan
// desde la FECHA DE INGRESO al corral de engorde, no desde el nacimiento.
export const INNOSURE_PLANS = {
  20: { semanas: 20, primeraDosisDia: 70, segundaDosisDia: 112, salidaDia: 140 },
  22: { semanas: 22, primeraDosisDia: 84, segundaDosisDia: 126, salidaDia: 154 }
};

export const PLAN_INNOSURE_POR_DEFECTO = 22;

// Los dos minimos que SI hay que hacer cumplir. El plan teorico es una sugerencia y en
// la practica los lotes van atrasados, pero estos dos margenes no se negocian: el de la
// segunda dosis a la venta es inocuidad alimentaria.
export const MIN_DIAS_ENTRE_DOSIS = 14;
export const MIN_DIAS_SEGUNDA_DOSIS_A_VENTA = 21;

// Plan de recuperacion para lotes atrasados: en vez de las 6 semanas entre dosis del
// plan estandar, se aprietan a 3 para no correr mas la fecha de salida. El propio plan
// de la granja lo marca como algo a confirmar con el veterinario.
export const SEPARACION_FLEXIBLE_DIAS = 21;

export const addDays = (isoDate, days) => {
  const base = parseLocalDate(isoDate);
  if (!base) return null;
  const result = new Date(base.getTime());
  result.setDate(result.getDate() + days);
  return result.toISOString().split('T')[0];
};

const diffDays = (desdeIso, hastaIso) => {
  const a = parseLocalDate(desdeIso);
  const b = parseLocalDate(hastaIso);
  if (!a || !b) return null;
  return Math.round((b - a) / DAY_MS);
};

const laterOf = (a, b) => {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
};

const toIso = (date) => date.toISOString().split('T')[0];

/**
 * Composicion del lote por sexo y estado de castracion.
 * Solo los machos ENTEROS (no capados) necesitan Innosure: las hembras y los machos
 * castrados quirurgicamente nunca lo llevan.
 *
 * El desglose describe a los animales que estan HOY en el corral, no al lote original:
 * es lo que el productor puede contar parado frente al corral, y es sobre lo que se
 * aplican las dosis. Por eso `totalVivos` se compara contra los vivos y no contra la
 * cantidad de ingreso.
 */
export function composicionLote(lote, totalVivos = null) {
  const total = totalVivos !== null && totalVivos !== undefined
    ? Math.max(0, Number(totalVivos) || 0)
    : Math.max(0, Number(lote?.cantidad) || 0);
  const machos = Math.max(0, Number(lote?.machos) || 0);
  const hembras = Math.max(0, Number(lote?.hembras) || 0);
  const machosCapados = Math.min(machos, Math.max(0, Number(lote?.machosCapados) || 0));
  const machosEnteros = Math.max(0, machos - machosCapados);
  const sexoRegistrado = (machos + hembras) > 0;

  return {
    total,
    machos,
    hembras,
    machosCapados,
    machosEnteros,
    sexoRegistrado,
    // Aviso suave: el desglose por sexo no coincide con la cantidad del lote.
    descuadreSexo: sexoRegistrado && (machos + hembras) !== total,
    diferenciaSexo: sexoRegistrado ? (machos + hembras) - total : 0
  };
}

const buscarDosis = (tareas, loteId, numero) =>
  tareas.find((t) => t.loteId === loteId && Number(t.innosureDosis) === numero) || null;

const fechaRealDe = (tarea) => {
  if (!tarea || (tarea.estado || 'pendiente') !== 'hecho') return null;
  return tarea.completadoEn || tarea.fechaObjetivo || null;
};

/**
 * Calendario de Innosure de un lote: fechas sugeridas, fechas reales aplicadas,
 * minimos obligatorios y si el lote ya se puede vender.
 */
export function calcularPlanInnosure({ lote, tareas = [], totalVivos = null, now = new Date() }) {
  const composicion = composicionLote(lote, totalVivos);
  const hoy = toIso(now);

  const tarea1 = lote ? buscarDosis(tareas, lote.id, 1) : null;
  const tarea2 = lote ? buscarDosis(tareas, lote.id, 2) : null;
  // Que existan dosis registradas es prueba de que el lote lleva Innosure, aunque
  // todavia no se haya cargado el desglose por sexo. El bloqueo de venta no puede
  // depender de un dato de captura opcional: depende de lo que se le puso al animal.
  const tieneRegistroInnosure = Boolean(tarea1 || tarea2);

  if (!lote || !lote.fechaIngreso || (composicion.machosEnteros <= 0 && !tieneRegistroInnosure)) {
    return {
      ...composicion,
      aplica: false,
      // Sin machos enteros no hay restriccion sanitaria que impida vender.
      puedeVender: true,
      motivoBloqueo: null,
      ventaHabilitadaDesde: null,
      diasParaPoderVender: 0,
      primeraDosis: null,
      segundaDosis: null
    };
  }

  const plan = INNOSURE_PLANS[Number(lote.planInnosure)] || INNOSURE_PLANS[PLAN_INNOSURE_POR_DEFECTO];
  const separacionPlan = plan.segundaDosisDia - plan.primeraDosisDia;

  const real1 = fechaRealDe(tarea1);
  const real2 = fechaRealDe(tarea2);

  const sugerida1 = addDays(lote.fechaIngreso, plan.primeraDosisDia);

  // Un lote va atrasado si la 1a dosis se aplico despues de lo planeado, o si todavia no
  // se aplico y la fecha sugerida ya paso. En ese caso se pasa al plan flexible de 3
  // semanas entre dosis para no correr mas la salida.
  const atrasado = real1 ? real1 > sugerida1 : hoy > sugerida1;
  const separacionAplicable = atrasado ? SEPARACION_FLEXIBLE_DIAS : separacionPlan;

  // --- FECHAS EFECTIVAS ---
  // Si una dosis ya se aplico manda su fecha real. Si no se aplico y su fecha sugerida
  // YA PASO, lo antes que puede ocurrir es hoy: proyectar con una fecha vencida daria
  // una salida imposible, anterior al día en que todavía falta pinchar al animal.
  const efectiva1 = real1 || laterOf(sugerida1, hoy);

  // Una vez aplicada la primera, la segunda se recalcula desde la fecha REAL y nunca
  // puede quedar antes del minimo de dos semanas.
  const minima2 = real1 ? addDays(real1, MIN_DIAS_ENTRE_DOSIS) : null;
  const sugerida2 = real1
    ? laterOf(addDays(real1, separacionAplicable), minima2)
    : laterOf(addDays(efectiva1, separacionAplicable), addDays(lote.fechaIngreso, plan.segundaDosisDia));
  const efectiva2 = real2 || laterOf(sugerida2, hoy);

  const ventaHabilitadaDesde = real2 ? addDays(real2, MIN_DIAS_SEGUNDA_DOSIS_A_VENTA) : null;

  // --- RECALCULO DE LA SALIDA ---
  // La salida se corre con los atrasos, igual que en el plan de corrales: se toma la
  // segunda dosis (real si ya se aplico, proyectada si no) y se le suman las 3 semanas
  // obligatorias. Nunca queda antes de la salida teorica del plan.
  const salidaTeorica = addDays(lote.fechaIngreso, plan.salidaDia);
  const salidaPorInnosure = efectiva2 ? addDays(efectiva2, MIN_DIAS_SEGUNDA_DOSIS_A_VENTA) : null;
  const salidaSugerida = laterOf(salidaTeorica, salidaPorInnosure);
  const diasDeAtrasoSalida = Math.max(0, diffDays(salidaTeorica, salidaSugerida) || 0);

  let puedeVender = false;
  let motivoBloqueo = null;
  let diasParaPoderVender = 0;

  if (!real1) {
    motivoBloqueo = `Falta aplicar la 1ª dosis de Innosure a los ${composicion.machosEnteros} machos enteros de este lote.`;
  } else if (!real2) {
    motivoBloqueo = `Falta aplicar la 2ª dosis de Innosure. No se puede vender hasta 3 semanas después de esa dosis.`;
  } else {
    const restantes = diffDays(hoy, ventaHabilitadaDesde);
    if (restantes !== null && restantes > 0) {
      diasParaPoderVender = restantes;
      motivoBloqueo = `La 2ª dosis de Innosure se aplicó el ${real2}. La venta se habilita el ${ventaHabilitadaDesde} (faltan ${restantes} días).`;
    } else {
      puedeVender = true;
    }
  }

  const diasDesdeIngreso = diffDays(lote.fechaIngreso, hoy);

  return {
    ...composicion,
    aplica: true,
    // Aplica por sus dosis registradas pero falta cargar el sexo del lote.
    aplicaSinComposicion: composicion.machosEnteros <= 0,
    plan: plan.semanas,
    puedeVender,
    motivoBloqueo,
    ventaHabilitadaDesde,
    diasParaPoderVender,
    // Salida recalculada con los atrasos reales, contra la teorica del plan.
    salidaSugerida,
    salidaTeorica,
    diasDeAtrasoSalida,
    semanasSalida: plan.salidas ?? plan.semanas,
    atrasado,
    modoFlexible: atrasado,
    separacionAplicadaDias: separacionAplicable,
    diasDesdeIngreso,
    primeraDosis: {
      numero: 1,
      fechaSugerida: sugerida1,
      // Lo antes que puede ocurrir realmente: hoy si la sugerida ya paso.
      fechaProyectada: efectiva1,
      fechaReal: real1,
      aplicada: Boolean(real1),
      tareaId: tarea1?.id || null,
      vencida: !real1 && sugerida1 !== null && sugerida1 < hoy,
      diasDeAtraso: !real1 ? Math.max(0, diffDays(sugerida1, hoy) || 0) : 0
    },
    segundaDosis: {
      numero: 2,
      fechaSugerida: sugerida2,
      fechaProyectada: efectiva2,
      fechaReal: real2,
      fechaMinima: minima2,
      aplicada: Boolean(real2),
      tareaId: tarea2?.id || null,
      habilitada: Boolean(real1),
      vencida: Boolean(real1) && !real2 && sugerida2 !== null && sugerida2 < hoy,
      diasDeAtraso: Boolean(real1) && !real2 ? Math.max(0, diffDays(sugerida2, hoy) || 0) : 0
    }
  };
}

/**
 * Decide que hacer con las tareas sanitarias de un lote para que reflejen el protocolo
 * vigente, SIN destruir nada de lo que ya se aplico.
 *
 * Reglas:
 *  - Una tarea marcada como hecha NUNCA se toca ni se borra, aunque su paso ya no exista
 *    en el protocolo: es historial de lo que realmente se le puso al animal.
 *  - Una tarea pendiente cuyo paso desaparecio del protocolo se elimina (quedo huerfana).
 *  - Un paso del protocolo sin tarea se agrega.
 *  - Una tarea pendiente cuya fecha objetivo ya no coincide se reprograma.
 *
 * Devuelve un plan de cambios; quien lo ejecuta se encarga de generar los ids.
 */
export function planificarSincronizacion({ lote, pasosProtocolo = [], tareasActuales = [], totalVivos = null }) {
  const vacio = { conservar: [], agregar: [], reprogramar: [], eliminar: [], sinCambios: true };
  if (!lote || !lote.fechaIngreso) return vacio;

  const composicion = composicionLote(lote, totalVivos);
  const plan = INNOSURE_PLANS[Number(lote.planInnosure)] || INNOSURE_PLANS[PLAN_INNOSURE_POR_DEFECTO];

  // Pasos que este lote deberia tener hoy.
  const esperados = pasosProtocolo.map((paso) => ({
    clave: `protocolo:${paso.id}`,
    paso,
    dia: Number(paso.dia) || 0,
    innosureDosis: null
  }));

  // Igual que en calcularPlanInnosure: si el lote ya tiene dosis registradas, el
  // Innosure le corresponde aunque falte cargar el desglose por sexo. Asi la
  // sincronizacion nunca borra una dosis programada por no tener ese dato.
  const tieneRegistroInnosure = tareasActuales.some((t) => t.loteId === lote.id && t.innosureDosis);
  if (composicion.machosEnteros > 0 || tieneRegistroInnosure) {
    esperados.push(
      { clave: 'innosure:1', paso: null, dia: plan.primeraDosisDia, innosureDosis: 1 },
      { clave: 'innosure:2', paso: null, dia: plan.segundaDosisDia, innosureDosis: 2 }
    );
  }

  const claveDeTarea = (t) => (
    t.innosureDosis ? `innosure:${Number(t.innosureDosis)}` : `protocolo:${t.protocoloId}`
  );

  const propias = tareasActuales.filter((t) => t.loteId === lote.id);
  const conservar = [];
  const eliminar = [];
  const reprogramar = [];
  const agregar = [];
  const clavesCubiertas = new Set();

  for (const tarea of propias) {
    const clave = claveDeTarea(tarea);
    const esperado = esperados.find((e) => e.clave === clave);
    const hecha = (tarea.estado || 'pendiente') === 'hecho';

    if (hecha) {
      // Historial: se conserva siempre, exista o no el paso en el protocolo actual.
      conservar.push(tarea);
      clavesCubiertas.add(clave);
      continue;
    }

    if (!esperado) {
      eliminar.push(tarea);
      continue;
    }

    clavesCubiertas.add(clave);

    // Las dosis de Innosure no se reprograman por dia fijo: su fecha depende de cuando
    // se aplico realmente la anterior, y la calcula calcularPlanInnosure. Reprogramarlas
    // aqui pisaria la fecha que el productor tiene planificada.
    if (esperado.innosureDosis) {
      conservar.push(tarea);
      continue;
    }

    const fechaCorrecta = addDays(lote.fechaIngreso, esperado.dia);
    if (tarea.fechaObjetivo !== fechaCorrecta || Number(tarea.dia) !== esperado.dia) {
      reprogramar.push({ tarea, dia: esperado.dia, fechaObjetivo: fechaCorrecta });
    } else {
      conservar.push(tarea);
    }
  }

  for (const esperado of esperados) {
    if (clavesCubiertas.has(esperado.clave)) continue;
    agregar.push({
      ...esperado,
      fechaObjetivo: addDays(lote.fechaIngreso, esperado.dia),
      machosEnteros: composicion.machosEnteros
    });
  }

  return {
    conservar,
    agregar,
    reprogramar,
    eliminar,
    sinCambios: agregar.length === 0 && reprogramar.length === 0 && eliminar.length === 0
  };
}

/**
 * Valida una fecha propuesta para aplicar una dosis, antes de registrarla.
 */
export function validarFechaDosis({ numero, fecha, fechaPrimeraDosis }) {
  if (!parseLocalDate(fecha)) return { valida: false, mensaje: 'La fecha no es válida.' };
  if (numero !== 2) return { valida: true, mensaje: null };
  if (!fechaPrimeraDosis) {
    return { valida: false, mensaje: 'Primero hay que registrar la 1ª dosis.' };
  }
  const separacion = diffDays(fechaPrimeraDosis, fecha);
  if (separacion === null || separacion < MIN_DIAS_ENTRE_DOSIS) {
    return {
      valida: false,
      mensaje: `Entre la 1ª y la 2ª dosis deben pasar al menos ${MIN_DIAS_ENTRE_DOSIS} días (2 semanas). La 1ª fue el ${fechaPrimeraDosis}, así que la 2ª no puede ser antes del ${addDays(fechaPrimeraDosis, MIN_DIAS_ENTRE_DOSIS)}.`
    };
  }
  return { valida: true, mensaje: null };
}
