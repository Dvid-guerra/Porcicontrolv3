import { describe, expect, it } from 'vitest';
import {
  acumularCambioPendiente,
  esErrorDeRedFirestore,
  guardarCacheLocal,
  guardarColaPendiente,
  leerCacheLocal,
  leerColaPendiente,
  reconciliarCambioOffline
} from './offlineQueue.js';

function crearStorageMemoria() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
}

describe('offlineQueue — reconciliación de 3 vías para trabajo sin señal en galpones', () => {
  it('combina registros nuevos offline con registros creados por otro usuario en la nube', () => {
    const base = [{ id: 'a1', libras: 50 }];
    const local = [{ id: 'a1', libras: 50 }, { id: 'a2_galpon', libras: 100 }];
    const remoto = [{ id: 'a1', libras: 50 }, { id: 'a3_oficina', libras: 75 }];

    const resultado = reconciliarCambioOffline({ base, local, remoto });
    expect(resultado).toEqual([
      { id: 'a1', libras: 50 },
      { id: 'a3_oficina', libras: 75 },
      { id: 'a2_galpon', libras: 100 }
    ]);
  });

  it('respeta eliminaciones y ediciones locales sin borrar altas remotas', () => {
    const base = [
      { id: 'p1', pesoPromedio: 80 },
      { id: 'p2', pesoPromedio: 95 }
    ];
    const local = [
      { id: 'p2', pesoPromedio: 98 }, // editado offline
      { id: 'p3', pesoPromedio: 110 } // agregado offline
      // p1 fue eliminado offline
    ];
    const remoto = [
      { id: 'p1', pesoPromedio: 80 },
      { id: 'p2', pesoPromedio: 95 },
      { id: 'p4', pesoPromedio: 105 } // agregado en otro teléfono
    ];

    const resultado = reconciliarCambioOffline({ base, local, remoto });
    expect(resultado).toEqual([
      { id: 'p2', pesoPromedio: 98 },
      { id: 'p4', pesoPromedio: 105 },
      { id: 'p3', pesoPromedio: 110 }
    ]);
  });

  it('mantiene la base original cuando se acumulan varios cambios offline seguidos', () => {
    const primero = acumularCambioPendiente(null, {
      key: 'agro_pesos',
      baseActual: [{ id: 'p1', peso: 40 }],
      nuevoValor: [{ id: 'p1', peso: 40 }, { id: 'p2', peso: 55 }],
      updatedAt: 1000,
      updatedBy: 'u1'
    });
    const segundo = acumularCambioPendiente(primero, {
      key: 'agro_pesos',
      baseActual: primero.targetValue,
      nuevoValor: [{ id: 'p1', peso: 40 }, { id: 'p2', peso: 55 }, { id: 'p3', peso: 70 }],
      updatedAt: 2000,
      updatedBy: 'u1'
    });

    expect(segundo.baseValue).toEqual([{ id: 'p1', peso: 40 }]);
    expect(segundo.targetValue).toHaveLength(3);
  });

  it('identifica errores de red/indisponibilidad de Firestore', () => {
    expect(esErrorDeRedFirestore({ code: 'unavailable' })).toBe(true);
    expect(esErrorDeRedFirestore(new Error('Failed to get document because the client is offline.'))).toBe(true);
    expect(esErrorDeRedFirestore({ code: 'permission-denied', message: 'No autorizado' })).toBe(false);
  });

  it('persiste y limpia caché y cola pendiente en almacenamiento local', () => {
    const mem = crearStorageMemoria();
    guardarCacheLocal(mem, 'app1', 'agro_lotes', [{ id: 'l1' }]);
    expect(leerCacheLocal(mem, 'app1', 'agro_lotes', [])).toEqual({
      hit: true,
      data: [{ id: 'l1' }]
    });

    guardarColaPendiente(mem, 'app1', { agro_lotes: { key: 'agro_lotes', baseValue: [], targetValue: [{ id: 'l1' }] } });
    expect(Object.keys(leerColaPendiente(mem, 'app1'))).toEqual(['agro_lotes']);

    guardarColaPendiente(mem, 'app1', {});
    expect(leerColaPendiente(mem, 'app1')).toEqual({});
  });
});
