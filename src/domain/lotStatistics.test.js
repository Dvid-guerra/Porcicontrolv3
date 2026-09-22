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

describe('proyeccion sobre la meta de peso', () => {
  const loteEnMeta = {
    id: 'lote-meta',
    cantidad: 10,
    fechaIngreso: '2026-01-01',
    costoLechon: 100,
    precioVentaLibra: 10,
    manoObra: 50
  };

  const statsEnMeta = (muertesExtra) => calculateLotStatistics({
    lot: loteEnMeta,
    feedings: [{ loteId: loteEnMeta.id, cantidadLb: 2000, costo: 1000 }],
    weights: [
      { loteId: loteEnMeta.id, fecha: '2026-01-01', pesoPromedio: 40 },
      { loteId: loteEnMeta.id, fecha: '2026-04-01', pesoPromedio: 230 }
    ],
    extraProjectedDeaths: muertesExtra,
    now: new Date('2026-04-01T12:00:00')
  });

  it('sin bajas simuladas la proyeccion coincide con la utilidad neta', () => {
    const result = statsEnMeta(0);
    expect(result.pesoActual).toBe(230);
    expect(result.proyeccionLibrasFaltantes).toBe(0);
    expect(result.proyeccionCostoFaltante).toBe(0);
    expect(result.proyeccionUtilidadFinal).toBeCloseTo(result.utilidadNeta);
  });

  it('el escenario de estres sigue respondiendo arriba de la meta', () => {
    const base = statsEnMeta(0);
    const conBajas = statsEnMeta(3);

    expect(conBajas.cantidadParaProyeccion).toBe(7);
    // Tres cerdos de 230 lb a Q10 la libra dejan de venderse.
    expect(base.proyeccionUtilidadFinal - conBajas.proyeccionUtilidadFinal).toBeCloseTo(3 * 230 * 10);
  });
});

describe('peso residual tras venta parcial', () => {
  const lote = {
    id: 'lote-2',
    cantidad: 20,
    fechaIngreso: '2026-01-01',
    costoLechon: 100,
    precioVentaLibra: 10
  };

  const pesajes = [
    { loteId: lote.id, fecha: '2026-01-01', pesoPromedio: 40 },
    { loteId: lote.id, fecha: '2026-05-01', pesoPromedio: 180 }
  ];

  it('descuenta las libras reales de bascula de los cerdos vendidos', () => {
    const result = calculateLotStatistics({
      lot: lote,
      weights: pesajes,
      // Se venden los 5 mas pesados a 220 lb despues del ultimo pesaje.
      sales: [{ loteId: lote.id, fecha: '2026-05-10', cantidadCerdos: 5, totalLibras: 1100, totalVenta: 11000 }],
      now: new Date('2026-05-15T12:00:00')
    });

    // (20 x 180 - 1100) / 15 = 166.67 lb, no los 180 del pesaje.
    expect(result.pesoActual).toBeCloseTo((20 * 180 - 1100) / 15);
    expect(result.pesoActualRegistrado).toBe(180);
    expect(result.pesoAjustadoPorVenta).toBe(true);
    expect(result.ingresoEstimadoVivos).toBeCloseTo(2500 * 10);
  });

  it('respeta el pesaje cuando es posterior a la venta', () => {
    const result = calculateLotStatistics({
      lot: lote,
      weights: pesajes,
      sales: [{ loteId: lote.id, fecha: '2026-04-01', cantidadCerdos: 5, totalLibras: 800, totalVenta: 8000 }],
      now: new Date('2026-05-15T12:00:00')
    });

    expect(result.pesoActual).toBe(180);
    expect(result.pesoAjustadoPorVenta).toBe(false);
  });

  it('ignora el ajuste si las libras vendidas son incoherentes', () => {
    const result = calculateLotStatistics({
      lot: lote,
      weights: pesajes,
      sales: [{ loteId: lote.id, fecha: '2026-05-10', cantidadCerdos: 5, totalLibras: 99999, totalVenta: 11000 }],
      now: new Date('2026-05-15T12:00:00')
    });

    expect(result.pesoActual).toBe(180);
    expect(result.pesoAjustadoPorVenta).toBe(false);
  });

  it('conserva el ultimo pesaje cuando el lote se vende completo', () => {
    const result = calculateLotStatistics({
      lot: lote,
      weights: pesajes,
      sales: [{ loteId: lote.id, fecha: '2026-05-10', cantidadCerdos: 20, totalLibras: 4000, totalVenta: 40000 }],
      now: new Date('2026-05-15T12:00:00')
    });

    expect(result.cantidadActual).toBe(0);
    expect(result.pesoActual).toBe(180);
    expect(result.ingresoEstimadoVivos).toBe(0);
  });
});

