export function etapaAlimentacion(loteActivo, diasLote, cronograma, catalogoAlimento) {
  const fasePorDias =
    cronograma.find((f) => diasLote >= f.diaInicio && diasLote <= f.diaFin)?.fase ||
    cronograma[cronograma.length - 1]?.fase ||
    1;
  const faseActual = Number(loteActivo.faseActual) || fasePorDias;
  const faseInfo =
    cronograma.find((f) => f.fase === faseActual) ||
    cronograma[cronograma.length - 1] ||
    { fase: faseActual, alimento: catalogoAlimento[0]?.nombre || '', consumoTotalLb: 0 };

  const alimentoSugerido =
    catalogoAlimento.find((a) => a.nombre === faseInfo.alimento)?.nombre ||
    catalogoAlimento[0]?.nombre ||
    faseInfo.alimento ||
    '';

  return { faseActual, faseInfo, alimentoSugerido };
}
