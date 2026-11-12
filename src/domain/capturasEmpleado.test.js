import { describe, expect, it } from 'vitest';
import {
  aplicarCapturas,
  construirCaptura,
  construirCatalogoEmpleados,
  describirCaptura,
  firmaCatalogo,
  hayCambios,
  idRegistroDeCaptura,
  ordenarCorralesPorNumero
} from './capturasEmpleado.js';

const lotes = [
  { id: 'l1', corralId: 'c1', nombre: 'Lote 01', estado: 'Activo', faseActual: 5, precioCompra: 9999 },
  { id: 'l0', corralId: 'c1', nombre: 'Viejo', estado: 'Vendido' }
];
const catalogoAlimento = [{ id: 'vc1', nombre: 'VITACERDO 1', precioSaco: 300, librasPorSaco: 100 }];
const corralEmp = { id: 'c1', nombre: 'Corral 1', loteId: 'l1', loteNombre: 'Lote 01', cerdos: 10, fase: 5 };

const ctxBase = {
  lotes,
  catalogoAlimento,
  inventarioCentral: [{ nombre: 'VITACERDO 1', stockLbs: 250 }],
  inventarioMedico: [{ id: 'med1', nombre: 'Ivermectina', categoria: 'Antiparasitario', unidad: 'ml', stock: 10, costoPromedio: 2 }],
  inventarioInsumos: [{ id: 'ins1', nombre: 'Cal', unidad: 'saco', stock: 3, costoPromedio: 40 }],
  vivosPorLote: () => 10
};

const captura = (id, tipo, extra) => ({
  id, tipo, estado: 'pendiente', corralId: 'c1', corralNombre: 'Corral 1', loteId: 'l1',
  fecha: '2026-11-12', empleado: 'Juan', nota: '', ...extra
});

describe('ordenarCorralesPorNumero', () => {
  it('ordena por número y no alfabéticamente', () => {
    const orden = ordenarCorralesPorNumero([{ nombre: 'Corral 10' }, { nombre: 'Corral 2' }, { nombre: 'Corral 1' }]);
    expect(orden.map((c) => c.nombre)).toEqual(['Corral 1', 'Corral 2', 'Corral 10']);
  });
});

describe('construirCatalogoEmpleados', () => {
  const catalogo = construirCatalogoEmpleados({
    corrales: [{ id: 'c2', nombre: 'Corral 2', capacidad: 15 }, { id: 'c1', nombre: 'Corral 1', capacidad: 15 }],
    lotes,
    infoPorLote: { l1: { cerdos: 10, fase: 5, alimentoSugerido: 'VITACERDO 1' } },
    catalogoAlimento,
    catalogoMedico: [{ id: 'med1', nombre: 'Ivermectina', unidad: 'ml', categoria: 'Antiparasitario', stockMinimo: 1 }],
    catalogoInsumos: [{ id: 'ins1', nombre: 'Cal', unidad: 'saco', categoria: 'Bioseguridad' }]
  });

  it('publica corrales en orden con su lote activo', () => {
    expect(catalogo.corrales).toEqual([
      { id: 'c1', nombre: 'Corral 1', loteId: 'l1', loteNombre: 'Lote 01', cerdos: 10, fase: 5, alimentoSugerido: 'VITACERDO 1' },
      { id: 'c2', nombre: 'Corral 2', loteId: '', loteNombre: '', cerdos: 0, fase: 0, alimentoSugerido: '' }
    ]);
  });

  it('no filtra precios ni costos', () => {
    const plano = JSON.stringify(catalogo);
    expect(plano).not.toMatch(/precio|costo|9999|300/i);
  });
});

describe('firmaCatalogo', () => {
  it('no depende del orden de las claves', () => {
    expect(firmaCatalogo({ a: 1, b: [{ x: 1, y: 2 }] })).toBe(firmaCatalogo({ b: [{ y: 2, x: 1 }], a: 1 }));
    expect(firmaCatalogo({ a: 1 })).not.toBe(firmaCatalogo({ a: 2 }));
  });
});

