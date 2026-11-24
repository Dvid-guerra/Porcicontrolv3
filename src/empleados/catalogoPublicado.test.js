import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PanelEmpleados from './PanelEmpleados.jsx';
import { publicarCatalogo } from '../domain/granja/publicarCatalogo.js';

vi.mock('firebase/firestore', async importar => ({
  ...await importar(),
  doc: (...ruta) => ruta.at(-1),
  runTransaction: (db, fn) => db.runTransaction(fn)
}));

function servidor(documentos) {
  const fuentes = new Map(Object.entries(documentos));
  const set = vi.fn((ref, valor) => fuentes.set(ref, valor));
  const db = {
    runTransaction: fn => fn({
      get: async id => ({ exists: () => fuentes.has(id), data: () => fuentes.get(id) }),
      set
    })
  };
  return { db, fuentes, set };
}

describe('publicación persistente del catálogo desde la sesión administrativa', () => {
  it('publica corrales existentes y vacíos, existencias y población sin exponer costos', async () => {
    const { db, fuentes, set } = servidor({
      agro_corrales: { data: [{ id: 'c1', nombre: 'Norte' }, { id: 'c2', nombre: 'Sur' }] },
      agro_lotes: { data: [{ id: 'l', estado: 'Activo', corralId: 'c1', cantidad: 20, faseActual: 1 }] },
      agro_bajas: { data: [{ loteId: 'l', cantidad: 2 }] },
      agro_ventas: { data: [{ loteId: 'l', cantidadCerdos: 3 }, { loteId: 'l', cantidadCerdos: 5, anulada: true }] },
      agro_bodega: { data: [{ tipo: 'VITALECHON 1', sacos: 2, costoTotal: 500 }] },
      agro_alimentos: { data: [{ tipo: 'VITALECHON 1', cantidadLb: 15 }] }
    });
    await publicarCatalogo(db, 'granja');
    const publicado = fuentes.get('catalogo');
    expect(publicado.corrales).toMatchObject([
      { nombre: 'Norte', cerdos: 15, alimentoSugerido: 'VITALECHON 1' },
      { nombre: 'Sur', loteId: '' }
    ]);
    expect(publicado.concentrados[0].stockLbs).toBe(85);
    expect(JSON.stringify(publicado)).not.toMatch(/costo|precio/i);
    await publicarCatalogo(db, 'granja');
    expect(set).toHaveBeenCalledTimes(1);
    fuentes.set('agro_corrales', { data: [] });
    await publicarCatalogo(db, 'granja');
    expect(fuentes.get('catalogo').corrales).toEqual([]);
  });

  it('conserva el catálogo anterior si una fuente tiene formato inválido', async () => {
    const { db, set } = servidor({ agro_lotes: { data: null } });
    await expect(publicarCatalogo(db, 'granja')).rejects.toThrow();
    expect(set).not.toHaveBeenCalled();
  });
});

it('la sección administrativa muestra la autorización y distingue fallos de una bandeja vacía', () => {
  const html = renderToStaticMarkup(createElement(PanelEmpleados, {
    appId: 'granja', pendientes: [], errorPendientes: 'Firebase denegó la lectura.'
  }));
  expect(html).toContain('Autorizar empleado');
  expect(html).toContain('Firebase denegó la lectura.');
  expect(html).not.toContain('No hay registros por revisar');
});
