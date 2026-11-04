// Generadores puros de reportes y alertas para compartir en 1 toque por WhatsApp.
// Diseñados para lectura rápida en pantallas móviles con formato nativo de WhatsApp (*negrita*).

const formatearMonedaGtq = (valor) => {
  const num = Number(valor) || 0;
  return `Q${num.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const normalizarTelefonoWhatsApp = (telefonoRaw = '') => {
  const soloDigitos = String(telefonoRaw || '').replace(/\D+/g, '');
  if (!soloDigitos) return '';
  // Si es un número local de Guatemala de 8 dígitos, anteponer código de país 502
  if (soloDigitos.length === 8) return `502${soloDigitos}`;
  return soloDigitos;
};

export const construirUrlWhatsApp = (texto, telefono = '') => {
  const mensaje = String(texto || '').trim();
  const telNormalizado = normalizarTelefonoWhatsApp(telefono);
  const base = telNormalizado ? `https://wa.me/${telNormalizado}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(mensaje)}`;
};

export const formatearParteDiarioWhatsApp = ({
  fechaTexto = '',
  corralesActivos = 0,
  corralesTotales = 0,
  cerdosVivos = 0,
  sacosBodega = 0,
  acciones = [],
  actividadHoy = {},
  ordenCompra = []
} = {}) => {
  const lineas = [];
  lineas.push('🐷 *PORCICONTROL · PARTE DIARIO DE GRANJA*');
  if (fechaTexto) lineas.push(`📅 ${fechaTexto}`);
  lineas.push(
    `📊 *Resumen:* ${corralesActivos}/${corralesTotales} corrales activos · *${cerdosVivos} cerdos vivos* · *${Number(sacosBodega || 0).toFixed(1)} sacos* en bodega`
  );

  const atrasadas = (acciones || []).filter((a) => a.grupo === 'atrasado');
  const paraHoy = (acciones || []).filter((a) => a.grupo === 'hoy');
  const estaSemana = (acciones || []).filter((a) => a.grupo === 'semana');

  if (atrasadas.length > 0) {
    lineas.push('');
    lineas.push(`🚨 *ATRASADO (${atrasadas.length}):*`);
    atrasadas.forEach((item) => {
      lineas.push(`• *${item.corral}:* ${item.titulo} _(${item.detalle})_`);
    });
  }

  if (paraHoy.length > 0) {
    lineas.push('');
    lineas.push(`⚡ *PARA HOY (${paraHoy.length}):*`);
    paraHoy.forEach((item) => {
      lineas.push(`• *${item.corral}:* ${item.titulo} _(${item.detalle})_`);
    });
  }

  if (atrasadas.length === 0 && paraHoy.length === 0) {
    lineas.push('');
    lineas.push('✅ *Pendientes urgentes:* Todo al día (sin atrasos ni tareas críticas hoy).');
  }

  const {
    alimentosLbHoy = 0,
    descargasHoy = 0,
    pesajesHoy = 0,
    bajasHoy = 0,
    ventasCabezasHoy = 0,
    ventasTotalHoy = 0
  } = actividadHoy || {};

  if (descargasHoy > 0 || pesajesHoy > 0 || bajasHoy > 0 || ventasCabezasHoy > 0) {
    lineas.push('');
    lineas.push('📋 *MOVIMIENTOS REGISTRADOS HOY:*');
    if (descargasHoy > 0) {
      lineas.push(`• 🌾 Alimento servido: *${Number(alimentosLbHoy).toFixed(1)} lb* (${descargasHoy} descarga${descargasHoy === 1 ? '' : 's'})`);
    }
    if (pesajesHoy > 0) {
      lineas.push(`• ⚖️ Pesajes capturados: *${pesajesHoy}*`);
    }
    if (bajasHoy > 0) {
      lineas.push(`• ⚠️ Bajas reportadas hoy: *${bajasHoy}*`);
    }
    if (ventasCabezasHoy > 0) {
      lineas.push(`• 💰 Ventas hoy: *${ventasCabezasHoy} cerdos* (${formatearMonedaGtq(ventasTotalHoy)})`);
    }
  }

  const comprasCriticas = (ordenCompra || []).filter((item) => Number(item.sacosAComprar) > 0);
  if (comprasCriticas.length > 0) {
    lineas.push('');
    lineas.push('🛒 *INSUMOS POR COMPRAR (ETAPA ACTUAL):*');
    comprasCriticas.slice(0, 6).forEach((item) => {
      lineas.push(`• *${item.nombre}:* comprar *${item.sacosAComprar} sacos* (stock: ${Number(item.invCentral || 0).toFixed(0)} lb)`);
    });
  }

  if (estaSemana.length > 0) {
    lineas.push('');
    lineas.push(`🗓️ *Próximos 7 días:* ${estaSemana.length} tarea${estaSemana.length === 1 ? '' : 's'} programada${estaSemana.length === 1 ? '' : 's'}.`);
  }

  return lineas.join('\n');
};

