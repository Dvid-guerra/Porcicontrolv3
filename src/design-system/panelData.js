// Traduce los datos reales de la app al formato del Panel principal.
// Es una función pura: no conoce React ni Firestore, y por eso se puede probar sola.
// Los umbrales son los mismos que ya usa el resto de la app.

export const MORTALIDAD_MAXIMA_PCT = 5;
export const ICA_REVISION = 3;
export const COBERTURA_CRITICA_DIAS = 3;
export const COBERTURA_BAJA_DIAS = 7;
export const VENTANA_CONSUMO_DIAS = 14;
export const HORIZONTE_VENTA_DIAS = 120;

const DIA_MS = 86_400_000;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const aFecha = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

const diasEntre = (desde, hasta) => {
  const a = aFecha(desde);
  const b = aFecha(hasta);
  return a && b ? Math.round((b - a) / DIA_MS) : null;
};

// Los ids pueden venir como número o texto según quién creó el registro.
const mismoId = (a, b) => a != null && b != null && String(a) === String(b);

const compararNombres = (a, b) =>
  String(a ?? '').localeCompare(String(b ?? ''), 'es', { numeric: true, sensitivity: 'base' });

// Orden fijo de la granja: Corral 1, Corral 2 … Corral 10, sin importar urgencia ni ocupación.
export function ordenarCorrales(corrales = []) {
  return corrales
    .map((corral, i) => ({ corral, i }))
    .sort((a, b) => compararNombres(a.corral?.nombre, b.corral?.nombre) || a.i - b.i)
    .map(({ corral }) => corral);
}

// Si un corral quedó sin nombre, se identifica por su posición en vez de un "Corral" genérico.
export function nombreDeCorral(corral, posicion = -1) {
  const nombre = String(corral?.nombre ?? '').trim();
  if (nombre) return nombre;
  return posicion >= 0 ? `Corral ${posicion + 1}` : 'Corral';
}
const ORDEN_SEVERIDAD = { danger: 0, warning: 1, info: 2 };
const ORDEN_GRUPO = { atrasado: 0, hoy: 1, semana: 2 };

export function estadoDeLote(stats, plan) {
  const enPeso = stats.pesoParaProyeccion >= stats.pesoObjetivoLb || stats.excedeCicloCompleto;
  if (stats.excedeCicloCompleto && !plan.puedeVender) return 'sobreEngorde';
  if (stats.mortalidadPorcentaje > MORTALIDAD_MAXIMA_PCT) return 'mortalidad';
  if (enPeso && plan.puedeVender) return 'listo';
  if (enPeso) return 'bloqueada';
  if (stats.pesajeVencido) return 'sinPesar';
  return 'meta';
}

export function diasParaVenta(stats) {
  if (stats.pesoParaProyeccion >= stats.pesoObjetivoLb) return 0;
  if (!(stats.adg > 0) || !(stats.pesoParaProyeccion > 0)) return null;
  return Math.ceil((stats.pesoObjetivoLb - stats.pesoParaProyeccion) / stats.adg);
}

function faseDeLote(lote, stats, cronograma) {
  const porDias = cronograma.find((f) => stats.diasLote >= f.diaInicio && stats.diasLote <= f.diaFin);
  const ultima = cronograma[cronograma.length - 1];
  const numero = lote.faseActual || porDias?.fase || ultima?.fase || 1;
  const fase = cronograma.find((f) => f.fase === numero) || ultima;
  if (!fase) return { numero, alimento: '—', avance: 0 };
  const duracion = fase.diaFin - fase.diaInicio + 1;
  const avance = Math.max(0, Math.min(100, ((stats.diasLote - fase.diaInicio + 1) / duracion) * 100));
  return { numero, alimento: fase.alimento, avance };
}

function pesajesDeLote(lote, pesos) {
  const ingreso = lote.fechaIngreso || lote.fechaInicio;
  return pesos
    .filter((p) => p.loteId === lote.id && num(p.pesoPromedio) > 0)
    .map((p) => ({ dia: diasEntre(ingreso, p.fecha), peso: num(p.pesoPromedio) }))
    .filter((p) => p.dia !== null && p.dia >= 0)
    .sort((a, b) => a.dia - b.dia);
}