describe('construirCaptura', () => {
  const base = { corral: corralEmp, empleado: 'Juan', fecha: '2026-11-12', hoy: '2026-11-12', ahora: 1 };

  it('arma una captura de concentrado pendiente', () => {
    const r = construirCaptura({ ...base, tipo: 'concentrado', datos: { alimento: 'VITACERDO 1', cantidad: '2', unidad: 'sacos' } });
    expect(r.ok).toBe(true);
    expect(r.captura).toMatchObject({ tipo: 'concentrado', estado: 'pendiente', loteId: 'l1', cantidad: 2, unidad: 'sacos', fase: 5, empleado: 'Juan' });
  });

  it('acepta coma decimal y promedia pesos', () => {
    const r = construirCaptura({ ...base, tipo: 'peso', datos: { pesos: ['100,5', '120', ''] } });
    expect(r.captura.pesos).toEqual([100.5, 120]);
    expect(r.captura.pesoPromedio).toBe(110.25);
  });

  it('rechaza corral vacío, fecha futura y bajas mayores a los cerdos', () => {
    expect(construirCaptura({ ...base, tipo: 'baja', corral: { id: 'c2', nombre: 'Corral 2', loteId: '' }, datos: { cantidad: 1, causa: 'x' } }).ok).toBe(false);
    expect(construirCaptura({ ...base, tipo: 'baja', fecha: '2026-11-13', datos: { cantidad: 1, causa: 'x' } }).ok).toBe(false);
    expect(construirCaptura({ ...base, tipo: 'baja', datos: { cantidad: 11, causa: 'x' } }).ok).toBe(false);
    expect(construirCaptura({ ...base, tipo: 'baja', datos: { cantidad: 1, causa: 'Neumonía' } }).ok).toBe(true);
  });

  it('exige elegir el insumo de la lista pero permite medicamento escrito a mano', () => {
    expect(construirCaptura({ ...base, tipo: 'insumo', datos: { nombre: 'Algo', cantidad: 1 } }).ok).toBe(false);
    expect(construirCaptura({ ...base, tipo: 'medicamento', datos: { nombre: 'Penicilina', cantidad: 5, unidad: 'ml' } }).ok).toBe(true);
  });
});

describe('describirCaptura', () => {
  it('resume cada tipo', () => {
    expect(describirCaptura({ tipo: 'concentrado', cantidad: 1, unidad: 'sacos', alimento: 'VITACERDO 1' })).toBe('1 saco de VITACERDO 1');
    expect(describirCaptura({ tipo: 'peso', pesos: [1, 2], pesoPromedio: 110.25 })).toBe('110.25 lb promedio (2 cerdos)');
    expect(describirCaptura({ tipo: 'baja', cantidad: 2, causa: 'Neumonía' })).toBe('2 cerdos · Neumonía');
  });
});

