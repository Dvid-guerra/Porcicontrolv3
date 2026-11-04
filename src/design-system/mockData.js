// Datos de prueba del Panel principal. Reemplazar por lo que ya calcula
// calcularEstadisticasLote() cuando se conecte a la app real.
// Los KPI se derivan de estos lotes para que todas las cifras cuadren.

export const HOY_TEXTO = 'miércoles, 4 de noviembre';
export const PESO_OBJETIVO_LB = 220;

// Curva objetivo de la granja: [día de lote, libras]
export const CURVA_OBJETIVO = [[0, 15], [28, 35], [49, 65], [70, 105], [105, 175], [133, 235], [140, 248]];

export const pesoEnCurva = (dia) => {
  for (let i = 1; i < CURVA_OBJETIVO.length; i += 1) {
    const [d0, p0] = CURVA_OBJETIVO[i - 1];
    const [d1, p1] = CURVA_OBJETIVO[i];
    if (dia <= d1) return p0 + ((dia - d0) / (d1 - d0)) * (p1 - p0);
  }
  return CURVA_OBJETIVO[CURVA_OBJETIVO.length - 1][1];
};

// Cronograma real de la app (CRONOGRAMA_ALIMENTACION): lb por cerdo en la fase
const FASES = [
  { alimento: 'VITALECHON 1', desde: 1, hasta: 11, lb: 6.6 },
  { alimento: 'VITALECHON 2', desde: 12, hasta: 21, lb: 11 },
  { alimento: 'VITALECHON 3', desde: 22, hasta: 28, lb: 11 },
  { alimento: 'VITALECHON 4', desde: 29, hasta: 49, lb: 48.4 },
  { alimento: 'VITACERDO 1', desde: 50, hasta: 70, lb: 74.8 },
  { alimento: 'VITACERDO 2', desde: 71, hasta: 105, lb: 175.1 },
  { alimento: 'VITACERDO 3', desde: 106, hasta: 133, lb: 169.5 },
];

const faseDeDia = (dia) => FASES.find((f) => dia <= f.hasta) ?? FASES[FASES.length - 1];

const LOTES_BASE = [
  { id: 'c5', corral: 'Corral 5', lote: 'Lote Yorkshire 10', inicial: 37, bajas: 3, dia: 44, peso: 56, alimentoPorCerdo: 64, ultimoPesajeDia: 37, estado: 'mortalidad' },
  { id: 'c3', corral: 'Corral 3', lote: 'Lote Duroc 09', inicial: 30, bajas: 0, dia: 67, peso: 92, alimentoPorCerdo: 139, ultimoPesajeDia: 55, estado: 'sinPesar', pesoEstimado: true },
  { id: 'c4', corral: 'Corral 4', lote: 'Lote Landrace 06', inicial: 26, bajas: 0, dia: 128, peso: 224, alimentoPorCerdo: 466, ultimoPesajeDia: 122, estado: 'bloqueada' },
  { id: 'c7', corral: 'Corral 7', lote: 'Lote Pietrain 05', inicial: 24, bajas: 0, dia: 136, peso: 243, alimentoPorCerdo: 505, ultimoPesajeDia: 134, estado: 'listo' },
  { id: 'c1', corral: 'Corral 1', lote: 'Lote Duroc 07', inicial: 28, bajas: 0, dia: 118, peso: 205, alimentoPorCerdo: 405, ultimoPesajeDia: 112, estado: 'meta' },
  { id: 'c2', corral: 'Corral 2', lote: 'Lote Pietrain 08', inicial: 34, bajas: 1, dia: 93, peso: 148, alimentoPorCerdo: 262, ultimoPesajeDia: 86, estado: 'meta' },
  { id: 'c6', corral: 'Corral 6', lote: 'Lote Duroc 11', inicial: 36, bajas: 0, dia: 19, peso: 28, alimentoPorCerdo: 20, ultimoPesajeDia: 14, estado: 'meta' },
];

const PESO_INGRESO_LB = 15;

// Día de la curva objetivo en que se alcanza un peso dado
const diaEnCurva = (peso) => {
  for (let i = 1; i < CURVA_OBJETIVO.length; i += 1) {
    const [d0, p0] = CURVA_OBJETIVO[i - 1];
    const [d1, p1] = CURVA_OBJETIVO[i];
    if (peso <= p1) return d0 + ((peso - p0) / (p1 - p0)) * (d1 - d0);
  }
  return CURVA_OBJETIVO[CURVA_OBJETIVO.length - 1][0];
};

const pesajesDe = (lote) => {
  const razonFinal = lote.peso / pesoEnCurva(lote.dia);
  const dias = [];
  for (let d = 0; d < lote.ultimoPesajeDia; d += 14) dias.push(d);
  dias.push(lote.ultimoPesajeDia);
  return dias.map((dia) => {
    const avance = lote.dia > 0 ? dia / lote.dia : 0;
    return { dia, peso: Math.round(pesoEnCurva(dia) * razonFinal ** avance * 10) / 10 };
  });
};

