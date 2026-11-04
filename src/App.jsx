import React, { useState, useMemo, useEffect } from 'react';
import {
  Settings, Plus, Activity, Syringe, Wheat, Scale, Calendar, Users,
  ChevronRight, ClipboardList, CheckCircle, Trash2, TrendingUp, PiggyBank,
  AlertTriangle, HeartPulse, Receipt, PieChart, Calculator, Leaf, Printer, X, Clock,
  Archive, Box, Package, LayoutDashboard, DollarSign, BookOpen, AlertCircle,
  Beaker, ShoppingCart, FileText, Download, LogOut, Menu, Ban, RotateCcw, QrCode, Camera, ScanLine, Check,
  Flashlight, FlashlightOff, RefreshCw, Wifi, WifiOff, Smartphone, MessageCircle, Copy,
  ArrowLeft, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { calculateLotStatistics, parseLocalDate } from './domain/lotStatistics.js';
import { PanelPrincipal } from './design-system/PanelPrincipal.jsx';
import marcaGuerraFarm from './design-system/assets/guerra-farm-marca-sobre-bosque.png';
import { construirPanelPrincipal } from './design-system/panelData.js';
import {
  buildCorralQrPayload,
  parseCorralQrPayload,
  resolverContextoTolvaQr,
  calcularDescuentoTolva,
  encodeQrMatrix
} from './domain/qrTolva.js';
import {
  calcularTamanoCaptura,
  crearControlEscaneoRepetido,
  describirErrorCamara,
  soportaDeteccionNativaQr
} from './domain/qrScanner.js';
import {
  INNOSURE_PLANS,
  PLAN_INNOSURE_POR_DEFECTO,
  calcularPlanInnosure,
  composicionLote,
  planificarSincronizacion,
  validarFechaDosis
} from './domain/sanitaryPlan.js';
import {
  formatLocalIsoDate,
  addDaysLocalIso,
  evaluarPesoBascula,
  calcularProgresoEmbarque,
  construirClaveBorradorBascula,
  serializarBorradorBascula,
  parsearBorradorBascula,
  calcularPesoSchaefferLb,
  resumirMuestraPesaje,
  construirEstadoNavegacion,
  sonEstadosNavegacionIguales
} from './domain/fieldUx.js';
import {
  crearFirestoreConCacheOffline,
  useCloudStorage,
  useOfflineSyncStatus,
  ejecutarTransaccionMultiClaveOffline
} from './hooks/useOfflineCloudSync.js';
import {
  construirUrlWhatsApp,
  formatearParteDiarioWhatsApp,
  formatearReciboVentaWhatsApp,
  formatearOrdenCompraWhatsApp,
  formatearFichaCorralWhatsApp
} from './domain/whatsappReports.js';

// --- IMPORTACIONES DE FIREBASE NUBE ---
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

// ============================================================================
// 1. TU CONFIGURACIÓN DE FIREBASE (Proyecto: agroporcina)
// ============================================================================
const localFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Lógica de compatibilidad para funcionar tanto en local como en este entorno de prueba
const envConfig = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
let firebaseConfig = localFirebaseConfig;
if (envConfig) {
  firebaseConfig = typeof envConfig === 'string' ? JSON.parse(envConfig) : envConfig;
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
  throw new Error('Falta la configuración de Firebase. Copia .env.example a .env.local y completa sus valores.');
}

// Inicializar Firebase y Proveedores (con caché persistente multi-pestaña para galpón offline)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = crearFirestoreConCacheOffline(app);
const cloudFunctions = getFunctions(app);

if (import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
}

const googleProvider = new GoogleAuthProvider();
const globalAppId = typeof __app_id !== 'undefined' ? __app_id : 'agrocontrol-local';

// --- NAVEGACIÓN (una sola fuente para sidebar, header y barra inferior) ---
const SECCIONES_NAV = [
  {
    titulo: 'Operaciones',
    items: [
      { id: 'hoy', label: 'Hoy', icon: CheckCircle, activoEn: ['hoy'] },
      { id: 'dashboard', label: 'Panel principal', icon: LayoutDashboard, activoEn: ['dashboard', 'corralDetail', 'corral', 'prepararVenta', 'resumenVenta', 'imprimirFicha'] },
      { id: 'bodega', label: 'Bodega central', icon: Archive, activoEn: ['bodega'] },
      { id: 'finanzasGlobales', label: 'Finanzas globales', icon: DollarSign, activoEn: ['finanzasGlobales'] },
      { id: 'calendario', label: 'Calendario', icon: Calendar, activoEn: ['calendario'] }
    ]
  },
  {
    titulo: 'Administración',
    items: [
      { id: 'historial', label: 'Historial de lotes', icon: ClipboardList, activoEn: ['historial', 'reporteHistorial'] },
      { id: 'config', label: 'Ajustes y fórmulas', icon: Settings, activoEn: ['config', 'laboratorio'] }
    ]
  }
];

const TITULOS_VISTA = {
  hoy: { label: 'Hoy', icon: CheckCircle },
  dashboard: { label: 'Panel principal', icon: LayoutDashboard },
  bodega: { label: 'Bodega central', icon: Archive },
  calendario: { label: 'Calendario', icon: Calendar },
  laboratorio: { label: 'Laboratorio de mezclas', icon: Beaker },
  historial: { label: 'Historial de lotes', icon: ClipboardList },
  reporteHistorial: { label: 'Reporte histórico', icon: ClipboardList },
  config: { label: 'Ajustes', icon: Settings },
  prepararVenta: { label: 'Báscula de venta', icon: Scale },
  resumenVenta: { label: 'Reportes de venta', icon: PieChart },
  imprimirFicha: { label: 'Ficha de trazabilidad', icon: Printer },
  finanzasGlobales: { label: 'Finanzas globales', icon: DollarSign }
};

// Vista a la que regresa el botón "atrás" del encabezado.
const VISTA_PADRE = {
  corralDetail: 'dashboard',
  corral: 'dashboard',
  prepararVenta: 'corralDetail',
  resumenVenta: 'corralDetail',
  imprimirFicha: 'corralDetail',
  reporteHistorial: 'historial',
  laboratorio: 'config'
};

// --- DATOS POR DEFECTO ---

// --- MOCK DATA PARA DESARROLLO LOCAL ---
const MOCK_LOTES = [
  { id: 'lote1', corralId: 'c1', nombre: 'Lote Duroc 01', cantidadInicial: 15, cantidadActual: 15, cantidad: 15, fechaInicio: '2026-05-10', fechaIngreso: '2026-05-10', estado: 'Activo', pesoInicial: 35, faseActual: 4 },
  { id: 'lote2', corralId: 'c2', nombre: 'Lote Pietrain 02', cantidadInicial: 12, cantidadActual: 11, cantidad: 12, fechaIngreso: '2026-06-01', fechaInicio: '2026-06-01', estado: 'Activo', pesoInicial: 38, faseActual: 2 },
];
const MOCK_PESOS = [
  { id: 'p1', loteId: 'lote1', peso: 45, fecha: '2026-05-20', cantidadCerdos: 15, tipo: 'promedio' },
  { id: 'p2', loteId: 'lote1', peso: 68, fecha: '2026-06-05', cantidadCerdos: 15, tipo: 'promedio' },
  { id: 'p3', loteId: 'lote1', peso: 105, fecha: '2026-06-25', cantidadCerdos: 15, tipo: 'promedio' },
  { id: 'p4', loteId: 'lote2', peso: 42, fecha: '2026-06-15', cantidadCerdos: 11, tipo: 'promedio' },
];
const MOCK_ALIMENTOS = [
  { id: 'a1', loteId: 'lote1', fecha: '2026-05-15', tipo: 'VITALECHON 1', sacos: 2, libras: 100, costo: 788, categoria: 'concentrado' },
  { id: 'a2', loteId: 'lote1', fecha: '2026-06-10', tipo: 'VITALECHON 3', sacos: 3, libras: 150, costo: 666, categoria: 'concentrado' },
  { id: 'a3', loteId: 'lote2', fecha: '2026-06-05', tipo: 'VITALECHON 1', sacos: 1, libras: 50, costo: 394, categoria: 'concentrado' },
];
const MOCK_COMPRAS = [
  { id: 'c1', fecha: '2026-05-01', tipo: 'VITALECHON 1', sacos: 10, costoTotal: 3940, categoria: 'concentrado' },
  { id: 'c2', fecha: '2026-05-15', tipo: 'VITALECHON 2', sacos: 15, costoTotal: 4335, categoria: 'concentrado' },
  { id: 'c3', fecha: '2026-06-01', tipo: 'MAÍZ AMARILLO', sacos: 20, costoTotal: 3200, categoria: 'ingrediente' },
];

const INITIAL_CATALOGO = [
  { id: 'vl1', nombre: 'VITALECHON 1', precioSaco: 394, librasPorSaco: 50 },
  { id: 'vl2', nombre: 'VITALECHON 2', precioSaco: 289, librasPorSaco: 50 },
  { id: 'vl3', nombre: 'VITALECHON 3', precioSaco: 222, librasPorSaco: 50 },
  { id: 'vl4', nombre: 'VITALECHON 4', precioSaco: 326, librasPorSaco: 50 },
  { id: 'vc1', nombre: 'VITACERDO 1', precioSaco: 294, librasPorSaco: 100 },
  { id: 'vc2', nombre: 'VITACERDO 2', precioSaco: 264, librasPorSaco: 100 },
  { id: 'vc3', nombre: 'VITACERDO 3', precioSaco: 259, librasPorSaco: 100 },
];

const INITIAL_INGREDIENTES = [
  { id: 'ing1', nombre: 'MAÍZ AMARILLO', precioSaco: 160, librasPorSaco: 100 },
  { id: 'ing2', nombre: 'SOYA', precioSaco: 280, librasPorSaco: 100 },
  { id: 'ing3', nombre: 'MELAZA', precioSaco: 100, librasPorSaco: 58.4 },
];

const INITIAL_CATALOGO_MEDICO = [
  { id: 'med1', nombre: 'Electrolitos orales', categoria: 'Hidratación', unidad: 'sobre', stockMinimo: 2, diasAlertaVencimiento: 30 },
  { id: 'med2', nombre: 'Multivitamínico oral', categoria: 'Vitaminado', unidad: 'frasco', stockMinimo: 1, diasAlertaVencimiento: 45 },
  { id: 'med3', nombre: 'Fenbendazol', categoria: 'Desparasitación', unidad: 'frasco', stockMinimo: 1, diasAlertaVencimiento: 45 },
  { id: 'med4', nombre: 'Ivermectina / Doramectina', categoria: 'Antiparasitario', unidad: 'frasco', stockMinimo: 1, diasAlertaVencimiento: 45 },
  { id: 'med5', nombre: 'Desinfectante de instalaciones', categoria: 'Bioseguridad', unidad: 'galón', stockMinimo: 1, diasAlertaVencimiento: 60 },
];

// Materiales de manejo que se compran a bodega y se consumen por corral: no son
// alimento ni medicina, pero cuestan plata y hay que saber cuánto queda.
const INITIAL_CATALOGO_INSUMOS = [
  { id: 'ins1', nombre: 'Viruta / aserrín', categoria: 'Cama', unidad: 'saco', stockMinimo: 5 },
  { id: 'ins2', nombre: 'Cal hidratada', categoria: 'Bioseguridad', unidad: 'saco', stockMinimo: 2 },
  { id: 'ins3', nombre: 'Desinfectante de corrales', categoria: 'Bioseguridad', unidad: 'galón', stockMinimo: 1 },
  { id: 'ins4', nombre: 'Guantes desechables', categoria: 'Manejo', unidad: 'caja', stockMinimo: 1 },
  { id: 'ins5', nombre: 'Jeringas y agujas', categoria: 'Manejo', unidad: 'paquete', stockMinimo: 2 }
];

const CRONOGRAMA_ALIMENTACION = [
  { fase: 1, alimento: 'VITALECHON 1', diaInicio: 1, diaFin: 11, consumoTotalLb: 6.6 },
  { fase: 2, alimento: 'VITALECHON 2', diaInicio: 12, diaFin: 21, consumoTotalLb: 11.0 },
  { fase: 3, alimento: 'VITALECHON 3', diaInicio: 22, diaFin: 28, consumoTotalLb: 11.0 },
  { fase: 4, alimento: 'VITALECHON 4', diaInicio: 29, diaFin: 49, consumoTotalLb: 48.4 },
  { fase: 5, alimento: 'VITACERDO 1', diaInicio: 50, diaFin: 70, consumoTotalLb: 74.8 },
  { fase: 6, alimento: 'VITACERDO 2', diaInicio: 71, diaFin: 105, consumoTotalLb: 175.1 },
  { fase: 7, alimento: 'VITACERDO 3', diaInicio: 106, diaFin: 133, consumoTotalLb: 169.5 },
];

const INITIAL_PROTOCOLO_SANITARIO = [
  {
    id: 'ps7',
    dia: 0,
    rango: 'Día 0 (ingreso)',
    tarea: 'Refuerzo inyectado de ingreso',
    tipo: 'Refuerzo',
    categoria: 'medicamento',
    claseMedicamento: 'refuerzo',
    producto: 'Emicina o Tigen · 1/2 cc por lechón',
    duracion: 'Dosis única',
    condicion: 'Parte del procedimiento de ingreso, a todo el lote.',
    nota: 'No tiene efecto sobre la fecha de venta: se aplica el día de entrada y el lote sale meses después.'
  },
  {
    id: 'ps8',
    dia: 0,
    rango: 'Día 0 (ingreso)',
    tarea: 'Proteinzoo Plus (opcional)',
    tipo: 'Refuerzo',
    categoria: 'medicamento',
    claseMedicamento: 'refuerzo',
    producto: 'Proteinzoo Plus · 1/2 cc por lechón',
    duracion: 'Dosis única',
    condicion: 'Opcional. A criterio, según cómo lleguen los lechones.',
    nota: 'Si no se aplica, marcar el paso como omitido para que no quede como pendiente.'
  },
  {
    id: 'ps1',
    dia: 0,
    rango: 'Día 0-3',
    tarea: 'Sueros y electrolitos en agua',
    tipo: 'Hidratación',
    categoria: 'medicamento',
    producto: 'Electrolitos orales para cerdos',
    productoMedicoId: 'med1',
    duracion: 'Los primeros 3 días',
    condicion: 'Siempre al llegar el lote, y con más razón si vienen de viaje largo, acalorados, recién destetados o decaídos.',
    nota: 'No pasar de 48-72 horas; después agua normal, alimento fresco y observación.'
  },
  {
    id: 'ps4',
    dia: 14,
    rango: 'Día 14 · ~5 semanas de edad',
    tarea: '1ª desparasitación',
    tipo: 'Desparasitación',
    categoria: 'medicamento',
    pesoEsperado: '18–22 lb (8–10 kg)',
    producto: 'Fenbendazol si solo buscas control interno; ivermectina/doramectina si hay sarna, piojos o comezón.',
    productoMedicoId: 'med3',
    duracion: 'Según etiqueta del producto',
    condicion: 'Elegir producto según signos, peso y condición del lote.',
    nota: 'Pesar o estimar bien el peso para no subdosificar ni sobredosificar.'
  },
  {
    id: 'ps6',
    dia: 56,
    rango: 'Día 56 · ~11 semanas de edad',
    tarea: '2ª desparasitación',
    tipo: 'Desparasitación',
    categoria: 'medicamento',
    pesoEsperado: '60–75 lb (28–35 kg)',
    producto: 'Según producto usado y recomendación veterinaria',
    productoMedicoId: 'med3',
    duracion: 'Según etiqueta del producto',
    condicion: 'Revisar peso antes de dosificar: a esta edad el consumo y el tamaño cambian rápido.',
    nota: 'Alternar principio activo si se repite el mismo del primer ciclo.'
  },
  {
    id: 'ps9',
    dia: 98,
    rango: 'Día 98 · ~17 semanas de edad',
    tarea: '3ª desparasitación',
    tipo: 'Desparasitación',
    categoria: 'medicamento',
    pesoEsperado: '130–155 lb (60–70 kg)',
    producto: 'Según producto usado y recomendación veterinaria',
    productoMedicoId: 'med3',
    duracion: 'Según etiqueta del producto',
    condicion: 'Última desparasitación del ciclo, antes de la fase de finalización.',
    nota: 'Verificar el período de retiro del producto contra la fecha de venta proyectada.'
  },
];

// Pasos de Innosure. No viven en el protocolo base porque solo aplican a los lotes que
// tienen machos enteros: las hembras y los machos capados nunca lo llevan. El dia de
// cada dosis sale del plan elegido para el lote (20 o 22 semanas).
const PROTOCOLO_INNOSURE = [
  {
    id: 'inn1',
    innosureDosis: 1,
    tarea: '1ª dosis de Innosure',
    tipo: 'Innosure',
    categoria: 'medicamento',
    producto: 'Innosure (inmunocastración) — solo machos enteros',
    duracion: 'Dosis única',
    condicion: 'Aplicar únicamente a los machos sin capar del lote.',
    nota: 'Entre esta dosis y la segunda deben pasar mínimo 2 semanas.'
  },
  {
    id: 'inn2',
    innosureDosis: 2,
    tarea: '2ª dosis de Innosure',
    tipo: 'Innosure',
    categoria: 'medicamento',
    producto: 'Innosure (inmunocastración) — refuerzo',
    duracion: 'Dosis única',
    condicion: 'Requiere que la 1ª dosis ya esté aplicada.',
    nota: 'La venta queda bloqueada hasta 3 semanas después de esta dosis.'
  }
];

// Los pasos de observacion y revision clinica no son medicamentos y no deben ensuciar
// el calendario de aplicaciones. Los registros viejos de Firestore no traen `categoria`,
// asi que se infiere del tipo para no tener que migrar nada.
const TIPOS_SIN_MEDICAMENTO = ['Observación', 'Revisión', 'Manejo'];
const esTareaDeMedicamento = (tarea) => (
  tarea?.categoria ? tarea.categoria === 'medicamento' : !TIPOS_SIN_MEDICAMENTO.includes(tarea?.tipo)
);

// Clases de medicamento que se calendarizan de verdad en esta granja.
const CLASES_MEDICAMENTO = {
  refuerzo: { label: 'Refuerzo de ingreso', emoji: '💉', chip: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  suero: { label: 'Sueros / electrolitos', emoji: '💧', chip: 'bg-sky-100 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  desparasitacion: { label: 'Desparasitación', emoji: '💊', chip: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  innosure: { label: 'Innosure', emoji: '🔵', chip: 'bg-indigo-100 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  otro: { label: 'Otros', emoji: '🩺', chip: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  ventaOk: { label: 'Venta habilitada', emoji: '✅', chip: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
};

const claseDeMedicamento = (tarea) => {
  if (tarea?.innosureDosis) return 'innosure';
  // Los pasos del protocolo traen su clase explicita; el texto es solo el respaldo
  // para tareas viejas de Firestore que no la tienen.
  if (tarea?.claseMedicamento && CLASES_MEDICAMENTO[tarea.claseMedicamento]) return tarea.claseMedicamento;
  const texto = `${tarea?.tipo || ''} ${tarea?.tarea || ''} ${tarea?.producto || ''}`.toLowerCase();
  if (texto.includes('desparasit')) return 'desparasitacion';
  if (texto.includes('emicina') || texto.includes('tigen') || texto.includes('proteinzoo') || texto.includes('refuerzo')) return 'refuerzo';
  if (texto.includes('electrolito') || texto.includes('suero') || texto.includes('hidrat') || texto.includes('vitam')) return 'suero';
  return 'otro';
};

// IMPORTACIÓN POR ÚNICA VEZ — fechas reales de Innosure tomadas del archivo
// "Plan_corrales_actualizable_Innosure.xlsx" de la granja.
// Negro en el Excel = dosis aplicada; rojo / resaltado amarillo = todavía pendiente.
// Se puede borrar esta constante y su botón una vez importado.
const IMPORTACION_INNOSURE_EXCEL = [
  { corral: 'Corral 3', dosis: [{ fecha: '2026-07-30', aplicada: true }, { fecha: '2026-08-25', aplicada: true }] },
  { corral: 'Corral 4', dosis: [{ fecha: '2026-07-30', aplicada: true }, { fecha: '2026-08-25', aplicada: true }] },
  { corral: 'Corral 5', dosis: [{ fecha: '2026-07-30', aplicada: true }, { fecha: '2026-09-02', aplicada: true }] },
  { corral: 'Corral 6', dosis: [{ fecha: '2026-09-02', aplicada: true }, { fecha: '2026-09-21', aplicada: false }] },
  { corral: 'Corral 7', dosis: [{ fecha: '2026-09-02', aplicada: true }, { fecha: '2026-09-21', aplicada: false }] },
  { corral: 'Corral 8', dosis: [{ fecha: '2026-09-24', aplicada: false }, { fecha: '2026-10-20', aplicada: false }] },
  { corral: 'Corral 9', dosis: [{ fecha: '2026-09-24', aplicada: false }, { fecha: '2026-10-20', aplicada: false }] },
  { corral: 'Corral 10', dosis: [{ fecha: '2026-09-24', aplicada: false }, { fecha: '2026-10-30', aplicada: false }] },
  { corral: 'Corral 11', dosis: [{ fecha: '2026-09-24', aplicada: false }, { fecha: '2026-11-13', aplicada: false }] }
];

const addDaysToDate = (dateStr, days) => {
  const result = new Date(dateStr + 'T00:00:00');
  result.setDate(result.getDate() + days);
  return result.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });
};

const addDaysToIsoDate = (dateStr, days) => addDaysLocalIso(dateStr, days);

const safeArr = (val, fallback = []) => Array.isArray(val) ? val : fallback;

const todayIso = () => formatLocalIsoDate();

// ISO/IEC 18004 exige 4 módulos de margen blanco alrededor del símbolo. Con 3 los
// lectores fallan cuando el rótulo lleva un borde impreso pegado al código.
const ZONA_SILENCIO_QR = 4;

// Renderizador SVG de Código QR 100% offline (ideal para pantalla e impresión PDF)
const CodigoQrSvg = ({ valor, size = 160, etiqueta = 'Código QR del corral', className = '' }) => {
  const qr = useMemo(() => {
    try {
      return { ...encodeQrMatrix(valor || 'PORCI:CORRAL'), error: null };
    } catch (error) {
      return { size: 21, modules: [], error };
    }
  }, [valor]);

  const totalSize = qr.size + ZONA_SILENCIO_QR * 2;
  const pathData = useMemo(() => {
    let d = '';
    for (let r = 0; r < qr.modules.length; r++) {
      const row = qr.modules[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c]) {
          d += `M${c + ZONA_SILENCIO_QR},${r + ZONA_SILENCIO_QR}h1v1h-1z`;
        }
      }
    }
    return d;
  }, [qr]);

  // Un payload demasiado largo no puede codificarse: avisarlo es mejor que
  // imprimir un cuadro blanco que nadie podrá escanear en el galpón.
  if (qr.error) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-rose-50 border border-dashed border-rose-300 rounded-xl p-2 text-center ${className}`}
      >
        <span className="text-[10px] font-bold text-rose-700 leading-tight">
          No se pudo generar el QR (código demasiado largo)
        </span>
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${totalSize} ${totalSize}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label={etiqueta}
    >
      <rect width={totalSize} height={totalSize} fill="#ffffff" />
      <path d={pathData} fill="#0f172a" />
    </svg>
  );
};

// Tabla de existencias compartida por las tres bodegas: alimento, farmacia e insumos.
// `filas` viene ya normalizada para que cada bodega decida qué es "stock" y qué es "tipo".
const TablaInventarioBodega = ({ titulo, encabezadoStock = 'Stock', filas, vacio, onEliminar }) => (
  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
    <div className="flex items-center justify-between bg-slate-900 text-white px-5 py-3.5">
      <div className="flex items-center gap-2">
        <Box size={17} className="text-emerald-400" />
        <h3 className="font-bold text-sm">{titulo}</h3>
      </div>
      <span className="text-[10px] text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">Tiempo Real</span>
    </div>

    {filas.length === 0 ? (
      <p className="py-10 text-center text-slate-400 text-xs">{vacio}</p>
    ) : (
      <>
      <ul className="sm:hidden divide-y divide-slate-100">
        {filas.map(fila => (
          <li key={fila.id} className="px-4 py-3.5 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-800 text-sm leading-snug">{fila.nombre}</p>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                <span className="uppercase tracking-wide">{fila.tipo}</span>
                {fila.subtitulo && <> · {fila.subtitulo}</>}
              </p>
              <p className="text-xs font-bold text-slate-600 mt-1">Valor: {fila.valor}</p>
            </div>
            <div className="text-right shrink-0">
              <span className={`inline-block px-2.5 py-1 rounded-full font-black text-xs whitespace-nowrap ${fila.alerta ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                {fila.stock}
              </span>
              {fila.notaStock && <p className="text-[10px] text-slate-400 font-semibold mt-1">{fila.notaStock}</p>}
            </div>
            {onEliminar && (
              <button onClick={() => onEliminar(fila.id)} className="text-slate-300 hover:text-rose-500 p-1.5 -mr-1.5 rounded-md transition-colors shrink-0" title="Quitar del catálogo" aria-label={`Quitar ${fila.nombre} del catálogo`}>
                <Trash2 size={15} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
            <tr>
              <th className="p-4 pl-6 font-bold">Producto</th>
              <th className="p-4 font-bold text-center">Tipo</th>
              <th className="p-4 font-bold text-center">{encabezadoStock}</th>
              <th className={`p-4 font-bold text-right ${onEliminar ? '' : 'pr-6'}`}>Valor</th>
              {onEliminar && <th className="p-4 pr-6" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filas.map(fila => (
              <tr key={fila.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 pl-6 font-bold text-slate-800">
                  {fila.nombre}
                  {fila.subtitulo && <span className="text-[10px] text-slate-400 font-normal ml-1.5">({fila.subtitulo})</span>}
                </td>
                <td className="p-4 text-center text-xs font-bold text-slate-400 uppercase">{fila.tipo}</td>
                <td className="p-4 text-center">
                  <span className={`px-3 py-1 rounded-full font-black text-sm ${fila.alerta ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                    {fila.stock}
                  </span>
                  {fila.notaStock && <p className="text-[10px] text-slate-400 font-semibold mt-1">{fila.notaStock}</p>}
                </td>
                <td className={`p-4 text-right font-bold text-slate-800 ${onEliminar ? '' : 'pr-6'}`}>{fila.valor}</td>
                {onEliminar && (
                  <td className="p-4 pr-6 text-right">
                    <button onClick={() => onEliminar(fila.id)} className="text-slate-300 hover:text-rose-500 p-1 rounded-md transition-colors" title="Quitar del catálogo">
                      <Trash2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
    )}
  </div>
);

// --- PRESENTACION UNIFORME DE PESO Y FCA ---
// Todas las pantallas deben mostrar el mismo numero para el mismo lote. El peso que
// se muestra es el de proyeccion (medido si el pesaje esta fresco, estimado si no),
// siempre marcado con ~ cuando es estimado.
const formatPesoLb = (stats, decimales = 1) => {
  if (!stats || !(stats.pesoParaProyeccion > 0)) return 'Sin pesaje';
  const valor = stats.pesoParaProyeccion.toFixed(decimales);
  return stats.pesoEsEstimado ? `~${valor} lb` : `${valor} lb`;
};

const tituloPesoLb = (stats) => {
  if (!stats) return undefined;
  if (stats.pesoEsEstimado) {
    return `Peso estimado por consumo de alimento (conversión de referencia 3.0). Último pesaje real: ${stats.pesoActual.toFixed(1)} lb hace ${stats.diasSinPesaje} días.`;
  }
  if (stats.pesoAjustadoPorVenta) {
    return `Promedio de los cerdos que quedan, recalculado tras la venta parcial. Último pesaje del lote completo: ${stats.pesoActualRegistrado.toFixed(1)} lb.`;
  }
  return undefined;
};

// Una FCA sin al menos dos pesajes recientes es un artefacto, no un indicador.
const formatFca = (stats) => {
  if (!stats || !(stats.fca > 0)) return '—';
  return stats.fcaEsConfiable ? stats.fca.toFixed(2) : `${stats.fca.toFixed(2)} ⚠`;
};

const tituloFca = (stats) => {
  if (!stats) return undefined;
  if (!(stats.fca > 0)) return 'Sin datos suficientes: hacen falta al menos dos pesajes para calcular la conversión.';
  if (!stats.fcaEsConfiable) {
    return stats.pesajeVencido
      ? `No confiable: el último pesaje tiene ${stats.diasSinPesaje} días, así que el peso producido está subestimado.`
      : 'No confiable: hace falta al menos un segundo pesaje reciente para que este número signifique algo.';
  }
  return undefined;
};

const claseFca = (stats, claseNormal, claseAlta) => {
  if (!stats || !stats.fcaEsConfiable) return 'text-slate-400';
  return stats.fca > 3 ? claseAlta : claseNormal;
};
const NOTIFICATION_DAY_MS = 24 * 60 * 60 * 1000;
const INFO_NOTIFICATION_VISIBLE_MS = 3 * NOTIFICATION_DAY_MS;
const CRITICAL_NOTIFICATION_VISIBLE_MS = 7 * NOTIFICATION_DAY_MS;
const NOTIFICATION_RETENTION_MS = 365 * NOTIFICATION_DAY_MS;

const getNotificationCreatedAt = (notification) => Number(notification?.createdAt || notification?.fecha || Date.now());
const getNotificationVisibleUntil = (notification) => {
  const createdAt = getNotificationCreatedAt(notification);
  return Number(notification?.visibleHasta || notification?.expiresAt || createdAt + INFO_NOTIFICATION_VISIBLE_MS);
};

const isNotificationVisible = (notification, now = Date.now()) => {
  if (notification?.estado === 'resuelto' || notification?.estado === 'archivado') return false;
  if (notification?.severidad === 'critical' && notification?.persistente) return true;
  return getNotificationVisibleUntil(notification) > now;
};

const formatRelativeTime = (timestamp) => {
  const diff = Math.max(0, Date.now() - Number(timestamp || Date.now()));
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
};

const askGeminiDirectly = async ({ systemPrompt, contents }) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          maxOutputTokens: 2200,
          temperature: 0.15,
          topP: 0.8,
          topK: 32
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
        ]
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini directo fallo con estado ${response.status}: ${await response.text()}`);
  }

  return response.json();
};

// ============================================================================
// COMPONENTE PRINCIPAL (INTERFAZ Y LÓGICA DE NEGOCIO)
// ============================================================================
function Porcicontrol({ user, db, appId }) {
  const CLIENT_ID = useMemo(() => "client_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9), []);
  // --- ESTADOS NUBE (MIGRADO DE LOCALSTORAGE) ---
  const [catalogoAlimento, setCatalogoAlimento, l1] = useCloudStorage('agro_catalogo', INITIAL_CATALOGO, user, db, appId);
  const [catalogoIngredientes, setCatalogoIngredientes, l2] = useCloudStorage('agro_catalogo_ingredientes', INITIAL_INGREDIENTES, user, db, appId);
  const [reglasMezcla, setReglasMezcla, l3] = useCloudStorage('agro_reglas_mezcla', [{ id: 1, base: 'MAÍZ AMARILLO', aditivo: 'MELAZA', factor: 0.012 }], user, db, appId);
  const [formulasEtapas, setFormulasEtapas, l4] = useCloudStorage('agro_formulas_etapas', Array.from({ length: 7 }, (_, i) => ({ fase: i + 1, ingredientes: [] })), user, db, appId);
  const [pesoAlertaMezcla, setPesoAlertaMezcla, l5] = useCloudStorage('agro_peso_alerta', 100, user, db, appId);

  const [corrales, setCorrales, l7] = useCloudStorage('agro_corrales', [
    { id: 'c1', nombre: 'Corral 1', capacidad: 15 },
    { id: 'c2', nombre: 'Corral 2', capacidad: 15 },
    { id: 'c3', nombre: 'Corral 3', capacidad: 15 },
    { id: 'c4', nombre: 'Corral 4', capacidad: 15 },
  ], user, db, appId);

  const [lotes, setLotes, l8] = useCloudStorage('agro_lotes', window.location.hostname === 'localhost' ? MOCK_LOTES : [], user, db, appId);
  const [pesos, setPesos, l9] = useCloudStorage('agro_pesos', window.location.hostname === 'localhost' ? MOCK_PESOS : [], user, db, appId);
  const [alimentos, setAlimentos, l10] = useCloudStorage('agro_alimentos', window.location.hostname === 'localhost' ? MOCK_ALIMENTOS : [], user, db, appId);
  const [vacunas, setVacunas, l11] = useCloudStorage('agro_vacunas', [], user, db, appId);
  const [bajas, setBajas, l12] = useCloudStorage('agro_bajas', [], user, db, appId);
  const [gastosExtra, setGastosExtra, l13] = useCloudStorage('agro_gastosextra', [], user, db, appId);
  const [comprasBodega, setComprasBodega, l14] = useCloudStorage('agro_bodega', window.location.hostname === 'localhost' ? MOCK_COMPRAS : [], user, db, appId);
  const [tareasSanidad, setTareasSanidad, l15] = useCloudStorage('agro_tareassanidad', [], user, db, appId);
  const [ventas, setVentas, l16] = useCloudStorage('agro_ventas', [], user, db, appId);
  const [constanteSchaeffer, setConstanteSchaeffer, l17] = useCloudStorage('agro_constante_schaeffer', 400, user, db, appId);
  const [notificacionesPush, setNotificacionesPush, l18] = useCloudStorage('agro_notificaciones_push', [], user, db, appId);
  const [eventosCalendario, setEventosCalendario, l19] = useCloudStorage('agro_eventos_calendario', [], user, db, appId);
  const [catalogoMedico, setCatalogoMedico, l20] = useCloudStorage('agro_catalogo_medico', INITIAL_CATALOGO_MEDICO, user, db, appId);
  const [comprasMedicas, setComprasMedicas, l21] = useCloudStorage('agro_compras_medicas', [], user, db, appId);
  const [usosMedicos, setUsosMedicos, l22] = useCloudStorage('agro_usos_medicos', [], user, db, appId);
  const [catalogoInsumos, setCatalogoInsumos, l23] = useCloudStorage('agro_catalogo_insumos', INITIAL_CATALOGO_INSUMOS, user, db, appId);
  const [comprasInsumos, setComprasInsumos, l24] = useCloudStorage('agro_compras_insumos', [], user, db, appId);
  const [usosInsumos, setUsosInsumos, l25] = useCloudStorage('agro_usos_insumos', [], user, db, appId);

  // PANTALLA DE CARGA MIENTRAS SE CONECTA A FIREBASE
  const isAppReady = l1 && l2 && l3 && l4 && l5 && l7 && l8 && l9 && l10 && l11 && l12 && l13 && l14 && l15 && l16 && l17 && l18 && l19 && l20 && l21 && l22 && l23 && l24 && l25;

  // --- VARIABLES BLINDADAS ---
  const listCatAlimentos = safeArr(catalogoAlimento, INITIAL_CATALOGO);
  const listCatIngredientes = safeArr(catalogoIngredientes, INITIAL_INGREDIENTES);
  const listReglasMezcla = safeArr(reglasMezcla);
  const listFormulas = safeArr(formulasEtapas);
  const listCorrales = safeArr(corrales);
  const listLotes = safeArr(lotes);
  const listPesos = safeArr(pesos);
  const listAlimentos = safeArr(alimentos);
  const listVacunas = safeArr(vacunas);
  const listBajas = safeArr(bajas);
  const listGastosExtra = safeArr(gastosExtra);
  const listCompras = safeArr(comprasBodega);
  const listVentas = safeArr(ventas);
  // Una venta anulada se queda en el historial del corral como evidencia de lo que pasó,
  // pero no puede tocar ningún número: ni inventario vivo, ni libras, ni ingresos. Todo
  // cálculo usa listVentasActivas; solo la pantalla de historial mira listVentas completo.
  const listVentasActivas = listVentas.filter(v => !v.anulada);
  // El protocolo de la granja es fijo: sueros, desparasitación x2 e Innosure cuando hay
  // machos enteros. Cualquier otra cosa (una enfermedad puntual) se registra como
  // tratamiento médico, no como paso del protocolo.
  const listProtocoloSanitario = INITIAL_PROTOCOLO_SANITARIO;
  const listTareasSanidad = safeArr(tareasSanidad);
  const listEventosCalendario = safeArr(eventosCalendario);
  const listCatalogoMedico = safeArr(catalogoMedico, INITIAL_CATALOGO_MEDICO);
  const listComprasMedicas = safeArr(comprasMedicas);
  const listUsosMedicos = safeArr(usosMedicos);
  const listCatalogoInsumos = safeArr(catalogoInsumos, INITIAL_CATALOGO_INSUMOS);
  const listComprasInsumos = safeArr(comprasInsumos);
  const listUsosInsumos = safeArr(usosInsumos);

  const offlineStatus = useOfflineSyncStatus({ db, user, appId });

  const runFarmUpdates = async (updates) => {
    await ejecutarTransaccionMultiClaveOffline({
      db,
      appId,
      userUid: user.uid,
      updates,
      estadosActuales: {
        agro_lotes: listLotes,
        agro_pesos: listPesos,
        agro_alimentos: listAlimentos,
        agro_vacunas: listVacunas,
        agro_bajas: listBajas,
        agro_gastosextra: listGastosExtra,
        agro_tareassanidad: listTareasSanidad
      }
    });
  };

  // --- NAVEGACIÓN Y PANTALLAS ---
  // La app abre en "Hoy": lo primero que necesita el productor es qué hacer, no métricas.
  const [vista, setVista] = useState('hoy');
  const [corralSeleccionado, setCorralSeleccionado] = useState(null);
  const [finanzasLoteAbierto, setFinanzasLoteAbierto] = useState(null);
  const [loteHistorialSeleccionado, setLoteHistorialSeleccionado] = useState(null);
  const [tabActiva, setTabActiva] = useState('resumen');
  const [agendaDetalleAbierto, setAgendaDetalleAbierto] = useState(null);
  const [medicinaSeleccionadaId, setMedicinaSeleccionadaId] = useState(INITIAL_CATALOGO_MEDICO[0]?.id || '');
  const [calendarioFiltroCorral, setCalendarioFiltroCorral] = useState('todos');
  const [calendarioFiltroTipo, setCalendarioFiltroTipo] = useState('todos');
  const [calendarioCursor, setCalendarioCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [calendarioDiaSeleccionado, setCalendarioDiaSeleccionado] = useState(() => todayIso());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarColapsado, setSidebarColapsado] = useState(() => {
    try { return window.localStorage.getItem('porcicontrol_sidebar_colapsado') === '1'; } catch { return false; }
  });
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [whatsappTelefono, setWhatsappTelefono] = useState(() => {
    try {
      return window.localStorage.getItem('porci_whatsapp_tel') || '';
    } catch {
      return '';
    }
  });
  const [whatsappCopiadoId, setWhatsappCopiadoId] = useState('');
  const [mostrarPreviewParteHoy, setMostrarPreviewParteHoy] = useState(false);

  const guardarTelefonoWhatsApp = (nuevoTel) => {
    setWhatsappTelefono(nuevoTel);
    try {
      if (nuevoTel.trim()) {
        window.localStorage.setItem('porci_whatsapp_tel', nuevoTel.trim());
      } else {
        window.localStorage.removeItem('porci_whatsapp_tel');
      }
    } catch {
      // Ignorar restricciones de almacenamiento
    }
  };

  const enviarPorWhatsApp = (texto, telefonoForzado = undefined) => {
    if (!texto) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(40); } catch { /* ignorar */ }
    }
    const destino = telefonoForzado !== undefined ? telefonoForzado : whatsappTelefono;
    const url = construirUrlWhatsApp(texto, destino);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copiarTextoWhatsApp = async (texto, idBoton = 'general') => {
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(35); } catch { /* ignorar */ }
      }
      setWhatsappCopiadoId(idBoton);
      window.setTimeout(() => {
        setWhatsappCopiadoId((prev) => (prev === idBoton ? '' : prev));
      }, 2200);
    } catch {
      mostrarAlerta('Copiar mensaje', 'No se pudo copiar automáticamente. Usa el botón de Enviar por WhatsApp.');
    }
  };

  // --- ESTADOS VENTA Y FINANZAS (MODO GALPÓN) ---
  const [ventaPesos, setVentaPesos] = useState([]);
  const [ventaPrecio, setVentaPrecio] = useState(0);
  const [pesoInputVenta, setPesoInputVenta] = useState('');
  const [alertaPesoSospechoso, setAlertaPesoSospechoso] = useState(null);
  const [borradorVentaRestaurado, setBorradorVentaRestaurado] = useState(false);
  const ventaInputRef = React.useRef(null);
  // Venta cuyo formulario de anulación está abierto en el historial del corral.
  const [ventaAnulandoId, setVentaAnulandoId] = useState(null);
  const [motivoAnulacionVenta, setMotivoAnulacionVenta] = useState('');
  const [tipoReporteImpresion, setTipoReporteImpresion] = useState('interno');
  const [simuladorMuertesExtra, setSimuladorMuertesExtra] = useState(0);
  const [ingresoMachos, setIngresoMachos] = useState(0);
  const [tratamientoProductoId, setTratamientoProductoId] = useState('');

  // --- ESTADOS BODEGA & PUROS ---
  const [modalConfirm, setModalConfirm] = useState({ visible: false, tipo: 'confirm', titulo: '', mensaje: '', onConfirm: null });
  const [bodegaCategoria, setBodegaCategoria] = useState('concentrado');
  const [bodegaVistaTab, setBodegaVistaTab] = useState('alimento');
  const [puroInput, setPuroInput] = useState({ tipo: '', cantidad: '', unidad: 'sacos' });

  // --- ESTADOS ALIMENTACIÓN ---
  const [tipoRegistroAlimento, setTipoRegistroAlimento] = useState('tolva');
  const [suplementoItems, setSuplementoItems] = useState([{ id: Date.now(), tipo: '', libras: '' }]);

  // --- ESTADOS DESCUENTO RÁPIDO DE TOLVA POR CÓDIGO QR (OPCIÓN 1) ---
  const [qrModalAbierto, setQrModalAbierto] = useState(false);
  const [qrModalModo, setQrModalModo] = useState('escanear');
  const [qrCorralDetectado, setQrCorralDetectado] = useState(null);
  const [qrTipoAlimento, setQrTipoAlimento] = useState('');
  const [qrFaseDestino, setQrFaseDestino] = useState(1);
  const [qrCantidad, setQrCantidad] = useState('1');
  const [qrUnidad, setQrUnidad] = useState('sacos');
  const [qrFecha, setQrFecha] = useState(() => todayIso());
  const [qrCodigoManual, setQrCodigoManual] = useState('');
  const [qrErrorMensaje, setQrErrorMensaje] = useState('');
  const [qrExitoReciente, setQrExitoReciente] = useState(null);
  const [qrUltimoDescuentoRonda, setQrUltimoDescuentoRonda] = useState(null);
  // 'inactiva' | 'iniciando' | 'activa' | 'error': un booleano no distinguía
  // "arrancando la cámara" de "la cámara falló", y el operario veía el mismo texto.
  const [qrCamaraEstado, setQrCamaraEstado] = useState('inactiva');
  const [qrCamaraError, setQrCamaraError] = useState('');
  const [qrCamaraReintentable, setQrCamaraReintentable] = useState(false);
  const [qrIntentoCamara, setQrIntentoCamara] = useState(0);
  const [qrMotorLector, setQrMotorLector] = useState('');
  const [qrLinternaDisponible, setQrLinternaDisponible] = useState(false);
  const [qrLinternaActiva, setQrLinternaActiva] = useState(false);
  const [qrLeyendoFoto, setQrLeyendoFoto] = useState(false);
  const [qrGuardando, setQrGuardando] = useState(false);
  const qrVideoRef = React.useRef(null);
  const qrStreamRef = React.useRef(null);
  const qrPistaVideoRef = React.useRef(null);
  const qrLienzoRef = React.useRef(null);
  const qrUrlProcesadoRef = React.useRef(false);
  const qrGuardandoRef = React.useRef(false);
  // El efecto de la cámara no puede depender de `procesarTextoQrEscaneado`: esa
  // callback cambia de identidad con cada snapshot de Firestore (un compañero
  // guardando un peso) y reiniciaría la cámara en plena lectura.
  const qrProcesarRef = React.useRef(null);
  const qrControlRepetidoRef = React.useRef(crearControlEscaneoRepetido());

  // --- ESTADOS LABORATORIO DE MEZCLAS ---
  const [labTotalLbs, setLabTotalLbs] = useState(100);
  const [labPorcMezcla, setLabPorcMezcla] = useState(30);
  const [labConc, setLabConc] = useState('');
  const [labMatPrima, setLabMatPrima] = useState('MAÍZ AMARILLO');

  // --- ESTADOS CONFIGURACIÓN REGLAS ---
  const [faseFormEdicion, setFaseFormEdicion] = useState(1);
  const [formIngrediente, setFormIngrediente] = useState('');
  const [formPorcentaje, setFormPorcentaje] = useState('');
  const [formReglaBase, setFormReglaBase] = useState('MAÍZ AMARILLO');
  const [formReglaAditivo, setFormReglaAditivo] = useState('MELAZA');
  const [formReglaFactor, setFormReglaFactor] = useState(0.012);

  // --- ESTADOS SISTEMA DUAL DE PESAJE Y MUESTREO MULTI-CERDO ---
  const [expandirSchaeffer, setExpandirSchaeffer] = useState(false);
  const [circunferenciaCm, setCircunferenciaCm] = useState('');
  const [longitudCm, setLongitudCm] = useState('');
  const [pesoSchaefferCalculado, setPesoSchaefferCalculado] = useState(null);
  const [guardandoPeso, setGuardandoPeso] = useState(false);
  const [pesoIngresado, setPesoIngresado] = useState('');
  const [fechaPesaje, setFechaPesaje] = useState(() => todayIso());
  const [muestraPesosCorral, setMuestraPesosCorral] = useState([]);
  const pesoDirectoInputRef = React.useRef(null);
  const schaefferCircInputRef = React.useRef(null);

  // --- ESTADOS CHATBOT IA ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = React.useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  useEffect(() => {
    if (isAppReady && !puroInput.tipo && listCatAlimentos.length > 0) {
      setPuroInput(prev => ({ ...prev, tipo: listCatAlimentos[0].nombre }));
    }
    if (isAppReady && !labConc && listCatAlimentos.length > 0) {
      setLabConc(listCatAlimentos[listCatAlimentos.length - 1].nombre);
    }
  }, [isAppReady, listCatAlimentos, labConc, puroInput.tipo]);

  const emitirNotificacionPush = (evento) => {
    const userName = user?.displayName || user?.email?.split('@')[0] || 'Un usuario';
    const now = Date.now();
    const data = typeof evento === 'string' ? { descripcion: evento } : (evento || {});
    const visibleMs = data.visibleMs || (data.severidad === 'critical' ? CRITICAL_NOTIFICATION_VISIBLE_MS : INFO_NOTIFICATION_VISIBLE_MS);
    const nueva = {
      id: data.id || `notif_${now}_${Math.random().toString(36).slice(2, 8)}`,
      tipo: data.tipo || 'sistema',
      titulo: data.titulo || 'Actividad registrada',
      descripcion: data.descripcion || data.mensaje || '',
      detalle: data.detalle || '',
      corralId: data.corralId || '',
      corralNombre: data.corralNombre || '',
      loteId: data.loteId || '',
      loteNombre: data.loteNombre || '',
      entidad: data.entidad || null,
      severidad: data.severidad || 'info',
      estado: data.estado || 'visible',
      persistente: data.persistente ?? true,
      usuarioId: user?.uid || '',
      usuarioNombre: userName,
      clientId: CLIENT_ID,
      createdAt: now,
      fecha: now,
      visibleHasta: data.visibleHasta || (now + visibleMs),
      mensaje: data.mensaje || `${userName}: ${data.titulo || 'Actividad registrada'}${data.descripcion ? ` - ${data.descripcion}` : ''}`
    };
    setNotificacionesPush(prev => {
      const validas = safeArr(prev).filter(n => (now - getNotificationCreatedAt(n)) < NOTIFICATION_RETENTION_MS);
      return [...validas.slice(-119), nueva];
    });
  };

  const lastSeenNotifId = React.useRef(null);
  useEffect(() => {
    if (window.Notification && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!isAppReady || !notificacionesPush || notificacionesPush.length === 0) return;
    
    const ultima = notificacionesPush[notificacionesPush.length - 1];
    if (!lastSeenNotifId.current) {
      lastSeenNotifId.current = ultima.id;
      return;
    }

    if (ultima.id !== lastSeenNotifId.current) {
      lastSeenNotifId.current = ultima.id;
      if (ultima.clientId !== CLIENT_ID) {
        if (window.Notification && Notification.permission === 'granted') {
          new Notification(ultima.titulo || 'AgroControl Porcino', { body: ultima.descripcion || ultima.mensaje });
        }
      }
    }
  }, [notificacionesPush, isAppReady, CLIENT_ID]);

  useEffect(() => {
    if (!isAppReady || !Array.isArray(notificacionesPush) || notificacionesPush.length === 0) return;
    const now = Date.now();
    let changed = false;
    const cleaned = notificacionesPush
      .filter(n => (now - getNotificationCreatedAt(n)) < NOTIFICATION_RETENTION_MS)
      .map(n => {
        if ((n.estado || 'visible') === 'visible' && !isNotificationVisible(n, now)) {
          changed = true;
          return { ...n, estado: 'archivado', archivedAt: now };
        }
        return n;
      });

    if (cleaned.length !== notificacionesPush.length) changed = true;
    if (changed) setNotificacionesPush(cleaned);
  }, [notificacionesPush, isAppReady, setNotificacionesPush]);

  // Captura del evento de instalación PWA para Android / Chrome
  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    const onInstalled = () => setDeferredInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstalarPwa = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try {
      await deferredInstallPrompt.userChoice;
    } catch {
      // Ignorar cancelación
    }
    setDeferredInstallPrompt(null);
  };

  // Al cambiar de corral, limpiar la muestra temporal de pesaje para no mezclar cerdos de otro corral
  useEffect(() => {
    setMuestraPesosCorral([]);
    setAlertaPesoSospechoso(null);
  }, [corralSeleccionado?.id]);

  // Cálculo en tiempo real: Fórmula de Schaeffer
  useEffect(() => {
    if (circunferenciaCm && longitudCm) {
      setPesoSchaefferCalculado(calcularPesoSchaefferLb(circunferenciaCm, longitudCm, constanteSchaeffer));
    } else {
      setPesoSchaefferCalculado(null);
    }
  }, [circunferenciaCm, longitudCm, constanteSchaeffer]);

  // --- FUNCIONES AUXILIARES ---
  // El signo y el monto nunca se separan de línea (word joiner tras el "-" y espacio duro).
  const formatearMoneda = (v) => new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })
    .format(v || 0)
    .replace(/ /g, '\u00A0')
    .replace(/^-/, '-\u2060');
  // Egresos mostrados en pantalla con signo negativo explícito.
  const formatearMonedaNeg = (v) => `-\u2060${formatearMoneda(v)}`;
  const getLoteActivo = (corralId) => listLotes.find(l => l.corralId === corralId && l.estado === 'Activo');

  const buildAdvancedFarmAiContext = () => {
    const round = (value, decimals = 2) => {
      const number = Number(value) || 0;
      return Number(number.toFixed(decimals));
    };
    const sumBy = (items, selector) => safeArr(items).reduce((total, item) => total + (Number(selector(item)) || 0), 0);
    const saleWeightLb = (sale) => {
      if (Number(sale.totalLibras) > 0) return Number(sale.totalLibras);
      if (Array.isArray(sale.pesosVenta)) return sumBy(sale.pesosVenta, (item) => typeof item === 'number' ? item : item?.peso);
      return (Number(sale.pesoPromedioLibras) || 0) * (Number(sale.cantidadCerdos) || 0);
    };
    const byDateDesc = (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''));
    const latest = (items, limit = 5) => [...safeArr(items)].sort(byDateDesc).slice(0, limit);

    const lotesConStats = listLotes.map(lote => {
      const stats = calcularEstadisticasLote(lote);
      const corral = listCorrales.find(c => c.id === lote.corralId);
      const ventasLote = listVentasActivas.filter(v => v.loteId === lote.id).sort(byDateDesc);
      const bajasLote = listBajas.filter(b => b.loteId === lote.id).sort(byDateDesc);
      const alimentosLote = listAlimentos.filter(a => a.loteId === lote.id).sort(byDateDesc);
      const pesosLote = listPesos.filter(p => p.loteId === lote.id && p.pesoPromedio).sort(byDateDesc);
      const vacunasLote = listVacunas.filter(v => v.loteId === lote.id).sort(byDateDesc);
      const gastosLote = listGastosExtra.filter(g => g.loteId === lote.id).sort(byDateDesc);
      const tareasSanidadLote = listTareasSanidad.filter(t => t.loteId === lote.id).sort((a, b) => (Number(a.dia) || 0) - (Number(b.dia) || 0));
      const costoTotal = stats.costoInvertidoTotal + (Number(lote.manoObra) || 0);
      const cerdosOperados = Math.max(1, stats.cantidadActual + stats.cantidadVendida);
      const ingresoTotal = stats.ingresoEstimado;
      const margenPorcentaje = ingresoTotal > 0 ? (stats.utilidadNeta / ingresoTotal) * 100 : 0;
      const costoPorCerdoActual = costoTotal / cerdosOperados;
      const costoPorLbProducida = stats.pesoProducidoLb > 0 ? costoTotal / stats.pesoProducidoLb : 0;
      const librasEnPieYVendidas = stats.librasVendidas + (stats.pesoParaProyeccion * stats.cantidadActual);
      const puntoEquilibrioLb = librasEnPieYVendidas > 0 ? costoTotal / librasEnPieYVendidas : 0;

      return {
        loteId: lote.id,
        corral: corral?.nombre || 'Corral no encontrado',
        estado: lote.estado || 'Activo',
        parametrosIncompletos: stats.parametrosIncompletos,
        fechas: {
          ingreso: lote.fechaIngreso || null,
          salida: lote.fechaSalida || null,
          diasEnGranja: stats.diasLote,
          fechaInvalida: stats.fechaInvalida
        },
        animales: {
          iniciales: Number(lote.cantidad) || 0,
          vivos: stats.cantidadActual,
          vendidos: stats.cantidadVendida,
          bajas: sumBy(bajasLote, b => b.cantidad),
          mortalidadPorcentaje: round(stats.mortalidadPorcentaje, 1),
          capacidadCorral: Number(corral?.capacidad) || 0
        },
        pesosYProduccion: {
          pesoInicialPromedioLb: round(stats.pesoInicial, 1),
          // pesoActualPromedioLb es el que se debe usar para decidir: es el medido si el
          // pesaje esta fresco y el estimado por consumo si esta vencido.
          pesoActualPromedioLb: round(stats.pesoParaProyeccion, 1),
          pesoUltimoPesajeRealLb: round(stats.pesoActual, 1),
          pesoEsEstimadoPorConsumo: stats.pesoEsEstimado,
          diasSinPesaje: stats.diasSinPesaje,
          pesajeVencido: stats.pesajeVencido,
          librasVendidasBascula: round(stats.librasVendidas, 1),
          pesoProducidoParaFcaGmdLb: round(stats.pesoProducidoLb, 1),
          animalDias: round(stats.animalDias, 1),
          gmdLbDia: round(stats.adg, 3),
          consumoPorCerdoLb: round(stats.consumoPorCerdoLb, 1),
          consumoCicloPorcentaje: round(stats.consumoCicloPorcentaje, 1),
          excedeCicloCompleto: stats.excedeCicloCompleto,
          fca: round(stats.fca, 3),
          fcaEsConfiable: stats.fcaEsConfiable,
          fcaEstimadoPorFaltaDePesos: stats.fcaEsEstimado
        },
        finanzas: {
          costoLechones: round(stats.costoLechones),
          costoAlimento: round(stats.costoAlimento),
          costoAlimentoTolva: round(stats.costoAlimentoTolva),
          costoSuplementos: round(stats.costoAlimentoSuplemento),
          costoSanidad: round(stats.totalSanidad),
          gastosExtras: round(stats.totalGastosExtras),
          manoObra: round(lote.manoObra || 0),
          costoTotal: round(costoTotal),
          ingresoRealVentas: round(stats.ingresoRealVentas),
          valorEstimadoVivos: round(stats.ingresoEstimadoVivos),
          ingresoTotalRealMasEstimado: round(stats.ingresoEstimado),
          utilidadNetaRealMasEstimada: round(stats.utilidadNeta),
          margenPorcentaje: round(margenPorcentaje, 1),
          costoPorCerdoOperado: round(costoPorCerdoActual),
          costoPorLbProducida: round(costoPorLbProducida),
          puntoEquilibrioPorLb: round(puntoEquilibrioLb),
          precioVentaLibraConfigurado: round(lote.precioVentaLibra || 0)
        },
        proyecciones: {
          pesoObjetivoLb: stats.pesoObjetivoLb,
          librasFaltantes: round(stats.proyeccionLibrasFaltantes, 1),
          alimentoFaltanteLb: round(stats.proyeccionAlimentoFaltante, 1),
          costoAlimentoFaltante: round(stats.proyeccionCostoFaltante),
          ventaFinalProyectada: round(stats.proyeccionVentaFinal),
          utilidadFinalProyectada: round(stats.proyeccionUtilidadFinal)
        },
        eventosRecientes: {
          ultimosPesos: latest(pesosLote, 5).map(p => ({ fecha: p.fecha, pesoPromedioLb: round(p.pesoPromedio, 1), metodo: p.metodo || 'manual' })),
          ultimosAlimentos: latest(alimentosLote, 6).map(a => ({ fecha: a.fecha, tipo: a.tipo, fase: a.faseRegistro, cantidadLb: round(a.cantidadLb, 1), costo: round(a.costo), esSuplemento: !!a.esSuplemento })),
          ultimasVentas: latest(ventasLote, 5).map(v => ({ fecha: v.fecha, tipo: v.tipo || 'venta', cerdos: Number(v.cantidadCerdos) || 0, libras: round(saleWeightLb(v), 1), precioLb: round(v.precioLibra), total: round(v.totalVenta) })),
          ultimasBajas: latest(bajasLote, 5).map(b => ({ fecha: b.fecha, cantidad: Number(b.cantidad) || 0, causa: b.causa || 'No especificada' })),
          ultimosTratamientos: latest(vacunasLote, 5).map(v => ({ fecha: v.fecha, producto: v.nombre || v.vacuna || v.tipo, costo: round(v.costo) })),
          ultimosGastos: latest(gastosLote, 5).map(g => ({ fecha: g.fecha, concepto: g.concepto || g.descripcion || 'Gasto extra', monto: round(g.monto) }))
        },
        protocoloSanitario: tareasSanidadLote.map(t => ({
          dia: Number(t.dia) || 0,
          fechaObjetivo: t.fechaObjetivo || null,
          tarea: t.tarea,
          tipo: t.tipo || 'Sanidad',
          producto: t.producto || '',
          productoMedicoId: t.productoMedicoId || '',
          estado: t.estado || 'pendiente',
          observacion: t.observacion || ''
        }))
      };
    });

    const activos = lotesConStats.filter(l => l.estado === 'Activo');
    const cerrados = lotesConStats.filter(l => l.estado === 'Cerrado');
    const totals = lotesConStats.reduce((acc, lote) => ({
      animalesIniciales: acc.animalesIniciales + lote.animales.iniciales,
      animalesVivos: acc.animalesVivos + lote.animales.vivos,
      animalesVendidos: acc.animalesVendidos + lote.animales.vendidos,
      bajas: acc.bajas + lote.animales.bajas,
      librasVendidas: acc.librasVendidas + lote.pesosYProduccion.librasVendidasBascula,
      pesoProducidoLb: acc.pesoProducidoLb + lote.pesosYProduccion.pesoProducidoParaFcaGmdLb,
      alimentoLb: acc.alimentoLb + lote.pesosYProduccion.fca * lote.pesosYProduccion.pesoProducidoParaFcaGmdLb,
      costoTotal: acc.costoTotal + lote.finanzas.costoTotal,
      ingresoRealVentas: acc.ingresoRealVentas + lote.finanzas.ingresoRealVentas,
      ingresoTotal: acc.ingresoTotal + lote.finanzas.ingresoTotalRealMasEstimado,
      utilidadNeta: acc.utilidadNeta + lote.finanzas.utilidadNetaRealMasEstimada
    }), {
      animalesIniciales: 0, animalesVivos: 0, animalesVendidos: 0, bajas: 0,
      librasVendidas: 0, pesoProducidoLb: 0, alimentoLb: 0,
      costoTotal: 0, ingresoRealVentas: 0, ingresoTotal: 0, utilidadNeta: 0
    });

    const inventarioResumen = inventarioCentral.map(i => ({
      nombre: i.nombre,
      categoria: i.isConcentrado ? 'concentrado' : 'ingrediente',
      stockLbs: round(i.stockLbs, 1),
      stockSacos: round(i.stockSacos, 2),
      consumidoLbs: round(i.consumidoLbs, 1),
      precioSaco: round(i.precioSaco),
      librasPorSaco: Number(i.librasPorSaco) || 0,
      precioPorLibra: round((Number(i.precioSaco) || 0) / (Number(i.librasPorSaco) || 1), 4)
    }));

    const comprasRecientes = latest(listCompras, 10).map(c => ({
      fecha: c.fecha,
      tipo: c.tipo,
      sacos: Number(c.sacos) || 0,
      costoTotal: round(c.costoTotal),
      categoria: c.categoria || 'bodega'
    }));

    const inventarioMedicoResumen = listCatalogoMedico.map(item => {
      const entradas = listComprasMedicas.filter(c => c.productoId === item.id);
      const salidas = listUsosMedicos.filter(u => u.productoId === item.id);
      const comprado = entradas.reduce((sum, c) => sum + (Number(c.cantidad) || 0), 0);
      const usado = salidas.reduce((sum, u) => sum + (Number(u.cantidad) || 0), 0);
      const costoComprado = entradas.reduce((sum, c) => sum + (Number(c.costoTotal) || 0), 0);
      const stock = Math.max(0, comprado - usado);
      const proximoVencimiento = entradas
        .filter(c => c.vencimiento)
        .sort((a, b) => String(a.vencimiento).localeCompare(String(b.vencimiento)))[0]?.vencimiento || null;
      return {
        producto: item.nombre,
        categoria: item.categoria,
        unidad: item.unidad,
        stock: round(stock, 2),
        stockMinimo: Number(item.stockMinimo) || 0,
        costoPromedio: comprado > 0 ? round(costoComprado / comprado, 2) : 0,
        proximoVencimiento
      };
    });

    const movimientosMedicosRecientes = latest([
      ...listComprasMedicas.map(c => ({ tipo: 'entrada', fecha: c.fecha, producto: c.nombre, cantidad: c.cantidad, unidad: c.unidad, costo: c.costoTotal })),
      ...listUsosMedicos.map(u => ({ tipo: 'salida', fecha: u.fecha, producto: u.nombre, cantidad: u.cantidad, unidad: u.unidad, costo: u.costo, loteId: u.loteId }))
    ], 12);

    const ventasRecientes = latest(listVentasActivas, 10).map(v => {
      const lote = listLotes.find(l => l.id === v.loteId);
      const corral = listCorrales.find(c => c.id === lote?.corralId || c.id === v.corralId);
      return {
        fecha: v.fecha,
        corral: corral?.nombre || 'No identificado',
        loteId: v.loteId,
        cerdos: Number(v.cantidadCerdos) || 0,
        libras: round(saleWeightLb(v), 1),
        precioLb: round(v.precioLibra),
        total: round(v.totalVenta)
      };
    });

    const alertas = [];
    activos.forEach(lote => {
      // Solo se reporta la FCA cuando es confiable: un lote sin pesajes produce FCAs
      // de 30+ que no son un problema zootecnico sino un hueco de captura de datos.
      if (lote.pesosYProduccion.fcaEsConfiable && lote.pesosYProduccion.fca > 3) alertas.push({ severidad: 'alta', tipo: 'FCA alto', corral: lote.corral, detalle: `FCA ${lote.pesosYProduccion.fca}` });
      if (lote.pesosYProduccion.excedeCicloCompleto) alertas.push({ severidad: 'alta', tipo: 'Sobre-engorde', corral: lote.corral, detalle: `Ya consumió el ${lote.pesosYProduccion.consumoCicloPorcentaje}% del alimento de un ciclo completo (${lote.pesosYProduccion.consumoPorCerdoLb} lb/cerdo)` });
      if (lote.pesosYProduccion.pesajeVencido) alertas.push({ severidad: 'alta', tipo: 'Pesaje vencido', corral: lote.corral, detalle: `${lote.pesosYProduccion.diasSinPesaje} días sin pesar; el peso actual es una estimación` });
      if (lote.animales.mortalidadPorcentaje > 5) alertas.push({ severidad: 'alta', tipo: 'Mortalidad alta', corral: lote.corral, detalle: `${lote.animales.mortalidadPorcentaje}%` });
      if (lote.finanzas.utilidadNetaRealMasEstimada < 0) alertas.push({ severidad: 'media', tipo: 'Utilidad negativa', corral: lote.corral, detalle: formatearMoneda(lote.finanzas.utilidadNetaRealMasEstimada) });
      if (lote.parametrosIncompletos) alertas.push({ severidad: 'media', tipo: 'Parámetros sin configurar', corral: lote.corral, detalle: 'Falta precio de venta por libra o costo del lechón; la rentabilidad de este lote no es real' });
      if (lote.pesosYProduccion.pesoActualPromedioLb >= lote.proyecciones.pesoObjetivoLb) alertas.push({ severidad: 'media', tipo: 'Listo para venta', corral: lote.corral, detalle: `${lote.pesosYProduccion.pesoActualPromedioLb} lb promedio${lote.pesosYProduccion.pesoEsEstimadoPorConsumo ? ' (estimado)' : ''}` });
      if (lote.proyecciones.alimentoFaltanteLb > 0 && lote.proyecciones.costoAlimentoFaltante > 0) alertas.push({ severidad: 'baja', tipo: 'Alimento faltante proyectado', corral: lote.corral, detalle: `${lote.proyecciones.alimentoFaltanteLb} lb faltantes` });
    });
    ordenCompraLista.forEach(item => {
      alertas.push({ severidad: 'media', tipo: 'Compra sugerida', insumo: item.nombre, detalle: `${round(item.librasAComprarReal, 1)} lb / ${item.sacosAComprar} sacos` });
    });
    inventarioMedicoResumen.filter(item => item.stock <= item.stockMinimo).forEach(item => {
      alertas.push({ severidad: 'media', tipo: 'Stock médico bajo', insumo: item.producto, detalle: `${item.stock} ${item.unidad} disponibles` });
    });

    const rankings = {
      mejorFca: [...activos].filter(l => l.pesosYProduccion.fca > 0).sort((a, b) => a.pesosYProduccion.fca - b.pesosYProduccion.fca).slice(0, 3).map(l => ({ corral: l.corral, fca: l.pesosYProduccion.fca })),
      peorFca: [...activos].filter(l => l.pesosYProduccion.fca > 0).sort((a, b) => b.pesosYProduccion.fca - a.pesosYProduccion.fca).slice(0, 3).map(l => ({ corral: l.corral, fca: l.pesosYProduccion.fca })),
      mayorUtilidad: [...lotesConStats].sort((a, b) => b.finanzas.utilidadNetaRealMasEstimada - a.finanzas.utilidadNetaRealMasEstimada).slice(0, 5).map(l => ({ corral: l.corral, utilidad: l.finanzas.utilidadNetaRealMasEstimada, estado: l.estado })),
      menorUtilidad: [...lotesConStats].sort((a, b) => a.finanzas.utilidadNetaRealMasEstimada - b.finanzas.utilidadNetaRealMasEstimada).slice(0, 5).map(l => ({ corral: l.corral, utilidad: l.finanzas.utilidadNetaRealMasEstimada, estado: l.estado }))
    };

    return {
      generadoEn: new Date().toISOString(),
      moneda: 'GTQ',
      unidades: { peso: 'libras', alimento: 'libras', dinero: 'quetzales' },
      resumenEjecutivo: {
        corralesTotales: listCorrales.length,
        lotesTotales: listLotes.length,
        lotesActivos: activos.length,
        lotesCerrados: cerrados.length,
        animalesIniciales: totals.animalesIniciales,
        animalesVivos: totals.animalesVivos,
        animalesVendidos: totals.animalesVendidos,
        bajasTotales: totals.bajas,
        mortalidadGlobalPorcentaje: totals.animalesIniciales > 0 ? round((totals.bajas / totals.animalesIniciales) * 100, 1) : 0,
        librasVendidas: round(totals.librasVendidas, 1),
        pesoProducidoLb: round(totals.pesoProducidoLb, 1),
        fcaGlobalAproximado: totals.pesoProducidoLb > 0 ? round(totals.alimentoLb / totals.pesoProducidoLb, 3) : 0,
        costoTotal: round(totals.costoTotal),
        ingresosRealesVentas: round(totals.ingresoRealVentas),
        ingresosRealesMasEstimados: round(totals.ingresoTotal),
        utilidadNetaRealMasEstimada: round(totals.utilidadNeta),
        margenGlobalPorcentaje: totals.ingresoTotal > 0 ? round((totals.utilidadNeta / totals.ingresoTotal) * 100, 1) : 0
      },
      reglasDeInterpretacion: {
        fcaObjetivo: 'Mientras más bajo, mejor. Arriba de 3.0 requiere revisión de alimento, peso o desperdicio.',
        mortalidadAlerta: 'Arriba de 5% es alerta sanitaria/operativa.',
        utilidad: 'Separar ventas reales de valor estimado de animales vivos.',
        ventasParciales: 'Las ventas por báscula reducen inventario vivo pero sus libras vendidas sí cuentan para FCA, GMD e ingresos.'
      },
      lotes: lotesConStats,
      inventarioBodega: inventarioResumen,
      inventarioMedico: inventarioMedicoResumen,
      movimientosMedicosRecientes,
      ordenCompraSugerida: ordenCompraLista.map(item => ({
        insumo: item.nombre,
        faltanteGlobalLb: round(item.faltanteGlobal, 1),
        stockActualLb: round(item.invCentral, 1),
        librasAComprar: round(item.librasAComprarReal, 1),
        sacosAComprar: item.sacosAComprar,
        lbsPorSaco: item.lbsPorSaco
      })),
      ventasRecientes,
      comprasRecientes,
      alertas,
      rankings,
      configuracion: {
        factorSchaeffer: constanteSchaeffer,
        pesoAlertaMezclaLb: pesoAlertaMezcla,
        fasesAlimentacion: CRONOGRAMA_ALIMENTACION
      }
    };
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;

    // Agregar el mensaje del usuario a la vista
    const userMessage = { role: 'user', content: chatInput };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // 1. INYECCIÓN DE CONTEXTO AVANZADO EN TIEMPO REAL
      const contextoGranja = buildAdvancedFarmAiContext();

      const systemPrompt = `Eres el asesor técnico-financiero integrado en Porcicontrol. Tu especialidad es producción porcina, engorde, alimentación, sanidad operativa, inventario y rentabilidad de granjas pequeñas/medianas.

REGLAS ESTRICTAS:
1. Responde como asesor de la granja, no como chatbot genérico.
2. Usa SOLO los datos del JSON. Si falta un dato, dilo claramente y explica qué registro hace falta.
3. Da conclusiones accionables: qué revisar, qué comprar, qué lote vender, qué dato corregir o qué riesgo atender.
4. Separa análisis productivo, financiero, inventario y sanidad cuando aplique.
5. Usa métricas concretas: FCA, GMD, mortalidad, animales vivos, ventas por báscula, peso producido, utilidad, margen, costo por libra y punto de equilibrio.
6. Interpreta ventas parciales correctamente: reducen animales vivos, pero sus libras vendidas sí cuentan para producción, FCA/GMD e ingresos reales.
7. No des diagnósticos veterinarios definitivos. Si hay alerta sanitaria, sugiere revisar manejo y consultar veterinario.
8. Si el usuario pide una decisión, ordena opciones por impacto económico y riesgo.
9. Si detectas inconsistencias de datos, prioriza señalar la inconsistencia antes de recomendar.
10. Responde en español claro, directo y con Markdown. Evita relleno.

UMBRALES DE INTERPRETACIÓN:
- FCA menor a 2.5: bueno, si los datos de alimento/peso están completos.
- FCA 2.5 a 3.0: aceptable pero revisar eficiencia.
- FCA mayor a 3.0: alerta de conversión, desperdicio, subregistro de peso o sobreconsumo.
- Mortalidad mayor a 5%: alerta.
- Utilidad negativa: revisar precio de venta, costo de alimento, mortalidad y momento de venta.
- Inventario faltante: recomendar compra por insumo, libras y sacos.

MODO DE RESPUESTA:
- Para preguntas generales: empieza con un resumen corto y luego puntos accionables.
- Para preguntas de venta: compara peso, utilidad proyectada, animales vivos, ventas reales y punto de equilibrio.
- Para preguntas de alimento: cruza inventario, fase, consumo, faltante y costo.
- Para preguntas financieras: separa ventas reales de valor estimado de animales vivos.
- Para preguntas de "qué está mal": lista alertas priorizadas.

ESTADO ACTUAL DE LA GRANJA (JSON en tiempo real):
${JSON.stringify(contextoGranja)}`;

      // Formatear el historial para la API de Geministorial para la API de Gemini
      const geminiHistory = chatMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
      geminiHistory.push({
        role: 'user',
        parts: [{ text: userMessage.content }]
      });

      // 2. LLAMADA A GEMINI
      const directGeminiData = await askGeminiDirectly({ systemPrompt, contents: geminiHistory });
      let data = directGeminiData;

      if (!data) {
        const askAssistant = httpsCallable(cloudFunctions, 'askFarmAssistant');
        const result = await askAssistant({ systemPrompt, contents: geminiHistory });
        data = result.data;
      }

      // 3. GUARDAR RESPUESTA DEL BOT
      if (data.candidates && data.candidates.length > 0) {
        const botResponse = data.candidates[0].content.parts[0].text;
        setChatMessages((prev) => [...prev, { role: 'assistant', content: botResponse }]);
      } else {
        throw new Error("Respuesta inválida de la API");
      }

    } catch (error) {
      console.error("Error en chatbot:", error);
      setChatMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Lo siento, hubo un error al conectar con la IA. Verifica tu conexión o la API Key.'
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const vibrarCampo = (patron = 45) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(patron);
      } catch {
        // Algunos navegadores bloquean vibración sin gesto directo
      }
    }
  };

  // Función async para guardar peso (soporta peso individual o promedio de muestra multi-cerdo)
  const guardarPesoEnNube = async (pesoLb, fecha, metodo, extras = {}) => {
    try {
      setGuardandoPeso(true);
      const lote = getLoteActivo(corralSeleccionado?.id);

      if (!lote) {
        mostrarAlerta('Error', 'No hay lote activo en este corral');
        setGuardandoPeso(false);
        return false;
      }

      const nuevoPeso = {
        id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        loteId: lote.id,
        fecha: fecha,
        pesoPromedio: parseFloat(pesoLb),
        metodo: metodo,
        ...(extras.cantidadMuestra ? { cantidadMuestra: extras.cantidadMuestra } : {}),
        ...(Array.isArray(extras.muestraPesos) && extras.muestraPesos.length > 0
          ? {
              muestraPesos: extras.muestraPesos.map((m, idx) => ({
                numero: idx + 1,
                pesoLb: Number(m.pesoLb),
                metodo: m.metodo || metodo,
                ...(m.circunferenciaCm ? { circunferenciaCm: Number(m.circunferenciaCm) } : {}),
                ...(m.longitudCm ? { longitudCm: Number(m.longitudCm) } : {})
              }))
            }
          : {})
      };

      await setPesos(prev => [...safeArr(prev), nuevoPeso]);
      vibrarCampo(60);
      const sufijoMuestra = extras.cantidadMuestra > 1 ? ` · muestra de ${extras.cantidadMuestra} cerdos` : '';
      emitirNotificacionPush({
        tipo: 'peso',
        titulo: 'Peso registrado',
        descripcion: `${parseFloat(pesoLb).toFixed(2)} lb promedio · ${metodo}${sufijoMuestra}`,
        corralId: corralSeleccionado?.id || lote.corralId || '',
        corralNombre: corralSeleccionado?.nombre || listCorrales.find(c => c.id === lote.corralId)?.nombre || 'Corral',
        loteId: lote.id,
        loteNombre: lote.nombre || lote.raza || 'Lote activo',
        entidad: { tipo: 'peso', id: nuevoPeso.id }
      });
      mostrarAlerta('Éxito', `Peso registrado: ${parseFloat(pesoLb).toFixed(1)} lb (${metodo}${sufijoMuestra})`, 'success');
      setGuardandoPeso(false);
      return true;
    } catch (error) {
      console.error('Error guardando peso:', error);
      mostrarAlerta('Error', 'No se pudo guardar el peso');
      setGuardandoPeso(false);
      return false;
    }
  };

  const handleAgregarPesoDirectoAMuestra = () => {
    const peso = parseFloat(pesoIngresado);
    if (!peso || peso <= 0) {
      mostrarAlerta('Error', 'Ingresa un peso válido mayor a 0 lb para sumarlo a la muestra.');
      return;
    }
    setMuestraPesosCorral(prev => [
      ...prev,
      { id: crypto.randomUUID(), pesoLb: Number(peso.toFixed(1)), metodo: 'directo' }
    ]);
    vibrarCampo(40);
    setPesoIngresado('');
    pesoDirectoInputRef.current?.focus();
  };

  const handleAgregarSchaefferAMuestra = () => {
    if (!pesoSchaefferCalculado) {
      mostrarAlerta('Error', 'Completa Circunferencia y Longitud para sumar el cerdo a la muestra.');
      return;
    }
    setMuestraPesosCorral(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        pesoLb: Number(pesoSchaefferCalculado.toFixed(1)),
        metodo: 'schaeffer',
        circunferenciaCm: Number(circunferenciaCm),
        longitudCm: Number(longitudCm)
      }
    ]);
    vibrarCampo(40);
    setCircunferenciaCm('');
    setLongitudCm('');
    setPesoSchaefferCalculado(null);
    schaefferCircInputRef.current?.focus();
  };

  const handleGuardarPromedioMuestra = async () => {
    const resumen = resumirMuestraPesaje(muestraPesosCorral);
    if (resumen.cantidad === 0) return;
    const exito = await guardarPesoEnNube(resumen.promedioLb, fechaPesaje, resumen.metodoRegistro, {
      cantidadMuestra: resumen.cantidad,
      muestraPesos: muestraPesosCorral
    });
    if (exito) {
      setMuestraPesosCorral([]);
      setFechaPesaje(todayIso());
    }
  };

  const handleGuardarPesoDirecto = async (e) => {
    e.preventDefault();
    const peso = parseFloat(pesoIngresado);

    if (!peso || peso <= 0) {
      mostrarAlerta('Error', 'Ingresa un peso válido mayor a 0');
      return;
    }

    const exito = await guardarPesoEnNube(peso, fechaPesaje, 'directo');
    if (exito) {
      setPesoIngresado('');
      setFechaPesaje(todayIso());
    }
  };

  const handleGuardarPesoSchaeffer = async () => {
    if (!pesoSchaefferCalculado) {
      mostrarAlerta('Error', 'Completa Circunferencia y Longitud');
      return;
    }

    const exito = await guardarPesoEnNube(pesoSchaefferCalculado, fechaPesaje, 'schaeffer');
    if (exito) {
      setCircunferenciaCm('');
      setLongitudCm('');
      setPesoSchaefferCalculado(null);
      setExpandirSchaeffer(false);
      setFechaPesaje(todayIso());
    }
  };

  const getPrecioPorLibra = (nombre) => {
    const itemC = listCatAlimentos.find(c => c.nombre === nombre);
    if (itemC) return itemC.precioSaco / (itemC.librasPorSaco || 50);
    const itemI = listCatIngredientes.find(i => i.nombre === nombre);
    if (itemI) return itemI.precioSaco / (itemI.librasPorSaco || 100);
    return 0;
  };

  const getVentaLibras = (venta) => {
    if (Number(venta.totalLibras) > 0) return Number(venta.totalLibras);
    if (Array.isArray(venta.pesosVenta)) {
      return venta.pesosVenta.reduce((total, item) => total + (Number(typeof item === 'number' ? item : item?.peso) || 0), 0);
    }
    return (Number(venta.pesoPromedioLibras) || 0) * (Number(venta.cantidadCerdos) || 0);
  };

  // --- IMPRESIÓN PDF SEGURA ---
  const descargarPDF = async (elementoId, nombreArchivo) => {
    const element = document.getElementById(elementoId);
    if (!element) return;
    mostrarAlerta("Generando PDF", "El documento se está procesando. Por favor, espera...");
    const opt = elementoId === 'ficha-pdf'
      ? {
        margin: 0,
        filename: nombreArchivo,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      }
      : elementoId === 'reporte-financiero-global-pdf'
        ? {
          margin: [0.35, 0.35, 0.35, 0.35],
          filename: nombreArchivo,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', letterRendering: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], before: '.pdf-page-break-before', avoid: ['.pdf-avoid-break', 'tr', 'thead'] }
        }
        : { margin: 0.4, filename: nombreArchivo, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Error generando PDF:', error);
      mostrarAlerta('Error', 'No se pudo generar el PDF. Inténtalo nuevamente.');
    }
  };

  // --- MODALES Y ALERTAS ---
  const mostrarAlerta = (titulo, mensaje) => {
    setModalConfirm({ visible: true, tipo: 'alert', titulo, mensaje, onConfirm: () => setModalConfirm({ ...modalConfirm, visible: false }) });
  };

  const pedirConfirmacion = (titulo, mensaje, accion) => {
    setModalConfirm({ visible: true, tipo: 'confirm', titulo, mensaje, onConfirm: () => { accion(); setModalConfirm({ ...modalConfirm, visible: false }); } });
  };

  const ModalConfirmacion = () => {
    if (!modalConfirm.visible) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in duration-200">
          <div className={`flex items-center gap-3 mb-4 ${modalConfirm.tipo === 'alert' ? 'text-amber-500' : 'text-rose-600'}`}>
            <AlertTriangle size={28} />
            <h3 className="text-xl font-bold text-slate-800">{modalConfirm.titulo}</h3>
          </div>
          <p className="text-slate-600 mb-8 leading-relaxed">{modalConfirm.mensaje}</p>
          <div className="flex gap-3">
            {modalConfirm.tipo === 'confirm' && <button onClick={() => setModalConfirm({ ...modalConfirm, visible: false })} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">Cancelar</button>}
            <button onClick={modalConfirm.onConfirm} className={`flex-1 py-3 text-white font-bold rounded-xl transition-colors shadow-lg ${modalConfirm.tipo === 'alert' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'}`}>{modalConfirm.tipo === 'alert' ? 'Entendido' : 'Confirmar'}</button>
          </div>
        </div>
      </div>
    );
  };

  // --- LÓGICA CORE: CONSUMOS CON PROTECCIÓN ---
  const getConsumidoEnFase = (loteId, fase) => {
    return listAlimentos
      .filter(a => a.loteId === loteId && a.faseRegistro === fase.fase && !a.esSuplemento)
      .reduce((sum, a) => sum + (a.cantidadLb || 0), 0);
  };

  const getSuplementosEnFase = (loteId, faseNum) => {
    return listAlimentos
      .filter(a => a.loteId === loteId && a.faseRegistro === faseNum && a.esSuplemento)
      .reduce((acc, a) => {
        acc.lbs += (a.cantidadLb || 0);
        acc.costo += (a.costo || 0);
        return acc;
      }, { lbs: 0, costo: 0 });
  };

  const getAhorroFase = (loteId, faseNum, cantidadActual) => {
    const faseInfo = CRONOGRAMA_ALIMENTACION.find(f => f.fase === faseNum);
    if (!faseInfo) return null;
    const metaLbs = faseInfo.consumoTotalLb * cantidadActual;
    const consumidoTolvaLbs = getConsumidoEnFase(loteId, faseInfo);
    const sups = getSuplementosEnFase(loteId, faseNum);

    const lbsAhorradas = Math.max(0, metaLbs - consumidoTolvaLbs);
    const precioConc = getPrecioPorLibra(faseInfo.alimento);
    const valorAhorradoConc = lbsAhorradas * precioConc;
    const ahorroNeto = valorAhorradoConc - sups.costo;

    return { metaLbs, consumidoTolvaLbs, lbsAhorradas, valorAhorradoConc, costoSups: sups.costo, ahorroNeto };
  };

  // --- LÓGICA ERP: BODEGA CENTRAL UNIFICADA ---
  const inventarioCentral = useMemo(() => {
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
  }, [listCompras, listAlimentos, listCatAlimentos, listCatIngredientes]);

  const inventarioMedico = useMemo(() => {
    return listCatalogoMedico.map(item => {
      const entradas = listComprasMedicas.filter(c => c.productoId === item.id);
      const salidas = listUsosMedicos.filter(u => u.productoId === item.id);
      const cantidadComprada = entradas.reduce((sum, c) => sum + (Number(c.cantidad) || 0), 0);
      const costoComprado = entradas.reduce((sum, c) => sum + (Number(c.costoTotal) || 0), 0);
      const cantidadUsada = salidas.reduce((sum, u) => sum + (Number(u.cantidad) || 0), 0);
      const costoUsado = salidas.reduce((sum, u) => sum + (Number(u.costo) || 0), 0);
      const stock = Math.max(0, cantidadComprada - cantidadUsada);
      const costoPromedio = cantidadComprada > 0 ? costoComprado / cantidadComprada : 0;
      const hoy = new Date(`${todayIso()}T00:00:00`);
      const vencimientos = entradas
        .filter(c => c.vencimiento && stock > 0)
        .map(c => {
          const diffDias = Math.ceil((new Date(`${c.vencimiento}T00:00:00`) - hoy) / 86_400_000);
          return { ...c, diffDias };
        })
        .sort((a, b) => a.diffDias - b.diffDias);
      const proximoVencimiento = vencimientos[0] || null;

      return {
        ...item,
        stock,
        cantidadComprada,
        cantidadUsada,
        costoPromedio,
        valorStock: Math.max(0, costoComprado - costoUsado),
        proximoVencimiento,
        bajoStock: stock <= (Number(item.stockMinimo) || 0)
      };
    });
  }, [listCatalogoMedico, listComprasMedicas, listUsosMedicos]);

  // Stock de insumos: lo comprado menos lo consumido por los corrales. El costo promedio
  // se recalcula con cada compra, igual que en la bodega médica.
  const inventarioInsumos = useMemo(() => listCatalogoInsumos.map(item => {
    const entradas = listComprasInsumos.filter(c => c.productoId === item.id);
    const salidas = listUsosInsumos.filter(u => u.productoId === item.id);
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
  }), [listCatalogoInsumos, listComprasInsumos, listUsosInsumos]);

  const handleAgregarInsumoCatalogo = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nombre = fd.get('nombre').trim();
    if (!nombre) return mostrarAlerta('Falta el nombre', 'Escribí cómo se llama el insumo.');
    if (listCatalogoInsumos.some(i => i.nombre.toLowerCase() === nombre.toLowerCase())) {
      return mostrarAlerta('Ya existe', `"${nombre}" ya está en el catálogo.`);
    }
    setCatalogoInsumos(prev => [...safeArr(prev, INITIAL_CATALOGO_INSUMOS), {
      id: crypto.randomUUID(),
      nombre,
      categoria: fd.get('categoria').trim() || 'General',
      unidad: fd.get('unidad').trim() || 'unidad',
      stockMinimo: parseFloat(fd.get('stockMinimo')) || 0
    }]);
    e.target.reset();
    mostrarAlerta('Insumo agregado', `"${nombre}" ya se puede comprar y asignar a corrales.`, 'success');
  };

  const handleEliminarInsumoCatalogo = (id) => {
    const tieneMovimientos = listComprasInsumos.some(c => c.productoId === id) || listUsosInsumos.some(u => u.productoId === id);
    if (tieneMovimientos) {
      return mostrarAlerta('No se puede eliminar', 'Este insumo ya tiene compras o consumos registrados. Borrarlo dejaría el historial sin referencia.');
    }
    pedirConfirmacion('Eliminar insumo', '¿Quitarlo del catálogo?', () => {
      setCatalogoInsumos(prev => safeArr(prev, INITIAL_CATALOGO_INSUMOS).filter(i => i.id !== id));
    });
  };

  const handleComprarInsumo = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const producto = listCatalogoInsumos.find(i => i.id === fd.get('productoId'));
    const cantidad = parseFloat(fd.get('cantidad')) || 0;
    const costoTotal = parseFloat(fd.get('costoTotal')) || 0;
    if (!producto || cantidad <= 0) return mostrarAlerta('Datos incompletos', 'Elegí el insumo y una cantidad mayor a cero.');

    const compraId = crypto.randomUUID();
    setComprasInsumos(prev => [...safeArr(prev), {
      id: compraId,
      productoId: producto.id,
      nombre: producto.nombre,
      unidad: producto.unidad,
      fecha: fd.get('fecha'),
      cantidad,
      costoTotal,
      proveedor: fd.get('proveedor').trim()
    }]);
    e.target.reset();
    emitirNotificacionPush({
      tipo: 'compra',
      titulo: 'Compra de insumo',
      descripcion: `${cantidad} ${producto.unidad} de ${producto.nombre} · ${formatearMoneda(costoTotal)}`,
      entidad: { tipo: 'compraInsumo', id: compraId }
    });
    mostrarAlerta('Compra registrada', `Entraron ${cantidad} ${producto.unidad} de ${producto.nombre} a la bodega.`, 'success');
  };

  // Consumir un insumo en un corral: descuenta stock y carga el costo al lote como
  // gasto operativo, para que la rentabilidad de ese lote lo refleje.
  const handleUsarInsumoEnCorral = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const producto = inventarioInsumos.find(i => i.id === fd.get('productoId'));
    const lote = listLotes.find(l => l.id === fd.get('loteId'));
    const cantidad = parseFloat(fd.get('cantidad')) || 0;
    if (!producto || !lote || cantidad <= 0) return mostrarAlerta('Datos incompletos', 'Elegí insumo, corral y una cantidad mayor a cero.');
    if (producto.stock < cantidad) {
      return mostrarAlerta('Stock insuficiente', `Solo quedan ${producto.stock.toFixed(2)} ${producto.unidad} de ${producto.nombre}.`);
    }

    const costo = cantidad * (producto.costoPromedio || 0);
    const usoId = crypto.randomUUID();
    const fecha = fd.get('fecha');
    const corral = listCorrales.find(c => c.id === lote.corralId);

    setUsosInsumos(prev => [...safeArr(prev), {
      id: usoId,
      productoId: producto.id,
      nombre: producto.nombre,
      unidad: producto.unidad,
      fecha,
      cantidad,
      costo,
      loteId: lote.id,
      observacion: fd.get('observacion').trim()
    }]);
    // El costo entra por el mismo canal que cualquier gasto operativo del lote.
    setGastosExtra(prev => [...safeArr(prev), {
      id: crypto.randomUUID(),
      loteId: lote.id,
      fecha,
      descripcion: `${producto.nombre} (${cantidad} ${producto.unidad})`,
      monto: costo,
      usoInsumoId: usoId
    }]);

    e.target.reset();
    mostrarAlerta(
      'Insumo aplicado',
      `${cantidad} ${producto.unidad} de ${producto.nombre} a ${corral?.nombre || 'el corral'} · ${formatearMoneda(costo)} cargados al lote.`,
      'success'
    );
  };

  const ordenCompraLista = useMemo(() => {
    const necesidadesGlobales = new Map();

    listLotes.filter(l => l.estado === 'Activo').forEach(lote => {
      const stats = calculateLotStatistics({
        lot: lote,
        deaths: listBajas,
        feedings: listAlimentos,
        sales: listVentasActivas,
        weights: listPesos,
        vaccines: listVacunas,
        extraExpenses: listGastosExtra,
        catalog: listCatAlimentos,
        mixAlertWeight: pesoAlertaMezcla
      });
      if (!stats) return;

      const faseCalculadaPorDias = CRONOGRAMA_ALIMENTACION.find(f => stats.diasLote >= f.diaInicio && stats.diasLote <= f.diaFin)?.fase || 7;
      const faseActualNum = lote.faseActual || faseCalculadaPorDias;
      const faseObj = CRONOGRAMA_ALIMENTACION.find(f => f.fase === faseActualNum) || CRONOGRAMA_ALIMENTACION[CRONOGRAMA_ALIMENTACION.length - 1];
      const formula = listFormulas.find(f => f.fase === faseActualNum);

      const totalLbsFase = faseObj.consumoTotalLb * stats.cantidadActual;
      let itemsRequeridos = [];
      if (formula && safeArr(formula.ingredientes).length > 0) {
        itemsRequeridos = safeArr(formula.ingredientes).map(ing => ({ nombre: ing.nombre, porcentaje: ing.porcentaje }));
      } else {
        itemsRequeridos = [{ nombre: faseObj.alimento, porcentaje: 100 }];
      }

      itemsRequeridos.forEach(req => {
        const metaItemLbs = totalLbsFase * (req.porcentaje / 100);
        const consumidoItemEnFase = listAlimentos.filter(a => a.loteId === lote.id && a.faseRegistro === faseActualNum).reduce((acc, a) => {
          if (!a.esSuplemento && a.tipo === req.nombre) return acc + (a.cantidadLb || 0);
          if (a.esSuplemento && Array.isArray(a.ingredientesUsados)) {
            const match = a.ingredientesUsados.find(u => u.nombre === req.nombre);
            if (match) return acc + (match.libras || 0);
          }
          return acc;
        }, 0);

        const pendienteConsumir = Math.max(0, metaItemLbs - consumidoItemEnFase);
        if (pendienteConsumir > 0) {
          const exist = necesidadesGlobales.get(req.nombre) || 0;
          necesidadesGlobales.set(req.nombre, exist + pendienteConsumir);
        }
      });
    });

    return Array.from(necesidadesGlobales.entries()).map(([nombre, faltanteGlobal]) => {
      const invCentral = inventarioCentral.find(i => i.nombre === nombre)?.stockLbs || 0;
      const librasAComprarReal = Math.max(0, faltanteGlobal - invCentral);
      const catItem = [...listCatAlimentos, ...listCatIngredientes].find(c => c.nombre === nombre);
      const lbsPorSaco = catItem?.librasPorSaco || 100;
      const sacosAComprar = Math.ceil(librasAComprarReal / lbsPorSaco);
      return { nombre, librasAComprarReal, sacosAComprar, invCentral, faltanteGlobal, lbsPorSaco };
    }).filter(item => item.sacosAComprar > 0);
  }, [listLotes, listBajas, listAlimentos, listVentasActivas, listPesos, listVacunas, listGastosExtra, inventarioCentral, listFormulas, listCatAlimentos, listCatIngredientes, pesoAlertaMezcla]);

  // --- ESTADÍSTICAS DEL LOTE ---
  function calcularEstadisticasLote(lote, muertesExtraHipoteticas = 0) {
    return calculateLotStatistics({
      lot: lote,
      deaths: listBajas,
      feedings: listAlimentos,
      sales: listVentasActivas,
      weights: listPesos,
      vaccines: listVacunas,
      extraExpenses: listGastosExtra,
      catalog: listCatAlimentos,
      extraProjectedDeaths: muertesExtraHipoteticas,
      mixAlertWeight: pesoAlertaMezcla
    });
  }

  const costoCalculadoPuro = useMemo(() => {
    const infoAlimento = listCatAlimentos.find(a => a.nombre === puroInput.tipo);
    const cantidad = parseFloat(puroInput.cantidad) || 0;
    if (!infoAlimento || cantidad <= 0) return 0;

    if (puroInput.unidad === 'sacos') {
      return cantidad * infoAlimento.precioSaco;
    } else {
      return cantidad * (infoAlimento.precioSaco / (infoAlimento.librasPorSaco || 50));
    }
  }, [puroInput, listCatAlimentos]);

  // --- HANDLERS COMUNES BLINDADOS ---
  const handleAgregarCorral = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await setCorrales(prev => [...safeArr(prev), { id: crypto.randomUUID(), nombre: fd.get('nombre').trim(), capacidad: parseInt(fd.get('capacidad'), 10) }]);
    e.target.reset();
  };

  const handleEliminarCorral = (id) => {
    if (getLoteActivo(id)) return mostrarAlerta("Corral en Uso", "No se puede eliminar un corral que tiene un lote activo.");
    pedirConfirmacion("Eliminar Corral", "¿Estás seguro de eliminar este corral? Esta acción no se puede deshacer.", () => {
      setCorrales(prev => safeArr(prev).filter(c => c.id !== id));
    });
  };

  const handleEliminarDato = (tipo, id) => {
    pedirConfirmacion("Eliminar Registro", "¿Deseas borrar este registro de forma permanente?", () => {
      if (tipo === 'alimento') setAlimentos(prev => safeArr(prev).filter(a => a.id !== id));
      if (tipo === 'peso') setPesos(prev => safeArr(prev).filter(p => p.id !== id));
      if (tipo === 'sanidad') setTareasSanidad(prev => safeArr(prev).filter(t => t.id !== id));
      if (tipo === 'vacuna') setVacunas(prev => safeArr(prev).filter(v => v.id !== id));
      if (tipo === 'gasto') setGastosExtra(prev => safeArr(prev).filter(g => g.id !== id));
      if (tipo === 'baja') setBajas(prev => safeArr(prev).filter(b => b.id !== id));
      if (tipo === 'bodega') setComprasBodega(prev => safeArr(prev).filter(b => b.id !== id));
      if (tipo === 'compraMedica') setComprasMedicas(prev => safeArr(prev).filter(b => b.id !== id));
      if (tipo === 'usoMedico') {
        setUsosMedicos(prev => safeArr(prev).filter(u => u.id !== id));
        setVacunas(prev => safeArr(prev).filter(v => v.usoMedicoId !== id));
      }
    });
  };

  const handleAgregarMedicamentoCatalogo = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nombre = fd.get('nombre').trim();
    if (!nombre) return;

    const nuevo = {
      id: crypto.randomUUID(),
      nombre,
      categoria: fd.get('categoria').trim() || 'Medicina',
      unidad: fd.get('unidad').trim() || 'unidad',
      stockMinimo: parseFloat(fd.get('stockMinimo')) || 0,
      diasAlertaVencimiento: parseInt(fd.get('diasAlertaVencimiento'), 10) || 30
    };

    setCatalogoMedico(prev => [...safeArr(prev), nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setMedicinaSeleccionadaId(nuevo.id);
    e.target.reset();
    mostrarAlerta('Medicamento agregado', 'El producto quedó disponible para compras y aplicaciones.');
  };

  const handleEliminarMedicamentoCatalogo = (id) => {
    const tieneMovimientos = listComprasMedicas.some(c => c.productoId === id) || listUsosMedicos.some(u => u.productoId === id);
    if (tieneMovimientos) return mostrarAlerta('Producto con historial', 'No se puede eliminar un medicamento que ya tiene compras o aplicaciones registradas.');
    pedirConfirmacion('Eliminar medicamento', '¿Deseas eliminar este producto del catálogo médico?', () => {
      setCatalogoMedico(prev => safeArr(prev).filter(m => m.id !== id));
      if (medicinaSeleccionadaId === id) setMedicinaSeleccionadaId(INITIAL_CATALOGO_MEDICO[0]?.id || '');
    });
  };

  const handleComprarMedicina = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const producto = listCatalogoMedico.find(m => m.id === fd.get('productoId'));
    const cantidad = parseFloat(fd.get('cantidad')) || 0;
    const costoTotal = parseFloat(fd.get('costoTotal')) || 0;
    if (!producto || cantidad <= 0 || costoTotal < 0) return mostrarAlerta('Error', 'Revisa producto, cantidad y costo.');

    const compraMedicaId = crypto.randomUUID();
    setComprasMedicas(prev => [...safeArr(prev), {
      id: compraMedicaId,
      productoId: producto.id,
      nombre: producto.nombre,
      categoria: producto.categoria,
      unidad: producto.unidad,
      fecha: fd.get('fecha'),
      cantidad,
      costoTotal,
      vencimiento: fd.get('vencimiento') || '',
      lote: fd.get('lote').trim(),
      proveedor: fd.get('proveedor').trim()
    }]);
    e.target.reset();
    emitirNotificacionPush({
      tipo: 'medicina',
      titulo: 'Compra médica registrada',
      descripcion: `${producto.nombre} · ${cantidad} ${producto.unidad} · ${formatearMoneda(costoTotal)}`,
      detalle: fd.get('vencimiento') ? `Vence: ${fd.get('vencimiento')}` : '',
      entidad: { tipo: 'compraMedica', id: compraMedicaId }
    });
    mostrarAlerta('Compra médica registrada', 'La bodega médica fue actualizada.');
  };

  const handleAplicarMedicina = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const productoId = fd.get('productoId');
    const loteId = fd.get('loteId');
    const producto = inventarioMedico.find(m => m.id === productoId);
    const lote = listLotes.find(l => l.id === loteId);
    const cantidad = parseFloat(fd.get('cantidad')) || 0;
    if (!producto || !lote || cantidad <= 0) return mostrarAlerta('Error', 'Revisa producto, lote y cantidad aplicada.');
    if (producto.stock < cantidad) return mostrarAlerta('Stock insuficiente', `Solo tienes ${producto.stock.toFixed(2)} ${producto.unidad} de ${producto.nombre}.`);

    const costo = cantidad * (producto.costoPromedio || 0);
    const usoId = crypto.randomUUID();
    const registroUso = {
      id: usoId,
      productoId: producto.id,
      nombre: producto.nombre,
      categoria: producto.categoria,
      unidad: producto.unidad,
      fecha: fd.get('fecha'),
      cantidad,
      costo,
      loteId,
      tareaId: fd.get('tareaId') || '',
      observacion: fd.get('observacion').trim()
    };

    setUsosMedicos(prev => [...safeArr(prev), registroUso]);
    setVacunas(prev => [...safeArr(prev), {
      id: crypto.randomUUID(),
      loteId,
      fecha: registroUso.fecha,
      nombre: `${producto.nombre} (${cantidad} ${producto.unidad})`,
      costo,
      usoMedicoId: usoId
    }]);

    if (registroUso.tareaId) {
      handleActualizarTareaSanidad(registroUso.tareaId, {
        estado: 'hecho',
        observacion: registroUso.observacion || `Aplicado: ${producto.nombre}`
      });
    }

    e.target.reset();
    setMedicinaSeleccionadaId(producto.id);
    emitirNotificacionPush({
      tipo: 'sanidad',
      titulo: 'Tratamiento aplicado',
      descripcion: `${producto.nombre} · ${cantidad} ${producto.unidad} · ${formatearMoneda(costo)}`,
      detalle: registroUso.observacion || '',
      corralId: lote.corralId || '',
      corralNombre: listCorrales.find(c => c.id === lote.corralId)?.nombre || 'Corral',
      loteId: lote.id,
      loteNombre: lote.nombre || lote.raza || 'Lote activo',
      entidad: { tipo: 'usoMedico', id: usoId },
      severidad: 'critical',
      visibleMs: CRITICAL_NOTIFICATION_VISIBLE_MS
    });
    mostrarAlerta('Aplicación registrada', 'Se descontó de bodega médica y se sumó el costo al lote.');
  };

  // Tratamiento desde el corral. Si el producto sale de la farmacia descuenta el stock y
  // calcula el costo al promedio; si es algo que no está en bodega, se registra a mano.
  const handleRegistrarTratamientoManual = (e) => {
    e.preventDefault();
    const loteActivo = getLoteActivo(corralSeleccionado?.id);
    if (!loteActivo) return mostrarAlerta('Error', 'No hay lote activo para registrar el tratamiento.');

    const fd = new FormData(e.target);
    const productoId = fd.get('productoId');
    const producto = productoId ? inventarioMedico.find(m => m.id === productoId) : null;
    const tratamientoId = crypto.randomUUID();
    const fecha = fd.get('fecha');

    let nombre;
    let costo;
    let usoMedicoId = null;

    if (producto) {
      const cantidad = parseFloat(fd.get('cantidad')) || 0;
      if (cantidad <= 0) return mostrarAlerta('Falta la cantidad', `¿Cuántos ${producto.unidad} de ${producto.nombre} aplicaste?`);
      if (producto.stock < cantidad) {
        return mostrarAlerta('Stock insuficiente', `Solo quedan ${producto.stock.toFixed(2)} ${producto.unidad} de ${producto.nombre} en la farmacia.`);
      }
      nombre = `${producto.nombre} (${cantidad} ${producto.unidad})`;
      costo = cantidad * (producto.costoPromedio || 0);
      usoMedicoId = crypto.randomUUID();
      setUsosMedicos(prev => [...safeArr(prev), {
        id: usoMedicoId,
        productoId: producto.id,
        nombre: producto.nombre,
        categoria: producto.categoria,
        unidad: producto.unidad,
        fecha,
        cantidad,
        costo,
        loteId: loteActivo.id,
        tareaId: '',
        observacion: 'Aplicado desde el corral'
      }]);
    } else {
      nombre = fd.get('nombre').trim();
      costo = parseFloat(fd.get('costo')) || 0;
      if (!nombre) return mostrarAlerta('Falta el nombre', 'Escribí qué se aplicó.');
    }

    setVacunas(prev => [...safeArr(prev), {
      id: tratamientoId,
      loteId: loteActivo.id,
      fecha,
      nombre,
      costo,
      usoMedicoId
    }]);
    emitirNotificacionPush({
      tipo: 'sanidad',
      titulo: 'Tratamiento registrado',
      descripcion: `${nombre} · ${formatearMoneda(costo)}`,
      corralId: corralSeleccionado?.id || loteActivo.corralId || '',
      corralNombre: corralSeleccionado?.nombre || listCorrales.find(c => c.id === loteActivo.corralId)?.nombre || 'Corral',
      loteId: loteActivo.id,
      loteNombre: loteActivo.nombre || loteActivo.raza || 'Lote activo',
      entidad: { tipo: 'vacuna', id: tratamientoId },
      severidad: 'critical',
      visibleMs: CRITICAL_NOTIFICATION_VISIBLE_MS
    });
    e.target.reset();
  };

  const handleRegistrarBaja = (e) => {
    e.preventDefault();
    const loteActivo = getLoteActivo(corralSeleccionado?.id);
    if (!loteActivo) return mostrarAlerta('Error', 'No hay lote activo para registrar la baja.');

    const fd = new FormData(e.target);
    const cant = parseInt(fd.get('cantidad'), 10);
    const stats = calcularEstadisticasLote(loteActivo);
    if (cant <= 0 || cant > stats.cantidadActual) return mostrarAlerta("Error", "La baja debe ser mayor a cero y no superar los cerdos vivos.");

    const bajaId = crypto.randomUUID();
    const causa = fd.get('causa');
    setBajas(prev => [...safeArr(prev), {
      id: bajaId,
      loteId: loteActivo.id,
      fecha: fd.get('fecha'),
      causa,
      cantidad: cant
    }]);
    emitirNotificacionPush({
      tipo: 'baja',
      titulo: 'Baja registrada',
      descripcion: `${cant} cerdo${cant === 1 ? '' : 's'} · ${causa}`,
      corralId: corralSeleccionado?.id || loteActivo.corralId || '',
      corralNombre: corralSeleccionado?.nombre || listCorrales.find(c => c.id === loteActivo.corralId)?.nombre || 'Corral',
      loteId: loteActivo.id,
      loteNombre: loteActivo.nombre || loteActivo.raza || 'Lote activo',
      entidad: { tipo: 'baja', id: bajaId },
      severidad: 'critical',
      visibleMs: CRITICAL_NOTIFICATION_VISIBLE_MS
    });
    e.target.reset();
  };

  const handleActualizarTareaSanidad = (id, updates) => {
    const tarea = safeArr(listTareasSanidad).find(t => t.id === id);
    const nextEstadoPrevio = updates.estado || tarea?.estado || 'pendiente';

    // La 2a dosis de Innosure no se puede registrar antes del minimo de 2 semanas.
    if (tarea?.innosureDosis === 2 && nextEstadoPrevio === 'hecho') {
      const lote = listLotes.find(l => l.id === tarea.loteId);
      const plan = lote ? getPlanInnosure(lote) : null;
      const fechaPropuesta = updates.completadoEn || tarea.completadoEn || todayIso();
      const validacion = validarFechaDosis({
        numero: 2,
        fecha: fechaPropuesta,
        fechaPrimeraDosis: plan?.primeraDosis?.fechaReal || null
      });
      if (!validacion.valida) {
        return mostrarAlerta('No se puede registrar la 2ª dosis', validacion.mensaje);
      }
    }

    setTareasSanidad(prev => safeArr(prev).map(t => {
      if (t.id !== id) return t;
      const nextEstado = updates.estado || t.estado || 'pendiente';
      return {
        ...t,
        ...updates,
        completadoEn: nextEstado === 'hecho' ? (updates.completadoEn || t.completadoEn || todayIso()) : null
      };
    }));
  };

  const construirTarea = (lote, t, dia, extra = {}) => ({
    id: crypto.randomUUID(),
    protocoloId: t.id,
    loteId: lote.id,
    dia,
    fechaObjetivo: addDaysToIsoDate(lote.fechaIngreso, dia),
    rango: t.rango || `Día ${dia}`,
    tarea: t.tarea,
    tipo: t.tipo || 'Sanidad',
    categoria: t.categoria || (TIPOS_SIN_MEDICAMENTO.includes(t.tipo) ? 'manejo' : 'medicamento'),
    claseMedicamento: t.claseMedicamento || claseDeMedicamento(t),
    producto: t.producto || '',
    productoMedicoId: t.productoMedicoId || '',
    pesoEsperado: t.pesoEsperado || '',
    duracion: t.duracion || '',
    condicion: t.condicion || '',
    nota: t.nota || '',
    estado: 'pendiente',
    observacion: '',
    completadoEn: null,
    ...extra
  });

  const buildTareasProtocoloParaLote = (lote) => {
    const base = listProtocoloSanitario.map((t) => construirTarea(lote, t, Number(t.dia) || 0));

    // Innosure solo para lotes con machos sin capar.
    const composicion = composicionLote(lote);
    if (composicion.machosEnteros <= 0) return base;

    const plan = INNOSURE_PLANS[Number(lote.planInnosure)] || INNOSURE_PLANS[PLAN_INNOSURE_POR_DEFECTO];
    const dias = { 1: plan.primeraDosisDia, 2: plan.segundaDosisDia };
    const dosis = PROTOCOLO_INNOSURE.map((t) => construirTarea(lote, t, dias[t.innosureDosis], {
      innosureDosis: t.innosureDosis,
      rango: `Semana ${Math.round(dias[t.innosureDosis] / 7)}`,
      producto: `${t.producto} (${composicion.machosEnteros} animales)`
    }));

    return [...base, ...dosis];
  };

  // El desglose por sexo describe a los animales vivos hoy, no al lote de ingreso.
  const getPlanInnosure = (lote) => calcularPlanInnosure({
    lote,
    tareas: listTareasSanidad,
    totalVivos: calcularEstadisticasLote(lote)?.cantidadActual ?? null
  });

  // Permite fijar la composicion por sexo de un lote que ya esta en marcha y regenerar
  // las dosis de Innosure sin tocar el resto del protocolo ni lo ya aplicado.
  const handleGuardarComposicion = async (lote, e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const machos = Math.max(0, parseInt(fd.get('machos'), 10) || 0);
    const hembras = Math.max(0, parseInt(fd.get('hembras'), 10) || 0);
    const machosCapados = Math.min(machos, Math.max(0, parseInt(fd.get('machosCapados'), 10) || 0));
    const planInnosure = Number(fd.get('planInnosure')) || PLAN_INNOSURE_POR_DEFECTO;

    const vivos = calcularEstadisticasLote(lote)?.cantidadActual ?? lote.cantidad;
    if (machos + hembras !== vivos) {
      return mostrarAlerta('Revisá la composición', `Registraste ${machos} machos y ${hembras} hembras (${machos + hembras}), pero en este corral hay ${vivos} cerdos vivos.`);
    }

    const loteActualizado = { ...lote, machos, hembras, machosCapados, planInnosure };
    const machosEnteros = machos - machosCapados;
    const plan = INNOSURE_PLANS[planInnosure] || INNOSURE_PLANS[PLAN_INNOSURE_POR_DEFECTO];
    const dias = { 1: plan.primeraDosisDia, 2: plan.segundaDosisDia };

    // Las dosis ya aplicadas no se pisan; solo se reprograman las pendientes.
    const aplicadas = safeArr(listTareasSanidad).filter(t => t.loteId === lote.id && t.innosureDosis && t.estado === 'hecho');
    const nuevasDosis = machosEnteros > 0
      ? PROTOCOLO_INNOSURE
        .filter(t => !aplicadas.some(a => Number(a.innosureDosis) === t.innosureDosis))
        .map(t => construirTarea(loteActualizado, t, dias[t.innosureDosis], {
          innosureDosis: t.innosureDosis,
          rango: `Semana ${Math.round(dias[t.innosureDosis] / 7)}`,
          producto: `${t.producto} (${machosEnteros} animales)`
        }))
      : [];

    try {
      await runFarmUpdates({
        agro_lotes: current => safeArr(current).map(l => l.id === lote.id ? loteActualizado : l),
        agro_tareassanidad: current => [
          ...safeArr(current).filter(t => !(t.loteId === lote.id && t.innosureDosis && t.estado !== 'hecho')),
          ...nuevasDosis
        ]
      });
      mostrarAlerta(
        'Composición guardada',
        machosEnteros > 0
          ? `${machosEnteros} machos enteros. Se programaron las dosis de Innosure del plan de ${planInnosure} semanas.`
          : 'Sin machos enteros: este lote no necesita Innosure.',
        'success'
      );
    } catch (error) {
      console.error('Error guardando composición:', error);
      mostrarAlerta('Error', 'No se pudo guardar la composición del lote.');
    }
  };

  // Registrar una dosis con su fecha REAL, que puede ser muy anterior a hoy. Sin esto,
  // marcar una dosis aplicada con atraso le pone la fecha de hoy y corre la venta.
  const guardarDosisInnosure = (lote, numero, fecha, { aplicada }) => {
    if (!lote || !fecha) return mostrarAlerta('Falta la fecha', 'Elegí la fecha en que se aplicó la dosis.');

    const plan = getPlanInnosure(lote);
    if (aplicada) {
      const validacion = validarFechaDosis({
        numero,
        fecha,
        fechaPrimeraDosis: numero === 2 ? plan.primeraDosis?.fechaReal : null
      });
      if (!validacion.valida) return mostrarAlerta('No se puede registrar esa fecha', validacion.mensaje);
    }

    const dia = Math.max(0, Math.round(
      ((parseLocalDate(fecha) || new Date()) - (parseLocalDate(lote.fechaIngreso) || new Date())) / 86400000
    ));

    setTareasSanidad(prev => {
      const lista = safeArr(prev);
      const existente = lista.find(t => t.loteId === lote.id && Number(t.innosureDosis) === numero);
      const parche = {
        dia,
        fechaObjetivo: fecha,
        rango: `Semana ${Math.round(dia / 7)}`,
        estado: aplicada ? 'hecho' : 'pendiente',
        completadoEn: aplicada ? fecha : null
      };

      if (existente) return lista.map(t => t.id === existente.id ? { ...t, ...parche } : t);

      const base = PROTOCOLO_INNOSURE.find(p => p.innosureDosis === numero);
      return [...lista, construirTarea(lote, base, dia, { innosureDosis: numero, ...parche })];
    });

    mostrarAlerta(
      aplicada ? 'Dosis registrada' : 'Fecha reprogramada',
      aplicada
        ? `${numero}ª dosis de Innosure aplicada el ${fecha}.`
        : `La ${numero}ª dosis queda programada para el ${fecha}.`,
      'success'
    );
  };

  const desmarcarDosisInnosure = (lote, numero) => {
    pedirConfirmacion('Desmarcar dosis', `¿Marcar la ${numero}ª dosis como pendiente otra vez? Se borra la fecha de aplicación registrada.`, () => {
      setTareasSanidad(prev => safeArr(prev).map(t => (
        t.loteId === lote.id && Number(t.innosureDosis) === numero
          ? { ...t, estado: 'pendiente', completadoEn: null }
          : t
      )));
    });
  };

  // Reemplaza las dosis teóricas que generó la app por las fechas reales del plan de
  // corrales. Solo toca las dosis de Innosure de esos corrales; el resto queda igual.
  const handleImportarInnosureDelExcel = () => {
    const previstas = [];
    for (const fila of IMPORTACION_INNOSURE_EXCEL) {
      const corral = listCorrales.find(c => c.nombre === fila.corral);
      const lote = corral && listLotes.find(l => l.corralId === corral.id && l.estado === 'Activo');
      if (!lote) continue;
      fila.dosis.forEach((d, i) => previstas.push({ lote, numero: i + 1, ...d }));
    }

    if (previstas.length === 0) {
      return mostrarAlerta('Sin corrales que importar', 'No se encontraron lotes activos para los corrales del plan.');
    }

    const aplicadas = previstas.filter(p => p.aplicada).length;
    pedirConfirmacion(
      'Importar fechas del plan de corrales',
      `Se van a escribir ${previstas.length} dosis de Innosure en ${new Set(previstas.map(p => p.lote.id)).size} corrales (${aplicadas} ya aplicadas y ${previstas.length - aplicadas} pendientes). Reemplaza las fechas teóricas que generó la app. No toca ningún otro registro.`,
      () => {
        setTareasSanidad(prev => {
          const lista = safeArr(prev);
          const idsAfectados = new Set(previstas.map(p => p.lote.id));
          // Se conserva todo menos las dosis de Innosure de los corrales importados.
          const resto = lista.filter(t => !(t.innosureDosis && idsAfectados.has(t.loteId)));

          const nuevas = previstas.map(({ lote, numero, fecha, aplicada }) => {
            const anterior = lista.find(t => t.loteId === lote.id && Number(t.innosureDosis) === numero);
            const dia = Math.max(0, Math.round(
              ((parseLocalDate(fecha) || new Date()) - (parseLocalDate(lote.fechaIngreso) || new Date())) / 86400000
            ));
            const base = PROTOCOLO_INNOSURE.find(p => p.innosureDosis === numero);
            return {
              ...construirTarea(lote, base, dia, { innosureDosis: numero }),
              // Se reutiliza el id anterior para no dejar huérfano ningún registro ligado.
              id: anterior?.id || crypto.randomUUID(),
              fechaObjetivo: fecha,
              rango: `Semana ${Math.round(dia / 7)}`,
              estado: aplicada ? 'hecho' : 'pendiente',
              completadoEn: aplicada ? fecha : null,
              observacion: anterior?.observacion || ''
            };
          });

          return [...resto, ...nuevas];
        });

        mostrarAlerta('Fechas importadas', `${previstas.length} dosis actualizadas con las fechas reales del plan de corrales.`, 'success');
      }
    );
  };

  const renderDosisInnosure = (lote, dosis) => {
    const fmtCorto = (f) => f ? new Date(`${f}T00:00:00`).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const valorPorDefecto = dosis.fechaReal || dosis.fechaProyectada || dosis.fechaSugerida || todayIso();

    return (
      <div key={dosis.numero} className={`border rounded-xl p-3.5 ${dosis.aplicada ? 'bg-emerald-50/50 border-emerald-200' : dosis.vencida ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-slate-100'}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{dosis.numero}ª dosis</p>
          {dosis.aplicada
            ? <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded">Aplicada</span>
            : dosis.vencida
              ? <span className="text-[9px] font-black uppercase text-rose-700 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded">{dosis.diasDeAtraso}d tarde</span>
              : <span className="text-[9px] font-black uppercase text-slate-400">Pendiente</span>}
        </div>

        <p className={`font-extrabold text-sm mt-1 ${dosis.aplicada ? 'text-emerald-700' : 'text-slate-800'}`}>
          {fmtCorto(dosis.fechaReal || dosis.fechaProyectada || dosis.fechaSugerida)}
        </p>
        {!dosis.aplicada && dosis.fechaMinima && (
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">No antes del {fmtCorto(dosis.fechaMinima)}</p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            guardarDosisInnosure(lote, dosis.numero, fd.get('fecha'), { aplicada: e.nativeEvent.submitter?.value === 'aplicada' });
          }}
          className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2"
        >
          <input type="date" name="fecha" defaultValue={valorPorDefecto} key={valorPorDefecto} className="w-full p-2 border border-slate-200 rounded-lg bg-white text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
          <div className="flex gap-1.5">
            {dosis.aplicada ? (
              <>
                <button type="submit" value="aplicada" className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-colors">Corregir fecha</button>
                <button type="button" onClick={() => desmarcarDosisInnosure(lote, dosis.numero)} className="px-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-rose-500 rounded-lg text-[10px] transition-colors" title="Marcar como pendiente">✕</button>
              </>
            ) : (
              <>
                <button type="submit" value="aplicada" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-colors">Registrar aplicada</button>
                <button type="submit" value="programada" className="px-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold rounded-lg text-[10px] transition-colors" title="Solo cambiar la fecha programada">Reprogramar</button>
              </>
            )}
          </div>
        </form>
      </div>
    );
  };

  const renderComposicionLote = (lote) => {
    if (!lote) return null;
    const plan = getPlanInnosure(lote);
    const fmt = (f) => f ? new Date(`${f}T00:00:00`).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    return (
      <div className={`p-5 rounded-2xl border shadow-sm mb-2 ${plan.sexoRegistrado ? 'bg-indigo-50/30 border-indigo-100' : 'bg-amber-50/40 border-amber-200'}`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-1.5"><Syringe size={18} className="text-indigo-600" /> Composición del lote e Innosure</h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-relaxed">
              {plan.sexoRegistrado
                ? 'Solo los machos sin capar necesitan Innosure.'
                : 'Registrá cuántos son machos y hembras para que la app pueda programar el Innosure de este lote.'}
            </p>
          </div>
          {plan.aplica && (
            <span className={`text-[9px] font-black uppercase tracking-wider border px-2.5 py-1 rounded-lg shrink-0 ${plan.puedeVender ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
              {plan.puedeVender ? 'Venta habilitada' : 'Venta bloqueada'}
            </span>
          )}
        </div>

        <form onSubmit={(e) => handleGuardarComposicion(lote, e)} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end font-semibold">
          <div>
            <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1 text-[9px]">Machos</label>
            <input type="number" name="machos" min="0" defaultValue={lote.machos || 0} className="w-full p-2.5 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold" />
          </div>
          <div>
            <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1 text-[9px]">Hembras</label>
            <input type="number" name="hembras" min="0" defaultValue={lote.hembras || 0} className="w-full p-2.5 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold" />
          </div>
          <div>
            <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1 text-[9px]">Capados</label>
            <input type="number" name="machosCapados" min="0" defaultValue={lote.machosCapados || 0} className="w-full p-2.5 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold" />
          </div>
          <div>
            <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1 text-[9px]">Plan</label>
            <select name="planInnosure" defaultValue={lote.planInnosure || PLAN_INNOSURE_POR_DEFECTO} className="w-full p-2.5 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold">
              <option value={22}>22 semanas</option>
              <option value={20}>20 semanas</option>
            </select>
          </div>
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl transition-colors uppercase tracking-wider text-[10px] shadow-md">Guardar</button>
        </form>
        <p className="text-[10px] text-slate-400 font-medium mt-2">Deben sumar los {plan.total} cerdos vivos que hay hoy en el corral. Las dosis ya aplicadas no se reprograman.</p>

        {plan.aplica && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-indigo-100">
            {[plan.primeraDosis, plan.segundaDosis].map((dosis) => renderDosisInnosure(lote, dosis))}
            <div className={`border rounded-xl p-3 ${plan.puedeVender ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Salida proyectada</p>
              <p className={`font-extrabold text-xs mt-1 ${plan.puedeVender ? 'text-emerald-700' : 'text-rose-700'}`}>
                {plan.puedeVender ? 'Habilitada ya' : fmt(plan.salidaSugerida)}
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-snug">
                {plan.puedeVender
                  ? 'Se cumplieron las 3 semanas'
                  : plan.diasParaPoderVender > 0
                    ? `Faltan ${plan.diasParaPoderVender} días`
                    : 'Según las dosis proyectadas'}
              </p>
              {plan.diasDeAtrasoSalida > 0 && (
                <p className="text-[10px] text-rose-700 font-bold mt-1.5 pt-1.5 border-t border-rose-200/60 leading-snug">
                  {plan.diasDeAtrasoSalida} días después del plan ({fmt(plan.salidaTeorica)})
                </p>
              )}
            </div>
          </div>
        )}

        {plan.aplica && plan.modoFlexible && (
          <p className="text-[11px] text-amber-800 bg-amber-100/70 border border-amber-200 rounded-lg px-3 py-2 mt-3 font-medium leading-relaxed">
            <strong>Lote atrasado.</strong> Se está usando el plan flexible de <strong>3 semanas entre dosis</strong> en vez de las 6 del estándar, para no correr más la salida.
            Confirmalo con tu veterinario para este producto. El mínimo absoluto sigue siendo 2 semanas entre dosis y 3 semanas de la 2ª a la venta.
          </p>
        )}

        {plan.descuadreSexo && (
          <p className="text-[11px] text-amber-800 bg-amber-100/70 border border-amber-200 rounded-lg px-3 py-2 mt-3 font-medium">
            El desglose por sexo suma {plan.machos + plan.hembras} pero hoy hay {plan.total} cerdos vivos en el corral.
          </p>
        )}
      </div>
    );
  };

  // Sincronizacion NO destructiva: agrega lo que falta, reprograma lo pendiente y limpia
  // lo huerfano, pero jamas borra ni mueve una tarea ya aplicada. Las fechas reales de
  // las dosis de Innosure son las que habilitan la venta: perderlas no es una opcion.
  const aplicarSincronizacionProtocolo = (lotes, { silencioso = false, pasos = null } = {}) => {
    const objetivo = safeArr(lotes).filter(Boolean);
    if (objetivo.length === 0) return;

    // `pasos` se pasa explicito cuando se acaba de editar el protocolo: el estado de
    // React todavia no refleja el cambio en este tick.
    const pasosVigentes = pasos || listProtocoloSanitario;

    const planes = objetivo.map(lote => ({
      lote,
      plan: planificarSincronizacion({
        lote,
        pasosProtocolo: pasosVigentes,
        tareasActuales: listTareasSanidad,
        totalVivos: calcularEstadisticasLote(lote)?.cantidadActual ?? null
      })
    }));

    const totales = planes.reduce((acc, { plan }) => ({
      agregadas: acc.agregadas + plan.agregar.length,
      reprogramadas: acc.reprogramadas + plan.reprogramar.length,
      eliminadas: acc.eliminadas + plan.eliminar.length,
      conservadas: acc.conservadas + plan.conservar.filter(t => t.estado === 'hecho').length
    }), { agregadas: 0, reprogramadas: 0, eliminadas: 0, conservadas: 0 });

    if (totales.agregadas === 0 && totales.reprogramadas === 0 && totales.eliminadas === 0) {
      if (!silencioso) mostrarAlerta('Todo al día', 'El calendario sanitario ya refleja el protocolo vigente.', 'success');
      return;
    }

    const idsAEliminar = new Set(planes.flatMap(({ plan }) => plan.eliminar.map(t => t.id)));
    const reprogramaciones = new Map(
      planes.flatMap(({ plan }) => plan.reprogramar.map(r => [r.tarea.id, r]))
    );

    const nuevas = planes.flatMap(({ lote, plan }) => plan.agregar.map(item => {
      if (item.innosureDosis) {
        const base = PROTOCOLO_INNOSURE.find(p => p.innosureDosis === item.innosureDosis);
        return construirTarea(lote, base, item.dia, {
          innosureDosis: item.innosureDosis,
          rango: `Semana ${Math.round(item.dia / 7)}`,
          producto: `${base.producto} (${item.machosEnteros} animales)`
        });
      }
      return construirTarea(lote, item.paso, item.dia);
    }));

    setTareasSanidad(prev => [
      ...safeArr(prev)
        .filter(t => !idsAEliminar.has(t.id))
        .map(t => {
          const cambio = reprogramaciones.get(t.id);
          return cambio ? { ...t, dia: cambio.dia, fechaObjetivo: cambio.fechaObjetivo } : t;
        }),
      ...nuevas
    ]);

    if (!silencioso) {
      const partes = [
        totales.agregadas > 0 && `${totales.agregadas} tarea${totales.agregadas === 1 ? '' : 's'} agregada${totales.agregadas === 1 ? '' : 's'}`,
        totales.reprogramadas > 0 && `${totales.reprogramadas} reprogramada${totales.reprogramadas === 1 ? '' : 's'}`,
        totales.eliminadas > 0 && `${totales.eliminadas} huérfana${totales.eliminadas === 1 ? '' : 's'} eliminada${totales.eliminadas === 1 ? '' : 's'}`
      ].filter(Boolean);
      mostrarAlerta(
        'Calendario sanitario actualizado',
        `${partes.join(', ')}. Las ${totales.conservadas} tareas ya aplicadas quedaron intactas.`,
        'success'
      );
    }
  };

  const handleSincronizarProtocoloLote = (lote) => aplicarSincronizacionProtocolo([lote]);

  // --- ACCIONES DE HOY ---
  // Junta en una sola lista todo lo que hay que hacer, ordenado por urgencia y por plata.
  // Cada accion sabe a que pantalla llevar, para que desde el galpon sea un solo toque.
  const accionesDeHoy = useMemo(() => {
    const hoy = todayIso();
    const acciones = [];
    const diasHasta = (fecha) => {
      const d = parseLocalDate(fecha);
      const h = parseLocalDate(hoy);
      return (d && h) ? Math.round((d - h) / 86400000) : null;
    };

    const irA = (corral, tab) => () => {
      setCorralSeleccionado(corral);
      setTabActiva(tab);
      setVista('corralDetail');
      setIsSidebarOpen(false);
    };

    for (const lote of listLotes.filter(l => l.estado === 'Activo')) {
      const corral = listCorrales.find(c => c.id === lote.corralId);
      if (!corral) continue;
      const nombre = corral.nombre;
      const stats = calcularEstadisticasLote(lote);
      const plan = getPlanInnosure(lote);
      if (!stats) continue;

      // 1. Vender: el lote ya esta en peso y sanitariamente habilitado.
      const enPeso = stats.pesoParaProyeccion >= stats.pesoObjetivoLb || stats.excedeCicloCompleto;
      if (enPeso && plan.puedeVender) {
        acciones.push({
          id: `vender_${lote.id}`, grupo: 'atrasado', prioridad: 1, icono: '💰', corral: nombre,
          titulo: 'Listo para vender',
          detalle: `${stats.cantidadActual} cerdos · ${formatPesoLb(stats)} · ${stats.consumoCicloPorcentaje.toFixed(0)}% del ciclo consumido`,
          nota: stats.excedeCicloCompleto ? 'Cada día extra es alimento perdido' : null,
          accion: irA(corral, 'finanzas'), etiqueta: 'Ver finanzas'
        });
      }

      // 2. Dosis de Innosure vencidas o proximas.
      if (plan.aplica) {
        [plan.primeraDosis, plan.segundaDosis].forEach(dosis => {
          if (!dosis || dosis.aplicada) return;
          if (dosis.numero === 2 && !dosis.habilitada) return;
          const fecha = dosis.fechaReal || dosis.fechaSugerida;
          const dias = diasHasta(fecha);
          if (dias === null || dias > 7) return;
          acciones.push({
            id: `dosis_${lote.id}_${dosis.numero}`,
            grupo: dias < 0 ? 'atrasado' : dias === 0 ? 'hoy' : 'semana',
            prioridad: 2, icono: '🔵', corral: nombre,
            titulo: `${dosis.numero}ª dosis de Innosure`,
            detalle: dias < 0 ? `Tocaba hace ${Math.abs(dias)} días (${fecha})` : dias === 0 ? 'Toca hoy' : `En ${dias} días (${fecha})`,
            nota: dosis.numero === 2 ? 'La venta se habilita 3 semanas después' : null,
            accion: irA(corral, 'sanidad'), etiqueta: 'Registrar'
          });
        });
      }

      // 3. Pesaje vencido: sin pesar no hay proyeccion confiable.
      if (stats.pesajeVencido) {
        acciones.push({
          id: `pesar_${lote.id}`,
          grupo: stats.diasSinPesaje > 45 ? 'atrasado' : 'semana',
          prioridad: 3, icono: '⚖️', corral: nombre,
          titulo: 'Pesar el lote',
          detalle: stats.sinPesajes ? 'Nunca se ha pesado' : `${stats.diasSinPesaje} días sin pesar · se estima ${formatPesoLb(stats)}`,
          accion: irA(corral, 'peso'), etiqueta: 'Registrar peso'
        });
      }

      // 4. Sobre-engorde sin poder vender todavia: hay que apurar el tramite sanitario.
      if (stats.excedeCicloCompleto && !plan.puedeVender) {
        acciones.push({
          id: `sobre_${lote.id}`, grupo: 'atrasado', prioridad: 1, icono: '⚠️', corral: nombre,
          titulo: 'Sobre-engorde con venta bloqueada',
          detalle: `${stats.consumoCicloPorcentaje.toFixed(0)}% del ciclo consumido`,
          nota: plan.motivoBloqueo,
          accion: irA(corral, 'sanidad'), etiqueta: 'Ver Innosure'
        });
      }

      // 5. Parametros de negocio sin configurar.
      if (stats.parametrosIncompletos) {
        acciones.push({
          id: `param_${lote.id}`, grupo: 'semana', prioridad: 5, icono: '⚙️', corral: nombre,
          titulo: 'Faltan precio y costo',
          detalle: 'Sin estos datos la rentabilidad de este lote no significa nada',
          accion: irA(corral, 'finanzas'), etiqueta: 'Configurar'
        });
      }
    }

    // 6. Tareas del protocolo vencidas o de hoy.
    for (const tarea of safeArr(listTareasSanidad)) {
      if ((tarea.estado || 'pendiente') !== 'pendiente' || tarea.innosureDosis) continue;
      const lote = listLotes.find(l => l.id === tarea.loteId);
      if (!lote || lote.estado !== 'Activo') continue;
      const corral = listCorrales.find(c => c.id === lote.corralId);
      const dias = diasHasta(tarea.fechaObjetivo);
      if (dias === null || dias > 7) continue;
      acciones.push({
        id: `tarea_${tarea.id}`,
        grupo: dias < 0 ? 'atrasado' : dias === 0 ? 'hoy' : 'semana',
        prioridad: 4, icono: CLASES_MEDICAMENTO[claseDeMedicamento(tarea)]?.emoji || '🩺',
        corral: corral?.nombre || 'Corral', titulo: tarea.tarea,
        detalle: dias < 0 ? `Atrasada ${Math.abs(dias)} días` : dias === 0 ? 'Toca hoy' : `En ${dias} días`,
        nota: tarea.pesoEsperado ? `Peso esperado: ${tarea.pesoEsperado}` : null,
        accionRapida: () => handleActualizarTareaSanidad(tarea.id, { estado: 'hecho' }),
        accion: corral ? irA(corral, 'sanidad') : null, etiqueta: 'Marcar hecha'
      });
    }

    const orden = { atrasado: 0, hoy: 1, semana: 2 };
    return acciones.sort((a, b) =>
      (orden[a.grupo] - orden[b.grupo]) || (a.prioridad - b.prioridad) || a.corral.localeCompare(b.corral)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listLotes, listCorrales, listTareasSanidad, listBajas, listAlimentos, listVentasActivas, listPesos, listVacunas, listGastosExtra]);

  // Corrales activos a los que les falta alguna tarea del protocolo. En vez de un boton
  // abstracto de "sincronizar", el calendario muestra exactamente qué falta.
  const corralesSinCalendario = useMemo(() => listLotes
    .filter(l => l.estado === 'Activo')
    .map(lote => {
      const plan = planificarSincronizacion({
        lote,
        pasosProtocolo: listProtocoloSanitario,
        tareasActuales: listTareasSanidad,
        totalVivos: calcularEstadisticasLote(lote)?.cantidadActual ?? null
      });
      if (plan.sinCambios) return null;
      return {
        lote,
        nombre: listCorrales.find(c => c.id === lote.corralId)?.nombre || 'Corral',
        faltan: plan.agregar.length,
        sobran: plan.eliminar.length
      };
    })
    .filter(Boolean),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [listLotes, listTareasSanidad, listCorrales, listProtocoloSanitario]);

  const handleGenerarCalendariosFaltantes = () => {
    aplicarSincronizacionProtocolo(corralesSinCalendario.map(c => c.lote));
  };


  const handleAgregarEventoCalendario = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const titulo = fd.get('titulo').trim();
    const fecha = fd.get('fecha');
    if (!titulo || !fecha) return;
    setEventosCalendario(prev => [...safeArr(prev), {
      id: crypto.randomUUID(),
      titulo,
      fecha,
      corralId: fd.get('corralId') || '',
      nota: fd.get('nota').trim(),
      creadoEn: Date.now()
    }]);
    e.target.reset();
  };

  const handleEliminarEventoCalendario = (id) => {
    setEventosCalendario(prev => safeArr(prev).filter(ev => ev.id !== id));
  };

  const handleActualizarMetaSuplemento = (loteId, faseNum, porcentajeStr) => {
    const porc = parseFloat(porcentajeStr);
    setLotes(prev => safeArr(prev).map(l => {
      if (l.id !== loteId) return l;
      return {
        ...l,
        metasSuplementos: {
          ...(l.metasSuplementos || {}),
          [faseNum]: isNaN(porc) ? '' : porc
        }
      };
    }));
  };

  // --- CATÁLOGOS Y FÓRMULAS ---
  const handleAgregarAlimentoCatalogo = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nuevo = { id: crypto.randomUUID(), nombre: fd.get('nombre').trim().toUpperCase(), precioSaco: parseFloat(fd.get('precio')), librasPorSaco: parseFloat(fd.get('libras')) };
    setCatalogoAlimento(prev => [...safeArr(prev), nuevo]);
    e.target.reset();
    mostrarAlerta("Éxito", "Nuevo producto agregado al catálogo de concentrados.");
  };

  const handleEliminarAlimentoCatalogo = (id) => {
    pedirConfirmacion("Eliminar del Catálogo", "¿Estás seguro de eliminar este producto? Desaparecerá de las opciones.", () => { setCatalogoAlimento(prev => safeArr(prev).filter(item => item.id !== id)); });
  };

  const handleAgregarIngredienteCatalogo = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nuevo = { id: crypto.randomUUID(), nombre: fd.get('nombre').trim().toUpperCase(), precioSaco: parseFloat(fd.get('precio')), librasPorSaco: parseFloat(fd.get('libras')) };
    setCatalogoIngredientes(prev => [...safeArr(prev), nuevo]);
    e.target.reset();
    mostrarAlerta("Éxito", "Nuevo ingrediente extra agregado al catálogo.");
  };

  const handleEliminarIngredienteCatalogo = (id) => {
    pedirConfirmacion("Eliminar Ingrediente", "¿Estás seguro de eliminar este ingrediente de tu catálogo?", () => { setCatalogoIngredientes(prev => safeArr(prev).filter(item => item.id !== id)); });
  };

  const handleAgregarReglaMezcla = (e) => {
    e.preventDefault();
    setReglasMezcla(prev => [...safeArr(prev), { id: crypto.randomUUID(), base: formReglaBase, aditivo: formReglaAditivo, factor: parseFloat(formReglaFactor) }]);
    mostrarAlerta("Regla Agregada", "El aditivo se calculará automáticamente en el formulador.");
  };

  const handleEliminarReglaMezcla = (id) => {
    setReglasMezcla(prev => safeArr(prev).filter(r => r.id !== id));
  };

  const handleAgregarIngredienteFormula = (e) => {
    e.preventDefault();
    if (!formIngrediente || !formPorcentaje) return mostrarAlerta("Error", "Selecciona un ingrediente y un porcentaje.");
    setFormulasEtapas(prev => safeArr(prev).map(f => {
      if (f.fase !== faseFormEdicion) return f;
      if (safeArr(f.ingredientes).find(i => i.nombre === formIngrediente)) return f;
      return { ...f, ingredientes: [...safeArr(f.ingredientes), { nombre: formIngrediente, porcentaje: parseFloat(formPorcentaje) }] };
    }));
    setFormIngrediente(''); setFormPorcentaje('');
  };

  const handleEliminarIngredienteFormula = (faseNum, nombreIng) => {
    setFormulasEtapas(prev => safeArr(prev).map(f => {
      if (f.fase !== faseNum) return f;
      return { ...f, ingredientes: safeArr(f.ingredientes).filter(i => i.nombre !== nombreIng) };
    }));
  };

  // --- MOTOR DEL CALENDARIO ACORDEÓN ---
  const getFasesDinamicas = (lote) => {
    if (!lote) return [];
    let fasesResult = [];
    let currentDate = new Date((lote.fechaIngreso || todayIso()) + 'T00:00:00');
    const hFases = safeArr(lote.historialFases);
    const faseActualLote = lote.faseActual || 1;

    CRONOGRAMA_ALIMENTACION.forEach((faseBase) => {
      const idealDuracion = faseBase.diaFin - faseBase.diaInicio + 1;
      let fInicio, fFin;

      const historialMatch = hFases.find(h => h.fase === faseBase.fase);

      if (historialMatch && faseBase.fase <= faseActualLote) {
        fInicio = new Date(historialMatch.fechaInicio + 'T00:00:00');
      } else {
        fInicio = new Date(currentDate);
      }

      fFin = new Date(fInicio);
      fFin.setDate(fFin.getDate() + idealDuracion - 1);

      currentDate = new Date(fFin);
      currentDate.setDate(currentDate.getDate() + 1);

      fasesResult.push({
        ...faseBase,
        fechaInicioCalc: fInicio,
        fechaFinCalc: fFin,
        idealDuracion,
        estado: faseActualLote > faseBase.fase ? 'pasada' : (faseActualLote === faseBase.fase ? 'actual' : 'futuro')
      });
    });
    return fasesResult;
  };

  // --- GESTIÓN DE LOTES ---
  const handleIngresoLote = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const fechaIng = fd.get('fechaIngreso');
    const cantidad = parseInt(fd.get('cantidad'), 10);
    const machos = Math.max(0, parseInt(fd.get('machos'), 10) || 0);
    const hembras = Math.max(0, parseInt(fd.get('hembras'), 10) || 0);
    const machosCapados = Math.min(machos, Math.max(0, parseInt(fd.get('machosCapados'), 10) || 0));

    if (machos + hembras > 0 && machos + hembras !== cantidad) {
      return mostrarAlerta('Revisá la composición', `Registraste ${machos} machos y ${hembras} hembras (${machos + hembras}), pero el lote es de ${cantidad} cerdos.`);
    }

    const nl = {
      id: crypto.randomUUID(),
      corralId: corralSeleccionado.id,
      fechaIngreso: fechaIng,
      cantidad,
      raza: fd.get('raza'),
      machos,
      hembras,
      machosCapados,
      planInnosure: Number(fd.get('planInnosure')) || PLAN_INNOSURE_POR_DEFECTO,
      estado: 'Activo',
      costoLechon: 0,
      precioVentaLibra: 0,
      manoObra: 0,
      faseActual: 1,
      historialFases: [{ fase: 1, fechaInicio: fechaIng }],
      metasSuplementos: {}
    };

    const initialWeight = parseFloat(fd.get('pesoInicial'));
    const tareasHeredadas = buildTareasProtocoloParaLote(nl);
    try {
      await runFarmUpdates({
        agro_lotes: current => [...safeArr(current), nl],
        agro_pesos: current => initialWeight > 0
          ? [...safeArr(current), { id: crypto.randomUUID(), loteId: nl.id, fecha: fechaIng, pesoPromedio: initialWeight }]
          : safeArr(current),
        agro_tareassanidad: current => [...safeArr(current), ...tareasHeredadas]
      });
      setIngresoMachos(0);
      setTabActiva('resumen');
    } catch (error) {
      console.error('Error creando lote:', error);
      mostrarAlerta('Error', 'No se pudo crear el lote. No se guardaron cambios parciales.');
    }
  };

  const handleEliminarLoteActivo = () => {
    pedirConfirmacion("Anular Lote", "¿Estás seguro de eliminar este lote completo? Se borrarán sus animales, registros de alimentos y pesos.", async () => {
      const loteActivo = getLoteActivo(corralSeleccionado.id);
      if (!loteActivo) return;
      try {
        await runFarmUpdates({
          agro_lotes: current => safeArr(current).filter(l => l.id !== loteActivo.id),
          agro_alimentos: current => safeArr(current).filter(a => a.loteId !== loteActivo.id),
          agro_pesos: current => safeArr(current).filter(p => p.loteId !== loteActivo.id),
          agro_vacunas: current => safeArr(current).filter(v => v.loteId !== loteActivo.id),
          agro_bajas: current => safeArr(current).filter(b => b.loteId !== loteActivo.id),
          agro_gastosextra: current => safeArr(current).filter(g => g.loteId !== loteActivo.id),
          agro_tareassanidad: current => safeArr(current).filter(t => t.loteId !== loteActivo.id)
        });
        setVista('dashboard');
      } catch (error) {
        console.error('Error eliminando lote:', error);
        mostrarAlerta('Error', 'No se pudo eliminar el lote. No se aplicaron cambios parciales.');
      }
    });
  };

  const handleEliminarLoteHistorial = (id) => {
    pedirConfirmacion("Eliminar del Historial", "¿Estás seguro de borrar este lote permanentemente? Se perderán las estadísticas de esta venta.", () => {
      setLotes(prev => safeArr(prev).filter(l => l.id !== id));
      setVista('historial');
    });
  };

  // --- MOTOR DE ALIMENTACIÓN Y SUPLEMENTOS ---
  const handleGuardarTolva = async (e) => {
    e.preventDefault();
    const loteActivo = getLoteActivo(corralSeleccionado.id);
    if (!loteActivo) return;

    const fd = new FormData(e.target);
    const faseDestinoSeleccionada = parseInt(fd.get('faseDestino'), 10);

    // El cálculo vive en el dominio y es el mismo que usa el lector QR: antes
    // había dos copias con criterios de stock distintos (una con tolerancia de
    // redondeo y otra sin ella), así que surtir exactamente lo disponible fallaba
    // por un flujo y pasaba por el otro.
    const calculo = calcularDescuentoTolva({
      tipoAlimento: puroInput.tipo,
      cantidad: puroInput.cantidad,
      unidad: puroInput.unidad,
      faseDestino: faseDestinoSeleccionada,
      fecha: fd.get('fecha'),
      loteActivo,
      catalogoAlimento: listCatAlimentos,
      inventarioCentral,
      origenRegistro: 'manual'
    });

    if (!calculo.ok) {
      return mostrarAlerta(
        calculo.codigoError === 'STOCK_INSUFICIENTE' ? 'Stock Insuficiente' : 'Error',
        calculo.error
      );
    }

    const alimentoId = crypto.randomUUID();
    try {
      await setAlimentos(prev => [...safeArr(prev), {
        id: alimentoId,
        ...calculo.registro
      }]);
    } catch {
      return mostrarAlerta('Error', 'No se pudo guardar el registro en la nube. Revisa tu conexión y vuelve a intentarlo: la bodega no fue modificada.');
    }

    setPuroInput({ ...puroInput, cantidad: '' });
    emitirNotificacionPush({
      tipo: 'alimento',
      titulo: 'Alimento registrado',
      descripcion: `${puroInput.tipo} · ${calculo.librasSuministradas.toFixed(1)} lb · ${formatearMoneda(calculo.costoTotal)}`,
      detalle: `Fase ${faseDestinoSeleccionada}`,
      corralId: corralSeleccionado?.id || loteActivo.corralId || '',
      corralNombre: corralSeleccionado?.nombre || listCorrales.find(c => c.id === loteActivo.corralId)?.nombre || 'Corral',
      loteId: loteActivo.id,
      loteNombre: loteActivo.nombre || loteActivo.raza || 'Lote activo',
      entidad: { tipo: 'alimento', id: alimentoId }
    });
    mostrarAlerta("Tolva Llenada", "El concentrado ha sido descontado de la bodega central y el presupuesto avanzó.");
  };

  // --- MOTOR QR TOLVA (OPCIÓN 1: QR PEGADO EN CADA CORRAL) ---
  const detenerCamaraQr = React.useCallback(() => {
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach(track => track.stop());
      qrStreamRef.current = null;
    }
    qrPistaVideoRef.current = null;
    if (qrVideoRef.current) {
      qrVideoRef.current.srcObject = null;
    }
    qrControlRepetidoRef.current.reiniciar();
    setQrCamaraEstado('inactiva');
    setQrLinternaDisponible(false);
    setQrLinternaActiva(false);
    setQrMotorLector('');
  }, []);

  // La linterna del teléfono es la diferencia entre leer y no leer un rótulo
  // dentro de un galpón al atardecer. Solo Chrome/Android expone `torch`.
  const alternarLinternaQr = React.useCallback(async () => {
    const pista = qrPistaVideoRef.current;
    if (!pista) return;
    const encender = !qrLinternaActiva;
    try {
      await pista.applyConstraints({ advanced: [{ torch: encender }] });
      setQrLinternaActiva(encender);
    } catch {
      setQrLinternaDisponible(false);
      setQrLinternaActiva(false);
    }
  }, [qrLinternaActiva]);

  const prepararCorralEnModalQr = React.useCallback((corral) => {
    if (!corral) return;
    detenerCamaraQr();
    const loteActivo = listLotes.find(l => l.corralId === corral.id && l.estado === 'Activo') || null;
    const stats = loteActivo ? calculateLotStatistics({
      lot: loteActivo,
      deaths: listBajas,
      feedings: listAlimentos,
      sales: listVentasActivas,
      weights: listPesos,
      vaccines: listVacunas,
      extraExpenses: listGastosExtra,
      catalog: listCatAlimentos,
      mixAlertWeight: pesoAlertaMezcla
    }) : null;
    const ctx = resolverContextoTolvaQr({
      corral,
      loteActivo,
      stats,
      cronograma: CRONOGRAMA_ALIMENTACION,
      catalogoAlimento: listCatAlimentos,
      inventarioCentral
    });

    setQrCorralDetectado(corral);
    setQrErrorMensaje('');
    setQrExitoReciente(null);
    setQrCodigoManual('');

    // Siempre se reinicia el formulario: si no, al escanear un corral vacío
    // quedaban a la vista el concentrado y la cantidad del corral anterior.
    setQrCantidad('1');
    setQrUnidad('sacos');
    setQrFecha(todayIso());
    setQrFaseDestino(ctx.tieneLoteActivo ? ctx.faseActual : 1);
    setQrTipoAlimento(ctx.tieneLoteActivo ? ctx.alimentoSugerido : '');
  }, [detenerCamaraQr, listLotes, listBajas, listAlimentos, listVentasActivas, listPesos, listVacunas, listGastosExtra, listCatAlimentos, pesoAlertaMezcla, inventarioCentral]);

  const abrirModalQrTolva = (corralPreseleccionado = null, modo = 'escanear') => {
    setQrErrorMensaje('');
    setQrCamaraError('');
    setQrCamaraReintentable(false);
    setQrExitoReciente(null);
    setQrUltimoDescuentoRonda(null);
    setQrCodigoManual('');
    setQrModalModo(modo);
    setQrModalAbierto(true);
    if (corralPreseleccionado && corralPreseleccionado.id) {
      prepararCorralEnModalQr(corralPreseleccionado);
    } else {
      setQrCorralDetectado(null);
    }
  };

  const cerrarModalQrTolva = React.useCallback(() => {
    detenerCamaraQr();
    setQrModalAbierto(false);
    setQrCorralDetectado(null);
    setQrErrorMensaje('');
    setQrCamaraError('');
    setQrExitoReciente(null);
    setQrUltimoDescuentoRonda(null);
  }, [detenerCamaraQr]);

  const irACorralDesdeQr = (corral, tab = 'resumen') => {
    if (!corral) return;
    cerrarModalQrTolva();
    setCorralSeleccionado(corral);
    setTabActiva(tab);
    setVista('corralDetail');
  };

  // --- NAVEGACIÓN MÓVIL CON BOTÓN FÍSICO "ATRÁS" (HISTORY API) ---
  const restaurandoHistorialRef = React.useRef(false);
  const ultimoEstadoNavRef = React.useRef(null);
  const listCorralesRef = React.useRef(listCorrales);
  useEffect(() => {
    listCorralesRef.current = listCorrales;
  }, [listCorrales]);

  useEffect(() => {
    if (!isAppReady) return;
    const actual = construirEstadoNavegacion({
      vista,
      corralId: corralSeleccionado?.id || null,
      tabActiva,
      qrModalAbierto,
      isChatOpen
    });

    if (!ultimoEstadoNavRef.current) {
      ultimoEstadoNavRef.current = actual;
      window.history.replaceState(actual, '');
      return;
    }

    if (restaurandoHistorialRef.current) {
      restaurandoHistorialRef.current = false;
      ultimoEstadoNavRef.current = actual;
      return;
    }

    if (!sonEstadosNavegacionIguales(ultimoEstadoNavRef.current, actual)) {
      ultimoEstadoNavRef.current = actual;
      window.history.pushState(actual, '');
    }
  }, [isAppReady, vista, corralSeleccionado?.id, tabActiva, qrModalAbierto, isChatOpen]);

  useEffect(() => {
    const manejarBotonAtras = (evento) => {
      const estado = evento.state;
      if (!estado || !estado.porciNav) return;

      restaurandoHistorialRef.current = true;
      setIsSidebarOpen(false);
      setModalConfirm(prev => (prev.visible ? { ...prev, visible: false } : prev));

      if (!estado.qrModalAbierto) {
        detenerCamaraQr();
        setQrModalAbierto(false);
        setQrCorralDetectado(null);
        setQrExitoReciente(null);
        setQrUltimoDescuentoRonda(null);
      } else {
        setQrModalAbierto(true);
      }

      setIsChatOpen(Boolean(estado.isChatOpen));
      setVista(estado.vista || 'hoy');
      setTabActiva(estado.tabActiva || 'resumen');

      if (estado.corralId) {
        const encontrado = listCorralesRef.current.find(c => c.id === estado.corralId) || null;
        setCorralSeleccionado(encontrado);
      } else {
        setCorralSeleccionado(null);
      }
    };

    window.addEventListener('popstate', manejarBotonAtras);
    return () => window.removeEventListener('popstate', manejarBotonAtras);
  }, [detenerCamaraQr]);

  const procesarTextoQrEscaneado = React.useCallback((rawText, { vibrar = false } = {}) => {
    const res = parseCorralQrPayload(rawText, listCorrales);
    if (!res.ok) {
      setQrErrorMensaje(res.error);
      return false;
    }
    // Confirmación táctil: en el galpón el operario no mira la pantalla mientras
    // encuadra el rótulo, así sabe que ya leyó sin tener que acercarse el teléfono.
    if (vibrar && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(60);
    }
    setQrUltimoDescuentoRonda(null);
    prepararCorralEnModalQr(res.corral);
    return true;
  }, [listCorrales, prepararCorralEnModalQr]);

  // Puente estable hacia la última versión de la callback, para que el efecto de
  // la cámara no se vuelva a montar cuando cambia el estado compartido.
  useEffect(() => {
    qrProcesarRef.current = procesarTextoQrEscaneado;
  }, [procesarTextoQrEscaneado]);

  // Si el operario escanea el QR físico con la cámara nativa del celular (?qrCorral=<id>)
  // o usa el atajo de pantalla de inicio PWA (?accion=escanearQr o ?vista=hoy),
  // abrimos directo el flujo correspondiente.
  useEffect(() => {
    if (!isAppReady || qrUrlProcesadoRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const paramCorral = params.get('qrCorral') || params.get('corralId');
    const paramAccion = params.get('accion');
    const paramVista = params.get('vista');

    if (!paramCorral && !paramAccion && !paramVista) return;
    qrUrlProcesadoRef.current = true;

    if (paramAccion === 'escanearQr') {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('accion');
      window.history.replaceState(window.history.state, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
      setQrModalModo('escanear');
      setQrModalAbierto(true);
      setQrCorralDetectado(null);
      return;
    }

    if (paramVista && ['hoy', 'dashboard', 'bodega', 'calendario', 'finanzasGlobales', 'historial', 'config'].includes(paramVista)) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('vista');
      window.history.replaceState(window.history.state, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
      setVista(paramVista);
      return;
    }

    if (!paramCorral) return;
    const res = parseCorralQrPayload(paramCorral, listCorrales);

    // El parámetro se limpia solo si resolvió: si el rótulo trae un corral que ya
    // no existe, recargar la página vuelve a intentarlo en lugar de perder el dato.
    if (res.ok) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('qrCorral');
      cleanUrl.searchParams.delete('corralId');
      window.history.replaceState(window.history.state, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    }

    setQrModalModo('escanear');
    setQrModalAbierto(true);
    if (res.ok) {
      prepararCorralEnModalQr(res.corral);
    } else {
      setQrErrorMensaje(res.error);
    }
  }, [isAppReady, listCorrales, prepararCorralEnModalQr]);

  // Dibuja el cuadro actual del video (o una imagen) reducido en un lienzo y
  // devuelve sus píxeles. Es la entrada que necesita el decodificador empaquetado.
  const extraerPixelesQr = React.useCallback((fuente, anchoFuente, altoFuente) => {
    const medida = calcularTamanoCaptura({ ancho: anchoFuente, alto: altoFuente });
    if (!medida) return null;

    if (!qrLienzoRef.current) {
      qrLienzoRef.current = document.createElement('canvas');
    }
    const lienzo = qrLienzoRef.current;
    lienzo.width = medida.ancho;
    lienzo.height = medida.alto;

    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(fuente, 0, 0, medida.ancho, medida.alto);
    return ctx.getImageData(0, 0, medida.ancho, medida.alto);
  }, []);

  // Safari (todo iOS) y Firefox no tienen `BarcodeDetector`. Antes la cámara se
  // abría y nunca decodificaba nada: vista en vivo, mira de escaneo animada y
  // cero lecturas, sin un solo mensaje. Aquí se carga jsQR a demanda como
  // respaldo, así que el lector funciona en cualquier navegador moderno.
  const cargarDecodificadorRespaldo = React.useCallback(async () => {
    const modulo = await import('jsqr');
    return modulo.default || modulo;
  }, []);

  // Ciclo de vida de la cámara trasera cuando el modal está en vista de escaneo
  useEffect(() => {
    const debeActivarCamara = qrModalAbierto && qrModalModo === 'escanear' && !qrCorralDetectado && !qrExitoReciente;
    if (!debeActivarCamara) {
      detenerCamaraQr();
      return undefined;
    }

    let cancelado = false;
    let siguienteCuadro = null;

    const reportarFallo = (error) => {
      const diagnostico = describirErrorCamara({
        error,
        soportaMediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
        contextoSeguro: window.isSecureContext !== false
      });
      setQrCamaraEstado('error');
      setQrCamaraError(diagnostico.mensaje);
      setQrCamaraReintentable(diagnostico.reintentable);
      return diagnostico;
    };

    const iniciar = async () => {
      setQrCamaraEstado('iniciando');
      setQrCamaraError('');
      setQrCamaraReintentable(false);
      qrControlRepetidoRef.current.reiniciar();

      if (!navigator.mediaDevices?.getUserMedia || window.isSecureContext === false) {
        reportarFallo(null);
        return;
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      } catch (error) {
        if (!cancelado) reportarFallo(error);
        return;
      }

      if (cancelado) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      qrStreamRef.current = stream;
      const pista = stream.getVideoTracks()[0] || null;
      qrPistaVideoRef.current = pista;
      setQrLinternaDisponible(Boolean(pista?.getCapabilities?.().torch));

      // Si el <video> todavía no está montado, el stream quedaría huérfano y la
      // mira se dibujaría sobre un rectángulo negro.
      if (!qrVideoRef.current) {
        detenerCamaraQr();
        setQrCamaraEstado('error');
        setQrCamaraError('No se pudo mostrar la vista de la cámara. Vuelve a abrir el escáner.');
        setQrCamaraReintentable(true);
        return;
      }

      qrVideoRef.current.srcObject = stream;
      try {
        await qrVideoRef.current.play();
      } catch {
        // iOS puede rechazar la reproducción automática; el cuadro igual avanza
        // con `playsInline muted`, así que seguimos intentando decodificar.
      }
      if (cancelado) return;

      let detectarEnCuadro;
      if (soportaDeteccionNativaQr(window)) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        setQrMotorLector('nativo');
        detectarEnCuadro = async (video) => {
          const codigos = await detector.detect(video);
          return codigos?.[0]?.rawValue || null;
        };
      } else {
        let jsQR;
        try {
          jsQR = await cargarDecodificadorRespaldo();
        } catch {
          if (!cancelado) {
            setQrCamaraEstado('error');
            setQrCamaraError('No se pudo cargar el lector de códigos. Revisa tu conexión, usa la foto del QR o toca el corral en la lista.');
            setQrCamaraReintentable(true);
          }
          return;
        }
        if (cancelado) return;
        setQrMotorLector('jsqr');
        detectarEnCuadro = async (video) => {
          const pixeles = extraerPixelesQr(video, video.videoWidth, video.videoHeight);
          if (!pixeles) return null;
          return jsQR(pixeles.data, pixeles.width, pixeles.height, { inversionAttempts: 'attemptBoth' })?.data || null;
        };
      }

      setQrCamaraEstado('activa');

      // Bucle que se reagenda a sí mismo en lugar de un setInterval: con un
      // intervalo fijo las decodificaciones lentas de un teléfono de gama baja se
      // acumulaban unas sobre otras. Además se pausa si la pestaña queda oculta.
      const analizar = async () => {
        if (cancelado) return;
        const video = qrVideoRef.current;
        if (video && !document.hidden && video.readyState >= 2 && video.videoWidth > 0) {
          try {
            const texto = await detectarEnCuadro(video);
            if (cancelado) return;
            // El antirrebote evita reprocesar el mismo rótulo mientras sigue
            // encuadrado, que repintaba el error cuatro veces por segundo.
            if (texto && qrControlRepetidoRef.current.debeProcesar(texto)) {
              qrProcesarRef.current?.(texto, { vibrar: true });
              return;
            }
          } catch {
            // Cuadro intermedio ilegible: seguimos con el siguiente.
          }
        }
        siguienteCuadro = window.setTimeout(analizar, 200);
      };

      analizar();
    };

    iniciar();

    return () => {
      cancelado = true;
      if (siguienteCuadro) window.clearTimeout(siguienteCuadro);
      detenerCamaraQr();
    };
    // `qrProcesarRef` mantiene fuera de aquí las dependencias volátiles de datos.
  }, [
    qrModalAbierto,
    qrModalModo,
    qrCorralDetectado,
    qrExitoReciente,
    qrIntentoCamara,
    detenerCamaraQr,
    extraerPixelesQr,
    cargarDecodificadorRespaldo
  ]);

  // Si el operario negó el permiso o tenía la cámara ocupada, antes había que
  // cerrar y reabrir el modal; ahora basta un botón.
  const reintentarCamaraQr = () => {
    detenerCamaraQr();
    setQrCamaraError('');
    setQrCamaraReintentable(false);
    setQrIntentoCamara(n => n + 1);
  };

  // Escape cierra el escáner: con la cámara encendida, quedarse sin salida
  // visible a una sola X pequeña es especialmente incómodo.
  useEffect(() => {
    if (!qrModalAbierto) return undefined;
    const alPresionarTecla = (evento) => {
      if (evento.key === 'Escape') cerrarModalQrTolva();
    };
    window.addEventListener('keydown', alPresionarTecla);
    return () => window.removeEventListener('keydown', alPresionarTecla);
  }, [qrModalAbierto, cerrarModalQrTolva]);

  const handleEscanearImagenQr = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrErrorMensaje('');
    setQrLeyendoFoto(true);
    try {
      const bitmap = await createImageBitmap(file);
      let texto = null;

      if (soportaDeteccionNativaQr(window)) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const codigos = await detector.detect(bitmap);
        texto = codigos?.[0]?.rawValue || null;
      } else {
        // Mismo respaldo que la cámara: la foto del QR también funciona en iOS.
        const jsQR = await cargarDecodificadorRespaldo();
        const pixeles = extraerPixelesQr(bitmap, bitmap.width, bitmap.height);
        texto = pixeles
          ? jsQR(pixeles.data, pixeles.width, pixeles.height, { inversionAttempts: 'attemptBoth' })?.data || null
          : null;
      }
      bitmap.close?.();

      if (texto) {
        procesarTextoQrEscaneado(texto);
      } else {
        setQrErrorMensaje('No se detectó ningún código QR claro en la foto. Acércate más al rótulo del corral y evita el reflejo del plástico.');
      }
    } catch {
      setQrErrorMensaje('No se pudo procesar la foto del QR.');
    } finally {
      setQrLeyendoFoto(false);
      e.target.value = '';
    }
  };

  const handleConfirmarDescuentoQr = async (e, { continuarRonda = false } = {}) => {
    if (e) e.preventDefault();
    if (!qrCorralDetectado) return;

    // Un doble toque en el móvil disparaba dos veces el mismo descuento: ambas
    // llamadas validaban contra el mismo stock y la bodega quedaba en negativo.
    if (qrGuardandoRef.current) return;

    const loteActivo = getLoteActivo(qrCorralDetectado.id);
    const calculo = calcularDescuentoTolva({
      tipoAlimento: qrTipoAlimento,
      cantidad: qrCantidad,
      unidad: qrUnidad,
      faseDestino: qrFaseDestino,
      fecha: qrFecha,
      loteActivo,
      catalogoAlimento: listCatAlimentos,
      inventarioCentral,
      origenRegistro: 'qr'
    });

    if (!calculo.ok) {
      setQrErrorMensaje(calculo.error);
      return;
    }

    qrGuardandoRef.current = true;
    setQrGuardando(true);
    const alimentoId = crypto.randomUUID();

    try {
      await setAlimentos(prev => [...safeArr(prev), {
        id: alimentoId,
        ...calculo.registro
      }]);
    } catch {
      setQrErrorMensaje('No se pudo guardar el descuento en la nube. Revisa tu conexión y vuelve a intentarlo: la bodega no fue modificada.');
      return;
    } finally {
      qrGuardandoRef.current = false;
      setQrGuardando(false);
    }

    vibrarCampo([40, 30, 60]);
    emitirNotificacionPush({
      tipo: 'alimento',
      titulo: 'Tolva QR registrada',
      descripcion: `${qrTipoAlimento} · ${calculo.librasSuministradas.toFixed(1)} lb · ${formatearMoneda(calculo.costoTotal)}`,
      detalle: `${qrCorralDetectado.nombre} · Fase ${qrFaseDestino} (QR)`,
      corralId: qrCorralDetectado.id,
      corralNombre: qrCorralDetectado.nombre,
      loteId: loteActivo.id,
      loteNombre: loteActivo.nombre || loteActivo.raza || 'Lote activo',
      entidad: { tipo: 'alimento', id: alimentoId }
    });

    setQrErrorMensaje('');
    const resumenDescuento = {
      corralId: qrCorralDetectado.id,
      corralNombre: qrCorralDetectado.nombre,
      loteNombre: loteActivo.nombre || loteActivo.raza || 'Lote activo',
      tipoAlimento: qrTipoAlimento,
      libras: calculo.librasSuministradas,
      sacos: calculo.sacosEquivalentes,
      costo: calculo.costoTotal,
      stockRestanteSacos: calculo.stockRestanteSacos,
      stockRestanteLbs: calculo.stockRestanteLbs,
      fase: qrFaseDestino
    };

    if (continuarRonda) {
      setQrUltimoDescuentoRonda(resumenDescuento);
      setQrExitoReciente(null);
      setQrCorralDetectado(null);
      return;
    }

    setQrExitoReciente(resumenDescuento);
  };

  const handleGuardarSuplemento = (e) => {
    e.preventDefault();
    const loteActivo = getLoteActivo(corralSeleccionado.id);
    if (!loteActivo) return;

    const fd = new FormData(e.target);
    const faseDestinoSeleccionada = parseInt(fd.get('faseDestino'), 10);

    const itemsValidos = suplementoItems.filter(i => i.tipo && parseFloat(i.libras) > 0);
    if (itemsValidos.length === 0) return mostrarAlerta("Error", "Agrega al menos un ingrediente con libras mayores a cero.");

    const stockReservado = {};
    for (let item of itemsValidos) {
      const lbs = parseFloat(item.libras);
      const itemEnCentral = inventarioCentral.find(i => i.nombre === item.tipo);
      const stockDisponible = (itemEnCentral?.stockLbs || 0) - (stockReservado[item.tipo] || 0);
      if (!itemEnCentral || stockDisponible < lbs) {
        const faltanLbs = lbs - stockDisponible;
        return mostrarAlerta("Stock Insuficiente", `No tienes suficiente ${item.tipo} en la Bodega Central. Te faltan ${faltanLbs.toFixed(1)} lbs.`);
      }
      stockReservado[item.tipo] = (stockReservado[item.tipo] || 0) + lbs;
    }

    let pesoRealTotal = 0;
    let costoTotalRacion = 0;
    let detalleArray = [];
    let extrasCompletos = [];

    itemsValidos.forEach(item => {
      const lbs = parseFloat(item.libras);
      pesoRealTotal += lbs;
      const pUnitario = getPrecioPorLibra(item.tipo);
      const costoIng = lbs * pUnitario;
      costoTotalRacion += costoIng;
      detalleArray.push(`${item.tipo} (${lbs}lb)`);
      extrasCompletos.push({ nombre: item.tipo, libras: lbs, costo: costoIng });
    });

    const suplementoId = crypto.randomUUID();
    setAlimentos(prev => [...safeArr(prev), {
      id: suplementoId, loteId: loteActivo.id, fecha: fd.get('fecha'),
      tipo: `Ración Paralela (Suplemento)`,
      cantidadLb: pesoRealTotal, costo: costoTotalRacion,
      esSuplemento: true, detalleMezcla: detalleArray.join(' + '),
      costoPorLb: (costoTotalRacion / pesoRealTotal),
      faseRegistro: faseDestinoSeleccionada,
      ingredientesUsados: extrasCompletos
    }]);
    setSuplementoItems([{ id: Date.now(), tipo: '', libras: '' }]);
    emitirNotificacionPush({
      tipo: 'alimento',
      titulo: 'Suplemento registrado',
      descripcion: `${pesoRealTotal.toFixed(1)} lb · ${formatearMoneda(costoTotalRacion)}`,
      detalle: detalleArray.join(' + '),
      corralId: corralSeleccionado?.id || loteActivo.corralId || '',
      corralNombre: corralSeleccionado?.nombre || listCorrales.find(c => c.id === loteActivo.corralId)?.nombre || 'Corral',
      loteId: loteActivo.id,
      loteNombre: loteActivo.nombre || loteActivo.raza || 'Lote activo',
      entidad: { tipo: 'alimento', id: suplementoId }
    });
    mostrarAlerta("Ración Extra Suministrada", "Los suplementos han sido descontados de bodega y registrados como gasto extra de esta etapa.");
  };

  const handleComprarBodega = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const compraId = crypto.randomUUID();
    const sacos = parseFloat(fd.get('sacos'));
    const costoTotal = parseFloat(fd.get('costoTotal'));
    const tipo = fd.get('tipo');
    setComprasBodega(prev => [...safeArr(prev), {
      id: compraId,
      fecha: fd.get('fecha'),
      tipo,
      sacos,
      costoTotal,
      categoria: bodegaCategoria
    }]);
    e.target.reset();
    emitirNotificacionPush({
      tipo: 'compra',
      titulo: 'Compra registrada',
      descripcion: `${sacos} sacos de ${tipo} · ${formatearMoneda(costoTotal)}`,
      detalle: bodegaCategoria === 'ingrediente' ? 'Ingrediente de mezcla' : 'Concentrado comercial',
      entidad: { tipo: 'bodega', id: compraId }
    });
    mostrarAlerta("Éxito", "Compra registrada en la Bodega Central.");
  };

  // --- PERSISTENCIA LOCAL DEL PESAJE DE BÁSCULA EN CURSO (ANTI-LLAMADAS / RECARGAS) ---
  const claveBorradorVentaActual = useMemo(() => {
    if (!corralSeleccionado?.id) return '';
    const lote = listLotes.find(l => l.corralId === corralSeleccionado.id && l.estado === 'Activo');
    return lote ? construirClaveBorradorBascula(appId, corralSeleccionado.id, lote.id) : '';
  }, [appId, corralSeleccionado?.id, listLotes]);

  useEffect(() => {
    if (vista !== 'prepararVenta' || !claveBorradorVentaActual) return;
    try {
      if (ventaPesos.length === 0) {
        window.localStorage.removeItem(claveBorradorVentaActual);
      } else {
        window.localStorage.setItem(
          claveBorradorVentaActual,
          serializarBorradorBascula({ pesos: ventaPesos, precioLibra: ventaPrecio })
        );
      }
    } catch {
      // Ignorar si el navegador restringe almacenamiento
    }
  }, [vista, claveBorradorVentaActual, ventaPesos, ventaPrecio]);

  const prepararVentaLote = () => {
    const loteActivo = getLoteActivo(corralSeleccionado.id);
    let precioInicial = 0;
    if (loteActivo) {
      const planSanitario = getPlanInnosure(loteActivo);
      if (!planSanitario.puedeVender) {
        return mostrarAlerta('Venta bloqueada por Innosure', planSanitario.motivoBloqueo);
      }
      precioInicial = loteActivo.precioVentaLibra || 0;
    }

    const claveDraft = loteActivo ? construirClaveBorradorBascula(appId, corralSeleccionado.id, loteActivo.id) : '';
    const borrador = claveDraft ? parsearBorradorBascula(window.localStorage.getItem(claveDraft)) : null;

    if (borrador && borrador.pesos.length > 0) {
      setVentaPesos(borrador.pesos);
      setVentaPrecio(borrador.precioLibra > 0 ? borrador.precioLibra : precioInicial);
      setBorradorVentaRestaurado(true);
    } else {
      setVentaPesos([]);
      setVentaPrecio(precioInicial);
      setBorradorVentaRestaurado(false);
    }

    setPesoInputVenta('');
    setAlertaPesoSospechoso(null);
    setVista('prepararVenta');
  };

  const agregarPesoConfirmadoABascula = (pesoLb) => {
    setVentaPesos(prev => [...prev, pesoLb]);
    setPesoInputVenta('');
    setAlertaPesoSospechoso(null);
    vibrarCampo(45);
    window.requestAnimationFrame(() => {
      ventaInputRef.current?.focus();
    });
  };

  const handleCapturarPesoBascula = (e) => {
    e.preventDefault();
    if (!pesoInputVenta) return;
    const evaluacion = evaluarPesoBascula({
      peso: pesoInputVenta,
      pesosPrevios: ventaPesos
    });
    if (!evaluacion.ok) {
      mostrarAlerta('Peso inválido', evaluacion.mensaje);
      return;
    }
    if (evaluacion.sospechoso) {
      vibrarCampo([70, 50, 70]);
      setAlertaPesoSospechoso(evaluacion);
      return;
    }
    agregarPesoConfirmadoABascula(evaluacion.pesoRedondeado);
  };

  const handleLimpiarBorradorBascula = () => {
    pedirConfirmacion('Vaciar Báscula en Curso', '¿Deseas borrar todos los pesos capturados en esta sesión de báscula?', () => {
      setVentaPesos([]);
      setPesoInputVenta('');
      setAlertaPesoSospechoso(null);
      setBorradorVentaRestaurado(false);
      if (claveBorradorVentaActual) {
        try {
          window.localStorage.removeItem(claveBorradorVentaActual);
        } catch {
          // Ignorar
        }
      }
    });
  };

  const procesarVenta = () => {
    if (ventaPesos.length === 0) return mostrarAlerta("Atención", "Debes registrar el peso de al menos un cerdo para realizar la venta.");
    if (ventaPrecio <= 0) return mostrarAlerta("Atención", "El precio por libra debe ser mayor a Q0.00.");

    const totalLbs = ventaPesos.reduce((a, b) => a + b, 0);
    const totalDinero = totalLbs * ventaPrecio;
    const loteActivo = getLoteActivo(corralSeleccionado.id);
    if (!loteActivo) return mostrarAlerta("Error", "No hay lote activo para vender.");
    const statsActuales = calcularEstadisticasLote(loteActivo);
    if (ventaPesos.length > statsActuales.cantidadActual) {
      return mostrarAlerta("Atención", `Solo hay ${statsActuales.cantidadActual} cerdos vivos disponibles en este corral.`);
    }

    // Inocuidad alimentaria: un lote con machos enteros no puede salir a mercado antes
    // de que se cumpla el periodo posterior a la 2a dosis de Innosure.
    const planSanitario = getPlanInnosure(loteActivo);
    if (!planSanitario.puedeVender) {
      return mostrarAlerta('Venta bloqueada por Innosure', planSanitario.motivoBloqueo);
    }

    pedirConfirmacion("Confirmar Venta en Báscula", `¿Registrar la venta de ${ventaPesos.length} cerdos por un total de ${formatearMoneda(totalDinero)}?`, async () => {
      const nuevaVenta = {
        id: crypto.randomUUID(),
        loteId: loteActivo.id,
        corralId: loteActivo.corralId,
        fecha: todayIso(),
        cantidadCerdos: ventaPesos.length,
        totalLibras: totalLbs,
        pesoPromedioLibras: totalLbs / ventaPesos.length,
        pesosVenta: ventaPesos.map((peso, index) => ({ numero: index + 1, peso })),
        precioLibra: ventaPrecio,
        totalVenta: totalDinero,
        tipo: 'bascula'
      };
      await setVentas(prev => [...safeArr(prev), nuevaVenta]);
      if (claveBorradorVentaActual) {
        try {
          window.localStorage.removeItem(claveBorradorVentaActual);
        } catch {
          // Ignorar
        }
      }
      setBorradorVentaRestaurado(false);
      setAlertaPesoSospechoso(null);
      vibrarCampo([60, 40, 90]);
      emitirNotificacionPush({
        tipo: 'venta',
        titulo: 'Venta registrada',
        descripcion: `${ventaPesos.length} cerdos · ${totalLbs.toFixed(1)} lb · ${formatearMoneda(totalDinero)}`,
        corralId: loteActivo.corralId,
        corralNombre: listCorrales.find(c => c.id === loteActivo.corralId)?.nombre || 'Corral',
        loteId: loteActivo.id,
        loteNombre: loteActivo.nombre || loteActivo.raza || 'Lote activo',
        entidad: { tipo: 'venta', id: nuevaVenta.id },
        severidad: 'critical',
        visibleMs: CRITICAL_NOTIFICATION_VISIBLE_MS
      });
      setVentaPesos([]);
      setTipoReporteImpresion('cliente');
      setVista('resumenVenta');
    });
  };

  // --- ANULACIÓN DE VENTAS ---
  // Una venta mal registrada (lo típico: la misma báscula guardada dos veces) no se borra:
  // se anula. El registro queda en el historial del corral con fecha, responsable y motivo,
  // pero deja de contar para inventario vivo, libras vendidas, FCA, GMD e ingresos.
  const handleAnularVenta = (venta) => {
    const libras = getVentaLibras(venta);
    const motivo = motivoAnulacionVenta.trim();
    const corralNombre = listCorrales.find(c => c.id === venta.corralId)?.nombre || corralSeleccionado?.nombre || 'Corral';
    const lote = listLotes.find(l => l.id === venta.loteId);

    pedirConfirmacion(
      'Anular Venta de Báscula',
      `Se anulará la venta del ${venta.fecha}: ${venta.cantidadCerdos} cerdos · ${libras.toFixed(1)} lb · ${formatearMoneda(venta.totalVenta || 0)}. Los cerdos vuelven al inventario vivo del corral y el ingreso se descuenta de las finanzas. El registro queda archivado como anulado.`,
      async () => {
        try {
          await setVentas(prev => safeArr(prev).map(v => v.id === venta.id
            ? {
              ...v,
              anulada: true,
              anuladaEn: new Date().toISOString(),
              anuladaPor: user?.displayName || user?.email || 'Usuario',
              motivoAnulacion: motivo
            }
            : v));
          setVentaAnulandoId(null);
          setMotivoAnulacionVenta('');
          emitirNotificacionPush({
            tipo: 'venta',
            titulo: 'Venta anulada',
            descripcion: `${venta.cantidadCerdos} cerdos · ${libras.toFixed(1)} lb · ${formatearMoneda(venta.totalVenta || 0)}`,
            detalle: motivo || 'Sin motivo especificado',
            corralId: venta.corralId || '',
            corralNombre,
            loteId: venta.loteId || '',
            loteNombre: lote?.nombre || lote?.raza || 'Lote',
            entidad: { tipo: 'venta', id: venta.id },
            severidad: 'critical',
            visibleMs: CRITICAL_NOTIFICATION_VISIBLE_MS
          });
        } catch (error) {
          console.error('Error anulando venta:', error);
          mostrarAlerta('Error', 'No se pudo anular la venta. Volvé a intentarlo.');
        }
      }
    );
  };

  // Deshacer una anulación equivocada. Solo se permite si el corral todavía tiene cerdos
  // vivos suficientes para absorber de nuevo esa salida.
  const handleRestaurarVenta = (venta) => {
    const lote = listLotes.find(l => l.id === venta.loteId);
    const cerdos = Number(venta.cantidadCerdos) || 0;
    if (lote) {
      const stats = calcularEstadisticasLote(lote);
      if (stats && cerdos > stats.cantidadActual) {
        return mostrarAlerta(
          'No se puede restaurar',
          `Esta venta saca ${cerdos} cerdos, pero el corral solo tiene ${stats.cantidadActual} vivos. Anulá primero las bajas o ventas que sobren.`
        );
      }
    }
    pedirConfirmacion(
      'Restaurar Venta',
      `La venta del ${venta.fecha} volverá a contar: ${cerdos} cerdos salen otra vez del inventario y ${formatearMoneda(venta.totalVenta || 0)} regresan a los ingresos.`,
      async () => {
        try {
          await setVentas(prev => safeArr(prev).map(v => {
            if (v.id !== venta.id) return v;
            // Se quitan las marcas de anulación en vez de ponerlas en false/undefined:
            // Firestore no acepta undefined y el registro vuelve a su forma original.
            const vigente = { ...v };
            delete vigente.anulada;
            delete vigente.anuladaEn;
            delete vigente.anuladaPor;
            delete vigente.motivoAnulacion;
            return vigente;
          }));
        } catch (error) {
          console.error('Error restaurando venta:', error);
          mostrarAlerta('Error', 'No se pudo restaurar la venta. Volvé a intentarlo.');
        }
      }
    );
  };

  const handleEliminarVentaAnulada = (venta) => {
    pedirConfirmacion(
      'Borrar Venta Anulada',
      `El registro del ${venta.fecha} desaparecerá del historial para siempre. No afecta ningún número porque ya está anulado, pero se pierde la constancia del error.`,
      async () => {
        try {
          await setVentas(prev => safeArr(prev).filter(v => v.id !== venta.id));
        } catch (error) {
          console.error('Error eliminando venta anulada:', error);
          mostrarAlerta('Error', 'No se pudo borrar el registro. Volvé a intentarlo.');
        }
      }
    );
  };

  const confirmarVentaYCerrar = () => {
    pedirConfirmacion("Cerrar Lote Oficialmente", "¿Deseas finalizar el lote y guardarlo en el historial permanentemente?", () => {
      const loteActivo = getLoteActivo(corralSeleccionado.id);
      setLotes(prev => safeArr(prev).map(l => l.id === loteActivo.id ? { ...l, estado: 'Cerrado', fechaSalida: todayIso() } : l));
      setVista('dashboard');
    });
  };

  const avanzarLoteDeEtapa = (loteId, nuevaEtapaNum) => {
    const hoy = todayIso();
    setLotes(prev => safeArr(prev).map(l => {
      if (l.id !== loteId) return l;
      const newHistorial = safeArr(l.historialFases).filter(h => h.fase < nuevaEtapaNum);
      newHistorial.push({ fase: nuevaEtapaNum, fechaInicio: hoy });
      return { ...l, faseActual: nuevaEtapaNum, historialFases: newHistorial };
    }));
    mostrarAlerta("Etapa Avanzada", `El sistema ha recalculado las fechas futuras y documentado tu ahorro financiero de la etapa anterior.`);
  };

  // --- RENDER: HISTORIAL DE LOTES ---
  const renderInsumos = () => {
    const lotesActivos = listLotes.filter(l => l.estado === 'Activo');
    const valorTotal = inventarioInsumos.reduce((s, i) => s + i.valorStock, 0);
    const bajos = inventarioInsumos.filter(i => i.bajoStock);
    const movimientos = [
      ...listComprasInsumos.map(c => ({ ...c, mov: 'entrada' })),
      ...listUsosInsumos.map(u => ({ ...u, mov: 'salida' }))
    ].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''))).slice(0, 25);
    const nombreCorral = (loteId) => {
      const lote = listLotes.find(l => l.id === loteId);
      return listCorrales.find(c => c.id === lote?.corralId)?.nombre || 'Corral';
    };
    const inputCls = 'w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500';
    const labelCls = 'block text-slate-400 uppercase tracking-widest font-bold mb-1.5 text-[10px]';

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <p className="text-slate-500 text-sm">Viruta, cal, desinfectante y demás materiales. Se compran acá y se descuentan al asignarlos a un corral.</p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Valor en bodega</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{formatearMoneda(valorTotal)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tipos de insumo</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{inventarioInsumos.length}</p>
          </div>
          <div className={`border rounded-2xl p-4 ${bajos.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bajo mínimo</p>
            <p className={`text-xl font-bold mt-1 ${bajos.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{bajos.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Consumido</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{formatearMoneda(listUsosInsumos.reduce((s, u) => s + (Number(u.costo) || 0), 0))}</p>
          </div>
        </div>

        <TablaInventarioBodega
          titulo="Inventario Físico en Bodega"
          encabezadoStock="Disponible"
          vacio="No hay insumos en el catálogo todavía."
          onEliminar={handleEliminarInsumoCatalogo}
          filas={inventarioInsumos.map(item => ({
            id: item.id,
            nombre: item.nombre,
            subtitulo: `costo prom. ${formatearMoneda(item.costoPromedio)}/${item.unidad}`,
            tipo: item.categoria,
            stock: `${item.stock.toFixed(item.stock % 1 === 0 ? 0 : 1)} ${item.unidad}`,
            alerta: item.bajoStock,
            notaStock: item.bajoStock ? `mínimo ${item.stockMinimo}` : null,
            valor: formatearMoneda(item.valorStock)
          }))}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* COMPRA */}
          <form onSubmit={handleComprarInsumo} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3.5">
            <h3 className="font-bold text-slate-800 text-sm">Registrar compra</h3>
            <div><label className={labelCls}>Insumo</label>
              <select name="productoId" required className={inputCls}>
                <option value="">Elegí un insumo...</option>
                {listCatalogoInsumos.map(i => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Cantidad</label><input type="number" name="cantidad" step="0.01" min="0.01" required className={inputCls} /></div>
              <div><label className={labelCls}>Costo total (Q)</label><input type="number" name="costoTotal" step="0.01" min="0" required className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>Fecha</label><input type="date" name="fecha" required defaultValue={todayIso()} className={inputCls} /></div>
            <div><label className={labelCls}>Proveedor (opcional)</label><input type="text" name="proveedor" className={inputCls} /></div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors">Registrar entrada</button>
          </form>

          {/* USO EN CORRAL */}
          <form onSubmit={handleUsarInsumoEnCorral} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3.5">
            <h3 className="font-bold text-slate-800 text-sm">Asignar a un corral</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">Descuenta del stock y carga el costo al lote como gasto operativo.</p>
            <div><label className={labelCls}>Insumo</label>
              <select name="productoId" required className={inputCls}>
                <option value="">Elegí un insumo...</option>
                {inventarioInsumos.filter(i => i.stock > 0).map(i => (
                  <option key={i.id} value={i.id}>{i.nombre} — quedan {i.stock.toFixed(1)} {i.unidad}</option>
                ))}
              </select>
            </div>
            <div><label className={labelCls}>Corral</label>
              <select name="loteId" required className={inputCls}>
                <option value="">Elegí un corral...</option>
                {lotesActivos.map(l => (
                  <option key={l.id} value={l.id}>{listCorrales.find(c => c.id === l.corralId)?.nombre || 'Corral'}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Cantidad</label><input type="number" name="cantidad" step="0.01" min="0.01" required className={inputCls} /></div>
              <div><label className={labelCls}>Fecha</label><input type="date" name="fecha" required defaultValue={todayIso()} className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>Nota (opcional)</label><input type="text" name="observacion" placeholder="Ej: cambio de cama" className={inputCls} /></div>
            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors">Descontar y cargar al lote</button>
          </form>

          {/* CATÁLOGO */}
          <form onSubmit={handleAgregarInsumoCatalogo} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3.5">
            <h3 className="font-bold text-slate-800 text-sm">Agregar tipo de insumo</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">Configurá acá cualquier material nuevo que quieras controlar.</p>
            <div><label className={labelCls}>Nombre</label><input type="text" name="nombre" required placeholder="Ej: Lazo de manejo" className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Unidad</label><input type="text" name="unidad" placeholder="saco, galón, caja" className={inputCls} /></div>
              <div><label className={labelCls}>Stock mínimo</label><input type="number" name="stockMinimo" step="0.1" min="0" defaultValue={0} className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>Categoría</label><input type="text" name="categoria" placeholder="Cama, Bioseguridad, Manejo..." className={inputCls} /></div>
            <button type="submit" className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors">Agregar al catálogo</button>
          </form>
        </div>

        {/* MOVIMIENTOS */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm">Últimos movimientos</h3>
          </div>
          {movimientos.length === 0 ? (
            <p className="py-10 text-center text-slate-400 text-xs">Todavía no hay entradas ni salidas.</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {movimientos.map(m => (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-[13px]">{m.nombre}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {m.fecha} · {m.mov === 'entrada' ? (m.proveedor || 'Compra') : `a ${nombreCorral(m.loteId)}`}
                      {m.observacion ? ` · ${m.observacion}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-[13px] ${m.mov === 'entrada' ? 'text-emerald-600' : 'text-slate-600'}`}>
                      {m.mov === 'entrada' ? '+' : '−'}{Number(m.cantidad).toFixed(1)} {m.unidad}
                    </p>
                    <p className="text-[11px] text-slate-400">{formatearMoneda(m.mov === 'entrada' ? m.costoTotal : m.costo)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderHoy = () => {
    const GRUPOS = [
      { clave: 'atrasado', titulo: 'Atrasado', color: 'text-rose-600', punto: 'bg-rose-500' },
      { clave: 'hoy', titulo: 'Para hoy', color: 'text-amber-600', punto: 'bg-amber-500' },
      { clave: 'semana', titulo: 'Esta semana', color: 'text-slate-500', punto: 'bg-slate-400' }
    ];
    const fecha = new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });
    const atrasadas = accionesDeHoy.filter(a => a.grupo === 'atrasado').length;
    const hoyIso = todayIso();

    const lotesActivosHoy = listLotes.filter(l => l.estado === 'Activo');
    const cerdosVivosHoy = lotesActivosHoy.reduce((acc, l) => acc + (calcularEstadisticasLote(l)?.cantidadActual || 0), 0);
    const sacosBodegaHoy = inventarioCentral.reduce((acc, item) => acc + (Number(item.stockSacos) || 0), 0);

    const alimentosServidosHoy = listAlimentos.filter(a => a.fecha === hoyIso);
    const alimentosLbHoy = alimentosServidosHoy.reduce((s, a) => s + (Number(a.cantidadLb) || 0), 0);
    const pesajesHoy = listPesos.filter(p => p.fecha === hoyIso).length;
    const bajasHoy = listBajas.filter(b => b.fecha === hoyIso).reduce((s, b) => s + (Number(b.cantidad) || 0), 0);
    const ventasHoy = listVentasActivas.filter(v => v.fecha === hoyIso);
    const ventasCabezasHoy = ventasHoy.reduce((s, v) => s + (Number(v.cantidadCerdos) || 0), 0);
    const ventasTotalHoy = ventasHoy.reduce((s, v) => s + (Number(v.totalVenta) || 0), 0);

    const textoParteDiario = formatearParteDiarioWhatsApp({
      fechaTexto: fecha,
      corralesActivos: lotesActivosHoy.length,
      corralesTotales: listCorrales.length,
      cerdosVivos: cerdosVivosHoy,
      sacosBodega: sacosBodegaHoy,
      acciones: accionesDeHoy,
      actividadHoy: {
        alimentosLbHoy,
        descargasHoy: alimentosServidosHoy.length,
        pesajesHoy,
        bajasHoy,
        ventasCabezasHoy,
        ventasTotalHoy
      },
      ordenCompra: ordenCompraLista
    });

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto animate-in fade-in duration-500">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{fecha}</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
              {accionesDeHoy.length === 0 ? 'Todo al día' : `${accionesDeHoy.length} ${accionesDeHoy.length === 1 ? 'cosa' : 'cosas'} por hacer`}
            </h2>
            {atrasadas > 0 && (
              <p className="text-sm text-rose-600 font-semibold mt-1">{atrasadas} {atrasadas === 1 ? 'atrasada' : 'atrasadas'}</p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => enviarPorWhatsApp(textoParteDiario)}
              className="col-span-2 justify-center bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/15 flex items-center gap-1.5 transition-all"
            >
              <MessageCircle size={16} /> Enviar Parte por WhatsApp
            </button>
            <button
              type="button"
              onClick={() => copiarTextoWhatsApp(textoParteDiario, 'parte_hoy')}
              className="justify-center bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              {whatsappCopiadoId === 'parte_hoy' ? <><Check size={14} className="text-emerald-600" /> ¡Copiado!</> : <><Copy size={14} /> Copiar</>}
            </button>
            <button
              type="button"
              onClick={() => setMostrarPreviewParteHoy(!mostrarPreviewParteHoy)}
              className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs px-3 py-2.5 rounded-xl transition-colors"
            >
              {mostrarPreviewParteHoy ? 'Ocultar vista previa' : 'Configurar / Ver'}
            </button>
          </div>
        </div>

        {mostrarPreviewParteHoy && (
          <div className="mb-6 bg-white border border-emerald-200 rounded-2xl p-4 space-y-3.5 shadow-xs animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                  <MessageCircle size={15} className="text-emerald-600" /> Destinatario Rápido de WhatsApp (Opcional)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Si ingresas el número del dueño o encargado, abrirá su chat directo. Si lo dejas vacío, WhatsApp te dejará elegir contacto o grupo.
                </p>
              </div>
              <input
                type="tel"
                inputMode="tel"
                value={whatsappTelefono}
                onChange={(e) => guardarTelefonoWhatsApp(e.target.value)}
                placeholder="Ej: 5544-3322"
                className="sm:w-44 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Vista previa del mensaje</p>
              <pre className="bg-slate-900 text-slate-100 p-3.5 rounded-xl text-[11px] font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {textoParteDiario}
              </pre>
            </div>
          </div>
        )}

        {accionesDeHoy.length === 0 ? (
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-8 text-center">
            <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3" />
            <p className="font-bold text-emerald-900">No hay nada pendiente</p>
            <p className="text-sm text-emerald-700/70 mt-1">Ningún corral necesita atención en los próximos 7 días.</p>
          </div>
        ) : (
          <div className="space-y-7">
            {GRUPOS.map(grupo => {
              const items = accionesDeHoy.filter(a => a.grupo === grupo.clave);
              if (items.length === 0) return null;
              return (
                <section key={grupo.clave}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`w-1.5 h-1.5 rounded-full ${grupo.punto}`} />
                    <h3 className={`text-[11px] font-bold uppercase tracking-widest ${grupo.color}`}>{grupo.titulo}</h3>
                    <span className="text-[11px] font-semibold text-slate-300">{items.length}</span>
                  </div>

                  <div className="space-y-2">
                    {items.map(item => (
                      <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3.5">
                        <span className="text-xl leading-none mt-0.5 shrink-0">{item.icono}</span>

                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-slate-400">{item.corral}</p>
                          <p className="font-bold text-slate-900 text-sm leading-snug mt-0.5">{item.titulo}</p>
                          <p className="text-[13px] text-slate-500 leading-snug mt-1">{item.detalle}</p>
                          {item.nota && <p className="text-[12px] text-slate-400 leading-snug mt-1.5">{item.nota}</p>}

                          <div className="flex flex-wrap gap-2 mt-3">
                            {item.accionRapida && (
                              <button type="button" onClick={item.accionRapida} className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-[12px] font-semibold px-3.5 py-2 rounded-xl transition-colors">
                                {item.etiqueta}
                              </button>
                            )}
                            {item.accion && (
                              <button type="button" onClick={item.accion} className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-[12px] font-semibold px-3.5 py-2 rounded-xl transition-colors">
                                {item.accionRapida ? 'Abrir corral' : item.etiqueta}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderDashboard = () => {
    const alertasCambio = listLotes.filter(l => l.estado === 'Activo').map(lote => {
      const corral = listCorrales.find(c => c.id === lote.corralId);
      const stats = calcularEstadisticasLote(lote);

      const nombreCorral = corral ? corral.nombre : 'Corral';

      // Sobre-engorde: el lote ya comio un ciclo completo y sigue en el corral.
      if (stats.excedeCicloCompleto) {
        return {
          corralNombre: nombreCorral,
          alertaEspecial: true,
          severidad: 'critical',
          mensaje: `Ya consumió el ${stats.consumoCicloPorcentaje.toFixed(0)}% del alimento de un ciclo completo (${stats.consumoPorCerdoLb.toFixed(0)} lb/cerdo). Probablemente está en peso de venta y cada día extra es alimento perdido.`
        };
      }

      // Pesaje vencido: sin pesar no hay proyeccion que valga.
      if (stats.pesajeVencido) {
        return {
          corralNombre: nombreCorral,
          alertaEspecial: true,
          mensaje: stats.sinPesajes
            ? 'Este lote no tiene ningún pesaje registrado. Las proyecciones no son confiables.'
            : `${stats.diasSinPesaje} días sin pesar. Se está estimando ~${stats.pesoParaProyeccion.toFixed(0)} lb por consumo de alimento; registrá un pesaje real.`
        };
      }

      const faseActualNum = lote.faseActual || 1;
      const faseActual = CRONOGRAMA_ALIMENTACION.find(f => f.fase === faseActualNum);

      if (faseActual) {
        if (stats.estaListoParaMezclas && !lote.alertaMezclaVista) {
          return { tipoAviso: 'mezcla', corralRef: corral, corralNombre: corral ? corral.nombre : 'Corral', alertaEspecial: true, mensaje: `¡Cerdos listos para suplementación fuerte! Han superado las ${pesoAlertaMezcla} lbs.` };
        }

        const metaFase = faseActual.consumoTotalLb * stats.cantidadActual;
        const consumidoFase = getConsumidoEnFase(lote.id, faseActual);
        const supsFase = getSuplementosEnFase(lote.id, faseActual.fase);
        const totalConsumidoDashboard = consumidoFase + supsFase.lbs;
        const porcConsumo = metaFase > 0 ? (totalConsumidoDashboard / metaFase) : 0;

        const fasesDin = getFasesDinamicas(lote);
        const fData = fasesDin.find(f => f.fase === faseActualNum);
        let diasFaltantes = 999;
        if (fData) {
          const msFaltantes = fData.fechaFinCalc - new Date();
          diasFaltantes = Math.ceil(msFaltantes / (1000 * 60 * 60 * 24));
        }

        if (porcConsumo >= 0.90 || (diasFaltantes <= 2 && diasFaltantes >= -5)) {
          const proximaFase = CRONOGRAMA_ALIMENTACION.find(f => f.fase === faseActualNum + 1);
          if (proximaFase) {
            return {
              tipoAviso: 'cambio',
              corralRef: corral,
              corralNombre: corral ? corral.nombre : 'Corral',
              alertaEspecial: false,
              proximoAlimento: proximaFase.alimento,
              porcentaje: Math.min((porcConsumo * 100), 100).toFixed(0),
              motivo: porcConsumo >= 0.90 ? 'consumo' : 'dias'
            };
          }
        }
      }
      return null;
    }).filter(Boolean);

    const notifsPushMapeadas = safeArr(notificacionesPush)
      .filter(n => isNotificationVisible(n))
      .map(n => ({
        corralNombre: n.corralNombre || 'Actividad',
        alertaEspecial: true,
        tipoEvento: n.tipo || 'sistema',
        titulo: n.titulo || 'Actividad registrada',
        mensaje: n.descripcion || n.mensaje,
        detalle: n.detalle || '',
        loteNombre: n.loteNombre || '',
        usuarioNombre: n.usuarioNombre || '',
        tiempo: formatRelativeTime(getNotificationCreatedAt(n)),
        severidad: n.severidad || 'info'
      }))
      .reverse();
    
    const abrirCorral = (corral) => {
      if (!corral) return;
      setCorralSeleccionado(corral);
      setVista('corralDetail');
      setTabActiva('resumen');
    };

    // Las demás alertas de este listado ya llegan por accionesDeHoy.
    const avisos = alertasCambio
      .filter(a => a.tipoAviso)
      .map(a => ({
        id: `${a.tipoAviso}_${a.corralRef?.id ?? a.corralNombre}`,
        grupo: 'hoy',
        severidad: a.tipoAviso === 'cambio' ? 'warning' : 'info',
        corral: a.corralNombre,
        titulo: a.tipoAviso === 'cambio' ? `Preparar cambio a ${a.proximoAlimento}` : 'Listo para suplementación',
        detalle: a.tipoAviso === 'cambio'
          ? `Alimento de la fase al ${a.porcentaje} %.${a.motivo === 'dias' ? ' La fase está por terminar.' : ''}`
          : a.mensaje,
        accion: 'Abrir corral',
        onAccion: () => abrirCorral(a.corralRef)
      }));

    const datosPanel = construirPanelPrincipal({
      lotes: listLotes,
      corrales: listCorrales,
      pesos: listPesos,
      bajas: listBajas,
      alimentos: listAlimentos,
      inventario: inventarioCentral,
      cronograma: CRONOGRAMA_ALIMENTACION,
      acciones: accionesDeHoy,
      avisos,
      actividad: notifsPushMapeadas.slice(0, 5).map((n, i) => ({
        id: `${i}_${n.titulo}`,
        titulo: n.titulo,
        corral: [n.corralNombre, n.loteNombre].filter(Boolean).join(' · '),
        mensaje: n.mensaje,
        usuario: n.usuarioNombre,
        tiempo: n.tiempo
      })),
      estadisticasDe: calcularEstadisticasLote,
      planDe: getPlanInnosure,
      hoyIso: todayIso(),
      hoyTexto: new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' }),
      onVerBodega: () => irAVista('bodega'),
      onAbrirCorral: (corralId) => abrirCorral(listCorrales.find(c => c.id === corralId))
    });

    return (
      <PanelPrincipal
        datos={datosPanel}
        onAbrirCorral={(corralId) => abrirCorral(listCorrales.find(c => c.id === corralId))}
        onVerHoy={() => irAVista('hoy')}
        onVerCalendario={() => irAVista('calendario')}
        onCrearLote={() => (listCorrales[0] ? abrirCorral(listCorrales[0]) : irAVista('config'))}
      />
    );
  };

  const renderBodega = () => {
    const hoy = todayIso();
    const lotesActivosBodega = listLotes.filter(l => l.estado === 'Activo');
    const alertasMedicas = inventarioMedico.filter(item => {
      const vencimientoCercano = item.proximoVencimiento && item.proximoVencimiento.diffDias <= (Number(item.diasAlertaVencimiento) || 30);
      return item.bajoStock || vencimientoCercano;
    });
    const valorBodegaMedica = inventarioMedico.reduce((sum, item) => sum + (item.valorStock || 0), 0);
    const tareasSanidadPendientesBodega = listTareasSanidad
      .filter(t => (t.estado || 'pendiente') === 'pendiente')
      .map(t => {
        const lote = listLotes.find(l => l.id === t.loteId);
        if (!lote || lote.estado !== 'Activo') return null;
        const corral = listCorrales.find(c => c.id === lote.corralId);
        const fechaObjetivo = t.fechaObjetivo || (lote.fechaIngreso ? addDaysToIsoDate(lote.fechaIngreso, Number(t.dia) || 0) : '');
        const diffDias = fechaObjetivo ? Math.ceil((new Date(`${fechaObjetivo}T00:00:00`) - new Date(`${hoy}T00:00:00`)) / 86_400_000) : 9999;
        return { ...t, lote, corral, fechaObjetivo, diffDias };
      })
      .filter(Boolean);
    const tareasProximasConMedicina = tareasSanidadPendientesBodega.filter(t => t.productoMedicoId && t.diffDias >= 0 && t.diffDias <= 14);
    const ordenCompraMedicaSugerida = Object.values(tareasProximasConMedicina.reduce((acc, tarea) => {
      const med = inventarioMedico.find(m => m.id === tarea.productoMedicoId);
      if (!med) return acc;
      if (!acc[med.id]) {
        acc[med.id] = { ...med, tareas: [], requeridoOperativo: 0, faltanteOperativo: 0 };
      }
      acc[med.id].tareas.push(tarea);
      acc[med.id].requeridoOperativo += 1;
      acc[med.id].faltanteOperativo = Math.max(0, acc[med.id].requeridoOperativo - (Number(med.stock) || 0));
      return acc;
    }, {})).filter(item => item.faltanteOperativo > 0 || item.bajoStock);

return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="max-lg:hidden text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center leading-none">
              <Archive className="mr-3 text-amber-500 filter drop-shadow-[0_0_8px_rgba(245,158,11,0.25)]" size={28} /> Bodega Central
            </h2>
            <p className="text-slate-500 text-sm mt-1.5">Alimento, farmacia e insumos en un solo lugar.</p>
          </div>
          {bodegaVistaTab === 'alimento' && (
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:self-start md:self-auto">
              <button
                type="button"
                onClick={() => enviarPorWhatsApp(formatearOrdenCompraWhatsApp({
                  fechaTexto: new Date().toLocaleDateString('es-GT'),
                  ordenAlimento: ordenCompraLista,
                  ordenMedica: ordenCompraMedicaSugerida
                }))}
                className="justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all duration-200 flex items-center shrink-0 gap-2 text-xs sm:text-sm"
              >
                <MessageCircle size={17} /> <span className="sm:hidden">WhatsApp</span><span className="hidden sm:inline">Pedir por WhatsApp</span>
              </button>
              <button onClick={() => descargarPDF('orden-compra-pdf', 'Orden_Compra_Granja.pdf')} className="justify-center bg-slate-950 hover:bg-slate-900 text-white font-bold py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center shrink-0 gap-2 text-xs sm:text-sm">
                <Download size={17} /> Orden PDF
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 sm:flex gap-1 sm:gap-2 bg-white p-1.5 rounded-xl border border-slate-200/70 shadow-sm sm:w-fit">
          <button type="button" onClick={() => setBodegaVistaTab('alimento')} className={`flex items-center justify-center px-2 sm:px-5 py-2.5 rounded-lg font-bold text-sm transition-colors gap-2 ${bodegaVistaTab === 'alimento' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            <Wheat size={16} /> Alimento
          </button>
          <button type="button" onClick={() => setBodegaVistaTab('farmacia')} className={`flex items-center justify-center px-2 sm:px-5 py-2.5 rounded-lg font-bold text-sm transition-colors gap-2 ${bodegaVistaTab === 'farmacia' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            <Syringe size={16} /> Farmacia
          </button>
          <button type="button" onClick={() => setBodegaVistaTab('insumos')} className={`flex items-center justify-center px-2 sm:px-5 py-2.5 rounded-lg font-bold text-sm transition-colors gap-2 ${bodegaVistaTab === 'insumos' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            <Package size={16} /> Insumos
            {inventarioInsumos.filter(i => i.bajoStock).length > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${bodegaVistaTab === 'insumos' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                {inventarioInsumos.filter(i => i.bajoStock).length}
              </span>
            )}
          </button>
        </div>

        {bodegaVistaTab === 'insumos' && renderInsumos()}

        {/* CONTENEDOR OCULTO PARA EL PDF DE ORDEN DE COMPRA */}
        <div className="absolute -left-[9999px]">
          <div id="orden-compra-pdf" className="p-12 w-[800px] bg-white text-black font-sans">
            <div className="text-center border-b-4 border-slate-900 pb-6 mb-8">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">ORDEN DE COMPRA SUGERIDA</h1>
              <p className="text-xl font-bold text-slate-500 mt-2 uppercase tracking-widest">Porcicontrol</p>
              <p className="text-sm mt-4 font-bold">Fecha de Emisión: {new Date().toLocaleDateString('es-GT')}</p>
            </div>
            <p className="mb-6 text-slate-700 text-lg">El sistema ha cruzado la etapa actual de todos los corrales contra el inventario físico global en la Bodega Central. Debes comprar los siguientes insumos para que la granja termine su etapa vigente sin interrupciones:</p>

            <table className="w-full text-left border-collapse border border-slate-300">
              <thead className="bg-slate-100 font-bold">
                <tr>
                  <th className="p-3 border border-slate-300 font-bold uppercase text-sm">Insumo a Comprar</th>
                  <th className="p-3 border border-slate-300 font-bold uppercase text-sm text-center">Faltante Global (lbs)</th>
                  <th className="p-3 border border-slate-300 font-bold uppercase text-sm text-center">Stock Actual</th>
                  <th className="p-3 border border-slate-300 font-bold uppercase text-sm text-right bg-amber-100 text-amber-900">Sacos a Comprar</th>
                </tr>
              </thead>
              <tbody>
                {ordenCompraLista.length > 0 ? ordenCompraLista.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-3 border border-slate-300 font-bold text-lg">{item.nombre} <span className="text-xs font-normal text-slate-500 block">Presentación: {item.lbsPorSaco}lb/saco</span></td>
                    <td className="p-3 border border-slate-300 text-center text-rose-600 font-bold">{item.faltanteGlobal.toFixed(1)} lbs</td>
                    <td className="p-3 border border-slate-300 text-center font-bold text-slate-500">{item.invCentral.toFixed(1)} lbs</td>
                    <td className="p-3 border border-slate-300 text-right font-black text-2xl text-amber-600 bg-amber-50">{item.sacosAComprar} <span className="text-sm font-normal">Sacos</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan="4" className="p-8 text-center text-slate-500 italic">No hay compras requeridas. Tienes inventario suficiente en bodega para terminar las etapas actuales de todos los corrales activos.</td></tr>
                )}
              </tbody>
            </table>
            <div className="mt-16 text-center">
              <div className="border-t-2 border-slate-400 w-64 mx-auto pt-2">
                <p className="font-bold text-slate-600 uppercase">Firma Autorizada</p>
              </div>
            </div>
          </div>
        </div>

        {bodegaVistaTab === 'alimento' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
              <h3 className="font-bold text-md text-slate-800 mb-4 flex items-center gap-2"><Plus size={18} className="text-amber-500" /> Ingresar Insumo a Bodega</h3>
              
              <div className="flex gap-2 mb-4 bg-slate-50 p-1 rounded-xl border border-slate-100">
                <button type="button" onClick={() => setBodegaCategoria('concentrado')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${bodegaCategoria === 'concentrado' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}>Concentrados</button>
                <button type="button" onClick={() => setBodegaCategoria('ingrediente')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${bodegaCategoria === 'ingrediente' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}>Extras (Mezcla)</button>
              </div>

              <form onSubmit={handleComprarBodega} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fecha de Ingreso</label>
                  <input type="date" name="fecha" required defaultValue={todayIso()} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50/50 text-sm transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Insumo / Producto</label>
                  <select name="tipo" required className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50/50 text-sm transition-all">
                    {bodegaCategoria === 'concentrado' ? listCatAlimentos.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>) : listCatIngredientes.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Sacos</label>
                    <input type="number" name="sacos" step="0.5" required className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50/50 text-sm transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Costo Total (Q)</label>
                    <input type="number" name="costoTotal" step="0.01" required className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50/50 text-sm transition-all" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl transition-colors shadow-lg shadow-emerald-600/10 mt-2">Registrar Ingreso</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
              <h3 className="font-bold text-md text-slate-800 mb-3.5">Historial de Compras</h3>
              <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                {[...listCompras].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(c => (
                  <div key={c.id} className="flex justify-between items-start gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm hover:bg-slate-100/50 transition-colors">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 leading-tight">{c.tipo}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase ${c.categoria === 'ingrediente' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {c.categoria === 'ingrediente' ? 'EXTRA' : 'COMERCIAL'}
                        </span>
                        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{c.fecha} • {c.sacos} sacos</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-bold text-rose-600 whitespace-nowrap">{formatearMonedaNeg(c.costoTotal)}</span>
                      <button onClick={() => handleEliminarDato('bodega', c.id)} aria-label="Eliminar compra" className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
                {listCompras.length === 0 && <p className="text-slate-400 italic text-center py-4 text-xs font-semibold">No hay compras registradas.</p>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)] overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between gap-3">
                <div className="flex items-center min-w-0"><Box size={18} className="text-emerald-400 mr-2" /><h3 className="font-bold text-sm sm:text-base truncate">Inventario físico en bodega</h3></div>
                <span className="shrink-0 whitespace-nowrap text-[10px] text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">Tiempo real</span>
              </div>
              <ul className="sm:hidden divide-y divide-slate-100">
                {inventarioCentral.map(item => {
                  if (item.stockLbs <= 0 && listCompras.filter(c => c.tipo === item.nombre).length === 0) return null;
                  return (
                    <li key={item.id} className="px-4 py-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm leading-snug">{item.nombre}</p>
                        <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                          <span className="uppercase tracking-wide">{item.isConcentrado ? 'Comercial' : 'Extra'}</span> · {item.librasPorSaco} lb/saco · {item.stockLbs.toFixed(1)} lbs
                        </p>
                      </div>
                      <span className={`shrink-0 px-2.5 py-1 rounded-full font-black text-xs whitespace-nowrap ${item.stockSacos <= 2 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                        {item.stockSacos.toFixed(1)} sacos
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-4 pl-6 font-bold">Materia Prima</th>
                      <th className="p-4 font-bold text-center">Tipo</th>
                      <th className="p-4 font-bold text-center">Sacos Disponibles</th>
                      <th className="p-4 pr-6 font-bold text-right">Libras Totales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {inventarioCentral.map(item => {
                      if (item.stockLbs <= 0 && listCompras.filter(c => c.tipo === item.nombre).length === 0) return null;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 pl-6 font-bold text-slate-800">{item.nombre} <span className="text-[10px] text-slate-400 font-normal ml-1">({item.librasPorSaco} lb/saco)</span></td>
                          <td className="p-4 text-center text-xs font-bold text-slate-400 uppercase">{item.isConcentrado ? 'Comercial' : 'Extra'}</td>
                          <td className="p-4 text-center">
                            <span className={`px-3 py-1 rounded-full font-black text-sm ${item.stockSacos <= 2 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              {item.stockSacos.toFixed(1)}
                            </span>
                          </td>
                          <td className="p-4 pr-6 text-right font-bold text-slate-800">{item.stockLbs.toFixed(1)} lbs</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        )}

        {bodegaVistaTab === 'farmacia' && (
          <div className="space-y-8">
            {/* METRICS GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-1 leading-none">Valor en Farmacia</p>
                <p className="text-2xl font-black text-indigo-900">{formatearMoneda(valorBodegaMedica)}</p>
              </div>
              <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500 mb-1 leading-none">Alertas de Stock</p>
                <p className="text-2xl font-black text-rose-700">{alertasMedicas.length}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 leading-none">Medicamentos en Catálogo</p>
                <p className="text-2xl font-black text-slate-800">{listCatalogoMedico.length}</p>
              </div>
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1 leading-none">Aplicaciones Realizadas</p>
                <p className="text-2xl font-black text-emerald-700">{listUsosMedicos.length}</p>
              </div>
            </div>

            {/* COMPRA MÈDICA SUGERIDA */}
            {ordenCompraMedicaSugerida.length > 0 && (
              <div className="bg-fuchsia-50 border border-fuchsia-100 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <h3 className="font-extrabold text-fuchsia-900 text-sm flex items-center gap-1.5"><ShoppingCart size={16} /> Compra Sugerida de Fármacos</h3>
                  <span className="text-[9px] font-bold text-fuchsia-600 bg-white border border-fuchsia-200/60 px-2.5 py-1 rounded-lg uppercase tracking-wider">Próximos 14 días</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ordenCompraMedicaSugerida.map(item => (
                    <div key={item.id} className="bg-white border border-fuchsia-100 rounded-xl p-4 flex justify-between items-center shadow-sm">
                      <div>
                        <p className="font-extrabold text-slate-800 text-sm">{item.nombre}</p>
                        <p className="text-xs text-slate-500 mt-1">{item.tareas.length} tareas programadas • stock: {Number(item.stock || 0).toFixed(1)} {item.unidad}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-fuchsia-700 bg-fuchsia-100 px-3 py-1 rounded-xl">{Math.ceil(item.faltanteOperativo)} {item.unidad}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ALERTAS DE FARMACIA */}
            {alertasMedicas.length > 0 && (
              <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-5 shadow-sm">
                <h3 className="font-extrabold text-rose-900 text-sm mb-4 flex items-center gap-1.5"><AlertTriangle size={16} /> Medicamentos Vencidos o con Stock Crítico</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {alertasMedicas.map(item => (
                    <div key={item.id} className="bg-white border border-rose-100 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                      <div>
                        <p className="font-bold text-slate-800 text-sm leading-snug">{item.nombre}</p>
                        <p className="text-xs text-slate-500 mt-1 font-semibold flex items-center gap-1">
                          Stock: <span className={`font-bold ${item.bajoStock ? 'text-rose-600' : 'text-slate-700'}`}>{item.stock.toFixed(1)} {item.unidad}</span>
                          {item.bajoStock && <span className="text-[10px] text-white bg-rose-500 px-1.5 py-0.5 rounded-md leading-none uppercase">Crítico</span>}
                        </p>
                      </div>
                      {item.proximoVencimiento && (
                        <p className="text-[10px] text-rose-600 font-black uppercase tracking-wider bg-rose-50 p-2 border border-rose-100 rounded-lg mt-3 leading-none text-center">
                          Vence: {item.proximoVencimiento.vencimiento} ({item.proximoVencimiento.diffDias} días)
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FORMS GRID */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* COMPRA */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_4px_25px_rgb(0,0,0,0.005)]">
                <h3 className="font-extrabold text-slate-800 text-base mb-4 flex items-center gap-2 border-b border-slate-50 pb-3"><ShoppingCart size={18} className="text-indigo-600" /> Registrar Compra Médica</h3>
                <form onSubmit={handleComprarMedicina} className="space-y-4 text-xs font-semibold">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Fecha de Compra</label>
                      <input type="date" name="fecha" required defaultValue={hoy} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50" />
                    </div>
                    <div>
                      <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Medicamento a Ingresar</label>
                      <select name="productoId" required value={medicinaSeleccionadaId} onChange={(e) => setMedicinaSeleccionadaId(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-bold text-slate-700">
                        {listCatalogoMedico.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Cantidad</label>
                      <input type="number" name="cantidad" step="0.01" min="0.01" required className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 font-bold" />
                    </div>
                    <div>
                      <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Costo Total (Q)</label>
                      <input type="number" name="costoTotal" step="0.01" min="0" required className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 font-bold" />
                    </div>
                    <div>
                      <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Fecha Vencimiento</label>
                      <input type="date" name="vencimiento" className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input name="lote" placeholder="Lote / Serie del fármaco (opcional)" className="p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                    <input name="proveedor" placeholder="Droguería / Veterinaria (opcional)" className="p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50" />
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl transition-colors shadow-lg shadow-indigo-600/10 mt-2">Ingresar Fármaco</button>
                </form>
              </div>

              {/* APLICACIÓN */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_4px_25px_rgb(0,0,0,0.005)]">
                <h3 className="font-extrabold text-slate-800 text-base mb-4 flex items-center gap-2 border-b border-slate-50 pb-3"><Syringe size={18} className="text-rose-600" /> Aplicar Tratamiento Médico</h3>
                <form onSubmit={handleAplicarMedicina} className="space-y-4 text-xs font-semibold">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Fecha de Aplicación</label>
                      <input type="date" name="fecha" required defaultValue={hoy} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-slate-50/50" />
                    </div>
                    <div>
                      <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Lote / Corral Destino</label>
                      <select name="loteId" required className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white font-bold text-slate-700">
                        <option value="">Selecciona Corral...</option>
                        {lotesActivosBodega.map(lote => {
                          const corral = listCorrales.find(c => c.id === lote.corralId);
                          return <option key={lote.id} value={lote.id}>{corral?.nombre || 'Corral'} • ingreso: {lote.fechaIngreso}</option>;
                        })}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Fármaco de Farmacia</label>
                      <select name="productoId" required className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 bg-white font-bold text-slate-700">
                        {inventarioMedico.map(m => <option key={m.id} value={m.id}>{m.nombre} (Disponible: {m.stock.toFixed(1)} {m.unidad})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Cantidad a Dosificar</label>
                      <input type="number" name="cantidad" step="0.01" min="0.01" required className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50 font-bold" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Ligar a Tarea de Agenda (opcional)</label>
                    <select name="tareaId" className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 bg-white font-semibold text-slate-600 text-xs">
                      <option value="">Sin ligar a tarea</option>
                      {tareasSanidadPendientesBodega.map(t => (
                        <option key={t.id} value={t.id}>{t.corral?.nombre} · {t.fechaObjetivo} · {t.tarea}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Diagnóstico / Comentarios</label>
                    <textarea name="observacion" placeholder="Escribe síntomas, diagnósticos, observaciones..." className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50 min-h-[80px]" />
                  </div>
                  <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl transition-colors shadow-lg shadow-rose-600/10 mt-2">Aplicar y Descontar Stock</button>
                </form>
              </div>
            </div>

            {/* INVENTARIO COMPLETO TABLE */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_4px_25px_rgb(0,0,0,0.005)] overflow-hidden">
              <div className="p-5 border-b border-slate-50 bg-slate-900 text-white flex items-center justify-between">
                <h3 className="font-extrabold text-base">Inventario de Medicinas en Bodega</h3>
                <span className="text-[10px] text-emerald-400/90 font-bold uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Tiempo Real</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-4 pl-6">Medicamento</th>
                      <th className="p-4 text-center">Categoría</th>
                      <th className="p-4 text-center">Stock Físico</th>
                      <th className="p-4 text-right">Costo Promedio</th>
                      <th className="p-4 text-right">Valor Stock</th>
                      <th className="p-4 pr-6">Lote Vencimiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {inventarioMedico.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 pl-6">
                          <p className="font-bold text-slate-800">{item.nombre}</p>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Mínimo Crítico: {item.stockMinimo} {item.unidad}</p>
                        </td>
                        <td className="p-4 text-center text-xs font-bold text-slate-500">{item.categoria}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full font-black text-xs border ${item.bajoStock ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                            {item.stock.toFixed(1)} {item.unidad}
                          </span>
                        </td>
                        <td className="p-4 text-right font-semibold text-slate-600">{formatearMoneda(item.costoPromedio)}</td>
                        <td className="p-4 text-right font-black text-indigo-600">{formatearMoneda(item.valorStock)}</td>
                        <td className="p-4 text-xs font-medium text-slate-500 pr-6">
                          {item.proximoVencimiento ? `${item.proximoVencimiento.vencimiento} (${item.proximoVencimiento.diffDias} días)` : 'Sin lote/vence registrado'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* CATÀLOGO FORM */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_4px_25px_rgb(0,0,0,0.005)]">
                <h3 className="font-extrabold text-slate-800 text-base mb-4 flex items-center gap-2 border-b border-slate-50 pb-3"><Plus size={18} className="text-indigo-600" /> Catálogo Farmacéutico</h3>
                <form onSubmit={handleAgregarMedicamentoCatalogo} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 bg-slate-50 p-4 border border-slate-100 rounded-xl">
                  <input name="nombre" required placeholder="Nombre fármaco" className="p-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs bg-white" />
                  <input name="categoria" placeholder="Categoría (Ej. Hidratante)" className="p-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs bg-white" />
                  <input name="unidad" placeholder="Unidad (Ej. frasco, sobre)" className="p-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs bg-white" />
                  <input type="number" name="stockMinimo" step="0.01" placeholder="Stock mínimo" className="p-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs bg-white" />
                  <input type="number" name="diasAlertaVencimiento" placeholder="Alerta vencimiento (Días)" className="p-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs bg-white col-span-1 sm:col-span-2" />
                  <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl px-4 py-2.5 text-xs col-span-1 sm:col-span-2">Agregar Producto</button>
                </form>
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {listCatalogoMedico.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{m.nombre}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{m.categoria} • {m.unidad} • min: {m.stockMinimo}</p>
                      </div>
                      <button type="button" onClick={() => handleEliminarMedicamentoCatalogo(m.id)} className="text-slate-300 hover:text-rose-500 p-1 rounded-md transition-all"><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* MOVIMIENTOS */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_4px_25px_rgb(0,0,0,0.005)]">
                <h3 className="font-extrabold text-slate-800 text-base mb-4 flex items-center gap-2 border-b border-slate-50 pb-3"><CheckCircle size={18} className="text-rose-600" /> Bitácora Reciente</h3>
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
                  {[...listComprasMedicas.map(c => ({ ...c, movimiento: 'entrada' })), ...listUsosMedicos.map(u => ({ ...u, movimiento: 'salida' }))]
                    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
                    .slice(0, 30)
                    .map(mov => {
                      const lote = listLotes.find(l => l.id === mov.loteId);
                      const corral = listCorrales.find(c => c.id === lote?.corralId);
                      return (
                        <div key={`${mov.movimiento}_${mov.id}`} className="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                          <div>
                            <p className="font-bold text-slate-800">{mov.nombre}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{mov.fecha} • {mov.cantidad} {mov.unidad} {corral ? `• ${corral.nombre}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-bold ${mov.movimiento === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {mov.movimiento === 'entrada' ? '+' : '-'}{formatearMoneda(mov.costoTotal ?? mov.costo ?? 0)}
                            </span>
                            <button type="button" onClick={() => handleEliminarDato(mov.movimiento === 'entrada' ? 'compraMedica' : 'usoMedico', mov.id)} className="text-slate-300 hover:text-rose-500 p-1 rounded-md transition-all"><Trash2 size={15} /></button>
                          </div>
                        </div>
                      );
                    })}
                  {listComprasMedicas.length === 0 && listUsosMedicos.length === 0 && <p className="text-center text-slate-400 italic py-8 text-xs font-semibold">No hay movimientos médicos registrados.</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };


  const renderCalendario = () => {
    const hoy = todayIso();
    const lotesActivos = listLotes.filter(l => l.estado === 'Activo');

    const eventosSanidad = listTareasSanidad
      .filter(t => (t.estado || 'pendiente') === 'pendiente')
      .map(t => {
        const lote = listLotes.find(l => l.id === t.loteId);
        if (!lote || lote.estado !== 'Activo') return null;
        const corral = listCorrales.find(c => c.id === lote.corralId);
        const fecha = t.fechaObjetivo || (lote.fechaIngreso ? addDaysToIsoDate(lote.fechaIngreso, Number(t.dia) || 0) : '');
        if (!fecha) return null;
        return {
          id: `sanidad_${t.id}`,
          tipo: 'sanidad',
          fecha,
          titulo: t.tarea,
          detalle: t.producto || '',
          corralId: lote.corralId || '',
          corralNombre: corral?.nombre || 'Corral',
          tareaId: t.id,
          observacion: t.observacion || '',
          pesoEsperado: t.pesoEsperado || '',
          categoria: esTareaDeMedicamento(t) ? 'medicamento' : 'manejo',
          innosureDosis: t.innosureDosis || null,
          claseMedicamento: t.innosureDosis ? 'innosure' : claseDeMedicamento(t)
        };
      })
      .filter(Boolean);

    // Fecha a partir de la cual cada lote con machos enteros ya se puede vender.
    const eventosVentaHabilitada = lotesActivos.map(lote => {
      const plan = getPlanInnosure(lote);
      if (!plan.aplica || !plan.ventaHabilitadaDesde) return null;
      const corral = listCorrales.find(c => c.id === lote.corralId);
      return {
        id: `innosure_ok_${lote.id}`,
        tipo: 'ventaHabilitada',
        fecha: plan.ventaHabilitadaDesde,
        titulo: 'Venta habilitada',
        detalle: `Se cumplen las 3 semanas desde la 2ª dosis de Innosure (${plan.segundaDosis.fechaReal})`,
        corralId: lote.corralId || '',
        corralNombre: corral?.nombre || 'Corral',
        claseMedicamento: 'ventaOk'
      };
    }).filter(Boolean);

    const eventosVencimiento = inventarioMedico
      .filter(item => item.proximoVencimiento)
      .map(item => ({
        id: `vencimiento_${item.id}`,
        tipo: 'vencimiento',
        fecha: item.proximoVencimiento.vencimiento,
        titulo: `Vence: ${item.nombre}`,
        detalle: `Stock ${Number(item.stock).toFixed(1)} ${item.unidad}`,
        corralId: '',
        corralNombre: 'Bodega Médica'
      }));

    const eventosCierre = lotesActivos.map(lote => {
      const stats = calcularEstadisticasLote(lote);
      if (stats.pesoParaProyeccion <= 0 || stats.pesoParaProyeccion >= stats.pesoObjetivoLb || stats.adg <= 0) return null;
      const diasRestantes = Math.ceil((stats.pesoObjetivoLb - stats.pesoParaProyeccion) / stats.adg);
      if (diasRestantes < 0 || diasRestantes > 120) return null;
      const corral = listCorrales.find(c => c.id === lote.corralId);
      return {
        id: `cierre_${lote.id}`,
        tipo: 'cierre',
        fecha: addDaysToIsoDate(hoy, diasRestantes),
        titulo: `Posible fecha de venta: ${lote.nombre || lote.raza || 'Lote'}`,
        detalle: `Estimado a ${stats.pesoObjetivoLb} lb con la ganancia diaria actual`,
        corralId: lote.corralId || '',
        corralNombre: corral?.nombre || 'Corral'
      };
    }).filter(Boolean);

    const eventosManuales = listEventosCalendario.map(ev => {
      const corral = listCorrales.find(c => c.id === ev.corralId);
      return {
        id: `manual_${ev.id}`,
        tipo: 'manual',
        fecha: ev.fecha,
        titulo: ev.titulo,
        detalle: ev.nota || '',
        corralId: ev.corralId || '',
        corralNombre: ev.corralId ? (corral?.nombre || 'Corral') : 'General',
        manualId: ev.id
      };
    });

    // --- MATRIZ CORRAL x SEMANAS ---
    // Solo medicamentos reales y la habilitacion de venta: lo que se calendariza de
    // verdad en esta granja son sueros, desparasitacion e Innosure.
    const SEMANAS_VISIBLES = 14;
    const inicioSemana = (isoFecha) => {
      const d = parseLocalDate(isoFecha);
      if (!d) return null;
      const diaSemana = (d.getDay() + 6) % 7; // lunes = 0
      d.setDate(d.getDate() - diaSemana);
      return formatLocalIsoDate(d);
    };

    const semanaBase = inicioSemana(addDaysToIsoDate(hoy, -14));
    const semanas = Array.from({ length: SEMANAS_VISIBLES }, (_, i) => {
      const inicio = addDaysToIsoDate(semanaBase, i * 7);
      const d = parseLocalDate(inicio);
      return {
        inicio,
        fin: addDaysToIsoDate(inicio, 6),
        etiquetaMes: d.toLocaleDateString('es-GT', { month: 'short' }).replace('.', ''),
        dia: d.getDate(),
        esActual: inicio === inicioSemana(hoy)
      };
    });

    const eventosMatriz = [...eventosSanidad.filter(e => e.categoria === 'medicamento'), ...eventosVentaHabilitada]
      .filter(e => e.fecha && (calendarioFiltroCorral === 'todos' || e.corralId === calendarioFiltroCorral));

    const filasMatriz = listCorrales
      .map(corral => {
        const lote = lotesActivos.find(l => l.corralId === corral.id);
        if (!lote) return null;
        const plan = getPlanInnosure(lote);
        const eventosDelCorral = eventosMatriz.filter(e => e.corralId === corral.id);
        return {
          corral,
          lote,
          plan,
          celdas: semanas.map(sem => ({
            ...sem,
            eventos: eventosDelCorral.filter(e => e.fecha >= sem.inicio && e.fecha <= sem.fin)
          }))
        };
      })
      .filter(Boolean)
      .filter(fila => calendarioFiltroCorral === 'todos' || fila.corral.id === calendarioFiltroCorral);

    const todosLosEventos = [...eventosSanidad, ...eventosVencimiento, ...eventosCierre, ...eventosManuales, ...eventosVentaHabilitada]
      .filter(ev => ev.fecha)
      .map(ev => {
        const diffDias = Math.ceil((new Date(`${ev.fecha}T00:00:00`) - new Date(`${hoy}T00:00:00`)) / 86_400_000);
        return { ...ev, diffDias, vencida: diffDias < 0 };
      })
      .filter(ev => (calendarioFiltroCorral === 'todos' || ev.corralId === calendarioFiltroCorral) && (calendarioFiltroTipo === 'todos' || ev.tipo === calendarioFiltroTipo))
      .sort((a, b) => a.diffDias - b.diffDias);

    const resumen = {
      vencidos: todosLosEventos.filter(e => e.vencida).length,
      hoy: todosLosEventos.filter(e => e.diffDias === 0).length,
      semana: todosLosEventos.filter(e => e.diffDias >= 0 && e.diffDias <= 7).length
    };

    const TIPO_META = {
      sanidad: { label: 'Sanidad', icon: Syringe, className: 'bg-rose-50 text-rose-600 border-rose-100', dot: 'bg-rose-500' },
      vencimiento: { label: 'Vencimiento', icon: AlertCircle, className: 'bg-amber-50 text-amber-600 border-amber-100', dot: 'bg-amber-500' },
      cierre: { label: 'Cierre de lote', icon: TrendingUp, className: 'bg-indigo-50 text-indigo-600 border-indigo-100', dot: 'bg-indigo-500' },
      manual: { label: 'Personalizado', icon: Calendar, className: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-500' },
      ventaHabilitada: { label: 'Venta habilitada', icon: CheckCircle, className: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-500' }
    };

    const renderMatrizMedicamentos = () => (
      <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.015)] overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2"><Syringe size={17} className="text-indigo-500" /> Plan de medicamentos por corral</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Sueros, desparasitación e Innosure. Cada columna es una semana.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(CLASES_MEDICAMENTO).filter(([k]) => k !== 'otro').map(([clave, meta]) => (
              <span key={clave} className={`text-[10px] font-bold px-2 py-1 rounded-full border ${meta.chip}`}>{meta.emoji} {meta.label}</span>
            ))}
          </div>
        </div>

        {filasMatriz.length === 0 ? (
          <div className="py-12 text-center text-slate-400 italic font-semibold text-xs">No hay corrales activos con medicamentos programados.</div>
        ) : (
          <>
          {/* MÓVIL: la matriz no entra en un teléfono, así que se apila por corral. */}
          <div className="lg:hidden divide-y divide-slate-100">
            {filasMatriz.map(({ corral, plan, celdas }) => {
              const proximos = celdas.flatMap(c => c.eventos).filter(e => e.fecha >= hoy).slice(0, 3);
              const vencidos = celdas.flatMap(c => c.eventos).filter(e => e.fecha < hoy && e.tipo === 'sanidad');
              return (
                <button key={corral.id} onClick={() => { setCorralSeleccionado(corral); setVista('corralDetail'); setTabActiva('sanidad'); }} className="w-full text-left p-4 active:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-900 text-sm">{corral.nombre}</p>
                    {plan.aplica && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${plan.puedeVender ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {plan.puedeVender ? 'Venta OK' : 'Venta bloqueada'}
                      </span>
                    )}
                  </div>
                  {vencidos.length > 0 && (
                    <p className="text-[12px] text-rose-600 font-semibold mt-1.5">{vencidos.length} {vencidos.length === 1 ? 'atrasada' : 'atrasadas'}</p>
                  )}
                  {proximos.length === 0 ? (
                    <p className="text-[12px] text-slate-400 mt-1.5">Sin aplicaciones próximas</p>
                  ) : (
                    <div className="space-y-1 mt-2">
                      {proximos.map(ev => (
                        <p key={ev.id} className="text-[12px] text-slate-600 flex items-center gap-2">
                          <span>{(CLASES_MEDICAMENTO[ev.claseMedicamento] || CLASES_MEDICAMENTO.otro).emoji}</span>
                          <span className="font-semibold">{new Date(`${ev.fecha}T00:00:00`).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}</span>
                          <span className="text-slate-400 truncate">{ev.titulo}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/60">
                  <th className="sticky left-0 z-10 bg-slate-50/60 text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 w-44">Corral</th>
                  {semanas.map(sem => (
                    <th key={sem.inicio} className={`px-1 py-2.5 text-center border-b border-l border-slate-100 ${sem.esActual ? 'bg-emerald-50' : ''}`}>
                      <span className={`block text-[9px] font-black uppercase tracking-wider ${sem.esActual ? 'text-emerald-600' : 'text-slate-400'}`}>{sem.etiquetaMes}</span>
                      <span className={`block text-[11px] font-bold ${sem.esActual ? 'text-emerald-700' : 'text-slate-600'}`}>{sem.dia}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasMatriz.map(({ corral, plan, celdas }) => (
                  <tr key={corral.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="sticky left-0 z-10 bg-white px-4 py-3 border-b border-slate-100">
                      <button onClick={() => { setCorralSeleccionado(corral); setVista('corralDetail'); setTabActiva('sanidad'); }} className="text-left group">
                        <p className="font-bold text-slate-800 text-xs group-hover:text-emerald-600 transition-colors">{corral.nombre}</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          {plan.aplica
                            ? <span className="text-indigo-600">{plan.machosEnteros} machos enteros</span>
                            : plan.sexoRegistrado
                              ? <span>{plan.machos}M · {plan.hembras}H · sin Innosure</span>
                              : <span className="text-amber-600">Sin registrar sexo</span>}
                        </p>
                      </button>
                    </td>
                    {celdas.map(celda => (
                      <td key={celda.inicio} className={`px-1 py-2 text-center border-b border-l border-slate-100 align-middle ${celda.esActual ? 'bg-emerald-50/40' : ''}`}>
                        <div className="flex flex-col items-center gap-1">
                          {celda.eventos.map(ev => {
                            const meta = CLASES_MEDICAMENTO[ev.claseMedicamento] || CLASES_MEDICAMENTO.otro;
                            return (
                              <span
                                key={ev.id}
                                title={`${ev.corralNombre} · ${ev.fecha} · ${ev.titulo}${ev.detalle ? ` — ${ev.detalle}` : ''}`}
                                className={`text-[13px] leading-none cursor-default ${ev.fecha < hoy && ev.tipo === 'sanidad' ? 'opacity-40 grayscale' : ''}`}
                              >
                                {meta.emoji}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        {filasMatriz.some(f => f.plan.aplica && !f.plan.puedeVender) && (
          <div className="px-5 py-4 border-t border-slate-100 bg-amber-50/40 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Ventas bloqueadas por Innosure</p>
            {filasMatriz.filter(f => f.plan.aplica && !f.plan.puedeVender).map(f => (
              <p key={f.corral.id} className="text-[11px] text-amber-900 font-medium leading-relaxed">
                <strong>{f.corral.nombre}:</strong> {f.plan.motivoBloqueo}
              </p>
            ))}
          </div>
        )}
      </div>
    );

    const eventosPorFecha = todosLosEventos.reduce((acc, ev) => {
      if (!acc[ev.fecha]) acc[ev.fecha] = [];
      acc[ev.fecha].push(ev);
      return acc;
    }, {});
    const eventosVencidos = todosLosEventos.filter(e => e.vencida);
    const eventosDelDiaSeleccionado = eventosPorFecha[calendarioDiaSeleccionado] || [];

    const { year, month } = calendarioCursor;
    const primerDiaMes = new Date(year, month, 1);
    const diasEnMes = new Date(year, month + 1, 0).getDate();
    const offsetInicio = (primerDiaMes.getDay() + 6) % 7;
    const totalCeldas = Math.ceil((offsetInicio + diasEnMes) / 7) * 7;
    const celdasMes = Array.from({ length: totalCeldas }, (_, i) => {
      const diaNum = i - offsetInicio + 1;
      if (diaNum < 1 || diaNum > diasEnMes) return null;
      const fechaIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}`;
      return { diaNum, fechaIso, eventos: eventosPorFecha[fechaIso] || [] };
    });
    const nombreMes = primerDiaMes.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
    const irMesAnterior = () => setCalendarioCursor(prev => (prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 }));
    const irMesSiguiente = () => setCalendarioCursor(prev => (prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 }));
    const irHoy = () => {
      const d = new Date();
      setCalendarioCursor({ year: d.getFullYear(), month: d.getMonth() });
      setCalendarioDiaSeleccionado(hoy);
    };
    const fechaSeleccionadaFormateada = new Date(`${calendarioDiaSeleccionado}T00:00:00`).toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const renderEventoCard = (ev) => {
      const meta = TIPO_META[ev.tipo];
      const Icon = meta.icon;
      const esSanidad = ev.tipo === 'sanidad';
      const abierto = esSanidad && agendaDetalleAbierto === ev.tareaId;
      return (
        <div key={ev.id} className="border border-slate-100 rounded-2xl bg-white overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.008)]">
          <div className="p-4 flex items-start justify-between gap-3">
            <div
              role={esSanidad ? 'button' : undefined}
              tabIndex={esSanidad ? 0 : undefined}
              onClick={esSanidad ? () => setAgendaDetalleAbierto(abierto ? null : ev.tareaId) : undefined}
              className={`flex items-start gap-3 min-w-0 ${esSanidad ? 'cursor-pointer' : ''}`}
            >
              <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${meta.className}`}>
                <Icon size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg">{ev.corralNombre}</span>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${meta.className}`}>{meta.label}</span>
                  {ev.vencida && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">Vencido</span>}
                </div>
                <p className="font-bold text-slate-800 text-sm leading-snug">{ev.titulo}</p>
                {ev.detalle && <p className="text-xs text-slate-500 mt-0.5">{ev.detalle}</p>}
                {ev.pesoEsperado && (
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">
                    Peso esperado a esta edad: <span className="bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded">{ev.pesoEsperado}</span>
                  </p>
                )}
                <p className="text-[10px] text-slate-400 font-semibold mt-1">{ev.fecha}</p>
              </div>
            </div>
            {ev.tipo === 'manual' && (
              <button type="button" onClick={() => handleEliminarEventoCalendario(ev.manualId)} className="text-slate-300 hover:text-rose-500 shrink-0 p-1.5 transition-colors">
                <Trash2 size={16} />
              </button>
            )}
            {esSanidad && (
              <button type="button" onClick={() => handleActualizarTareaSanidad(ev.tareaId, { estado: 'hecho' })} className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] transition-colors">
                Completar
              </button>
            )}
          </div>

          {esSanidad && abierto && (
            <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-2.5">
              <textarea
                value={ev.observacion || ''}
                onChange={(e) => handleActualizarTareaSanidad(ev.tareaId, { observacion: e.target.value })}
                placeholder="Escribe observaciones sanitarias o de dosis..."
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-xs min-h-[70px] bg-white transition-all shadow-inner"
              />
              <button type="button" onClick={() => handleActualizarTareaSanidad(ev.tareaId, { estado: 'omitido' })} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl text-xs transition-colors">
                Omitir Paso
              </button>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="max-lg:hidden text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5 leading-none">
              <Calendar size={28} className="text-emerald-500 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.2)]" /> Calendario
            </h2>
            <p className="text-slate-500 text-sm mt-1.5">Qué medicamento le toca a cada corral y cuándo, más vencimientos y cierres estimados.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center sm:min-w-[320px]">
            <div className="bg-rose-50/50 border border-rose-100/50 rounded-xl px-4 py-2.5"><p className="text-lg font-black text-rose-600">{resumen.vencidos}</p><p className="text-[9px] font-bold uppercase text-slate-400 mt-0.5">Vencidos</p></div>
            <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-xl px-4 py-2.5"><p className="text-lg font-black text-emerald-600">{resumen.hoy}</p><p className="text-[9px] font-bold uppercase text-slate-400 mt-0.5">Hoy</p></div>
            <div className="bg-blue-50/50 border border-blue-100/50 rounded-xl px-4 py-2.5"><p className="text-lg font-black text-blue-600">{resumen.semana}</p><p className="text-[9px] font-bold uppercase text-slate-400 mt-0.5">Esta semana</p></div>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.015)] p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <select value={calendarioFiltroCorral} onChange={(e) => setCalendarioFiltroCorral(e.target.value)} className="p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-xs font-semibold">
            <option value="todos">Todos los corrales</option>
            {listCorrales.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'todos', label: 'Todos' },
              { value: 'sanidad', label: 'Sanidad' },
              { value: 'vencimiento', label: 'Vencimientos' },
              { value: 'cierre', label: 'Cierre de lote' },
              { value: 'ventaHabilitada', label: 'Venta habilitada' },
              { value: 'manual', label: 'Personalizados' }
            ].map(op => (
              <button key={op.value} type="button" onClick={() => setCalendarioFiltroTipo(op.value)} className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-colors ${calendarioFiltroTipo === op.value ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                {op.label}
              </button>
            ))}
          </div>
        </div>

        {corralesSinCalendario.length > 0 && (() => {
          const totalAgregar = corralesSinCalendario.reduce((s, c) => s + c.faltan, 0);
          const totalQuitar = corralesSinCalendario.reduce((s, c) => s + c.sobran, 0);
          const visibles = corralesSinCalendario.slice(0, 4);
          const restantes = corralesSinCalendario.length - visibles.length;

          return (
            <div className="bg-white border border-indigo-100 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.015)] overflow-hidden">
              <div className="p-5 flex flex-col lg:flex-row lg:items-center gap-5">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                  <Syringe size={20} className="text-indigo-500" />
                </div>

                <div className="flex-1 min-w-0 space-y-2.5">
                  <div>
                    <p className="font-extrabold text-slate-800 text-sm leading-tight">Hay calendarios sanitarios por generar</p>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                      {[
                        totalAgregar > 0 && <><strong key="a" className="text-emerald-600">{totalAgregar} tarea{totalAgregar === 1 ? '' : 's'}</strong> por programar</>,
                        totalQuitar > 0 && <><strong key="q" className="text-slate-600">{totalQuitar}</strong> que ya no aplican</>
                      ].filter(Boolean).reduce((prev, curr, i) => i === 0 ? [curr] : [...prev, ' · ', curr], [])}
                      {'. '}Lo que ya se aplicó queda intacto.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {visibles.map(c => (
                      <span key={c.lote.id} className="bg-slate-50 border border-slate-150 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-lg">
                        {c.nombre}
                        {c.faltan > 0 && <span className="text-emerald-600 ml-1">+{c.faltan}</span>}
                        {c.sobran > 0 && <span className="text-slate-400 ml-1">−{c.sobran}</span>}
                      </span>
                    ))}
                    {restantes > 0 && (
                      <span className="text-[10px] font-bold text-slate-400 px-1" title={corralesSinCalendario.slice(4).map(c => c.nombre).join(', ')}>
                        y {restantes} más
                      </span>
                    )}
                  </div>
                </div>

                <button type="button" onClick={handleGenerarCalendariosFaltantes} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-wider px-5 py-3 rounded-xl transition-colors shadow-md shadow-indigo-600/15 shrink-0">
                  Generar lo que falta
                </button>
              </div>
            </div>
          );
        })()}

        {renderMatrizMedicamentos()}

        {eventosVencidos.length > 0 && (
          <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Vencidos · {eventosVencidos.length}</p>
            <div className="space-y-3">
              {eventosVencidos.map(renderEventoCard)}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.015)] p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <button type="button" onClick={irMesAnterior} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
                <ChevronRight size={18} className="rotate-180" />
              </button>
              <div className="text-center">
                <h3 className="font-black text-slate-800 text-base capitalize">{nombreMes}</h3>
                <button type="button" onClick={irHoy} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider mt-0.5">Ir a hoy</button>
              </div>
              <button type="button" onClick={irMesSiguiente} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5 text-center">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <div key={i} className="text-[10px] font-black text-slate-400 uppercase py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {celdasMes.map((celda, i) => {
                if (!celda) return <div key={i} />;
                const esHoy = celda.fechaIso === hoy;
                const esSeleccionado = celda.fechaIso === calendarioDiaSeleccionado;
                const tiposDelDia = [...new Set(celda.eventos.map(e => e.tipo))];
                const tieneVencido = celda.eventos.some(e => e.vencida);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCalendarioDiaSeleccionado(celda.fechaIso)}
                    className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      esSeleccionado ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' :
                      esHoy ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                      tieneVencido ? 'bg-rose-50/60 border-rose-100 text-slate-700' :
                      'bg-white border-slate-100 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-bold">{celda.diaNum}</span>
                    {tiposDelDia.length > 0 && (
                      <div className="flex gap-0.5 flex-wrap justify-center px-0.5">
                        {tiposDelDia.slice(0, 4).map(tipo => (
                          <span key={tipo} className={`w-1.5 h-1.5 rounded-full ${esSeleccionado ? 'bg-white' : TIPO_META[tipo].dot}`} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.015)] p-6">
            <h3 className="font-bold text-slate-800 text-sm capitalize mb-1">{fechaSeleccionadaFormateada}</h3>
            <p className="text-xs text-slate-400 mb-4">{eventosDelDiaSeleccionado.length} evento(s) este día.</p>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
              {eventosDelDiaSeleccionado.map(renderEventoCard)}
              {eventosDelDiaSeleccionado.length === 0 && (
                <p className="text-slate-400 italic text-center py-8 text-xs font-semibold">Sin eventos este día.</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
          <h3 className="font-bold text-md text-slate-800 mb-2">Agregar evento personalizado</h3>
          <p className="text-xs text-slate-400 mb-4">Para recordatorios que no dependen del protocolo sanitario, como visitas o entregas.</p>
          <form onSubmit={handleAgregarEventoCalendario} className="grid grid-cols-1 md:grid-cols-[1fr_150px_150px_auto] gap-3">
            <input name="titulo" required placeholder="Ej. Visita del veterinario" className="p-2.5 px-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 text-sm transition-all" />
            <input type="date" name="fecha" required defaultValue={hoy} className="p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-sm transition-all" />
            <select name="corralId" className="p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-sm transition-all">
              <option value="">Sin corral</option>
              {listCorrales.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <button type="submit" className="bg-slate-950 hover:bg-slate-900 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-md">Agregar</button>
            <input name="nota" placeholder="Nota (opcional)" className="p-2.5 px-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 text-sm transition-all md:col-span-4" />
          </form>
        </div>
      </div>
    );
  };


  const renderLaboratorio = () => {
    const matLbs = labTotalLbs * (labPorcMezcla / 100);
    const concLbs = labTotalLbs - matLbs;

    const adits = listReglasMezcla.filter(r => r.base === labMatPrima).map(r => ({
      tipo: r.aditivo,
      lbs: matLbs * r.factor
    }));

    let costoMezcla = 0;
    const precioConc = getPrecioPorLibra(labConc);
    const precioMat = getPrecioPorLibra(labMatPrima);
    costoMezcla += (concLbs * precioConc) + (matLbs * precioMat);

    adits.forEach(a => {
      const pAditivo = getPrecioPorLibra(a.tipo);
      const costoA = a.lbs * pAditivo;
      costoMezcla += costoA;
    });

    const costoPuro = labTotalLbs * precioConc;
    const ahorroEnLote = costoPuro - costoMezcla;

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="max-lg:hidden text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center leading-none">
              <Beaker className="mr-3 text-indigo-600 filter drop-shadow-[0_0_8px_rgba(79,70,229,0.25)]" size={28} /> Laboratorio de Mezclas
            </h2>
            <p className="text-slate-500 text-sm mt-1.5">Diseña y prueba recetas virtualmente antes de dárselas a los animales para proyectar su rentabilidad y ahorro.</p>
          </div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shrink-0 self-start md:self-auto">
            Simulador de Raciones
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
            <h3 className="font-extrabold text-base text-slate-800 mb-6 flex items-center gap-2"><Settings size={18} className="text-indigo-500" /> Parámetros de la Prueba</h3>

            <div className="space-y-5 text-xs font-semibold">
              <div>
                <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Tamaño del Lote a Preparar</label>
                <div className="flex items-center">
                  <input type="number" value={labTotalLbs} onChange={e => setLabTotalLbs(parseFloat(e.target.value) || 0)} className="flex-1 p-3 border border-slate-200 rounded-l-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 text-lg font-black bg-slate-50/50" />
                  <span className="bg-slate-150 border-y border-r border-slate-200 px-4 py-3 rounded-r-xl font-bold text-slate-500">Libras</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Porcentaje de Inclusión (Materia Prima)</label>
                <div className="flex items-center gap-4">
                  <input type="range" min="0" max="100" value={labPorcMezcla} onChange={e => setLabPorcMezcla(parseInt(e.target.value))} className="flex-1 accent-indigo-600" />
                  <span className="font-black text-2xl text-indigo-600 w-16 text-right">{labPorcMezcla}%</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Concentrado Comercial Base</label>
                <select value={labConc} onChange={e => setLabConc(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none bg-slate-50/50 font-bold text-slate-850 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                  {listCatAlimentos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Materia Prima a Añadir</label>
                <select value={labMatPrima} onChange={e => setLabMatPrima(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none bg-slate-50/50 font-bold text-slate-850 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                  {listCatIngredientes.map(i => <option key={i.id} value={i.nombre}>{i.nombre}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800 text-white">
              <h3 className="font-black text-lg mb-4 text-emerald-400">Receta Formulada</h3>
              <div className="space-y-3.5 text-sm font-semibold">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-300">{labConc}</span>
                  <span className="font-black text-base">{concLbs.toFixed(2)} lbs</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-emerald-300">{labMatPrima}</span>
                  <span className="font-black text-base text-emerald-300">{matLbs.toFixed(2)} lbs</span>
                </div>
                {adits.map((a, i) => (
                  <div key={i} className="flex justify-between items-center pb-2 pl-4 border-l-2 border-amber-500/50">
                    <span className="text-amber-200">+ {a.tipo} (Auto)</span>
                    <span className="font-bold text-amber-200">{a.lbs.toFixed(3)} lbs</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.015)] border border-slate-100">
              <h3 className="font-extrabold text-base text-slate-800 mb-4">Análisis Financiero</h3>

              <div className="space-y-4 mb-6 text-sm font-semibold">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-medium">Costo si fuera 100% Puro:</span>
                  <span className="font-bold text-rose-500">{formatearMoneda(costoPuro)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                  <span className="text-indigo-900 font-bold">Costo Real de la Mezcla:</span>
                  <span className="font-black text-indigo-700 text-lg">{formatearMoneda(costoMezcla)}</span>
                </div>
              </div>

              <div className="text-center bg-emerald-50 border border-emerald-100 p-6 rounded-xl">
                <p className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-1.5">Ahorro Proyectado</p>
                <p className={`text-3xl font-black tracking-tight ${ahorroEnLote > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {ahorroEnLote > 0 ? '+' : ''}{formatearMoneda(ahorroEnLote)}
                </p>
                <p className="text-xs font-bold text-emerald-700 mt-2">Equivale a {formatearMoneda(costoMezcla / labTotalLbs)} por Libra.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const renderHistorial = () => {
    const lotesCerrados = listLotes.filter(l => l.state === 'Cerrado' || l.estado === 'Cerrado').sort((a, b) => new Date(b.fechaSalida || 0) - new Date(a.fechaSalida || 0));

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="max-lg:hidden text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center leading-none">
              <ClipboardList className="mr-3 text-indigo-600 filter drop-shadow-[0_0_8px_rgba(79,70,229,0.25)]" size={28} /> Historial de Lotes Finalizados
            </h2>
            <p className="text-slate-500 text-sm mt-1.5">Consulta los reportes financieros y zootécnicos de las engordas pasadas.</p>
          </div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shrink-0 self-start md:self-auto">
            Registro Histórico
          </div>
        </div>

        {lotesCerrados.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)] text-center max-w-2xl mx-auto mt-8">
            <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-inner">
              <Archive size={36} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No hay lotes en el historial</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Cuando finalices y vendas un lote activo, aparecerá automáticamente aquí para tu registro histórico.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lotesCerrados.map(lote => {
              const corralInfo = listCorrales.find(c => c.id === lote.corralId) || { nombre: 'Corral Eliminado' };
              const st = calcularEstadisticasLote(lote);
              const fechaIngresoStr = new Date(lote.fechaIngreso + 'T00:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
              const fechaSalidaStr = lote.fechaSalida ? new Date(lote.fechaSalida + 'T00:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

              return (
                <div key={lote.id} className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-lg hover:border-indigo-500/20 transition-all duration-300 overflow-hidden flex flex-col group">
                  <div className="bg-slate-900 p-5 text-white flex justify-between items-center border-b border-slate-800">
                    <div>
                      <h4 className="font-extrabold text-base tracking-tight">{corralInfo.nombre}</h4>
                      <p className="text-[11px] text-slate-400 mt-1 font-medium">{fechaIngresoStr} al {fechaSalidaStr}</p>
                    </div>
                    <div className="bg-white/10 p-2 rounded-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                      <CheckCircle size={18} className="text-emerald-400 filter drop-shadow-[0_0_4px_rgba(52,211,153,0.4)]" />
                    </div>
                  </div>
                  <div className="p-5 space-y-3.5 flex-1 text-sm">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                      <span className="text-slate-500 font-medium">Cerdos Vendidos:</span>
                      <span className="font-bold text-slate-800">{st.ventasLote.reduce((total, sale) => total + (sale.cantidadCerdos || 0), 0)} <span className="text-[10px] font-semibold text-slate-400 uppercase">de {lote.cantidad}</span></span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                      <span className="text-slate-500 font-medium">Mortalidad:</span>
                      <span className={`font-bold ${st.mortalidadPorcentaje > 5 ? 'text-rose-500' : 'text-slate-800'}`}>{st.mortalidadPorcentaje.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                      <span className="text-slate-500 font-medium">Conversión (FCA):</span>
                      <span className={`font-bold ${claseFca(st, 'text-indigo-600', 'text-orange-600')}`} title={tituloFca(st)}>{formatFca(st)}</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner mt-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Utilidad Neta del Lote</p>
                      <p className={`text-2xl font-black tracking-tight ${st.utilidadNeta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatearMoneda(st.utilidadNeta)}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-2">
                    <button
                      onClick={() => { setLoteHistorialSeleccionado(lote); setVista('reporteHistorial'); }}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-all text-xs flex items-center justify-center shadow-sm shadow-indigo-500/10 gap-1.5"
                    >
                      <FileText size={14} /> Ver Reporte Final
                    </button>
                    <button
                      onClick={() => handleEliminarLoteHistorial(lote.id)}
                      className="px-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200 bg-white"
                      title="Eliminar del historial permanentemente"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderReporteHistorial = () => {
    const lote = loteHistorialSeleccionado;
    if (!lote) {
      return (
        <div className="p-8 text-center max-w-lg mx-auto">
          <p className="text-slate-600 mb-4 font-semibold">No hay un lote histórico seleccionado.</p>
          <button onClick={() => setVista('historial')} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-bold">Volver al historial</button>
        </div>
      );
    }

    const stats = calcularEstadisticasLote(lote);
    const corral = listCorrales.find(c => c.id === lote.corralId);
    const soldCount = stats.cantidadVendida;

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-center print:hidden border-b border-slate-100 pb-4">
          <button onClick={() => setVista('historial')} className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1">
            <ChevronRight size={20} className="rotate-180" /> Volver al Historial
          </button>
          <button onClick={() => descargarPDF('historical-report', `Reporte_Lote_${lote.id}.pdf`)} className="bg-slate-950 hover:bg-slate-900 text-white font-bold py-2.5 px-5 rounded-xl shadow-md transition-all flex items-center gap-2 text-sm">
            <Download size={16} /> Descargar PDF
          </button>
        </div>

        <section id="historical-report" className="bg-white p-4 sm:p-6 lg:p-12 rounded-3xl border border-slate-100 shadow-[0_15px_50px_rgba(0,0,0,0.015)] bg-gradient-to-b from-white to-slate-50/50">
          <header className="border-b-4 border-slate-900 pb-6 mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-indigo-600">Reporte final de trazabilidad</p>
              <h2 className="text-3xl font-black text-slate-900 mt-2">{corral?.nombre || 'Corral eliminado'}</h2>
              <p className="text-slate-500 mt-1 font-medium">{lote.fechaIngreso} — {lote.fechaSalida || 'Sin fecha de cierre'}</p>
            </div>
            <div className="text-left md:text-right border-l-2 md:border-l-0 md:border-r-2 border-slate-200 pl-4 md:pl-0 md:pr-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Raza / Línea</p>
              <p className="font-extrabold text-slate-800 text-lg leading-tight mt-1">{lote.raza || 'Estándar'}</p>
            </div>
          </header>

          {stats.fechaInvalida && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl font-bold text-sm flex items-center gap-2">
              <AlertTriangle size={18} className="shrink-0" />
              Las fechas del lote son inconsistentes y deben corregirse.
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Lechones Iniciales', value: lote.cantidad || 0, color: 'text-slate-800' },
              { label: 'Cerdos Vendidos', value: soldCount, color: 'text-emerald-600' },
              { label: 'Mortalidad final', value: `${stats.mortalidadPorcentaje.toFixed(1)}%`, color: stats.mortalidadPorcentaje > 5 ? 'text-rose-500' : 'text-slate-800' },
              { label: 'FCA Global', value: formatFca(stats), color: claseFca(stats, 'text-indigo-600', 'text-orange-600'), title: tituloFca(stats) }
            ].map(item => (
              <div key={item.label} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" title={item.title}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{item.label}</p>
                <p className={`text-2xl font-black mt-2 leading-none ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-extrabold text-base text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Activity size={18} className="text-indigo-600" /> Resultados Productivos
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Duración:</span><strong className="text-slate-800">{stats.diasLote} días</strong></div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Peso Promedio Inicial:</span><strong className="text-slate-800">{stats.pesoInicial.toFixed(1)} lb</strong></div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Peso Promedio Final {stats.pesoEsEstimado ? '(Estimado)' : '(Venta)'}:</span><strong className="text-slate-800" title={tituloPesoLb(stats)}>{formatPesoLb(stats)}</strong></div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Libras Vendidas:</span><strong className="text-slate-800">{stats.librasVendidas.toFixed(1)} lb</strong></div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Peso Producido para FCA:</span><strong className="text-slate-800">{stats.pesoProducidoLb.toFixed(1)} lb</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Alimento Registrado:</span><strong className="text-slate-800">{stats.consumoTotalLb.toFixed(1)} lb</strong></div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="font-extrabold text-base text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-600" /> Resultados Financieros
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Costo Acumulado (Insumos):</span><strong className="text-rose-500">{formatearMonedaNeg(stats.costoInvertidoTotal)}</strong></div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Mano de Obra (Pagado):</span><strong className="text-rose-500">{formatearMonedaNeg(lote.manoObra)}</strong></div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Ventas Reales Totales:</span><strong className="text-emerald-600">+{formatearMoneda(stats.ingresoRealVentas)}</strong></div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Valor Estimado en Vivo:</span><strong className="text-slate-500">{formatearMoneda(stats.ingresoEstimadoVivos)}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Ingresos Totales (Reales + Est.):</span><strong className="text-slate-800">{formatearMoneda(stats.ingresoEstimado)}</strong></div>
                </div>
              </div>
              <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex justify-between items-center shadow-inner mt-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Utilidad Neta:</span>
                <span className={`text-2xl font-black ${stats.utilidadNeta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatearMoneda(stats.utilidadNeta)}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  };
  const renderConfiguracion = () => (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="max-lg:hidden text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center leading-none">
            <Settings className="mr-3 text-blue-500 filter drop-shadow-[0_0_8px_rgba(59,130,246,0.25)]" size={28} /> Ajustes del Sistema
          </h2>
          <p className="text-slate-500 text-sm mt-1.5">Administra corrales, catálogo de insumos, fórmulas de mezcla y parámetros matemáticos.</p>
        </div>
        <div className="max-lg:hidden text-xs font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shrink-0 self-start md:self-auto">
          Configuración Global
        </div>
      </div>

      {/* SECCIÓN: CORRALES */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2"><Box className="text-emerald-500" size={18} /> Gestión de Corrales y Rótulos QR</h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => abrirModalQrTolva(null, 'imprimir')} className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors">
              <QrCode size={15} className="text-emerald-400" /> Imprimir QRs de Corrales (PDF)
            </button>
            <button type="button" onClick={() => abrirModalQrTolva(null, 'escanear')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors">
              <ScanLine size={15} /> Escanear Tolva
            </button>
          </div>
        </div>
        <form onSubmit={handleAgregarCorral} className="grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <input name="nombre" placeholder="Nombre corral (Ej. Corral 1)" required className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm" />
          <input name="capacidad" type="number" placeholder="Capacidad (Cerdos)" required className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm" />
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl transition-colors shadow-md text-sm flex items-center justify-center gap-1.5"><Plus size={16} /> Crear Corral</button>
        </form>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {listCorrales.map(c => (
            <div key={c.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-emerald-500/20 transition-all">
              <div>
                <p className="font-bold text-slate-800 text-sm">{c.nombre}</p>
                <p className="text-xs text-slate-400 mt-0.5">Capacidad: {c.capacidad} cerdos</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => abrirModalQrTolva(c, 'escanear')} title="Abrir descarga rápida QR de este corral" className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all">
                  <QrCode size={16} />
                </button>
                <button onClick={() => handleEliminarCorral(c.id)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* CATÁLOGO DE CONCENTRADOS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col">
          <h3 className="font-extrabold text-base text-slate-800 mb-2 flex items-center gap-2"><DollarSign className="text-blue-500" size={18} /> Catálogo de Concentrados</h3>
          <p className="text-slate-400 text-xs mb-4">Actualiza precios y pesos de las marcas comerciales que utilizas.</p>

          <form onSubmit={handleAgregarAlimentoCatalogo} className="flex flex-col gap-3 mb-6 bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
            <input type="text" name="nombre" placeholder="Nombre comercial (Ej. VITALECHON 1)" required className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-xs bg-white" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" name="libras" placeholder="Lbs por Saco" required min="1" step="0.1" className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-xs bg-white" />
              <input type="number" step="0.01" name="precio" placeholder="Precio Saco (Q)" required min="0" className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-xs bg-white" />
            </div>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2.5 rounded-lg transition-colors flex items-center justify-center shadow-md text-xs gap-1">
              <Plus size={16} /> Agregar Concentrado
            </button>
          </form>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1 flex-1 scrollbar-thin">
            {listCatAlimentos.map(item => (
              <div key={item.id} className="flex flex-col p-4 border border-slate-100 rounded-xl bg-slate-50/80 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-xs text-slate-800">{item.nombre}</span>
                  <button onClick={() => handleEliminarAlimentoCatalogo(item.id)} className="text-slate-300 hover:text-rose-500 p-1 rounded-md transition-all" title="Eliminar"><Trash2 size={14} /></button>
                </div>
                <div className="flex items-center gap-4 justify-between text-xs">
                  <div className="flex items-center border border-slate-200 bg-white rounded-lg px-2.5 py-1">
                    <span className="text-slate-400 font-bold mr-1">Peso:</span>
                    <input type="number" step="1" value={item.librasPorSaco} onChange={(e) => setCatalogoAlimento(prev => safeArr(prev).map(i => i.id === item.id ? { ...i, librasPorSaco: parseFloat(e.target.value) || 0 } : i))} className="w-10 text-center font-bold text-slate-700 outline-none" />
                    <span className="text-slate-400 font-bold ml-0.5">lb</span>
                  </div>
                  <div className="flex items-center border border-slate-200 bg-white rounded-lg px-2.5 py-1">
                    <span className="text-slate-400 font-bold mr-1">Precio: Q</span>
                    <input type="number" value={item.precioSaco} onChange={(e) => setCatalogoAlimento(prev => safeArr(prev).map(i => i.id === item.id ? { ...i, precioSaco: parseFloat(e.target.value) || 0 } : i))} className="w-16 text-right font-black text-blue-600 outline-none" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CATÁLOGO DE INGREDIENTES */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col">
          <h3 className="font-extrabold text-base text-slate-800 mb-2 flex items-center gap-2"><Leaf className="text-amber-500" size={18} /> Catálogo de Ingredientes</h3>
          <p className="text-slate-400 text-xs mb-4">Agrega maíz, soya u otros aditivos de mezcla en libras.</p>

          <form onSubmit={handleAgregarIngredienteCatalogo} className="flex flex-col gap-3 mb-6 bg-amber-50/50 p-4 rounded-xl border border-amber-100/50">
            <input type="text" name="nombre" placeholder="Nombre ingrediente (Ej. MAÍZ AMARILLO)" required className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 text-xs bg-white" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" name="libras" placeholder="Lbs por QQ/Saco" required min="1" step="0.1" className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 text-xs bg-white" />
              <input type="number" step="0.01" name="precio" placeholder="Precio Insumo (Q)" required min="0" className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 text-xs bg-white" />
            </div>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2.5 rounded-lg transition-colors flex items-center justify-center shadow-md text-xs gap-1">
              <Plus size={16} /> Agregar Ingrediente
            </button>
          </form>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1 flex-1 scrollbar-thin">
            {listCatIngredientes.map(item => (
              <div key={item.id} className="flex flex-col p-4 border border-slate-100 rounded-xl bg-slate-50/80 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-xs text-slate-800">{item.nombre}</span>
                  <button onClick={() => handleEliminarIngredienteCatalogo(item.id)} className="text-slate-300 hover:text-rose-500 p-1 rounded-md transition-all" title="Eliminar"><Trash2 size={14} /></button>
                </div>
                <div className="flex items-center gap-4 justify-between text-xs">
                  <div className="flex items-center border border-slate-200 bg-white rounded-lg px-2.5 py-1">
                    <span className="text-slate-400 font-bold mr-1">Peso:</span>
                    <input type="number" step="1" value={item.librasPorSaco} onChange={(e) => setCatalogoIngredientes(prev => safeArr(prev).map(i => i.id === item.id ? { ...i, librasPorSaco: parseFloat(e.target.value) || 0 } : i))} className="w-10 text-center font-bold text-slate-700 outline-none" />
                    <span className="text-slate-400 font-bold ml-0.5">lb</span>
                  </div>
                  <div className="flex items-center border border-slate-200 bg-white rounded-lg px-2.5 py-1">
                    <span className="text-slate-400 font-bold mr-1">Precio: Q</span>
                    <input type="number" value={item.precioSaco} onChange={(e) => setCatalogoIngredientes(prev => safeArr(prev).map(i => i.id === item.id ? { ...i, precioSaco: parseFloat(e.target.value) || 0 } : i))} className="w-16 text-right font-black text-amber-700 outline-none" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NOTIFICACIONES Y PARÁMETROS SCHAEFFER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
          <h4 className="font-extrabold text-slate-800 text-sm mb-2 flex items-center gap-2"><Scale size={16} className="text-emerald-600" /> Transición de Alimento</h4>
          <p className="text-slate-400 text-xs mb-4">Establece el peso mínimo a partir del cual el ganado está listo para consumir raciones formuladas.</p>
          <div className="flex items-center">
            <input type="number" value={pesoAlertaMezcla} onChange={(e) => setPesoAlertaMezcla(parseFloat(e.target.value) || 0)} className="w-24 p-2.5 text-center border border-emerald-300 rounded-l-xl outline-none focus:ring-2 focus:ring-emerald-500 font-black text-emerald-800 bg-emerald-50/20 text-sm" />
            <span className="bg-emerald-600 text-white font-extrabold px-5 py-2.5 rounded-r-xl border-y border-r border-emerald-600 text-xs uppercase tracking-wider">Libras</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
          <h4 className="font-extrabold text-slate-800 text-sm mb-2 flex items-center gap-2"><Calculator size={16} className="text-indigo-600" /> Divisor de Schaeffer</h4>
          <p className="text-slate-400 text-xs mb-4">Ajusta la constante matemática utilizada para inferir el peso del ganado en base a mediciones métricas.</p>
          <div className="flex items-center gap-3">
            <input type="number" step="0.1" value={constanteSchaeffer} onChange={(e) => setConstanteSchaeffer(parseFloat(e.target.value) || 400)} className="w-32 p-2.5 text-center border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-black text-indigo-700 bg-indigo-50/20 text-sm" />
            <span className="text-slate-500 text-xs font-semibold">(Por defecto: 400)</span>
          </div>
        </div>
      </div>

      {/* SECCIÓN OSCURA: REGLAS ADITIVOS */}
      <div className="bg-emerald-600 p-4 sm:p-6 lg:p-8 rounded-3xl border border-emerald-700 shadow-card text-slate-100">
        <h3 className="font-extrabold text-xl mb-2 flex items-center text-white gap-2.5">
          <BookOpen className="text-emerald-400" size={24} /> Reglas de Aditivos para Mezclas
        </h3>
        <p className="text-slate-400 text-xs mb-6 max-w-2xl">
          Configura adiciones automáticas por cada libra de materia prima consumida. El formulador aplicará estas proporciones dinámicamente en los corrales.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-slate-950/40 p-5 rounded-2xl border border-slate-800/60 shadow-inner">
            <h4 className="font-bold text-sm text-white mb-4">Crear Nueva Regla</h4>
            <form onSubmit={handleAgregarReglaMezcla} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-widest mb-1.5">Por cada 1 libra de Base:</label>
                <select value={formReglaBase} onChange={(e) => setFormReglaBase(e.target.value)} required className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 text-white font-bold">
                  <option value="">Selecciona Ingrediente...</option>
                  {listCatIngredientes.map(i => <option key={`base-${i.id}`} value={i.nombre}>{i.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-widest mb-1.5">Agregar este Aditivo:</label>
                <select value={formReglaAditivo} onChange={(e) => setFormReglaAditivo(e.target.value)} required className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 text-white font-bold">
                  <option value="">Selecciona Aditivo...</option>
                  {listCatIngredientes.map(i => <option key={`adi-${i.id}`} value={i.nombre}>{i.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-widest mb-1.5">Multiplicado por Factor (Lbs):</label>
                <input type="number" step="0.001" min="0" value={formReglaFactor} onChange={(e) => setFormReglaFactor(e.target.value)} required placeholder="Ej. 0.012" className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 text-emerald-400 font-extrabold text-sm" />
              </div>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black p-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 text-xs">
                <Plus size={16} /> Agregar Regla
              </button>
            </form>
          </div>

          <div className="lg:col-span-7">
            <h4 className="font-bold text-sm text-white mb-4">Reglas en Funcionamiento</h4>
            {!listReglasMezcla.length ? (
              <div className="bg-slate-950/20 border border-dashed border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs font-semibold">
                No hay reglas de aditivos configuradas.
              </div>
            ) : (
              <div className="bg-slate-950/40 rounded-2xl overflow-hidden border border-slate-800/80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5 pl-5">Insumo Base</th>
                      <th className="p-3.5">Aditivo Asignado</th>
                      <th className="p-3.5 text-right">Factor de Carga</th>
                      <th className="p-3.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {listReglasMezcla.map((regla) => (
                      <tr key={regla.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="p-3.5 pl-5 font-bold text-white">{regla.base}</td>
                        <td className="p-3.5 font-bold text-emerald-400">+ {regla.aditivo}</td>
                        <td className="p-3.5 text-right font-black text-white">× {regla.factor} lb</td>
                        <td className="p-3.5 text-right"><button onClick={() => handleEliminarReglaMezcla(regla.id)} className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800/50 transition-colors"><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN OSCURA: RECETAS POR ETAPA */}
      <div className="bg-emerald-600 p-4 sm:p-6 lg:p-8 rounded-3xl border border-emerald-700 shadow-card text-slate-100">
        <h3 className="font-extrabold text-xl mb-2 flex items-center text-white gap-2.5">
          <BookOpen className="text-emerald-400" size={24} /> Fórmulas Zootécnicas por Etapa
        </h3>
        <p className="text-slate-400 text-xs mb-6 max-w-2xl">
          Diseña las proporciones porcentuales de cada insumo. El formulador de tolvas restará este desglose exacto de tu bodega física.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-slate-950/40 p-5 rounded-2xl border border-slate-800/60 shadow-inner">
            <h4 className="font-bold text-sm text-white mb-4">Editar Fórmula de Etapa</h4>
            <div className="mb-4">
              <label className="block font-bold text-slate-400 uppercase tracking-widest text-[10px] mb-1.5">1. Seleccionar Etapa:</label>
              <select value={faseFormEdicion} onChange={(e) => setFaseFormEdicion(parseInt(e.target.value))} className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 text-white font-extrabold text-xs">
                {CRONOGRAMA_ALIMENTACION.map(f => (
                  <option key={f.fase} value={f.fase}>Fase {f.fase} ({f.alimento})</option>
                ))}
              </select>
            </div>
            <form onSubmit={handleAgregarIngredienteFormula} className="space-y-4 border-t border-slate-800/60 pt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-widest mb-1.5">2. Seleccionar Insumo:</label>
                <select value={formIngrediente} onChange={(e) => setFormIngrediente(e.target.value)} required className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 text-white font-bold">
                  <option value="">Selecciona del catálogo...</option>
                  <optgroup label="Concentrados">
                    {listCatAlimentos.map(c => <option key={`c-${c.id}`} value={c.nombre}>{c.nombre}</option>)}
                  </optgroup>
                  <optgroup label="Ingredientes Extra">
                    {listCatIngredientes.map(i => <option key={`i-${i.id}`} value={i.nombre}>{i.nombre}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-400 uppercase tracking-widest mb-1.5">3. Porcentaje de Inclusión (%):</label>
                <input type="number" step="0.1" min="0.1" max="100" value={formPorcentaje} onChange={(e) => setFormPorcentaje(e.target.value)} required placeholder="Ej: 45.0" className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 text-white font-bold" />
              </div>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black p-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 text-xs">
                <Plus size={16} /> Añadir a Receta
              </button>
            </form>
          </div>

          <div className="lg:col-span-7">
            {listFormulas.map(formula => {
              if (formula.fase !== faseFormEdicion) return null;
              const sumaTotal = safeArr(formula.ingredientes).reduce((sum, i) => sum + (parseFloat(i.porcentaje) || 0), 0);

              return (
                <div key={formula.fase} className="animate-in fade-in space-y-4">
                  <h4 className="font-bold text-sm text-white flex items-center justify-between">
                    <span>Estructura de Receta Actual</span>
                    <span className="text-xs font-bold text-slate-400">Etapa {formula.fase}</span>
                  </h4>
                  {safeArr(formula.ingredientes).length === 0 ? (
                    <div className="bg-slate-950/20 border border-dashed border-slate-800 rounded-2xl p-10 text-center text-slate-500 text-xs font-semibold leading-relaxed">
                      No has diseñado la receta para esta etapa.<br />El sistema asumirá que suministras concentrado comercial puro (100% de la ración).
                    </div>
                  ) : (
                    <div className="bg-slate-950/40 rounded-2xl overflow-hidden border border-slate-800/80">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                          <tr>
                            <th className="p-3.5 pl-5">Componente de la Mezcla</th>
                            <th className="p-3.5 text-right">Porcentaje de Inclusión</th>
                            <th className="p-3.5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {formula.ingredientes.map((ing, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/30 transition-colors">
                              <td className="p-3.5 pl-5 font-bold text-white">{ing.nombre}</td>
                              <td className="p-3.5 text-right font-black text-emerald-400">{ing.porcentaje}%</td>
                              <td className="p-3.5 text-right"><button onClick={() => handleEliminarIngredienteFormula(formula.fase, ing.nombre)} className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800/50 transition-colors"><Trash2 size={14} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className={`p-4 flex justify-between items-center font-black text-xs border-t border-slate-800 ${sumaTotal === 100 ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/30' : 'bg-rose-950/30 text-rose-400 border-rose-900/30'}`}>
                        <span>SUMA TOTAL:</span>
                        <span>{sumaTotal.toFixed(1)}%</span>
                      </div>
                      {sumaTotal !== 100 && (
                        <div className="px-4 py-3 bg-rose-500/10 text-rose-400 text-[11px] font-bold flex items-center border-t border-rose-500/20">
                          <AlertTriangle size={14} className="mr-2 shrink-0" />
                          La suma total debe llegar exactamente a 100% para poder procesar cargas del formulador.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* PROTOCOLO SANITARIO: fijo, no editable. Sueros, desparasitación x2 e Innosure. */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4">
        <div>
          <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2"><HeartPulse className="text-rose-500" size={18} /> Protocolo Sanitario</h3>
          <p className="text-slate-400 text-xs mt-1 leading-relaxed">Esto es lo que se le aplica a todo lote, y son las únicas fechas que el Calendario programa solo. Cualquier tratamiento por enfermedad se registra aparte, en Tratamientos Médicos del corral.</p>
        </div>
        <div className="space-y-2.5">
          {listProtocoloSanitario.map(paso => (
            <div key={paso.id} className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
              <span className="text-lg leading-none mt-0.5">{CLASES_MEDICAMENTO[claseDeMedicamento(paso)]?.emoji || '🩺'}</span>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 text-xs">
                  {paso.tarea} <span className="text-slate-400 font-semibold">· {paso.rango}</span>
                  {paso.pesoEsperado && <span className="ml-2 bg-slate-200/70 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded">{paso.pesoEsperado}</span>}
                </p>
                <p className="text-[11px] text-slate-500 font-medium leading-snug mt-0.5">{paso.producto}</p>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/40">
            <span className="text-lg leading-none mt-0.5">🔵</span>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 text-xs">Innosure 1ª y 2ª dosis <span className="text-slate-400 font-semibold">· semanas 12 y 18</span></p>
              <p className="text-[11px] text-slate-500 font-medium leading-snug mt-0.5">Solo en lotes con machos sin capar. Se programa al registrar la composición del corral, y bloquea la venta hasta 3 semanas después de la 2ª dosis.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-700 text-xs">Importar fechas del plan de corrales</p>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
              Carga las 18 fechas reales de Innosure de los corrales 3 al 11 tomadas del archivo del plan, y reemplaza las fechas teóricas que generó la app. Es una sola vez.
            </p>
          </div>
          <button type="button" onClick={handleImportarInnosureDelExcel} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-wider px-4 py-2.5 rounded-xl transition-colors shadow-md shrink-0">
            Importar
          </button>
        </div>
      </div>
    </div>
  );
  // --- RENDER: DETALLE DEL CORRAL ---
  const renderCorralDetail = () => {
    if (!corralSeleccionado) return renderDashboard();
    const loteActivo = getLoteActivo(corralSeleccionado.id);
    const stats = calcularEstadisticasLote(loteActivo, simuladorMuertesExtra);

    const hoySanidad = todayIso();
    const tareasLoteSanidad = loteActivo ? listTareasSanidad
      .filter(t => t.loteId === loteActivo.id)
      .map(t => {
        const fechaObjetivo = t.fechaObjetivo || (loteActivo.fechaIngreso ? addDaysToIsoDate(loteActivo.fechaIngreso, Number(t.dia) || 0) : '');
        const diffDias = fechaObjetivo ? Math.ceil((new Date(`${fechaObjetivo}T00:00:00`) - new Date(`${hoySanidad}T00:00:00`)) / 86_400_000) : 9999;
        return { ...t, fechaObjetivo, diffDias, vencida: (t.estado || 'pendiente') === 'pendiente' && diffDias < 0 };
      }) : [];
    const proximaTareaSanidad = tareasLoteSanidad
      .filter(t => (t.estado || 'pendiente') === 'pendiente')
      .sort((a, b) => a.diffDias - b.diffDias)[0];
    const hace7Sanidad = new Date(`${hoySanidad}T00:00:00`);
    hace7Sanidad.setDate(hace7Sanidad.getDate() - 7);
    const bajas7Sanidad = loteActivo ? listBajas
      .filter(b => b.loteId === loteActivo.id && b.fecha && new Date(`${b.fecha}T00:00:00`) >= hace7Sanidad)
      .reduce((sum, b) => sum + (Number(b.cantidad) || 0), 0) : 0;
    const sinStockSanidad = tareasLoteSanidad.filter(t => (t.estado || 'pendiente') === 'pendiente' && t.productoMedicoId && (inventarioMedico.find(m => m.id === t.productoMedicoId)?.stock || 0) <= 0).length;
    const vencidasSanidad = tareasLoteSanidad.filter(t => t.vencida).length;
    const hoyPendientesSanidad = tareasLoteSanidad.filter(t => t.diffDias === 0 && (t.estado || 'pendiente') === 'pendiente').length;
    const riesgoScoreSanidad = (vencidasSanidad * 3) + hoyPendientesSanidad + (bajas7Sanidad * 4) + (sinStockSanidad * 2);
    const riesgoNivelSanidad = riesgoScoreSanidad >= 6 ? 'alto' : riesgoScoreSanidad >= 3 ? 'medio' : 'bajo';
    const historialSanidadLote = loteActivo ? [
      ...tareasLoteSanidad.filter(t => t.estado === 'hecho').map(t => ({ id: `t_${t.id}`, fecha: t.completadoEn || t.fechaObjetivo, tipo: 'Protocolo', texto: t.tarea, detalle: t.observacion || t.producto || '' })),
      ...listUsosMedicos.filter(u => u.loteId === loteActivo.id).map(u => ({ id: `u_${u.id}`, fecha: u.fecha, tipo: 'Aplicación', texto: u.nombre, detalle: `${u.cantidad} ${u.unidad} · ${formatearMoneda(u.costo || 0)}` }))
    ].filter(i => i.fecha).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 6) : [];
    const irACalendarioDesdeCorral = () => {
      setVista('calendario');
      if (proximaTareaSanidad?.fechaObjetivo) {
        setCalendarioDiaSeleccionado(proximaTareaSanidad.fechaObjetivo);
        const d = new Date(`${proximaTareaSanidad.fechaObjetivo}T00:00:00`);
        setCalendarioCursor({ year: d.getFullYear(), month: d.getMonth() });
      }
    };

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 border-b border-slate-200/70 pb-5">
          <div>
            <h2 className="max-lg:hidden text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center leading-none">
              {corralSeleccionado.nombre}
            </h2>
            <p className="text-slate-500 text-sm lg:mt-1.5 flex items-center gap-1">
              <Users size={16} className="text-slate-400" /> Capacidad Máxima: {corralSeleccionado.capacidad} cerdos
            </p>
          </div>
          {loteActivo && (
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 xl:justify-end shrink-0 text-xs">
              <button onClick={handleEliminarLoteActivo} className="order-last sm:order-first col-span-2 sm:col-span-1 justify-center bg-white text-rose-600 hover:bg-rose-600 hover:text-white font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center border border-rose-200 gap-1.5" title="Eliminar este lote completamente">
                <Trash2 size={16} /> Anular Lote
              </button>
              <button onClick={() => abrirModalQrTolva(corralSeleccionado, 'escanear')} className="justify-center bg-slate-900 text-white hover:bg-slate-800 font-bold py-2.5 px-4 rounded-xl shadow-sm flex items-center transition-colors gap-1.5">
                <QrCode size={16} className="text-emerald-400" /> Tolva QR
              </button>
              <button
                type="button"
                onClick={() => {
                  const faseNum = loteActivo.faseActual || CRONOGRAMA_ALIMENTACION.find(f => stats.diasLote >= f.diaInicio && stats.diasLote <= f.diaFin)?.fase || 1;
                  const faseObj = CRONOGRAMA_ALIMENTACION.find(f => f.fase === faseNum);
                  enviarPorWhatsApp(formatearFichaCorralWhatsApp({
                    corralNombre: corralSeleccionado.nombre,
                    raza: loteActivo.nombre || loteActivo.raza || 'Estándar',
                    cantidadActual: stats.cantidadActual,
                    cantidadVendida: stats.cantidadVendida,
                    mortalidadPorcentaje: stats.mortalidadPorcentaje,
                    diasLote: stats.diasLote,
                    etapaActual: `Etapa ${faseNum}`,
                    alimentoActual: faseObj?.alimento || 'Concentrado',
                    pesoPromedioTexto: formatPesoLb(stats),
                    adg: stats.adg,
                    fcaTexto: formatFca(stats),
                    inversionTotal: stats.costoInvertidoTotal,
                    proximaTarea: proximaTareaSanidad
                  }));
                }}
                className="justify-center bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 font-bold py-2.5 px-3.5 rounded-xl flex items-center transition-colors gap-1.5"
                title="Compartir estado actual del corral por WhatsApp"
              >
                <MessageCircle size={16} className="text-emerald-600" /> WhatsApp
              </button>
              <button onClick={() => setVista('imprimirFicha')} className="justify-center bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 font-bold py-2.5 px-4 rounded-xl flex items-center transition-colors gap-1.5">
                <Printer size={16} /> <span className="sm:hidden">Ficha</span><span className="hidden sm:inline">Ficha Trazabilidad</span>
              </button>
              <button onClick={() => { setTipoReporteImpresion('interno'); setVista('resumenVenta'); }} className="justify-center bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center gap-1.5">
                <PieChart size={16} /> Reporte Final
              </button>
              <button onClick={prepararVentaLote} className="order-first sm:order-none col-span-2 sm:col-span-1 justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 sm:py-2.5 px-4 rounded-xl shadow-md shadow-emerald-600/20 flex items-center transition-colors gap-1.5 text-sm sm:text-xs">
                <Scale size={16} /> Vender en Báscula
              </button>
            </div>
          )}
        </div>

        {!loteActivo ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)] max-w-2xl mx-auto text-center mt-12">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100 shadow-inner">
              <Plus size={36} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Corral Vacío</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto leading-relaxed">Ingresa los datos del nuevo grupo de cerdos para comenzar a llevar su control en este corral.</p>
            <form onSubmit={handleIngresoLote} className="space-y-5 text-left text-xs font-semibold">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Fecha de Ingreso</label>
                  <input type="date" name="fechaIngreso" required defaultValue={todayIso()} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 text-slate-800" />
                </div>
                <div>
                  <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Cantidad de Cerdos</label>
                  <input type="number" name="cantidad" required min="1" max={corralSeleccionado.capacidad} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Raza / Línea Genetica</label>
                  <input type="text" name="raza" placeholder="Ej: Pietrain / Duroc" className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 font-bold" />
                </div>
                <div>
                  <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Peso Promedio Inicial (lb)</label>
                  <input type="number" name="pesoInicial" step="0.1" required className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 font-bold" />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5 space-y-4">
                <div>
                  <h4 className="text-slate-700 font-extrabold text-sm">Composición del lote</h4>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-0.5">Los machos sin capar necesitan Innosure. Las hembras y los machos capados no llevan nada de esto.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Machos</label>
                    <input type="number" name="machos" min="0" defaultValue={0} value={ingresoMachos} onChange={(e) => setIngresoMachos(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 font-bold" />
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Hembras</label>
                    <input type="number" name="hembras" min="0" defaultValue={0} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 font-bold" />
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Machos capados</label>
                    <input type="number" name="machosCapados" min="0" max={ingresoMachos} defaultValue={0} disabled={ingresoMachos === 0} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 font-bold disabled:bg-slate-100 disabled:text-slate-400" />
                    <p className="text-[10px] text-slate-400 font-medium mt-1 leading-snug">{ingresoMachos === 0 ? 'Sin machos registrados' : `De los ${ingresoMachos} machos`}</p>
                  </div>
                </div>

                {ingresoMachos > 0 && (
                  <div>
                    <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Plan de Innosure</label>
                    <select name="planInnosure" defaultValue={PLAN_INNOSURE_POR_DEFECTO} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 font-bold">
                      <option value={22}>22 semanas — 1ª dosis semana 12, 2ª semana 18, salida semana 22</option>
                      <option value={20}>20 semanas — 1ª dosis semana 10, 2ª semana 16, salida semana 20</option>
                    </select>
                    <p className="text-[10px] text-slate-400 font-medium mt-1 leading-snug">Son fechas sugeridas. Lo que la app sí exige son los mínimos: 2 semanas entre dosis y 3 semanas de la 2ª dosis a la venta.</p>
                  </div>
                )}
              </div>

              <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg shadow-emerald-500/15 transition-all text-sm uppercase tracking-wider mt-4">Iniciar Control de Lote</button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/70 shadow-sm overflow-hidden -mx-1 sm:mx-0">
            <div className="tabs-scroll tabs-scroll-fade gap-1 border-b border-slate-200/70 bg-slate-50/80 px-2 pt-2" role="tablist">
              {[
                { id: 'resumen', icon: PieChart, label: 'Resumen', corto: 'Resumen' },
                { id: 'cronograma', icon: Clock, label: 'Cronograma', corto: 'Cronograma' },
                { id: 'alimento', icon: Wheat, label: 'Alimentación (Tolvas)', corto: 'Alimento' },
                { id: 'peso', icon: Scale, label: 'Control Peso', corto: 'Peso' },
                { id: 'sanidad', icon: HeartPulse, label: 'Sanidad & Bajas', corto: 'Sanidad' },
                { id: 'ventas', icon: Receipt, label: 'Ventas en Báscula', corto: 'Ventas' },
                { id: 'finanzas', icon: Calculator, label: 'Finanzas & Simulación', corto: 'Finanzas' },
              ].map(t => (
                <button key={t.id} role="tab" aria-selected={tabActiva === t.id} onClick={() => setTabActiva(t.id)} className={`flex items-center gap-2 px-3.5 sm:px-5 py-3 font-bold text-[13px] sm:text-sm transition-colors border-b-2 rounded-t-xl shrink-0 whitespace-nowrap ${tabActiva === t.id ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/60'}`}>
                  {React.createElement(t.icon, { size: 16, className: 'shrink-0' })}
                  <span className="2xl:hidden">{t.corto}</span>
                  <span className="hidden 2xl:inline">{t.label}</span>
                </button>
              ))}
            </div>

            <div className="p-3 sm:p-6 lg:p-8 bg-white min-h-[500px]">

              {/* TAB: RESUMEN */}
              {tabActiva === 'resumen' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
                  <div className="bg-blue-50/40 p-4 sm:p-6 rounded-2xl border border-blue-100">
                    <h3 className="font-bold text-lg text-blue-900 mb-4 sm:mb-6 flex items-center"><Activity size={22} className="mr-2 text-blue-600" /> Rendimiento Zootécnico</h3>
                    <div className="space-y-4 text-sm font-semibold text-slate-600">
                      <div className="flex justify-between items-center"><span className="font-medium text-slate-500">Animales Vivos:</span><span className={`font-extrabold text-base ${stats.mortalidadPorcentaje > 5 ? 'text-rose-600' : 'text-slate-800'}`}>{stats.cantidadActual} <span className="text-[10px] font-bold text-slate-400 ml-1">({stats.cantidadVendida} vendidos • {stats.mortalidadPorcentaje.toFixed(1)}% mort.)</span></span></div>
                      <div className="flex justify-between items-center"><span className="font-medium text-slate-500">Días en Engorde:</span><span className="font-extrabold text-base text-slate-800">{stats.diasLote}</span></div>
                      <div className={`flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border ${stats.estaListoParaMezclas ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100'}`}>
                        <span className={`${stats.estaListoParaMezclas ? 'text-emerald-800 font-bold' : 'text-slate-500 font-bold'}`}>Peso Promedio Actual:</span>
                        <span className={`font-black text-lg sm:text-xl flex items-center whitespace-nowrap shrink-0 ${stats.estaListoParaMezclas ? 'text-emerald-700 animate-pulse' : 'text-blue-700'}`} title={tituloPesoLb(stats)}>{formatPesoLb(stats)} {stats.estaListoParaMezclas && <Leaf size={18} className="ml-1.5 text-emerald-500" title="¡Listo para Mezclas!" />}</span>
                      </div>
                      {stats.pesoEsEstimado && (
                        <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed font-medium">
                          Peso estimado por consumo de alimento. Último pesaje real: <strong>{stats.pesoActual.toFixed(1)} lb hace {stats.diasSinPesaje} días</strong>.
                        </p>
                      )}
                      <div className="flex justify-between items-center"><span className="font-medium text-slate-500">Ganancia Media Diaria (GMD):</span><span className="font-bold text-slate-800">{stats.adg.toFixed(2)} lbs/día</span></div>
                      <div className="flex justify-between items-center"><span className="font-medium text-slate-500">Peso Total Producido:</span><span className="font-bold text-slate-800">{stats.pesoProducidoLb.toFixed(1)} lb <span className="text-[10px] font-bold text-slate-400 ml-1">({stats.librasVendidas.toFixed(1)} lb vendidas)</span></span></div>
                      <div className="flex justify-between items-center"><span className="font-medium text-slate-500">Consumo del Ciclo:</span><span className={`font-bold ${stats.excedeCicloCompleto ? 'text-rose-600' : 'text-slate-800'}`} title={`${stats.consumoPorCerdoLb.toFixed(0)} lb por cerdo; un ciclo completo son 496 lb`}>{stats.consumoCicloPorcentaje.toFixed(0)}%{stats.excedeCicloCompleto && ' · ¿vender?'}</span></div>
                      <div className={`p-4 rounded-xl border mt-4 ${!stats.fcaEsConfiable ? 'bg-slate-50 border-slate-200' : stats.fca > 3 ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50/50 border-emerald-250'}`} title={tituloFca(stats)}>
                        <div className="flex justify-between items-center">
                          <span className={`font-bold flex items-center ${!stats.fcaEsConfiable ? 'text-slate-500' : stats.fca > 3 ? 'text-orange-800' : 'text-emerald-800'}`}>Conversión Alimenticia (FCA)</span>
                          <span className={`font-black text-3xl ${claseFca(stats, 'text-emerald-600', 'text-orange-600')}`}>{formatFca(stats)}</span>
                        </div>
                        {!stats.fcaEsConfiable && (
                          <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-2 border-t border-slate-200 pt-2">
                            {stats.fca > 0
                              ? <>Este número no es confiable{stats.pesajeVencido ? ` porque el último pesaje tiene ${stats.diasSinPesaje} días` : ' porque falta un segundo pesaje reciente'}. Registrá un pesaje para calcularlo de verdad.</>
                              : <>Hacen falta al menos dos pesajes para calcular la conversión.</>}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50/40 p-6 rounded-2xl border border-emerald-100">
                    <h3 className="font-bold text-lg text-emerald-950 mb-6 flex items-center"><PiggyBank size={22} className="mr-2 text-emerald-600" /> Inversión a la Fecha</h3>
                    <div className="space-y-4 text-sm font-semibold text-slate-600">
                      <div className="flex justify-between items-center"><span className="font-medium text-slate-500">Compra Lechones (Estimado):</span><span className="font-bold text-rose-600">{formatearMonedaNeg(stats.costoLechones)}</span></div>
                      <div className="flex justify-between items-center"><span className="font-medium text-slate-500">Alimentación Suministrada:</span><span className="font-bold text-rose-600">{formatearMonedaNeg(stats.costoAlimento)}</span></div>
                      <div className="flex justify-between items-center"><span className="font-medium text-slate-500">Gastos Sanidad y Operaciones:</span><span className="font-bold text-rose-600">{formatearMonedaNeg(stats.totalSanidad + stats.totalGastosExtras)}</span></div>
                      <div className="flex justify-between items-center pt-4 mt-2 border-t border-emerald-200/50"><span className="text-slate-900 font-extrabold text-base">TOTAL INVERTIDO:</span><span className="font-black text-rose-600 text-2xl">{formatearMonedaNeg(stats.costoInvertidoTotal)}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: CRONOGRAMA */}
              {tabActiva === 'cronograma' && (() => {
                const fasesDinamicas = getFasesDinamicas(loteActivo);
                const fechaEstimadaVenta = fasesDinamicas[fasesDinamicas.length - 1].fechaFinCalc;
                const fechaEstimadaStr = fechaEstimadaVenta.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
                const hoyDate = new Date();

                return (
                  <div className="animate-in fade-in duration-300">
                    <div className="bg-indigo-50/60 p-4 border border-indigo-100 rounded-xl mb-6 flex justify-between items-center shadow-sm">
                      <span className="font-extrabold text-indigo-800 text-sm">Días Reales Transcurridos:</span>
                      <span className="text-xl font-black text-indigo-700">{stats.diasLote} días</span>
                    </div>
                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                      {fasesDinamicas.map(fase => {
                        const metaFase = fase.consumoTotalLb * stats.cantidadActual;
                        const consumidoFase = getConsumidoEnFase(loteActivo.id, fase);
                        const suplementosEnFase = getSuplementosEnFase(loteActivo.id, fase.fase);

                        const totalConsumido = consumidoFase + suplementosEnFase.lbs;
                        const porcentajeProgresoTotal = metaFase > 0 ? Math.min((totalConsumido / metaFase) * 100, 100) : 0;
                        const porcTolva = metaFase > 0 ? (consumidoFase / metaFase) * 100 : 0;
                        const porcSuplemento = metaFase > 0 ? (suplementosEnFase.lbs / metaFase) * 100 : 0;

                        const metaSuplementoPorc = loteActivo.metasSuplementos?.[fase.fase] || 0;
                        const limiteExcedido = metaSuplementoPorc > 0 && porcSuplemento > metaSuplementoPorc;

                        let porcentajeDias = 0;
                        if (fase.state === 'pasada' || fase.estado === 'pasada') {
                          porcentajeDias = 100;
                        } else if (fase.state === 'actual' || fase.estado === 'actual') {
                          const diasPasadosEnFase = Math.ceil((hoyDate - fase.fechaInicioCalc) / (1000 * 60 * 60 * 24));
                          porcentajeDias = Math.max(0, Math.min((diasPasadosEnFase / fase.idealDuracion) * 100, 100)).toFixed(0);
                        }

                        const colores = {
                          pasada: 'bg-slate-100 border-slate-200 opacity-60',
                          actual: 'bg-indigo-50/50 border-indigo-200 shadow-sm ring-2 ring-indigo-50/50 ring-offset-1',
                          futuro: 'bg-white border-slate-200/60'
                        };

                        const faseEstado = fase.state || fase.estado;
                        const presupuestoLleno = porcentajeProgresoTotal >= 95;
                        const fInicioStr = fase.fechaInicioCalc.toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
                        const fFinStr = fase.fechaFinCalc.toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });

                        return (
                          <div key={fase.fase} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active text-xs">
                            <div className="hidden md:block w-32 text-right pr-6 shrink-0">
                              <p className={`font-bold ${faseEstado === 'actual' ? 'text-indigo-700' : 'text-slate-400'}`}>
                                {faseEstado === 'pasada' ? 'Completada' : faseEstado === 'actual' ? 'En Progreso' : 'Proyectada'}
                              </p>
                            </div>
                            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ${faseEstado === 'actual' ? 'bg-indigo-500 text-white' : faseEstado === 'pasada' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                              {faseEstado === 'pasada' ? <CheckCircle size={16} /> : <span className="font-bold">{fase.fase}</span>}
                            </div>
                            <div className={`w-[calc(100%-3.5rem)] md:w-[calc(50%-2rem)] p-5 rounded-2xl border transition-all ${colores[faseEstado] || colores.futuro}`}>
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 block ${faseEstado === 'actual' ? 'text-indigo-600' : 'text-slate-400'}`}>
                                    Etapa {fase.fase} • {fInicioStr} al {fFinStr}
                                  </span>
                                  <h4 className="text-base font-extrabold text-slate-800">
                                    {fase.alimento}
                                  </h4>
                                </div>
                                {faseEstado === 'actual' && (
                                  <span className="bg-indigo-600 text-white text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full shadow-sm">ACTIVO</span>
                                )}
                              </div>

                              <div className="mt-4 border-t border-slate-200/50 pt-3.5 space-y-4">
                                <div className={`p-3 rounded-xl border transition-colors bg-white/70 ${limiteExcedido ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200/60'}`}>
                                  <div className="flex justify-between items-end mb-1">
                                    <span className="font-bold text-slate-700 flex items-center gap-1 text-[10px] uppercase tracking-wider"><Wheat size={14} className="text-slate-500" /> Presupuesto Alimentario</span>
                                    <span className="font-black text-indigo-700 text-sm">{porcentajeProgresoTotal.toFixed(1)}%</span>
                                  </div>
                                  <div className="flex justify-between text-[10px] text-slate-400 mb-2 font-semibold">
                                    <span>Suministrado: <strong>{totalConsumido.toFixed(1)} lb</strong></span>
                                    <span>Presupuesto: <strong>{metaFase.toFixed(1)} lb</strong></span>
                                  </div>
                                  <div className="w-full bg-slate-200 rounded-full h-2 flex overflow-hidden">
                                    <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${Math.min(porcTolva, 100)}%` }} title={`Tolva: ${porcTolva.toFixed(1)}%`} />
                                    <div className={`h-full transition-all duration-300 ${limiteExcedido ? 'bg-rose-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(porcSuplemento, 100 - Math.min(porcTolva, 100))}%` }} title={`Suplemento: ${porcSuplemento.toFixed(1)}%`} />
                                  </div>
                                  <div className="flex justify-between text-[9px] font-black uppercase tracking-wider mt-1.5">
                                    <span className="text-emerald-600">Tolva: {porcTolva.toFixed(1)}%</span>
                                    <span className={limiteExcedido ? 'text-rose-600' : 'text-amber-600'}>Suplemento: {porcSuplemento.toFixed(1)}%</span>
                                  </div>
                                </div>

                                <div className={`p-3 rounded-xl border transition-colors bg-white/70 ${limiteExcedido ? 'border-rose-300 bg-rose-50/50' : 'border-slate-200/60'}`}>
                                  <div className="flex justify-between items-center mb-2">
                                    <span className={`font-bold flex items-center gap-1 text-[10px] uppercase tracking-wider ${limiteExcedido ? 'text-rose-900' : 'text-slate-700'}`}><Activity size={14} className="text-slate-500" /> Meta Suplementos</span>
                                    <div className="flex items-center border border-slate-200 bg-white rounded-lg px-2 py-0.5 shadow-sm text-xs">
                                      <input type="number" className="w-9 outline-none font-black text-right bg-transparent text-slate-700" placeholder="0" value={loteActivo.metasSuplementos?.[fase.fase] ?? ''} onChange={(e) => handleActualizarMetaSuplemento(loteActivo.id, fase.fase, e.target.value)} />
                                      <span className="font-extrabold text-slate-400 ml-0.5">%</span>
                                    </div>
                                  </div>
                                  <div className="flex justify-between text-[10px] text-slate-400 font-semibold leading-none">
                                    <span>Extra: <strong>{suplementosEnFase.lbs.toFixed(1)} lb</strong> ({formatearMoneda(suplementosEnFase.costo)})</span>
                                    {metaSuplementoPorc > 0 && <span>Límite: <strong>{(metaFase * (metaSuplementoPorc / 100)).toFixed(1)} lb</strong></span>}
                                  </div>
                                  {limiteExcedido && (
                                    <div className="text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-100 p-1.5 rounded-lg mt-2 text-center uppercase tracking-widest">
                                      ⚠️ Techo Excedido
                                    </div>
                                  )}
                                </div>

                                {faseEstado !== 'pasada' && (
                                  <div>
                                    <div className="flex justify-between text-[10px] mb-1 font-bold text-slate-400 uppercase tracking-wider">
                                      <span>Días Estimados transcurridos</span>
                                      <span>{porcentajeDias}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                                      <div className={`h-1.5 rounded-full transition-all duration-300 bg-indigo-400`} style={{ width: `${Math.min(porcentajeDias, 100)}%` }} />
                                    </div>
                                  </div>
                                )}

                                {faseEstado === 'pasada' && (() => {
                                  const ahorro = getAhorroFase(loteActivo.id, fase.fase, stats.cantidadActual);
                                  if (!ahorro) return null;
                                  return (
                                    <div className="mt-2 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 space-y-2 text-xs font-semibold">
                                      <h5 className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1 border-b border-emerald-100/50 pb-1.5"><TrendingUp size={12} /> Resultados de Ahorro</h5>
                                      <div className="grid grid-cols-2 gap-2 text-[11px] leading-tight">
                                        <div><p className="text-slate-400">Meta Presupuestaria:</p><p className="font-bold text-slate-700">{ahorro.metaLbs.toFixed(0)} lb</p></div>
                                        <div><p className="text-slate-400">Suministro Tolva:</p><p className="font-bold text-slate-700">{ahorro.consumidoTolvaLbs.toFixed(0)} lb</p></div>
                                      </div>
                                      <div className="space-y-1 border-t border-emerald-250/20 pt-2 text-[10px] text-slate-500 font-medium">
                                        <div className="flex justify-between"><span>Concentrado Ahorrado:</span><span className="text-emerald-600">+{formatearMoneda(ahorro.valorAhorradoConc)}</span></div>
                                        <div className="flex justify-between"><span>Insumos Extra (Costo):</span><span className="text-rose-500">{formatearMonedaNeg(ahorro.costoSups)}</span></div>
                                      </div>
                                      <div className="bg-white px-2.5 py-1.5 rounded-lg border border-emerald-200/50 flex justify-between items-center shadow-sm text-xs mt-2">
                                        <span className="text-emerald-800 font-bold uppercase tracking-wider text-[9px]">Ahorro Neto Real:</span>
                                        <span className={`font-black text-sm ${ahorro.ahorroNeto > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{ahorro.ahorroNeto > 0 ? '+' : ''}{formatearMoneda(ahorro.ahorroNeto)}</span>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {faseEstado === 'actual' && fase.fase < 7 && (
                                  <div className="flex flex-col gap-2 mt-4">
                                    {presupuestoLleno ? (
                                      <button onClick={() => avanzarLoteDeEtapa(loteActivo.id, fase.fase + 1)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-2.5 rounded-xl shadow-md transition-all text-xs flex justify-center items-center gap-1 uppercase tracking-wider">
                                        <CheckCircle size={15} /> Terminar Etapa y Avanzar
                                      </button>
                                    ) : (
                                      <button onClick={() => pedirConfirmacion("Forzar Avance de Etapa", "¿Quieres terminar esta etapa de forma anticipada gracias a los suplementos? El sistema calculará automáticamente tu ahorro financiero neto a partir de hoy.", () => avanzarLoteDeEtapa(loteActivo.id, fase.fase + 1))} className="w-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold py-2 rounded-xl transition-colors text-xs text-center border border-indigo-200/40">
                                        Avanzar etapa de forma anticipada
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mt-6 text-xs">
                        <div className="hidden md:block w-32 text-right pr-6 shrink-0">
                          <p className="font-bold text-emerald-600">Fin del Engorde</p>
                          <p className="text-[10px] text-slate-400 leading-tight">Venta del lote completo</p>
                        </div>
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-md z-10 bg-emerald-500 text-white">
                          <PiggyBank size={18} />
                        </div>
                        <div className="w-[calc(100%-3.5rem)] md:w-[calc(50%-2rem)] p-5 rounded-2xl border bg-emerald-50/50 border-emerald-100 shadow-sm space-y-3">
                          <div className="flex justify-between items-start border-b border-emerald-100/50 pb-2">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider mb-1 block text-emerald-600">Fecha Dinámica Estimada</span>
                              <h4 className="text-base font-extrabold text-emerald-950">Salida a Mercado</h4>
                            </div>
                          </div>
                          <div className="space-y-1.5 font-semibold text-emerald-800">
                            <div className="flex items-center gap-1.5"><Calendar size={14} className="text-emerald-500" /> Listo aproximadamente el: <strong className="font-extrabold text-emerald-900">{fechaEstimadaStr}</strong></div>
                            <div className="flex items-center gap-1.5"><Scale size={14} className="text-emerald-500" /> Peso objetivo promedio: <strong className="font-extrabold text-emerald-900">220+ lbs</strong></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB: ALIMENTACIÓN */}
              {tabActiva === 'alimento' && (() => {
                const faseCalculadaPorDias = CRONOGRAMA_ALIMENTACION.find(f => stats.diasLote >= f.diaInicio && stats.diasLote <= f.diaFin)?.fase || 7;
                const faseActualLote = loteActivo.faseActual || faseCalculadaPorDias;

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-300">
                    <div className="lg:col-span-6 space-y-6">
                      <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200/50 flex">
                        <button type="button" onClick={() => setTipoRegistroAlimento('tolva')} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center transition-all duration-150 gap-1.5 ${tipoRegistroAlimento === 'tolva' ? 'bg-white text-slate-800 shadow-sm font-bold border border-slate-200/30' : 'text-slate-400 hover:text-slate-600'}`}>
                          <Box size={16} /> Llenar Tolvas (Concentrado)
                        </button>
                        <button type="button" onClick={() => setTipoRegistroAlimento('suplemento')} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center transition-all duration-150 gap-1.5 ${tipoRegistroAlimento === 'suplemento' ? 'bg-white text-slate-800 shadow-sm font-bold border border-slate-200/30' : 'text-slate-400 hover:text-slate-600'}`}>
                          <Leaf size={16} /> Suplementos (Mezclas)
                        </button>
                      </div>

                      {/* --- FORMULARIO TOLVAS --- */}
                      {tipoRegistroAlimento === 'tolva' && (
                        <form onSubmit={handleGuardarTolva} className="p-6 rounded-2xl bg-white border border-slate-100 shadow-[0_4px_25px_rgb(0,0,0,0.005)] space-y-5 text-xs font-semibold">
                          <div className="border-b border-slate-100 pb-3">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5"><Wheat size={20} className="text-emerald-500" /> Suministro de Concentrado Base</h3>
                              <button type="button" onClick={() => abrirModalQrTolva(corralSeleccionado, 'escanear')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1 transition-colors shrink-0">
                                <QrCode size={14} /> Descarga 1-Toque (QR)
                              </button>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-1">Suministro de concentrado directo. Afecta el presupuesto alimenticio de la etapa.</p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Fecha de Entrega</label>
                              <input type="date" name="fecha" required defaultValue={todayIso()} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 font-bold" />
                            </div>
                            <div>
                              <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Etapa Destino</label>
                              <select name="faseDestino" defaultValue={faseActualLote} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-extrabold text-indigo-700">
                                {CRONOGRAMA_ALIMENTACION.map(f => (
                                  <option key={f.fase} value={f.fase}>Fase {f.fase} ({f.alimento})</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Alimento Comercial (Concentrado)</label>
                              <select required value={puroInput.tipo} onChange={(e) => setPuroInput({ ...puroInput, tipo: e.target.value })} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-bold text-slate-700">
                                {listCatAlimentos.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Sacos Rápidos (1 Toque)</label>
                              <div className="grid grid-cols-4 gap-2">
                                {[
                                  { label: '½ Saco', cant: '0.5' },
                                  { label: '1 Saco', cant: '1' },
                                  { label: '2 Sacos', cant: '2' },
                                  { label: '3 Sacos', cant: '3' }
                                ].map(btn => {
                                  const activo = puroInput.unidad === 'sacos' && Number(puroInput.cantidad) === Number(btn.cant);
                                  return (
                                    <button
                                      key={btn.label}
                                      type="button"
                                      onClick={() => { vibrarCampo(30); setPuroInput({ ...puroInput, unidad: 'sacos', cantidad: btn.cant }); }}
                                      className={`py-2.5 px-2 rounded-xl border text-xs transition-all ${activo ? 'bg-emerald-600 text-white border-emerald-600 font-black shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-bold'}`}
                                    >
                                      {btn.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Cantidad Racionada</label>
                                <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                                  <input type="number" inputMode="decimal" step="0.1" required value={puroInput.cantidad} onChange={(e) => setPuroInput({ ...puroInput, cantidad: e.target.value })} className="w-1/2 p-2.5 outline-none font-bold bg-transparent text-slate-700" placeholder="Ej. 2" />
                                  <select value={puroInput.unidad} onChange={(e) => setPuroInput({ ...puroInput, unidad: e.target.value })} className="w-1/2 p-2.5 bg-slate-100 border-l border-slate-200 outline-none text-slate-600 font-bold text-xs">
                                    <option value="sacos">Sacos Enteros</option>
                                    <option value="libras">Libras Sueltas</option>
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Costo Imputado a Lote</label>
                                <div className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-bold flex items-center h-[38px]">{formatearMoneda(costoCalculadoPuro)}</div>
                              </div>
                            </div>
                          </div>
                          <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-colors shadow-lg shadow-emerald-500/10 mt-2 uppercase tracking-wider">Registrar Tolva</button>
                        </form>
                      )}

                      {/* --- FORMULARIO SUPLEMENTOS --- */}
                      {tipoRegistroAlimento === 'suplemento' && (
                        <form onSubmit={handleGuardarSuplemento} className="p-6 rounded-2xl bg-amber-50/30 border border-amber-200/50 shadow-sm space-y-5 text-xs font-semibold">
                          <div className="border-b border-amber-200/40 pb-3">
                            <h3 className="font-extrabold text-amber-900 text-base flex items-center gap-1.5"><ShoppingCart size={20} className="text-amber-600" /> Ración Suplementaria (Mezcla)</h3>
                            <p className="text-[11px] text-amber-700 font-medium mt-1">Agrega raciones de ingredientes en libras. Su costo se sumará de forma independiente.</p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-amber-800 uppercase tracking-widest font-bold mb-1.5">Fecha de Entrega</label>
                              <input type="date" name="fecha" required defaultValue={todayIso()} className="w-full p-2.5 border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 bg-white text-slate-800 font-bold" />
                            </div>
                            <div>
                              <label className="block text-amber-800 uppercase tracking-widest font-bold mb-1.5">Etapa Destino</label>
                              <select name="faseDestino" defaultValue={faseActualLote} className="w-full p-2.5 border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 bg-white font-extrabold text-indigo-700">
                                {CRONOGRAMA_ALIMENTACION.map(f => (
                                  <option key={f.fase} value={f.fase}>Fase {f.fase} ({f.alimento})</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <label className="block text-amber-800 uppercase tracking-widest font-bold mb-1">Ingredientes de la Ración</label>
                            {suplementoItems.map((item) => (
                              <div key={item.id} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-amber-200/50 shadow-sm text-xs">
                                <select required value={item.tipo} onChange={(e) => setSuplementoItems(suplementoItems.map(i => i.id === item.id ? { ...i, tipo: e.target.value } : i))} className="flex-1 p-2 bg-transparent outline-none font-bold text-slate-700 text-xs">
                                  <option value="">Seleccionar Insumo...</option>
                                  <optgroup label="Ingredientes Extra">
                                    {listCatIngredientes.map(i => <option key={i.id} value={i.nombre}>{i.nombre}</option>)}
                                  </optgroup>
                                  <optgroup label="Concentrados Comerciales">
                                    {listCatAlimentos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                                  </optgroup>
                                </select>
                                <div className="w-28 flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                                  <input type="number" step="0.1" required value={item.libras} onChange={(e) => setSuplementoItems(suplementoItems.map(i => i.id === item.id ? { ...i, libras: e.target.value } : i))} placeholder="Cant" className="w-full outline-none text-right font-bold text-amber-700 bg-transparent" />
                                  <span className="text-[10px] font-bold text-slate-400 ml-1">lb</span>
                                </div>
                                {suplementoItems.length > 1 && (
                                  <button type="button" onClick={() => setSuplementoItems(suplementoItems.filter(i => i.id !== item.id))} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                                )}
                              </div>
                            ))}
                            <button type="button" onClick={() => setSuplementoItems([...suplementoItems, { id: Date.now(), tipo: '', libras: '' }])} className="w-full py-2.5 border border-dashed border-amber-300 text-amber-700 font-bold rounded-xl hover:bg-amber-50 transition-colors flex items-center justify-center text-xs gap-1.5">
                              <Plus size={15} /> Agregar Insumo a Ración
                            </button>
                          </div>
                          <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-colors shadow-lg shadow-emerald-600/10 mt-2 uppercase tracking-wider">Registrar Suplementación</button>
                        </form>
                      )}
                    </div>

                    <div className="lg:col-span-6 flex flex-col h-full space-y-6 text-xs">
                      {/* PANEL DE ACUMULADOS POR DIETA */}
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm mb-3 flex items-center gap-1.5"><PieChart size={16} className="text-indigo-500" /> Resumen Acumulado por Tipo</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                          {(() => {
                            const alimentosLote = listAlimentos.filter(a => a.loteId === loteActivo.id);
                            const acumuladoMap = new Map();

                            alimentosLote.forEach(a => {
                              if (!a.esSuplemento) {
                                const exist = acumuladoMap.get(a.tipo) || { tipo: a.tipo, libras: 0, costo: 0, esSuplemento: false };
                                exist.libras += a.cantidadLb;
                                exist.costo += a.costo;
                                acumuladoMap.set(a.tipo, exist);
                              } else if (a.ingredientesUsados) {
                                a.ingredientesUsados.forEach(ing => {
                                  const exist = acumuladoMap.get(ing.nombre) || { tipo: ing.nombre, libras: 0, costo: 0, esSuplemento: true };
                                  exist.libras += ing.libras;
                                  exist.costo += ing.costo;
                                  acumuladoMap.set(ing.nombre, exist);
                                });
                              }
                            });

                            const acumulados = Array.from(acumuladoMap.values()).sort((a, b) => b.libras - a.libras);

                            if (acumulados.length === 0) return <div className="col-span-2 text-center text-slate-400 italic p-6 bg-slate-50 border border-slate-200/50 rounded-2xl font-semibold">No hay consumos registrados aún.</div>;

                            return acumulados.map((item, idx) => (
                              <div key={idx} className={`p-3.5 rounded-xl border flex justify-between items-center shadow-sm bg-white ${item.esSuplemento ? 'border-amber-100 bg-amber-50/10' : 'border-emerald-100 bg-emerald-50/10'}`}>
                                <div className="overflow-hidden pr-2">
                                  <p className="font-extrabold text-slate-800 truncate" title={item.tipo}>{item.tipo}</p>
                                  <p className={`text-[9px] font-black uppercase tracking-wider mt-0.5 ${item.esSuplemento ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {item.esSuplemento ? 'Suplemento' : 'Tolva'}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-extrabold text-slate-800">{item.libras.toFixed(1)} lb</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">{formatearMoneda(item.costo)}</p>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm mb-3">Historial de Consumo Detallado</h3>
                        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm max-h-[300px] overflow-y-auto scrollbar-thin">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider sticky top-0">
                              <tr>
                                <th className="p-3.5 pl-4">Fecha</th>
                                <th className="p-3.5">Alimento</th>
                                <th className="p-3.5 text-right">Libras</th>
                                <th className="p-3.5 text-right">Costo</th>
                                <th className="p-3.5"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                              {listAlimentos.filter(a => a.loteId === loteActivo.id).sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)).map(a => (
                                <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-3.5 pl-4 text-slate-400 font-medium">{a.fecha}</td>
                                  <td className="p-3.5">
                                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                                      <span className="inline-flex items-center flex-wrap gap-1.5">
                                        {a.tipo} <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border">E{a.faseRegistro}</span>
                                        {a.origenRegistro === 'qr' && (
                                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider inline-flex items-center gap-0.5">
                                            <QrCode size={10} /> QR
                                          </span>
                                        )}
                                      </span>
                                    </p>
                                    {a.esSuplemento && <span className="bg-amber-100 text-amber-800 border border-amber-200/50 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider block w-fit mt-1.5">SUPLEMENTO</span>}
                                    {a.esSuplemento && <span className="text-[10px] text-slate-400 italic block mt-1 leading-snug">({a.detalleMezcla})</span>}
                                  </td>
                                  <td className="p-3.5 text-right font-black text-slate-800">{a.cantidadLb.toFixed(1)} lb</td>
                                  <td className="p-3.5 text-right text-rose-600">{formatearMonedaNeg(a.costo)}</td>
                                  <td className="p-3.5 text-right pr-4"><button onClick={() => handleEliminarDato('alimento', a.id)} className="text-slate-300 hover:text-rose-500 p-1 rounded-md transition-colors"><Trash2 size={15} /></button></td>
                                </tr>
                              ))}
                              {listAlimentos.filter(a => a.loteId === loteActivo.id).length === 0 && (
                                  <tr><td colSpan="5" className="py-8 text-center text-slate-450 italic font-semibold">No hay consumos registrados para este lote.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB: PESO */}
              {tabActiva === 'peso' && (() => {
                const resumenMuestra = resumirMuestraPesaje(muestraPesosCorral);
                return (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 animate-in fade-in duration-300">
                  <div className="md:col-span-5 space-y-5 text-xs font-semibold">
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5"><Scale size={18} className="text-blue-500" /> Control de Pesaje en Campo</h3>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">Pesa 3 a 5 cerdos al azar con "+ Sumar a Muestra" para que la app calcule el promedio real sin calculadora.</p>
                    </div>

                    {/* TARJETA ACTIVA DE MUESTREO MULTI-CERDO */}
                    {resumenMuestra.cantidad > 0 && (
                      <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl p-4 space-y-3.5 shadow-sm animate-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-block bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                              Muestra en Curso · {resumenMuestra.cantidad} {resumenMuestra.cantidad === 1 ? 'cerdo' : 'cerdos'}
                            </span>
                            <p className="text-2xl font-black text-emerald-950 mt-1 leading-none">
                              {resumenMuestra.promedioLb.toFixed(1)} <span className="text-xs font-bold text-emerald-700">lb promedio</span>
                            </p>
                            {resumenMuestra.cantidad > 1 && (
                              <p className="text-[10px] text-emerald-700 font-bold mt-1">
                                Rango: {resumenMuestra.minimoLb.toFixed(1)} lb – {resumenMuestra.maximoLb.toFixed(1)} lb
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setMuestraPesosCorral([])}
                            className="text-[11px] font-bold text-rose-600 hover:bg-rose-100/60 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            Limpiar
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {muestraPesosCorral.map((m, idx) => (
                            <span key={m.id} className="bg-white border border-emerald-200 pl-2.5 pr-1 py-1 rounded-lg inline-flex items-center gap-1.5 text-slate-800 font-extrabold shadow-xs">
                              <span className="text-[10px] text-slate-400">#{idx + 1}</span>
                              <span>{m.pesoLb.toFixed(1)} lb</span>
                              <button
                                type="button"
                                onClick={() => setMuestraPesosCorral(prev => prev.filter(item => item.id !== m.id))}
                                className="text-rose-400 hover:text-rose-600 p-0.5 rounded"
                                aria-label={`Quitar cerdo ${idx + 1}`}
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>

                        <button
                          type="button"
                          disabled={guardandoPeso}
                          onClick={handleGuardarPromedioMuestra}
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black rounded-xl shadow-md shadow-emerald-600/15 flex items-center justify-center gap-1.5 uppercase tracking-wider text-xs transition-all"
                        >
                          {guardandoPeso ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          ) : (
                            <>
                              <CheckCircle size={16} />
                              Guardar Promedio ({resumenMuestra.promedioLb.toFixed(1)} lb · {resumenMuestra.cantidad})
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* SECCIÓN: INGRESO DIRECTO */}
                    <div className="bg-blue-50/20 border border-blue-100 rounded-2xl p-5 space-y-4">
                      <h4 className="font-extrabold text-blue-900 text-[10px] uppercase tracking-wider">Ingreso Directo por Báscula</h4>
                      <form onSubmit={handleGuardarPesoDirecto} className="space-y-4">
                        <div>
                          <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Fecha del Pesaje</label>
                          <input type="date" value={fechaPesaje} onChange={(e) => setFechaPesaje(e.target.value)} required className="w-full p-2.5 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold" />
                        </div>
                        <div>
                          <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Peso en Báscula (lb)</label>
                          <input ref={pesoDirectoInputRef} type="number" inputMode="decimal" step="0.1" min="0" value={pesoIngresado} onChange={(e) => setPesoIngresado(e.target.value)} placeholder="Ej: 142.5" required className="w-full p-3 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-black text-base" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={handleAgregarPesoDirectoAMuestra}
                            disabled={!pesoIngresado || parseFloat(pesoIngresado) <= 0 || guardandoPeso}
                            className="py-3 px-3 bg-white hover:bg-blue-50 disabled:opacity-40 text-blue-700 border border-blue-200 font-extrabold rounded-xl transition-all flex items-center justify-center gap-1"
                          >
                            <Plus size={15} /> Sumar a Muestra
                          </button>
                          <button type="submit" disabled={guardandoPeso} className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black rounded-xl transition-all shadow-lg shadow-blue-600/10 flex items-center justify-center gap-1.5">
                            {guardandoPeso ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <><CheckCircle size={15} /> Guardar Directo</>}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* SECCIÓN: FÓRMULA DE SCHAEFFER */}
                    <div className="bg-indigo-50/20 border border-indigo-100 rounded-2xl overflow-hidden shadow-[0_4px_25px_rgb(0,0,0,0.005)]">
                      <button type="button" onClick={() => setExpandirSchaeffer(!expandirSchaeffer)} className="w-full p-4 flex items-center justify-between hover:bg-indigo-100/30 transition-colors font-extrabold text-indigo-900 uppercase text-[10px] tracking-wider border-b border-indigo-100">
                        <span className="flex items-center gap-1.5"><Calculator size={16} /> Cinta Métrica (Fórmula Schaeffer)</span>
                        <ChevronRight size={16} className={`text-indigo-600 transition-transform duration-200 ${expandirSchaeffer ? 'rotate-90' : ''}`} />
                      </button>

                      {expandirSchaeffer && (
                        <div className="p-5 space-y-4 animate-in slide-in-from-top-1 duration-200">
                          <div className="bg-white border border-indigo-100 p-3 rounded-xl leading-relaxed">
                            <p className="text-[10px] text-indigo-700 font-mono font-bold">Fórmula: Peso (lb) = (Circunferencia² × Longitud) / {constanteSchaeffer}</p>
                            <p className="text-[9px] text-slate-400 mt-1 leading-normal">Mide en centímetros detrás de los codillos y de la base de las orejas a la cola.</p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Circunferencia (cm)</label>
                              <input ref={schaefferCircInputRef} type="number" inputMode="decimal" step="0.1" min="0" value={circunferenciaCm} onChange={(e) => setCircunferenciaCm(e.target.value)} placeholder="Ej: 95" className="w-full p-2.5 border border-indigo-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" />
                            </div>
                            <div>
                              <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Longitud (cm)</label>
                              <input type="number" inputMode="decimal" step="0.1" min="0" value={longitudCm} onChange={(e) => setLongitudCm(e.target.value)} placeholder="Ej: 58" className="w-full p-2.5 border border-indigo-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm" />
                            </div>
                          </div>

                          {pesoSchaefferCalculado !== null && (
                            <div className="bg-indigo-600 text-white p-4 rounded-xl text-center shadow-md shadow-indigo-500/10">
                              <p className="text-[9px] font-black uppercase tracking-wider text-indigo-200 mb-1 leading-none">Peso Estimado del Cerdo</p>
                              <p className="text-3xl font-black tracking-tight leading-none">{pesoSchaefferCalculado.toFixed(1)}</p>
                              <p className="text-[10px] text-indigo-200 font-bold mt-1.5">libras</p>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={handleAgregarSchaefferAMuestra}
                              disabled={!pesoSchaefferCalculado || guardandoPeso}
                              className="py-3 px-3 bg-white hover:bg-indigo-50 disabled:opacity-40 text-indigo-700 border border-indigo-200 font-extrabold rounded-xl transition-all flex items-center justify-center gap-1"
                            >
                              <Plus size={15} /> Sumar a Muestra
                            </button>
                            <button type="button" onClick={handleGuardarPesoSchaeffer} disabled={!pesoSchaefferCalculado || guardandoPeso} className="py-3 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-1.5">
                              {guardandoPeso ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <><CheckCircle size={15} /> Guardar Solo Este</>}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-7 space-y-4">
                    <h3 className="font-extrabold text-slate-800 text-sm mb-1">Historial de Crecimiento & Curva de Pesos</h3>
                    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm max-h-[460px] overflow-y-auto scrollbar-thin text-xs font-semibold">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider sticky top-0">
                          <tr>
                            <th className="p-3.5 pl-5">Fecha</th>
                            <th className="p-3.5 text-right">Peso Promedio</th>
                            <th className="p-3.5 text-center">Método de Captura</th>
                            <th className="p-3.5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                          {listPesos.filter(p => p.loteId === loteActivo.id && p.pesoPromedio).sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)).map(p => (
                            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-3.5 pl-5 text-slate-400 font-medium">{p.fecha}</td>
                              <td className="p-3.5 text-right">
                                <span className="font-black text-blue-600 text-sm">{parseFloat(p.pesoPromedio).toFixed(1)} lb</span>
                                {p.cantidadMuestra > 1 && (
                                  <span className="block text-[10px] text-emerald-700 font-bold">Muestra · {p.cantidadMuestra} cerdos</span>
                                )}
                              </td>
                              <td className="p-3.5 text-center">
                                {p.metodo === 'schaeffer' ? (
                                  <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">Schaeffer</span>
                                ) : p.metodo === 'mixto' ? (
                                  <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">Muestra Mixta</span>
                                ) : (
                                  <span className="bg-blue-50 border border-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">Directo</span>
                                )}
                              </td>
                              <td className="p-3.5 text-right pr-4"><button onClick={() => handleEliminarDato('peso', p.id)} className="text-slate-300 hover:text-rose-500 p-1 rounded-md transition-colors"><Trash2 size={15} /></button></td>
                            </tr>
                          ))}
                          {listPesos.filter(p => p.loteId === loteActivo.id).length === 0 && (
                            <tr><td colSpan="4" className="py-8 text-center text-slate-400 italic font-semibold">No se han registrado pesos aún.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* TAB: SANIDAD Y BAJAS */}
              {tabActiva === 'sanidad' && (
                <div className="space-y-8 animate-in fade-in duration-300 text-xs">

                  {/* 1 · ESTADO DEL LOTE */}
                  <div className="md:col-span-2">{renderComposicionLote(loteActivo)}</div>
                    <div className={`p-5 rounded-2xl border shadow-sm space-y-4 ${riesgoNivelSanidad === 'alto' ? 'bg-rose-50/40 border-rose-100' : riesgoNivelSanidad === 'medio' ? 'bg-amber-50/40 border-amber-100' : 'bg-emerald-50/40 border-emerald-100'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-1.5"><HeartPulse size={20} className="text-rose-600" /> Estado Sanitario</h3>
                        <span className={`text-[9px] font-black uppercase tracking-wider border px-2.5 py-1 rounded-lg ${riesgoNivelSanidad === 'alto' ? 'bg-rose-100 text-rose-700 border-rose-200' : riesgoNivelSanidad === 'medio' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>Riesgo {riesgoNivelSanidad}</span>
                      </div>

                      {proximaTareaSanidad ? (
                        <div className="bg-white/70 border border-slate-100 rounded-xl p-4">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Próxima Tarea Programada</p>
                          <p className="font-extrabold text-slate-800 text-sm">{proximaTareaSanidad.tarea}</p>
                          <p className="text-xs text-slate-500 mt-1 font-medium">{proximaTareaSanidad.rango || `Día ${proximaTareaSanidad.dia}`} · {proximaTareaSanidad.fechaObjetivo}</p>
                        </div>
                      ) : (
                        <div className="bg-white/70 border border-slate-100 rounded-xl p-4 text-emerald-700 font-bold text-xs flex items-center gap-1.5">
                          <CheckCircle size={14} /> Sin tareas sanitarias pendientes.
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2.5 font-bold">
                        <button type="button" onClick={irACalendarioDesdeCorral} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl transition-colors text-center shadow-md">
                          Ver en Calendario
                        </button>
                        {listTareasSanidad.filter(t => t.loteId === loteActivo.id).length === 0 && (
                          <button type="button" onClick={() => handleSincronizarProtocoloLote(loteActivo)} className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 py-2.5 rounded-xl transition-colors">
                            Sincronizar Protocolo
                          </button>
                        )}
                      </div>

                      {historialSanidadLote.length > 0 && (
                        <div className="border-t border-slate-200/60 pt-3">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Historial Sanitario Reciente</p>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin pr-1">
                            {historialSanidadLote.map(item => (
                              <div key={item.id} className="grid grid-cols-[70px_1fr] gap-3 hover:bg-white/60 p-1.5 rounded-lg transition-colors">
                                <span className="font-bold text-slate-400 text-[11px]">{String(item.fecha).substring(5)}</span>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-700 text-[11px] truncate leading-snug">{item.tipo}: {item.texto}</p>
                                  {item.detalle && <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.detalle}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                  {/* 2 · REGISTRAR */}
                  <div>
                    <div className="flex items-baseline gap-2 mb-3">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Registrar</h3>
                      <span className="text-[11px] text-slate-300">lo que se le aplicó o gastó a este lote</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_4px_25px_rgb(0,0,0,0.005)]">
                      <h3 className="font-extrabold text-slate-800 text-base mb-1 flex items-center gap-2"><Syringe size={18} className="text-indigo-600" /> Tratamientos Médicos</h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed mb-4 border-b border-slate-50 pb-3">Si el producto sale de la farmacia se descuenta solo del stock y el costo se calcula al promedio.</p>
                      <form onSubmit={handleRegistrarTratamientoManual} className="space-y-4 font-semibold">
                        <div>
                          <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Producto</label>
                          <select name="productoId" value={tratamientoProductoId} onChange={(e) => setTratamientoProductoId(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold">
                            <option value="">Otro — no está en la farmacia</option>
                            {inventarioMedico.map(m => (
                              <option key={m.id} value={m.id} disabled={m.stock <= 0}>
                                {m.nombre}{m.stock > 0 ? ` — quedan ${m.stock.toFixed(1)} ${m.unidad}` : ' — sin existencia'}
                              </option>
                            ))}
                          </select>
                          {inventarioMedico.every(m => m.stock <= 0) && (
                            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-1.5 font-medium leading-snug">
                              La farmacia está en cero. Registrá la compra en Bodega Central → Farmacia y después la descontás desde acá.
                            </p>
                          )}
                        </div>

                        {tratamientoProductoId ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Cantidad aplicada</label><input type="number" name="cantidad" step="0.01" min="0.01" required className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold" /></div>
                            <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Fecha</label><input type="date" name="fecha" required defaultValue={todayIso()} className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50" /></div>
                          </div>
                        ) : (
                          <>
                            <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Medicamento / Fármaco</label><input type="text" name="nombre" required placeholder="Ej. Complejo B / Hierro" className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50" /></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Costo Total (Q)</label><input type="number" name="costo" step="0.01" required className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold" /></div>
                              <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Fecha</label><input type="date" name="fecha" required defaultValue={todayIso()} className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50" /></div>
                            </div>
                          </>
                        )}

                        <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-md shadow-indigo-600/10 uppercase tracking-wider">Añadir Tratamiento</button>
                      </form>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_4px_25px_rgb(0,0,0,0.005)]">
                      <h3 className="font-extrabold text-slate-800 text-base mb-1 flex items-center gap-2"><Package size={18} className="text-emerald-600" /> Consumo de Insumos</h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed mb-4 border-b border-slate-50 pb-3">Viruta, cal, desinfectante. Se descuenta de la bodega y el costo se carga a este lote.</p>
                      {inventarioInsumos.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic py-3">No hay insumos en el catálogo. Agregalos en Bodega Central → Insumos.</p>
                      ) : (
                        <form onSubmit={handleUsarInsumoEnCorral} className="space-y-4 font-semibold">
                          <input type="hidden" name="loteId" value={loteActivo.id} />
                          <div>
                            <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Insumo</label>
                            <select name="productoId" required className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold">
                              <option value="">Elegí un insumo...</option>
                              {/* Los que están en cero se muestran igual, deshabilitados: así se ve
                                  que el insumo existe y lo que falta es comprarlo. */}
                              {inventarioInsumos.map(i => (
                                <option key={i.id} value={i.id} disabled={i.stock <= 0}>
                                  {i.nombre}{i.stock > 0 ? ` — quedan ${i.stock.toFixed(1)} ${i.unidad}` : ' — sin existencia'}
                                </option>
                              ))}
                            </select>
                            {inventarioInsumos.every(i => i.stock <= 0) && (
                              <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-1.5 font-medium leading-snug">
                                Todos están en cero. Registrá la compra en Bodega Central → Insumos y después los descontás desde acá.
                              </p>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Cantidad</label><input type="number" name="cantidad" step="0.01" min="0.01" required className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold" /></div>
                            <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Fecha</label><input type="date" name="fecha" required defaultValue={todayIso()} className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50" /></div>
                          </div>
                          <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Nota (opcional)</label><input type="text" name="observacion" placeholder="Ej: cambio de cama" className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50" /></div>
                          <button type="submit" className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all shadow-md uppercase tracking-wider">Descontar de Bodega</button>
                        </form>
                      )}
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_4px_25px_rgb(0,0,0,0.005)]">
                      <h3 className="font-extrabold text-slate-800 text-base mb-4 flex items-center gap-2 border-b border-slate-50 pb-3"><Receipt size={18} className="text-slate-500" /> Gastos Operativos Directos</h3>
                      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target); setGastosExtra(prev => [...safeArr(prev), { id: crypto.randomUUID(), loteId: loteActivo.id, fecha: fd.get('fecha'), descripcion: fd.get('descripcion').trim(), monto: parseFloat(fd.get('monto')) }]); e.target.reset(); }} className="space-y-4 font-semibold">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Fecha</label><input type="date" name="fecha" required defaultValue={todayIso()} className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50" /></div>
                          <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Monto Gasto (Q)</label><input type="number" inputMode="decimal" name="monto" step="0.01" required className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold" /></div>
                        </div>
                        <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Descripción / Concepto</label><input type="text" name="descripcion" required placeholder="Ej: Flete de acarreo / aserrín" className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50" /></div>
                        <button type="submit" className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-xl transition-all shadow-md uppercase tracking-wider">Añadir Gasto Directo</button>
                      </form>
                    </div>
                    <div className="bg-rose-50/20 border border-rose-100 rounded-2xl p-5 space-y-4">
                      <h3 className="font-extrabold text-rose-950 text-base flex items-center gap-1.5"><HeartPulse size={20} className="text-rose-600" /> Registro de Bajas y Decesos</h3>
                      <form onSubmit={handleRegistrarBaja} className="space-y-4 font-semibold text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div><label className="block text-slate-500 uppercase tracking-widest font-bold mb-1.5">Fecha de Baja</label><input type="date" name="fecha" required defaultValue={todayIso()} className="w-full p-2.5 border border-rose-200 bg-white rounded-xl outline-none" /></div>
                          <div><label className="block text-slate-500 uppercase tracking-widest font-bold mb-1.5">Cantidad Muertes</label><input type="number" name="cantidad" required min="1" className="w-full p-2.5 border border-rose-200 bg-white rounded-xl outline-none font-bold" /></div>
                        </div>
                        <div><label className="block text-slate-500 uppercase tracking-widest font-bold mb-1.5">Causa / Diagnóstico de Muerte</label><input type="text" name="causa" required placeholder="Ej. Neumonía / Infección bacteriana" className="w-full p-2.5 border border-rose-200 bg-white rounded-xl outline-none" /></div>
                        <button type="submit" className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl transition-all shadow-md shadow-rose-600/10 uppercase tracking-wider">Registrar Baja Definitiva</button>
                      </form>
                    </div>
                    </div>
                  </div>

                  {/* 3 · HISTORIAL */}
                  <div>
                    <div className="flex items-baseline gap-2 mb-3">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Historial</h3>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                    <div className="space-y-2.5">
                      <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-50 pb-2">Gastos Sanitarios & Operativos Registrados</h3>
                      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm max-h-48 overflow-y-auto scrollbar-thin">
                        <table className="w-full text-left text-xs border-collapse">
                          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                            {listGastosExtra.filter(g => g.loteId === loteActivo.id).map(g => (
                              <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 pl-4"><p className="font-bold text-slate-800">{g.descripcion}</p><p className="text-[10px] text-slate-400 font-medium mt-0.5">{g.fecha} • Operación</p></td>
                                <td className="p-3 text-right font-black text-rose-600">{formatearMonedaNeg(g.monto)}</td>
                                <td className="p-3 text-right pr-4"><button onClick={() => handleEliminarDato('gasto', g.id)} className="text-slate-300 hover:text-rose-500 p-1 rounded-md transition-colors"><Trash2 size={15} /></button></td>
                              </tr>
                            ))}
                            {listVacunas.filter(v => v.loteId === loteActivo.id).map(v => (
                              <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 pl-4"><p className="font-bold text-indigo-900">{v.nombre}</p><p className="text-[10px] text-slate-400 font-medium mt-0.5">{v.fecha} • Tratamiento Médico</p></td>
                                <td className="p-3 text-right font-black text-rose-600">{formatearMonedaNeg(v.costo)}</td>
                                <td className="p-3 text-right pr-4"><button onClick={() => handleEliminarDato('vacuna', v.id)} className="text-slate-300 hover:text-rose-500 p-1 rounded-md transition-colors"><Trash2 size={15} /></button></td>
                              </tr>
                            ))}
                            {listGastosExtra.filter(g => g.loteId === loteActivo.id).length === 0 && listVacunas.filter(v => v.loteId === loteActivo.id).length === 0 && (
                              <tr><td colSpan="3" className="py-8 text-center text-slate-400 italic font-semibold">No hay gastos sanitarios u operativos.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <h3 className="font-extrabold text-slate-800 text-sm flex justify-between items-end border-b border-slate-50 pb-2">
                        <span>Historial de Bajas</span>
                        <span className="text-[10px] font-bold text-slate-400 normal-case">*Pérdida = Lechón + Alimento consumido.</span>
                      </h3>
                      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm max-h-56 overflow-y-auto scrollbar-thin">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider sticky top-0">
                            <tr>
                              <th className="p-3 pl-4">Causa y Fecha</th>
                              <th className="p-3 text-center">Bajas</th>
                              <th className="p-3 text-right">Pérdida Estimada</th>
                              <th className="p-3"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                            {listBajas.filter(b => b.loteId === loteActivo.id).map(b => {
                              const alimentosHastaBaja = listAlimentos.filter(a => a.loteId === loteActivo.id && new Date(a.fecha) <= new Date(b.fecha));
                              const costoAlimentoTotal = alimentosHastaBaja.reduce((sum, a) => sum + (a.costo || 0), 0);
                              const costoAlimentoCerdo = costoAlimentoTotal / (loteActivo.cantidad || 1);
                              const costoPorCerdoMuerto = (loteActivo.costoLechon || 0) + costoAlimentoCerdo;
                              const perdidaTotalBaja = b.cantidad * costoPorCerdoMuerto;

                              return (
                                <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-3 pl-4">
                                    <p className="font-bold text-slate-800">{b.causa}</p>
                                    <p className="text-[10px] text-slate-450 mt-0.5">{b.fecha}</p>
                                  </td>
                                  <td className="p-3 text-center font-black text-rose-600 text-sm">{b.cantidad}</td>
                                  <td className="p-3 text-right">
                                    <p className="font-bold text-rose-600">{formatearMonedaNeg(perdidaTotalBaja)}</p>
                                    <p className="text-[9px] text-slate-450 font-bold mt-0.5">c/u: {formatearMoneda(costoPorCerdoMuerto)}</p>
                                  </td>
                                  <td className="p-3 text-right pr-4"><button onClick={() => handleEliminarDato('baja', b.id)} className="text-slate-300 hover:text-rose-500 p-1 rounded-md transition-colors"><Trash2 size={15} /></button></td>
                                </tr>
                              );
                            })}
                            {listBajas.filter(b => b.loteId === loteActivo.id).length === 0 && (
                              <tr><td colSpan="4" className="py-8 text-center text-slate-400 italic font-semibold">No se han registrado bajas en este lote.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: FINANZAS Y SIMULADOR */}
              {/* TAB: VENTAS EN BÁSCULA */}
              {tabActiva === 'ventas' && (() => {
                const ventasDelLote = listVentas
                  .filter(v => v.loteId === loteActivo.id)
                  .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || String(b.id || '').localeCompare(String(a.id || '')));
                const ventasVigentes = ventasDelLote.filter(v => !v.anulada);
                const ventasAnuladas = ventasDelLote.filter(v => v.anulada);
                const cerdosVendidos = ventasVigentes.reduce((s, v) => s + (Number(v.cantidadCerdos) || 0), 0);
                const librasVendidas = ventasVigentes.reduce((s, v) => s + getVentaLibras(v), 0);
                const ingresoVentas = ventasVigentes.reduce((s, v) => s + (Number(v.totalVenta) || 0), 0);

                // Dos registros vigentes con los mismos cerdos, las mismas libras y el mismo
                // total casi siempre son la misma bascula guardada dos veces. La fecha queda
                // FUERA de la firma a proposito: el error tipico es volver a registrar la misma
                // bascula al dia siguiente, y con la fecha dentro esos casos no se detectaban.
                const firmaVenta = (v) => `${Number(v.cantidadCerdos) || 0}|${getVentaLibras(v).toFixed(1)}|${(Number(v.totalVenta) || 0).toFixed(2)}`;
                const conteoFirmas = ventasVigentes.reduce((acc, v) => {
                  const firma = firmaVenta(v);
                  acc[firma] = (acc[firma] || 0) + 1;
                  return acc;
                }, {});
                const hayDuplicados = Object.values(conteoFirmas).some(n => n > 1);

                const fechaLarga = (fecha) => fecha
                  ? new Date(`${fecha}T00:00:00`).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })
                  : 'Sin fecha';
                const fechaHoraAnulacion = (iso) => {
                  if (!iso) return '';
                  const d = new Date(iso);
                  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                };

                return (
                  <div className="space-y-6 animate-in fade-in duration-300 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5"><Receipt size={18} className="text-emerald-600" /> Historial de Ventas en Báscula</h3>
                        <p className="text-[11px] text-slate-450 font-medium leading-relaxed mt-1 max-w-2xl">
                          Cada báscula registrada en este corral, en orden. Si una venta se guardó por error, anulala: el registro queda archivado con su motivo y los cerdos, las libras y el dinero vuelven a su lugar.
                        </p>
                      </div>
                      <button onClick={prepararVentaLote} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-600/10 flex items-center transition-all gap-1.5 shrink-0 self-start sm:self-end">
                        <Scale size={16} /> Vender en Báscula
                      </button>
                    </div>

                    {hayDuplicados && (
                      <div className="bg-amber-50/60 border border-amber-300/60 rounded-2xl p-3.5 flex items-start gap-2.5">
                        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-900 font-medium leading-relaxed">
                          Hay ventas vigentes <strong>idénticas</strong> en este corral: mismos cerdos, mismas libras y mismo total, aunque la fecha no coincida. Revisá las marcadas abajo: si la misma báscula se registró dos veces, anulá la repetida.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Ventas Vigentes</p>
                        <p className="text-2xl font-black text-slate-900 leading-none">{ventasVigentes.length}</p>
                        {ventasAnuladas.length > 0 && <p className="text-[10px] font-bold text-rose-500 mt-1.5">{ventasAnuladas.length} anulada{ventasAnuladas.length === 1 ? '' : 's'}</p>}
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Cerdos Vendidos</p>
                        <p className="text-2xl font-black text-slate-900 leading-none">{cerdosVendidos}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1.5">de {loteActivo.cantidad} ingresados</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Libras de Báscula</p>
                        <p className="text-2xl font-black text-blue-600 leading-none">{librasVendidas.toFixed(1)}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1.5">lb pesadas</p>
                      </div>
                      <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4">
                        <p className="text-[9px] font-black text-emerald-700/60 uppercase tracking-widest leading-none mb-2">Ingreso Real</p>
                        <p className="text-2xl font-black text-emerald-600 leading-none">{formatearMoneda(ingresoVentas)}</p>
                        <p className="text-[10px] font-bold text-emerald-700/50 mt-1.5">cobrado en báscula</p>
                      </div>
                    </div>

                    {ventasDelLote.length === 0 ? (
                      <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center">
                        <Receipt size={36} className="text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-bold text-sm">Todavía no hay ventas en este corral</p>
                        <p className="text-[11px] text-slate-400 font-medium mt-1">Cuando registres una báscula, aparecerá aquí y podrás anularla si algo salió mal.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {ventasDelLote.map(venta => {
                          const libras = getVentaLibras(venta);
                          const cerdos = Number(venta.cantidadCerdos) || 0;
                          const promedio = cerdos > 0 ? libras / cerdos : 0;
                          const anulada = Boolean(venta.anulada);
                          const sospechosa = !anulada && conteoFirmas[firmaVenta(venta)] > 1;
                          const pesos = Array.isArray(venta.pesosVenta) ? venta.pesosVenta : [];
                          const anulandoEsta = ventaAnulandoId === venta.id;

                          return (
                            <div key={venta.id} className={`rounded-2xl border overflow-hidden transition-colors ${anulada ? 'bg-slate-50/80 border-slate-200' : sospechosa ? 'bg-white border-amber-300/70 shadow-sm' : 'bg-white border-slate-100 shadow-sm'}`}>
                              <div className="p-4 sm:p-5 space-y-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center flex-wrap gap-2">
                                      <p className={`font-extrabold text-sm ${anulada ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{fechaLarga(venta.fecha)}</p>
                                      {anulada ? (
                                        <span className="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">Anulada</span>
                                      ) : (
                                        <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">Vigente</span>
                                      )}
                                      {sospechosa && (
                                        <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">Posible duplicado</span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-semibold mt-1">Báscula · {cerdos} cerdo{cerdos === 1 ? '' : 's'}</p>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {anulada ? (
                                      <>
                                        <button onClick={() => handleRestaurarVenta(venta)} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold py-2 px-3 rounded-xl transition-colors flex items-center gap-1.5">
                                          <RotateCcw size={14} /> Restaurar
                                        </button>
                                        <button onClick={() => handleEliminarVentaAnulada(venta)} title="Borrar el registro del historial" className="text-slate-300 hover:text-rose-500 p-2 rounded-lg transition-colors">
                                          <Trash2 size={15} />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => enviarPorWhatsApp(formatearReciboVentaWhatsApp({
                                            corralNombre: corralSeleccionado.nombre,
                                            raza: loteActivo.raza || loteActivo.nombre || 'Estándar',
                                            fecha: venta.fecha,
                                            cantidadCerdos: cerdos,
                                            totalLibras: libras,
                                            precioLibra: Number(venta.precioLibra) || 0,
                                            totalVenta: Number(venta.totalVenta) || 0,
                                            pesosIndividuales: pesos
                                          }))}
                                          className="bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 font-bold py-2 px-3 rounded-xl transition-colors flex items-center gap-1.5"
                                          title="Enviar comprobante de báscula por WhatsApp"
                                        >
                                          <MessageCircle size={14} /> Recibo WhatsApp
                                        </button>
                                        <button
                                          onClick={() => { setVentaAnulandoId(anulandoEsta ? null : venta.id); setMotivoAnulacionVenta(''); }}
                                          className={`font-bold py-2 px-3 rounded-xl transition-colors flex items-center gap-1.5 border ${anulandoEsta ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-rose-50 border-rose-200/60 text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600'}`}
                                        >
                                          {anulandoEsta ? <><X size={14} /> Cancelar</> : <><Ban size={14} /> Anular</>}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${anulada ? 'opacity-50' : ''}`}>
                                  <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none mb-1.5">Libras Totales</p>
                                    <p className={`font-black text-base ${anulada ? 'text-slate-500 line-through' : 'text-blue-600'}`}>{libras.toFixed(1)} lb</p>
                                  </div>
                                  <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none mb-1.5">Peso Promedio</p>
                                    <p className={`font-black text-base ${anulada ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{promedio.toFixed(1)} lb</p>
                                  </div>
                                  <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none mb-1.5">Precio por Libra</p>
                                    <p className={`font-black text-base ${anulada ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{formatearMoneda(Number(venta.precioLibra) || 0)}</p>
                                  </div>
                                  <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none mb-1.5">Total Cobrado</p>
                                    <p className={`font-black text-base ${anulada ? 'text-slate-500 line-through' : 'text-emerald-600'}`}>{formatearMoneda(Number(venta.totalVenta) || 0)}</p>
                                  </div>
                                </div>

                                {pesos.length > 0 && (
                                  <details className="group">
                                    <summary className="cursor-pointer text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-wider list-none flex items-center gap-1 select-none">
                                      <ChevronRight size={13} className="transition-transform group-open:rotate-90" /> Ver los {pesos.length} pesos de esta báscula
                                    </summary>
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                      {pesos.map((item, index) => (
                                        <span key={index} className="bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-lg text-[10px] font-bold">
                                          #{item?.numero ?? index + 1}: {Number(typeof item === 'number' ? item : item?.peso || 0).toFixed(1)} lb
                                        </span>
                                      ))}
                                    </div>
                                  </details>
                                )}

                                {anulada && (
                                  <div className="bg-rose-50/60 border border-rose-200/60 rounded-xl p-3.5 space-y-1">
                                    <p className="text-[10px] font-black text-rose-700 uppercase tracking-wider leading-none">Anulada</p>
                                    <p className="text-[11px] text-rose-900 font-medium leading-relaxed">
                                      {venta.motivoAnulacion ? venta.motivoAnulacion : 'Sin motivo especificado.'}
                                    </p>
                                    <p className="text-[10px] text-rose-700/60 font-semibold pt-1">
                                      {venta.anuladaPor || 'Usuario'}{fechaHoraAnulacion(venta.anuladaEn) ? ` · ${fechaHoraAnulacion(venta.anuladaEn)}` : ''}
                                    </p>
                                  </div>
                                )}

                                {anulandoEsta && (
                                  <div className="bg-rose-50/40 border border-rose-200/60 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-1 duration-200">
                                    <div>
                                      <label className="block text-[10px] font-black text-rose-700 uppercase tracking-wider mb-1.5">Motivo de la anulación</label>
                                      <input
                                        type="text"
                                        value={motivoAnulacionVenta}
                                        onChange={(e) => setMotivoAnulacionVenta(e.target.value)}
                                        placeholder="Ej: la misma báscula se guardó dos veces"
                                        className="w-full p-2.5 border border-rose-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 font-semibold text-slate-700"
                                      />
                                    </div>
                                    <p className="text-[10px] text-rose-900/70 font-medium leading-relaxed">
                                      Al anular, <strong>{cerdos} cerdo{cerdos === 1 ? '' : 's'}</strong> regresan al inventario vivo, se descuentan <strong>{libras.toFixed(1)} lb</strong> de la producción y <strong>{formatearMoneda(Number(venta.totalVenta) || 0)}</strong> salen de los ingresos. El registro no se borra.
                                    </p>
                                    <button onClick={() => handleAnularVenta(venta)} className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl transition-colors shadow-lg shadow-rose-600/10 uppercase tracking-wider flex items-center justify-center gap-1.5">
                                      <Ban size={15} /> Confirmar anulación
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {tabActiva === 'finanzas' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in duration-300 text-xs">
                  <div className="xl:col-span-4 space-y-6">
                    <div className="bg-emerald-50/30 p-5 border border-emerald-100 rounded-2xl shadow-sm">
                      <h3 className="font-bold text-base text-emerald-950 mb-3.5 flex items-center gap-1.5"><Calculator size={18} className="text-emerald-600" /> Parámetros del Negocio</h3>
                      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target); setLotes(prev => safeArr(prev).map(l => l.id === loteActivo.id ? { ...l, costoLechon: parseFloat(fd.get('costoLechon')) || 0, precioVentaLibra: parseFloat(fd.get('precioVentaLibra')) || 0, manoObra: parseFloat(fd.get('manoObra')) || 0 } : l)); mostrarAlerta("Éxito", "Parámetros actualizados. El simulador se ha recalculado."); }} className="space-y-4 font-semibold">
                        <p className="text-xs text-emerald-800 leading-normal border-b border-emerald-100 pb-3 font-medium">Define los costos unitarios y precio de venta esperados para proyectar rentabilidades de cierre.</p>
                        <div><label className="block text-slate-700 mb-1">Costo Unitario del Lechón (Q)</label><input type="number" name="costoLechon" step="0.01" required defaultValue={loteActivo.costoLechon} className="w-full p-2.5 border border-emerald-250 bg-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                        <div><label className="block text-slate-700 mb-1">Mano de Obra (Ciclo completo) (Q)</label><input type="number" name="manoObra" step="0.01" required defaultValue={loteActivo.manoObra} className="w-full p-2.5 border border-emerald-250 bg-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                        <div><label className="block text-slate-700 mb-1">Precio de Venta por Libra Esperado (Q)</label><input type="number" name="precioVentaLibra" step="0.01" required defaultValue={loteActivo.precioVentaLibra} className="w-full p-2.5 border border-emerald-250 bg-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-extrabold text-emerald-800" /></div>
                        <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl transition-all shadow-md uppercase tracking-wider mt-2">Guardar Costos</button>
                      </form>
                    </div>

                    <div className="bg-amber-50/30 border border-amber-200/50 p-5 rounded-2xl shadow-sm space-y-4">
                      <h3 className="font-bold text-base text-amber-950 flex items-center gap-1.5"><AlertTriangle size={18} className="text-amber-500" /> Escenario de Estrés</h3>
                      <div className="space-y-4 leading-normal font-semibold">
                        <p className="text-amber-800 font-medium">Calcula la utilidad neta final si sufrieras pérdidas de ganado adicionales de aquí a mercado.</p>
                        <div className="space-y-3 bg-white p-4 rounded-xl border border-amber-200/40">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 leading-none">Bajas Extra Hipotéticas</label>
                          <div className="flex items-center gap-3">
                            <input type="range" min="0" max={stats.cantidadActual} value={simuladorMuertesExtra} onChange={(e) => setSimuladorMuertesExtra(parseInt(e.target.value))} className="flex-1 h-1.5 accent-amber-500 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                            <span className="font-black text-xl text-amber-600 w-8 text-center shrink-0">{simuladorMuertesExtra}</span>
                          </div>
                          <div className="border-t border-slate-100 pt-2 mt-1 space-y-1 text-[10px] text-slate-450">
                            <div className="flex justify-between"><span>Cerdos vivos hoy</span><strong className="text-slate-700">{stats.cantidadActual}</strong></div>
                            {stats.mortalidadEsperadaProyectada > 0 && (
                              <div className="flex justify-between" title="Proyectadas con la mortalidad historica de este mismo lote">
                                <span>Bajas esperadas (histórico)</span>
                                <strong className="text-amber-600">-{stats.mortalidadEsperadaProyectada.toFixed(1)}</strong>
                              </div>
                            )}
                            {simuladorMuertesExtra > 0 && (
                              <div className="flex justify-between"><span>Bajas hipotéticas</span><strong className="text-amber-600">-{simuladorMuertesExtra}</strong></div>
                            )}
                            <div className="flex justify-between border-t border-slate-100 pt-1.5 mt-1.5"><span className="font-bold text-slate-600">Se proyecta vender</span><strong className="text-slate-800">{stats.cantidadParaProyeccion.toFixed(1)} cerdos</strong></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-8 space-y-4">
                    <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5"><TrendingUp size={18} className="text-indigo-500" /> Simulador de Cierre de Lote (Meta: {stats.pesoObjetivoLb} lb)</h3>

                    {stats.parametrosIncompletos && (
                      <div className="bg-slate-100 border border-slate-300 rounded-2xl p-3.5 flex items-start gap-2.5">
                        <AlertTriangle size={16} className="text-slate-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                          Faltan parámetros de este lote:{' '}
                          <strong>{[stats.faltaPrecioVenta && 'precio de venta por libra', stats.faltaCostoLechon && 'costo unitario del lechón'].filter(Boolean).join(' y ')}</strong> en Q0.
                          Mientras estén en cero, la proyección de abajo no significa nada. Configuralos en Parámetros del Negocio.
                        </p>
                      </div>
                    )}

                    {stats.pesajeVencido && (
                      <div className="bg-amber-50/60 border border-amber-300/60 rounded-2xl p-3.5 flex items-start gap-2.5">
                        <Scale size={16} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-900 font-medium leading-relaxed">
                          {stats.sinPesajes
                            ? <>Este lote <strong>no tiene ningún pesaje registrado</strong>. No hay base real para proyectar.</>
                            : <>Último pesaje hace <strong>{stats.diasSinPesaje} días</strong> ({stats.pesoActual.toFixed(1)} lb). Como el lote consumió alimento desde entonces, se estima un peso actual de <strong>~{stats.pesoParaProyeccion.toFixed(1)} lb</strong> con una conversión de referencia de 3.0, y ese es el peso que usan los cálculos de abajo. <strong>Registrá un pesaje real</strong> para reemplazar la estimación.</>}
                        </p>
                      </div>
                    )}

                    {stats.fcaProyeccionAcotada && (
                      <div className="bg-orange-50/60 border border-orange-300/60 rounded-2xl p-3.5 flex items-start gap-2.5">
                        <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-orange-900 font-medium leading-relaxed">
                          La conversión alimenticia calculada de este lote es <strong>{stats.fca.toFixed(2)}</strong>, fuera del rango biológico posible — casi siempre significa que faltan pesajes.
                          Para proyectar el alimento futuro se está usando <strong>{stats.fcaProyeccion.toFixed(2)}</strong> en su lugar.
                          <span className="block mt-1.5 text-orange-800/70">La proyección siempre usa la conversión <em>marginal</em> de finalización (un 20% peor que la acumulada del ciclo), porque el cerdo de engorde convierte peor que el lechón.</span>
                        </p>
                      </div>
                    )}

                    {stats.pesoAjustadoPorVenta && (
                      <div className="bg-blue-50/60 border border-blue-200/60 rounded-2xl p-3.5 flex items-start gap-2.5">
                        <Scale size={16} className="text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-blue-900 font-medium leading-relaxed">
                          Último pesaje registrado: <strong>{stats.pesoActualRegistrado.toFixed(1)} lb</strong> (promedio de todo el lote antes de la venta parcial).
                          Peso estimado de los <strong>{stats.cantidadActual} cerdos que quedan: {stats.pesoActual.toFixed(1)} lb</strong>, descontando las libras de báscula ya vendidas.
                          Los cálculos de esta pantalla usan el peso estimado. Registra un pesaje nuevo para reemplazarlo por una medición real.
                        </p>
                      </div>
                    )}

                    {stats.pesoParaProyeccion >= stats.pesoObjetivoLb ? (
                      <div className="bg-slate-900 text-white p-6 lg:p-12 rounded-3xl text-center shadow-lg border-2 border-emerald-500 relative overflow-hidden flex flex-col justify-center items-center">
                        {(simuladorMuertesExtra > 0 || stats.mortalidadEsperadaProyectada > 0) && <div className="absolute top-4 right-4 bg-amber-100 border border-amber-200 text-amber-800 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">Simulación Pesimista Activa</div>}
                        <CheckCircle size={56} className="text-emerald-400 mb-3" />
                        <h4 className="text-2xl font-black mb-1">¡Lote Listo para Mercado!</h4>
                        <p className="text-slate-400 text-xs mb-6 max-w-md font-medium leading-relaxed">El ganado ha superado el peso objetivo comercial. Puedes coordinar la báscula de venta.</p>
                        <div className="bg-slate-950/80 border border-slate-800/80 p-5 rounded-2xl shadow-inner max-w-xs w-full text-center">
                          <p className="text-[10px] text-slate-450 font-bold uppercase tracking-widest leading-none mb-2">Utilidad Neta Proyectada a Cierre</p>
                          <p className={`text-3xl font-black ${stats.proyeccionUtilidadFinal > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatearMoneda(stats.proyeccionUtilidadFinal)}</p>
                          <p className="text-[10px] text-slate-450 font-medium leading-relaxed mt-3 border-t border-slate-800/80 pt-3">Vendiendo {stats.cantidadParaProyeccion.toFixed(1)} cerdos a {stats.pesoParaProyeccion.toFixed(1)} lb{stats.pesoEsEstimado && ' (peso estimado)'}, descontada toda la inversión y la mano de obra.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.015)] overflow-hidden">
                        <div className="bg-slate-900 p-4 sm:p-6 lg:p-8 text-white relative">
                          <h4 className="text-indigo-300 font-black mb-4 uppercase tracking-widest text-[10px] leading-none">Proyección de Cierre Planificada</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div><p className="text-slate-450 text-[10px] font-bold uppercase tracking-wider mb-1 leading-none">Libras Faltantes de Carne</p><p className="text-2xl font-black text-white">{stats.proyeccionLibrasFaltantes.toFixed(0)} lb</p></div>
                            <div><p className="text-slate-450 text-[10px] font-bold uppercase tracking-wider mb-1 leading-none">Alimento Faltante Estimado</p><p className="text-2xl font-black text-white">{(stats.proyeccionAlimentoFaltante / stats.librasPorSacoFinalizacion).toFixed(1)} <span className="text-xs font-bold text-slate-400 uppercase">Sacos ({stats.librasPorSacoFinalizacion}lb)</span></p></div>
                          </div>
                        </div>

                        <div className="p-4 sm:p-6 lg:p-8 space-y-4 font-semibold text-slate-600 text-sm">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <span className="text-slate-500 font-medium">Inversión actual (lechones, alimento, sanidad):</span>
                            <span className="font-bold text-slate-800">{formatearMonedaNeg(stats.costoInvertidoTotal)}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <span className="text-slate-500 font-medium">Mano de obra del ciclo:</span>
                            <span className="font-bold text-slate-800">{formatearMonedaNeg(loteActivo.manoObra || 0)}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <span className="text-slate-500 font-medium flex items-center gap-1.5"><AlertTriangle size={15} className="text-amber-500" /> Costo alimento futuro estimado:</span>
                            <span className="font-bold text-rose-500">{formatearMonedaNeg(stats.proyeccionCostoFaltante)}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <span className="text-slate-900 font-black">Venta Bruta Total Proyectada (A Meta):</span>
                            <span className="font-black text-emerald-600 text-lg">+{formatearMoneda(stats.proyeccionVentaFinal)}</span>
                          </div>

                          <div className="bg-slate-50 border border-slate-100 p-4 sm:p-6 lg:p-8 rounded-3xl mt-5 text-center shadow-inner relative">
                            {(simuladorMuertesExtra > 0 || stats.mortalidadEsperadaProyectada > 0) && <div className="absolute top-4 right-4 bg-amber-100 border border-amber-200 text-amber-800 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">Simulación Pesimista Activa</div>}
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 leading-none">Margen Neto Limpio Estimado a Cierre</p>
                            <p className={`text-4xl md:text-5xl font-black tracking-tight leading-none ${stats.proyeccionUtilidadFinal > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {formatearMoneda(stats.proyeccionUtilidadFinal)}
                            </p>
                            <p className="text-slate-450 text-[10px] font-medium leading-relaxed max-w-md mx-auto mt-4">
                              Esta simulación descuenta compras de lechones, costo total del alimento (suministrado y futuro), gastos de sanidad y mano de obra.
                              Proyecta la venta de {stats.cantidadParaProyeccion.toFixed(1)} cerdos
                              {stats.mortalidadEsperadaProyectada > 0 && `, tras restar ${stats.mortalidadEsperadaProyectada.toFixed(1)} bajas esperadas por tu mortalidad histórica`}
                              {simuladorMuertesExtra > 0 && ` y las ${simuladorMuertesExtra} bajas hipotéticas configuradas`}.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFichaCorral = () => {
    const loteActivo = getLoteActivo(corralSeleccionado.id);
    if (!loteActivo) return null;
    const st = calcularEstadisticasLote(loteActivo);

    const faseCalculadaPorDias = CRONOGRAMA_ALIMENTACION.find(f => st.diasLote >= f.diaInicio && st.diasLote <= f.diaFin)?.fase || 7;
    const faseActualNum = loteActivo.faseActual || faseCalculadaPorDias;
    const faseActual = CRONOGRAMA_ALIMENTACION.find(f => f.fase === faseActualNum);
    const alimentoActual = faseActual ? faseActual.alimento : 'Fase Final / Venta';
    const etapaActual = faseActual ? `Etapa ${faseActual.fase}` : 'Finalización';

    const fechaIngresoFormateada = new Date(loteActivo.fechaIngreso + 'T00:00:00').toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' });
    const fInicioStr = faseActual ? addDaysToDate(loteActivo.fechaIngreso, faseActual.diaInicio - 1) : '-';
    const fFinStr = faseActual ? addDaysToDate(loteActivo.fechaIngreso, faseActual.diaFin - 1) : '-';
    const tareasLote = listTareasSanidad
      .filter(t => t.loteId === loteActivo.id)
      .map(t => ({
        ...t,
        fechaObjetivo: t.fechaObjetivo || (loteActivo.fechaIngreso ? addDaysToIsoDate(loteActivo.fechaIngreso, Number(t.dia) || 0) : '')
      }))
      .sort((a, b) => String(a.fechaObjetivo || '').localeCompare(String(b.fechaObjetivo || '')));
    const proximasTareas = tareasLote
      .filter(t => t.estado !== 'hecho')
      .slice(0, 6);
    const tratamientosLote = [
      ...listVacunas
        .filter(v => v.loteId === loteActivo.id)
        .map(v => ({ id: v.id, fecha: v.fecha, nombre: v.nombre || v.vacuna || v.tipo || 'Tratamiento', detalle: '', costo: Number(v.costo) || 0 })),
      ...listUsosMedicos
        .filter(u => u.loteId === loteActivo.id)
        .map(u => ({ id: u.id, fecha: u.fecha, nombre: u.nombre || 'Medicamento', detalle: `${u.cantidad || ''} ${u.unidad || ''}`.trim(), costo: Number(u.costo) || 0 }))
    ].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    const bajasLote = listBajas
      .filter(b => b.loteId === loteActivo.id)
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    const ultimaIntervencion = tratamientosLote[0];
    const estadoSanitario = st.mortalidadPorcentaje > 5 || tareasLote.some(t => t.estado === 'pendiente' && t.fechaObjetivo && t.fechaObjetivo < todayIso())
      ? 'Atención'
      : 'Normal';
    const checklistSanitario = ['Diarrea', 'Tos', 'Falta de apetito', 'Retrasados', 'Cojera', 'Amontonamiento por frío/calor', 'Bebedero sin agua'];

    return (
      <div className="bg-slate-100 min-h-screen p-4 lg:p-8 flex justify-center animate-in fade-in">
        <div className="bg-white max-w-[8.5in] w-full rounded-3xl shadow-xl border border-slate-200/50 overflow-x-auto overflow-y-hidden">
          <div className="bg-slate-900 p-4 flex justify-between items-center text-xs">
            <button onClick={() => setVista('corralDetail')} className="text-slate-300 hover:text-white font-bold flex items-center gap-1.5 transition-colors"><ChevronRight size={18} className="rotate-180" /> Volver al Corral</button>
            <button onClick={() => descargarPDF('ficha-pdf', `Ficha_${corralSeleccionado.nombre}.pdf`)} className="bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black py-2 px-5 rounded-xl flex items-center shadow-lg shadow-emerald-500/20 transition-all gap-1.5"><Printer size={16} /> Descargar PDF</button>
          </div>

          <div id="ficha-pdf" className="bg-white text-black font-sans">
            <section className="w-[8.5in] h-[11in] box-border border-[10px] border-slate-900 p-[0.36in] overflow-hidden">
              <div className="text-center border-b-4 border-slate-900 pb-6 mb-8">
                <h1 className="text-[52px] font-black text-slate-900 tracking-tighter uppercase leading-none">{corralSeleccionado.nombre}</h1>
                <p className="text-xl font-black text-slate-500 mt-2 uppercase tracking-widest">Porcicontrol</p>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8 text-xs font-semibold">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-350 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Cabezas Activas</p>
                  <p className="text-4xl font-black text-slate-900 leading-none">{st.cantidadActual} <span className="text-sm font-bold text-slate-500">cerdos</span></p>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-350 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Días de Engorde</p>
                  <p className="text-4xl font-black text-slate-900 leading-none">{st.diasLote} <span className="text-sm font-bold text-slate-500">días</span></p>
                </div>
              </div>

              <div className="bg-indigo-50 border-2 border-indigo-900 p-6 rounded-2xl mb-8 text-center text-xs">
                <p className="text-[10px] font-black text-indigo-800 uppercase tracking-widest mb-2 leading-none">Alimentación Programada ({etapaActual})</p>
                <p className="text-3xl font-black text-indigo-950">{alimentoActual}</p>
                {faseActual && <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest border-t border-indigo-200/50 pt-2 mt-3 inline-block">Periodo sugerido: {fInicioStr} al {fFinStr}</p>}
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8 text-center text-xs font-semibold">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase border-b border-slate-200 pb-1.5 mb-2 leading-none">Fecha de Ingreso</p>
                  <p className="text-lg font-bold text-slate-800 leading-tight">{fechaIngresoFormateada}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase border-b border-slate-200 pb-1.5 mb-2 leading-none">Último Peso Registrado</p>
                  <p className="text-lg font-bold text-slate-800 leading-tight" title={tituloPesoLb(st)}>{st.pesoParaProyeccion > 0 ? `${formatPesoLb(st)} promedio` : 'Sin pesaje registrado'}</p>
                </div>
              </div>

              <div className="border-t-2 border-slate-900 pt-6 mt-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Anotaciones de alimentación / manejo (Control Manual)</p>
                <div className="border-b border-dashed border-slate-400 mb-6 h-7"></div>
                <div className="border-b border-dashed border-slate-400 mb-6 h-7"></div>
                <div className="border-b border-dashed border-slate-400 mb-6 h-7"></div>
              </div>
            </section>

            <section className="w-[8.5in] h-[11in] box-border border-[10px] border-slate-900 p-[0.32in] overflow-hidden">
              <div className="border-b-4 border-rose-900 pb-4 mb-4 flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">Control Sanitario del Corral</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{corralSeleccionado.nombre} · {etapaActual} · {alimentoActual}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-black uppercase leading-none ${estadoSanitario === 'Normal' ? 'text-emerald-700' : 'text-rose-700'}`}>{estadoSanitario}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">Estado sanitario</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-4 text-center text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Tratamientos</p>
                  <p className="text-2xl font-black text-slate-900">{tratamientosLote.length}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Bajas</p>
                  <p className="text-2xl font-black text-rose-700">{listBajas.filter(b => b.loteId === loteActivo.id).reduce((sum, b) => sum + (Number(b.cantidad) || 0), 0)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Mortalidad</p>
                  <p className="text-2xl font-black text-slate-900">{st.mortalidadPorcentaje.toFixed(1)}%</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Última intervención</p>
                  <p className="text-sm font-black text-slate-900 leading-tight mt-1">{ultimaIntervencion?.fecha || 'Sin registro'}</p>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-xs font-black text-slate-900 border-b-2 border-slate-900 pb-2 mb-2 uppercase">Próximas acciones sanitarias</h3>
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider">
                    <tr><th className="p-2">Fecha</th><th className="p-2">Acción</th><th className="p-2">Producto</th><th className="p-2">Estado</th></tr>
                  </thead>
                  <tbody>
                    {proximasTareas.map(t => (
                      <tr key={t.id} className="border-b border-slate-100">
                        <td className="p-2 font-bold">{t.fechaObjetivo || '-'}</td>
                        <td className="p-2">{t.tarea}</td>
                        <td className="p-2">{t.producto || '-'}</td>
                        <td className="p-2 font-black uppercase">{t.estado || 'pendiente'}</td>
                      </tr>
                    ))}
                    {proximasTareas.length === 0 && <tr><td colSpan="4" className="p-4 text-center text-slate-400 font-semibold">Sin acciones sanitarias pendientes registradas.</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h3 className="text-xs font-black text-slate-900 border-b-2 border-slate-900 pb-2 mb-2 uppercase">Tratamientos aplicados</h3>
                  <div className="space-y-2 text-[10px]">
                    {tratamientosLote.slice(0, 3).map(t => (
                      <div key={`${t.id}-${t.nombre}`} className="border border-slate-200 rounded-lg p-2">
                        <p className="font-black text-slate-900">{t.fecha || '-'} · {t.nombre}</p>
                        <p className="text-slate-500">{[t.detalle, t.costo ? formatearMoneda(t.costo) : ''].filter(Boolean).join(' · ') || 'Sin detalle adicional'}</p>
                      </div>
                    ))}
                    {tratamientosLote.length === 0 && <p className="text-slate-400 font-semibold italic">Sin tratamientos registrados.</p>}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 border-b-2 border-slate-900 pb-2 mb-2 uppercase">Bajas e incidencias</h3>
                  <div className="space-y-2 text-[10px]">
                    {bajasLote.slice(0, 3).map(b => (
                      <div key={b.id} className="border border-rose-100 bg-rose-50/40 rounded-lg p-2">
                        <p className="font-black text-rose-800">{b.fecha || '-'} · {b.cantidad} baja{Number(b.cantidad) === 1 ? '' : 's'}</p>
                        <p className="text-slate-600">{b.causa || 'Sin causa registrada'}</p>
                      </div>
                    ))}
                    {bajasLote.length === 0 && <p className="text-slate-400 font-semibold italic">Sin bajas registradas.</p>}
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-slate-900 pt-4">
                <h3 className="text-xs font-black text-slate-900 mb-2 uppercase">Señales a vigilar en este corral</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-[11px] font-bold mb-4">
                  {checklistSanitario.map(item => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-slate-900"></span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Notas del encargado / firma</p>
                <div className="border-b border-dashed border-slate-400 mb-4 h-6"></div>
                <div className="border-b border-dashed border-slate-400 mb-4 h-6"></div>
                <div className="grid grid-cols-2 gap-8 mt-6 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <div><div className="border-b border-slate-500 mb-1"></div>Fecha</div>
                  <div><div className="border-b border-slate-500 mb-1"></div>Firma</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  };

  const renderPrepararVenta = () => {
    const totalLbs = ventaPesos.reduce((a, b) => a + b, 0);
    const totalDinero = totalLbs * ventaPrecio;
    const promedioLb = ventaPesos.length > 0 ? totalLbs / ventaPesos.length : 0;
    const loteVenta = corralSeleccionado ? getLoteActivo(corralSeleccionado.id) : null;
    const statsVenta = loteVenta ? calcularEstadisticasLote(loteVenta) : null;
    const progresoEmbarque = calcularProgresoEmbarque({
      pesosCapturados: ventaPesos,
      cerdosVivos: statsVenta?.cantidadActual || 0
    });

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5 animate-in fade-in duration-300">
        <div className="flex items-center justify-end lg:justify-between gap-2">
          <button onClick={() => setVista('corralDetail')} className="max-lg:hidden flex items-center text-emerald-600 hover:text-emerald-800 font-bold transition-colors text-xs gap-1 py-1">
            <ChevronRight size={18} className="rotate-180" /> Volver a {corralSeleccionado?.nombre || 'Corral'}
          </button>
          <span className="text-[10px] font-black uppercase tracking-widest bg-slate-900 text-emerald-400 px-3 py-1 rounded-full">
            Modo Galpón · Auto-guardado activo
          </span>
        </div>

        <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Scale size={26} className="text-emerald-500" /> Báscula de Venta · {corralSeleccionado?.nombre}
            </h2>
            <p className="text-slate-500 text-xs mt-1">Los pesos quedan respaldados al instante en este teléfono aunque entre una llamada o se apague la pantalla.</p>
          </div>
        </div>

        {borradorVentaRestaurado && ventaPesos.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-emerald-900 flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-600 shrink-0" />
              Se recuperaron {ventaPesos.length} cerdos pesados previamente en este corral.
            </span>
            <button type="button" onClick={handleLimpiarBorradorBascula} className="text-rose-600 hover:underline font-extrabold">
              Empezar desde cero
            </button>
          </div>
        )}

        {/* CONTADOR EN VIVO DE EMBARQUE */}
        <div className={`rounded-2xl p-4 border shadow-xs ${progresoEmbarque.excedido ? 'bg-rose-50 border-rose-300' : progresoEmbarque.completado ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-900 text-white border-slate-800'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${progresoEmbarque.excedido ? 'text-rose-600' : progresoEmbarque.completado ? 'text-emerald-700' : 'text-slate-400'}`}>
                Control de Carga al Camión
              </p>
              <p className={`text-lg sm:text-xl font-black mt-0.5 ${progresoEmbarque.excedido ? 'text-rose-900' : progresoEmbarque.completado ? 'text-emerald-950' : 'text-white'}`}>
                Pesados: {progresoEmbarque.pesados} de {progresoEmbarque.vivos} vivos
                <span className={`ml-2 text-xs font-extrabold ${progresoEmbarque.excedido ? 'text-rose-600' : progresoEmbarque.completado ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  {progresoEmbarque.excedido
                    ? `· ¡Excede por ${progresoEmbarque.pesados - progresoEmbarque.vivos}!`
                    : progresoEmbarque.completado
                      ? '· ¡Corral completo!'
                      : `· Faltan ${progresoEmbarque.faltantes}`}
                </span>
              </p>
            </div>
            {ventaPesos.length > 0 && (
              <div className={`px-3 py-1.5 rounded-xl text-right ${progresoEmbarque.excedido || progresoEmbarque.completado ? 'bg-white/80 text-slate-900' : 'bg-slate-800 text-slate-100'}`}>
                <span className="block text-[9px] uppercase font-bold opacity-70">Promedio</span>
                <span className="font-black text-sm">{promedioLb.toFixed(1)} lb/cerdo</span>
              </div>
            )}
          </div>
          <div className={`w-full h-2.5 rounded-full overflow-hidden ${progresoEmbarque.excedido || progresoEmbarque.completado ? 'bg-white/80' : 'bg-slate-800'}`}>
            <div
              className={`h-full transition-all duration-300 ${progresoEmbarque.excedido ? 'bg-rose-500' : 'bg-emerald-500'}`}
              style={{ width: `${progresoEmbarque.porcentaje}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 text-xs">
              <h3 className="font-extrabold text-slate-800 text-sm mb-3">1. Precio Acordado por Libra</h3>
              <div className="relative font-bold">
                <span className="absolute left-4 top-3.5 text-slate-400 text-base">Q</span>
                <input type="number" inputMode="decimal" step="0.01" value={ventaPrecio} onChange={(e) => setVentaPrecio(parseFloat(e.target.value) || 0)} className="w-full pl-9 p-3 border border-emerald-300 bg-emerald-50/10 text-emerald-950 font-black text-lg rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 text-xs space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-extrabold text-slate-800 text-sm">2. Capturar Cerdo en Báscula</h3>
                <span className="text-[11px] font-bold text-slate-400">Cerdo #{ventaPesos.length + 1}</span>
              </div>

              <form onSubmit={handleCapturarPesoBascula} className="flex gap-2.5">
                <input
                  ref={ventaInputRef}
                  type="number"
                  inputMode="decimal"
                  enterKeyHint="done"
                  step="0.1"
                  value={pesoInputVenta}
                  onChange={(e) => {
                    setPesoInputVenta(e.target.value);
                    if (alertaPesoSospechoso) setAlertaPesoSospechoso(null);
                  }}
                  placeholder="Ej: 220"
                  autoFocus
                  className="flex-1 py-3.5 px-4 border-2 border-slate-200 rounded-2xl outline-none focus:border-emerald-500 text-2xl sm:text-3xl font-black text-center text-slate-900"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black px-6 sm:px-8 rounded-2xl shadow-md transition-colors text-sm flex items-center justify-center gap-1.5 shrink-0 min-h-[56px]"
                >
                  <Plus size={20} /> Anotar
                </button>
              </form>

              {/* ALERTA ANTI-ERRORES DE DEDO EN CAMPO */}
              {alertaPesoSospechoso && (
                <div role="alert" className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 space-y-3 animate-in zoom-in-95 duration-150">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black text-amber-950 text-sm">Revisá este peso antes de sumarlo</p>
                      <p className="text-amber-900 font-semibold text-xs mt-0.5 leading-relaxed">{alertaPesoSospechoso.mensaje}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAlertaPesoSospechoso(null);
                        ventaInputRef.current?.select?.();
                        ventaInputRef.current?.focus();
                      }}
                      className="py-3 px-3 bg-white hover:bg-slate-100 text-slate-800 border border-amber-300 font-extrabold rounded-xl text-xs"
                    >
                      Corregir número
                    </button>
                    <button
                      type="button"
                      onClick={() => agregarPesoConfirmadoABascula(alertaPesoSospechoso.pesoRedondeado)}
                      className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs"
                    >
                      Sí, pesa {alertaPesoSospechoso.pesoRedondeado} lb
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 min-h-[150px] shadow-inner">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                    Cerdos Anotados ({ventaPesos.length})
                  </h4>
                  {ventaPesos.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          vibrarCampo(35);
                          setVentaPesos(prev => prev.slice(0, -1));
                        }}
                        className="bg-white hover:bg-amber-50 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1 shadow-2xs"
                      >
                        <RotateCcw size={12} /> Deshacer último ({ventaPesos[ventaPesos.length - 1]} lb)
                      </button>
                      <button
                        type="button"
                        onClick={handleLimpiarBorradorBascula}
                        className="text-rose-500 hover:text-rose-700 px-2 py-1.5 text-[11px] font-bold"
                      >
                        Vaciar
                      </button>
                    </div>
                  )}
                </div>

                {ventaPesos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-24 text-slate-400 italic">
                    Escribe las libras del primer cerdo y toca Anotar.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {ventaPesos.map((peso, index) => (
                      <div key={index} className="bg-white border border-slate-200 shadow-xs pl-3 pr-1.5 py-1.5 rounded-xl flex items-center gap-2 font-bold animate-in zoom-in-95 duration-150">
                        <span className="text-[10px] font-black text-slate-400">#{index + 1}</span>
                        <span className="text-slate-900 text-sm font-black">{peso} <span className="text-[10px] text-slate-400 font-semibold">lb</span></span>
                        <button
                          type="button"
                          onClick={() => setVentaPesos(ventaPesos.filter((_, i) => i !== index))}
                          className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
                          aria-label={`Eliminar cerdo #${index + 1} (${peso} lb)`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-slate-900 rounded-3xl p-5 shadow-xl text-white sticky top-8 text-xs">
              <h3 className="font-extrabold text-base mb-4 text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-3"><Receipt size={20} /> Liquidación Venta</h3>

              <div className="space-y-3 mb-6 font-semibold">
                <div className="flex justify-between items-end"><span className="text-slate-400">Total Cabezas:</span><span className="text-lg font-bold">{ventaPesos.length}</span></div>
                <div className="flex justify-between items-end"><span className="text-slate-400">Peso Promedio:</span><span className="text-sm font-bold text-slate-200">{promedioLb.toFixed(1)} lb</span></div>
                <div className="flex justify-between items-end"><span className="text-slate-400">Libras Totales:</span><span className="text-lg font-bold text-amber-400">{totalLbs.toFixed(1)} lb</span></div>
                <div className="flex justify-between items-end"><span className="text-slate-400">Precio Libra:</span><span className="text-sm">Q{ventaPrecio.toFixed(2)}</span></div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center mb-6 shadow-inner">
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1.5 leading-none">Monto Total a Cobrar</p>
                <p className="text-3xl font-black text-emerald-400">{formatearMoneda(totalDinero)}</p>
              </div>

              <button onClick={procesarVenta} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 rounded-xl shadow-lg shadow-emerald-500/10 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5">
                <CheckCircle size={16} /> Registrar Venta Oficial
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderResumenVenta = () => {
    const loteActivo = getLoteActivo(corralSeleccionado?.id);

    if (!loteActivo || !corralSeleccionado) {
      return (
        <div className="p-8 text-center max-w-md mx-auto">
          <AlertCircle size={40} className="mx-auto mb-3 text-orange-500" />
          <h3 className="text-xl font-bold text-slate-850 mb-2">No hay lote activo</h3>
          <p className="text-slate-500 text-xs mb-6">Selecciona un corral con un lote activo para ver el reporte final.</p>
          <button onClick={() => setVista('dashboard')} className="bg-slate-900 text-white font-bold py-2.5 px-5 rounded-xl text-xs">Volver al Dashboard</button>
        </div>
      );
    }

    const st = calcularEstadisticasLote(loteActivo);
    const corralNombre = corralSeleccionado?.nombre ?? 'Corral';
    const fechaCierre = loteActivo.fechaSalida ?? new Date().toISOString().split('T')[0];
    const hoy = new Date().toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const fechaIngresoFormat = new Date(loteActivo.fechaIngreso + 'T00:00:00').toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' });

    const historialPesos = listPesos.filter(p => p.loteId === loteActivo.id).sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0));
    const maxPeso = Math.max(...historialPesos.map(p => p.pesoPromedio), 220, 1);
    const totalGastosParaGrafica = (st.costoInvertidoTotal + (loteActivo.manoObra || 0)) || 1;

    const ultimaVenta = listVentasActivas.filter(v => v.loteId === loteActivo.id).pop();
    const ticketCerdos = ultimaVenta ? (ultimaVenta.cantidadCerdos || 0) : st.cantidadActual;
    const ticketLibras = ultimaVenta ? (ultimaVenta.totalLibras || 0) : (st.pesoParaProyeccion * st.cantidadActual);
    const ticketPrecio = ultimaVenta ? (ultimaVenta.precioLibra || 0) : loteActivo.precioVentaLibra;
    const ticketTotal = ultimaVenta ? (ultimaVenta.totalVenta || 0) : st.ingresoEstimado;

    return (
      <div className="bg-slate-100 min-h-screen p-4 lg:p-6 flex justify-center text-xs">
        <div className="bg-white max-w-4xl w-full rounded-3xl shadow-xl overflow-hidden border border-slate-200/60">

          <div className="bg-slate-900 p-4 flex flex-col sm:flex-row justify-between items-center rounded-t-2xl gap-3 text-xs">
            <button onClick={() => setVista('corralDetail')} className="text-slate-300 hover:text-white font-bold flex items-center gap-1 transition-colors">
              <ChevronRight size={18} className="rotate-180 mr-1" /> Volver al Corral
            </button>

            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 font-bold">
              <button onClick={() => setTipoReporteImpresion('interno')} className={`px-3 py-1.5 rounded-lg transition-all duration-150 ${tipoReporteImpresion === 'interno' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'}`}>
                Liquidación Interna
              </button>
              <button onClick={() => setTipoReporteImpresion('cliente')} className={`px-3 py-1.5 rounded-lg transition-all duration-150 ${tipoReporteImpresion === 'cliente' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'}`}>
                Recibo Cliente
              </button>
            </div>

            <div className="flex flex-wrap gap-2 font-bold">
              <button
                type="button"
                onClick={() => enviarPorWhatsApp(formatearReciboVentaWhatsApp({
                  corralNombre: corralSeleccionado.nombre,
                  raza: loteActivo.raza || loteActivo.nombre || 'Estándar',
                  fecha: ultimaVenta?.fecha || fechaCierre,
                  cantidadCerdos: ticketCerdos,
                  totalLibras: ticketLibras,
                  precioLibra: ticketPrecio,
                  totalVenta: ticketTotal,
                  pesosIndividuales: ultimaVenta?.pesosVenta || [],
                  modoInterno: tipoReporteImpresion === 'interno',
                  estadisticasInternas: {
                    diasLote: st.diasLote,
                    adg: st.adg,
                    fca: st.fca,
                    fcaEsConfiable: st.fcaEsConfiable,
                    consumoTotalLb: st.consumoTotalLb,
                    inversionTotal: st.costoInvertidoTotal + (loteActivo.manoObra || 0),
                    utilidadNeta: st.utilidadNeta
                  }
                }))}
                className="bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <MessageCircle size={15} /> WhatsApp
              </button>
              <button onClick={() => descargarPDF('documento-pdf', `Reporte_${corralSeleccionado.nombre}.pdf`)} className="bg-slate-700 hover:bg-slate-650 text-white py-2 px-4 rounded-xl flex items-center gap-1.5 transition-colors">
                <Printer size={15} /> Descargar PDF
              </button>
              <button onClick={confirmarVentaYCerrar} className="bg-emerald-500 hover:bg-emerald-450 text-slate-950 py-2 px-4 rounded-xl flex items-center shadow-lg shadow-emerald-500/20 transition-all gap-1.5">
                <CheckCircle size={15} /> Finalizar Ciclo (Cerrar)
              </button>
            </div>
          </div>

          <div id="documento-pdf" className="bg-white text-black w-full">
            {tipoReporteImpresion === 'cliente' ? (
              <div className="p-10 md:p-14 min-h-[600px] flex flex-col justify-between">
                <div>
                  <div className="border-b-2 border-slate-850 pb-5 mb-6 text-center">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">LIQUIDACIÓN DE VENTA</h1>
                    <p className="text-slate-500 mt-1 font-bold tracking-widest text-xs">Agrocontrol Porcino</p>
                  </div>

                  <div className="flex justify-between items-start mb-8 text-xs font-semibold">
                    <div>
                      <p className="text-slate-400 uppercase tracking-wider text-[9px] mb-1">Comprador / Destino</p>
                      <p className="text-slate-800 font-extrabold text-sm leading-tight">Ganado en Pie</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 uppercase tracking-wider text-[9px] mb-1">Fecha Operación</p>
                      <p className="text-slate-800 font-extrabold text-sm">{hoy}</p>
                      <p className="text-[10px] text-slate-400 mt-1 font-medium">Origen: {corralSeleccionado.nombre}</p>
                    </div>
                  </div>

                  <table className="w-full text-left border-collapse text-xs font-semibold">
                    <thead>
                      <tr className="bg-slate-100 border-y border-slate-400 text-slate-800">
                        <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Concepto</th>
                        <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider text-center">Cabezas</th>
                        <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider text-right">Peso Neto</th>
                        <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider text-right">Q / Lb</th>
                        <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      <tr className="border-b border-slate-200 font-bold">
                        <td className="py-5 px-4">
                          <p className="font-extrabold text-slate-800 text-sm leading-tight">Cerdos de Engorde</p>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium">Línea/Raza: {loteActivo.raza || 'Estándar'}</p>
                        </td>
                        <td className="py-5 px-4 text-center text-sm font-extrabold">{ticketCerdos}</td>
                        <td className="py-5 px-4 text-right text-sm font-extrabold">{ticketLibras.toFixed(1)} lb</td>
                        <td className="py-5 px-4 text-right">Q{ticketPrecio.toFixed(2)}</td>
                        <td className="py-5 px-4 text-right text-base font-black text-slate-900">Q{ticketTotal.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="flex justify-end mt-6 text-xs font-semibold">
                    <div className="w-full sm:w-1/2 bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-inner space-y-2">
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Importe Subtotal:</span>
                        <span>Q{ticketTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-300 pt-3 mt-3 font-black text-slate-850">
                        <span className="uppercase text-[9px] tracking-widest text-slate-500">TOTAL LIQUIDADO</span>
                        <span className="text-2xl text-slate-900 font-black">Q{ticketTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-16 pt-6 border-t border-slate-200 text-center text-xs font-semibold">
                  <p className="text-slate-500 mb-14">Conforme pactado por ambas partes.</p>
                  <div className="grid grid-cols-2 gap-10 max-w-md mx-auto">
                    <div>
                      <div className="border-b border-slate-400 mb-1.5"></div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Entregó Conforme (Granja)</p>
                    </div>
                    <div>
                      <div className="border-b border-slate-400 mb-1.5"></div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Recibió Conforme (Comprador)</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-10 md:p-14 w-full text-xs leading-relaxed">
                <div className="border-b-4 border-emerald-800 pb-5 mb-6 flex justify-between items-end">
                  <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none">REPORTE DE CIERRE DE LOTE</h1>
                    <p className="text-slate-500 mt-2 font-bold tracking-wide uppercase text-[10px]">Porcicontrol · Resumen Histórico Interno</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-800 font-black text-xl uppercase leading-none">{corralNombre}</p>
                    <p className="text-slate-400 mt-2 text-[10px] font-bold">Ingreso: <span className="font-medium">{fechaIngresoFormat}</span></p>
                    <p className="text-slate-400 text-[10px] font-bold">Cierre: <span className="font-medium">{fechaCierre}</span></p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-8 text-center text-xs font-semibold">
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-1.5">Cerdos Vendidos / Restantes</p>
                    <p className="text-lg font-black text-slate-800 leading-none">{st.cantidadVendida} <span className="text-[10px] font-normal text-slate-400">vendidos · {st.cantidadActual} vivos</span></p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-1.5">Días Totales de Engorde</p>
                    <p className="text-lg font-black text-slate-800 leading-none">{st.diasLote} días</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-1.5">Mortalidad Registrada</p>
                    <p className="text-lg font-black text-rose-600 leading-none">{st.mortalidadPorcentaje.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="mb-8 font-semibold text-slate-700">
                  <h3 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-2 mb-3">1. Desempeño Zootécnico</h3>
                  <table className="w-full text-left text-xs border-collapse">
                    <tbody>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-500 w-1/2">Peso Promedio Inicial</td><td className="py-2 font-bold text-slate-800">{st.pesoInicial} lb</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-500">Peso Promedio Final {st.pesoEsEstimado ? '(Estimado)' : '(Liquidado)'}</td><td className="py-2 font-black text-emerald-700" title={tituloPesoLb(st)}>{formatPesoLb(st)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-500">Ganancia Media Diaria (GMD)</td><td className="py-2 font-bold text-slate-800">{st.adg.toFixed(2)} lb / día</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-500">Alimento Suministrado Registrado</td><td className="py-2 font-bold text-slate-800">{st.consumoTotalLb} lb</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-500">Libras Vendidas por Báscula</td><td className="py-2 font-bold text-slate-800">{st.librasVendidas.toFixed(1)} lb</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-500">Peso Carne Producido para FCA</td><td className="py-2 font-bold text-slate-800">{st.pesoProducidoLb.toFixed(1)} lb</td></tr>
                      <tr className="bg-slate-50 font-bold border border-slate-150"><td className="py-2 px-3 text-slate-850">Conversión Alimenticia (FCA)</td><td className="py-2 px-3 font-black text-indigo-750" title={tituloFca(st)}>{formatFca(st)}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="mb-8 font-semibold text-slate-700">
                  <h3 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-2 mb-3">2. Inversión & Liquidación Financiera</h3>
                  <table className="w-full text-left text-xs border-collapse">
                    <tbody>
                      <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-500 w-1/2">Compra de Lechones</td><td className="py-1.5 text-right text-rose-600">{formatearMonedaNeg(st.costoLechones)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-500">Concentrado Suministrado (Tolvas)</td><td className="py-1.5 text-right text-rose-600">{formatearMonedaNeg(st.costoAlimentoTolva)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-500">Suplementos & Aditivos extra</td><td className="py-1.5 text-right text-rose-600">{formatearMonedaNeg(st.costoAlimentoSuplemento)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-500">Egresos de Sanidad & Fármacos</td><td className="py-1.5 text-right text-rose-600">{formatearMonedaNeg(st.totalSanidad)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-500">Otros Egresos Operativos</td><td className="py-1.5 text-right text-rose-600">{formatearMonedaNeg(st.totalGastosExtras)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-500">Mano de Obra Imputada</td><td className="py-1.5 text-right text-rose-600">{formatearMonedaNeg(loteActivo.manoObra)}</td></tr>
                      <tr className="bg-rose-50 border border-rose-100 font-bold"><td className="py-2 px-3 text-rose-900">EGRESOS / INVERSIÓN TOTAL</td><td className="py-2 px-3 text-right text-rose-700 font-black">{formatearMonedaNeg(st.costoInvertidoTotal + loteActivo.manoObra)}</td></tr>
                      <tr><td className="py-3"></td><td></td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-700 font-bold">Ingresos Reales por Báscula</td><td className="py-2 text-right text-emerald-700 font-black">+{formatearMoneda(st.ingresoRealVentas)}</td></tr>
                      <tr className="border-b border-slate-200"><td className="py-2 text-slate-700 font-bold">Valor Estimado Cerdos en Vivo</td><td className="py-2 text-right text-emerald-700 font-black">+{formatearMoneda(st.ingresoEstimadoVivos)}</td></tr>
                      <tr className="bg-slate-900 text-white font-black text-sm"><td className="py-3 px-4 uppercase tracking-wider">UTILIDAD NETA FINAL</td><td className="py-3 px-4 text-right text-emerald-400">{formatearMoneda(st.utilidadNeta)}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-between">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4 text-center">Histórico Curva de Crecimiento (lbs)</h4>
                    <div className="flex items-end justify-around h-36 gap-2 border-b border-slate-350 pb-1 px-1">
                      {historialPesos.map(p => {
                        const alturaBarra = Math.max((p.pesoPromedio / maxPeso) * 100, 5);
                        return (
                          <div key={p.id} className="flex flex-col items-center flex-1 h-full justify-end font-bold text-xs">
                            <span className="text-emerald-700 text-[10px] leading-none mb-1">{p.pesoPromedio}</span>
                            <div className="w-full max-w-[28px] rounded-t-sm bg-emerald-500 shadow-sm border-t border-emerald-400" style={{ height: `${alturaBarra}%` }} />
                            <span className="text-[9px] text-slate-400 mt-2 font-medium">{p.fecha.substring(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                    {historialPesos.length === 0 && <p className="text-center text-slate-400 italic py-6">No hay pesos capturados.</p>}
                  </div>

                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-center">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4 text-center">Desglose de Costos de Ciclo</h4>
                    <div className="space-y-4 px-2 font-bold text-xs">
                      {[
                        { label: 'Lechones', value: st.costoLechones, color: '#2f4f2f' },
                        { label: 'Alim. Tolva', value: st.costoAlimentoTolva, color: '#c7a24d' },
                        { label: 'Suplementos', value: st.costoAlimentoSuplemento, color: '#6b8e23' },
                        { label: 'Sanidad', value: st.totalSanidad, color: '#6b4e2e' },
                        { label: 'Gastos Extras', value: st.totalGastosExtras, color: '#a83826' },
                        { label: 'Mano de Obra', value: loteActivo.manoObra || 0, color: '#96908a' },
                      ].map(gasto => {
                        const porcentaje = totalGastosParaGrafica > 0 ? (gasto.value / totalGastosParaGrafica) * 100 : 0;
                        if (gasto.value <= 0) return null;

                        return (
                          <div key={gasto.label}>
                            <div className="flex justify-between text-[11px] mb-1 font-semibold text-slate-600">
                              <span>{gasto.label}</span>
                              <span>{porcentaje.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
                              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${porcentaje}%`, backgroundColor: gasto.color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="font-semibold text-slate-700">
                  <h3 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-2 mb-3">4. Consumos Detallados de Alimentación</h3>
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3">Insumo Suministrado</th>
                          <th className="py-2.5 px-3 text-right">Libras</th>
                          <th className="py-2.5 px-3 text-right">Costo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold">
                        {listAlimentos.filter(a => a.loteId === loteActivo.id).sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0)).map(a => (
                          <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-2 px-3 text-slate-450 font-medium">{a.fecha}</td>
                            <td className="py-2 px-3">
                              <span className="font-bold text-slate-800">{a.tipo}</span>
                              {a.esSuplemento && <span className="bg-amber-100 text-amber-800 border border-amber-200/50 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider block w-fit mt-1">SUPLEMENTO</span>}
                              {a.esSuplemento && <span className="text-[10px] text-slate-400 italic block mt-1 leading-snug">({a.detalleMezcla})</span>}
                            </td>
                            <td className="py-2 px-3 text-right font-black text-slate-800">{a.cantidadLb.toFixed(1)} lb</td>
                            <td className="py-2 px-3 text-right text-rose-600">{formatearMonedaNeg(a.costo)}</td>
                          </tr>
                        ))}
                        {listAlimentos.filter(a => a.loteId === loteActivo.id).length === 0 && (
                          <tr><td colSpan="4" className="py-6 text-center text-slate-400 italic font-semibold">No se han registrado consumos.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  const renderFinanzasGlobales = () => {
    // 1. AGREGACIÓN FINANCIERA HISTÓRICA (todos los lotes: Activos y Cerrados)
    const resumenPorLote = listLotes.map(lote => {
      const stats = calcularEstadisticasLote(lote);
      const bajasLote = listBajas.filter(b => b.loteId === lote.id);
      const ventasLote = [...listVentasActivas.filter(v => v.loteId === lote.id)].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

      const costoLechones = stats?.costoLechones || 0;
      const costoAlimento = stats?.costoAlimento || 0;
      const costoMedicinas = stats?.totalSanidad || 0;
      const costoGastos = stats?.totalGastosExtras || 0;
      const costoManoObra = Number(lote.manoObra) || 0;
      const inversionTotal = (stats?.costoInvertidoTotal || 0) + costoManoObra;
      const ingresosBrutos = stats?.ingresoRealVentas || 0;
      const valorEstimadoVivos = stats?.ingresoEstimadoVivos || 0;
      const utilidadRealVentas = ingresosBrutos - inversionTotal;
      const utilidadNeta = utilidadRealVentas + valorEstimadoVivos;
      const lbsCarneVendida = stats?.librasVendidas || 0;
      const costoPorLibra = lbsCarneVendida > 0 ? inversionTotal / lbsCarneVendida : 0;
      const cerdosVendidos = stats?.cantidadVendida || 0;
      const bajasTotales = bajasLote.reduce((s, b) => s + (b.cantidad || 0), 0);
      const cerdosRestantes = stats?.cantidadActual || 0;
      const cerdosOperados = Math.max(1, cerdosRestantes + cerdosVendidos + bajasTotales);
      const costoPorCerdoOperado = inversionTotal / cerdosOperados;

      // --- PRORRATEO POR ANIMAL-DIAS ---
      // Repartir el costo en partes iguales por cabeza castiga a los cerdos que llegaron
      // lejos y premia a los que murieron temprano (un lechon muerto al dia 3 casi no
      // comio). Se separa lo que cuesta por cabeza -el lechon- de lo que cuesta por dia
      // de permanencia -alimento, sanidad, gastos y mano de obra-.
      const fechaIngresoLote = parseLocalDate(lote.fechaIngreso);
      const fechaFinLote = (lote.fechaSalida ? parseLocalDate(lote.fechaSalida) : new Date()) || new Date();
      const diasHasta = (fecha) => {
        const objetivo = parseLocalDate(fecha) || fechaFinLote;
        if (!fechaIngresoLote) return 0;
        return Math.max(0, Math.ceil((objetivo - fechaIngresoLote) / 86400000));
      };

      const animalDiasVendidos = ventasLote.reduce((s, v) => s + (Number(v.cantidadCerdos) || 0) * diasHasta(v.fecha), 0);
      const animalDiasBajas = bajasLote.reduce((s, b) => s + (Number(b.cantidad) || 0) * diasHasta(b.fecha), 0);
      const animalDiasRestantes = cerdosRestantes * (fechaIngresoLote ? Math.max(0, Math.ceil((fechaFinLote - fechaIngresoLote) / 86400000)) : 0);
      const animalDiasTotal = animalDiasVendidos + animalDiasBajas + animalDiasRestantes;

      const costoOperativo = costoAlimento + costoMedicinas + costoGastos + costoManoObra;
      const costoPorAnimalDia = animalDiasTotal > 0 ? costoOperativo / animalDiasTotal : 0;
      const costoLechonPorCabeza = costoLechones / cerdosOperados;
      const costoAsignado = (cabezas, animalDias) => (cabezas * costoLechonPorCabeza) + (animalDias * costoPorAnimalDia);

      const costoAsignadoVendidos = costoAsignado(cerdosVendidos, animalDiasVendidos);
      const costoAsignadoRestantes = costoAsignado(cerdosRestantes, animalDiasRestantes);
      // Lo que se llevaron los animales muertos. Antes este monto simplemente desaparecia
      // y por eso el reporte global no cuadraba con el simulador del lote.
      const costoPerdidoBajas = costoAsignado(bajasTotales, animalDiasBajas);

      const utilidadVentasParciales = ingresosBrutos - costoAsignadoVendidos;
      const ventaProyectadaRestantes = Math.max(0, (stats?.proyeccionVentaFinal || 0) - ingresosBrutos);
      const costoFuturoRestantes = stats?.proyeccionCostoFaltante || 0;
      const utilidadProyectadaRestantes = ventaProyectadaRestantes - costoAsignadoRestantes - costoFuturoRestantes;
      const pesoFinalRestantesLb = cerdosRestantes * Math.max(stats?.pesoParaProyeccion || 0, stats?.pesoObjetivoLb || 0);
      const puntoEquilibrioRestantes = pesoFinalRestantesLb > 0 ? (costoAsignadoRestantes + costoFuturoRestantes) / pesoFinalRestantesLb : 0;
      const ventasDetalle = ventasLote.map((venta) => {
        const libras = getVentaLibras(venta);
        const cantidad = Number(venta.cantidadCerdos) || 0;
        const costoVenta = costoAsignado(cantidad, cantidad * diasHasta(venta.fecha));
        return {
          ...venta,
          libras,
          pesoPromedio: cantidad > 0 ? libras / cantidad : 0,
          costoAsignado: costoVenta,
          utilidadEstimada: (Number(venta.totalVenta) || 0) - costoVenta
        };
      });

      return {
        id: lote.id,
        nombre: listCorrales.find(c => c.id === lote.corralId)?.nombre || `Lote ${lote.id}`,
        estado: lote.estado || 'Activo',
        fechaIngreso: lote.fechaIngreso || '—',
        cantidadInicial: lote.cantidad || 0,
        cerdosRestantes,
        costoLechones, costoAlimento, costoMedicinas, costoGastos, costoManoObra,
        inversionTotal, ingresosBrutos, utilidadNeta, utilidadRealVentas, valorEstimadoVivos,
        lbsCarneVendida, costoPorLibra, cerdosVendidos, bajasTotales,
        costoPorCerdoOperado,
        costoAsignadoVendidos,
        costoAsignadoRestantes,
        costoPerdidoBajas,
        costoPorAnimalDia,
        utilidadVentasParciales,
        ventaProyectadaRestantes,
        costoFuturoRestantes,
        utilidadProyectadaRestantes,
        puntoEquilibrioRestantes,
        pesoActual: stats?.pesoParaProyeccion || 0,
        pesoMedido: stats?.pesoActual || 0,
        pesoEsEstimado: Boolean(stats?.pesoEsEstimado),
        diasSinPesaje: stats?.diasSinPesaje ?? null,
        pesoObjetivo: stats?.pesoObjetivoLb || 0,
        fca: stats?.fca || 0,
        fcaEsConfiable: Boolean(stats?.fcaEsConfiable),
        parametrosIncompletos: Boolean(stats?.parametrosIncompletos),
        diasLote: stats?.diasLote || 0,
        ventasDetalle,
      };
    });

    // 2. TOTALES GLOBALES
    const totGlobal = resumenPorLote.reduce((acc, r) => ({
      inversionTotal: acc.inversionTotal + r.inversionTotal,
      ingresosBrutos: acc.ingresosBrutos + r.ingresosBrutos,
      utilidadRealVentas: acc.utilidadRealVentas + r.utilidadRealVentas,
      valorEstimadoVivos: acc.valorEstimadoVivos + r.valorEstimadoVivos,
      utilidadNeta: acc.utilidadNeta + r.utilidadNeta,
      costoPerdidoBajas: acc.costoPerdidoBajas + r.costoPerdidoBajas,
      lbsCarneVendida: acc.lbsCarneVendida + r.lbsCarneVendida,
      costoLechones: acc.costoLechones + r.costoLechones,
      costoAlimento: acc.costoAlimento + r.costoAlimento,
      costoMedicinas: acc.costoMedicinas + r.costoMedicinas,
      costoGastos: acc.costoGastos + r.costoGastos,
      costoManoObra: acc.costoManoObra + r.costoManoObra,
    }), {
      inversionTotal: 0, ingresosBrutos: 0, utilidadRealVentas: 0, valorEstimadoVivos: 0, utilidadNeta: 0, lbsCarneVendida: 0,
      costoPerdidoBajas: 0,
      costoLechones: 0, costoAlimento: 0, costoMedicinas: 0, costoGastos: 0, costoManoObra: 0,
    });

    const costoPorLibraGlobal = totGlobal.lbsCarneVendida > 0
      ? totGlobal.inversionTotal / totGlobal.lbsCarneVendida : 0;
    const margenGlobal = totGlobal.ingresosBrutos > 0
      ? ((totGlobal.utilidadRealVentas / totGlobal.ingresosBrutos) * 100) : 0;

    // 3. ESTRUCTURA DE COSTOS para barras CSS
    const costItems = [
      { label: 'Lechones', value: totGlobal.costoLechones, color: 'bg-blue-500' },
      { label: 'Alimento', value: totGlobal.costoAlimento, color: 'bg-amber-500' },
      { label: 'Medicinas', value: totGlobal.costoMedicinas, color: 'bg-rose-500' },
      { label: 'Gastos Extra', value: totGlobal.costoGastos, color: 'bg-indigo-500' },
      { label: 'Mano de Obra', value: totGlobal.costoManoObra, color: 'bg-slate-400' },
    ];
    const maxCosto = Math.max(...costItems.map(c => c.value), 1);
    const lotesActivos = resumenPorLote.filter(r => r.estado === 'Activo').length;
    const lotesCerrados = resumenPorLote.filter(r => r.estado === 'Cerrado').length;
    const fechaReporteFinanciero = new Date().toLocaleDateString('es-GT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const formatearFechaReporte = (fecha) => {
      if (!fecha || fecha === '—') return '—';
      const date = new Date(`${fecha}T00:00:00`);
      if (Number.isNaN(date.getTime())) return fecha;
      return date.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
        {/* ENCABEZADO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="max-lg:hidden text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center leading-none">
              <DollarSign size={28} className="text-emerald-600 mr-3 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.25)]" /> Finanzas Globales
            </h2>
            <p className="text-slate-500 text-sm mt-1.5">
              Análisis de rentabilidad histórica — {resumenPorLote.length} lotes ({lotesActivos} activos · {lotesCerrados} cerrados)
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0 self-start md:self-auto">
            <button
              onClick={() => descargarPDF('reporte-financiero-global-pdf', `Reporte_Financiero_Global_${todayIso()}.pdf`)}
              className="bg-slate-950 hover:bg-slate-900 text-white font-black py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
            >
              <Printer size={16} /> Imprimir reporte completo
            </button>
            <div className="max-lg:hidden text-xs font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center justify-center">
              Datos consolidados
            </div>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 leading-none">Inversión Histórica</p>
            <p className="text-xl sm:text-2xl font-black tabular-nums break-words text-slate-800 leading-tight">{formatearMoneda(totGlobal.inversionTotal)}</p>
            <div className="mt-3.5 flex flex-wrap gap-1">
              {costItems.filter(c => c.value > 0).map(c => (
                <span key={c.label} className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md">{c.label}</span>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 leading-none">Ingresos Brutos</p>
            <p className="text-xl sm:text-2xl font-black tabular-nums break-words text-emerald-600 leading-tight">{formatearMoneda(totGlobal.ingresosBrutos)}</p>
            <p className="text-xs text-slate-500 mt-2 font-medium">{totGlobal.lbsCarneVendida.toFixed(0)} lbs vendidas</p>
          </div>

          <div className={`border rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] ${totGlobal.utilidadRealVentas >= 0 ? 'bg-emerald-50/60 border-emerald-100' : 'bg-rose-50/60 border-rose-100'}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 leading-none">Utilidad Realizada</p>
            <p className={`text-xl sm:text-2xl font-black tabular-nums break-words leading-tight ${totGlobal.utilidadRealVentas >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{formatearMoneda(totGlobal.utilidadRealVentas)}</p>
            <p className={`text-xs font-bold mt-2 ${totGlobal.utilidadRealVentas >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>Margen: {margenGlobal.toFixed(1)}%</p>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 leading-none">Utilidad Estimada</p>
            <p className={`text-xl sm:text-2xl font-black tabular-nums break-words leading-tight ${totGlobal.utilidadNeta >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
              {formatearMoneda(totGlobal.utilidadNeta)}
            </p>
            <p className="text-xs text-slate-500 mt-2 font-medium">Incluye {formatearMoneda(totGlobal.valorEstimadoVivos)} en vivo</p>
          </div>
        </div>

        {/* ESTRUCTURA DE COSTOS */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-4 mb-5">
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-800 flex items-center gap-1.5"><PieChart size={16} className="text-indigo-500" /> Distribución de Egresos Históricos</h3>
            <span className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl">
              Costo/lb carne: {costoPorLibraGlobal > 0 ? formatearMoneda(costoPorLibraGlobal) : '—'}
            </span>
          </div>
          <div className="space-y-4">
            {costItems.map(item => {
              const pct = totGlobal.inversionTotal > 0
                ? ((item.value / totGlobal.inversionTotal) * 100).toFixed(1) : 0;
              const barW = maxCosto > 0 ? (item.value / maxCosto) * 100 : 0;
              return (
                <div key={item.label} className="grid grid-cols-[100px_1fr_120px] items-center gap-4 text-xs font-semibold">
                  <span className="text-slate-600 truncate font-medium">{item.label}</span>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/20">
                    <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${barW}%` }} />
                  </div>
                  <div className="text-right">
                    <span className="text-slate-800 font-extrabold">{formatearMoneda(item.value)}</span>
                    <span className="text-[10px] text-slate-400 font-bold ml-1.5">({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TABLA DETALLE POR LOTE */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.015)] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Rentabilidad Desglosada por Lote</h3>
            <span className="text-xs text-slate-400 font-bold">{resumenPorLote.length} lotes registrados</span>
          </div>
          {resumenPorLote.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm font-semibold italic">No hay lotes registrados aún.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-4 px-5">Lote</th>
                    <th className="py-4 px-4 text-center">Estado</th>
                    <th className="py-4 px-4 text-right">Animales</th>
                    <th className="py-4 px-4 text-right">Inversión</th>
                    <th className="py-4 px-4 text-right">Ingresos</th>
                    <th className="py-4 px-4 text-right">Utilidad Real</th>
                    <th className="py-4 px-5 text-right">Estimada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {resumenPorLote.map(r => {
                    const estaAbierto = finanzasLoteAbierto === r.id;
                    return (
                      <React.Fragment key={r.id}>
                        <tr
                          onClick={() => setFinanzasLoteAbierto(estaAbierto ? null : r.id)}
                          className={`cursor-pointer transition-colors duration-150 ${estaAbierto ? 'bg-emerald-50/40' : 'hover:bg-slate-50/50'}`}
                        >
                          <td className="py-4 px-5">
                            <p className="font-extrabold text-slate-900 flex items-center gap-1.5 leading-tight">
                              <ChevronRight size={16} className={`text-slate-400 transition-transform duration-200 ${estaAbierto ? 'rotate-90 text-emerald-600' : ''}`} />
                              {r.nombre}
                            </p>
                            <p className="text-xs text-slate-400 ml-5.5 mt-1 font-medium">{r.cantidadInicial} lechones • {r.fechaIngreso} • {r.diasLote} días</p>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${r.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{r.estado}</span>
                          </td>
                          <td className="py-4 px-4 text-right text-xs font-semibold text-slate-600 leading-tight">
                            <div>{r.cerdosRestantes} vivos</div>
                            <div className="text-slate-400 font-medium text-[10px] mt-0.5">{r.cerdosVendidos} vendidos • {r.bajasTotales} bajas</div>
                          </td>
                          <td className="py-4 px-4 text-right font-bold text-slate-800">{formatearMoneda(r.inversionTotal)}</td>
                          <td className="py-4 px-4 text-right font-bold text-emerald-600">{formatearMoneda(r.ingresosBrutos)}</td>
                          <td className={`py-4 px-4 text-right font-black ${r.utilidadRealVentas >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{formatearMoneda(r.utilidadRealVentas)}</td>
                          <td className={`py-4 px-5 text-right font-black ${r.utilidadNeta >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>{formatearMoneda(r.utilidadNeta)}</td>
                        </tr>
                        {estaAbierto && (
                          <tr className="bg-white">
                            <td colSpan={7} className="px-5 pb-5 pt-1">
                              <div className="border border-emerald-100 bg-emerald-50/20 rounded-2xl p-5 space-y-5 animate-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                  <div className="bg-white border border-slate-100 rounded-xl p-3.5 shadow-sm">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Costo/Cerdo Operado</p>
                                    <p className="text-lg font-black text-slate-800 mt-1">{formatearMoneda(r.costoPorCerdoOperado)}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Promedio por cabeza</p>
                                  </div>
                                  <div className="bg-white border border-slate-100 rounded-xl p-3.5 shadow-sm">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Inversión Restantes</p>
                                    <p className="text-lg font-black text-amber-600 mt-1">{formatearMoneda(r.costoAsignadoRestantes)}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{r.cerdosRestantes} cabezas vivas</p>
                                  </div>
                                  <div className="bg-white border border-slate-100 rounded-xl p-3.5 shadow-sm">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Costo Futuro Proyectado</p>
                                    <p className="text-lg font-black text-rose-600 mt-1">{formatearMoneda(r.costoFuturoRestantes)}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Alimento hasta el cierre</p>
                                  </div>
                                  <div className="bg-white border border-slate-100 rounded-xl p-3.5 shadow-sm">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Punto de Equilibrio</p>
                                    <p className="text-lg font-black text-indigo-700 mt-1">{r.puntoEquilibrioRestantes > 0 ? formatearMoneda(r.puntoEquilibrioRestantes) : '—'}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Precio mínimo por lb</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                  <div className="bg-white border border-slate-100 rounded-xl p-4.5 shadow-sm">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-50 pb-2">Costos Acumulados</h4>
                                    <div className="space-y-2 text-xs font-semibold">
                                      <div className="flex justify-between"><span className="text-slate-500">Lechones</span><strong>{formatearMoneda(r.costoLechones)}</strong></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Alimento Suministrado</span><strong>{formatearMoneda(r.costoAlimento)}</strong></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Medicinas & Sanidad</span><strong>{formatearMoneda(r.costoMedicinas)}</strong></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Egresos Adicionales</span><strong>{formatearMoneda(r.costoGastos)}</strong></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Mano de Obra</span><strong>{formatearMoneda(r.costoManoObra)}</strong></div>
                                      <div className="flex justify-between border-t border-slate-100 pt-2 font-black text-slate-800"><span>Total</span><span>{formatearMoneda(r.inversionTotal)}</span></div>
                                    </div>
                                  </div>

                                  <div className="bg-white border border-slate-100 rounded-xl p-4.5 shadow-sm">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-50 pb-2">Métricas de Rendimiento</h4>
                                    <div className="space-y-2 text-xs font-semibold">
                                      <div className="flex justify-between"><span className="text-slate-500">Peso Promedio Actual</span><strong title={r.pesoEsEstimado ? `Estimado por consumo. Último pesaje real: ${r.pesoMedido.toFixed(1)} lb hace ${r.diasSinPesaje} días` : undefined}>{r.pesoActual > 0 ? `${r.pesoEsEstimado ? '~' : ''}${r.pesoActual.toFixed(1)} lb` : 'Sin peso'}</strong></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Peso Objetivo</span><strong>{r.pesoObjetivo.toFixed(0)} lb</strong></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Conversión (FCA)</span><strong className={r.fca > 0 && !r.fcaEsConfiable ? 'text-slate-400' : ''} title={r.fca > 0 && !r.fcaEsConfiable ? 'No confiable: faltan pesajes recientes' : undefined}>{r.fca > 0 ? `${r.fca.toFixed(2)}${r.fcaEsConfiable ? '' : ' ⚠'}` : '—'}</strong></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Carne Vendida</span><strong>{r.lbsCarneVendida.toFixed(1)} lb</strong></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Utilidad Ventas Parciales</span><strong className={r.utilidadVentasParciales >= 0 ? 'text-emerald-700' : 'text-rose-600'}>{formatearMoneda(r.utilidadVentasParciales)}</strong></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Utilidad Proyectada Restantes</span><strong className={r.utilidadProyectadaRestantes >= 0 ? 'text-emerald-700' : 'text-rose-600'}>{formatearMoneda(r.utilidadProyectadaRestantes)}</strong></div>
                                      {r.costoPerdidoBajas > 0 && (
                                        <div className="flex justify-between" title="Lechón más alimento, sanidad y mano de obra que consumieron los animales muertos antes de morir"><span className="text-slate-500">Pérdida por Mortalidad</span><strong className="text-rose-600">{formatearMonedaNeg(r.costoPerdidoBajas)}</strong></div>
                                      )}
                                      <div className="flex justify-between border-t border-slate-100 pt-2"><span className="text-slate-600 font-bold">Resultado Total del Lote</span><strong className={(r.utilidadVentasParciales + r.utilidadProyectadaRestantes - r.costoPerdidoBajas) >= 0 ? 'text-emerald-700' : 'text-rose-600'}>{formatearMoneda(r.utilidadVentasParciales + r.utilidadProyectadaRestantes - r.costoPerdidoBajas)}</strong></div>
                                    </div>
                                  </div>

                                  <div className="bg-slate-900 text-white rounded-xl p-4.5 flex flex-col justify-between shadow-md">
                                    <div>
                                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-3.5 border-b border-slate-800 pb-2 flex items-center gap-1.5"><Activity size={14} /> Perspectiva Financiera</h4>
                                      <p className="text-[11px] leading-relaxed text-slate-300 font-medium">
                                        Este lote ha registrado <strong className="text-emerald-400">{formatearMoneda(r.ingresosBrutos)}</strong> en ventas.
                                        Los <strong className="text-white">{r.cerdosRestantes}</strong> cerdos vivos cargan una inversión de <strong className="text-amber-400">{formatearMoneda(r.costoAsignadoRestantes)}</strong>
                                        {r.costoFuturoRestantes > 0 ? <> y requieren aproximadamente <strong className="text-rose-400">{formatearMoneda(r.costoFuturoRestantes)}</strong> adicionales de alimento para finalizar el ciclo.</> : <> y no proyectan costo futuro adicional.</>}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Ventas Parciales Registradas</h4>
                                    <span className="text-[10px] text-slate-400 font-bold">{r.ventasDetalle.length} transacciones</span>
                                  </div>
                                  {r.ventasDetalle.length === 0 ? (
                                    <div className="p-6 text-xs text-slate-400 italic text-center font-semibold">No se han registrado ventas parciales en báscula.</div>
                                  ) : (
                                    <div className="overflow-x-auto text-xs font-semibold">
                                      <table className="w-full text-left">
                                        <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] tracking-wider border-b border-slate-100">
                                          <tr>
                                            <th className="py-2.5 px-4">Fecha</th>
                                            <th className="py-2.5 px-3 text-right">Cerdos</th>
                                            <th className="py-2.5 px-3 text-right">Libras</th>
                                            <th className="py-2.5 px-3 text-right">Promedio</th>
                                            <th className="py-2.5 px-3 text-right">Q/Lb</th>
                                            <th className="py-2.5 px-3 text-right">Importe</th>
                                            <th className="py-2.5 px-3 text-right">Costo Asignado</th>
                                            <th className="py-2.5 px-4 text-right">Utilidad</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                          {r.ventasDetalle.map(venta => (
                                            <tr key={venta.id} className="hover:bg-slate-50/60 transition-colors">
                                              <td className="py-2 px-4 font-bold text-slate-700">{venta.fecha || '—'}</td>
                                              <td className="py-2 px-3 text-right">{venta.cantidadCerdos || 0}</td>
                                              <td className="py-2 px-3 text-right font-medium">{venta.totalLibras || venta.libras.toFixed(1)} lb</td>
                                              <td className="py-2 px-3 text-right">{venta.pesoPromedio.toFixed(1)} lb</td>
                                              <td className="py-2 px-3 text-right">Q{venta.precioLibra.toFixed(2)}</td>
                                              <td className="py-2 px-3 text-right font-bold text-emerald-600">{formatearMoneda(venta.totalVenta || 0)}</td>
                                              <td className="py-2 px-3 text-right font-bold text-amber-600">{formatearMonedaNeg(venta.costoAsignado)}</td>
                                              <td className={`py-2 px-4 text-right font-black ${venta.utilidadEstimada >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{formatearMoneda(venta.utilidadEstimada)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 border-t-2 border-slate-200">
                  <tr className="font-black text-slate-800 text-xs">
                    <td colSpan={3} className="py-4 px-5 uppercase tracking-widest text-[10px] text-slate-500">TOTALES GLOBALES ACUMULADOS</td>
                    <td className="py-4 px-4 text-right font-extrabold">{formatearMoneda(totGlobal.inversionTotal)}</td>
                    <td className="py-4 px-4 text-right font-extrabold text-emerald-700">{formatearMoneda(totGlobal.ingresosBrutos)}</td>
                    <td className={`py-4 px-4 text-right font-black ${totGlobal.utilidadRealVentas >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{formatearMoneda(totGlobal.utilidadRealVentas)}</td>
                    <td className={`py-4 px-5 text-right font-black ${totGlobal.utilidadNeta >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>{formatearMoneda(totGlobal.utilidadNeta)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="fixed left-[-9999px] top-0 w-[7.8in] bg-white text-slate-900 pointer-events-none">
          <section
            id="reporte-financiero-global-pdf"
            className="bg-white text-slate-900 font-sans"
            style={{ width: '7.8in' }}
          >
            <style>{`
              #reporte-financiero-global-pdf {
                font-family: Inter, Arial, sans-serif;
                color: #0f172a;
                background: #ffffff;
              }
              #reporte-financiero-global-pdf .pdf-sheet {
                width: 7.8in;
                padding: 0 0 0.18in 0;
                background: #ffffff;
                box-sizing: border-box;
              }
              #reporte-financiero-global-pdf .pdf-page-break-before {
                page-break-before: always;
                break-before: page;
              }
              #reporte-financiero-global-pdf .pdf-avoid-break,
              #reporte-financiero-global-pdf tr {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              #reporte-financiero-global-pdf table {
                border-collapse: collapse;
                width: 100%;
              }
              #reporte-financiero-global-pdf thead {
                display: table-header-group;
              }
              #reporte-financiero-global-pdf tfoot {
                display: table-row-group;
              }
              #reporte-financiero-global-pdf th,
              #reporte-financiero-global-pdf td {
                vertical-align: top;
              }
            `}</style>

            <div className="pdf-sheet">
              <header className="border-b-4 border-emerald-600 pb-5 mb-5 flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 mb-2">AgroControl Porcino</p>
                  <h1 className="text-3xl font-black tracking-tight text-slate-950 leading-none">Reporte Financiero Global</h1>
                  <p className="text-xs text-slate-500 font-semibold mt-2">Generado el {fechaReporteFinanciero}</p>
                </div>
                <div className="text-right border border-slate-200 rounded-lg p-3 min-w-[1.55in]">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Lotes analizados</p>
                  <p className="text-3xl font-black text-slate-900 leading-none mt-1">{resumenPorLote.length}</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-1">{lotesActivos} activos · {lotesCerrados} cerrados</p>
                </div>
              </header>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  ['Inversión histórica', formatearMoneda(totGlobal.inversionTotal), 'Capital acumulado en lechones, alimento, sanidad, gastos y mano de obra', 'text-slate-900'],
                  ['Ingresos brutos', formatearMoneda(totGlobal.ingresosBrutos), `${totGlobal.lbsCarneVendida.toFixed(0)} lb vendidas registradas`, 'text-emerald-700'],
                  ['Utilidad realizada', formatearMoneda(totGlobal.utilidadRealVentas), `Margen realizado ${margenGlobal.toFixed(1)}%`, totGlobal.utilidadRealVentas >= 0 ? 'text-emerald-700' : 'text-rose-700'],
                  ['Utilidad estimada', formatearMoneda(totGlobal.utilidadNeta), `Incluye ${formatearMoneda(totGlobal.valorEstimadoVivos)} de inventario vivo`, totGlobal.utilidadNeta >= 0 ? 'text-indigo-700' : 'text-rose-700'],
                ].map(([label, value, note, color]) => (
                  <div key={label} className="pdf-card border border-slate-200 rounded-lg p-4 bg-slate-50/60">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                    <p className={`text-2xl font-black mt-1 leading-tight ${color}`}>{value}</p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-1.5 leading-snug">{note}</p>
                  </div>
                ))}
              </div>

              <div className="pdf-card border border-slate-200 rounded-lg p-4 mb-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Distribución de egresos</h2>
                  <span className="text-[10px] font-black text-slate-500">Costo/lb: {costoPorLibraGlobal > 0 ? formatearMoneda(costoPorLibraGlobal) : '—'}</span>
                </div>
                <div className="space-y-2.5">
                  {costItems.map(item => {
                    const pct = totGlobal.inversionTotal > 0 ? (item.value / totGlobal.inversionTotal) * 100 : 0;
                    const barW = maxCosto > 0 ? (item.value / maxCosto) * 100 : 0;
                    return (
                      <div key={item.label} className="grid grid-cols-[1.1in_1fr_1.45in] items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-600">{item.label}</span>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${barW}%` }} />
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black text-slate-900">{formatearMoneda(item.value)}</span>
                          <span className="text-[9px] text-slate-400 font-bold ml-1">({pct.toFixed(1)}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pdf-card border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-slate-900 text-white">
                  <h2 className="text-sm font-black uppercase tracking-widest">Resumen por lote</h2>
                </div>
                <table className="text-[9px]">
                  <thead className="bg-slate-100 text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-2 text-left">Lote</th>
                      <th className="py-2 px-2 text-center">Estado</th>
                      <th className="py-2 px-2 text-right">Animales</th>
                      <th className="py-2 px-2 text-right">Inversión</th>
                      <th className="py-2 px-2 text-right">Ingresos</th>
                      <th className="py-2 px-2 text-right">Utilidad real</th>
                      <th className="py-2 px-2 text-right">Estimada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenPorLote.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="py-2 px-2">
                          <p className="font-black text-slate-900 leading-tight">{r.nombre}</p>
                          <p className="text-[8px] text-slate-500 font-semibold">{formatearFechaReporte(r.fechaIngreso)} · {r.diasLote} días</p>
                        </td>
                        <td className="py-2 px-2 text-center font-black">{r.estado}</td>
                        <td className="py-2 px-2 text-right font-semibold">{r.cerdosRestantes} vivos<br /><span className="text-slate-400">{r.cerdosVendidos} vendidos · {r.bajasTotales} bajas</span></td>
                        <td className="py-2 px-2 text-right font-bold">{formatearMoneda(r.inversionTotal)}</td>
                        <td className="py-2 px-2 text-right font-bold text-emerald-700">{formatearMoneda(r.ingresosBrutos)}</td>
                        <td className={`py-2 px-2 text-right font-black ${r.utilidadRealVentas >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatearMoneda(r.utilidadRealVentas)}</td>
                        <td className={`py-2 px-2 text-right font-black ${r.utilidadNeta >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{formatearMoneda(r.utilidadNeta)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                    <tr className="font-black text-slate-900">
                      <td colSpan={3} className="py-2 px-2 uppercase tracking-widest">Totales</td>
                      <td className="py-2 px-2 text-right">{formatearMoneda(totGlobal.inversionTotal)}</td>
                      <td className="py-2 px-2 text-right text-emerald-700">{formatearMoneda(totGlobal.ingresosBrutos)}</td>
                      <td className={`py-2 px-2 text-right ${totGlobal.utilidadRealVentas >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatearMoneda(totGlobal.utilidadRealVentas)}</td>
                      <td className={`py-2 px-2 text-right ${totGlobal.utilidadNeta >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{formatearMoneda(totGlobal.utilidadNeta)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {resumenPorLote.map((r) => (
              <div key={`pdf-detail-${r.id}`} className="pdf-sheet pdf-page-break-before">
                <header className="border-b-2 border-slate-900 pb-3 mb-4 flex items-start justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Detalle financiero por lote</p>
                    <h2 className="text-2xl font-black text-slate-950 leading-none mt-1">{r.nombre}</h2>
                    <p className="text-[10px] text-slate-500 font-bold mt-1">{r.estado} · Ingreso {formatearFechaReporte(r.fechaIngreso)} · {r.diasLote} días</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Utilidad estimada</p>
                    <p className={`text-xl font-black ${r.utilidadNeta >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{formatearMoneda(r.utilidadNeta)}</p>
                  </div>
                </header>

                <div className="grid grid-cols-4 gap-2.5 mb-4">
                  {[
                    ['Inversión', formatearMoneda(r.inversionTotal)],
                    ['Ingresos', formatearMoneda(r.ingresosBrutos)],
                    ['Costo/cerdo', formatearMoneda(r.costoPorCerdoOperado)],
                    ['Punto equilibrio', r.puntoEquilibrioRestantes > 0 ? formatearMoneda(r.puntoEquilibrioRestantes) : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="pdf-card border border-slate-200 rounded-lg p-3 bg-slate-50">
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                      <p className="text-[13px] font-black text-slate-900 mt-1 leading-tight">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="pdf-card border border-slate-200 rounded-lg overflow-hidden">
                    <h3 className="bg-slate-900 text-white px-3 py-2 text-[10px] font-black uppercase tracking-widest">Costos acumulados</h3>
                    <div className="p-3 space-y-2 text-[10px] font-semibold">
                      <div className="flex justify-between"><span>Lechones</span><strong>{formatearMoneda(r.costoLechones)}</strong></div>
                      <div className="flex justify-between"><span>Alimento</span><strong>{formatearMoneda(r.costoAlimento)}</strong></div>
                      <div className="flex justify-between"><span>Medicinas y sanidad</span><strong>{formatearMoneda(r.costoMedicinas)}</strong></div>
                      <div className="flex justify-between"><span>Gastos extra</span><strong>{formatearMoneda(r.costoGastos)}</strong></div>
                      <div className="flex justify-between"><span>Mano de obra</span><strong>{formatearMoneda(r.costoManoObra)}</strong></div>
                      <div className="flex justify-between border-t border-slate-200 pt-2 text-slate-950 font-black"><span>Total</span><span>{formatearMoneda(r.inversionTotal)}</span></div>
                    </div>
                  </div>

                  <div className="pdf-card border border-slate-200 rounded-lg overflow-hidden">
                    <h3 className="bg-slate-900 text-white px-3 py-2 text-[10px] font-black uppercase tracking-widest">Indicadores productivos</h3>
                    <div className="p-3 space-y-2 text-[10px] font-semibold">
                      <div className="flex justify-between"><span>Iniciales</span><strong>{r.cantidadInicial}</strong></div>
                      <div className="flex justify-between"><span>Vivos</span><strong>{r.cerdosRestantes}</strong></div>
                      <div className="flex justify-between"><span>Vendidos</span><strong>{r.cerdosVendidos}</strong></div>
                      <div className="flex justify-between"><span>Bajas</span><strong>{r.bajasTotales}</strong></div>
                      <div className="flex justify-between"><span>Peso actual{r.pesoEsEstimado ? ' (est.)' : ''}</span><strong>{r.pesoActual > 0 ? `${r.pesoEsEstimado ? '~' : ''}${r.pesoActual.toFixed(1)} lb` : 'Sin peso'}</strong></div>
                      <div className="flex justify-between"><span>FCA</span><strong>{r.fca > 0 ? `${r.fca.toFixed(2)}${r.fcaEsConfiable ? '' : ' (no confiable)'}` : '—'}</strong></div>
                      {r.costoPerdidoBajas > 0 && <div className="flex justify-between"><span>Pérdida por mortalidad</span><strong>{formatearMonedaNeg(r.costoPerdidoBajas)}</strong></div>}
                    </div>
                  </div>
                </div>

                <div className="pdf-card border border-slate-200 rounded-lg p-3 mb-4 bg-slate-50">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-2">Proyección y lectura financiera</h3>
                  <p className="text-[10px] leading-relaxed text-slate-600 font-semibold">
                    Ventas registradas por {formatearMoneda(r.ingresosBrutos)}. Los {r.cerdosRestantes} animales vivos cargan una inversión asignada de {formatearMoneda(r.costoAsignadoRestantes)}
                    {r.costoFuturoRestantes > 0 ? ` y proyectan ${formatearMoneda(r.costoFuturoRestantes)} adicionales para finalizar el ciclo.` : ' y no registran costo futuro proyectado.'}
                    {' '}La utilidad proyectada de los restantes es {formatearMoneda(r.utilidadProyectadaRestantes)}.
                  </p>
                </div>

                <div className="pdf-card border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Ventas registradas</h3>
                    <span className="text-[9px] font-black text-slate-500">{r.ventasDetalle.length} transacciones</span>
                  </div>
                  {r.ventasDetalle.length === 0 ? (
                    <p className="p-5 text-center text-[10px] text-slate-400 font-bold italic">No se han registrado ventas parciales.</p>
                  ) : (
                    <table className="text-[8.5px]">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="py-2 px-2 text-left">Fecha</th>
                          <th className="py-2 px-2 text-right">Cerdos</th>
                          <th className="py-2 px-2 text-right">Libras</th>
                          <th className="py-2 px-2 text-right">Prom.</th>
                          <th className="py-2 px-2 text-right">Q/lb</th>
                          <th className="py-2 px-2 text-right">Importe</th>
                          <th className="py-2 px-2 text-right">Costo</th>
                          <th className="py-2 px-2 text-right">Utilidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.ventasDetalle.map((venta) => (
                          <tr key={venta.id} className="border-t border-slate-100">
                            <td className="py-1.5 px-2 font-bold">{formatearFechaReporte(venta.fecha)}</td>
                            <td className="py-1.5 px-2 text-right">{venta.cantidadCerdos || 0}</td>
                            <td className="py-1.5 px-2 text-right">{venta.libras.toFixed(1)}</td>
                            <td className="py-1.5 px-2 text-right">{venta.pesoPromedio.toFixed(1)}</td>
                            <td className="py-1.5 px-2 text-right">Q{(Number(venta.precioLibra) || 0).toFixed(2)}</td>
                            <td className="py-1.5 px-2 text-right font-bold text-emerald-700">{formatearMoneda(venta.totalVenta || 0)}</td>
                            <td className="py-1.5 px-2 text-right font-bold text-amber-700">{formatearMoneda(venta.costoAsignado)}</td>
                            <td className={`py-1.5 px-2 text-right font-black ${venta.utilidadEstimada >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatearMoneda(venta.utilidadEstimada)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    );
  };
  const renderModalQrTolva = () => {
    const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const loteDetectado = qrCorralDetectado ? getLoteActivo(qrCorralDetectado.id) : null;
    const statsDetectado = loteDetectado ? calcularEstadisticasLote(loteDetectado) : null;
    const contextoTolva = qrCorralDetectado
      ? resolverContextoTolvaQr({
          corral: qrCorralDetectado,
          loteActivo: loteDetectado,
          stats: statsDetectado,
          cronograma: CRONOGRAMA_ALIMENTACION,
          catalogoAlimento: listCatAlimentos,
          inventarioCentral
        })
      : null;

    const infoAlimentoSeleccionado = listCatAlimentos.find(a => a.nombre === qrTipoAlimento) || null;
    const stockItemSeleccionado = inventarioCentral.find(i => i.nombre === qrTipoAlimento) || null;
    const lbsPorSacoSel = Number(infoAlimentoSeleccionado?.librasPorSaco) || 50;
    const precioSacoSel = Number(infoAlimentoSeleccionado?.precioSaco) || 0;
    const stockDisponibleLbs = Number(stockItemSeleccionado?.stockLbs) || 0;
    const stockDisponibleSacos = lbsPorSacoSel > 0 ? stockDisponibleLbs / lbsPorSacoSel : 0;

    const cantNumerica = parseFloat(qrCantidad) || 0;
    const librasADescontar = qrUnidad === 'sacos' ? cantNumerica * lbsPorSacoSel : cantNumerica;
    const sacosADescontar = lbsPorSacoSel > 0 ? librasADescontar / lbsPorSacoSel : 0;
    const costoEstimadoQr = qrUnidad === 'sacos'
      ? cantNumerica * precioSacoSel
      : cantNumerica * (precioSacoSel / lbsPorSacoSel);
    const stockInsuficientePreview = librasADescontar > stockDisponibleLbs + 1e-6;
    const hoyQr = todayIso();
    const corralLlaveQr = qrCorralDetectado || (qrExitoReciente ? listCorrales.find(c => c.id === qrExitoReciente.corralId) : null);
    const loteLlaveQr = corralLlaveQr ? getLoteActivo(corralLlaveQr.id) : null;
    const tareasUrgentesQr = loteLlaveQr
      ? listTareasSanidad
          .filter(t => t.loteId === loteLlaveQr.id && (t.estado || 'pendiente') === 'pendiente')
          .map(t => {
            const fechaObj = t.fechaObjetivo || (loteLlaveQr.fechaIngreso ? addDaysToIsoDate(loteLlaveQr.fechaIngreso, Number(t.dia) || 0) : '');
            return { ...t, fechaObj };
          })
          .filter(t => t.fechaObj && t.fechaObj <= hoyQr)
      : [];

    const renderLlaveMaestraQr = (corralRef) => {
      if (!corralRef) return null;
      return (
        <div className="border-t border-slate-200/80 pt-4 space-y-3 text-left">
          {tareasUrgentesQr.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 flex items-center gap-1.5">
                <Syringe size={13} className="text-amber-600" /> Pendiente Sanitario Hoy en {corralRef.nombre}
              </p>
              {tareasUrgentesQr.map(t => (
                <div key={t.id} className="bg-white border border-amber-100 rounded-xl p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-800 text-xs truncate">{t.tarea}</p>
                    <p className="text-[10px] font-semibold text-amber-700">{t.fechaObj < hoyQr ? `Atrasada (${t.fechaObj})` : 'Toca hoy'}</p>
                  </div>
                  {t.innosureDosis ? (
                    <button
                      type="button"
                      onClick={() => irACorralDesdeQr(corralRef, 'sanidad')}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold px-3 py-1.5 rounded-lg shrink-0"
                    >
                      Aplicar dosis
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        vibrarCampo(45);
                        handleActualizarTareaSanidad(t.id, { estado: 'hecho' });
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold px-3 py-1.5 rounded-lg shrink-0"
                    >
                      Marcar hecha
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
              Llave Maestra de {corralRef.nombre} · Ir directo a:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => irACorralDesdeQr(corralRef, 'peso')}
                className="py-2.5 px-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 rounded-xl text-[11px] font-extrabold text-slate-700 flex items-center justify-center gap-1 transition-colors"
              >
                <Scale size={13} /> Pesar
              </button>
              <button
                type="button"
                onClick={() => irACorralDesdeQr(corralRef, 'sanidad')}
                className="py-2.5 px-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 rounded-xl text-[11px] font-extrabold text-slate-700 flex items-center justify-center gap-1 transition-colors"
              >
                <HeartPulse size={13} /> Sanidad / Baja
              </button>
              <button
                type="button"
                onClick={() => irACorralDesdeQr(corralRef, 'resumen')}
                className="py-2.5 px-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 rounded-xl text-[11px] font-extrabold text-slate-700 flex items-center justify-center gap-1 transition-colors"
              >
                <PieChart size={13} /> Resumen
              </button>
            </div>
          </div>
        </div>
      );
    };

    return (
      <>
        {/* PLIEGO OCULTO PARA IMPRESIÓN PDF DE RÓTULOS QR DE CORRALES.
            Se monta solo con el modal abierto: codificar un QR por corral en cada
            arranque de la app era trabajo puro para una función que quizá nadie abra. */}
        {qrModalAbierto && (
        <div className="absolute -left-[9999px] top-0 pointer-events-none">
          <div id="fichas-qr-corrales-pdf" className="p-10 w-[800px] bg-white text-slate-900 font-sans">
            <div className="text-center border-b-4 border-slate-900 pb-5 mb-8">
              <h1 className="text-3xl font-black tracking-tight uppercase text-slate-900">RÓTULOS QR PARA TOLVAS DE CORRAL</h1>
              <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">Porcicontrol · Descuento Rápido de Concentrado en Campo</p>
              <p className="text-xs text-slate-500 mt-2">Recorta y plastifica cada tarjeta en la tolva o puerta del corral correspondiente.</p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {listCorrales.map(corral => {
                const payload = buildCorralQrPayload(corral, originUrl);
                return (
                  <div key={`pdf-qr-${corral.id}`} className="border-2 border-dashed border-slate-400 rounded-2xl p-6 flex flex-col items-center text-center bg-white">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full mb-2">
                      TOLVA DE ALIMENTACIÓN
                    </span>
                    <h2 className="text-2xl font-black text-slate-900 uppercase">{corral.nombre}</h2>
                    <p className="text-xs font-bold text-slate-500 mb-4">Capacidad máx: {corral.capacidad} cerdos</p>
                    {/* Sin borde pegado al código: el marco impreso invadía la zona
                        de silencio y los lectores fallaban al ras del rótulo. */}
                    <div className="p-4 bg-white rounded-2xl ring-2 ring-slate-900 ring-offset-4 ring-offset-white">
                      <CodigoQrSvg valor={payload} size={175} etiqueta={`Código QR de ${corral.nombre}`} />
                    </div>
                    <p className="text-[11px] font-extrabold text-slate-700 mt-5 uppercase tracking-wider">
                      Escanea al vaciar concentrado en la tolva
                    </p>
                    <p className="text-[9px] font-mono text-slate-400 mt-1 break-all">{corral.id}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )}

        {/* MODAL INTERACTIVO QR TOLVA */}
        {qrModalAbierto && (
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[9990] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-qr"
          >
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden my-auto animate-in zoom-in-95 duration-200 max-h-[92dvh] flex flex-col">
              {/* Header del Modal */}
              <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
                    <QrCode size={20} />
                  </div>
                  <div>
                    <h3 id="titulo-modal-qr" className="font-extrabold text-base leading-tight">Tolva Inteligente por QR</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Descuento rápido de concentrado por corral</p>
                  </div>
                </div>
                <button type="button" onClick={cerrarModalQrTolva} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Selector de Pestaña: Escanear vs Imprimir Rótulos */}
              <div className="bg-slate-100 p-1.5 border-b border-slate-200 flex gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => { setQrModalModo('escanear'); setQrErrorMensaje(''); }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                    qrModalModo === 'escanear'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ScanLine size={15} className="text-emerald-600" /> Escanear / Descontar
                </button>
                <button
                  type="button"
                  onClick={() => { detenerCamaraQr(); setQrModalModo('imprimir'); setQrErrorMensaje(''); }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                    qrModalModo === 'imprimir'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Printer size={15} className="text-indigo-600" /> Rótulos QR ({listCorrales.length})
                </button>
              </div>

              {/* Cuerpo del Modal */}
              <div className="p-5 overflow-y-auto space-y-5 flex-1">
                {qrErrorMensaje && (
                  <div role="alert" aria-live="assertive" className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-start gap-2.5">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                    <span className="flex-1 leading-relaxed">{qrErrorMensaje}</span>
                  </div>
                )}

                {/* MODO 1: ESCANEAR Y DESCONTAR */}
                {qrModalModo === 'escanear' && (
                  <>
                    {/* SUB-VISTA A: ÉXITO RECIENTE */}
                    {qrExitoReciente ? (
                      <div role="status" aria-live="polite" className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-6 text-center space-y-4 animate-in fade-in duration-200">
                        <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                          <Check size={30} />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                            Descuento Aplicado en Bodega
                          </span>
                          <h4 className="text-xl font-black text-slate-900 mt-2">{qrExitoReciente.corralNombre}</h4>
                          <p className="text-xs font-semibold text-slate-500">{qrExitoReciente.loteNombre} · Fase {qrExitoReciente.fase}</p>
                        </div>

                        <div className="bg-white rounded-2xl p-4 border border-emerald-100 text-left space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-semibold">Concentrado:</span>
                            <span className="font-extrabold text-slate-800">{qrExitoReciente.tipoAlimento}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-semibold">Cantidad descargada:</span>
                            <span className="font-black text-emerald-700">
                              {qrExitoReciente.libras.toFixed(1)} lb ({qrExitoReciente.sacos.toFixed(2)} sacos)
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-semibold">Costo cargado al lote:</span>
                            <span className="font-bold text-rose-600">{formatearMonedaNeg(qrExitoReciente.costo)}</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-100 pt-2">
                            <span className="text-slate-400 font-semibold">Queda en Bodega Central:</span>
                            <span className="font-extrabold text-slate-800">
                              {qrExitoReciente.stockRestanteSacos.toFixed(1)} sacos ({qrExitoReciente.stockRestanteLbs.toFixed(0)} lb)
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setQrExitoReciente(null);
                              setQrCorralDetectado(null);
                              setQrErrorMensaje('');
                            }}
                            className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <ScanLine size={15} className="text-emerald-400" /> Escanear Otra Tolva
                          </button>
                          <button
                            type="button"
                            onClick={cerrarModalQrTolva}
                            className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-colors"
                          >
                            Finalizar
                          </button>
                        </div>

                        {renderLlaveMaestraQr(corralLlaveQr)}
                      </div>
                    ) : !qrCorralDetectado ? (
                      /* SUB-VISTA B: CÁMARA ESCÁNER + SELECTOR RÁPIDO DE CORRAL */
                      <div className="space-y-4">
                        {qrUltimoDescuentoRonda && (
                          <div role="status" aria-live="polite" className="bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-md flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="bg-white/20 p-1.5 rounded-full shrink-0">
                                <Check size={16} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black truncate">
                                  {qrUltimoDescuentoRonda.corralNombre}: -{qrUltimoDescuentoRonda.libras.toFixed(0)} lb ({qrUltimoDescuentoRonda.tipoAlimento})
                                </p>
                                <p className="text-[10px] text-emerald-100 font-bold">
                                  Ronda activa · Apunta al QR del siguiente corral (quedan {qrUltimoDescuentoRonda.stockRestanteSacos.toFixed(1)} sacos)
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={cerrarModalQrTolva}
                              className="bg-emerald-800/70 hover:bg-emerald-900 text-white text-[11px] font-extrabold px-2.5 py-1.5 rounded-xl shrink-0"
                            >
                              Listo
                            </button>
                          </div>
                        )}
                        <div className="relative bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 aspect-[4/3] sm:aspect-video flex flex-col items-center justify-center">
                          {/* El <video> se mantiene montado siempre: si solo existiera
                              al estar activa la cámara, el stream llegaría antes que el
                              elemento y quedaría sin destino. */}
                          <video
                            ref={qrVideoRef}
                            playsInline
                            muted
                            aria-label="Vista de la cámara para escanear el código QR del corral"
                            className={`w-full h-full object-cover ${qrCamaraEstado === 'activa' ? 'block' : 'hidden'}`}
                          />
                          {qrCamaraEstado === 'activa' && (
                            <>
                              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                                <div className="w-44 h-44 border-2 border-emerald-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(2,6,23,0.45)] relative">
                                  <div className="absolute inset-x-2 top-1/2 h-0.5 bg-emerald-400 animate-pulse" />
                                </div>
                                <span className="mt-3 bg-slate-950/80 text-emerald-300 text-[11px] font-bold px-3 py-1 rounded-full border border-emerald-500/30">
                                  Apunta al código QR pegado en la tolva del corral
                                </span>
                              </div>
                              {qrLinternaDisponible && (
                                <button
                                  type="button"
                                  onClick={alternarLinternaQr}
                                  aria-pressed={qrLinternaActiva}
                                  className={`absolute top-3 right-3 p-2.5 rounded-xl border transition-colors ${
                                    qrLinternaActiva
                                      ? 'bg-amber-400 border-amber-300 text-slate-950'
                                      : 'bg-slate-950/70 border-slate-700 text-slate-200 hover:bg-slate-900'
                                  }`}
                                >
                                  {qrLinternaActiva ? <Flashlight size={16} /> : <FlashlightOff size={16} />}
                                  <span className="sr-only">
                                    {qrLinternaActiva ? 'Apagar linterna' : 'Encender linterna'}
                                  </span>
                                </button>
                              )}
                            </>
                          )}
                          {qrCamaraEstado === 'iniciando' && (
                            <div className="p-6 text-center text-slate-300 space-y-3">
                              <div className="animate-spin rounded-full h-7 w-7 border-2 border-emerald-400 border-t-transparent mx-auto" />
                              <p className="text-xs font-bold">Abriendo la cámara trasera...</p>
                            </div>
                          )}
                          {(qrCamaraEstado === 'inactiva' || qrCamaraEstado === 'error') && (
                            <div className="p-6 text-center text-slate-300 space-y-2.5">
                              <Camera size={32} className="mx-auto text-emerald-400/80" />
                              <p className="text-xs font-bold max-w-sm mx-auto leading-relaxed">
                                {qrCamaraError || 'Preparando el escáner de QR...'}
                              </p>
                              {qrCamaraReintentable && (
                                <button
                                  type="button"
                                  onClick={reintentarCamaraQr}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors"
                                >
                                  <RefreshCw size={14} /> Reintentar
                                </button>
                              )}
                              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                                También puedes tomar una foto del QR o tocar el corral directamente en la lista inferior.
                              </p>
                            </div>
                          )}
                          {qrCamaraEstado === 'activa' && qrMotorLector === 'jsqr' && (
                            <span className="absolute bottom-2 left-2 bg-slate-950/70 text-slate-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-slate-700">
                              Lector compatible
                            </span>
                          )}
                        </div>

                        {/* Acciones alternativas: Foto de cámara o lector manual */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <label className={`flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-3.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-slate-200 ${qrLeyendoFoto ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
                            {qrLeyendoFoto ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-600 border-t-transparent" />
                            ) : (
                              <Camera size={15} className="text-emerald-600" />
                            )}
                            <span>{qrLeyendoFoto ? 'Leyendo la foto...' : 'Tomar Foto / Leer Imagen QR'}</span>
                            <input type="file" accept="image/*" capture="environment" disabled={qrLeyendoFoto} onChange={handleEscanearImagenQr} className="hidden" />
                          </label>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (qrCodigoManual.trim()) procesarTextoQrEscaneado(qrCodigoManual);
                            }}
                            className="flex flex-1 gap-1.5"
                          >
                            <input
                              type="text"
                              value={qrCodigoManual}
                              onChange={(e) => setQrCodigoManual(e.target.value)}
                              placeholder="Código o pistola QR (ej. c1)"
                              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500"
                            />
                            <button
                              type="submit"
                              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs shrink-0"
                            >
                              Leer
                            </button>
                          </form>
                        </div>

                        {/* Selector Rápido de Corral (1 toque si hay poca luz en el galpón) */}
                        <div className="border-t border-slate-100 pt-4">
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                              ¿Poca luz en el galpón? Toca el corral directo:
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {listCorrales.map(c => {
                              const loteC = getLoteActivo(c.id);
                              const statsC = loteC ? calcularEstadisticasLote(loteC) : null;
                              const faseNum = loteC ? (loteC.faseActual || CRONOGRAMA_ALIMENTACION.find(f => statsC?.diasLote >= f.diaInicio && statsC?.diasLote <= f.diaFin)?.fase || 1) : null;
                              const faseObj = faseNum ? CRONOGRAMA_ALIMENTACION.find(f => f.fase === faseNum) : null;

                              return (
                                <button
                                  key={`quick-qr-${c.id}`}
                                  type="button"
                                  onClick={() => prepararCorralEnModalQr(c)}
                                  className={`p-3 rounded-xl border text-left transition-all ${
                                    loteC
                                      ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50'
                                      : 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-100'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-xs text-slate-900">{c.nombre}</span>
                                    <QrCode size={13} className={loteC ? 'text-emerald-600' : 'text-slate-400'} />
                                  </div>
                                  {loteC ? (
                                    <p className="text-[10px] font-bold text-emerald-700 mt-1 truncate">
                                      E{faseNum} · {faseObj?.alimento || 'Activo'}
                                    </p>
                                  ) : (
                                    <p className="text-[10px] font-semibold text-slate-400 mt-1">Vacío</p>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* SUB-VISTA C: CORRAL DETECTADO -> TARJETA DE DESCUENTO EN 1 TOQUE */
                      <div className="space-y-5 animate-in fade-in duration-200">
                        <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="bg-emerald-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                                QR Detectado
                              </span>
                              <span className="text-xs text-slate-300 font-bold">
                                {loteDetectado ? `Día ${contextoTolva?.diasLote} · ${contextoTolva?.cantidadActual} cerdos` : 'Sin lote activo'}
                              </span>
                            </div>
                            <h4 className="text-xl font-black mt-1">{qrCorralDetectado.nombre}</h4>
                            {loteDetectado && (
                              <p className="text-xs text-emerald-400 font-bold">
                                {loteDetectado.nombre || loteDetectado.raza || 'Lote Activo'} · Etapa actual: Fase {contextoTolva?.faseActual} ({contextoTolva?.faseInfo?.alimento})
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setQrCorralDetectado(null);
                              setQrErrorMensaje('');
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold px-3 py-2 rounded-xl border border-slate-700 shrink-0"
                          >
                            Cambiar QR
                          </button>
                        </div>

                        {!contextoTolva?.tieneLoteActivo ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-3">
                            <AlertCircle size={28} className="mx-auto text-amber-500" />
                            <p className="text-xs font-bold text-amber-900">{contextoTolva?.error}</p>
                            <button
                              type="button"
                              onClick={() => {
                                const corral = qrCorralDetectado;
                                cerrarModalQrTolva();
                                setCorralSeleccionado(corral);
                                setVista('corralDetail');
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs"
                            >
                              Ir a {qrCorralDetectado.nombre} para Ingresar Lote
                            </button>
                          </div>
                        ) : (
                          <form onSubmit={handleConfirmarDescuentoQr} className="space-y-4 text-xs font-semibold">
                            {/* Concentrado y Etapa (Preseleccionados automáticamente según la fase del corral) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                                  Concentrado a Descargar
                                </label>
                                <select
                                  value={qrTipoAlimento}
                                  onChange={(e) => setQrTipoAlimento(e.target.value)}
                                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-extrabold text-slate-800 outline-none focus:border-emerald-500"
                                >
                                  {listCatAlimentos.map(a => (
                                    <option key={a.id} value={a.nombre}>
                                      {a.nombre} ({a.librasPorSaco || 50} lb)
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                                  Etapa Destino
                                </label>
                                <select
                                  value={qrFaseDestino}
                                  onChange={(e) => {
                                    const nuevaFase = parseInt(e.target.value, 10);
                                    setQrFaseDestino(nuevaFase);
                                    const faseTarget = CRONOGRAMA_ALIMENTACION.find(f => f.fase === nuevaFase);
                                    if (faseTarget && listCatAlimentos.some(a => a.nombre === faseTarget.alimento)) {
                                      setQrTipoAlimento(faseTarget.alimento);
                                    }
                                  }}
                                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-extrabold text-indigo-700 outline-none focus:border-emerald-500"
                                >
                                  {CRONOGRAMA_ALIMENTACION.map(f => (
                                    <option key={f.fase} value={f.fase}>
                                      Fase {f.fase} ({f.alimento})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Indicador de Stock en Bodega Central */}
                            <div className={`p-3 rounded-xl border flex items-center justify-between ${
                              stockDisponibleLbs <= 0 || stockInsuficientePreview
                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                : 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                            }`}>
                              <span className="font-bold">Disponible en Bodega ({qrTipoAlimento}):</span>
                              <span className="font-black text-sm">
                                {stockDisponibleSacos.toFixed(2)} sacos ({stockDisponibleLbs.toFixed(0)} lb)
                              </span>
                            </div>

                            {/* Botones grandes de 1 toque para elegir cantidad de sacos */}
                            <div>
                              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                                Cantidad Rápida (1 Toque)
                              </label>
                              <div className="grid grid-cols-4 gap-2">
                                {[
                                  { label: '½ Saco', cant: '0.5', lbs: lbsPorSacoSel * 0.5 },
                                  { label: '1 Saco', cant: '1', lbs: lbsPorSacoSel * 1 },
                                  { label: '2 Sacos', cant: '2', lbs: lbsPorSacoSel * 2 },
                                  { label: '3 Sacos', cant: '3', lbs: lbsPorSacoSel * 3 }
                                ].map(btn => {
                                  const activo = qrUnidad === 'sacos' && Number(qrCantidad) === Number(btn.cant);
                                  return (
                                    <button
                                      key={btn.label}
                                      type="button"
                                      onClick={() => {
                                        setQrUnidad('sacos');
                                        setQrCantidad(btn.cant);
                                      }}
                                      className={`py-3 px-2 rounded-xl border text-center transition-all ${
                                        activo
                                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 font-black'
                                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-bold'
                                      }`}
                                    >
                                      <span className="block text-xs">{btn.label}</span>
                                      <span className={`block text-[10px] mt-0.5 ${activo ? 'text-emerald-100' : 'text-slate-400'}`}>
                                        {btn.lbs.toFixed(0)} lb
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Cantidad personalizada y Fecha */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                                  Cantidad Exacta
                                </label>
                                <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.1"
                                    min="0.1"
                                    required
                                    value={qrCantidad}
                                    onChange={(e) => setQrCantidad(e.target.value)}
                                    className="w-1/2 p-2.5 bg-white font-black text-slate-800 outline-none"
                                  />
                                  <select
                                    value={qrUnidad}
                                    onChange={(e) => setQrUnidad(e.target.value)}
                                    className="w-1/2 p-2.5 bg-slate-100 border-l border-slate-200 font-bold text-slate-700 outline-none"
                                  >
                                    <option value="sacos">Sacos ({lbsPorSacoSel} lb)</option>
                                    <option value="libras">Libras sueltas</option>
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                                  Fecha de Descarga
                                </label>
                                <input
                                  type="date"
                                  required
                                  value={qrFecha}
                                  onChange={(e) => setQrFecha(e.target.value)}
                                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-bold text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            {/* Resumen antes de confirmar */}
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total a Descontar</p>
                                <p className="text-base font-black text-slate-900">
                                  {librasADescontar.toFixed(1)} lb <span className="text-xs font-bold text-slate-500">({sacosADescontar.toFixed(2)} sacos)</span>
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Costo Imputado</p>
                                <p className="text-base font-black text-emerald-700">{formatearMoneda(costoEstimadoQr)}</p>
                              </div>
                            </div>

                            <div className="space-y-2.5">
                              <button
                                type="button"
                                onClick={(e) => handleConfirmarDescuentoQr(e, { continuarRonda: true })}
                                disabled={stockInsuficientePreview || cantNumerica <= 0 || qrGuardando}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                              >
                                {qrGuardando ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                    Guardando descuento...
                                  </>
                                ) : stockInsuficientePreview ? (
                                  <>
                                    <AlertTriangle size={18} />
                                    Stock Insuficiente en Bodega
                                  </>
                                ) : (
                                  <>
                                    <ScanLine size={18} />
                                    Descontar {librasADescontar.toFixed(0)} lb y Escanear Siguiente
                                  </>
                                )}
                              </button>

                              {!stockInsuficientePreview && (
                                <button
                                  type="submit"
                                  disabled={cantNumerica <= 0 || qrGuardando}
                                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-100 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                                >
                                  <CheckCircle size={15} className="text-emerald-400" />
                                  Solo descontar en {qrCorralDetectado.nombre} y finalizar
                                </button>
                              )}
                            </div>
                          </form>
                        )}

                        {renderLlaveMaestraQr(qrCorralDetectado)}
                      </div>
                    )}
                  </>
                )}

                {/* MODO 2: RÓTULOS QR PARA IMPRIMIR Y PLASTIFICAR EN CADA CORRAL */}
                {qrModalModo === 'imprimir' && (
                  <div className="space-y-4">
                    <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-extrabold text-sm text-indigo-950">Pliego de Códigos QR por Corral</h4>
                        <p className="text-[11px] text-indigo-700/80 font-medium mt-0.5">
                          Descarga el PDF, imprímelo y pégalo en cada tolva. Funciona con la cámara del teléfono o desde el botón Escanear de la app.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={listCorrales.length === 0}
                        onClick={() => descargarPDF('fichas-qr-corrales-pdf', 'Rotulos_QR_Corrales_Porcicontrol.pdf')}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shrink-0 self-start sm:self-auto"
                      >
                        <Download size={15} /> Descargar PDF Imprimible
                      </button>
                    </div>

                    {listCorrales.length === 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-1.5">
                        <AlertCircle size={26} className="mx-auto text-amber-500" />
                        <p className="text-xs font-bold text-amber-900">Todavía no hay corrales registrados.</p>
                        <p className="text-[11px] font-semibold text-amber-700">
                          Crea tus corrales en Configuración y aquí aparecerá un rótulo QR por cada uno.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {listCorrales.map(corral => {
                        const payload = buildCorralQrPayload(corral, originUrl);
                        const loteC = getLoteActivo(corral.id);
                        return (
                          <div key={`modal-card-qr-${corral.id}`} className="border border-slate-200 rounded-2xl p-4 flex flex-col items-center text-center bg-slate-50/50">
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                              {loteC ? 'Corral Activo' : 'Corral Vacío'}
                            </span>
                            <h5 className="font-black text-base text-slate-900 mt-1">{corral.nombre}</h5>
                            <p className="text-[11px] text-slate-400 font-semibold mb-3">Capacidad: {corral.capacidad} cerdos</p>
                            <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                              <CodigoQrSvg valor={payload} size={136} etiqueta={`Código QR de ${corral.nombre}`} />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setQrModalModo('escanear');
                                prepararCorralEnModalQr(corral);
                              }}
                              className="mt-3 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <ScanLine size={13} className="text-emerald-400" /> Probar Descarga en {corral.nombre}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  if (!isAppReady) {
    return (
      <div className="h-dvh w-screen flex flex-col items-center justify-center bg-sidebar text-sidebar-ink">
        <img src={marcaGuerraFarm} alt="Guerra Farm" className="h-24 w-auto mb-6" />
        <h2 className="text-3xl font-black">Conectando a la Nube...</h2>
        <p className="text-slate-400 mt-2 font-medium">Sincronizando granja de forma compartida</p>
      </div>
    );
  }

  const pendientesHoyCount = accionesDeHoy.filter(a => a.grupo !== 'semana').length;
  const irAVista = (id) => {
    setVista(id);
    setCorralSeleccionado(null);
    setIsSidebarOpen(false);
  };
  const alternarSidebarColapsado = () => {
    setSidebarColapsado(prev => {
      const next = !prev;
      try { window.localStorage.setItem('porcicontrol_sidebar_colapsado', next ? '1' : '0'); } catch { /* almacenamiento no disponible */ }
      return next;
    });
  };
  const vistaPadreBase = VISTA_PADRE[vista] || null;
  const vistaPadre = vistaPadreBase === 'corralDetail' && !corralSeleccionado ? 'dashboard' : vistaPadreBase;
  const volverAVistaPadre = () => {
    if (!vistaPadre) return;
    if (vistaPadre === 'dashboard') setCorralSeleccionado(null);
    setVista(vistaPadre);
  };
  const tituloVistaActual = (vista === 'corralDetail' || vista === 'corral')
    ? { label: corralSeleccionado?.nombre || 'Control de corral', icon: Box }
    : (TITULOS_VISTA[vista] || { label: 'Porcicontrol', icon: LayoutDashboard });

  return (
    <div className="flex h-dvh bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {renderModalQrTolva()}
      {modalConfirm.visible && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in duration-200">
            <div className={`flex items-center gap-3 mb-4 ${modalConfirm.tipo === 'alert' ? 'text-amber-500' : 'text-rose-600'}`}>
              <AlertTriangle size={28} />
              <h3 className="text-xl font-bold text-slate-800">{modalConfirm.titulo}</h3>
            </div>
            <p className="text-slate-600 mb-8 leading-relaxed">{modalConfirm.mensaje}</p>
            <div className="flex gap-3">
              {modalConfirm.tipo === 'confirm' && <button onClick={() => setModalConfirm({ ...modalConfirm, visible: false })} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">Cancelar</button>}
              <button onClick={modalConfirm.onConfirm} className={`flex-1 py-3 text-white font-bold rounded-xl transition-colors shadow-lg ${modalConfirm.tipo === 'alert' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'}`}>{modalConfirm.tipo === 'alert' ? 'Entendido' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 z-30 lg:hidden backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[min(18rem,86vw)] bg-sidebar text-sidebar-muted flex flex-col lg:shadow-none border-r border-sidebar-line transform transition-[transform,width] duration-300 ease-out lg:relative lg:translate-x-0 print:hidden ${sidebarColapsado ? 'lg:w-[76px]' : 'lg:w-64'} ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
        aria-label="Navegación principal"
      >
        <div className={`min-h-[64px] lg:h-[68px] shrink-0 flex items-center border-b border-sidebar-line pt-[env(safe-area-inset-top)] lg:pt-0 ${sidebarColapsado ? 'lg:justify-center px-4 lg:px-0' : 'px-4'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <img src={marcaGuerraFarm} alt="Guerra Farm" className="h-11 w-auto shrink-0" />
            <div className={`min-w-0 ${sidebarColapsado ? 'lg:hidden' : ''}`}>
              <p className="font-display text-[19px] font-bold text-sidebar-ink leading-none">Porcicontrol</p>
              <p className="text-[10px] font-semibold text-sidebar-muted mt-1 truncate">Guerra Farm</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="ml-auto lg:hidden p-2 rounded-lg text-sidebar-muted hover:text-sidebar-ink hover:bg-sidebar-active transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 flex flex-col gap-6 no-scrollbar">
          {SECCIONES_NAV.map(seccion => (
            <div key={seccion.titulo}>
              <p className={`px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-muted ${sidebarColapsado ? 'lg:hidden' : ''}`}>{seccion.titulo}</p>
              {sidebarColapsado && <div className="hidden lg:block mx-3 mb-2 border-t border-sidebar-line" />}
              <div className="space-y-1">
                {seccion.items.map(item => {
                  const activo = item.activoEn.includes(vista);
                  const badge = item.id === 'hoy' ? pendientesHoyCount : 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => irAVista(item.id)}
                      title={sidebarColapsado ? item.label : undefined}
                      aria-current={activo ? 'page' : undefined}
                      className={`group relative w-full flex items-center gap-3 rounded-xl text-[14px] font-semibold transition-colors duration-150 ${sidebarColapsado ? 'lg:justify-center lg:px-0 px-3 py-2.5' : 'px-3 py-2.5'} ${activo ? 'bg-sidebar-active text-sidebar-ink' : 'text-sidebar-muted hover:text-sidebar-ink hover:bg-sidebar-active'}`}
                    >
                      {activo && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-wheat" aria-hidden="true" />}
                      {React.createElement(item.icon, { size: 18, className: `shrink-0 ${activo ? 'text-sidebar-ink' : 'text-sidebar-muted group-hover:text-sidebar-ink'}` })}
                      <span className={`truncate ${sidebarColapsado ? 'lg:hidden' : ''}`}>{item.label}</span>
                      {badge > 0 && (
                        <span className={`bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center ${sidebarColapsado ? 'ml-auto lg:ml-0 lg:absolute lg:top-1 lg:right-2' : 'ml-auto'}`}>
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-sidebar-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
          {deferredInstallPrompt && (
            <button
              type="button"
              onClick={handleInstalarPwa}
              title="Instalar app en el teléfono"
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs bg-wheat hover:bg-cream text-forest-950 transition-colors ${sidebarColapsado ? 'lg:px-0' : 'px-3'}`}
            >
              <Smartphone size={16} /> <span className={sidebarColapsado ? 'lg:hidden' : ''}>Instalar app</span>
            </button>
          )}
          <div className={`flex items-center gap-2.5 rounded-xl p-2 bg-sidebar-active ${sidebarColapsado ? 'lg:flex-col lg:p-1.5' : ''}`}>
            <div className="w-8 h-8 shrink-0 rounded-lg bg-sidebar-active text-sidebar-ink font-bold text-sm flex items-center justify-center uppercase" title={user.email || 'Usuario'}>
              {(user.email || 'U').charAt(0)}
            </div>
            <div className={`min-w-0 flex-1 ${sidebarColapsado ? 'lg:hidden' : ''}`}>
              <p className="text-[10px] font-semibold text-sidebar-muted leading-none">Sesión iniciada</p>
              <p className="text-xs text-sidebar-ink font-semibold truncate mt-1">{user.email || 'Usuario de Google'}</p>
            </div>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="p-2 rounded-lg text-sidebar-muted hover:text-rose-300 hover:bg-rose-500/10 transition-colors shrink-0"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={alternarSidebarColapsado}
            className="hidden lg:flex w-full items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-semibold text-sidebar-muted hover:text-sidebar-ink hover:bg-sidebar-active transition-colors"
            title={sidebarColapsado ? 'Expandir menú' : 'Contraer menú'}
          >
            {sidebarColapsado ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} /> Contraer menú</>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1 flex flex-col h-dvh overflow-hidden">
        <header className="bg-surface border-b border-slate-200/70 px-3 sm:px-5 lg:px-8 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 lg:py-0 lg:h-[68px] flex gap-2 items-center justify-between relative z-20 shrink-0 print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            {vistaPadre ? (
              <button
                type="button"
                onClick={volverAVistaPadre}
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                aria-label={`Volver a ${TITULOS_VISTA[vistaPadre]?.label || 'atrás'}`}
                title={`Volver a ${TITULOS_VISTA[vistaPadre]?.label || 'atrás'}`}
              >
                <ArrowLeft size={20} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                aria-label="Abrir menú"
              >
                <Menu size={20} />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="lg:hidden text-[17px] font-bold text-slate-900 truncate leading-tight">{tituloVistaActual.label}</h1>
              <nav aria-label="Ruta" className="hidden lg:flex items-center gap-1.5 text-sm min-w-0">
                <span className="text-slate-400 font-medium">Porcicontrol</span>
                {vistaPadre && (
                  <>
                    <ChevronRight size={14} className="text-slate-300" />
                    <button type="button" onClick={volverAVistaPadre} className="text-slate-500 hover:text-emerald-700 font-medium transition-colors truncate">
                      {vistaPadre === 'corralDetail' ? (corralSeleccionado?.nombre || 'Corral') : TITULOS_VISTA[vistaPadre]?.label}
                    </button>
                  </>
                )}
                <ChevronRight size={14} className="text-slate-300" />
                <span className="font-semibold text-slate-900 flex items-center gap-1.5 truncate">
                  {React.createElement(tituloVistaActual.icon, { size: 16, className: 'shrink-0 text-emerald-600' })}
                  {tituloVistaActual.label}
                </span>
              </nav>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden 2xl:block text-xs font-semibold text-slate-400 capitalize mr-1">
              {new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            {/* INDICADOR DE SEÑAL Y COLA OFFLINE DE GALPÓN */}
            <button
              type="button"
              onClick={() => {
                if (offlineStatus.enLinea && offlineStatus.pendientesCount > 0) {
                  offlineStatus.sincronizarAhora();
                } else if (!offlineStatus.enLinea) {
                  mostrarAlerta(
                    'Modo Galpón Sin Señal',
                    offlineStatus.pendientesCount > 0
                      ? `Tienes ${offlineStatus.pendientesCount} registro(s) guardados de forma segura en este teléfono. Se subirán solos a la nube apenas vuelvas a tener señal.`
                      : 'Estás sin señal, pero puedes seguir registrando alimento, pesos, bajas o ventas. Todo se guardará en el teléfono y sincronizará al volver la red.'
                  );
                }
              }}
              className={`h-9 px-2.5 rounded-full text-[11px] font-bold border flex items-center gap-1.5 transition-colors ${
                !offlineStatus.enLinea
                  ? 'bg-amber-100 border-amber-300 text-amber-950'
                  : offlineStatus.sincronizando
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : offlineStatus.pendientesCount > 0
                      ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                      : 'bg-white border-slate-200 text-slate-600'
              }`}
              title={
                !offlineStatus.enLinea
                  ? 'Sin conexión — guardando datos localmente en el dispositivo'
                  : offlineStatus.pendientesCount > 0
                    ? 'Toca para sincronizar cambios pendientes ahora'
                    : 'Conectado y sincronizado en tiempo real'
              }
            >
              {!offlineStatus.enLinea ? (
                <>
                  <WifiOff size={14} className="text-amber-700 shrink-0" />
                  <span>
                    Sin señal{offlineStatus.pendientesCount > 0 ? ` · ${offlineStatus.pendientesCount}` : ''}
                  </span>
                </>
              ) : offlineStatus.sincronizando ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-blue-600 shrink-0" />
                  <span className="hidden sm:inline">Sincronizando...</span>
                </>
              ) : offlineStatus.pendientesCount > 0 ? (
                <>
                  <RefreshCw size={14} className="text-amber-600 shrink-0" />
                  <span>Subir ({offlineStatus.pendientesCount})</span>
                </>
              ) : (
                <>
                  <span className="relative hidden sm:flex w-2 h-2 shrink-0" aria-hidden="true">
                    <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-60 animate-ping"></span>
                    <span className="relative w-2 h-2 rounded-full bg-emerald-500"></span>
                  </span>
                  <span className="hidden sm:inline">En línea</span>
                  <Wifi size={14} className="text-emerald-600 shrink-0 sm:hidden" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => abrirModalQrTolva(corralSeleccionado || null, 'escanear')}
              className="hidden lg:flex h-9 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold px-3.5 rounded-full text-xs items-center gap-2 transition-colors"
              title="Escanear código QR de corral para descontar concentrado en tolva"
            >
              <QrCode size={15} className="text-emerald-400" />
              <span>Escanear tolva</span>
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative bg-slate-50 pb-24 lg:pb-10 overscroll-contain">
          {vista === 'hoy' && renderHoy()}
          {vista === 'dashboard' && renderDashboard()}
          {vista === 'bodega' && renderBodega()}
          {vista === 'calendario' && renderCalendario()}
          {vista === 'laboratorio' && renderLaboratorio()}
          {vista === 'historial' && renderHistorial()}
          {vista === 'config' && renderConfiguracion()}
          {(vista === 'corralDetail' || vista === 'corral') && renderCorralDetail()}
          {vista === 'prepararVenta' && renderPrepararVenta()}
          {vista === 'resumenVenta' && renderResumenVenta()}
          {vista === 'imprimirFicha' && renderFichaCorral()}
          {vista === 'reporteHistorial' && renderReporteHistorial()}
          {vista === 'finanzasGlobales' && renderFinanzasGlobales()}
        </div>

        {/* BARRA DE NAVEGACIÓN INFERIOR PARA PULGAR EN MÓVIL (MODO CAMPO) */}
        <nav
          aria-label="Navegación rápida móvil"
          className="lg:hidden print:hidden bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-1.5 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] grid grid-cols-5 items-end z-30 shrink-0"
        >
          {[
            { id: 'hoy', icon: CheckCircle, label: 'Hoy', activoEn: ['hoy'], badge: pendientesHoyCount },
            { id: 'dashboard', icon: LayoutDashboard, label: 'Corrales', activoEn: ['dashboard', 'corralDetail', 'corral', 'prepararVenta', 'resumenVenta', 'imprimirFicha'] },
            null,
            { id: 'bodega', icon: Archive, label: 'Bodega', activoEn: ['bodega'] },
          ].map((item, idx) => item ? (
            <button
              key={item.id}
              type="button"
              onClick={() => irAVista(item.id)}
              aria-current={item.activoEn.includes(vista) ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 py-1 transition-colors ${item.activoEn.includes(vista) ? 'text-emerald-700' : 'text-slate-500'}`}
            >
              <span className={`relative flex items-center justify-center w-14 h-8 rounded-full transition-colors ${item.activoEn.includes(vista) ? 'bg-emerald-100' : ''}`}>
                {React.createElement(item.icon, { size: 20, strokeWidth: item.activoEn.includes(vista) ? 2.4 : 2 })}
                {item.badge > 0 && (
                  <span className="absolute -top-0.5 right-2 bg-rose-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center ring-2 ring-white">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className={`text-[11px] leading-none ${item.activoEn.includes(vista) ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </button>
          ) : (
            <button
              key={`qr-${idx}`}
              type="button"
              onClick={() => abrirModalQrTolva(corralSeleccionado || null, 'escanear')}
              className="flex flex-col items-center justify-center gap-1 -mt-5"
              aria-label="Escanear QR de tolva"
            >
              <span className="w-14 h-14 rounded-2xl bg-slate-900 active:bg-emerald-700 text-emerald-400 shadow-lg shadow-slate-900/30 ring-4 ring-white flex items-center justify-center transition-transform active:scale-95">
                <QrCode size={24} />
              </span>
              <span className="text-[11px] font-bold text-slate-800 leading-none">Tolva QR</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors ${isSidebarOpen || ['calendario', 'finanzasGlobales', 'historial', 'config', 'reporteHistorial', 'laboratorio'].includes(vista) ? 'text-emerald-700' : 'text-slate-500'}`}
          >
            <span className={`flex items-center justify-center w-14 h-8 rounded-full transition-colors ${['calendario', 'finanzasGlobales', 'historial', 'config', 'reporteHistorial', 'laboratorio'].includes(vista) ? 'bg-emerald-100' : ''}`}>
              <Menu size={20} />
            </span>
            <span className="text-[11px] font-medium leading-none">Más</span>
          </button>
        </nav>
        {/* CHATBOT FLOTANTE IA */}
        <div className={`fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-3 lg:bottom-6 sm:right-6 lg:right-8 z-40 flex flex-col items-end print:hidden ${vista === 'prepararVenta' && !isChatOpen ? 'max-lg:hidden' : ''}`}>
          {/* Ventana del Chat */}
          {isChatOpen && (
            <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800/80 rounded-2xl sm:rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-[calc(100vw-1.5rem)] sm:w-96 h-[min(620px,78dvh)] sm:h-[500px] max-h-[82dvh] mb-3 sm:mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
              {/* Header */}
              <div className="bg-slate-950/40 p-4 border-b border-slate-800/80 flex justify-between items-center text-white shrink-0">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="animate-pulse text-emerald-400" />
                  <span className="font-bold text-sm tracking-wide">Asistente de Granja</span>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="hover:bg-slate-800/80 p-1.5 rounded-xl transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Mensajes */}
              <div className="flex-1 p-4 overflow-y-auto bg-slate-950/20 flex flex-col gap-3 scrollbar-thin">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-slate-500 text-xs mt-12 px-6">
                    <Activity size={28} className="mx-auto text-emerald-500/40 mb-3" />
                    <p className="font-semibold leading-relaxed">¡Hola! Conozco tu inventario, lotes activos y datos históricos. ¿Qué deseas consultar hoy?</p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`p-3.5 rounded-2xl max-w-[85%] shrink-0 text-xs leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-emerald-500 text-slate-950 self-end rounded-tr-none font-semibold' : 'bg-slate-900 border border-slate-800/50 text-slate-200 self-start rounded-tl-none'}`}>
                      {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <ReactMarkdown 
                          components={{
                            strong: ({node: _node, ...props}) => <strong className="font-bold text-emerald-400" {...props} />,
                            ul: ({node: _node, ...props}) => <ul className="list-disc pl-4 my-2 text-slate-300" {...props} />,
                            ol: ({node: _node, ...props}) => <ol className="list-decimal pl-4 my-2 text-slate-300" {...props} />,
                            li: ({node: _node, ...props}) => <li className="mb-1" {...props} />,
                            h1: ({node: _node, ...props}) => <h1 className="text-lg font-bold my-2 text-white" {...props} />,
                            h2: ({node: _node, ...props}) => <h2 className="text-md font-bold my-2 text-white" {...props} />,
                            h3: ({node: _node, ...props}) => <h3 className="text-sm font-bold my-1 text-white" {...props} />,
                            p: ({node: _node, ...props}) => <p className="mb-1.5" {...props} />
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="bg-slate-900 border border-slate-800/50 text-slate-500 self-start rounded-2xl rounded-tl-none shadow-sm p-3 px-4 flex gap-1.5 items-center">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                    placeholder="Escribe tu pregunta..."
                    className="flex-1 border border-slate-800 rounded-xl px-3 py-2 bg-slate-900/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                  />
                  <button
                    onClick={handleSendChatMessage}
                    disabled={isChatLoading || !chatInput.trim()}
                    className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 text-slate-950 p-2 rounded-xl transition-all duration-200"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Botón Flotante */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            aria-label={isChatOpen ? 'Cerrar asistente' : 'Abrir asistente de granja'}
            className={`${isChatOpen ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-600/30'} p-3.5 sm:p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-slate-800/20 flex items-center justify-center`}
          >
            {isChatOpen ? <X size={24} /> : <Activity size={24} className="animate-pulse" />}
          </button>
        </div>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      console.error("Error de autenticación:", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setAuthError('Correo o contraseña incorrectos.');
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError('Este correo ya está registrado.');
      } else if (error.code === 'auth/weak-password') {
        setAuthError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setAuthError('Ocurrió un error. Verifica tus datos e intenta de nuevo.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error con Google Auth:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setAuthError('Cancelaste el inicio de sesión con Google.');
      } else if (error.code === 'auth/unauthorized-domain') {
        setAuthError('Este dominio no está autorizado. Agrega localhost en Firebase Authentication → Settings → Authorized domains.');
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthError('El proveedor Google no está habilitado en Firebase Authentication.');
      } else if (error.code === 'auth/popup-blocked') {
        setAuthError('El navegador bloqueó la ventana de Google. Permite ventanas emergentes para este sitio.');
      } else {
        setAuthError(`Error al conectar con Google (${error.code || 'desconocido'}).`);
      }
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-sidebar text-sidebar-ink">
        <img src={marcaGuerraFarm} alt="Guerra Farm" className="h-24 w-auto mb-6" />
        <h2 className="text-2xl font-bold">Cargando Porcicontrol...</h2>
      </div>
    );
  }

  // SI NO HAY USUARIO, MOSTRAMOS LA PANTALLA DE LOGIN HÍBRIDA (DISEÑO PREMIUM GLOW)
  if (!user) {
    return (
      <div className="min-h-dvh w-full flex items-center justify-center bg-sidebar p-3 sm:p-4 font-sans text-slate-100 relative overflow-hidden">

        <div className="max-w-md w-full bg-slate-900 border border-sidebar-line rounded-2xl sm:rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-500">
          <div className="p-5 sm:p-8 text-center border-b border-sidebar-line bg-sidebar relative">
            <div className="relative z-10 flex flex-col items-center">
              <img src={marcaGuerraFarm} alt="Guerra Farm" className="h-20 w-auto mb-4" />
              <h1 className="text-3xl font-extrabold tracking-tight text-sidebar-ink leading-none">Porcicontrol</h1>
              <p className="text-xs font-bold uppercase tracking-widest text-wheat mt-2">Guerra Farm</p>
            </div>
          </div>

          <div className="p-5 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-300 mb-6 text-center">
              {isRegistering ? 'Crear una cuenta nueva' : 'Identifícate para continuar'}
            </h2>

            {authError && (
              <div className="bg-rose-950/30 text-rose-400 p-4 rounded-2xl text-sm font-semibold flex items-center mb-6 border border-rose-900/50 animate-in shake duration-200">
                <AlertTriangle size={18} className="mr-2.5 shrink-0" />
                {authError}
              </div>
            )}

            {/* Formulario de Correo / Contraseña */}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Correo Electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="tu@correo.com"
                  className="w-full p-3.5 border border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 bg-slate-950/60 text-white placeholder-slate-600 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full p-3.5 border border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 bg-slate-950/60 text-white placeholder-slate-600 transition-all"
                />
              </div>

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-emerald-500/10 transition-all transform hover:-translate-y-0.5 duration-200 mt-2">
                {isRegistering ? 'Registrarme' : 'Entrar con Correo'}
              </button>
            </form>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
                className="text-slate-400 text-sm font-semibold hover:text-emerald-400 transition-colors"
              >
                {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
              </button>
            </div>

            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-slate-800"></div>
              <span className="px-3 text-xs font-bold text-slate-500 uppercase tracking-widest">O</span>
              <div className="flex-1 border-t border-slate-800"></div>
            </div>

            {/* Botón de Google */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full bg-slate-950 hover:bg-slate-900 text-slate-300 font-bold py-3.5 px-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-center gap-3 shadow-md"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continuar con Google
            </button>

          </div>
        </div>
      </div>
    );
  }

  // SI EL USUARIO ESTÁ AUTENTICADO, CARGAMOS EL ERP
  return <Porcicontrol user={user} db={db} appId={globalAppId} />;
}

export default App;
