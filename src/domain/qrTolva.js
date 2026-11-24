import { etapaAlimentacion } from './granja/etapa.js';

// ============================================================================
// DOMINIO: DESCUENTO DE CONCENTRADO EN TOLVA POR CÓDIGO QR (OPCIÓN 1: QR EN CORRAL)
// ============================================================================

const QR_CORRAL_PARAM = 'qrCorral';
const QR_CORRAL_PREFIX = 'PORCI:CORRAL:';

/**
 * Construye el contenido del QR para un corral.
 * Si se provee `origin` (ej. window.location.origin), genera una URL con `?qrCorral=<id>`
 * que funciona tanto al escanearse con la cámara nativa del teléfono (abre la app directo
 * en el corral) como con el escáner interno de Porcicontrol.
 */
export function buildCorralQrPayload(corral, origin = '') {
  const corralId = typeof corral === 'string' ? corral.trim() : String(corral?.id || '').trim();
  if (!corralId) return '';

  const cleanOrigin = String(origin || '').trim().replace(/\/+$/, '');
  if (cleanOrigin && /^https?:\/\//i.test(cleanOrigin)) {
    return `${cleanOrigin}/?${QR_CORRAL_PARAM}=${encodeURIComponent(corralId)}`;
  }

  return `${QR_CORRAL_PREFIX}${corralId}`;
}

/**
 * Interpreta cualquier texto escaneado desde un QR y resuelve a qué corral corresponde.
 * Soporta:
 *  1. URL con query param: https://.../?qrCorral=c1
 *  2. JSON: {"tipo":"corral","corralId":"c1"}
 *  3. Código corto: PORCI:CORRAL:c1
 *  4. ID directo o nombre exacto del corral (ej. "c1" o "Corral 1")
 */
export function parseCorralQrPayload(rawText, corrales = []) {
  const raw = String(rawText || '').trim();
  if (!raw) {
    return { ok: false, corralId: null, corral: null, error: 'El código QR está vacío.' };
  }

  const listaCorrales = Array.isArray(corrales) ? corrales : [];
  let candidateId = null;

  // 1. Intentar como URL con ?qrCorral=...
  if (/^https?:\/\//i.test(raw) || raw.includes(`${QR_CORRAL_PARAM}=`)) {
    try {
      const url = new URL(raw, 'https://porcicontrol.local');
      const paramId = url.searchParams.get(QR_CORRAL_PARAM) || url.searchParams.get('corralId') || url.searchParams.get('corral');
      if (paramId) candidateId = paramId.trim();
    } catch {
      const match = raw.match(/[?&](?:qrCorral|corralId|corral)=([^&#\s]+)/i);
      if (match) candidateId = decodeURIComponent(match[1]).trim();
    }
  }

  // 2. Intentar como JSON {"tipo":"corral","corralId":"c1"}
  if (!candidateId && raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.corralId || parsed.id)) {
        candidateId = String(parsed.corralId || parsed.id).trim();
      }
    } catch {
      // No es JSON válido, seguir probando
    }
  }

  // 3. Intentar con prefijo PORCI:CORRAL:<id>
  if (!candidateId && raw.toUpperCase().startsWith(QR_CORRAL_PREFIX)) {
    candidateId = raw.slice(QR_CORRAL_PREFIX.length).trim();
  }

  // 4. Si aún no hay candidateId, usar el texto plano
  if (!candidateId) {
    candidateId = raw;
  }

  const normalized = candidateId.toLowerCase();
  const corral = listaCorrales.find(
    (c) =>
      String(c.id || '').toLowerCase() === normalized ||
      String(c.nombre || '').trim().toLowerCase() === normalized
  ) || null;

  if (!corral) {
    return {
      ok: false,
      corralId: candidateId,
      corral: null,
      error: `No se encontró ningún corral registrado para el código "${candidateId}".`
    };
  }

  return {
    ok: true,
    corralId: corral.id,
    corral,
    error: null
  };
}

/**
 * Resuelve el contexto operativo de la tolva al escanear un corral:
 * detecta el lote activo, la etapa actual según días o fase forzada,
 * el concentrado comercial sugerido y las existencias disponibles en Bodega Central.
 */
