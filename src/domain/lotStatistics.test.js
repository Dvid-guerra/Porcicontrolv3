import { describe, expect, it } from 'vitest';
import { calculateLotDays, calculateLotStatistics } from './lotStatistics.js';

describe('calculateLotDays', () => {
  it('calcula días sin ocultar fechas invertidas', () => {
    expect(calculateLotDays('2026-01-01', '2026-01-11')).toBe(10);
    expect(calculateLotDays('2026-01-11', '2026-01-01')).toBeNull();
  });

  it('rechaza fechas inválidas', () => {
    expect(calculateLotDays('', '2026-01-01')).toBeNull();
    expect(calculateLotDays('fecha-invalida', '2026-01-01')).toBeNull();
  });
});

describe('calculateLotStatistics', () => {
  const lot = {
    id: 'lote-1',
    cantidad: 10,
    fechaIngreso: '2026-01-01',
    fechaSalida: '2026-01-11',
    costoLechon: 100,
    precioVentaLibra: 10,
    manoObra: 50
  };

  it('calcula mortalidad, costos y utilidad con datos consistentes', () => {
    const result = calculateLotStatistics({
      lot,
      deaths: [{ loteId: lot.id, cantidad: 1 }],
      feedings: [{ loteId: lot.id, cantidadLb: 900, costo: 450, esSuplemento: false }],
      weights: [
        { loteId: lot.id, fecha: '2026-01-01', pesoPromedio: 40 },
        { loteId: lot.id, fecha: '2026-01-11', pesoPromedio: 60 }
      ],
      vaccines: [{ loteId: lot.id, costo: 20 }],
      extraExpenses: [{ loteId: lot.id, monto: 30 }]
    });

    expect(result.cantidadActual).toBe(9);
    expect(result.mortalidadPorcentaje).toBe(10);
    expect(result.costoInvertidoTotal).toBe(1500);
    expect(result.ingresoEstimado).toBe(5400);
    expect(result.utilidadNeta).toBe(3850);
    expect(result.fca).toBeCloseTo(900 / 180);
    expect(result.pesoProducidoLb).toBe(180);
  });

  it('incluye ventas parciales sin contar dos veces los animales vendidos', () => {
    const result = calculateLotStatistics({
      lot,
      sales: [{ loteId: lot.id, fecha: '2026-01-06', cantidadCerdos: 2, totalLibras: 120, totalVenta: 1200 }],
      feedings: [{ loteId: lot.id, cantidadLb: 900, costo: 450 }],
      weights: [
        { loteId: lot.id, fecha: '2026-01-01', pesoPromedio: 40 },
        { loteId: lot.id, fecha: '2026-01-11', pesoPromedio: 60 }
      ]
    });

    expect(result.cantidadActual).toBe(8);
    expect(result.ingresoEstimado).toBe(6000);
    expect(result.librasVendidas).toBe(120);
    expect(result.pesoProducidoLb).toBe(200);
    expect(result.fca).toBeCloseTo(900 / 200);
    expect(result.adg).toBeCloseTo(200 / 90);
  });
});
