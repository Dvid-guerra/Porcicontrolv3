const DAY_MS = 86_400_000;

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
  const projectionCount = Math.max(0, currentCount - Math.max(0, Number(extraProjectedDeaths) || 0));
  const lotDays = calculateLotDays(lot.fechaIngreso, lot.fechaSalida, now);

  const initialWeight = lotWeights.at(0)?.pesoPromedio || 0;
  const currentWeight = lotWeights.at(-1)?.pesoPromedio || 0;
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

  const pigletCost = initialCount * (Number(lot.costoLechon) || 0);
  const feedCost = sum(lotFeedings, (item) => item.costo);
  const healthCost = sum(lotVaccines, (item) => item.costo);
  const extrasCost = sum(lotExpenses, (item) => item.monto);
  const laborCost = Number(lot.manoObra) || 0;
  const investedCost = pigletCost + feedCost + healthCost + extrasCost;
  const realSalesIncome = sum(lotSales, (item) => item.totalVenta);
  const estimatedCurrentIncome = currentWeight * currentCount * (Number(lot.precioVentaLibra) || 0);
  const totalFinalIncome = realSalesIncome + estimatedCurrentIncome;
  const netProfit = totalFinalIncome - investedCost - laborCost;

  const finishingFeed = catalog.find((item) => item.nombre?.includes('VITACERDO 3'));
  const finishingCostPerLb = (Number(finishingFeed?.precioSaco) || 259) / (Number(finishingFeed?.librasPorSaco) || 100);
  let projectedMissingLb = 0;
  let projectedFeedLb = 0;
  let projectedFeedCost = 0;
  let projectedFinalSale = totalFinalIncome;
  let projectedFinalProfit = netProfit;

  if (currentWeight < targetWeightLb && projectionCount > 0) {
    projectedMissingLb = (targetWeightLb - currentWeight) * projectionCount;
    projectedFeedLb = projectedMissingLb * (fca > 0 ? fca : 2.5);
    projectedFeedCost = projectedFeedLb * finishingCostPerLb;
    projectedFinalSale = targetWeightLb * projectionCount * (Number(lot.precioVentaLibra) || 0) + realSalesIncome;
    projectedFinalProfit = projectedFinalSale - investedCost - projectedFeedCost - laborCost;
  }

  return {
    cantidadActual: currentCount,
    diasLote: lotDays || 0,
    fechaInvalida: lotDays === null,
    pesoInicial: initialWeight,
    pesoActual: currentWeight,
    adg,
    consumoTotalLb: totalFeedLb,
    fca,
    fcaEsEstimado: currentWeight <= 0 || initialWeight <= 0,
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
    estaListoParaMezclas: currentWeight >= (Number(mixAlertWeight) || 100),
    cantidadParaProyeccion: projectionCount
  };
}
