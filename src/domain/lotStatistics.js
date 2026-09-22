const DAY_MS = 86_400_000;

// Topes de cordura para la mortalidad esperada a futuro. La mortalidad porcina
// esta cargada al inicio del ciclo, asi que extrapolar linealmente la tasa de un
// lote joven sobreestima muchisimo. Estos limites acotan esa distorsion.
const MAX_PROJECTION_DAYS = 180;
const EXPECTED_MORTALITY_CAP_RATE = 0.1;

// Rango biologico de conversion alimenticia. Una FCA fuera de aqui siempre es un
// artefacto de datos (tipico: lote con alimento registrado pero sin pesajes), y
// proyectarla hacia adelante multiplica el disparate.
const PROJECTION_FCA_MIN = 2.5;
const PROJECTION_FCA_MAX = 4.5;
const DEFAULT_FCA = 2.5;

// La FCA acumulada del ciclo es mejor que la marginal de finalizacion: el lechon
// convierte mucho mas eficiente que el cerdo de engorde. Proyectar el tramo final con
// la acumulada subestima siempre el alimento que falta.
// El factor sale del propio CRONOGRAMA_ALIMENTACION:
//   ciclo completo -> 496.4 lb de alimento para 207 lb de ganancia = 2.40
//   fases 6 y 7    -> 344.6 lb de alimento para ~120 lb de ganancia = 2.87
//   2.87 / 2.40 = 1.20
const MARGINAL_FCA_FACTOR = 1.2;

// FCA de referencia para estimar peso a partir del alimento consumido. Se usa una
// conversion conservadora (peor que la ideal del cronograma) para que la estimacion
// peque de prudente y no de optimista.
const WEIGHT_ESTIMATE_FCA = 3;
const STALE_WEIGHING_DAYS = 21;
const MAX_ESTIMATED_WEIGHT_RATIO = 1.3;

// Suma del consumo por cerdo de un ciclo completo segun CRONOGRAMA_ALIMENTACION.
const FULL_CYCLE_FEED_PER_PIG_LB = 496.4;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function parseLocalDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calculateLotDays(entryDate, exitDate, now = new Date()) {
  const entry = parseLocalDate(entryDate);
  const exit = exitDate ? parseLocalDate(exitDate) : now;
  if (!entry || !exit || exit < entry) return null;
  return Math.max(1, Math.ceil((exit - entry) / DAY_MS));
}

const sum = (items, selector) => items.reduce((total, item) => total + (Number(selector(item)) || 0), 0);

const getSaleWeightLb = (sale) => {
  if (Number(sale.totalLibras) > 0) return Number(sale.totalLibras);
  if (Array.isArray(sale.pesosVenta)) {
    return sum(sale.pesosVenta, (item) => typeof item === 'number' ? item : item?.peso);
  }
  return (Number(sale.pesoPromedioLibras) || 0) * (Number(sale.cantidadCerdos) || 0);
};

const calculateAnimalDays = ({ entryDate, exitDate, initialCount, deaths, sales, now }) => {
  const entry = parseLocalDate(entryDate);
  const end = exitDate ? parseLocalDate(exitDate) : now;
  if (!entry || !end || end < entry || initialCount <= 0) return 0;

  const events = [
    ...deaths.map((item) => ({
      date: parseLocalDate(item.fecha) || end,
      quantity: Number(item.cantidad) || 0
    })),
    ...sales.map((item) => ({
      date: parseLocalDate(item.fecha) || end,
      quantity: Number(item.cantidadCerdos) || 0
    }))
  ]
    .filter((event) => event.quantity > 0 && event.date >= entry && event.date <= end)
    .toSorted((a, b) => a.date - b.date);

  let currentCount = initialCount;
  let cursor = entry;
  let animalDays = 0;

  for (const event of events) {
    animalDays += Math.max(0, Math.ceil((event.date - cursor) / DAY_MS)) * Math.max(0, currentCount);
    currentCount = Math.max(0, currentCount - event.quantity);
    cursor = event.date;
  }

  animalDays += Math.max(0, Math.ceil((end - cursor) / DAY_MS)) * Math.max(0, currentCount);
  return animalDays;
};