export const formatearReciboVentaWhatsApp = ({
  corralNombre = 'Corral',
  raza = 'Estándar',
  fecha = '',
  cantidadCerdos = 0,
  totalLibras = 0,
  precioLibra = 0,
  totalVenta = 0,
  pesosIndividuales = [],
  modoInterno = false,
  estadisticasInternas = null
} = {}) => {
  const cabezas = Number(cantidadCerdos) || 0;
  const libras = Number(totalLibras) || 0;
  const promedio = cabezas > 0 ? libras / cabezas : 0;
  const precio = Number(precioLibra) || 0;
  const total = Number(totalVenta) || libras * precio;

  const lineas = [];
  lineas.push(
    modoInterno
      ? '📊 *PORCICONTROL · LIQUIDACIÓN INTERNA DE LOTE*'
      : '🧾 *PORCICONTROL · COMPROBANTE DE BÁSCULA*'
  );
  lineas.push(`📍 *Origen:* ${corralNombre} (${raza || 'Estándar'})`);
  if (fecha) lineas.push(`📅 *Fecha:* ${fecha}`);
  lineas.push('────────────────────');
  lineas.push(`🐖 *Cabezas:* ${cabezas} cerdo${cabezas === 1 ? '' : 's'}`);
  lineas.push(`⚖️ *Peso Total Neto:* ${libras.toFixed(1)} lb`);
  lineas.push(`📏 *Peso Promedio:* ${promedio.toFixed(1)} lb/cerdo`);
  lineas.push(`🏷️ *Precio Acordado:* ${formatearMonedaGtq(precio)} / lb`);
  lineas.push(`💰 *TOTAL LIQUIDADO:* *${formatearMonedaGtq(total)}*`);

  if (Array.isArray(pesosIndividuales) && pesosIndividuales.length > 0) {
    const detallePesos = pesosIndividuales
      .map((item, idx) => {
        const num = typeof item === 'object' && item?.numero ? item.numero : idx + 1;
        const p = Number(typeof item === 'number' ? item : item?.peso) || 0;
        return `#${num}: ${p.toFixed(1)}lb`;
      })
      .join(' · ');
    lineas.push('');
    lineas.push(`📋 *Tira de Báscula (${pesosIndividuales.length}):*`);
    lineas.push(detallePesos);
  }

  if (modoInterno && estadisticasInternas) {
    const st = estadisticasInternas;
    lineas.push('');
    lineas.push('📈 *CIERRE PRODUCTIVO Y FINANCIERO:*');
    lineas.push(`• Días en engorde: *${st.diasLote} días*`);
    lineas.push(`• GMD: *${Number(st.adg || 0).toFixed(2)} lb/día* · FCA: *${st.fcaEsConfiable ? Number(st.fca || 0).toFixed(2) : 'Sin 2° pesaje'}*`);
    lineas.push(`• Alimento consumido: *${Number(st.consumoTotalLb || 0).toFixed(0)} lb*`);
    lineas.push(`• Inversión total: *-${formatearMonedaGtq(st.inversionTotal)}*`);
    lineas.push(`• Utilidad neta: *${formatearMonedaGtq(st.utilidadNeta)}*`);
  }

  return lineas.join('\n');
};

export const formatearOrdenCompraWhatsApp = ({
  fechaTexto = '',
  ordenAlimento = [],
  ordenMedica = []
} = {}) => {
  const lineas = [];
  lineas.push('🛒 *PORCICONTROL · ORDEN DE COMPRA DE GRANJA*');
  if (fechaTexto) lineas.push(`📅 Fecha: ${fechaTexto}`);

  const alimentos = (ordenAlimento || []).filter((i) => Number(i.sacosAComprar) > 0);
  const medicos = (ordenMedica || []).filter((i) => Number(i.faltanteOperativo) > 0);

  if (alimentos.length === 0 && medicos.length === 0) {
    lineas.push('');
    lineas.push('✅ Bodega cubierta para terminar las etapas actuales de todos los corrales activos.');
    return lineas.join('\n');
  }

  if (alimentos.length > 0) {
    lineas.push('');
    lineas.push('🌾 *CONCENTRADO Y MATERIA PRIMA:*');
    alimentos.forEach((item) => {
      lineas.push(
        `• *${item.nombre}:* pedir *${item.sacosAComprar} sacos* (${item.lbsPorSaco || 50} lb/saco) — faltan ${Number(item.faltanteGlobal || 0).toFixed(0)} lb`
      );
    });
  }

  if (medicos.length > 0) {
    lineas.push('');
    lineas.push('💉 *FARMACIA VETERINARIA (PRÓXIMOS 14 DÍAS):*');
    medicos.forEach((med) => {
      lineas.push(`• *${med.nombre}:* pedir *${Math.ceil(med.faltanteOperativo)} ${med.unidad || 'unidad'}*`);
    });
  }

  return lineas.join('\n');
};

export const formatearFichaCorralWhatsApp = ({
  corralNombre = 'Corral',
  raza = 'Estándar',
  cantidadActual = 0,
  cantidadVendida = 0,
  mortalidadPorcentaje = 0,
  diasLote = 0,
  etapaActual = '',
  alimentoActual = '',
  pesoPromedioTexto = '',
  adg = 0,
  fcaTexto = '',
  inversionTotal = 0,
  proximaTarea = null
} = {}) => {
  const lineas = [];
  lineas.push(`📌 *PORCICONTROL · ESTADO DE ${String(corralNombre).toUpperCase()}*`);
  lineas.push(`🐖 *Lote:* ${raza || 'Estándar'} · *${cantidadActual} vivos* (${cantidadVendida} vendidos · ${Number(mortalidadPorcentaje || 0).toFixed(1)}% mort.)`);
  lineas.push(`⏱️ *Engorde:* Día ${diasLote} · ${etapaActual} (${alimentoActual})`);
  lineas.push(`⚖️ *Peso Promedio:* ${pesoPromedioTexto} · *GMD:* ${Number(adg || 0).toFixed(2)} lb/día`);
  lineas.push(`🌾 *Conversión (FCA):* ${fcaTexto}`);
  lineas.push(`💼 *Inversión Acumulada:* ${formatearMonedaGtq(inversionTotal)}`);

  if (proximaTarea && proximaTarea.tarea) {
    lineas.push(`💉 *Próxima tarea sanitaria:* ${proximaTarea.tarea} (${proximaTarea.fechaObjetivo || 'pendiente'})`);
  } else {
    lineas.push('✅ *Sanidad:* Sin tareas pendientes');
  }

  return lineas.join('\n');
};
