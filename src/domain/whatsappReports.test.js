import { describe, expect, it } from 'vitest';
import {
  normalizarTelefonoWhatsApp,
  construirUrlWhatsApp,
  formatearParteDiarioWhatsApp,
  formatearReciboVentaWhatsApp,
  formatearOrdenCompraWhatsApp,
  formatearFichaCorralWhatsApp
} from './whatsappReports.js';

describe('whatsappReports domain', () => {
  it('normaliza teléfonos locales de Guatemala (8 dígitos) a +502', () => {
    expect(normalizarTelefonoWhatsApp('5544-3322')).toBe('50255443322');
    expect(normalizarTelefonoWhatsApp('+502 4433 2211')).toBe('50244332211');
    expect(normalizarTelefonoWhatsApp('')).toBe('');
  });

  it('construye URLs de wa.me con o sin número destinatario', () => {
    const urlSinTel = construirUrlWhatsApp('Hola *Granja*');
    expect(urlSinTel).toBe('https://wa.me/?text=Hola%20*Granja*');

    const urlConTel = construirUrlWhatsApp('Parte diario', '5544-3322');
    expect(urlConTel).toBe('https://wa.me/50255443322?text=Parte%20diario');
  });

  it('formatea el Parte Diario con atrasadas, tareas de hoy, actividad del día y compras', () => {
    const texto = formatearParteDiarioWhatsApp({
      fechaTexto: 'viernes, 30 de octubre',
      corralesActivos: 4,
      corralesTotales: 6,
      cerdosVivos: 58,
      sacosBodega: 12.5,
      acciones: [
        { grupo: 'atrasado', corral: 'Corral 1', titulo: 'Pesar lote', detalle: '14 días sin pesar' },
        { grupo: 'hoy', corral: 'Corral 2', titulo: '2ª dosis Innosure', detalle: 'Toca hoy' },
        { grupo: 'semana', corral: 'Corral 3', titulo: 'Desparasitación', detalle: 'En 3 días' }
      ],
      actividadHoy: {
        alimentosLbHoy: 250,
        descargasHoy: 3,
        pesajesHoy: 2,
        bajasHoy: 0,
        ventasCabezasHoy: 10,
        ventasTotalHoy: 22500
      },
      ordenCompra: [
        { nombre: 'VITACERDO 1', sacosAComprar: 8, invCentral: 50 }
      ]
    });

    expect(texto).toContain('*PORCICONTROL · PARTE DIARIO DE GRANJA*');
    expect(texto).toContain('4/6 corrales activos · *58 cerdos vivos*');
    expect(texto).toContain('*ATRASADO (1):*');
    expect(texto).toContain('*Corral 1:* Pesar lote');
    expect(texto).toContain('*PARA HOY (1):*');
    expect(texto).toContain('*Corral 2:* 2ª dosis Innosure');
    expect(texto).toContain('Alimento servido: *250.0 lb* (3 descargas)');
    expect(texto).toContain('Ventas hoy: *10 cerdos*');
    expect(texto).toContain('*VITACERDO 1:* comprar *8 sacos*');
    expect(texto).toContain('1 tarea programada');
  });

  it('formatea el recibo de báscula con tira numerada de cerdos pesados', () => {
    const recibo = formatearReciboVentaWhatsApp({
      corralNombre: 'Corral 4',
      raza: 'Duroc',
      fecha: '2026-10-30',
      cantidadCerdos: 3,
      totalLibras: 660,
      precioLibra: 11.5,
      totalVenta: 7590,
      pesosIndividuales: [220, 218, 222]
    });

    expect(recibo).toContain('*PORCICONTROL · COMPROBANTE DE BÁSCULA*');
    expect(recibo).toContain('Corral 4 (Duroc)');
    expect(recibo).toContain('3 cerdos');
    expect(recibo).toContain('660.0 lb');
    expect(recibo).toContain('220.0 lb/cerdo');
    expect(recibo).toContain('#1: 220.0lb · #2: 218.0lb · #3: 222.0lb');
  });

  it('formatea orden de compra de alimento y farmacia para proveedor', () => {
    const pedido = formatearOrdenCompraWhatsApp({
      fechaTexto: '30/10/2026',
      ordenAlimento: [{ nombre: 'VITALECHON 3', sacosAComprar: 6, lbsPorSaco: 50, faltanteGlobal: 280 }],
      ordenMedica: [{ nombre: 'Fenbendazol', faltanteOperativo: 2, unidad: 'frasco' }]
    });

    expect(pedido).toContain('*VITALECHON 3:* pedir *6 sacos*');
    expect(pedido).toContain('*Fenbendazol:* pedir *2 frasco*');
  });

  it('formatea ficha rápida de estado de corral', () => {
    const ficha = formatearFichaCorralWhatsApp({
      corralNombre: 'Corral 2',
      raza: 'Pietrain',
      cantidadActual: 14,
      cantidadVendida: 1,
      mortalidadPorcentaje: 0,
      diasLote: 64,
      etapaActual: 'Etapa 4',
      alimentoActual: 'VITACERDO 1',
      pesoPromedioTexto: '132.0 lb',
      adg: 1.52,
      fcaTexto: '2.41',
      inversionTotal: 14200,
      proximaTarea: { tarea: 'Desparasitación 2', fechaObjetivo: '2026-11-02' }
    });

    expect(ficha).toContain('*PORCICONTROL · ESTADO DE CORRAL 2*');
    expect(ficha).toContain('*14 vivos*');
    expect(ficha).toContain('Desparasitación 2 (2026-11-02)');
  });
});