// El pesaje registrado es el promedio de TODO el lote en esa fecha. Si despues se
// vendieron cerdos (normalmente los mas pesados), el promedio de los que quedan ya
// no es ese numero. Aqui se reconstruye el peso real del remanente usando las libras
// de bascula de cada venta, que ya quedan guardadas en el registro.
const calculateResidualWeight = ({ lastWeight, lastWeightDate, initialCount, deaths, sales, end }) => {
  const fallback = { weight: lastWeight, adjusted: false };
  if (!(lastWeight > 0) || initialCount <= 0) return fallback;

  const reference = parseLocalDate(lastWeightDate);
  if (!reference || !end) return fallback;

  const events = [
    ...deaths.map((item) => ({
      kind: 'death',
      date: parseLocalDate(item.fecha) || end,
      quantity: Number(item.cantidad) || 0,
      weightLb: 0
    })),
    ...sales.map((item) => ({
      kind: 'sale',
      date: parseLocalDate(item.fecha) || end,
      quantity: Number(item.cantidadCerdos) || 0,
      weightLb: getSaleWeightLb(item)
    }))
  ].filter((event) => event.quantity > 0);

  // Cerdos que seguian en el corral el dia del pesaje.
  const removedBefore = sum(events.filter((event) => event.date <= reference), (event) => event.quantity);
  let count = initialCount - removedBefore;
  if (count <= 0) return fallback;

  const laterEvents = events.filter((event) => event.date > reference).toSorted((a, b) => a.date - b.date);
  if (!laterEvents.some((event) => event.kind === 'sale')) return fallback;

  let totalLb = lastWeight * count;

  for (const event of laterEvents) {
    // Si un evento se lleva todo lo que queda, no hay remanente que promediar:
    // se conserva el ultimo pesaje registrado para no dejar las pantallas en cero.
    if (event.quantity >= count) return fallback;

    if (event.kind === 'sale') {
      totalLb -= event.weightLb;
    } else {
      // A una baja se le imputa el promedio vigente: no se conoce su peso real.
      totalLb -= (totalLb / count) * event.quantity;
    }
    count -= event.quantity;
  }

  const residual = totalLb / count;
  // Dato corrupto (p. ej. mas libras vendidas de las que existian): se ignora el ajuste.
  if (!Number.isFinite(residual) || residual <= 0) return fallback;

  return { weight: residual, adjusted: true };
};

// Mortalidad que cabe esperar de aqui al cierre, segun el propio historial del lote.
const calculateExpectedDeaths = ({
  deathCount,
  animalDays,
  currentCount,
  adg,
  currentWeight,
  targetWeightLb,
  isClosed
}) => {
  if (isClosed || currentCount <= 0 || animalDays <= 0 || deathCount <= 0) return 0;
  if (!(adg > 0) || currentWeight <= 0 || currentWeight >= targetWeightLb) return 0;

  const remainingDays = Math.min(MAX_PROJECTION_DAYS, (targetWeightLb - currentWeight) / adg);
  if (!(remainingDays > 0)) return 0;

  const dailyRate = deathCount / animalDays;
  const expected = dailyRate * currentCount * remainingDays;
  if (!Number.isFinite(expected) || expected <= 0) return 0;

  return Math.min(expected, currentCount * EXPECTED_MORTALITY_CAP_RATE);
};

