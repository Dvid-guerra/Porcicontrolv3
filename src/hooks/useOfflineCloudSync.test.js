import { describe, expect, it } from 'vitest';
import { diagnosticarNube, ESPERA_DATOS_NUBE_MS } from './useOfflineCloudSync.js';

describe('diagnosticarNube', () => {
  const base = { enLinea: true, inicioAt: 0, ultimoDatoAt: null, error: null };

  it('no avisa sin conexión: eso ya lo cubre el Modo Galpón', () => {
    expect(diagnosticarNube({ ...base, enLinea: false, ahora: 60_000, error: 'permission-denied' })).toBeNull();
  });

  it('no avisa mientras la primera carga está dentro del tiempo de espera', () => {
    expect(diagnosticarNube({ ...base, ahora: ESPERA_DATOS_NUBE_MS - 1 })).toBeNull();
  });

  it('avisa si hay conexión y nunca llegó un dato del servidor', () => {
    expect(diagnosticarNube({ ...base, ahora: ESPERA_DATOS_NUBE_MS })).toBe('sinRespuesta');
  });

  it('no avisa si ya llegó un dato del servidor', () => {
    expect(diagnosticarNube({ ...base, ahora: 60_000, ultimoDatoAt: 5_000 })).toBeNull();
  });

  it('avisa de inmediato si Firestore rechazó la lectura', () => {
    expect(diagnosticarNube({ ...base, ahora: 1_000, error: 'permission-denied' })).toBe('error');
  });
});
