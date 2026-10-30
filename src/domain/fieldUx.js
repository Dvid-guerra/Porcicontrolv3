// Utilidades puras para operación en campo (Modo Galpón):
// fechas locales sin desfase UTC, validaciones anti-dedazo en báscula,
// progreso de embarque, muestreo multi-cerdo (báscula + cinta Schaeffer)
// y control de navegación móvil con botón Atrás.

export function formatLocalIsoDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')}`;
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysLocalIso(dateStr, days) {
  if (!dateStr || typeof dateStr !== 'string') return formatLocalIsoDate();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const base = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(base.getTime())) return formatLocalIsoDate();
  base.setDate(base.getDate() + (Number(days) || 0));
  return formatLocalIsoDate(base);
}

export function calcularMediana(valores = []) {
  const limpios = valores
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (limpios.length === 0) return 0;
  const mitad = Math.floor(limpios.length / 2);
  if (limpios.length % 2 === 1) return limpios[mitad];
  return (limpios[mitad - 1] + limpios[mitad]) / 2;
}

/**
 * Evalúa un peso tecleado en la Báscula de Venta para prevenir errores de dedo
 * típicos en el embarque (ej. teclear 2220 lb o 22 lb en vez de 222 lb).
 */
export function evaluarPesoBascula({
  peso,
  pesosPrevios = [],
  pesoMinimo = 35,
  pesoMaximo = 500,
  umbralDesviacion = 0.35
} = {}) {
  const num = Number(peso);
  if (!Number.isFinite(num) || num <= 0) {
    return {
      ok: false,
      sospechoso: false,
      tipoAlerta: 'invalido',
      mensaje: 'Ingresa un peso válido mayor a 0 lb.',
      medianaReferencia: 0,
      pesoRedondeado: 0
    };
  }

  const pesoRedondeado = Number(num.toFixed(1));
  const mediana = calcularMediana(pesosPrevios);

  if (pesoRedondeado > pesoMaximo) {
    return {
      ok: true,
      sospechoso: true,
      tipoAlerta: 'excesivo',
      mensaje: `${pesoRedondeado} lb parece un error de dedo (supera ${pesoMaximo} lb). ¿Seguro que es correcto?`,
      medianaReferencia: Number(mediana.toFixed(1)),
      pesoRedondeado
    };
  }

  if (pesoRedondeado < pesoMinimo) {
    return {
      ok: true,
      sospechoso: true,
      tipoAlerta: 'muy_bajo',
      mensaje: `${pesoRedondeado} lb es inusualmente bajo para venta en báscula (menor a ${pesoMinimo} lb). ¿Confirmas este peso?`,
      medianaReferencia: Number(mediana.toFixed(1)),
      pesoRedondeado
    };
  }

  if (pesosPrevios.length >= 2 && mediana > 0) {
    const desviacion = Math.abs(pesoRedondeado - mediana) / mediana;
    if (desviacion > umbralDesviacion) {
      const porcentaje = Math.round(desviacion * 100);
      return {
        ok: true,
        sospechoso: true,
        tipoAlerta: 'desviacion_lote',
        mensaje: `${pesoRedondeado} lb varía ${porcentaje}% respecto al grupo ya pesado (~${mediana.toFixed(0)} lb). ¿Confirmas que no hubo error al teclear?`,
        medianaReferencia: Number(mediana.toFixed(1)),
        pesoRedondeado
      };
    }
  }

  return {
    ok: true,
    sospechoso: false,
    tipoAlerta: null,
    mensaje: '',
    medianaReferencia: Number(mediana.toFixed(1)),
    pesoRedondeado
  };
}

export function calcularProgresoEmbarque({ pesosCapturados = [], cerdosVivos = 0 } = {}) {
  const limpios = pesosCapturados
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  const pesados = limpios.length;
  const vivos = Math.max(0, Math.floor(Number(cerdosVivos) || 0));
  const totalLb = limpios.reduce((acc, p) => acc + p, 0);
  const promedioLb = pesados > 0 ? totalLb / pesados : 0;
  const minimoLb = pesados > 0 ? Math.min(...limpios) : 0;
  const maximoLb = pesados > 0 ? Math.max(...limpios) : 0;
  const faltantes = Math.max(0, vivos - pesados);
  const completado = vivos > 0 && pesados === vivos;
  const excedido = vivos > 0 && pesados > vivos;
  const porcentaje = vivos > 0 ? Math.min(100, Math.round((pesados / vivos) * 100)) : 0;

  return {
    pesados,
    vivos,
    faltantes,
    completado,
    excedido,
    porcentaje,
    totalLb: Number(totalLb.toFixed(1)),
    promedioLb: Number(promedioLb.toFixed(1)),
    minimoLb: Number(minimoLb.toFixed(1)),
    maximoLb: Number(maximoLb.toFixed(1))
  };
}

