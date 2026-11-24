export function calcularInventarioCentral(listCompras, listAlimentos, listCatAlimentos, listCatIngredientes = []) {
  const catalogoCompleto = [...listCatAlimentos, ...listCatIngredientes];

  return catalogoCompleto.map(item => {
    const isConcentrado = listCatAlimentos.some(c => c.id === item.id);
    const catSacos = isConcentrado ? (item.librasPorSaco || 50) : (item.librasPorSaco || 100);

    const compradosSacos = listCompras.filter(c => c.tipo === item.nombre).reduce((s, c) => s + (c.sacos || 0), 0);
    const compradosLbs = compradosSacos * catSacos;

    const consumidoLbs = listAlimentos.reduce((acc, a) => {
      if (!a.esSuplemento && a.tipo === item.nombre) return acc + (a.cantidadLb || 0);
      if (a.esSuplemento && Array.isArray(a.ingredientesUsados)) {
        const match = a.ingredientesUsados.find(u => u.nombre === item.nombre);
        if (match) return acc + (match.libras || 0);
      }
      return acc;
    }, 0);

    const stockLbs = Math.max(0, compradosLbs - consumidoLbs);
    return { ...item, isConcentrado, stockSacos: stockLbs / catSacos, stockLbs, consumidoLbs };
  });
}