describe('mortalidad esperada a futuro', () => {
  const lote = {
    id: 'lote-3',
    cantidad: 100,
    fechaIngreso: '2026-01-01',
    costoLechon: 100,
    precioVentaLibra: 10
  };

  it('respeta el tope del 10% de los cerdos vivos', () => {
    const result = calculateLotStatistics({
      lot: lote,
      // 10 bajas muy temprano: extrapolar en linea recta daria un disparate.
      deaths: [{ loteId: lote.id, fecha: '2026-01-05', cantidad: 10 }],
      feedings: [{ loteId: lote.id, cantidadLb: 900, costo: 450 }],
      weights: [
        { loteId: lote.id, fecha: '2026-01-01', pesoPromedio: 40 },
        { loteId: lote.id, fecha: '2026-01-11', pesoPromedio: 60 }
      ],
      now: new Date('2026-01-11T12:00:00')
    });

    expect(result.cantidadActual).toBe(90);
    expect(result.mortalidadEsperadaProyectada).toBeCloseTo(9);
    expect(result.cantidadParaProyeccion).toBeCloseTo(81);
  });

  it('no proyecta bajas en un lote ya cerrado', () => {
    const result = calculateLotStatistics({
      lot: { ...lote, fechaSalida: '2026-01-11' },
      deaths: [{ loteId: lote.id, fecha: '2026-01-05', cantidad: 10 }],
      feedings: [{ loteId: lote.id, cantidadLb: 900, costo: 450 }],
      weights: [
        { loteId: lote.id, fecha: '2026-01-01', pesoPromedio: 40 },
        { loteId: lote.id, fecha: '2026-01-11', pesoPromedio: 60 }
      ]
    });

    expect(result.mortalidadEsperadaProyectada).toBe(0);
    expect(result.cantidadParaProyeccion).toBe(90);
  });

  it('no proyecta bajas si el lote nunca ha tenido muertes', () => {
    const result = calculateLotStatistics({
      lot: lote,
      feedings: [{ loteId: lote.id, cantidadLb: 900, costo: 450 }],
      weights: [
        { loteId: lote.id, fecha: '2026-01-01', pesoPromedio: 40 },
        { loteId: lote.id, fecha: '2026-01-11', pesoPromedio: 60 }
      ],
      now: new Date('2026-01-11T12:00:00')
    });

    expect(result.mortalidadEsperadaProyectada).toBe(0);
    expect(result.cantidadParaProyeccion).toBe(100);
  });
});

