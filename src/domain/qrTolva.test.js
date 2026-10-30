import { describe, it, expect } from 'vitest';
import jsQR from 'jsqr';
import {
  buildCorralQrPayload,
  parseCorralQrPayload,
  resolverContextoTolvaQr,
  calcularDescuentoTolva,
  encodeQrMatrix
} from './qrTolva.js';

// Rasteriza la matriz igual que CodigoQrSvg (zona de silencio de 4 módulos) para
// poder pasarla por jsQR, el mismo decodificador que usa el lector de la app en
// Safari/Firefox. Si jsQR no lee lo que generamos, el rótulo impreso tampoco.
const rasterizarQr = (qr, { zonaSilencio = 4, escala = 4 } = {}) => {
  const lado = (qr.size + zonaSilencio * 2) * escala;
  const pixeles = new Uint8ClampedArray(lado * lado * 4).fill(255);

  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (!qr.modules[r][c]) continue;
      for (let dy = 0; dy < escala; dy++) {
        for (let dx = 0; dx < escala; dx++) {
          const y = (r + zonaSilencio) * escala + dy;
          const x = (c + zonaSilencio) * escala + dx;
          const i = (y * lado + x) * 4;
          pixeles[i] = 0;
          pixeles[i + 1] = 0;
          pixeles[i + 2] = 0;
        }
      }
    }
  }

  return { pixeles, lado };
};

const leerQr = (texto) => {
  const { pixeles, lado } = rasterizarQr(encodeQrMatrix(texto));
  return jsQR(pixeles, lado, lado)?.data ?? null;
};

const MOCK_CORRALES = [
  { id: 'c1', nombre: 'Corral 1', capacidad: 15 },
  { id: 'c2', nombre: 'Corral 2', capacidad: 20 }
];

const MOCK_CRONOGRAMA = [
  { fase: 1, alimento: 'VITALECHON 1', diaInicio: 1, diaFin: 11, consumoTotalLb: 6.6 },
  { fase: 2, alimento: 'VITALECHON 2', diaInicio: 12, diaFin: 21, consumoTotalLb: 11.0 },
  { fase: 4, alimento: 'VITALECHON 4', diaInicio: 29, diaFin: 49, consumoTotalLb: 48.4 }
];

const MOCK_CATALOGO = [
  { id: 'cat1', nombre: 'VITALECHON 1', librasPorSaco: 50, precioSaco: 394 },
  { id: 'cat4', nombre: 'VITALECHON 4', librasPorSaco: 50, precioSaco: 265 }
];

const MOCK_INVENTARIO = [
  { id: 'cat1', nombre: 'VITALECHON 1', stockLbs: 250, stockSacos: 5 },
  { id: 'cat4', nombre: 'VITALECHON 4', stockLbs: 75, stockSacos: 1.5 }
];