export function resolverContextoTolvaQr({
  corral,
  loteActivo,
  stats,
  cronograma = [],
  catalogoAlimento = [],
  inventarioCentral = []
}) {
  if (!corral) {
    return {
      ok: false,
      tieneLoteActivo: false,
      error: 'Corral no válido.'
    };
  }

  if (!loteActivo) {
    return {
      ok: false,
      tieneLoteActivo: false,
      corral,
      error: `${corral.nombre} está vacío actualmente. Ingresa un lote antes de descargar alimento.`
    };
  }

  const diasLote = Number(stats?.diasLote) || 1;
  const { faseActual, faseInfo, alimentoSugerido } = etapaAlimentacion(loteActivo, diasLote, cronograma, catalogoAlimento);

  const infoCatalogo = catalogoAlimento.find((a) => a.nombre === alimentoSugerido) || null;
  const itemStock = inventarioCentral.find((i) => i.nombre === alimentoSugerido) || null;
  const librasPorSaco = Number(infoCatalogo?.librasPorSaco) || 50;
  const precioSaco = Number(infoCatalogo?.precioSaco) || 0;
  const stockLbs = Number(itemStock?.stockLbs) || 0;
  const stockSacos = librasPorSaco > 0 ? stockLbs / librasPorSaco : 0;

  return {
    ok: true,
    tieneLoteActivo: true,
    corral,
    loteActivo,
    diasLote,
    cantidadActual: Number(stats?.cantidadActual) || Number(loteActivo.cantidadActual) || Number(loteActivo.cantidadInicial) || 0,
    faseActual,
    faseInfo,
    alimentoSugerido,
    librasPorSaco,
    precioSaco,
    stockLbs,
    stockSacos,
    error: null
  };
}

/**
 * Calcula y valida un descuento de concentrado en tolva (manual o por QR).
 */
export function calcularDescuentoTolva({
  tipoAlimento,
  cantidad,
  unidad = 'sacos',
  faseDestino,
  fecha,
  loteActivo,
  catalogoAlimento = [],
  inventarioCentral = [],
  origenRegistro = 'qr'
}) {
  if (!loteActivo?.id) {
    return { ok: false, error: 'No hay lote activo en este corral.' };
  }

  const cantNum = parseFloat(cantidad);
  const info = catalogoAlimento.find((a) => a.nombre === tipoAlimento);
  if (!info || !(cantNum > 0)) {
    return { ok: false, error: 'Revisa la cantidad y el tipo de concentrado.' };
  }

  const librasPorSaco = Number(info.librasPorSaco) || 50;
  const precioSaco = Number(info.precioSaco) || 0;
  const costoPorLb = precioSaco / librasPorSaco;

  const librasSuministradas = unidad === 'sacos' ? cantNum * librasPorSaco : cantNum;
  const sacosEquivalentes = librasSuministradas / librasPorSaco;
  const costoTotal = unidad === 'sacos' ? cantNum * precioSaco : cantNum * costoPorLb;

  const itemEnCentral = inventarioCentral.find((i) => i.nombre === tipoAlimento);
  const stockDisponibleLbs = Number(itemEnCentral?.stockLbs) || 0;

  if (!itemEnCentral || stockDisponibleLbs + 1e-6 < librasSuministradas) {
    const faltanLbs = Math.max(0, librasSuministradas - stockDisponibleLbs);
    const faltanSacos = faltanLbs / librasPorSaco;
    return {
      ok: false,
      codigoError: 'STOCK_INSUFICIENTE',
      faltanLbs,
      faltanSacos,
      stockDisponibleLbs,
      error: `No tienes suficiente ${tipoAlimento} en la Bodega Central. Disponible: ${stockDisponibleLbs.toFixed(1)} lb (${(stockDisponibleLbs / librasPorSaco).toFixed(2)} sacos). Te faltan ${faltanLbs.toFixed(1)} lb.`
    };
  }

  const faseNum = parseInt(faseDestino, 10) || Number(loteActivo.faseActual) || 1;
  const fechaRegistro = fecha || new Date().toISOString().split('T')[0];

  return {
    ok: true,
    librasSuministradas,
    sacosEquivalentes,
    costoTotal,
    costoPorLb,
    stockRestanteLbs: Math.max(0, stockDisponibleLbs - librasSuministradas),
    stockRestanteSacos: Math.max(0, (stockDisponibleLbs - librasSuministradas) / librasPorSaco),
    registro: {
      loteId: loteActivo.id,
      fecha: fechaRegistro,
      tipo: tipoAlimento,
      cantidadLb: librasSuministradas,
      costo: costoTotal,
      esSuplemento: false,
      ahorro: 0,
      costoPorLb,
      faseRegistro: faseNum,
      origenRegistro
    }
  };
}