describe('pesaje vencido y consumo del ciclo', () => {
  // Reproduce el Corral 4 real: 170 dias, un solo pesaje del dia de ingreso,
  // casi 6000 lb de alimento y una venta de un cerdo a 187 lb.
  const corral4 = {
    id: 'c4',
    cantidad: 10,
    fechaIngreso: '2026-04-06',
    costoLechon: 550,
    precioVentaLibra: 11
  };
  const datosCorral4 = {
    lot: corral4,
    weights: [{ loteId: 'c4', fecha: '2026-04-06', pesoPromedio: 13.2 }],
    feedings: [{ loteId: 'c4', fecha: '2026-06-01', cantidadLb: 5982, costo: 16517 }],
    sales: [{ loteId: 'c4', fecha: '2026-08-31', cantidadCerdos: 1, totalLibras: 187, totalVenta: 2330 }],
    now: new Date('2026-09-22T12:00:00')
  };

  it('detecta el pesaje vencido y estima el peso por consumo', () => {
    const result = calculateLotStatistics(datosCorral4);

    expect(result.pesajeVencido).toBe(true);
    expect(result.diasSinPesaje).toBe(169);
    expect(result.pesoEsEstimado).toBe(true);
    expect(result.pesoActual).toBe(13.2);
    // El estimado debe quedar en rango de mercado, no en 13 lb.
    expect(result.pesoParaProyeccion).toBeGreaterThan(180);
    expect(result.pesoParaProyeccion).toBeLessThan(260);
  });

  it('marca que el lote ya paso un ciclo completo de alimento', () => {
    const result = calculateLotStatistics(datosCorral4);

    expect(result.excedeCicloCompleto).toBe(true);
    expect(result.consumoCicloPorcentaje).toBeGreaterThan(115);
  });

  it('acota la FCA disparada antes de proyectar el alimento futuro', () => {
    const result = calculateLotStatistics(datosCorral4);

    expect(result.fcaProyeccionAcotada).toBe(true);
    expect(result.fcaProyeccion).toBe(4.5);
    // Antes del arreglo esto daba 640 sacos. Ahora tiene que ser un numero operable.
    expect(result.proyeccionAlimentoFaltante / 100).toBeLessThan(20);
  });

  it('no estima nada cuando el pesaje esta fresco', () => {
    const result = calculateLotStatistics({
      ...datosCorral4,
      weights: [
        { loteId: 'c4', fecha: '2026-04-06', pesoPromedio: 13.2 },
        { loteId: 'c4', fecha: '2026-09-20', pesoPromedio: 214 }
      ]
    });

    expect(result.pesajeVencido).toBe(false);
    expect(result.pesoEsEstimado).toBe(false);
    expect(result.pesoParaProyeccion).toBe(214);
  });
});

describe('parametros de negocio incompletos', () => {
  it('avisa cuando falta el precio por libra o el costo del lechon', () => {
    const result = calculateLotStatistics({
      lot: { id: 'c1', cantidad: 10, fechaIngreso: '2026-08-08', costoLechon: 0, precioVentaLibra: 0 },
      weights: [{ loteId: 'c1', fecha: '2026-08-08', pesoPromedio: 13.7 }],
      now: new Date('2026-09-22T12:00:00')
    });

    expect(result.faltaPrecioVenta).toBe(true);
    expect(result.faltaCostoLechon).toBe(true);
    expect(result.parametrosIncompletos).toBe(true);
  });

  it('no avisa cuando los parametros estan configurados', () => {
    const result = calculateLotStatistics({
      lot: { id: 'c1', cantidad: 10, fechaIngreso: '2026-08-08', costoLechon: 550, precioVentaLibra: 11 },
      weights: [{ loteId: 'c1', fecha: '2026-08-08', pesoPromedio: 13.7 }],
      now: new Date('2026-09-22T12:00:00')
    });

    expect(result.parametrosIncompletos).toBe(false);
  });
});

describe('FCA marginal de finalizacion', () => {
  const base = {
    lot: { id: 'lm', cantidad: 10, fechaIngreso: '2026-01-01', costoLechon: 500, precioVentaLibra: 10 },
    feedings: [{ loteId: 'lm', fecha: '2026-03-01', cantidadLb: 1500, costo: 4000 }],
    weights: [
      { loteId: 'lm', fecha: '2026-04-20', pesoPromedio: 40 },
      { loteId: 'lm', fecha: '2026-04-25', pesoPromedio: 90 }
    ],
    now: new Date('2026-04-30T12:00:00')
  };

  it('proyecta con una conversion 20% peor que la acumulada', () => {
    const result = calculateLotStatistics(base);

    expect(result.fca).toBeCloseTo(1500 / 500);
    // 3.0 acumulada -> 3.6 marginal, dentro del rango permitido.
    expect(result.fcaProyeccion).toBeCloseTo(result.fca * 1.2);
    expect(result.fcaProyeccionAcotada).toBe(false);
  });

  it('nunca proyecta por debajo del piso de finalizacion', () => {
    const result = calculateLotStatistics({
      ...base,
      // Conversion irrealmente buena: 1.0 acumulada.
      feedings: [{ loteId: 'lm', fecha: '2026-03-01', cantidadLb: 500, costo: 1300 }]
    });

    expect(result.fca).toBeCloseTo(1);
    expect(result.fcaProyeccion).toBe(2.5);
    expect(result.fcaProyeccionAcotada).toBe(true);
  });
});