describe('aplicarCapturas', () => {
  it('convierte concentrado en un registro de alimento con costo', () => {
    const { cambios, resultados } = aplicarCapturas(
      [captura('a', 'concentrado', { alimento: 'VITACERDO 1', cantidad: 2, unidad: 'sacos', fase: 5 })],
      ctxBase
    );
    expect(resultados[0]).toMatchObject({ ok: true, costo: 600 });
    expect(cambios.alimentos[0]).toMatchObject({
      id: 'emp_a', loteId: 'l1', tipo: 'VITACERDO 1', cantidadLb: 200, costo: 600,
      faseRegistro: 5, origenRegistro: 'empleado', registradoPor: 'Juan', capturaId: 'a'
    });
  });

  it('descuenta stock entre capturas del mismo lote de aprobación', () => {
    const { cambios, resultados } = aplicarCapturas([
      captura('a', 'concentrado', { alimento: 'VITACERDO 1', cantidad: 2, unidad: 'sacos' }),
      captura('b', 'concentrado', { alimento: 'VITACERDO 1', cantidad: 1, unidad: 'sacos' }),
      captura('c', 'concentrado', { alimento: 'VITACERDO 1', cantidad: 50, unidad: 'lb' })
    ], ctxBase);
    expect(resultados.map((r) => r.ok)).toEqual([true, false, true]);
    expect(resultados[1].error).toMatch(/suficiente/i);
    expect(cambios.alimentos.map((a) => a.id)).toEqual(['emp_a', 'emp_c']);
  });

  it('medicamento de farmacia descuenta stock y crea tratamiento con costo', () => {
    const { cambios, resultados } = aplicarCapturas([
      captura('m1', 'medicamento', { productoId: 'med1', nombre: 'Ivermectina', unidad: 'ml', cantidad: 6 }),
      captura('m2', 'medicamento', { productoId: 'med1', nombre: 'Ivermectina', unidad: 'ml', cantidad: 6 })
    ], ctxBase);
    expect(resultados.map((r) => r.ok)).toEqual([true, false]);
    expect(cambios.usosMedicos).toHaveLength(1);
    expect(cambios.usosMedicos[0]).toMatchObject({ id: 'emp_m1_uso', productoId: 'med1', cantidad: 6, costo: 12, loteId: 'l1' });
    expect(cambios.vacunas[0]).toMatchObject({ id: 'emp_m1', nombre: 'Ivermectina (6 ml)', costo: 12, usoMedicoId: 'emp_m1_uso' });
  });

  it('medicamento fuera de farmacia queda sin costo y sin uso de bodega', () => {
    const { cambios, resultados } = aplicarCapturas(
      [captura('m3', 'medicamento', { productoId: '', nombre: 'Penicilina', unidad: 'ml', cantidad: 5 })],
      ctxBase
    );
    expect(resultados[0]).toMatchObject({ ok: true, sinCosto: true });
    expect(cambios.usosMedicos).toHaveLength(0);
    expect(cambios.vacunas[0]).toMatchObject({ nombre: 'Penicilina (5 ml)', costo: 0, usoMedicoId: null });
  });

  it('insumo crea el uso y su gasto operativo', () => {
    const { cambios } = aplicarCapturas(
      [captura('i1', 'insumo', { productoId: 'ins1', nombre: 'Cal', unidad: 'saco', cantidad: 2 })],
      ctxBase
    );
    expect(cambios.usosInsumos[0]).toMatchObject({ id: 'emp_i1', cantidad: 2, costo: 80, loteId: 'l1' });
    expect(cambios.gastosExtra[0]).toMatchObject({ id: 'emp_i1_gasto', monto: 80, usoInsumoId: 'emp_i1', loteId: 'l1' });
  });

  it('pesaje con muestra y bajas limitadas a los cerdos vivos', () => {
    const { cambios, resultados } = aplicarCapturas([
      captura('p1', 'peso', { pesos: [100, 120], pesoPromedio: 110 }),
      captura('b1', 'baja', { cantidad: 6, causa: 'Neumonía' }),
      captura('b2', 'baja', { cantidad: 6, causa: 'Neumonía' })
    ], ctxBase);
    expect(cambios.pesos[0]).toMatchObject({ id: 'emp_p1', pesoPromedio: 110, metodo: 'directo', cantidadMuestra: 2 });
    expect(cambios.pesos[0].muestraPesos).toHaveLength(2);
    expect(resultados.map((r) => r.ok)).toEqual([true, true, false]);
    expect(cambios.bajas).toHaveLength(1);
  });

  it('no duplica una captura ya aplicada y rechaza lotes cerrados', () => {
    const { cambios, resultados } = aplicarCapturas([
      captura('a', 'concentrado', { alimento: 'VITACERDO 1', cantidad: 1, unidad: 'sacos' }),
      captura('z', 'peso', { loteId: 'l0', pesos: [100] })
    ], { ...ctxBase, existentes: { alimentos: [{ id: idRegistroDeCaptura('a') }] } });
    expect(resultados[0]).toMatchObject({ ok: true, yaAplicada: true });
    expect(resultados[1].ok).toBe(false);
    expect(hayCambios(cambios)).toBe(false);
  });
});
