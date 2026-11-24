import { beforeEach, expect, it, vi } from 'vitest';
import { onSnapshot } from 'firebase/firestore';
import { escucharHistorialEmpleado } from './historialEmpleado.js';

vi.mock('firebase/firestore', () => ({
  collection: (...args) => args.slice(1),
  query: (...args) => args.flat(),
  where: (campo, op, valor) => ({ campo, op, valor }),
  orderBy: campo => ({ orden: campo }),
  limit: max => ({ max }),
  onSnapshot: vi.fn()
}));

beforeEach(() => onSnapshot.mockReset());

it('mantiene el filtro de cuenta y los 50 más recientes cuando falta el índice', () => {
  const cancelarPrincipal = vi.fn();
  const cancelarSimple = vi.fn();
  onSnapshot.mockReturnValueOnce(cancelarPrincipal).mockReturnValueOnce(cancelarSimple);
  const recibir = vi.fn();
  const fallar = vi.fn();
  const cerrar = escucharHistorialEmpleado({}, 'granja', 'mi-uid', recibir, fallar);
  onSnapshot.mock.calls[0][3]({ code: 'failed-precondition' });
  const [consulta, , notificar] = onSnapshot.mock.calls[1];
  expect(consulta).toEqual(['artifacts', 'granja', 'public', 'data', 'granja_capturas', { campo: 'creadaPorUid', op: '==', valor: 'mi-uid' }]);
  notificar({
    metadata: { fromCache: false },
    docs: Array.from({ length: 55 }, (_, i) => ({
      id: String(i), data: () => ({ creadaEn: i }), metadata: { hasPendingWrites: i === 54 }
    }))
  });
  const [lista] = recibir.mock.calls[0];
  expect(lista).toHaveLength(50);
  expect(lista[0]).toMatchObject({ id: '54', sinEnviar: true });
  expect(lista.at(-1).id).toBe('5');
  expect(fallar).not.toHaveBeenCalled();
  cerrar();
  expect(cancelarSimple).toHaveBeenCalledOnce();
  expect(cancelarPrincipal).toHaveBeenCalledOnce();
});

it('informa permisos denegados sin intentar otra consulta', () => {
  const error = { code: 'permission-denied' };
  const fallar = vi.fn();
  escucharHistorialEmpleado({}, 'granja', 'mi-uid', vi.fn(), fallar);
  onSnapshot.mock.calls[0][3](error);
  expect(onSnapshot).toHaveBeenCalledTimes(1);
  expect(fallar).toHaveBeenCalledWith(error);
});