export function construirClaveBorradorBascula(appId, corralId, loteId) {
  if (!corralId || !loteId) return '';
  return `porci_borrador_bascula_${appId || 'local'}_${corralId}_${loteId}`;
}

export function serializarBorradorBascula({ pesos = [], precioLibra = 0, updatedAt = Date.now() } = {}) {
  const limpios = Array.isArray(pesos)
    ? pesos.map(Number).filter((n) => Number.isFinite(n) && n > 0).map((n) => Number(n.toFixed(1)))
    : [];
  return JSON.stringify({
    pesos: limpios,
    precioLibra: Number(precioLibra) > 0 ? Number(precioLibra) : 0,
    updatedAt
  });
}

export function parsearBorradorBascula(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    const pesos = Array.isArray(parsed?.pesos)
      ? parsed.pesos.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    const precioLibra = Number(parsed?.precioLibra) > 0 ? Number(parsed.precioLibra) : 0;
    if (pesos.length === 0 && precioLibra <= 0) return null;
    return {
      pesos,
      precioLibra,
      updatedAt: Number(parsed?.updatedAt) || 0
    };
  } catch {
    return null;
  }
}

export function calcularPesoSchaefferLb(circunferenciaCm, longitudCm, constante = 400) {
  const circ = Number(circunferenciaCm);
  const long = Number(longitudCm);
  const factor = Number(constante) > 0 ? Number(constante) : 400;
  if (!Number.isFinite(circ) || !Number.isFinite(long) || circ <= 0 || long <= 0) {
    return null;
  }
  const pulgadasCirc = circ * 0.393701;
  const pulgadasLong = long * 0.393701;
  const peso = (Math.pow(pulgadasCirc, 2) * pulgadasLong) / factor;
  const redondeado = Number(peso.toFixed(2));
  return Number.isFinite(redondeado) && redondeado > 0 ? redondeado : null;
}

/**
 * Calcula estadísticas de una muestra rápida de cerdos medidos en el corral
 * (por báscula individual o cinta métrica Schaeffer) para obtener un promedio real.
 */
export function resumirMuestraPesaje(muestra = []) {
  const validos = (Array.isArray(muestra) ? muestra : [])
    .map((item) => ({
      ...item,
      pesoLb: Number(item?.pesoLb)
    }))
    .filter((item) => Number.isFinite(item.pesoLb) && item.pesoLb > 0);

  if (validos.length === 0) {
    return {
      cantidad: 0,
      promedioLb: 0,
      minimoLb: 0,
      maximoLb: 0,
      dispersionLb: 0,
      metodoRegistro: 'directo',
      resumenTexto: ''
    };
  }

  const pesos = validos.map((i) => i.pesoLb);
  const suma = pesos.reduce((acc, n) => acc + n, 0);
  const promedioLb = Number((suma / validos.length).toFixed(2));
  const minimoLb = Number(Math.min(...pesos).toFixed(1));
  const maximoLb = Number(Math.max(...pesos).toFixed(1));
  const dispersionLb = Number((maximoLb - minimoLb).toFixed(1));

  const usaSchaeffer = validos.some((i) => i.metodo === 'schaeffer');
  const usaDirecto = validos.some((i) => i.metodo !== 'schaeffer');
  const metodoRegistro = usaSchaeffer && !usaDirecto
    ? 'schaeffer'
    : !usaSchaeffer && usaDirecto
      ? 'directo'
      : 'mixto';

  const resumenTexto = `Muestra de ${validos.length} cerdo${validos.length === 1 ? '' : 's'} (${minimoLb}–${maximoLb} lb)`;

  return {
    cantidad: validos.length,
    promedioLb,
    minimoLb,
    maximoLb,
    dispersionLb,
    metodoRegistro,
    resumenTexto
  };
}

export function construirEstadoNavegacion({
  vista = 'hoy',
  corralId = null,
  tabActiva = 'resumen',
  qrModalAbierto = false,
  isChatOpen = false
} = {}) {
  const vistaNormalizada = vista === 'corral' ? 'corralDetail' : vista;
  return {
    porciNav: true,
    vista: vistaNormalizada || 'hoy',
    corralId: corralId || null,
    tabActiva: tabActiva || 'resumen',
    qrModalAbierto: Boolean(qrModalAbierto),
    isChatOpen: Boolean(isChatOpen)
  };
}

export function sonEstadosNavegacionIguales(a, b) {
  if (!a || !b) return false;
  return (
    a.vista === b.vista &&
    (a.corralId || null) === (b.corralId || null) &&
    (a.tabActiva || 'resumen') === (b.tabActiva || 'resumen') &&
    Boolean(a.qrModalAbierto) === Boolean(b.qrModalAbierto) &&
    Boolean(a.isChatOpen) === Boolean(b.isChatOpen)
  );
}