export function construirLotes({ lotes, corrales, pesos = [], estadisticasDe, planDe, cronograma = [] }) {
  const ordenados = ordenarCorrales(corrales);
  const filas = lotes
    .filter((l) => l.estado === 'Activo')
    .map((lote) => {
      const stats = estadisticasDe(lote);
      if (!stats) return null;
      const plan = planDe(lote) || { puedeVender: true };
      const indice = corrales.findIndex((c) => mismoId(c?.id, lote.corralId));
      const corral = indice >= 0 ? corrales[indice] : null;
      const fase = faseDeLote(lote, stats, cronograma);
      return {
        id: lote.id,
        corralId: lote.corralId,
        corral: corral ? nombreDeCorral(corral, indice) : (lote.corralNombre || 'Corral'),
        orden: corral ? ordenados.indexOf(corral) : Number.MAX_SAFE_INTEGER,
        lote: lote.nombre || lote.raza || 'Lote',
        cerdos: stats.cantidadActual,
        dia: stats.diasLote,
        peso: stats.pesoParaProyeccion,
        pesoEstimado: Boolean(stats.pesoEsEstimado),
        pesoObjetivoLb: stats.pesoObjetivoLb,
        gmd: stats.adg,
        ica: stats.fca,
        icaConfiable: Boolean(stats.fcaEsConfiable),
        mortalidad: stats.mortalidadPorcentaje,
        alimento: fase.alimento,
        faseNumero: fase.numero,
        avanceFase: fase.avance,
        diasAVenta: diasParaVenta(stats),
        estado: estadoDeLote(stats, plan),
        motivoBloqueo: plan.motivoBloqueo || null,
        pesajes: pesajesDeLote(lote, pesos),
        _stats: stats,
      };
    })
    .filter(Boolean);

  return filas.sort((a, b) => (a.orden - b.orden) || compararNombres(a.corral, b.corral));
}

export function construirBodega({ inventario, alimentos = [], hoyIso }) {
  const consumoReciente = new Map();
  for (const a of alimentos) {
    if (a.esSuplemento) continue;
    const hace = diasEntre(a.fecha, hoyIso);
    if (hace === null || hace < 0 || hace >= VENTANA_CONSUMO_DIAS) continue;
    consumoReciente.set(a.tipo, (consumoReciente.get(a.tipo) || 0) + num(a.cantidadLb));
  }

  return inventario
    .filter((item) => item.isConcentrado)
    .map((item) => {
      const librasPorSaco = num(item.librasPorSaco) || 100;
      const sacos = num(item.stockSacos);
      const sacosDia = (consumoReciente.get(item.nombre) || 0) / VENTANA_CONSUMO_DIAS / librasPorSaco;
      const dias = sacosDia > 0 ? sacos / sacosDia : null;
      let estado = 'ok';
      if (dias === null) estado = 'sinUso';
      else if (dias < COBERTURA_CRITICA_DIAS) estado = 'critico';
      else if (dias < COBERTURA_BAJA_DIAS) estado = 'bajo';
      return { alimento: item.nombre, sacos, sacosDia, dias, estado };
    })
    .filter((item) => item.sacos > 0 || item.dias !== null);
}

const unirTexto = (...partes) => partes.filter(Boolean).join(' ');

function alertaDeAccion(a) {
  const severidad = a.grupo === 'atrasado' && a.prioridad <= 2 ? 'danger' : 'warning';
  return {
    id: a.id,
    grupo: a.grupo,
    severidad,
    corral: a.corral,
    titulo: a.titulo,
    detalle: unirTexto(a.detalle, a.nota),
    accion: a.etiqueta,
    onAccion: a.accionRapida || a.accion || null,
  };
}

function alertasDeBodega(bodega, onVerBodega) {
  return bodega
    .filter((b) => b.estado === 'critico' || b.estado === 'bajo')
    .map((b) => ({
      id: `stock_${b.alimento}`,
      grupo: 'hoy',
      severidad: b.estado === 'critico' ? 'danger' : 'warning',
      corral: 'Bodega central',
      titulo: `${b.alimento} alcanza para ${Math.max(0, Math.floor(b.dias))} ${Math.floor(b.dias) === 1 ? 'día' : 'días'}`,
      detalle: `Quedan ${b.sacos.toFixed(1)} sacos y se consumen ${b.sacosDia.toFixed(1)} por día.`,
      accion: 'Ver bodega',
      onAccion: onVerBodega || null,
    }));
}

