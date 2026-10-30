import { describe, expect, it } from 'vitest';
import {
  MOTIVO_CAMARA,
  calcularTamanoCaptura,
  crearControlEscaneoRepetido,
  describirErrorCamara,
  soportaDeteccionNativaQr
} from './qrScanner.js';

describe('describirErrorCamara', () => {
  it('culpa al http antes que al navegador cuando el contexto no es seguro', () => {
    const res = describirErrorCamara({ soportaMediaDevices: false, contextoSeguro: false });
    expect(res.motivo).toBe(MOTIVO_CAMARA.SIN_HTTPS);
    expect(res.mensaje).toContain('https://');
    expect(res.reintentable).toBe(false);
  });

  it('marca sin soporte cuando falta la API pero el sitio es seguro', () => {
    const res = describirErrorCamara({ soportaMediaDevices: false });
    expect(res.motivo).toBe(MOTIVO_CAMARA.SIN_SOPORTE);
    expect(res.reintentable).toBe(false);
  });

  it('ofrece reintentar cuando el operario negó el permiso', () => {
    const res = describirErrorCamara({ error: { name: 'NotAllowedError' } });
    expect(res.motivo).toBe(MOTIVO_CAMARA.PERMISO_DENEGADO);
    expect(res.reintentable).toBe(true);
  });

  it('no ofrece reintentar cuando el equipo no tiene cámara', () => {
    expect(describirErrorCamara({ error: { name: 'NotFoundError' } }).motivo).toBe(MOTIVO_CAMARA.SIN_CAMARA);
    expect(describirErrorCamara({ error: { name: 'OverconstrainedError' } }).reintentable).toBe(false);
  });

  it('explica que otra app tiene tomada la cámara', () => {
    const res = describirErrorCamara({ error: { name: 'NotReadableError' } });
    expect(res.motivo).toBe(MOTIVO_CAMARA.CAMARA_OCUPADA);
    expect(res.reintentable).toBe(true);
  });

  it('cae en un mensaje genérico reintentable ante errores desconocidos', () => {
    const res = describirErrorCamara({ error: { name: 'LoQueSea' } });
    expect(res.motivo).toBe(MOTIVO_CAMARA.DESCONOCIDO);
    expect(res.reintentable).toBe(true);
  });

  it('no explota si se invoca sin argumentos', () => {
    expect(describirErrorCamara().motivo).toBe(MOTIVO_CAMARA.DESCONOCIDO);
  });
});

describe('crearControlEscaneoRepetido', () => {
  it('procesa la primera lectura y descarta las repeticiones inmediatas', () => {
    const control = crearControlEscaneoRepetido({ ventanaMs: 2500 });
    expect(control.debeProcesar('PORCI:CORRAL:c1', 1000)).toBe(true);
    expect(control.debeProcesar('PORCI:CORRAL:c1', 1260)).toBe(false);
    expect(control.debeProcesar('PORCI:CORRAL:c1', 1520)).toBe(false);
  });

  it('refresca la ventana en cada avistamiento para no repetir el error del mismo rótulo', () => {
    const control = crearControlEscaneoRepetido({ ventanaMs: 2500 });
    expect(control.debeProcesar('c9', 0)).toBe(true);
    // El rótulo sigue en el encuadre: nunca vuelve a dispararse aunque pasen 10 s.
    for (let t = 200; t <= 10000; t += 200) {
      expect(control.debeProcesar('c9', t)).toBe(false);
    }
  });

  it('vuelve a procesar el mismo código si salió del encuadre más que la ventana', () => {
    const control = crearControlEscaneoRepetido({ ventanaMs: 2500 });
    expect(control.debeProcesar('c1', 0)).toBe(true);
    expect(control.debeProcesar('c1', 2600)).toBe(true);
  });

  it('procesa de inmediato un código distinto', () => {
    const control = crearControlEscaneoRepetido({ ventanaMs: 2500 });
    expect(control.debeProcesar('c1', 0)).toBe(true);
    expect(control.debeProcesar('c2', 100)).toBe(true);
  });

  it('ignora texto vacío o en blanco sin ensuciar el estado', () => {
    const control = crearControlEscaneoRepetido();
    expect(control.debeProcesar('', 0)).toBe(false);
    expect(control.debeProcesar('   ', 0)).toBe(false);
    expect(control.debeProcesar(null, 0)).toBe(false);
    expect(control.debeProcesar('c1', 0)).toBe(true);
  });

  it('reiniciar permite releer el último código sin esperar', () => {
    const control = crearControlEscaneoRepetido({ ventanaMs: 2500 });
    expect(control.debeProcesar('c1', 0)).toBe(true);
    expect(control.debeProcesar('c1', 10)).toBe(false);
    control.reiniciar();
    expect(control.debeProcesar('c1', 20)).toBe(true);
  });
});

describe('calcularTamanoCaptura', () => {
  it('reduce un cuadro 1280x720 al lado máximo conservando la proporción', () => {
    const res = calcularTamanoCaptura({ ancho: 1280, alto: 720, ladoMaximo: 640 });
    expect(res.ancho).toBe(640);
    expect(res.alto).toBe(360);
    expect(res.escala).toBeCloseTo(0.5);
  });

  it('respeta cuadros verticales tomando el lado mayor', () => {
    const res = calcularTamanoCaptura({ ancho: 720, alto: 1280, ladoMaximo: 640 });
    expect(res.ancho).toBe(360);
    expect(res.alto).toBe(640);
  });

  it('no amplía un cuadro que ya es pequeño', () => {
    const res = calcularTamanoCaptura({ ancho: 320, alto: 240, ladoMaximo: 640 });
    expect(res).toEqual({ ancho: 320, alto: 240, escala: 1 });
  });

  it('devuelve null mientras el video no reporta dimensiones', () => {
    expect(calcularTamanoCaptura({ ancho: 0, alto: 0 })).toBeNull();
    expect(calcularTamanoCaptura({ ancho: NaN, alto: 480 })).toBeNull();
    expect(calcularTamanoCaptura()).toBeNull();
  });

  it('nunca devuelve un lado menor a 1 px', () => {
    const res = calcularTamanoCaptura({ ancho: 1000, alto: 1, ladoMaximo: 10 });
    expect(res.ancho).toBe(10);
    expect(res.alto).toBe(1);
  });
});

describe('soportaDeteccionNativaQr', () => {
  it('detecta BarcodeDetector nativo', () => {
    expect(soportaDeteccionNativaQr({ BarcodeDetector: function Falso() {} })).toBe(true);
  });

  it('responde false en Safari/Firefox y ante ámbitos inválidos', () => {
    expect(soportaDeteccionNativaQr({})).toBe(false);
    expect(soportaDeteccionNativaQr({ BarcodeDetector: 'no-es-constructor' })).toBe(false);
    expect(soportaDeteccionNativaQr(undefined)).toBe(false);
  });
});