export const LOTES = LOTES_BASE.map((lote) => {
  const cerdos = lote.inicial - lote.bajas;
  const ganancia = lote.peso - PESO_INGRESO_LB;
  const gmd = lote.dia > 0 ? ganancia / lote.dia : 0;
  const fase = faseDeDia(lote.dia);
  // La GMD acumulada subestima lechones: lo que falta se mide sobre la curva, no con una recta.
  const faltan = lote.peso >= PESO_OBJETIVO_LB ? 0 : Math.ceil(diaEnCurva(PESO_OBJETIVO_LB) - diaEnCurva(lote.peso));
  return {
    ...lote,
    cerdos,
    ganancia,
    gmd,
    ica: ganancia > 0 ? lote.alimentoPorCerdo / ganancia : 0,
    mortalidad: (lote.bajas / lote.inicial) * 100,
    alimento: fase.alimento,
    faseNumero: FASES.indexOf(fase) + 1,
    avanceFase: Math.min(100, ((lote.dia - fase.desde + 1) / (fase.hasta - fase.desde + 1)) * 100),
    pesoObjetivoLb: PESO_OBJETIVO_LB,
    corralId: lote.id,
    icaConfiable: true,
    diasAVenta: faltan,
    diasSinPesar: lote.dia - lote.ultimoPesajeDia,
    pesajes: pesajesDe(lote),
    consumoDiarioLb: (fase.lb / (fase.hasta - fase.desde + 1)) * cerdos,
  };
});

export const CORRALES_LIBRES = [{ id: 'c8', corral: 'Corral 8' }];

const BODEGA_BASE = [
  { alimento: 'VITALECHON 1', sacos: 6 },
  { alimento: 'VITALECHON 2', sacos: 14 },
  { alimento: 'VITALECHON 3', sacos: 9 },
  { alimento: 'VITALECHON 4', sacos: 11 },
  { alimento: 'VITACERDO 1', sacos: 18 },
  { alimento: 'VITACERDO 2', sacos: 22 },
  { alimento: 'VITACERDO 3', sacos: 19 },
];

export const BODEGA = BODEGA_BASE.map((item) => {
  const lbDia = LOTES.filter((l) => l.alimento === item.alimento).reduce((s, l) => s + l.consumoDiarioLb, 0);
  const sacosDia = lbDia / 100;
  const dias = sacosDia > 0 ? item.sacos / sacosDia : null;
  let estado = 'ok';
  if (dias !== null && dias < 3) estado = 'critico';
  else if (dias !== null && dias < 7) estado = 'bajo';
  else if (dias === null) estado = 'sinUso';
  return { ...item, sacosDia, dias, estado };
});

const sumar = (fn) => LOTES.reduce((s, l) => s + fn(l), 0);
const totalCerdos = sumar((l) => l.cerdos);
const bajasTotales = sumar((l) => l.bajas);
const inicialTotal = sumar((l) => l.inicial);
const biomasaLb = sumar((l) => l.cerdos * l.peso);
const gananciaTotal = sumar((l) => l.cerdos * l.ganancia);
const alimentoTotal = sumar((l) => l.cerdos * l.alimentoPorCerdo);
const menorCobertura = BODEGA.filter((b) => b.dias !== null).sort((a, b) => a.dias - b.dias)[0];

export const RESUMEN = {
  totalCerdos,
  corralesActivos: LOTES.length,
  corralesTotales: LOTES.length + CORRALES_LIBRES.length,
  pesoPromedio: biomasaLb / totalCerdos,
  biomasaQq: biomasaLb / 100,
  gmd: sumar((l) => l.cerdos * l.gmd) / totalCerdos,
  ica: alimentoTotal / gananciaTotal,
  mortalidad: (bajasTotales / inicialTotal) * 100,
  bajasTotales,
  sacosTotales: BODEGA.reduce((s, b) => s + b.sacos, 0),
  menorCobertura,
};

export const ALERTAS = [
  {
    id: 'a1', grupo: 'atrasado', severidad: 'danger', corral: 'Corral 5 · Lote Yorkshire 10', corralId: 'c5',
    titulo: 'Mortalidad de 8.1 %, sobre el máximo de 5 %',
    detalle: '3 bajas de 37 lechones. Revisá la causa antes de la próxima descarga.',
    accion: 'Ver bajas',
  },
  {
    id: 'a2', grupo: 'atrasado', severidad: 'warning', corral: 'Corral 3 · Lote Duroc 09', corralId: 'c3',
    titulo: '12 días sin pesar',
    detalle: 'El peso de 92 lb es estimado por consumo. La proyección no es confiable.',
    accion: 'Registrar pesaje',
  },
  {
    id: 'a3', grupo: 'hoy', severidad: 'warning', corral: 'Bodega central',
    titulo: 'VITACERDO 3 alcanza para 4 días',
    detalle: 'Quedan 19 sacos y 3 corrales consumen 4.7 sacos por día.',
    accion: 'Ver compra sugerida',
  },
  {
    id: 'a4', grupo: 'semana', severidad: 'info', corral: 'Corral 4 · Lote Landrace 06', corralId: 'c4',
    titulo: 'Venta bloqueada hasta el 23 de noviembre',
    detalle: 'La 2ª dosis de Innosure se aplicó el 2 de noviembre. Faltan 19 días.',
    accion: 'Ver plan sanitario',
  },
];

export const EVENTOS = [
  { id: 'e1', fecha: 'Hoy', tipo: 'venta', titulo: 'Corral 7 listo para báscula', detalle: '24 cerdos · 243 lb promedio' },
  { id: 'e2', fecha: 'Sáb 7', tipo: 'sanidad', titulo: '1ª dosis de Innosure', detalle: 'Corral 3 · machos enteros' },
  { id: 'e3', fecha: 'Sáb 7', tipo: 'alimento', titulo: 'Cambio a VITALECHON 3', detalle: 'Corral 6 · día 22' },
  { id: 'e4', fecha: 'Dom 8', tipo: 'alimento', titulo: 'Cambio a VITACERDO 2', detalle: 'Corral 3 · día 71' },
];

export const DATOS_DEMO = {
  hoyTexto: HOY_TEXTO,
  lotes: LOTES,
  libres: CORRALES_LIBRES,
  bodega: BODEGA,
  alertas: ALERTAS,
  eventos: EVENTOS,
  actividad: [],
  resumen: RESUMEN,
};
