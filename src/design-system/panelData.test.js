import { describe, expect, it } from 'vitest';
import { calculateLotStatistics } from '../domain/lotStatistics.js';
import {
  construirBodega,
  construirPanelPrincipal,
  diasParaVenta,
  estadoDeLote,
  ordenarAlertas,
} from './panelData.js';

const CRONOGRAMA = [
  { fase: 1, alimento: 'VITALECHON 1', diaInicio: 1, diaFin: 28, consumoTotalLb: 30 },
  { fase: 2, alimento: 'VITACERDO 1', diaInicio: 29, diaFin: 133, consumoTotalLb: 400 },
];

const baseStats = {
  pesoParaProyeccion: 100,
  pesoObjetivoLb: 220,
  excedeCicloCompleto: false,
  mortalidadPorcentaje: 0,
  pesajeVencido: false,
  adg: 1.5,
};

describe('estadoDeLote', () => {
  const puede = { puedeVender: true };
  const noPuede = { puedeVender: false };

  it('un lote sin novedades está al día aunque aún no pueda venderse', () => {
    expect(estadoDeLote(baseStats, noPuede)).toBe('meta');
  });

  it('solo marca venta bloqueada cuando el lote ya está en peso', () => {
    expect(estadoDeLote({ ...baseStats, pesoParaProyeccion: 225 }, noPuede)).toBe('bloqueada');
    expect(estadoDeLote({ ...baseStats, pesoParaProyeccion: 225 }, puede)).toBe('listo');
  });

  it('usa el máximo de mortalidad de la app: 5 % no alerta, más de 5 % sí', () => {
    expect(estadoDeLote({ ...baseStats, mortalidadPorcentaje: 5 }, puede)).toBe('meta');
    expect(estadoDeLote({ ...baseStats, mortalidadPorcentaje: 5.1 }, puede)).toBe('mortalidad');
  });

  it('el sobre-engorde con venta bloqueada gana a cualquier otro estado', () => {
    expect(estadoDeLote({ ...baseStats, excedeCicloCompleto: true, mortalidadPorcentaje: 9 }, noPuede)).toBe('sobreEngorde');
  });

  it('marca el pesaje vencido', () => {
    expect(estadoDeLote({ ...baseStats, pesajeVencido: true }, puede)).toBe('sinPesar');
  });
});

describe('diasParaVenta', () => {
  it('calcula con la ganancia diaria, igual que el calendario', () => {
    expect(diasParaVenta(baseStats)).toBe(80);
  });
  it('devuelve 0 en peso y null sin ganancia', () => {
    expect(diasParaVenta({ ...baseStats, pesoParaProyeccion: 220 })).toBe(0);
    expect(diasParaVenta({ ...baseStats, adg: 0 })).toBeNull();
  });
});

describe('construirBodega', () => {
  const inventario = [
    { nombre: 'A', isConcentrado: true, librasPorSaco: 100, stockSacos: 4 },
    { nombre: 'B', isConcentrado: true, librasPorSaco: 50, stockSacos: 10 },
    { nombre: 'C', isConcentrado: true, librasPorSaco: 100, stockSacos: 0 },
    { nombre: 'MAIZ', isConcentrado: false, librasPorSaco: 100, stockSacos: 50 },
  ];
  const alimentos = [
    { tipo: 'A', cantidadLb: 1400, fecha: '2026-11-03' },
    { tipo: 'B', cantidadLb: 350, fecha: '2026-11-01' },
    { tipo: 'B', cantidadLb: 9999, fecha: '2026-10-01' },
    { tipo: 'B', cantidadLb: 9999, fecha: '2026-11-03', esSuplemento: true },
  ];
  const bodega = construirBodega({ inventario, alimentos, hoyIso: '2026-11-04' });

  it('solo muestra concentrados con stock o consumo', () => {
    expect(bodega.map((b) => b.alimento)).toEqual(['A', 'B']);
  });
  it('calcula cobertura con el consumo real de 14 días y el saco de cada producto', () => {
    expect(bodega[0].dias).toBeCloseTo(4);
    expect(bodega[0].estado).toBe('bajo');
    expect(bodega[1].sacosDia).toBeCloseTo(0.5);
    expect(bodega[1].dias).toBeCloseTo(20);
    expect(bodega[1].estado).toBe('ok');
  });
  it('un producto sin consumo no genera alerta', () => {
    const [item] = construirBodega({ inventario: [inventario[0]], alimentos: [], hoyIso: '2026-11-04' });
    expect(item.estado).toBe('sinUso');
    expect(item.dias).toBeNull();
  });
});