// ============================================================================
// GENERADOR DE MATRIZ QR (ISO/IEC 18004 - MODO BYTE, ECC NIVEL M, V1..V10)
// Cero dependencias externas, 100% offline y compatible con exportación PDF.
// ============================================================================

// Capacidad de bytes de datos en nivel de corrección M para versiones 1 a 10
// y parámetros de bloques de corrección Reed-Solomon: [totalCodewords, ecCodewordsPerBlock, numBlocksGroup1, dataCodewordsGroup1, numBlocksGroup2, dataCodewordsGroup2]
const QR_VERSION_PARAMS_M = [
  null,
  [26, 10, 1, 16, 0, 0],   // V1:  16 bytes máx -> 14 chars
  [44, 16, 1, 28, 0, 0],   // V2:  28 bytes máx -> 26 chars
  [70, 26, 1, 44, 0, 0],   // V3:  44 bytes máx -> 42 chars
  [100, 18, 2, 32, 0, 0],  // V4:  64 bytes máx -> 62 chars
  [134, 24, 2, 43, 0, 0],  // V5:  86 bytes máx -> 84 chars
  [172, 16, 4, 27, 0, 0],  // V6: 108 bytes máx -> 106 chars
  [196, 18, 4, 31, 0, 0],  // V7: 124 bytes máx -> 122 chars
  [242, 22, 2, 38, 2, 39], // V8: 154 bytes máx -> 152 chars
  [292, 22, 3, 36, 2, 37], // V9: 182 bytes máx -> 180 chars
  [346, 26, 4, 43, 1, 44]  // V10: 216 bytes máx -> 213 chars
];

const ALIGNMENT_PATTERNS = [
  null,
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50]
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree) {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data, ecLen) {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

function utf8Bytes(str) {
  return Array.from(new TextEncoder().encode(String(str ?? '')));
}

function pickVersion(byteLength) {
  for (let v = 1; v <= 10; v++) {
    const [, , g1Blocks, g1Data, g2Blocks, g2Data] = QR_VERSION_PARAMS_M[v];
    const totalDataCodewords = g1Blocks * g1Data + g2Blocks * g2Data;
    const headerBits = v <= 9 ? 4 + 8 : 4 + 16;
    const maxBytes = Math.floor((totalDataCodewords * 8 - headerBits) / 8);
    if (byteLength <= maxBytes) return v;
  }
  throw new Error('El texto del QR excede la longitud máxima soportada.');
}

function buildDataCodewords(bytes, version) {
  const [, , g1Blocks, g1Data, g2Blocks, g2Data] = QR_VERSION_PARAMS_M[version];
  const totalDataCodewords = g1Blocks * g1Data + g2Blocks * g2Data;
  const totalBitsCapacity = totalDataCodewords * 8;

  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Modo Byte = 0100
  pushBits(0b0100, 4);
  pushBits(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) pushBits(b, 8);

  // Terminador (hasta 4 ceros)
  const terminator = Math.min(4, totalBitsCapacity - bits.length);
  pushBits(0, terminator);

  // Alinear a múltiplo de 8 bits
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }

  let padIdx = 0;
  const pads = [0xec, 0x11];
  while (codewords.length < totalDataCodewords) {
    codewords.push(pads[padIdx % 2]);
    padIdx++;
  }

  return new Uint8Array(codewords);
}

function interleaveCodewords(dataCodewords, version) {
  const [, ecLen, g1Blocks, g1Data, g2Blocks, g2Data] = QR_VERSION_PARAMS_M[version];
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;

  for (let i = 0; i < g1Blocks; i++) {
    const block = dataCodewords.slice(offset, offset + g1Data);
    offset += g1Data;
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecLen));
  }
  for (let i = 0; i < g2Blocks; i++) {
    const block = dataCodewords.slice(offset, offset + g2Data);
    offset += g2Data;
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecLen));
  }

  const result = [];
  const maxDataLen = Math.max(g1Data, g2Data);
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  for (let i = 0; i < ecLen; i++) {
    for (const block of ecBlocks) {
      result.push(block[i]);
    }
  }
  return new Uint8Array(result);
}

