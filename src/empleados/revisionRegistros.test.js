import { describe, expect, it, vi } from 'vitest';
import { aprobarRegistros, rechazarRegistro } from './revisionRegistros.js';
import { resolverRol } from './accesos.js';

vi.mock('firebase/firestore', () => ({
  doc: (...ruta) => ruta.at(-1),
  collection: (...ruta) => ruta.at(-1),
  runTransaction: async (db, ejecutar) => {
    const cambios = new Map();
    const resultado = await ejecutar({
      get: async (ref) => ({ exists: () => db.has(ref), data: () => db.get(ref) }),
      set: (ref, datos) => cambios.set(ref, datos),
      update: (ref, campos) => cambios.set(ref, { ...db.get(ref), ...campos })
    });
    for (const [ref, datos] of cambios) db.set(ref, datos);
    return resultado;
  }
}));

const admin = { uid: 'admin1', email: 'admin@example.org' };
const solicitud = { estado: 'pendiente', fecha: '2026-11-24', loteId: 'l1', corralId: 'c1', empleado: 'operario', cantidad: 1 };
const revisar = (db, ...ids) => aprobarRegistros(db, 'granja', admin, ids.map((id) => ({ id })));

function granja(datos) {
  return new Map(Object.entries({
    agro_lotes: { data: [{ id: 'l1', corralId: 'c1', estado: 'Activo', cantidad: 8 }] },
    ...datos
  }));
}

describe('permisos de la sesión', () => {
  it('separa empleados, administradores anteriores a los roles y cuentas sin acceso', () => {
    expect(resolverRol({ active: true, role: 'empleado' })).toBe('empleado');
    expect(resolverRol({ active: true })).toBe('admin');
    for (const miembro of [null, { active: false, role: 'admin' }, { active: true, role: null }]) {
      expect(resolverRol(miembro)).toBe('pendiente');
    }
  });
});

describe('revisión de solicitudes', () => {
  it('valida el stock vigente y evita descontar dos veces', async () => {
    const captura = { ...solicitud, tipo: 'concentrado', alimento: 'Etapa 1', unidad: 'sacos' };
    const db = granja({
      a: captura, b: captura, agro_catalogo: { data: [{ id: 'p1', nombre: 'Etapa 1', librasPorSaco: 50 }] },
      agro_bodega: { data: [{ tipo: 'Etapa 1', sacos: 1 }] }
    });
    const resultados = await revisar(db, 'a', 'a', 'b');
    expect(resultados.map((r) => r.ok)).toEqual([true, false, false]);
    expect(db.get('agro_alimentos').data).toHaveLength(1);
    expect(db.get('catalogo').concentrados[0].stockLbs).toBe(0);
    expect(db.get('a')).toMatchObject({ estado: 'aplicada', revisadaPorUid: admin.uid });
    expect(db.get('b').estado).toBe('pendiente');
  });

  it.each([
    ['medicamento', 'agro_catalogo_medico', 'agro_compras_medicas', 'agro_usos_medicos', 'agro_vacunas'],
    ['insumo', 'agro_catalogo_insumos', 'agro_compras_insumos', 'agro_usos_insumos', 'agro_gastosextra']
  ])('guarda uso y costo al autorizar %s', async (tipo, catalogo, compras, usos, registro) => {
    const db = granja({
      a: { ...solicitud, tipo, productoId: 'p1', cantidad: 2 },
      [catalogo]: { data: [{ id: 'p1', nombre: 'Producto', unidad: 'u', categoria: 'Granja' }] },
      [compras]: { data: [{ productoId: 'p1', cantidad: 4, costoTotal: 20 }] }
    });
    expect((await revisar(db, 'a'))[0].ok).toBe(true);
    expect(db.get(usos).data[0]).toMatchObject({ cantidad: 2, costo: 10 });
    expect(db.get(registro).data).toHaveLength(1);
    await expect(rechazarRegistro(db, 'granja', admin, 'a', '')).rejects.toThrow();
  });

  it('cuenta las bajas autorizadas y excluye las rechazadas y retiradas', async () => {
    const baja = { ...solicitud, tipo: 'baja', cantidad: 5 };
    const db = granja({ a: baja, b: baja, c: baja });
    await rechazarRegistro(db, 'granja', admin, 'a', 'Duplicado');
    expect(db.get('a')).toMatchObject({ estado: 'rechazada', motivoRechazo: 'Duplicado' });
    const resultados = await revisar(db, 'a', 'retirada', 'b', 'c');
    expect(resultados.map((r) => r.ok)).toEqual([false, false, true, false]);
    expect(db.get('agro_bajas').data).toHaveLength(1);
    expect(db.get('c').estado).toBe('pendiente');
  });
});