export function calculateLotStatistics({
  lot,
  deaths = [],
  feedings = [],
  sales = [],
  weights = [],
  vaccines = [],
  extraExpenses = [],
  catalog = [],
  extraProjectedDeaths = 0,
  targetWeightLb = 220,
  mixAlertWeight = 100,
  staleWeighingDays = STALE_WEIGHING_DAYS,
  cycleFeedPerPigLb = FULL_CYCLE_FEED_PER_PIG_LB,
  now = new Date()
}) {
  if (!lot) return null;

  const lotDeaths = deaths.filter((item) => item.loteId === lot.id);
  const lotFeedings = feedings.filter((item) => item.loteId === lot.id);
  const lotSales = sales.filter((item) => item.loteId === lot.id);
  const lotWeights = weights
    .filter((item) => item.loteId === lot.id && Number(item.pesoPromedio) > 0)
    .toSorted((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
  const lotVaccines = vaccines.filter((item) => item.loteId === lot.id);
  const lotExpenses = extraExpenses.filter((item) => item.loteId === lot.id);

  const initialCount = Math.max(0, Number(lot.cantidad) || 0);
  const deathCount = sum(lotDeaths, (item) => item.cantidad);
  const soldCount = sum(lotSales, (item) => item.cantidadCerdos);
  const currentCount = Math.max(0, initialCount - deathCount - soldCount);
  const lotDays = calculateLotDays(lot.fechaIngreso, lot.fechaSalida, now);

  const initialWeight = lotWeights.at(0)?.pesoPromedio || 0;
  const recordedWeight = lotWeights.at(-1)?.pesoPromedio || 0;
  const residual = calculateResidualWeight({
    lastWeight: recordedWeight,
    lastWeightDate: lotWeights.at(-1)?.fecha,
    initialCount,
    deaths: lotDeaths,
    sales: lotSales,
    end: (lot.fechaSalida ? parseLocalDate(lot.fechaSalida) : now) || now
  });
  // Peso que manda en toda la matematica de dinero y de proyeccion.
  const currentWeight = residual.weight;

  const weightGainLb = Math.max(0, currentWeight - initialWeight);
  const totalFeedLb = sum(lotFeedings, (item) => item.cantidadLb);
  const soldWeightLb = sum(lotSales, getSaleWeightLb);
  const soldWeightGainLb = Math.max(0, soldWeightLb - (initialWeight * soldCount));
  const liveWeightGainLb = weightGainLb * currentCount;
  const producedWeightGainLb = liveWeightGainLb + soldWeightGainLb;
  const animalDays = calculateAnimalDays({
    entryDate: lot.fechaIngreso,
    exitDate: lot.fechaSalida,
    initialCount,
    deaths: lotDeaths,
    sales: lotSales,
    now
  });
  const fca = producedWeightGainLb > 0 ? totalFeedLb / producedWeightGainLb : 0;
  const adg = animalDays > 0 && producedWeightGainLb > 0 ? producedWeightGainLb / animalDays : 0;
  const mortalityPercentage = initialCount > 0 ? (deathCount / initialCount) * 100 : 0;

  // --- CONSUMO ACUMULADO CONTRA EL CICLO COMPLETO ---
  // Cabezas promedio reales: un lote que perdio animales a mitad de ciclo no consumio
  // como si hubiera estado lleno todo el tiempo.
  const averageHeadCount = lotDays > 0 && animalDays > 0 ? animalDays / lotDays : initialCount;
  const feedPerPigLb = averageHeadCount > 0 ? totalFeedLb / averageHeadCount : 0;
  const cycleProgressPercentage = cycleFeedPerPigLb > 0 ? (feedPerPigLb / cycleFeedPerPigLb) * 100 : 0;

  // --- PESAJE VENCIDO Y PESO ESTIMADO POR CONSUMO ---
  const referenceDate = (lot.fechaSalida ? parseLocalDate(lot.fechaSalida) : now) || now;
  const lastWeighingDate = parseLocalDate(lotWeights.at(-1)?.fecha);
  const daysSinceWeighing = lastWeighingDate
    ? Math.max(0, Math.floor((referenceDate - lastWeighingDate) / DAY_MS))
    : null;

  const feedAfterWeighingLb = lastWeighingDate
    ? sum(
      lotFeedings.filter((item) => (parseLocalDate(item.fecha) || referenceDate) > lastWeighingDate),
      (item) => item.cantidadLb
    )
    : 0;

  // Se estima la ganancia con una FCA de referencia fija, nunca con la FCA calculada
  // del lote: esa se deriva del peso, y usarla aqui seria un circulo vicioso.
  const estimatedGainLb = averageHeadCount > 0 && feedAfterWeighingLb > 0
    ? (feedAfterWeighingLb / averageHeadCount) / WEIGHT_ESTIMATE_FCA
    : 0;
  const estimatedWeight = currentWeight > 0
    ? Math.min(currentWeight + estimatedGainLb, targetWeightLb * MAX_ESTIMATED_WEIGHT_RATIO)
    : 0;

  const weighingIsStale = daysSinceWeighing !== null
    && daysSinceWeighing > staleWeighingDays
    && estimatedGainLb > 0;
  // Peso que manda en las proyecciones: el medido si esta fresco, el estimado si no.
  const projectionWeight = weighingIsStale ? estimatedWeight : currentWeight;
  const weighingIsMissing = lotWeights.length === 0;

  const pigletCost = initialCount * (Number(lot.costoLechon) || 0);
  const feedCost = sum(lotFeedings, (item) => item.costo);
  const healthCost = sum(lotVaccines, (item) => item.costo);
  const extrasCost = sum(lotExpenses, (item) => item.monto);
  const laborCost = Number(lot.manoObra) || 0;
  const investedCost = pigletCost + feedCost + healthCost + extrasCost;
  const realSalesIncome = sum(lotSales, (item) => item.totalVenta);
  const estimatedCurrentIncome = projectionWeight * currentCount * (Number(lot.precioVentaLibra) || 0);
  const totalFinalIncome = realSalesIncome + estimatedCurrentIncome;
  const netProfit = totalFinalIncome - investedCost - laborCost;

  const expectedDeaths = calculateExpectedDeaths({
    deathCount,
    animalDays,
    currentCount,
    adg,
    currentWeight: projectionWeight,
    targetWeightLb,
    isClosed: Boolean(lot.fechaSalida)
  });
  const manualExtraDeaths = Math.max(0, Number(extraProjectedDeaths) || 0);
  const projectionCount = Math.max(0, currentCount - expectedDeaths - manualExtraDeaths);

  const finishingFeed = catalog.find((item) => item.nombre?.includes('VITACERDO 3'));
  const finishingCostPerLb = (Number(finishingFeed?.precioSaco) || 259) / (Number(finishingFeed?.librasPorSaco) || 100);

  // La proyeccion se calcula siempre. Si el lote ya paso la meta simplemente no
  // falta alimento y se vende al peso que tiene, pero el escenario de estres sigue
  // respondiendo porque projectionCount ya descuenta las bajas simuladas.
  // Se proyecta con la FCA marginal del tramo de finalizacion, no con la acumulada, y
  // luego se acota al rango biologico: sin ese tope, un lote con alimento registrado y
  // sin pesajes produce FCAs de 30+ y costos futuros absurdos.
  const cumulativeFca = fca > 0 ? fca : DEFAULT_FCA;
  const rawProjectionFca = cumulativeFca * MARGINAL_FCA_FACTOR;
  const projectionFca = clamp(rawProjectionFca, PROJECTION_FCA_MIN, PROJECTION_FCA_MAX);

  const projectedExitWeight = Math.max(projectionWeight, targetWeightLb);
  const projectedMissingLb = Math.max(0, targetWeightLb - projectionWeight) * projectionCount;
  const projectedFeedLb = projectedMissingLb * projectionFca;
  const projectedFeedCost = projectedFeedLb * finishingCostPerLb;
  const projectedFinalSale = projectedExitWeight * projectionCount * (Number(lot.precioVentaLibra) || 0) + realSalesIncome;
  const projectedFinalProfit = projectedFinalSale - investedCost - projectedFeedCost - laborCost;

  return {
    cantidadActual: currentCount,
    diasLote: lotDays || 0,
    fechaInvalida: lotDays === null,
    pesoInicial: initialWeight,
    pesoActual: currentWeight,
    pesoActualRegistrado: recordedWeight,
    pesoAjustadoPorVenta: residual.adjusted,
    pesoParaProyeccion: projectionWeight,
    pesoEstimadoPorConsumo: estimatedWeight,
    pesoEsEstimado: weighingIsStale,
    diasSinPesaje: daysSinceWeighing,
    pesajeVencido: daysSinceWeighing !== null && daysSinceWeighing > staleWeighingDays,
    sinPesajes: weighingIsMissing,
    adg,
    consumoTotalLb: totalFeedLb,
    consumoPorCerdoLb: feedPerPigLb,
    consumoCicloPorcentaje: cycleProgressPercentage,
    excedeCicloCompleto: cycleProgressPercentage >= 100,
    fca,
    fcaEsEstimado: currentWeight <= 0 || initialWeight <= 0,
    fcaEsConfiable: lotWeights.length >= 2 && !weighingIsStale && fca > 0,
    fcaProyeccion: projectionFca,
    fcaProyeccionAcotada: Math.abs(projectionFca - rawProjectionFca) > 0.001,
    animalDias: animalDays,
    cantidadVendida: soldCount,
    librasVendidas: soldWeightLb,
    gananciaPesoVivosLb: liveWeightGainLb,
    gananciaPesoVendidoLb: soldWeightGainLb,
    pesoProducidoLb: producedWeightGainLb,
    mortalidadPorcentaje: mortalityPercentage,
    costoLechones: pigletCost,
    costoAlimento: feedCost,
    costoAlimentoTolva: sum(lotFeedings.filter((item) => !item.esSuplemento), (item) => item.costo),
    costoAlimentoSuplemento: sum(lotFeedings.filter((item) => item.esSuplemento), (item) => item.costo),
    totalSanidad: healthCost,
    totalGastosExtras: extrasCost,
    costoInvertidoTotal: investedCost,
    ingresoEstimado: totalFinalIncome,
    ingresoRealVentas: realSalesIncome,
    ingresoEstimadoVivos: estimatedCurrentIncome,
    utilidadNeta: netProfit,
    proyeccionLibrasFaltantes: projectedMissingLb,
    proyeccionAlimentoFaltante: projectedFeedLb,
    proyeccionCostoFaltante: projectedFeedCost,
    ventasLote: lotSales,
    proyeccionVentaFinal: projectedFinalSale,
    proyeccionUtilidadFinal: projectedFinalProfit,
    librasPorSacoFinalizacion: Number(finishingFeed?.librasPorSaco) || 100,
    pesoObjetivoLb: targetWeightLb,
    estaListoParaMezclas: projectionWeight >= (Number(mixAlertWeight) || 100),
    // Parametros de negocio sin configurar: la proyeccion no significa nada sin ellos.
    faltaPrecioVenta: !(Number(lot.precioVentaLibra) > 0),
    faltaCostoLechon: !(Number(lot.costoLechon) > 0),
    parametrosIncompletos: !(Number(lot.precioVentaLibra) > 0) || !(Number(lot.costoLechon) > 0),
    cantidadParaProyeccion: projectionCount,
    mortalidadEsperadaProyectada: expectedDeaths,
    bajasHipoteticasSimuladas: manualExtraDeaths
  };
}