function createEmptyMatrix(size) {
  const modules = Array.from({ length: size }, () => new Uint8Array(size));
  const isFunc = Array.from({ length: size }, () => new Uint8Array(size));
  return { size, modules, isFunc };
}

function setFuncModule(matrix, r, c, dark) {
  if (r < 0 || r >= matrix.size || c < 0 || c >= matrix.size) return;
  matrix.modules[r][c] = dark ? 1 : 0;
  matrix.isFunc[r][c] = 1;
}

function drawFinderPattern(matrix, r, c) {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const rr = r + dy;
      const cc = c + dx;
      if (rr < 0 || rr >= matrix.size || cc < 0 || cc >= matrix.size) continue;
      const inOuter = dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6;
      const inWhite = dy >= 1 && dy <= 5 && dx >= 1 && dx <= 5;
      const inInner = dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4;
      const dark = inOuter && (!inWhite || inInner);
      setFuncModule(matrix, rr, cc, dark);
    }
  }
}

function drawAlignmentPattern(matrix, centerR, centerC) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const dist = Math.max(Math.abs(dy), Math.abs(dx));
      setFuncModule(matrix, centerR + dy, centerC + dx, dist !== 1);
    }
  }
}

function drawFunctionPatterns(matrix, version) {
  const size = matrix.size;
  drawFinderPattern(matrix, 0, 0);
  drawFinderPattern(matrix, 0, size - 7);
  drawFinderPattern(matrix, size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    setFuncModule(matrix, 6, i, i % 2 === 0);
    setFuncModule(matrix, i, 6, i % 2 === 0);
  }

  const alignCoords = ALIGNMENT_PATTERNS[version];
  for (let i = 0; i < alignCoords.length; i++) {
    for (let j = 0; j < alignCoords.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === alignCoords.length - 1) ||
        (i === alignCoords.length - 1 && j === 0)
      ) {
        continue;
      }
      drawAlignmentPattern(matrix, alignCoords[i], alignCoords[j]);
    }
  }

  // Dark module
  setFuncModule(matrix, 4 * version + 9, 8, true);

  // Reservar áreas de formato
  for (let i = 0; i < 8; i++) {
    if (!matrix.isFunc[8][i]) setFuncModule(matrix, 8, i, false);
    if (!matrix.isFunc[i][8]) setFuncModule(matrix, i, 8, false);
    if (!matrix.isFunc[8][size - 1 - i]) setFuncModule(matrix, 8, size - 1 - i, false);
    if (!matrix.isFunc[size - 1 - i][8]) setFuncModule(matrix, size - 1 - i, 8, false);
  }
  if (!matrix.isFunc[8][8]) setFuncModule(matrix, 8, 8, false);

  // Versión >= 7 requiere bloques de versión (reservados por si acaso)
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) {
      rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    }
    const verBits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((verBits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFuncModule(matrix, a, b, bit);
      setFuncModule(matrix, b, a, bit);
    }
  }
}

function drawFormatBits(matrix, mask) {
  // Nivel M = 00 en formato QR (ISO/IEC 18004)
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  }
  const bits = ((data << 10) | rem) ^ 0x5412;
  const size = matrix.size;

  // Primera copia (alrededor del patrón superior izquierdo: r = y, c = x)
  for (let i = 0; i <= 5; i++) setFuncModule(matrix, i, 8, ((bits >>> i) & 1) !== 0);
  setFuncModule(matrix, 7, 8, ((bits >>> 6) & 1) !== 0);
  setFuncModule(matrix, 8, 8, ((bits >>> 7) & 1) !== 0);
  setFuncModule(matrix, 8, 7, ((bits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i++) setFuncModule(matrix, 8, 14 - i, ((bits >>> i) & 1) !== 0);

  // Segunda copia (superior derecha e inferior izquierda)
  for (let i = 0; i < 8; i++) setFuncModule(matrix, 8, size - 1 - i, ((bits >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i++) setFuncModule(matrix, size - 15 + i, 8, ((bits >>> i) & 1) !== 0);
  setFuncModule(matrix, size - 8, 8, true);
}

function placeDataBits(matrix, codewords) {
  const size = matrix.size;
  let bitIdx = 0;
  const totalBits = codewords.length * 8;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const upward = ((right + 1) & 2) === 0;
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!matrix.isFunc[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            dark = ((codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0;
            bitIdx++;
          }
          matrix.modules[r][c] = dark ? 1 : 0;
        }
      }
    }
  }
}

function applyMask(matrix, mask) {
  const size = matrix.size;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix.isFunc[r][c]) continue;
      let invert = false;
      switch (mask) {
        case 0: invert = (r + c) % 2 === 0; break;
        case 1: invert = r % 2 === 0; break;
        case 2: invert = c % 3 === 0; break;
        case 3: invert = (r + c) % 3 === 0; break;
        case 4: invert = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; break;
        case 5: invert = ((r * c) % 2) + ((r * c) % 3) === 0; break;
        case 6: invert = (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; break;
        case 7: invert = (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; break;
        default: break;
      }
      if (invert) matrix.modules[r][c] ^= 1;
    }
  }
}

