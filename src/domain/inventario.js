export { calcularInventarioCentral } from './granja/inventarioCentral.js';

export function calcularInventarioProductos(catalogo, compras, usos) {
  return catalogo.map(item => {
    const entradas = compras.filter(c => c.productoId === item.id);
    const salidas = usos.filter(u => u.productoId === item.id);
    const cantidadComprada = entradas.reduce((s, c) => s + (Number(c.cantidad) || 0), 0);
    const costoComprado = entradas.reduce((s, c) => s + (Number(c.costoTotal) || 0), 0);
    const cantidadUsada = salidas.reduce((s, u) => s + (Number(u.cantidad) || 0), 0);
    const costoUsado = salidas.reduce((s, u) => s + (Number(u.costo) || 0), 0);
    const stock = Math.max(0, cantidadComprada - cantidadUsada);

    return {
      ...item,
      stock,
      cantidadComprada,
      cantidadUsada,
      costoPromedio: cantidadComprada > 0 ? costoComprado / cantidadComprada : 0,
      valorStock: Math.max(0, costoComprado - costoUsado),
      bajoStock: stock <= (Number(item.stockMinimo) || 0)
    };
  });
}
