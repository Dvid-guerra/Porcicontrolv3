import { describe, expect, it } from 'vitest';
import {
  addDaysLocalIso,
  calcularMediana,
  calcularPesoSchaefferLb,
  calcularProgresoEmbarque,
  construirClaveBorradorBascula,
  construirEstadoNavegacion,
  evaluarPesoBascula,
  formatLocalIsoDate,
  parsearBorradorBascula,
  resumirMuestraPesaje,
  serializarBorradorBascula,
  sonEstadosNavegacionIguales
} from './fieldUx.js';

describe('fieldUx — fechas locales sin desfase UTC nocturno', () => {
  it('formatea la fecha local aunque en UTC ya sea el día siguiente', () => {
    const localEvening = new Date(2026, 9, 30, 21, 30, 0); // 30 oct 2026 9:30 PM local
    expect(formatLocalIsoDate(localEvening)).toBe('2026-10-30');
  });

  it('suma días preservando calendario local en cruces de mes y año', () => {
    expect(addDaysLocalIso('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDaysLocalIso('2026-12-30', 5)).toBe('2027-01-04');
  });
});

describe('fieldUx — báscula modo galpón (anti-dedazo y progreso)', () => {
  it('calcula correctamente la mediana para listas pares e impares', () => {
    expect(calcularMediana([210, 230, 220])).toBe(220);
    expect(calcularMediana([200, 220, 230, 250])).toBe(225);
  });

  it('rechaza pesos vacíos, negativos o cero', () => {
    expect(evaluarPesoBascula({ peso: '' }).ok).toBe(false);
    expect(evaluarPesoBascula({ peso: 0 }).ok).toBe(false);
    expect(evaluarPesoBascula({ peso: -15 }).ok).toBe(false);
  });

  it('detecta dedazos excesivos como 2220 lb o muy bajos como 22 lb', () => {
    const alto = evaluarPesoBascula({ peso: 2220, pesosPrevios: [215, 220] });
    expect(alto.ok).toBe(true);
    expect(alto.sospechoso).toBe(true);
    expect(alto.tipoAlerta).toBe('excesivo');

    const bajo = evaluarPesoBascula({ peso: 22, pesosPrevios: [215, 220] });
    expect(bajo.ok).toBe(true);
    expect(bajo.sospechoso).toBe(true);
    expect(bajo.tipoAlerta).toBe('muy_bajo');
  });

  it('detecta desviación atípica frente al grupo ya pesado', () => {
    const atipico = evaluarPesoBascula({ peso: 115, pesosPrevios: [218, 222, 220] });
    expect(atipico.ok).toBe(true);
    expect(atipico.sospechoso).toBe(true);
    expect(atipico.tipoAlerta).toBe('desviacion_lote');

    const normal = evaluarPesoBascula({ peso: 232, pesosPrevios: [218, 222, 220] });
    expect(normal.ok).toBe(true);
    expect(normal.sospechoso).toBe(false);
  });

  it('calcula progreso del embarque, faltantes y exceso', () => {
    const parcial = calcularProgresoEmbarque({ pesosCapturados: [210, 220, 230], cerdosVivos: 10 });
    expect(parcial).toMatchObject({
      pesados: 3,
      vivos: 10,
      faltantes: 7,
      completado: false,
      excedido: false,
      porcentaje: 30,
      totalLb: 660,
      promedioLb: 220
    });

    const lleno = calcularProgresoEmbarque({ pesosCapturados: [210, 220], cerdosVivos: 2 });
    expect(lleno.completado).toBe(true);
    expect(lleno.faltantes).toBe(0);
  });

  it('serializa y recupera el borrador de báscula para no perder pesos si entra llamada', () => {
    const key = construirClaveBorradorBascula('agro-local', 'c2', 'lote9');
    expect(key).toContain('c2_lote9');

    const raw = serializarBorradorBascula({ pesos: [215.4, '220', -4], precioLibra: 11.5, updatedAt: 12345 });
    const parsed = parsearBorradorBascula(raw);
    expect(parsed).toEqual({
      pesos: [215.4, 220],
      precioLibra: 11.5,
      updatedAt: 12345
    });
    expect(parsearBorradorBascula('corrupto')).toBeNull();
  });
});

describe('fieldUx — muestreo multi-cerdo en corral (báscula + cinta Schaeffer)', () => {
  it('calcula peso por cinta Schaeffer en libras', () => {
    const peso = calcularPesoSchaefferLb(110, 100, 400);
    expect(peso).toBeGreaterThan(180);
    expect(peso).toBeLessThan(190);
    expect(calcularPesoSchaefferLb(0, 100)).toBeNull();
  });

  it('resume una muestra de varios cerdos con promedio, rango y método', () => {
    const resumen = resumirMuestraPesaje([
      { id: '1', pesoLb: 140, metodo: 'directo' },
      { id: '2', pesoLb: 148, metodo: 'directo' },
      { id: '3', pesoLb: 135, metodo: 'directo' }
    ]);
    expect(resumen.cantidad).toBe(3);
    expect(resumen.promedioLb).toBeCloseTo(141, 1);
    expect(resumen.minimoLb).toBe(135);
    expect(resumen.maximoLb).toBe(148);
    expect(resumen.dispersionLb).toBe(13);
    expect(resumen.metodoRegistro).toBe('directo');

    const mixto = resumirMuestraPesaje([
      { id: '1', pesoLb: 140, metodo: 'directo' },
      { id: '2', pesoLb: 146, metodo: 'schaeffer' }
    ]);
    expect(mixto.metodoRegistro).toBe('mixto');
  });
});

describe('fieldUx — estado de navegación móvil', () => {
  it('normaliza el alias "corral" a "corralDetail" y compara estados', () => {
    const a = construirEstadoNavegacion({ vista: 'corral', corralId: 'c1', tabActiva: 'peso' });
    const b = construirEstadoNavegacion({ vista: 'corralDetail', corralId: 'c1', tabActiva: 'peso' });
    expect(a.vista).toBe('corralDetail');
    expect(sonEstadosNavegacionIguales(a, b)).toBe(true);
  });
});