// Secuencias 1:1:3:1:1 rodeadas de 4 módulos claros. Un patrón así imita al
// buscador de las esquinas y hace que el lector ubique mal la cuadrícula, por eso
// ISO/IEC 18004 lo castiga fuerte: es la regla que más influye en que un rótulo
// impreso y plastificado se lea de un solo intento.
const PATRON_FALSO_BUSCADOR_A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
const PATRON_FALSO_BUSCADOR_B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];

function coincidePatron(linea, inicio, patron) {
  for (let i = 0; i < patron.length; i++) {
    if (linea[inicio + i] !== patron[i]) return false;
  }
  return true;
}

function penalizarCorridas(linea) {
  let total = 0;
  let colorCorrida = linea[0];
  let largoCorrida = 1;

  for (let i = 1; i < linea.length; i++) {
    if (linea[i] === colorCorrida) {
      largoCorrida++;
      // Regla 1: 5+ módulos consecutivos del mismo color
      if (largoCorrida === 5) total += 3;
      else if (largoCorrida > 5) total += 1;
    } else {
      colorCorrida = linea[i];
      largoCorrida = 1;
    }
  }

  // Regla 3: falsos patrones buscadores en esta fila o columna
  for (let i = 0; i + 11 <= linea.length; i++) {
    if (coincidePatron(linea, i, PATRON_FALSO_BUSCADOR_A) || coincidePatron(linea, i, PATRON_FALSO_BUSCADOR_B)) {
      total += 40;
    }
  }

  return total;
}

function computePenalty(matrix) {
  const size = matrix.size;
  const m = matrix.modules;
  let penalty = 0;

  // Reglas 1 y 3, evaluadas por fila y por columna
  const columna = new Uint8Array(size);
  for (let r = 0; r < size; r++) {
    penalty += penalizarCorridas(m[r]);
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r < size; r++) columna[r] = m[r][c];
    penalty += penalizarCorridas(columna);
  }

  // Regla 2: Bloques 2x2 del mismo color
  let oscuros = 0;
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const color = m[r][c];
      if (color === m[r][c + 1] && color === m[r + 1][c] && color === m[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // Regla 4: desbalance entre módulos oscuros y claros. Un QR muy oscuro o muy
  // claro pierde contraste al fotocopiarse o bajo la luz amarilla del galpón.
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (m[r][c]) oscuros++;
    }
  }
  const totalModulos = size * size;
  const desvioPorcentual = Math.abs((oscuros * 100) / totalModulos - 50);
  penalty += Math.floor(desvioPorcentual / 5) * 10;

  return penalty;
}

/**
 * Codifica cualquier cadena de texto en una matriz booleana 2D de QR (true = negro, false = blanco).
 */
export function encodeQrMatrix(text) {
  const bytes = utf8Bytes(text);
  if (bytes.length === 0) return { version: 1, size: 21, modules: [] };

  const version = pickVersion(bytes.length);
  const size = version * 4 + 17;
  const dataCodewords = buildDataCodewords(bytes, version);
  const allCodewords = interleaveCodewords(dataCodewords, version);

  let bestMatrix = null;
  let bestPenalty = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = createEmptyMatrix(size);
    drawFunctionPatterns(candidate, version);
    placeDataBits(candidate, allCodewords);
    applyMask(candidate, mask);
    drawFormatBits(candidate, mask);

    const penalty = computePenalty(candidate);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMatrix = candidate;
    }
  }

  const booleanGrid = bestMatrix.modules.map((row) => Array.from(row, (v) => v === 1));
  return {
    version,
    size,
    modules: booleanGrid
  };
}