describe('qrTolva domain', () => {
  it('genera payload QR híbrido con origin y código corto sin origin', () => {
    expect(buildCorralQrPayload({ id: 'c1' }, 'https://porcicontrol.web.app')).toBe(
      'https://porcicontrol.web.app/?qrCorral=c1'
    );
    expect(buildCorralQrPayload({ id: 'c1' }, '')).toBe('PORCI:CORRAL:c1');
  });

  it('interpreta URLs, JSON, prefijo PORCI:CORRAL y nombre directo', () => {
    expect(parseCorralQrPayload('https://porcicontrol.web.app/?qrCorral=c1', MOCK_CORRALES)).toMatchObject({
      ok: true,
      corralId: 'c1'
    });

    expect(parseCorralQrPayload('{"tipo":"corral","corralId":"c2"}', MOCK_CORRALES)).toMatchObject({
      ok: true,
      corralId: 'c2'
    });

    expect(parseCorralQrPayload('PORCI:CORRAL:c1', MOCK_CORRALES)).toMatchObject({
      ok: true,
      corralId: 'c1'
    });

    expect(parseCorralQrPayload('Corral 2', MOCK_CORRALES)).toMatchObject({
      ok: true,
      corralId: 'c2'
    });

    const invalido = parseCorralQrPayload('PORCI:CORRAL:c99', MOCK_CORRALES);
    expect(invalido.ok).toBe(false);
    expect(invalido.error).toContain('c99');
  });

  it('resuelve contexto de tolva detectando fase, alimento sugerido y stock', () => {
    const sinLote = resolverContextoTolvaQr({
      corral: MOCK_CORRALES[0],
      loteActivo: null,
      cronograma: MOCK_CRONOGRAMA,
      catalogoAlimento: MOCK_CATALOGO,
      inventarioCentral: MOCK_INVENTARIO
    });
    expect(sinLote.ok).toBe(false);
    expect(sinLote.tieneLoteActivo).toBe(false);

    const conLote = resolverContextoTolvaQr({
      corral: MOCK_CORRALES[0],
      loteActivo: { id: 'lote1', corralId: 'c1', faseActual: 4, cantidadActual: 15 },
      stats: { diasLote: 35, cantidadActual: 15 },
      cronograma: MOCK_CRONOGRAMA,
      catalogoAlimento: MOCK_CATALOGO,
      inventarioCentral: MOCK_INVENTARIO
    });

    expect(conLote.ok).toBe(true);
    expect(conLote.faseActual).toBe(4);
    expect(conLote.alimentoSugerido).toBe('VITALECHON 4');
    expect(conLote.stockLbs).toBe(75);
    expect(conLote.stockSacos).toBe(1.5);
  });

  it('calcula descuento de concentrado en sacos y valida stock insuficiente', () => {
    const lote = { id: 'lote1', faseActual: 4 };

    const exito = calcularDescuentoTolva({
      tipoAlimento: 'VITALECHON 4',
      cantidad: 1,
      unidad: 'sacos',
      faseDestino: 4,
      fecha: '2026-10-29',
      loteActivo: lote,
      catalogoAlimento: MOCK_CATALOGO,
      inventarioCentral: MOCK_INVENTARIO
    });

    expect(exito.ok).toBe(true);
    expect(exito.librasSuministradas).toBe(50);
    expect(exito.costoTotal).toBe(265);
    expect(exito.stockRestanteLbs).toBe(25);
    expect(exito.registro).toMatchObject({
      loteId: 'lote1',
      tipo: 'VITALECHON 4',
      cantidadLb: 50,
      costo: 265,
      faseRegistro: 4,
      origenRegistro: 'qr'
    });

    const sinStock = calcularDescuentoTolva({
      tipoAlimento: 'VITALECHON 4',
      cantidad: 2,
      unidad: 'sacos',
      faseDestino: 4,
      fecha: '2026-10-29',
      loteActivo: lote,
      catalogoAlimento: MOCK_CATALOGO,
      inventarioCentral: MOCK_INVENTARIO
    });

    expect(sinStock.ok).toBe(false);
    expect(sinStock.codigoError).toBe('STOCK_INSUFICIENTE');
    expect(sinStock.faltanLbs).toBe(25);
  });

  it('codifica una matriz QR válida con patrones buscadores en las 3 esquinas', () => {
    const qr = encodeQrMatrix('https://porcicontrol.web.app/?qrCorral=c1');
    expect(qr.size).toBeGreaterThanOrEqual(21);
    expect(qr.modules.length).toBe(qr.size);
    // Esquina superior izquierda (7x7 finder pattern tiene borde negro en [0][0] y centro en [3][3])
    expect(qr.modules[0][0]).toBe(true);
    expect(qr.modules[3][3]).toBe(true);
    expect(qr.modules[1][1]).toBe(false);
    // Esquina superior derecha
    expect(qr.modules[0][qr.size - 1]).toBe(true);
    // Esquina inferior izquierda
    expect(qr.modules[qr.size - 1][0]).toBe(true);
  });
});

describe('encodeQrMatrix leído por un decodificador real (jsQR)', () => {
  it('decodifica el rótulo que se imprime para cada corral', () => {
    for (const corral of MOCK_CORRALES) {
      const payload = buildCorralQrPayload(corral, 'https://porcicontrol.web.app');
      expect(leerQr(payload)).toBe(payload);
    }
  });

  it('decodifica el código corto que se usa sin origin', () => {
    expect(leerQr('PORCI:CORRAL:c1')).toBe('PORCI:CORRAL:c1');
  });

  it('decodifica nombres de corral con acentos y eñes (modo byte UTF-8)', () => {
    const texto = 'PORCI:CORRAL:Galpón Ñandú #3 áéíóú';
    expect(leerQr(texto)).toBe(texto);
  });

  it('decodifica versiones 7 a 10, que llevan bloques de información de versión', () => {
    // 106 y 200 caracteres caen en V6/V7+ y V10 respectivamente.
    const medio = `https://porcicontrol.web.app/?qrCorral=${'x'.repeat(70)}`;
    const largo = 'A'.repeat(200);
    expect(leerQr(medio)).toBe(medio);
    expect(leerQr(largo)).toBe(largo);
  });

  it('rechaza textos más largos que la capacidad soportada en vez de emitir basura', () => {
    expect(() => encodeQrMatrix('A'.repeat(300))).toThrow(/longitud máxima/i);
  });

  it('mantiene el balance de módulos oscuros cerca del 50% (regla de máscara 4)', () => {
    const qr = encodeQrMatrix('https://porcicontrol.web.app/?qrCorral=c1');
    const oscuros = qr.modules.reduce((acc, fila) => acc + fila.filter(Boolean).length, 0);
    const proporcion = (oscuros / (qr.size * qr.size)) * 100;
    expect(proporcion).toBeGreaterThan(40);
    expect(proporcion).toBeLessThan(60);
  });
});