describe('ordenarAlertas', () => {
  it('pone primero lo atrasado y, dentro del grupo, lo más grave', () => {
    const r = ordenarAlertas([
      { id: 'c', grupo: 'hoy', severidad: 'danger' },
      { id: 'b', grupo: 'atrasado', severidad: 'warning' },
      { id: 'a', grupo: 'atrasado', severidad: 'danger' },
    ]);
    expect(r.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('construirPanelPrincipal con estadísticas reales', () => {
  const corrales = [{ id: 'c1', nombre: 'Corral 1' }, { id: 'c2', nombre: 'Corral 2' }, { id: 'c3', nombre: 'Corral 3' }];
  const lotes = [
    { id: 'l1', corralId: 'c1', nombre: 'Lote A', estado: 'Activo', cantidad: 20, cantidadInicial: 20, pesoInicial: 20, fechaIngreso: '2026-08-01', fechaInicio: '2026-08-01', faseActual: 2 },
    { id: 'l2', corralId: 'c2', nombre: 'Lote B', estado: 'Activo', cantidad: 10, cantidadInicial: 10, pesoInicial: 20, fechaIngreso: '2026-10-20', fechaInicio: '2026-10-20' },
    { id: 'l3', corralId: 'c3', nombre: 'Lote cerrado', estado: 'Cerrado', cantidad: 10, cantidadInicial: 10, pesoInicial: 20, fechaIngreso: '2026-01-01', fechaInicio: '2026-01-01' },
  ];
  const pesos = [
    { loteId: 'l1', fecha: '2026-09-01', pesoPromedio: 60 },
    { loteId: 'l1', fecha: '2026-10-28', pesoPromedio: 140 },
  ];
  const bajas = [{ loteId: 'l2', cantidad: 1, fecha: '2026-10-25' }, { loteId: 'l3', cantidad: 5, fecha: '2026-02-01' }];
  const alimentos = [{ loteId: 'l1', tipo: 'VITACERDO 1', cantidadLb: 1400, costo: 100, fecha: '2026-11-01' }];
  const inventario = [{ nombre: 'VITACERDO 1', isConcentrado: true, librasPorSaco: 100, stockSacos: 3 }];
  const irA = () => {};
  const acciones = [
    { id: 'pesar_l2', grupo: 'atrasado', prioridad: 3, corral: 'Corral 2', titulo: 'Pesar el lote', detalle: 'Nunca se ha pesado', etiqueta: 'Registrar peso', accion: irA },
    { id: 'dosis_l1_1', grupo: 'semana', prioridad: 2, corral: 'Corral 1', titulo: '1ª dosis de Innosure', detalle: 'En 3 días', etiqueta: 'Registrar', accion: irA },
  ];

  const datos = construirPanelPrincipal({
    lotes, corrales, pesos, bajas, alimentos, inventario, acciones, cronograma: CRONOGRAMA,
    avisos: [{ id: 'cambio', grupo: 'hoy', severidad: 'info', corral: 'Corral 1', titulo: 'Cambio de alimento', detalle: '', accion: 'Abrir' }],
    estadisticasDe: (lot) => calculateLotStatistics({ lot, deaths: bajas, feedings: alimentos, sales: [], weights: pesos, vaccines: [], extraExpenses: [], catalog: [], now: new Date(2026, 10, 4) }),
    planDe: () => ({ puedeVender: false, motivoBloqueo: 'Falta dosis' }),
    hoyIso: '2026-11-04',
  });

  it('solo cuenta lotes activos y deja libre el corral del lote cerrado', () => {
    expect(datos.lotes).toHaveLength(2);
    expect(datos.libres).toEqual([{ id: 'c3', corral: 'Corral 3', orden: 2 }]);
    expect(datos.resumen.corralesActivos).toBe(2);
    expect(datos.resumen.corralesTotales).toBe(3);
  });

  it('la mortalidad global excluye bajas de lotes cerrados', () => {
    expect(datos.resumen.bajasTotales).toBe(1);
    expect(datos.resumen.mortalidad).toBeCloseTo((1 / 30) * 100);
  });

  it('el total de cerdos descuenta bajas', () => {
    expect(datos.resumen.totalCerdos).toBe(29);
  });

  it('arma la curva solo con pesajes reales y en orden', () => {
    const fila = datos.lotes.find((l) => l.id === 'l1');
    expect(fila.pesajes.map((p) => p.peso)).toEqual([60, 140]);
    expect(fila.pesajes[0].dia).toBe(31);
  });

  it('no expone las estadísticas internas a la vista', () => {
    expect(datos.lotes[0]._stats).toBeUndefined();
  });

  it('manda lo de esta semana a próximos y lo demás a alertas', () => {
    expect(datos.alertas[0].id).toBe('pesar_l2');
    expect(datos.alertas.map((a) => a.id)).toContain('cambio');
    expect(datos.alertas.map((a) => a.id)).toContain('stock_VITACERDO 1');
    expect(datos.eventos.map((e) => e.id)).toEqual(['dosis_l1_1']);
    expect(datos.eventos[0].tipo).toBe('dosis');
  });

  it('avisa la mortalidad alta y la venta bloqueada de un lote en peso', () => {
    const abiertos = [];
    const r = construirPanelPrincipal({
      lotes: lotes.slice(0, 1), corrales, cronograma: CRONOGRAMA,
      estadisticasDe: () => ({ ...baseStats, cantidadActual: 10, diasLote: 100, pesoParaProyeccion: 225, mortalidadPorcentaje: 8 }),
      planDe: () => ({ puedeVender: false, motivoBloqueo: 'Falta la 2ª dosis' }),
      hoyIso: '2026-11-04',
      onAbrirCorral: (id) => abiertos.push(id),
    });
    expect(r.alertas.map((a) => a.id)).toEqual(['mortalidad_l1']);
    r.alertas[0].onAccion();
    expect(abiertos).toEqual(['c1']);

    const bloqueado = construirPanelPrincipal({
      lotes: lotes.slice(0, 1), corrales, cronograma: CRONOGRAMA,
      estadisticasDe: () => ({ ...baseStats, cantidadActual: 10, diasLote: 100, pesoParaProyeccion: 225 }),
      planDe: () => ({ puedeVender: false, motivoBloqueo: 'Falta la 2ª dosis' }),
      hoyIso: '2026-11-04',
    });
    expect(bloqueado.alertas[0].id).toBe('bloqueada_l1');
    expect(bloqueado.alertas[0].detalle).toBe('Falta la 2ª dosis');
  });

  it('funciona sin lotes ni inventario', () => {
    const vacio = construirPanelPrincipal({ estadisticasDe: () => null, planDe: () => null, hoyIso: '2026-11-04' });
    expect(vacio.lotes).toEqual([]);
    expect(vacio.resumen.totalCerdos).toBe(0);
    expect(vacio.resumen.pesoPromedio).toBe(0);
    expect(vacio.resumen.menorCobertura).toBeNull();
  });
});

describe('orden y nombre de los corrales', () => {
  const stats = () => ({ cantidadActual: 10, diasLote: 30, pesoParaProyeccion: 80, mortalidadPorcentaje: 0 });
  const base = { estadisticasDe: stats, planDe: () => ({ puedeVender: true }), hoyIso: '2026-11-04' };

  it('ordena Corral 1…10 por número, mezclando ocupados y libres, sin importar urgencia', () => {
    const corrales = [
      { id: 'c10', nombre: 'Corral 10' }, { id: 'c2', nombre: 'Corral 2' },
      { id: 'c1', nombre: 'Corral 1' }, { id: 'c3', nombre: 'Corral 3' },
    ];
    const lotes = [
      { id: 'l10', corralId: 'c10', estado: 'Activo' },
      { id: 'l2', corralId: 'c2', estado: 'Activo' },
    ];
    const datos = construirPanelPrincipal({ ...base, corrales, lotes });
    const todos = [...datos.lotes, ...datos.libres].sort((a, b) => a.orden - b.orden).map((f) => f.corral);
    expect(todos).toEqual(['Corral 1', 'Corral 2', 'Corral 3', 'Corral 10']);
    expect(datos.lotes.map((l) => l.corral)).toEqual(['Corral 2', 'Corral 10']);
  });

  it('encuentra el corral aunque el id venga como número en un lado y texto en el otro', () => {
    const datos = construirPanelPrincipal({
      ...base,
      corrales: [{ id: 1, nombre: 'Corral 1' }, { id: 2, nombre: 'Corral 2' }],
      lotes: [{ id: 'l1', corralId: '2', estado: 'Activo' }],
    });
    expect(datos.lotes[0].corral).toBe('Corral 2');
    expect(datos.libres.map((c) => c.corral)).toEqual(['Corral 1']);
  });

  it('un corral sin nombre se identifica por su número en vez de "Corral"', () => {
    const datos = construirPanelPrincipal({
      ...base,
      corrales: [{ id: 'a', nombre: 'Corral 1' }, { id: 'b', nombre: '' }],
      lotes: [{ id: 'l1', corralId: 'b', estado: 'Activo' }],
    });
    expect(datos.lotes[0].corral).toBe('Corral 2');
  });
});