function alertasDeLotes(filas, onAbrirCorral) {
  const abrir = (fila) => (onAbrirCorral ? () => onAbrirCorral(fila.corralId) : null);
  const alertas = [];
  for (const fila of filas) {
    if (fila.mortalidad > MORTALIDAD_MAXIMA_PCT) {
      alertas.push({
        id: `mortalidad_${fila.id}`,
        grupo: 'hoy',
        severidad: 'danger',
        corral: `${fila.corral} · ${fila.lote}`,
        titulo: `Mortalidad de ${fila.mortalidad.toFixed(1)} %, sobre el máximo de ${MORTALIDAD_MAXIMA_PCT} %`,
        detalle: 'Revisá las bajas registradas y su causa.',
        accion: 'Abrir corral',
        onAccion: abrir(fila),
      });
    }
    if (fila.estado === 'bloqueada') {
      alertas.push({
        id: `bloqueada_${fila.id}`,
        grupo: 'semana',
        severidad: 'info',
        corral: `${fila.corral} · ${fila.lote}`,
        titulo: 'En peso, pero con la venta bloqueada',
        detalle: fila.motivoBloqueo || 'Revisá el plan sanitario del lote.',
        accion: 'Abrir corral',
        onAccion: abrir(fila),
      });
    }
  }
  return alertas;
}

export function ordenarAlertas(alertas) {
  return [...alertas].sort((a, b) => (
    (ORDEN_GRUPO[a.grupo] - ORDEN_GRUPO[b.grupo]) || (ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad])
  ));
}

export function construirResumen({ filas, corralesTotales, bajas = [], lotes = [], bodega }) {
  const stats = filas.map((f) => f._stats);
  const sumar = (fn) => stats.reduce((s, st) => s + fn(st), 0);
  const totalCerdos = sumar((s) => s.cantidadActual);
  const biomasaLb = sumar((s) => s.cantidadActual * s.pesoParaProyeccion);
  const alimentoTotal = sumar((s) => num(s.consumoTotalLb));
  const pesoProducido = sumar((s) => Math.max(0, num(s.pesoProducidoLb)));

  const ids = new Set(filas.map((f) => f.id));
  const activos = lotes.filter((l) => ids.has(l.id));
  const inicial = activos.reduce((s, l) => s + num(l.cantidadInicial ?? l.cantidad), 0);
  const bajasTotales = bajas.filter((b) => ids.has(b.loteId)).reduce((s, b) => s + num(b.cantidad), 0);

  const conConsumo = bodega.filter((b) => b.dias !== null).sort((a, b) => a.dias - b.dias);

  return {
    totalCerdos,
    corralesActivos: filas.length,
    corralesTotales,
    pesoPromedio: totalCerdos > 0 ? biomasaLb / totalCerdos : 0,
    biomasaQq: biomasaLb / 100,
    gmd: totalCerdos > 0 ? sumar((s) => s.cantidadActual * num(s.adg)) / totalCerdos : 0,
    ica: pesoProducido > 0 ? alimentoTotal / pesoProducido : 0,
    mortalidad: inicial > 0 ? (bajasTotales / inicial) * 100 : 0,
    bajasTotales,
    sacosTotales: bodega.reduce((s, b) => s + b.sacos, 0),
    menorCobertura: conConsumo[0] || null,
  };
}

/**
 * @param acciones lista de accionesDeHoy
 * @param avisos   alertas ya armadas por la app, como los cambios de alimento
 */
export function construirPanelPrincipal({
  lotes = [],
  corrales = [],
  pesos = [],
  bajas = [],
  alimentos = [],
  inventario = [],
  cronograma = [],
  acciones = [],
  avisos = [],
  actividad = [],
  estadisticasDe,
  planDe,
  hoyIso,
  hoyTexto = '',
  onVerBodega,
  onAbrirCorral,
}) {
  const filas = construirLotes({ lotes, corrales, pesos, estadisticasDe, planDe, cronograma });
  const ocupados = new Set(filas.map((f) => String(f.corralId)));
  const libres = ordenarCorrales(corrales)
    .map((c, orden) => ({ c, orden }))
    .filter(({ c }) => !ocupados.has(String(c.id)))
    .map(({ c, orden }) => ({ id: c.id, corral: nombreDeCorral(c, corrales.indexOf(c)), orden }));
  const bodega = construirBodega({ inventario, alimentos, hoyIso });

  const alertas = ordenarAlertas([
    ...acciones.filter((a) => a.grupo !== 'semana').map(alertaDeAccion),
    ...alertasDeLotes(filas, onAbrirCorral),
    ...alertasDeBodega(bodega, onVerBodega),
    ...avisos,
  ]);

  const eventos = acciones.filter((a) => a.grupo === 'semana').map((a) => ({
    id: a.id,
    tipo: a.id.split('_')[0],
    titulo: a.titulo,
    detalle: `${a.corral} · ${a.detalle}`,
    onAbrir: a.accion || null,
  }));

  return {
    hoyTexto,
    lotes: filas.map(({ _stats, ...fila }) => fila),
    libres,
    bodega,
    alertas,
    eventos,
    actividad,
    resumen: construirResumen({ filas, corralesTotales: corrales.length, bajas, lotes, bodega }),
  };
}
