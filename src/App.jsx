import React, { useState, useMemo, useEffect } from 'react';
import {
  Settings, Plus, Activity, Syringe, Wheat, Scale, Calendar, Users,
  ChevronRight, ClipboardList, CheckCircle, Trash2, TrendingUp, PiggyBank,
  AlertTriangle, HeartPulse, Receipt, PieChart, Calculator, Leaf, Printer, X, Clock,
  Archive, Box, LayoutDashboard, DollarSign, BookOpen, AlertCircle,
  CheckSquare, Beaker, ShoppingCart, FileText, Download, LogOut, Menu
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { calculateLotStatistics } from './domain/lotStatistics.js';

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
import { getFirestore, doc, onSnapshot, enableIndexedDbPersistence, runTransaction } from 'firebase/firestore';
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

// Inicializar Firebase y Proveedores
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const cloudFunctions = getFunctions(app);

if (import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
}

// --- ACTIVAR MODO OFFLINE DE FIREBASE (BÓVEDA LOCAL) ---
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.log('El modo offline solo funciona si tienes una sola pestaña abierta.');
  } else if (err.code === 'unimplemented') {
    console.log('Este navegador no soporta almacenamiento offline.');
  }
});


const googleProvider = new GoogleAuthProvider();
const globalAppId = typeof __app_id !== 'undefined' ? __app_id : 'agrocontrol-local';

// --- NUEVO HOOK: BASE DE DATOS EN LA NUBE ---
// Reemplaza a useLocalStorage. Escucha y guarda datos directo en Google Firebase.
function useCloudStorage(key, initialValue, user, dbInstance, appId) {
  const initialValueRef = React.useRef(initialValue);
  const [state, setStateInternal] = useState(() => initialValueRef.current);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!user || !dbInstance || !appId) {
      setIsLoaded(true);
      return;
    }

    // RUTA COMPARTIDA: Tú y tu papá miran a la misma carpeta
    const docRef = doc(dbInstance, 'artifacts', appId, 'public', 'data', 'granja_compartida', key);

    // onSnapshot escucha los cambios en tiempo real. Si actualizas en tu celular, se refleja aquí.
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data().data;
        if (Array.isArray(initialValueRef.current) && !Array.isArray(data)) {
          setStateInternal(initialValueRef.current);
        } else {
          setStateInternal(data !== undefined ? data : initialValueRef.current);
        }
      } else {
        setStateInternal(initialValueRef.current);
      }
      setIsLoaded(true);
    }, (error) => {
      console.error("Error conectando a la base de datos:", key, error);
      setIsLoaded(true);
    });

    return () => unsubscribe();
  }, [key, user, dbInstance, appId]);

  const setValue = async (value) => {
    const previous = state;
    const optimisticNext = value instanceof Function ? value(state) : value;
    setStateInternal(optimisticNext);

    if (!user || !dbInstance || !appId) {
      return optimisticNext;
    }

    const docRef = doc(dbInstance, 'artifacts', appId, 'public', 'data', 'granja_compartida', key);
    try {
      const next = await runTransaction(dbInstance, async (transaction) => {
        const snapshot = await transaction.get(docRef);
      const remoteValue = snapshot.exists() ? snapshot.data().data : initialValueRef.current;
        const valueToStore = value instanceof Function ? value(remoteValue) : value;
        transaction.set(docRef, { data: valueToStore, updatedAt: Date.now(), updatedBy: user.uid });
        return valueToStore;
      });
      setStateInternal(next);
      return next;
    } catch (error) {
      console.error("Error guardando en la nube:", key, error);
      setStateInternal(previous);
      throw error;
    }
  };

  return [state, setValue, isLoaded];
}

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
    id: 'ps1',
    dia: 0,
    rango: 'Día 0',
    tarea: 'Agua con electrolitos',
    tipo: 'Hidratación',
    producto: 'Electrolitos orales para cerdos',
    productoMedicoId: 'med1',
    duracion: '12-24 horas',
    condicion: 'Especialmente si llegan acalorados, débiles, recién destetados, con viaje largo, orejas caídas, ojos hundidos o poca actividad.',
    nota: 'No extender más de 48 horas; después priorizar agua normal, alimento fresco y observación.'
  },
  {
    id: 'ps2',
    dia: 1,
    rango: 'Día 1-3',
    tarea: 'Multivitamínico oral en agua',
    tipo: 'Adaptación',
    producto: 'Complejo B, vitaminas A, D3, E y C; aminoácidos si el producto los incluye',
    productoMedicoId: 'med2',
    duracion: '3 días seguidos',
    condicion: 'Útil en estrés, bajo consumo y adaptación.',
    nota: 'Las vitaminas son apoyo; el crecimiento depende de alimento, agua y manejo.'
  },
  {
    id: 'ps3',
    dia: 4,
    rango: 'Día 4-6',
    tarea: 'Observación sin medicar si el lote está estable',
    tipo: 'Observación',
    producto: 'Agua normal y alimento fresco',
    duracion: '3 días',
    condicion: 'Revisar consumo, diarrea, tos, retrasados, frío, flacos o decaídos.',
    nota: 'Evitar desparasitar el mismo día de llegada salvo parásitos externos evidentes.'
  },
  {
    id: 'ps4',
    dia: 7,
    rango: 'Día 7-10',
    tarea: 'Primera desparasitación',
    tipo: 'Desparasitación',
    producto: 'Fenbendazol si solo buscas control interno; ivermectina/doramectina si hay sarna, piojos o comezón.',
    productoMedicoId: 'med3',
    duracion: 'Según etiqueta del producto',
    condicion: 'Elegir producto según signos, peso y condición del lote.',
    nota: 'En lechones pequeños, pesar o estimar bien para evitar subdosificación o sobredosificación.'
  },
  {
    id: 'ps5',
    dia: 14,
    rango: 'Día 14-21',
    tarea: 'Revisión clínica del lote',
    tipo: 'Revisión',
    producto: 'Sin producto obligatorio',
    duracion: '1 revisión',
    condicion: 'Buscar diarrea, tos, retrasados, condición corporal, pelo áspero o bajo consumo.',
    nota: 'Registrar hallazgos y consultar veterinario si hay signos persistentes.'
  },
  {
    id: 'ps6',
    dia: 28,
    rango: 'Día 28-35',
    tarea: 'Segunda desparasitación condicional',
    tipo: 'Condicional',
    producto: 'Según producto usado y recomendación veterinaria',
    productoMedicoId: 'med3',
    duracion: 'Según etiqueta del producto',
    condicion: 'Aplicar si hay piso de tierra, humedad, historial desconocido, signos clínicos, mala conversión o presión parasitaria alta.',
    nota: 'En corrales limpios de cemento puede omitirse si no hay signos o recomendación veterinaria.'
  },
];

const INITIAL_RUTINA_DIARIA = [
  'Revisar agua y presión de bebederos',
  'Revisar comederos y consumo',
  'Observar diarrea',
  'Observar tos o dificultad respiratoria',
  'Detectar animales retrasados, flacos o decaídos',
  'Revisar amontonamiento por frío o calor',
  'Retirar alimento viejo o húmedo',
  'Revisar limpieza de pasillos y corrales',
  'Confirmar que no haya bajas',
  'Registrar observaciones sanitarias del día'
];

const addDaysToDate = (dateStr, days) => {
  const result = new Date(dateStr + 'T00:00:00');
  result.setDate(result.getDate() + days);
  return result.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });
};

const addDaysToIsoDate = (dateStr, days) => {
  const result = new Date(`${dateStr}T00:00:00`);
  result.setDate(result.getDate() + days);
  return result.toISOString().split('T')[0];
};

const safeArr = (val, fallback = []) => Array.isArray(val) ? val : fallback;
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
  const [protocoloSanitarioBase, setProtocoloSanitarioBase, l6] = useCloudStorage('agro_protocolosanitario', INITIAL_PROTOCOLO_SANITARIO, user, db, appId);

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
  const [rutinaDiaria, setRutinaDiaria, l19] = useCloudStorage('agro_rutina_diaria', [], user, db, appId);
  const [catalogoMedico, setCatalogoMedico, l20] = useCloudStorage('agro_catalogo_medico', INITIAL_CATALOGO_MEDICO, user, db, appId);
  const [comprasMedicas, setComprasMedicas, l21] = useCloudStorage('agro_compras_medicas', [], user, db, appId);
  const [usosMedicos, setUsosMedicos, l22] = useCloudStorage('agro_usos_medicos', [], user, db, appId);

  // PANTALLA DE CARGA MIENTRAS SE CONECTA A FIREBASE
  const isAppReady = l1 && l2 && l3 && l4 && l5 && l6 && l7 && l8 && l9 && l10 && l11 && l12 && l13 && l14 && l15 && l16 && l17 && l18 && l19 && l20 && l21 && l22;

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
  const listProtocoloSanitario = safeArr(protocoloSanitarioBase, INITIAL_PROTOCOLO_SANITARIO);
  const listTareasSanidad = safeArr(tareasSanidad);
  const listRutinaDiaria = safeArr(rutinaDiaria);
  const listCatalogoMedico = safeArr(catalogoMedico, INITIAL_CATALOGO_MEDICO);
  const listComprasMedicas = safeArr(comprasMedicas);
  const listUsosMedicos = safeArr(usosMedicos);

  const runFarmUpdates = async (updates) => {
    const entries = Object.entries(updates);
    await runTransaction(db, async (transaction) => {
      const snapshots = await Promise.all(entries.map(([key]) => {
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'granja_compartida', key);
        return transaction.get(ref).then(snapshot => ({ key, ref, snapshot }));
      }));

      snapshots.forEach(({ key, ref, snapshot }) => {
        const current = snapshot.exists() ? snapshot.data().data : [];
        transaction.set(ref, {
          data: updates[key](current),
          updatedAt: Date.now(),
          updatedBy: user.uid
        });
      });
    });
  };

  // --- NAVEGACIÓN Y PANTALLAS ---
  const [vista, setVista] = useState('dashboard');
  const [corralSeleccionado, setCorralSeleccionado] = useState(null);
  const [finanzasLoteAbierto, setFinanzasLoteAbierto] = useState(null);
  const [loteHistorialSeleccionado, setLoteHistorialSeleccionado] = useState(null);
  const [tabActiva, setTabActiva] = useState('resumen');
  const [sanidadTab, setSanidadTab] = useState('agenda');
  const [sanidadFiltro, setSanidadFiltro] = useState('hoy');
  const [agendaDetalleAbierto, setAgendaDetalleAbierto] = useState(null);
  const [medicinaSeleccionadaId, setMedicinaSeleccionadaId] = useState(INITIAL_CATALOGO_MEDICO[0]?.id || '');
  const [rutinaTab, setRutinaTab] = useState('corrales');
  const [corralesRutinaAbiertos, setCorralesRutinaAbiertos] = useState({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- ESTADOS VENTA Y FINANZAS ---
  const [ventaPesos, setVentaPesos] = useState([]);
  const [ventaPrecio, setVentaPrecio] = useState(0);
  const [pesoInputVenta, setPesoInputVenta] = useState('');
  const [tipoReporteImpresion, setTipoReporteImpresion] = useState('interno');
  const [simuladorMuertesExtra, setSimuladorMuertesExtra] = useState(0);

  // --- ESTADOS BODEGA & PUROS ---
  const [modalConfirm, setModalConfirm] = useState({ visible: false, tipo: 'confirm', titulo: '', mensaje: '', onConfirm: null });
  const [bodegaCategoria, setBodegaCategoria] = useState('concentrado');
  const [puroInput, setPuroInput] = useState({ tipo: '', cantidad: '', unidad: 'sacos' });

  // --- ESTADOS ALIMENTACIÓN ---
  const [tipoRegistroAlimento, setTipoRegistroAlimento] = useState('tolva');
  const [suplementoItems, setSuplementoItems] = useState([{ id: Date.now(), tipo: '', libras: '' }]);

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

  // --- ESTADOS SISTEMA DUAL DE PESAJE ---
  const [expandirSchaeffer, setExpandirSchaeffer] = useState(false);
  const [circunferenciaCm, setCircunferenciaCm] = useState('');
  const [longitudCm, setLongitudCm] = useState('');
  const [pesoSchaefferCalculado, setPesoSchaefferCalculado] = useState(null);
  const [guardandoPeso, setGuardandoPeso] = useState(false);
  const [pesoIngresado, setPesoIngresado] = useState('');
  const [fechaPesaje, setFechaPesaje] = useState(new Date().toISOString().split('T')[0]);

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

  // Cálculo en tiempo real: Fórmula de Schaeffer
  useEffect(() => {
    if (circunferenciaCm && longitudCm) {
      const G = parseFloat(circunferenciaCm) * 0.393701;
      const L = parseFloat(longitudCm) * 0.393701;
      const constante = parseFloat(constanteSchaeffer) || 400;
      const peso = (Math.pow(G, 2) * L) / constante;
      const pesoRedondeado = parseFloat(peso.toFixed(2));
      setPesoSchaefferCalculado(isNaN(pesoRedondeado) || pesoRedondeado <= 0 ? null : pesoRedondeado);
    } else {
      setPesoSchaefferCalculado(null);
    }
  }, [circunferenciaCm, longitudCm, constanteSchaeffer]);

  // --- FUNCIONES AUXILIARES ---
  const formatearMoneda = (v) => new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(v || 0);
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
      const ventasLote = listVentas.filter(v => v.loteId === lote.id).sort(byDateDesc);
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
      const puntoEquilibrioLb = (stats.librasVendidas + (stats.pesoActual * stats.cantidadActual)) > 0
        ? costoTotal / (stats.librasVendidas + (stats.pesoActual * stats.cantidadActual))
        : 0;

      return {
        loteId: lote.id,
        corral: corral?.nombre || 'Corral no encontrado',
        estado: lote.estado || 'Activo',
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
          pesoActualPromedioLb: round(stats.pesoActual, 1),
          librasVendidasBascula: round(stats.librasVendidas, 1),
          pesoProducidoParaFcaGmdLb: round(stats.pesoProducidoLb, 1),
          animalDias: round(stats.animalDias, 1),
          gmdLbDia: round(stats.adg, 3),
          fca: round(stats.fca, 3),
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

    const ventasRecientes = latest(listVentas, 10).map(v => {
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
      if (lote.pesosYProduccion.fca > 3) alertas.push({ severidad: 'alta', tipo: 'FCA alto', corral: lote.corral, detalle: `FCA ${lote.pesosYProduccion.fca}` });
      if (lote.animales.mortalidadPorcentaje > 5) alertas.push({ severidad: 'alta', tipo: 'Mortalidad alta', corral: lote.corral, detalle: `${lote.animales.mortalidadPorcentaje}%` });
      if (lote.finanzas.utilidadNetaRealMasEstimada < 0) alertas.push({ severidad: 'media', tipo: 'Utilidad negativa', corral: lote.corral, detalle: formatearMoneda(lote.finanzas.utilidadNetaRealMasEstimada) });
      if (lote.pesosYProduccion.pesoActualPromedioLb >= lote.proyecciones.pesoObjetivoLb) alertas.push({ severidad: 'media', tipo: 'Listo para venta', corral: lote.corral, detalle: `${lote.pesosYProduccion.pesoActualPromedioLb} lb promedio` });
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

  // Función async para guardar peso(puedes ver la estructura en la imagen)
  const guardarPesoEnNube = async (pesoLb, fecha, metodo) => {
    try {
      setGuardandoPeso(true);
      const lote = getLoteActivo(corralSeleccionado?.id);

      if (!lote) {
        mostrarAlerta('Error', 'No hay lote activo en este corral');
        setGuardandoPeso(false);
        return false;
      }

      const nuevoPeso = {
        id: `p_${Date.now()}`,
        loteId: lote.id,
        fecha: fecha,
        pesoPromedio: parseFloat(pesoLb),
        metodo: metodo
      };

      await new Promise(resolve => setTimeout(resolve, 300));
      await setPesos(prev => [...safeArr(prev), nuevoPeso]);
      emitirNotificacionPush({
        tipo: 'peso',
        titulo: 'Peso registrado',
        descripcion: `${parseFloat(pesoLb).toFixed(2)} lb promedio · ${metodo}`,
        corralId: corralSeleccionado?.id || lote.corralId || '',
        corralNombre: corralSeleccionado?.nombre || listCorrales.find(c => c.id === lote.corralId)?.nombre || 'Corral',
        loteId: lote.id,
        loteNombre: lote.nombre || lote.raza || 'Lote activo',
        entidad: { tipo: 'peso', id: nuevoPeso.id }
      });
      mostrarAlerta('Éxito', `Peso registrado: ${parseFloat(pesoLb).toFixed(2)} lb (${metodo})`, 'success');
      setGuardandoPeso(false);
      return true;
    } catch (error) {
      console.error('Error guardando peso:', error);
      mostrarAlerta('Error', 'No se pudo guardar el peso');
      setGuardandoPeso(false);
      return false;
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
      setFechaPesaje(new Date().toISOString().split('T')[0]);
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
      setFechaPesaje(new Date().toISOString().split('T')[0]);
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
    const opt = { margin: 0.4, filename: nombreArchivo, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
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
      const hoy = new Date(`${new Date().toISOString().split('T')[0]}T00:00:00`);
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

  const ordenCompraLista = useMemo(() => {
    const necesidadesGlobales = new Map();

    listLotes.filter(l => l.estado === 'Activo').forEach(lote => {
      const stats = calculateLotStatistics({
        lot: lote,
        deaths: listBajas,
        feedings: listAlimentos,
        sales: listVentas,
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
  }, [listLotes, listBajas, listAlimentos, listVentas, listPesos, listVacunas, listGastosExtra, inventarioCentral, listFormulas, listCatAlimentos, listCatIngredientes, pesoAlertaMezcla]);

  // --- ESTADÍSTICAS DEL LOTE ---
  function calcularEstadisticasLote(lote, muertesExtraHipoteticas = 0) {
    return calculateLotStatistics({
      lot: lote,
      deaths: listBajas,
      feedings: listAlimentos,
      sales: listVentas,
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

  const handleRegistrarTratamientoManual = (e) => {
    e.preventDefault();
    const loteActivo = getLoteActivo(corralSeleccionado?.id);
    if (!loteActivo) return mostrarAlerta('Error', 'No hay lote activo para registrar el tratamiento.');

    const fd = new FormData(e.target);
    const tratamientoId = crypto.randomUUID();
    const nombre = fd.get('nombre').trim();
    const costo = parseFloat(fd.get('costo')) || 0;
    setVacunas(prev => [...safeArr(prev), {
      id: tratamientoId,
      loteId: loteActivo.id,
      fecha: fd.get('fecha'),
      nombre,
      costo
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
    setTareasSanidad(prev => safeArr(prev).map(t => {
      if (t.id !== id) return t;
      const nextEstado = updates.estado || t.estado || 'pendiente';
      return {
        ...t,
        ...updates,
        completadoEn: nextEstado === 'hecho' ? (t.completadoEn || new Date().toISOString().split('T')[0]) : null
      };
    }));
  };

  const handleAgregarPasoProtocolo = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const dia = parseInt(fd.get('dia'), 10);
    if (Number.isNaN(dia) || dia < 0) return mostrarAlerta('Error', 'El día del protocolo debe ser 0 o mayor.');

    const nuevoPaso = {
      id: crypto.randomUUID(),
      dia,
      rango: fd.get('rango').trim() || `Día ${dia}`,
      tarea: fd.get('tarea').trim(),
      tipo: fd.get('tipo').trim() || 'Sanidad',
      producto: fd.get('producto').trim(),
      productoMedicoId: fd.get('productoMedicoId') || '',
      duracion: fd.get('duracion').trim(),
      condicion: fd.get('condicion').trim(),
      nota: fd.get('nota').trim()
    };

    setProtocoloSanitarioBase(prev => [...safeArr(prev), nuevoPaso].sort((a, b) => (Number(a.dia) || 0) - (Number(b.dia) || 0)));
    e.target.reset();
    mostrarAlerta('Paso agregado', 'El protocolo base se actualizó. Los lotes nuevos heredarán este paso.');
  };

  const handleEliminarPasoProtocolo = (id) => {
    pedirConfirmacion('Eliminar paso del protocolo', 'Esto no borra tareas ya creadas en lotes activos; solo afecta lotes nuevos.', () => {
      setProtocoloSanitarioBase(prev => safeArr(prev).filter(p => p.id !== id));
    });
  };

  const buildTareasProtocoloParaLote = (lote) => listProtocoloSanitario.map((t) => ({
    id: crypto.randomUUID(),
    protocoloId: t.id,
    loteId: lote.id,
    dia: Number(t.dia) || 0,
    fechaObjetivo: addDaysToIsoDate(lote.fechaIngreso, Number(t.dia) || 0),
    rango: t.rango || `Día ${t.dia}`,
    tarea: t.tarea,
    tipo: t.tipo || 'Sanidad',
    producto: t.producto || '',
    productoMedicoId: t.productoMedicoId || '',
    duracion: t.duracion || '',
    condicion: t.condicion || '',
    nota: t.nota || '',
    estado: 'pendiente',
    observacion: '',
    completadoEn: null
  }));

  const handleGenerarProtocoloLote = (lote) => {
    if (!lote) return;
    setTareasSanidad(prev => [...safeArr(prev).filter(t => t.loteId !== lote.id), ...buildTareasProtocoloParaLote(lote)]);
    mostrarAlerta('Protocolo generado', 'Se creó el calendario sanitario para este lote.');
  };

  const todayIso = () => new Date().toISOString().split('T')[0];

  const handleAgregarRutinaExtra = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const item = fd.get('item').trim();
    if (!item) return;
    setRutinaDiaria(prev => [...safeArr(prev), {
      id: crypto.randomUUID(),
      fecha: todayIso(),
      item,
      extra: true,
      estado: 'pendiente',
      observacion: '',
      corralId: fd.get('corralId') || '',
      updatedAt: Date.now()
    }]);
    e.target.reset();
  };

  const RUTINA_CORRAL_ITEMS = [
    'Revisar agua y bebederos',
    'Revisar comederos y consumo',
    'Revisar limpieza del corral',
    'Observar comportamiento general',
    'Verificar ausencia de diarrea',
    'Verificar ausencia de tos',
    'Detectar animales retrasados',
    'Confirmar que no haya bajas'
  ];

  const RUTINA_GENERAL_ITEMS = [
    'Limpieza general de pasillos',
    'Revisar bodega central',
    'Revisar bodega médica',
    'Revisar basura y desechos',
    'Revisar herramientas y equipos',
    'Revisar puertas, candados y seguridad',
    'Revisar agua general de la granja',
    'Registrar observaciones generales'
  ];

  const getRutinaCorralDelDia = (corralId, fecha = todayIso()) => {
    return RUTINA_CORRAL_ITEMS.map(item => {
      const saved = listRutinaDiaria.find(r => r.fecha === fecha && r.corralId === corralId && r.item === item);
      return {
        id: saved?.id || `${fecha}_${corralId}_${item}`,
        fecha,
        corralId,
        item,
        estado: saved?.estado || 'pendiente',
        observacion: saved?.observacion || ''
      };
    });
  };

  const getRutinaGeneralDelDia = (fecha = todayIso()) => {
    return RUTINA_GENERAL_ITEMS.map(item => {
      const saved = listRutinaDiaria.find(r => r.fecha === fecha && !r.corralId && r.item === item);
      return {
        id: saved?.id || `${fecha}_general_${item}`,
        fecha,
        corralId: '',
        item,
        estado: saved?.estado || 'pendiente',
        observacion: saved?.observacion || ''
      };
    });
  };

  const handleActualizarRutinaCorral = (corralId, item, updates, fecha = todayIso()) => {
    setRutinaDiaria(prev => {
      const current = safeArr(prev);
      const existing = current.find(r => r.fecha === fecha && r.corralId === corralId && r.item === item);
      if (existing) {
        return current.map(r => r.id === existing.id ? { ...r, ...updates, updatedAt: Date.now() } : r);
      }
      return [...current, {
        id: crypto.randomUUID(),
        fecha,
        corralId,
        item,
        estado: 'pendiente',
        observacion: '',
        ...updates,
        updatedAt: Date.now()
      }];
    });
  };

  const handleMarcarCorralTodoBien = (corralId, fecha = todayIso()) => {
    setRutinaDiaria(prev => {
      const current = safeArr(prev);
      const sinItemsDelCorral = current.filter(r => !(r.fecha === fecha && r.corralId === corralId && RUTINA_CORRAL_ITEMS.includes(r.item)));
      const revisionesOk = RUTINA_CORRAL_ITEMS.map(item => ({
        id: crypto.randomUUID(),
        fecha,
        corralId,
        item,
        estado: 'hecho',
        observacion: '',
        updatedAt: Date.now()
      }));
      return [...sinItemsDelCorral, ...revisionesOk];
    });
  };

  const handleReportarProblemaCorral = (corralId, problema, fecha = todayIso()) => {
    setRutinaDiaria(prev => [...safeArr(prev), {
      id: crypto.randomUUID(),
      fecha,
      corralId,
      item: `Problema: ${problema}`,
      extra: true,
      estado: 'pendiente',
      observacion: problema,
      updatedAt: Date.now()
    }]);
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
    let currentDate = new Date((lote.fechaIngreso || new Date().toISOString().split('T')[0]) + 'T00:00:00');
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
    const nl = {
      id: crypto.randomUUID(),
      corralId: corralSeleccionado.id,
      fechaIngreso: fechaIng,
      cantidad: parseInt(fd.get('cantidad')),
      raza: fd.get('raza'),
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
  const handleGuardarTolva = (e) => {
    e.preventDefault();
    const loteActivo = getLoteActivo(corralSeleccionado.id);
    if (!loteActivo) return;

    const fd = new FormData(e.target);
    const faseDestinoSeleccionada = parseInt(fd.get('faseDestino'), 10);
    const info = listCatAlimentos.find(a => a.nombre === puroInput.tipo);
    const cantidad = parseFloat(puroInput.cantidad) || 0;

    if (cantidad <= 0 || !info) return mostrarAlerta("Error", "Revisa la cantidad y tipo de alimento.");

    let librasSuministradas = 0;
    let costoTotal = 0;

    if (puroInput.unidad === 'sacos') {
      librasSuministradas = cantidad * (info.librasPorSaco || 50);
      costoTotal = cantidad * info.precioSaco;
    } else {
      librasSuministradas = cantidad;
      costoTotal = cantidad * (info.precioSaco / (info.librasPorSaco || 50));
    }

    const itemEnCentral = inventarioCentral.find(i => i.nombre === puroInput.tipo);
    if (!itemEnCentral || itemEnCentral.stockLbs < librasSuministradas) {
      const faltanLbs = librasSuministradas - (itemEnCentral?.stockLbs || 0);
      return mostrarAlerta("Stock Insuficiente", `No tienes suficiente ${puroInput.tipo} en la Bodega Central. Te faltan ${faltanLbs.toFixed(1)} lbs para surtir esta tolva.`);
    }

    const alimentoId = crypto.randomUUID();
    setAlimentos(prev => [...safeArr(prev), {
      id: alimentoId, loteId: loteActivo.id, fecha: fd.get('fecha'),
      tipo: puroInput.tipo, cantidadLb: librasSuministradas,
      costo: costoTotal,
      esSuplemento: false, ahorro: 0, costoPorLb: (info.precioSaco / (info.librasPorSaco || 50)),
      faseRegistro: faseDestinoSeleccionada
    }]);
    setPuroInput({ ...puroInput, cantidad: '' });
    emitirNotificacionPush({
      tipo: 'alimento',
      titulo: 'Alimento registrado',
      descripcion: `${puroInput.tipo} · ${librasSuministradas.toFixed(1)} lb · ${formatearMoneda(costoTotal)}`,
      detalle: `Fase ${faseDestinoSeleccionada}`,
      corralId: corralSeleccionado?.id || loteActivo.corralId || '',
      corralNombre: corralSeleccionado?.nombre || listCorrales.find(c => c.id === loteActivo.corralId)?.nombre || 'Corral',
      loteId: loteActivo.id,
      loteNombre: loteActivo.nombre || loteActivo.raza || 'Lote activo',
      entidad: { tipo: 'alimento', id: alimentoId }
    });
    mostrarAlerta("Tolva Llenada", "El concentrado ha sido descontado de la bodega central y el presupuesto avanzó.");
  };

  const handleGuardarSuplemento = (e) => {
    e.preventDefault();
    const loteActivo = getLoteActivo(corralSeleccionado.id);
    if (!loteActivo) return;

    const fd = new FormData(e.target);
    const faseDestinoSeleccionada = parseInt(fd.get('faseDestino'), 10);

    const itemsValidos = suplementoItems.filter(i => i.tipo && parseFloat(i.libras) > 0);
    if (itemsValidos.length === 0) return mostrarAlerta("Error", "Agrega al menos un ingrediente con libras mayores a cero.");

    for (let item of itemsValidos) {
      const lbs = parseFloat(item.libras);
      const itemEnCentral = inventarioCentral.find(i => i.nombre === item.tipo);
      if (!itemEnCentral || itemEnCentral.stockLbs < lbs) {
        const faltanLbs = lbs - (itemEnCentral?.stockLbs || 0);
        return mostrarAlerta("Stock Insuficiente", `No tienes suficiente ${item.tipo} en la Bodega Central. Te faltan ${faltanLbs.toFixed(1)} lbs.`);
      }
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

  const prepararVentaLote = () => {
    const loteActivo = getLoteActivo(corralSeleccionado.id);
    if (loteActivo) setVentaPrecio(loteActivo.precioVentaLibra || 0);
    setVentaPesos([]);
    setPesoInputVenta('');
    setVista('prepararVenta');
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

    pedirConfirmacion("Confirmar Venta en Báscula", `¿Registrar la venta de ${ventaPesos.length} cerdos por un total de ${formatearMoneda(totalDinero)}?`, async () => {
      const nuevaVenta = {
        id: crypto.randomUUID(),
        loteId: loteActivo.id,
        corralId: loteActivo.corralId,
        fecha: new Date().toISOString().split('T')[0],
        cantidadCerdos: ventaPesos.length,
        totalLibras: totalLbs,
        pesoPromedioLibras: totalLbs / ventaPesos.length,
        pesosVenta: ventaPesos.map((peso, index) => ({ numero: index + 1, peso })),
        precioLibra: ventaPrecio,
        totalVenta: totalDinero,
        tipo: 'bascula'
      };
      await setVentas(prev => [...safeArr(prev), nuevaVenta]);
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

  const confirmarVentaYCerrar = () => {
    pedirConfirmacion("Cerrar Lote Oficialmente", "¿Deseas finalizar el lote y guardarlo en el historial permanentemente?", () => {
      const loteActivo = getLoteActivo(corralSeleccionado.id);
      setLotes(prev => safeArr(prev).map(l => l.id === loteActivo.id ? { ...l, estado: 'Cerrado', fechaSalida: new Date().toISOString().split('T')[0] } : l));
      setVista('dashboard');
    });
  };

  const avanzarLoteDeEtapa = (loteId, nuevaEtapaNum) => {
    const hoy = new Date().toISOString().split('T')[0];
    setLotes(prev => safeArr(prev).map(l => {
      if (l.id !== loteId) return l;
      const newHistorial = safeArr(l.historialFases).filter(h => h.fase < nuevaEtapaNum);
      newHistorial.push({ fase: nuevaEtapaNum, fechaInicio: hoy });
      return { ...l, faseActual: nuevaEtapaNum, historialFases: newHistorial };
    }));
    mostrarAlerta("Etapa Avanzada", `El sistema ha recalculado las fechas futuras y documentado tu ahorro financiero de la etapa anterior.`);
  };

  // --- RENDER: HISTORIAL DE LOTES ---
  const renderDashboard = () => {
    const totalSacosBodegaCentral = inventarioCentral.reduce((acc, item) => acc + item.stockSacos, 0);

    const alertasCambio = listLotes.filter(l => l.estado === 'Activo').map(lote => {
      const corral = listCorrales.find(c => c.id === lote.corralId);
      const stats = calcularEstadisticasLote(lote);

      const faseActualNum = lote.faseActual || 1;
      const faseActual = CRONOGRAMA_ALIMENTACION.find(f => f.fase === faseActualNum);

      if (faseActual) {
        if (stats.estaListoParaMezclas && !lote.alertaMezclaVista) {
          return { corralNombre: corral ? corral.nombre : 'Corral', alertaEspecial: true, mensaje: `¡Cerdos listos para suplementación fuerte! Han superado las ${pesoAlertaMezcla} lbs.` };
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
    
    const alertasFinales = [...notifsPushMapeadas, ...alertasCambio];

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 leading-none">Resumen de la Granja</h2>
            <p className="text-slate-500 text-sm mt-1">Supervisión operativa y métricas en tiempo real.</p>
          </div>
        </div>

        {/* Módulos de Indicadores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl border border-emerald-500/10"><Box size={20} /></div>
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Producción</span>
            </div>
            <h3 className="text-slate-400 text-xs font-semibold uppercase">Corrales Activos</h3>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {listCorrales.filter(c => getLoteActivo(c.id)).length} 
              <span className="text-sm font-medium text-slate-400"> / {listCorrales.length} corrales</span>
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl border border-blue-500/10"><TrendingUp size={20} /></div>
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Población</span>
            </div>
            <h3 className="text-slate-400 text-xs font-semibold uppercase">Cerdos en Engorda</h3>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {listLotes.filter(l => l.estado === 'Activo').reduce((acc, curr) => {
                const stats = calcularEstadisticasLote(curr);
                return acc + (stats?.cantidadActual || 0);
              }, 0)}
              <span className="text-sm font-medium text-slate-400"> cabezas</span>
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-500/10"><Archive size={20} /></div>
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Bodega</span>
            </div>
            <h3 className="text-slate-400 text-xs font-semibold uppercase">Alimento Comercial</h3>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {totalSacosBodegaCentral.toFixed(1)} 
              <span className="text-sm font-medium text-slate-400"> sacos</span>
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-rose-500/10 text-rose-600 rounded-xl border border-rose-500/10"><Clock size={20} /></div>
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Alertas</span>
            </div>
            <h3 className="text-slate-400 text-xs font-semibold uppercase">Requerimientos</h3>
            {alertasFinales.length > 0 ? (
              <div className="mt-2 space-y-2 max-h-32 overflow-y-auto pr-1 scrollbar-thin">
                {alertasFinales.map((alerta, i) => (
                  <div key={i} className={`text-xs border-l-2 pl-2.5 py-1.5 leading-tight ${alerta.alertaEspecial ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50 rounded-r-xl' : 'border-amber-400 text-amber-700 bg-amber-50/50 rounded-r-xl'}`}>
                    {alerta.tipoEvento ? (
                      <span className="font-semibold block">
                        <span className="font-black text-slate-800 block">{alerta.titulo}</span>
                        <span className="block">{[alerta.corralNombre, alerta.loteNombre].filter(Boolean).join(' · ') || 'Actividad general'}</span>
                        <span className="block text-slate-600">{alerta.mensaje}</span>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 mt-1">{[alerta.usuarioNombre && `por ${alerta.usuarioNombre}`, alerta.tiempo].filter(Boolean).join(' · ')}</span>
                      </span>
                    ) : alerta.alertaEspecial ? (
                      <span className="font-semibold">{alerta.corralNombre}: {alerta.mensaje}</span>
                    ) : (
                      <span><span className="font-bold text-slate-800">{alerta.corralNombre}:</span> Alimento al {alerta.porcentaje}%. <br /><span className="text-amber-600 font-extrabold text-[9px] uppercase tracking-wider block mt-0.5">Comprar: {alerta.proximoAlimento}</span></span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-2xl font-black text-slate-900 mt-1">0 <span className="text-sm font-medium text-slate-400">pendientes</span></p>
            )}
          </div>
        </div>

        {/* Supervisión de Corrales */}
        <div className="space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Estado de los Corrales</h3>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Actualización remota</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {listCorrales.map(corral => {
              const lote = getLoteActivo(corral.id);
              const stats = calcularEstadisticasLote(lote);
              return (
                <div 
                  key={corral.id} 
                  onClick={() => { setCorralSeleccionado(corral); setVista('corralDetail'); setTabActiva('resumen'); }} 
                  className={`group cursor-pointer rounded-2xl border transition-all duration-300 p-6 flex flex-col justify-between min-h-[170px] ${
                    lote 
                      ? 'border-emerald-500/20 bg-gradient-to-br from-emerald-50/40 to-white hover:border-emerald-500 shadow-sm hover:shadow-md hover:-translate-y-0.5' 
                      : 'border-dashed border-slate-200 bg-white hover:border-emerald-400/50 hover:bg-slate-50/20'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-lg text-slate-900 group-hover:text-emerald-700 transition-colors">{corral.nombre}</h4>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block mt-0.5">Capacidad: {corral.capacidad} lechones</span>
                      </div>
                      <div className={`px-2.5 py-1 text-[9px] font-extrabold rounded-full tracking-wider uppercase ${
                        lote 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}>
                        {lote ? 'Ocupado' : 'Vacío'}
                      </div>
                    </div>

                    {lote ? (
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Cabezas actuales:</span>
                          <span className="font-bold text-slate-800">{stats?.cantidadActual}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-medium">Peso Promedio:</span>
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            {stats?.pesoActual} lb
                            {stats?.estaListoParaMezclas && <Leaf size={14} className="text-emerald-500 filter drop-shadow-[0_0_4px_rgba(16,185,129,0.3)] animate-pulse" title="Listo para formulación" />}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-16 flex flex-col items-center justify-center text-slate-400/80 border border-dashed border-slate-100 rounded-xl bg-slate-50/20">
                        <Plus size={18} className="mb-1 text-slate-300 group-hover:text-emerald-500 group-hover:scale-110 transition-all" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Ingresar Lote</span>
                      </div>
                    )}
                  </div>

                  {lote && (
                    <div className="border-t border-slate-100/80 pt-3.5 mt-4 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Tiempo de engorda:</span>
                      <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">{stats?.diasLote} días</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };


  const renderBodega = () => {
return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center leading-none">
              <Archive className="mr-3 text-amber-500 filter drop-shadow-[0_0_8px_rgba(245,158,11,0.25)]" size={28} /> Bodega Central Unificada
            </h2>
            <p className="text-slate-500 text-sm mt-1.5">Monitoreo de materias primas y generación automatizada de compras.</p>
          </div>
          <button onClick={() => descargarPDF('orden-compra-pdf', 'Orden_Compra_Granja.pdf')} className="bg-slate-950 hover:bg-slate-900 text-white font-bold py-2.5 px-5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center shrink-0 self-start md:self-auto gap-2">
            <Download size={18} /> Generar Orden de Compra (PDF)
          </button>
        </div>

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
                  <input type="date" name="fecha" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50/50 text-sm transition-all" />
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
                <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 rounded-xl transition-colors shadow-lg shadow-amber-500/10 mt-2">Registrar Ingreso</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
              <h3 className="font-bold text-md text-slate-800 mb-3.5">Historial de Compras</h3>
              <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                {[...listCompras].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm hover:bg-slate-100/50 transition-colors">
                    <div>
                      <p className="font-bold text-slate-800 leading-tight">{c.tipo}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase ${c.categoria === 'ingrediente' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {c.categoria === 'ingrediente' ? 'EXTRA' : 'COMERCIAL'}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">{c.fecha} • {c.sacos} sacos</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-rose-600">-{formatearMoneda(c.costoTotal)}</span>
                      <button onClick={() => handleEliminarDato('bodega', c.id)} className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
                {listCompras.length === 0 && <p className="text-slate-400 italic text-center py-4 text-xs font-semibold">No hay compras registradas.</p>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)] overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center"><Box size={18} className="text-emerald-400 mr-2" /><h3 className="font-bold text-md">Inventario Físico en Bodega</h3></div>
                <span className="text-[10px] text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">Tiempo Real</span>
              </div>
              <div className="overflow-x-auto">
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
      </div>
    );
  };


  const renderRutinaDiaria = () => {
    const hoy = todayIso();
    const lotesActivos = listLotes.filter(l => l.estado === 'Activo');
    const corralesActivos = listCorrales.filter(c => lotesActivos.some(l => l.corralId === c.id));
    const revisionesCorral = corralesActivos.flatMap(c => getRutinaCorralDelDia(c.id, hoy));
    const revisionesGenerales = getRutinaGeneralDelDia(hoy);
    const revisionesHechas = revisionesCorral.filter(r => r.estado === 'hecho').length;
    const revisionesGeneralesHechas = revisionesGenerales.filter(r => r.estado === 'hecho').length;
    const totalRevisiones = revisionesCorral.length + revisionesGenerales.length;
    const totalHechas = revisionesHechas + revisionesGeneralesHechas;
    const problemasHoy = listRutinaDiaria.filter(r => r.fecha === hoy && r.extra && r.corralId);
    const corralesCompletos = corralesActivos.filter(c => getRutinaCorralDelDia(c.id, hoy).every(r => r.estado === 'hecho')).length;
    const avance = totalRevisiones > 0 ? Math.round((totalHechas / totalRevisiones) * 100) : 0;
    const problemasRapidos = ['Diarrea', 'Tos', 'No comen', 'Se amontonan', 'Falta agua', 'Retrasado', 'Posible baja', 'Corral sucio'];
    const hace7 = new Date(`${hoy}T00:00:00`);
    hace7.setDate(hace7.getDate() - 7);
    const historialRutina = listRutinaDiaria
      .filter(r => r.fecha && new Date(`${r.fecha}T00:00:00`) >= hace7 && (r.observacion || r.extra))
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 20);
    const toggleCorralRutina = (corralId) => {
      setCorralesRutinaAbiertos(prev => ({ ...prev, [corralId]: !prev[corralId] }));
    };
    const marcarGeneralesTodoBien = () => {
      RUTINA_GENERAL_ITEMS.forEach(item => handleActualizarRutinaCorral('', item, { estado: 'hecho', observacion: '' }));
    };

return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5 leading-none">
              <CheckSquare size={28} className="text-emerald-500 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.2)]" /> Rutina Diaria
            </h2>
            <p className="text-slate-500 text-sm mt-1.5">Revisión y checklist operativo: alimentación, agua y control sanitario por corral.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:min-w-[400px]">
            <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-xl px-4 py-2.5"><p className="text-lg font-black text-emerald-600">{avance}%</p><p className="text-[9px] font-bold uppercase text-slate-400 mt-0.5">Avance</p></div>
            <div className="bg-blue-50/50 border border-blue-100/50 rounded-xl px-4 py-2.5"><p className="text-lg font-black text-blue-600">{corralesCompletos}/{corralesActivos.length}</p><p className="text-[9px] font-bold uppercase text-slate-400 mt-0.5">Corrales</p></div>
            <div className="bg-amber-50/50 border border-amber-100/50 rounded-xl px-4 py-2.5"><p className="text-lg font-black text-amber-600">{Math.max(0, totalRevisiones - totalHechas)}</p><p className="text-[9px] font-bold uppercase text-slate-400 mt-0.5">Pendientes</p></div>
            <div className="bg-rose-50/50 border border-rose-100/50 rounded-xl px-4 py-2.5"><p className="text-lg font-black text-rose-600">{problemasHoy.length}</p><p className="text-[9px] font-bold uppercase text-slate-400 mt-0.5">Alertas</p></div>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.015)] overflow-hidden">
          <div className="flex border-b border-slate-100 bg-slate-50/50 p-1">
            <button type="button" onClick={() => setRutinaTab('corrales')} className={`flex-1 sm:flex-initial text-center px-6 py-3 text-xs font-bold rounded-xl transition-all duration-200 ${rutinaTab === 'corrales' ? 'bg-white shadow-sm text-emerald-600 border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
              Por Corral
            </button>
            <button type="button" onClick={() => setRutinaTab('generales')} className={`flex-1 sm:flex-initial text-center px-6 py-3 text-xs font-bold rounded-xl transition-all duration-200 ${rutinaTab === 'generales' ? 'bg-white shadow-sm text-emerald-600 border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
              Generales de Granja
            </button>
          </div>

          <div className="p-6">
            {rutinaTab === 'corrales' && (corralesActivos.length === 0 ? (
              <div className="p-10 text-center text-slate-400 font-semibold italic">No hay corrales activos para revisar hoy.</div>
            ) : (
              <div className="space-y-4">
                {corralesActivos.map(corral => {
                  const lote = lotesActivos.find(l => l.corralId === corral.id);
                  const revisiones = getRutinaCorralDelDia(corral.id, hoy);
                  const hechas = revisiones.filter(r => r.estado === 'hecho').length;
                  const problemasCorral = problemasHoy.filter(p => p.corralId === corral.id);
                  const abierto = corralesRutinaAbiertos[corral.id] ?? true;
                  return (
                    <div key={corral.id} className="border border-slate-100 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.006)]">
                      <button type="button" onClick={() => toggleCorralRutina(corral.id)} className="w-full flex items-center justify-between gap-3 p-4 bg-slate-50/30 hover:bg-slate-50 text-left border-b border-slate-100 transition-colors">
                        <div>
                          <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <ChevronRight size={18} className={`text-emerald-500 transition-transform duration-200 ${abierto ? 'rotate-90' : ''}`} />
                            {corral.nombre}
                          </h3>
                          <p className="text-xs text-slate-400 ml-6 mt-0.5">{lote ? `${lote.cantidad} iniciales · ingreso ${lote.fechaIngreso}` : 'Sin lote activo'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {problemasCorral.length > 0 && <span className="bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-black px-2 py-0.5 rounded-full">{problemasCorral.length} Alertas</span>}
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${hechas === revisiones.length ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{hechas}/{revisiones.length}</span>
                        </div>
                      </button>

                      {abierto && (
                        <div className="p-5 bg-white space-y-4">
                          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100/50 pb-3">
                            <button type="button" onClick={() => handleMarcarCorralTodoBien(corral.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-emerald-500/5 transition-colors">Marcar todo bien</button>
                            <span className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></span>
                            {problemasRapidos.map(problema => (
                              <button key={problema} type="button" onClick={() => handleReportarProblemaCorral(corral.id, problema)} className="px-3 py-2 rounded-xl bg-rose-50/50 text-rose-600 border border-rose-100/30 text-[11px] font-bold hover:bg-rose-100/50 transition-colors">
                                {problema}
                              </button>
                            ))}
                          </div>

                          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden shadow-[0_4px_15px_rgb(0,0,0,0.005)]">
                            {revisiones.map(item => (
                              <div key={item.item} className={`grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3 p-3.5 items-center transition-colors ${item.estado === 'hecho' ? 'bg-emerald-50/20' : 'bg-white'}`}>
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                  <input type="checkbox" checked={item.estado === 'hecho'} onChange={(e) => handleActualizarRutinaCorral(corral.id, item.item, { estado: e.target.checked ? 'hecho' : 'pendiente' })} className="w-4.5 h-4.5 accent-emerald-600 rounded cursor-pointer" />
                                  <span className={`text-sm font-semibold ${item.estado === 'hecho' ? 'text-emerald-800/60 line-through' : 'text-slate-800'}`}>{item.item}</span>
                                </label>
                                <input value={item.observacion || ''} onChange={(e) => handleActualizarRutinaCorral(corral.id, item.item, { observacion: e.target.value })} placeholder="Observación..." className="p-2 px-3 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/30 transition-all" />
                              </div>
                            ))}
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3 p-3.5 items-center bg-slate-50/40 border-t border-slate-100">
                              <span className="text-xs font-bold text-slate-700">Observación general del corral</span>
                              <input
                                value={listRutinaDiaria.find(r => r.fecha === hoy && r.corralId === corral.id && r.item === 'Observación general')?.observacion || ''}
                                onChange={(e) => handleActualizarRutinaCorral(corral.id, 'Observación general', { estado: e.target.value.trim() ? 'hecho' : 'pendiente', observacion: e.target.value })}
                                placeholder="Nota general..."
                                className="p-2 px-3 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-all"
                              />
                            </div>
                          </div>

                          {problemasCorral.length > 0 && (
                            <div className="bg-rose-50/50 border border-rose-100/50 rounded-xl p-4">
                              <p className="text-[10px] font-black uppercase tracking-wider text-rose-500 mb-2">Alertas Reportadas Hoy</p>
                              <div className="flex flex-wrap gap-2">
                                {problemasCorral.map(p => (
                                  <span key={p.id} className="bg-white border border-rose-100 text-rose-600 text-xs font-bold px-3 py-1 rounded-xl shadow-sm">{p.observacion || p.item}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {rutinaTab === 'generales' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Tareas generales de la granja</h3>
                    <p className="text-xs text-slate-500 mt-1">{revisionesGeneralesHechas}/{revisionesGenerales.length} completadas hoy.</p>
                  </div>
                  <button type="button" onClick={marcarGeneralesTodoBien} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-500/5 transition-colors">Marcar todo bien</button>
                </div>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden shadow-[0_4px_15px_rgb(0,0,0,0.005)] bg-white">
                  {revisionesGenerales.map(item => (
                    <div key={item.item} className={`grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3 p-3.5 items-center transition-colors ${item.estado === 'hecho' ? 'bg-emerald-50/20' : 'bg-white'}`}>
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input type="checkbox" checked={item.estado === 'hecho'} onChange={(e) => handleActualizarRutinaCorral('', item.item, { estado: e.target.checked ? 'hecho' : 'pendiente' })} className="w-4.5 h-4.5 accent-emerald-600 rounded cursor-pointer" />
                        <span className={`text-sm font-semibold ${item.estado === 'hecho' ? 'text-emerald-800/60 line-through' : 'text-slate-800'}`}>{item.item}</span>
                      </label>
                      <input value={item.observacion || ''} onChange={(e) => handleActualizarRutinaCorral('', item.item, { observacion: e.target.value })} placeholder="Observación..." className="p-2 px-3 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/30 transition-all" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-md text-slate-800 mb-2">Agregar revisión extra</h3>
              <p className="text-xs text-slate-400 mb-4">Inserta una revisión especial fuera de los parámetros diarios normales.</p>
            </div>
            <form onSubmit={handleAgregarRutinaExtra} className="grid grid-cols-1 md:grid-cols-[1fr_150px_auto] gap-3 mt-4">
              <input name="item" required placeholder="Ej. Revisar ventilación..." className="p-2.5 px-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 text-sm transition-all" />
              <select name="corralId" className="p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-sm transition-all">
                <option value="">Sin corral</option>
                {listCorrales.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button type="submit" className="bg-slate-950 hover:bg-slate-900 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-md">Agregar</button>
            </form>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <h3 className="font-bold text-md text-slate-800 mb-4">Observaciones recientes</h3>
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
              {historialRutina.map(item => {
                const corral = listCorrales.find(c => c.id === item.corralId);
                return (
                  <div key={item.id} className="grid grid-cols-[80px_1fr] gap-3 p-3 bg-slate-50 border border-slate-100/50 rounded-xl text-sm hover:bg-slate-100/30 transition-colors">
                    <span className="text-[11px] font-semibold text-slate-400">{item.fecha}</span>
                    <div>
                      <p className="font-bold text-slate-800 leading-snug">{corral?.nombre || 'General'} · {item.item}</p>
                      {item.observacion && <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed bg-white border border-slate-100 p-1.5 px-2.5 rounded-lg">{item.observacion}</p>}
                    </div>
                  </div>
                );
              })}
              {historialRutina.length === 0 && <p className="text-slate-400 italic text-center py-8 text-xs font-semibold">Sin observaciones recientes.</p>}
            </div>
          </div>
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
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center leading-none">
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
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center leading-none">
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
                  <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white flex justify-between items-center border-b border-slate-800">
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
                      <span className="font-bold text-indigo-600">{st.fca.toFixed(2)}</span>
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
                      className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold py-2.5 rounded-xl transition-all text-xs flex items-center justify-center shadow-sm shadow-indigo-500/10 gap-1.5"
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
              { label: 'FCA Global', value: stats.fca.toFixed(2), color: 'text-indigo-600' }
            ].map(item => (
              <div key={item.label} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
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
                <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Peso Promedio Final (Venta):</span><strong className="text-slate-800">{stats.pesoActual.toFixed(1)} lb</strong></div>
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
                  <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Costo Acumulado (Insumos):</span><strong className="text-rose-500">-{formatearMoneda(stats.costoInvertidoTotal)}</strong></div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="text-slate-500">Mano de Obra (Pagado):</span><strong className="text-rose-500">-{formatearMoneda(lote.manoObra)}</strong></div>
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center leading-none">
            <Settings className="mr-3 text-blue-500 filter drop-shadow-[0_0_8px_rgba(59,130,246,0.25)]" size={28} /> Ajustes del Sistema
          </h2>
          <p className="text-slate-500 text-sm mt-1.5">Administra corrales, catálogo de insumos, fórmulas de mezcla y parámetros matemáticos.</p>
        </div>
        <div className="text-xs font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shrink-0 self-start md:self-auto">
          Configuración Global
        </div>
      </div>

      {/* SECCIÓN: CORRALES */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
        <h3 className="font-extrabold text-base text-slate-800 mb-4 flex items-center gap-2"><Box className="text-emerald-500" size={18} /> Gestión de Corrales</h3>
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
              <button onClick={() => handleEliminarCorral(c.id)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={16} /></button>
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
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold p-2.5 rounded-lg transition-colors flex items-center justify-center shadow-md text-xs gap-1">
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
            <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-bold p-2.5 rounded-lg transition-colors flex items-center justify-center shadow-md text-xs gap-1">
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
      <div className="bg-[#090d16] p-4 sm:p-6 lg:p-8 rounded-3xl border border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-slate-200">
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
      <div className="bg-[#090d16] p-4 sm:p-6 lg:p-8 rounded-3xl border border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-slate-200">
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
    </div>
  );
  // --- RENDER: DETALLE DEL CORRAL ---
  const renderCorralDetail = () => {
    const loteActivo = getLoteActivo(corralSeleccionado.id);
    const stats = calcularEstadisticasLote(loteActivo, simuladorMuertesExtra);

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center leading-none">
              {corralSeleccionado.nombre}
            </h2>
            <p className="text-slate-500 text-sm mt-1.5 flex items-center gap-1">
              <Users size={16} className="text-slate-400" /> Capacidad Máxima: {corralSeleccionado.capacidad} cerdos
            </p>
          </div>
          {loteActivo && (
            <div className="flex flex-wrap gap-2.5 justify-end shrink-0 text-xs">
              <button onClick={handleEliminarLoteActivo} className="bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center border border-rose-200/50 gap-1.5" title="Eliminar este lote completamente">
                <Trash2 size={16} /> Anular Lote
              </button>
              <button onClick={() => setVista('imprimirFicha')} className="bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 font-bold py-2.5 px-4 rounded-xl shadow-sm flex items-center transition-all gap-1.5">
                <Printer size={16} /> Ficha Trazabilidad
              </button>
              <button onClick={() => { setTipoReporteImpresion('interno'); setVista('resumenVenta'); }} className="bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center gap-1.5">
                <PieChart size={16} /> Reporte Final
              </button>
              <button onClick={prepararVentaLote} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-600/10 flex items-center transition-all gap-1.5">
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
                  <input type="date" name="fechaIngreso" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 text-slate-800" />
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
              <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg shadow-emerald-500/15 transition-all text-sm uppercase tracking-wider mt-4">Iniciar Control de Lote</button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)] overflow-hidden">
            <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50 scrollbar-thin">
              {[
                { id: 'resumen', icon: PieChart, label: 'Resumen' },
                { id: 'cronograma', icon: Clock, label: 'Cronograma' },
                { id: 'alimento', icon: Wheat, label: 'Alimentación (Tolvas)' },
                { id: 'peso', icon: Scale, label: 'Control Peso' },
                { id: 'sanidad', icon: HeartPulse, label: 'Sanidad & Bajas' },
                { id: 'finanzas', icon: Calculator, label: 'Finanzas & Simulación' },
              ].map(t => (
                <button key={t.id} onClick={() => setTabActiva(t.id)} className={`flex items-center px-6 py-4 font-bold text-sm transition-colors border-b-2 shrink-0 ${tabActiva === t.id ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                  {React.createElement(t.icon, { size: 17, className: "mr-2" })} {t.label}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-6 lg:p-8 bg-white min-h-[500px]">

              {/* TAB: RESUMEN */}
              {tabActiva === 'resumen' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
                  <div className="bg-blue-50/40 p-6 rounded-2xl border border-blue-100">
                    <h3 className="font-bold text-lg text-blue-900 mb-6 flex items-center"><Activity size={22} className="mr-2 text-blue-600" /> Rendimiento Zootécnico</h3>
                    <div className="space-y-4 text-sm font-semibold text-slate-600">
                      <div className="flex justify-between items-center"><span className="font-medium text-slate-500">Animales Vivos:</span><span className={`font-extrabold text-base ${stats.mortalidadPorcentaje > 5 ? 'text-rose-600' : 'text-slate-800'}`}>{stats.cantidadActual} <span className="text-[10px] font-bold text-slate-400 ml-1">({stats.cantidadVendida} vendidos • {stats.mortalidadPorcentaje.toFixed(1)}% mort.)</span></span></div>
                      <div className="flex justify-between items-center"><span className="font-medium text-slate-500">Días en Engorde:</span><span className="font-extrabold text-base text-slate-800">{stats.diasLote}</span></div>
                      <div className={`flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border ${stats.estaListoParaMezclas ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100'}`}>
                        <span className={`${stats.estaListoParaMezclas ? 'text-emerald-800 font-bold' : 'text-slate-500 font-bold'}`}>Peso Promedio Actual:</span>
                        <span className={`font-black text-xl flex items-center ${stats.estaListoParaMezclas ? 'text-emerald-700 animate-pulse' : 'text-blue-700'}`}>{stats.pesoActual} lb {stats.estaListoParaMezclas && <Leaf size={18} className="ml-1.5 text-emerald-500" title="¡Listo para Mezclas!" />}</span>
                      </div>
                      <div className="flex justify-between items-center"><span className="font-medium text-slate-500">Ganancia Media Diaria (GMD):</span><span className="font-bold text-slate-800">{stats.adg.toFixed(2)} lbs/día</span></div>
                      <div className="flex justify-between items-center"><span className="font-medium text-slate-500">Peso Total Producido:</span><span className="font-bold text-slate-800">{stats.pesoProducidoLb.toFixed(1)} lb <span className="text-[10px] font-bold text-slate-400 ml-1">({stats.librasVendidas.toFixed(1)} lb vendidas)</span></span></div>
                      <div className={`p-4 rounded-xl border mt-4 ${stats.fca > 3 ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50/50 border-emerald-250'}`}>
                        <div className="flex justify-between items-center">
                          <span className={`font-bold ${stats.fca > 3 ? 'text-orange-800' : 'text-emerald-800'} flex items-center`}>Conversión Alimenticia (FCA)</span>
                          <span className={`font-black text-3xl ${stats.fca > 3 ? 'text-orange-600' : 'text-emerald-600'}`}>{stats.fca.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50/40 p-6 rounded-2xl border border-emerald-100">
                    <h3 className="font-bold text-lg text-emerald-950 mb-6 flex items-center"><PiggyBank size={22} className="mr-2 text-emerald-600" /> Inversión a la Fecha</h3>
                    <div className="space-y-4 text-sm font-semibold text-slate-600">
                      <div className="flex justify-between items-center"><span className="font-medium text-slate-500">Compra Lechones (Estimado):</span><span className="font-bold text-rose-600">-{formatearMoneda(stats.costoLechones)}</span></div>
                      <div className="flex justify-between items-center"><span className="font-medium text-slate-500">Alimentación Suministrada:</span><span className="font-bold text-rose-600">-{formatearMoneda(stats.costoAlimento)}</span></div>
                      <div className="flex justify-between items-center"><span className="font-medium text-slate-500">Gastos Sanidad y Operaciones:</span><span className="font-bold text-rose-600">-{formatearMoneda(stats.totalSanidad + stats.totalGastosExtras)}</span></div>
                      <div className="flex justify-between items-center pt-4 mt-2 border-t border-emerald-200/50"><span className="text-slate-900 font-extrabold text-base">TOTAL INVERTIDO:</span><span className="font-black text-rose-600 text-2xl">-{formatearMoneda(stats.costoInvertidoTotal)}</span></div>
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
                                        <div className="flex justify-between"><span>Insumos Extra (Costo):</span><span className="text-rose-500">-{formatearMoneda(ahorro.costoSups)}</span></div>
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
                            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5"><Wheat size={20} className="text-emerald-500" /> Suministro de Concentrado Base</h3>
                            <p className="text-[11px] text-slate-400 font-medium mt-1">Suministro de concentrado directo. Afecta el presupuesto alimenticio de la etapa.</p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Fecha de Entrega</label>
                              <input type="date" name="fecha" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 font-bold" />
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Cantidad Racionada</label>
                                <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                                  <input type="number" step="0.1" required value={puroInput.cantidad} onChange={(e) => setPuroInput({ ...puroInput, cantidad: e.target.value })} className="w-1/2 p-2.5 outline-none font-bold bg-transparent text-slate-700" placeholder="Ej. 2" />
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
                              <input type="date" name="fecha" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2.5 border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 bg-white text-slate-800 font-bold" />
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
                          <button type="submit" className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl transition-colors shadow-lg shadow-amber-500/10 mt-2 uppercase tracking-wider">Registrar Suplementación</button>
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
                                      {a.tipo} <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border">E{a.faseRegistro}</span>
                                    </p>
                                    {a.esSuplemento && <span className="bg-amber-100 text-amber-800 border border-amber-200/50 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider block w-fit mt-1.5">SUPLEMENTO</span>}
                                    {a.esSuplemento && <span className="text-[10px] text-slate-400 italic block mt-1 leading-snug">({a.detalleMezcla})</span>}
                                  </td>
                                  <td className="p-3.5 text-right font-black text-slate-800">{a.cantidadLb.toFixed(1)} lb</td>
                                  <td className="p-3.5 text-right text-rose-600">-{formatearMoneda(a.costo)}</td>
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
              {tabActiva === 'peso' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 animate-in fade-in duration-300">
                  <div className="md:col-span-4 space-y-6 text-xs font-semibold">
                    <h3 className="font-extrabold text-slate-800 text-sm mb-1 flex items-center gap-1.5"><Scale size={18} className="text-blue-500" /> Control de Pesaje</h3>

                    {/* SECCIÓN: INGRESO DIRECTO */}
                    <div className="bg-blue-50/20 border border-blue-100 rounded-2xl p-5 space-y-4">
                      <h4 className="font-extrabold text-blue-900 text-[10px] uppercase tracking-wider">Ingreso Directo por Báscula</h4>
                      <form onSubmit={handleGuardarPesoDirecto} className="space-y-4">
                        <div>
                          <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Fecha del Pesaje</label>
                          <input type="date" value={fechaPesaje} onChange={(e) => setFechaPesaje(e.target.value)} required className="w-full p-2.5 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold" />
                        </div>
                        <div>
                          <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Peso Promedio (lb)</label>
                          <input type="number" step="0.1" min="0" value={pesoIngresado} onChange={(e) => setPesoIngresado(e.target.value)} placeholder="Ej: 75.5" required className="w-full p-2.5 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-black text-sm" />
                        </div>
                        <button type="submit" disabled={guardandoPeso} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black rounded-xl transition-all shadow-lg shadow-blue-600/10 flex items-center justify-center gap-1.5 uppercase tracking-wider">
                          {guardandoPeso ? <div className="animate-spin rounded-full h-4.5 w-4.5 border-2 border-white border-t-transparent" /> : <><CheckCircle size={16} /> Guardar Peso Directo</>}
                        </button>
                      </form>
                    </div>

                    {/* SECCIÓN: FÓRMULA DE SCHAEFFER */}
                    <div className="bg-indigo-50/20 border border-indigo-100 rounded-2xl overflow-hidden shadow-[0_4px_25px_rgb(0,0,0,0.005)]">
                      <button type="button" onClick={() => setExpandirSchaeffer(!expandirSchaeffer)} className="w-full p-4 flex items-center justify-between hover:bg-indigo-100/30 transition-colors font-extrabold text-indigo-900 uppercase text-[10px] tracking-wider border-b border-indigo-100">
                        <span className="flex items-center gap-1.5"><Calculator size={16} /> Estimador de Schaeffer</span>
                        <ChevronRight size={16} className={`text-indigo-600 transition-transform duration-200 ${expandirSchaeffer ? 'rotate-90' : ''}`} />
                      </button>

                      {expandirSchaeffer && (
                        <div className="p-5 space-y-4 animate-in slide-in-from-top-1 duration-200">
                          <div className="bg-white border border-indigo-100 p-3 rounded-xl leading-relaxed">
                            <p className="text-[10px] text-indigo-700 font-mono font-bold">Fórmula: Peso (lb) = (Circunferencia² × Longitud) / {constanteSchaeffer}</p>
                            <p className="text-[9px] text-slate-400 mt-1 leading-normal">Medidas en pulgadas. El sistema convierte centímetros automáticamente.</p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Circunferencia (cm)</label>
                              <input type="number" step="0.1" min="0" value={circunferenciaCm} onChange={(e) => setCircunferenciaCm(e.target.value)} placeholder="Ej: 95" className="w-full p-2.5 border border-indigo-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                            </div>
                            <div>
                              <label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Longitud (cm)</label>
                              <input type="number" step="0.1" min="0" value={longitudCm} onChange={(e) => setLongitudCm(e.target.value)} placeholder="Ej: 58" className="w-full p-2.5 border border-indigo-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                            </div>
                          </div>

                          {pesoSchaefferCalculado !== null && (
                            <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 text-white p-4 rounded-xl text-center shadow-md shadow-indigo-500/10">
                              <p className="text-[9px] font-black uppercase tracking-wider text-indigo-200 mb-1 leading-none">Peso Estimado</p>
                              <p className="text-3xl font-black tracking-tight leading-none">{pesoSchaefferCalculado.toFixed(1)}</p>
                              <p className="text-[10px] text-indigo-200 font-bold mt-1.5">libras promedio</p>
                            </div>
                          )}

                          <button type="button" onClick={handleGuardarPesoSchaeffer} disabled={!pesoSchaefferCalculado || guardandoPeso} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-350 text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-1.5 uppercase tracking-wider">
                            {guardandoPeso ? <div className="animate-spin rounded-full h-4.5 w-4.5 border-2 border-white border-t-transparent" /> : <><CheckCircle size={16} /> Guardar Peso Estimado</>}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-8 space-y-4">
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
                              <td className="p-3.5 text-right font-black text-blue-600 text-sm">{parseFloat(p.pesoPromedio).toFixed(1)} lb</td>
                              <td className="p-3.5 text-center">
                                {p.metodo === 'schaeffer' ? (
                                  <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">Schaeffer</span>
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
              )}

              {/* TAB: SANIDAD Y BAJAS */}
              {tabActiva === 'sanidad' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300 text-xs">
                  <div className="space-y-6">
                    <div className="bg-emerald-50/40 p-5 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
                      <div className="flex flex-col gap-1">
                        <h3 className="font-extrabold text-base text-emerald-950 flex items-center gap-1.5"><ClipboardList size={20} className="text-emerald-600" /> Agenda de Control Sanitario</h3>
                        <p className="text-slate-500 font-medium mt-0.5">La agenda completa, rutina diaria y protocolos se administran desde Control Sanitario.</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2.5 font-bold">
                        <button type="button" onClick={() => { setVista('controlSanitario'); setSanidadTab('agenda'); }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl transition-colors text-center shadow-md shadow-emerald-600/10">
                          Abrir Agenda Clínica
                        </button>
                        {listTareasSanidad.filter(t => t.loteId === loteActivo.id).length === 0 && (
                          <button type="button" onClick={() => handleGenerarProtocoloLote(loteActivo)} className="flex-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 py-2.5 rounded-xl transition-colors">
                            Generar Protocolo Sanitario
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_4px_25px_rgb(0,0,0,0.005)]">
                      <h3 className="font-extrabold text-slate-800 text-base mb-4 flex items-center gap-2 border-b border-slate-50 pb-3"><Syringe size={18} className="text-indigo-600" /> Tratamientos Médicos</h3>
                      <form onSubmit={handleRegistrarTratamientoManual} className="space-y-4 font-semibold">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Fecha</label><input type="date" name="fecha" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50" /></div>
                          <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Costo Total (Q)</label><input type="number" name="costo" step="0.01" required className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold" /></div>
                        </div>
                        <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Medicamento / Fármaco</label><input type="text" name="nombre" required placeholder="Ej. Complejo B / Hierro" className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50" /></div>
                        <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-md shadow-indigo-600/10 uppercase tracking-wider">Añadir Tratamiento</button>
                      </form>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_4px_25px_rgb(0,0,0,0.005)]">
                      <h3 className="font-extrabold text-slate-800 text-base mb-4 flex items-center gap-2 border-b border-slate-50 pb-3"><Receipt size={18} className="text-slate-500" /> Gastos Operativos Directos</h3>
                      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target); setGastosExtra(prev => [...safeArr(prev), { id: crypto.randomUUID(), loteId: loteActivo.id, fecha: fd.get('fecha'), descripcion: fd.get('descripcion').trim(), monto: parseFloat(fd.get('monto')) }]); e.target.reset(); }} className="space-y-4 font-semibold">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Fecha</label><input type="date" name="fecha" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50" /></div>
                          <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Monto Gasto (Q)</label><input type="number" name="monto" step="0.01" required className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold" /></div>
                        </div>
                        <div><label className="block text-slate-400 uppercase tracking-widest font-bold mb-1.5">Descripción / Concepto</label><input type="text" name="descripcion" required placeholder="Ej: Flete de acarreo / aserrín" className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50" /></div>
                        <button type="submit" className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-xl transition-all shadow-md uppercase tracking-wider">Añadir Gasto Directo</button>
                      </form>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-rose-50/20 border border-rose-100 rounded-2xl p-5 space-y-4">
                      <h3 className="font-extrabold text-rose-950 text-base flex items-center gap-1.5"><HeartPulse size={20} className="text-rose-600" /> Registro de Bajas y Decesos</h3>
                      <form onSubmit={handleRegistrarBaja} className="space-y-4 font-semibold text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div><label className="block text-slate-500 uppercase tracking-widest font-bold mb-1.5">Fecha de Baja</label><input type="date" name="fecha" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2.5 border border-rose-200 bg-white rounded-xl outline-none" /></div>
                          <div><label className="block text-slate-500 uppercase tracking-widest font-bold mb-1.5">Cantidad Muertes</label><input type="number" name="cantidad" required min="1" className="w-full p-2.5 border border-rose-200 bg-white rounded-xl outline-none font-bold" /></div>
                        </div>
                        <div><label className="block text-slate-500 uppercase tracking-widest font-bold mb-1.5">Causa / Diagnóstico de Muerte</label><input type="text" name="causa" required placeholder="Ej. Neumonía / Infección bacteriana" className="w-full p-2.5 border border-rose-200 bg-white rounded-xl outline-none" /></div>
                        <button type="submit" className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl transition-all shadow-md shadow-rose-600/10 uppercase tracking-wider">Registrar Baja Definitiva</button>
                      </form>
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
                                    <p className="font-bold text-rose-600">-{formatearMoneda(perdidaTotalBaja)}</p>
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

                    <div className="space-y-2.5">
                      <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-50 pb-2">Gastos Sanitarios & Operativos Registrados</h3>
                      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm max-h-48 overflow-y-auto scrollbar-thin">
                        <table className="w-full text-left text-xs border-collapse">
                          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                            {listGastosExtra.filter(g => g.loteId === loteActivo.id).map(g => (
                              <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 pl-4"><p className="font-bold text-slate-800">{g.descripcion}</p><p className="text-[10px] text-slate-400 font-medium mt-0.5">{g.fecha} • Operación</p></td>
                                <td className="p-3 text-right font-black text-rose-600">-{formatearMoneda(g.monto)}</td>
                                <td className="p-3 text-right pr-4"><button onClick={() => handleEliminarDato('gasto', g.id)} className="text-slate-300 hover:text-rose-500 p-1 rounded-md transition-colors"><Trash2 size={15} /></button></td>
                              </tr>
                            ))}
                            {listVacunas.filter(v => v.loteId === loteActivo.id).map(v => (
                              <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 pl-4"><p className="font-bold text-indigo-900">{v.nombre}</p><p className="text-[10px] text-slate-400 font-medium mt-0.5">{v.fecha} • Tratamiento Médico</p></td>
                                <td className="p-3 text-right font-black text-rose-600">-{formatearMoneda(v.costo)}</td>
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
                  </div>
                </div>
              )}

              {/* TAB: FINANZAS Y SIMULADOR */}
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
                          <p className="text-[10px] text-slate-450 border-t border-slate-100 pt-2 text-center mt-1">Simulando vender: <strong className="text-slate-700">{stats.cantidadParaProyeccion} cerdos</strong> de los {stats.cantidadActual} vivos.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-8 space-y-4">
                    <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5"><TrendingUp size={18} className="text-indigo-500" /> Simulador de Cierre de Lote (Meta: {stats.pesoObjetivoLb} lb)</h3>

                    {stats.pesoActual >= stats.pesoObjetivoLb ? (
                      <div className="bg-slate-900 text-white p-6 lg:p-12 rounded-3xl text-center shadow-lg border-2 border-emerald-500 relative overflow-hidden flex flex-col justify-center items-center">
                        <CheckCircle size={56} className="text-emerald-400 mb-3" />
                        <h4 className="text-2xl font-black mb-1">¡Lote Listo para Mercado!</h4>
                        <p className="text-slate-400 text-xs mb-6 max-w-md font-medium leading-relaxed">El ganado ha superado el peso objetivo comercial. Puedes coordinar la báscula de venta.</p>
                        <div className="bg-slate-950/80 border border-slate-800/80 p-5 rounded-2xl shadow-inner max-w-xs w-full text-center">
                          <p className="text-[10px] text-slate-450 font-bold uppercase tracking-widest leading-none mb-2">Utilidad Neta Real Hoy</p>
                          <p className="text-3xl font-black text-emerald-400">{formatearMoneda(stats.utilidadNeta)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.015)] overflow-hidden">
                        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-4 sm:p-6 lg:p-8 text-white relative">
                          <h4 className="text-indigo-300 font-black mb-4 uppercase tracking-widest text-[10px] leading-none">Proyección de Cierre Planificada</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div><p className="text-slate-450 text-[10px] font-bold uppercase tracking-wider mb-1 leading-none">Libras Faltantes de Carne</p><p className="text-2xl font-black text-white">{stats.proyeccionLibrasFaltantes.toFixed(0)} lb</p></div>
                            <div><p className="text-slate-450 text-[10px] font-bold uppercase tracking-wider mb-1 leading-none">Alimento Faltante Estimado</p><p className="text-2xl font-black text-white">{(stats.proyeccionAlimentoFaltante / 100).toFixed(1)} <span className="text-xs font-bold text-slate-400 uppercase">Sacos (100lb)</span></p></div>
                          </div>
                        </div>

                        <div className="p-4 sm:p-6 lg:p-8 space-y-4 font-semibold text-slate-600 text-sm">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <span className="text-slate-500 font-medium">Inversión actual total:</span>
                            <span className="font-bold text-slate-800">-{formatearMoneda(stats.costoInvertidoTotal)}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <span className="text-slate-500 font-medium flex items-center gap-1.5"><AlertTriangle size={15} className="text-amber-500" /> Costo alimento futuro estimado:</span>
                            <span className="font-bold text-rose-500">-{formatearMoneda(stats.proyeccionCostoFaltante)}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <span className="text-slate-900 font-black">Venta Bruta Total Proyectada (A Meta):</span>
                            <span className="font-black text-emerald-600 text-lg">+{formatearMoneda(stats.proyeccionVentaFinal)}</span>
                          </div>

                          <div className="bg-slate-50 border border-slate-100 p-4 sm:p-6 lg:p-8 rounded-3xl mt-5 text-center shadow-inner relative">
                            {simuladorMuertesExtra > 0 && <div className="absolute top-4 right-4 bg-amber-100 border border-amber-200 text-amber-800 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">Simulación Pesimista Activa</div>}
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 leading-none">Margen Neto Limpio Estimado a Cierre</p>
                            <p className={`text-4xl md:text-5xl font-black tracking-tight leading-none ${stats.proyeccionUtilidadFinal > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {formatearMoneda(stats.proyeccionUtilidadFinal)}
                            </p>
                            <p className="text-slate-450 text-[10px] font-medium leading-relaxed max-w-md mx-auto mt-4">Esta simulación descuenta compras de lechones, costo total del alimento (suministrado y futuro), gastos de sanidad, mano de obra y las {simuladorMuertesExtra} muertes hipotéticas configuradas.</p>
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

    return (
      <div className="bg-slate-100 min-h-screen p-4 lg:p-8 flex justify-center animate-in fade-in">
        <div className="bg-white max-w-3xl w-full rounded-3xl shadow-xl border border-slate-200/50 overflow-hidden">
          <div className="bg-slate-900 p-4 flex justify-between items-center text-xs">
            <button onClick={() => setVista('corralDetail')} className="text-slate-300 hover:text-white font-bold flex items-center gap-1.5 transition-colors"><ChevronRight size={18} className="rotate-180" /> Volver al Corral</button>
            <button onClick={() => descargarPDF('ficha-pdf', `Ficha_${corralSeleccionado.nombre}.pdf`)} className="bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black py-2 px-5 rounded-xl flex items-center shadow-lg shadow-emerald-500/20 transition-all gap-1.5"><Printer size={16} /> Descargar PDF</button>
          </div>

          <div id="ficha-pdf" className="p-10 w-full bg-white text-black border-[12px] border-slate-900 font-sans">
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
                <p className="text-lg font-bold text-slate-800 leading-tight">{st.pesoActual > 0 ? `${st.pesoActual} lbs promedio` : 'Sin pesaje registrado'}</p>
              </div>
            </div>

            <div className="border-t-2 border-slate-900 pt-6 mt-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Anotaciones Veterinarias / Incidencias Sanitarias (Control Manual)</p>
              <div className="border-b border-dashed border-slate-400 mb-6 h-7"></div>
              <div className="border-b border-dashed border-slate-400 mb-6 h-7"></div>
              <div className="border-b border-dashed border-slate-400 mb-6 h-7"></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPrepararVenta = () => {
    const totalLbs = ventaPesos.reduce((a, b) => a + b, 0);
    const totalDinero = totalLbs * ventaPrecio;

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
        <button onClick={() => setVista('corralDetail')} className="flex items-center text-emerald-600 hover:text-emerald-800 font-bold transition-colors text-xs gap-1">
          <ChevronRight size={18} className="rotate-180" /> Volver al Corral
        </button>

        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Scale size={26} className="text-emerald-500" /> Báscula de Venta
          </h2>
          <p className="text-slate-500 text-xs mt-1">Registra el peso exacto de cada animal al cargarse en el camión. Se generará la liquidación oficial.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 text-xs">
              <h3 className="font-extrabold text-slate-800 text-sm mb-3">1. Configurar Precio Acordado</h3>
              <div className="relative font-bold">
                <span className="absolute left-4 top-3 text-slate-400 text-sm">Q</span>
                <input type="number" step="0.01" value={ventaPrecio} onChange={(e) => setVentaPrecio(parseFloat(e.target.value) || 0)} className="w-full pl-9 p-2.5 border border-emerald-300 bg-emerald-50/10 text-emerald-850 font-black text-base rounded-xl outline-none" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 text-xs space-y-4">
              <h3 className="font-extrabold text-slate-800 text-sm">2. Capturar Pesos en Báscula</h3>
              <form onSubmit={(e) => { e.preventDefault(); if (pesoInputVenta) { setVentaPesos([...ventaPesos, parseFloat(pesoInputVenta)]); setPesoInputVenta(''); } }} className="flex gap-2">
                <input type="number" step="0.1" value={pesoInputVenta} onChange={(e) => setPesoInputVenta(e.target.value)} placeholder="Peso en libras (ej: 220)" autoFocus className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-lg font-black text-center" />
                <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 rounded-xl shadow-md transition-colors text-xs flex items-center justify-center gap-1 shrink-0"><Plus size={16} /> Añadir</button>
              </form>

              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 min-h-[150px] shadow-inner">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 leading-none">Pigs Pesados ({ventaPesos.length})</h4>
                {ventaPesos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-24 text-slate-400 italic">
                    Comienza a capturar pesos individuales.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {ventaPesos.map((peso, index) => (
                      <div key={index} className="bg-white border border-slate-200 shadow-sm pl-3 pr-1 py-1 rounded-lg flex items-center gap-2 font-bold animate-in zoom-in-95 duration-150">
                        <span className="text-slate-800 text-xs">{peso} <span className="text-[10px] text-slate-450 font-normal">lb</span></span>
                        <button onClick={() => setVentaPesos(ventaPesos.filter((_, i) => i !== index))} className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition-colors"><X size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-slate-900 rounded-3xl p-5 shadow-xl text-white sticky top-8 text-xs">
              <h3 className="font-extrabold text-base mb-4 text-emerald-400 flex items-center gap-1.5 border-b border-slate-850 pb-3"><Receipt size={20} /> Liquidación Venta</h3>

              <div className="space-y-3 mb-6 font-semibold">
                <div className="flex justify-between items-end"><span className="text-slate-400">Total Cabezas:</span><span className="text-lg font-bold">{ventaPesos.length}</span></div>
                <div className="flex justify-between items-end"><span className="text-slate-400">Libras Totales:</span><span className="text-lg font-bold text-amber-400">{totalLbs.toFixed(1)} lb</span></div>
                <div className="flex justify-between items-end"><span className="text-slate-400">Precio Libra:</span><span className="text-sm">Q{ventaPrecio.toFixed(2)}</span></div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-center mb-6 shadow-inner">
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1.5 leading-none">Monto Total a Cobrar</p>
                <p className="text-3xl font-black text-emerald-400">{formatearMoneda(totalDinero)}</p>
              </div>

              <button onClick={procesarVenta} className="w-full bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black py-3 rounded-xl shadow-lg shadow-emerald-500/10 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5">
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

    const ultimaVenta = listVentas.filter(v => v.loteId === loteActivo.id).pop();
    const ticketCerdos = ultimaVenta ? (ultimaVenta.cantidadCerdos || 0) : st.cantidadActual;
    const ticketLibras = ultimaVenta ? (ultimaVenta.totalLibras || 0) : (st.pesoActual * st.cantidadActual);
    const ticketPrecio = ultimaVenta ? (ultimaVenta.precioLibra || 0) : loteActivo.precioVentaLibra;
    const ticketTotal = ultimaVenta ? (ultimaVenta.totalVenta || 0) : st.ingresoEstimado;

    return (
      <div className="bg-slate-100 min-h-screen p-4 lg:p-6 flex justify-center text-xs">
        <div className="bg-white max-w-4xl w-full rounded-3xl shadow-xl overflow-hidden border border-slate-200/60">

          <div className="bg-slate-900 p-4 flex flex-col sm:flex-row justify-between items-center rounded-t-2xl gap-3 text-xs">
            <button onClick={() => setVista('corralDetail')} className="text-slate-300 hover:text-white font-bold flex items-center gap-1 transition-colors">
              <ChevronRight size={18} className="rotate-185 mr-1" /> Volver al Corral
            </button>

            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 font-bold">
              <button onClick={() => setTipoReporteImpresion('interno')} className={`px-3 py-1.5 rounded-lg transition-all duration-150 ${tipoReporteImpresion === 'interno' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'}`}>
                Liquidación Interna
              </button>
              <button onClick={() => setTipoReporteImpresion('cliente')} className={`px-3 py-1.5 rounded-lg transition-all duration-150 ${tipoReporteImpresion === 'cliente' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'}`}>
                Recibo Cliente
              </button>
            </div>

            <div className="flex space-x-2 font-bold">
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
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-500">Peso Promedio Final (Liquidado)</td><td className="py-2 font-black text-emerald-700">{st.pesoActual} lb</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-500">Ganancia Media Diaria (GMD)</td><td className="py-2 font-bold text-slate-800">{st.adg.toFixed(2)} lb / día</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-500">Alimento Suministrado Registrado</td><td className="py-2 font-bold text-slate-800">{st.consumoTotalLb} lb</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-500">Libras Vendidas por Báscula</td><td className="py-2 font-bold text-slate-800">{st.librasVendidas.toFixed(1)} lb</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-500">Peso Carne Producido para FCA</td><td className="py-2 font-bold text-slate-800">{st.pesoProducidoLb.toFixed(1)} lb</td></tr>
                      <tr className="bg-slate-50 font-bold border border-slate-150"><td className="py-2 px-3 text-slate-850">Conversión Alimenticia (FCA)</td><td className="py-2 px-3 font-black text-indigo-750">{st.fca.toFixed(2)}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="mb-8 font-semibold text-slate-700">
                  <h3 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-2 mb-3">2. Inversión & Liquidación Financiera</h3>
                  <table className="w-full text-left text-xs border-collapse">
                    <tbody>
                      <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-500 w-1/2">Compra de Lechones</td><td className="py-1.5 text-right text-rose-600">-{formatearMoneda(st.costoLechones)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-500">Concentrado Suministrado (Tolvas)</td><td className="py-1.5 text-right text-rose-600">-{formatearMoneda(st.costoAlimentoTolva)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-500">Suplementos & Aditivos extra</td><td className="py-1.5 text-right text-rose-600">-{formatearMoneda(st.costoAlimentoSuplemento)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-500">Egresos de Sanidad & Fármacos</td><td className="py-1.5 text-right text-rose-600">-{formatearMoneda(st.totalSanidad)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-500">Otros Egresos Operativos</td><td className="py-1.5 text-right text-rose-600">-{formatearMoneda(st.totalGastosExtras)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-500">Mano de Obra Imputada</td><td className="py-1.5 text-right text-rose-600">-{formatearMoneda(loteActivo.manoObra)}</td></tr>
                      <tr className="bg-rose-50 border border-rose-100 font-bold"><td className="py-2 px-3 text-rose-900">EGRESOS / INVERSIÓN TOTAL</td><td className="py-2 px-3 text-right text-rose-700 font-black">-{formatearMoneda(st.costoInvertidoTotal + loteActivo.manoObra)}</td></tr>
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
                        { label: 'Lechones', value: st.costoLechones, color: '#3b82f6' },
                        { label: 'Alim. Tolva', value: st.costoAlimentoTolva, color: '#f59e0b' },
                        { label: 'Suplementos', value: st.costoAlimentoSuplemento, color: '#eab308' },
                        { label: 'Sanidad', value: st.totalSanidad, color: '#6366f1' },
                        { label: 'Gastos Extras', value: st.totalGastosExtras, color: '#f43f5e' },
                        { label: 'Mano de Obra', value: loteActivo.manoObra || 0, color: '#64748b' },
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
                              <div className="h-full rounded-full transition-all duration-300" style={{ width: `Professional ${porcentaje}%`, backgroundColor: gasto.color }} />
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
                            <td className="py-2 px-3 text-right text-rose-600">-{formatearMoneda(a.costo)}</td>
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
  const renderControlSanitario = () => {
    const hoy = todayIso();
    const lotesActivos = listLotes.filter(l => l.estado === 'Activo');
    const getProductoMedicoLigado = (item) => {
      if (!item) return null;
      const directo = listCatalogoMedico.find(m => m.id === item.productoMedicoId);
      if (directo) return inventarioMedico.find(m => m.id === directo.id) || directo;

      const texto = `${item.producto || ''} ${item.tarea || ''}`.toLowerCase();
      const candidato = listCatalogoMedico.find(m => {
        const nombre = m.nombre.toLowerCase();
        return texto.includes(nombre) ||
          nombre.split(/[ /]+/).filter(Boolean).some(parte => parte.length > 5 && texto.includes(parte));
      });
      return candidato ? (inventarioMedico.find(m => m.id === candidato.id) || candidato) : null;
    };

    const tareasEnriquecidas = listTareasSanidad.map(tarea => {
      const lote = listLotes.find(l => l.id === tarea.loteId);
      const corral = listCorrales.find(c => c.id === lote?.corralId);
      const fechaObjetivo = tarea.fechaObjetivo || (lote?.fechaIngreso ? addDaysToIsoDate(lote.fechaIngreso, Number(tarea.dia) || 0) : '');
      const diffDias = fechaObjetivo ? Math.ceil((new Date(`${fechaObjetivo}T00:00:00`) - new Date(`${hoy}T00:00:00`)) / 86_400_000) : 9999;
      const productoMedico = getProductoMedicoLigado(tarea);
      return {
        ...tarea,
        lote,
        corral,
        productoMedico,
        productoMedicoId: tarea.productoMedicoId || productoMedico?.id || '',
        fechaObjetivo,
        diffDias,
        estado: tarea.estado || 'pendiente',
        vencida: (tarea.estado || 'pendiente') === 'pendiente' && diffDias < 0
      };
    }).filter(t => t.lote?.estado === 'Activo');

    const agendaFiltrada = tareasEnriquecidas
      .filter(t => {
        if (sanidadFiltro === 'vencidas') return t.vencida;
        if (sanidadFiltro === 'hoy') return t.diffDias === 0 || t.vencida;
        if (sanidadFiltro === 'semana') return t.diffDias >= 0 && t.diffDias <= 7;
        return true;
      })
      .sort((a, b) => a.diffDias - b.diffDias || (Number(a.dia) || 0) - (Number(b.dia) || 0));

    const getEtiquetaFechaAgenda = (tarea) => {
      if (tarea.vencida) return `Vencida · ${tarea.fechaObjetivo || 'Sin fecha'}`;
      if (tarea.diffDias === 0) return 'Hoy';
      if (tarea.diffDias === 1) return 'Mañana';
      if (tarea.diffDias > 1 && tarea.diffDias <= 7) return `En ${tarea.diffDias} días`;
      return tarea.fechaObjetivo || 'Sin fecha';
    };

    const gruposAgenda = agendaFiltrada.reduce((acc, tarea) => {
      const key = getEtiquetaFechaAgenda(tarea);
      if (!acc[key]) acc[key] = [];
      acc[key].push(tarea);
      return acc;
    }, {});

    const resumenAgenda = {
      vencidas: tareasEnriquecidas.filter(t => t.vencida).length,
      hoy: tareasEnriquecidas.filter(t => t.diffDias === 0 && t.estado === 'pendiente').length,
      semana: tareasEnriquecidas.filter(t => t.diffDias >= 0 && t.diffDias <= 7 && t.estado === 'pendiente').length,
      pendientes: tareasEnriquecidas.filter(t => t.estado === 'pendiente').length
    };
    const alertasMedicas = inventarioMedico.filter(item => {
      const vencimientoCercano = item.proximoVencimiento && item.proximoVencimiento.diffDias <= (Number(item.diasAlertaVencimiento) || 30);
      return item.bajoStock || vencimientoCercano;
    });
    const valorBodegaMedica = inventarioMedico.reduce((sum, item) => sum + (item.valorStock || 0), 0);
    const tareasPendientesParaAplicacion = tareasEnriquecidas.filter(t => t.estado === 'pendiente');
    const tareasProximasConMedicina = tareasPendientesParaAplicacion.filter(t => t.productoMedico && t.diffDias >= 0 && t.diffDias <= 14);
    const ordenCompraMedicaSugerida = Object.values(tareasProximasConMedicina.reduce((acc, tarea) => {
      const med = tarea.productoMedico;
      if (!acc[med.id]) {
        acc[med.id] = {
          ...med,
          tareas: [],
          requeridoOperativo: 0,
          faltanteOperativo: 0
        };
      }
      acc[med.id].tareas.push(tarea);
      acc[med.id].requeridoOperativo += 1;
      acc[med.id].faltanteOperativo = Math.max(0, acc[med.id].requeridoOperativo - (Number(med.stock) || 0));
      return acc;
    }, {})).filter(item => item.faltanteOperativo > 0 || item.bajoStock);

    const getRiesgoSanitarioLote = (lote) => {
      const tareas = tareasEnriquecidas.filter(t => t.loteId === lote.id);
      const corralId = lote.corralId;
      const hace7 = new Date(`${hoy}T00:00:00`);
      hace7.setDate(hace7.getDate() - 7);
      const bajas7 = listBajas
        .filter(b => b.loteId === lote.id && b.fecha && new Date(`${b.fecha}T00:00:00`) >= hace7)
        .reduce((sum, b) => sum + (Number(b.cantidad) || 0), 0);
      const obsCriticas = listRutinaDiaria.filter(r =>
        r.corralId === corralId &&
        r.fecha &&
        new Date(`${r.fecha}T00:00:00`) >= hace7 &&
        /diarrea|tos|deca|flac|retras|muerte|baja|sangre|fiebre|no come/i.test(`${r.item || ''} ${r.observacion || ''}`)
      ).length;
      const sinStock = tareas.filter(t => t.estado === 'pendiente' && t.productoMedico && (Number(t.productoMedico.stock) || 0) <= 0).length;
      const vencidas = tareas.filter(t => t.vencida).length;
      const hoyPendientes = tareas.filter(t => t.diffDias === 0 && t.estado === 'pendiente').length;
      const score = (vencidas * 3) + hoyPendientes + (bajas7 * 4) + (obsCriticas * 2) + (sinStock * 2);
      const nivel = score >= 6 ? 'alto' : score >= 3 ? 'medio' : 'bajo';
      return { score, nivel, vencidas, hoyPendientes, bajas7, obsCriticas, sinStock };
    };

    const getHistorialSanitarioLote = (lote) => {
      const tareasHechas = tareasEnriquecidas
        .filter(t => t.loteId === lote.id && t.estado === 'hecho')
        .map(t => ({ id: `t_${t.id}`, fecha: t.completadoEn || t.fechaObjetivo, tipo: 'Protocolo', texto: t.tarea, detalle: t.observacion || t.producto || '' }));
      const aplicaciones = listUsosMedicos
        .filter(u => u.loteId === lote.id)
        .map(u => ({ id: `u_${u.id}`, fecha: u.fecha, tipo: 'Aplicación', texto: u.nombre, detalle: `${u.cantidad} ${u.unidad} · ${formatearMoneda(u.costo || 0)}` }));
      const bajas = listBajas
        .filter(b => b.loteId === lote.id)
        .map(b => ({ id: `b_${b.id}`, fecha: b.fecha, tipo: 'Baja', texto: b.causa, detalle: `${b.cantidad} animales` }));
      const rutina = listRutinaDiaria
        .filter(r => r.corralId === lote.corralId && r.observacion)
        .map(r => ({ id: `r_${r.id}`, fecha: r.fecha, tipo: 'Rutina', texto: r.item, detalle: r.observacion }));
      return [...tareasHechas, ...aplicaciones, ...bajas, ...rutina]
        .filter(i => i.fecha)
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
        .slice(0, 6);
    };

    const renderTareaAgenda = (tarea) => {
      const abierta = agendaDetalleAbierto === tarea.id;
      const estadoClass = tarea.estado === 'hecho'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
        : tarea.estado === 'omitido'
        ? 'bg-slate-100 text-slate-500 border-slate-200'
        : tarea.vencida
        ? 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse'
        : 'bg-amber-50 text-amber-700 border-amber-100';

      return (
        <div key={tarea.id} className="border border-slate-100 rounded-2xl bg-white overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.008)] hover:border-slate-200 transition-all duration-200">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 p-5 items-center">
            <button type="button" onClick={() => setAgendaDetalleAbierto(abierta ? null : tarea.id)} className="text-left min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg">{tarea.corral?.nombre || 'Corral'}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{tarea.rango || `Día ${tarea.dia}`}</span>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${estadoClass}`}>
                  {tarea.estado === 'pendiente' && tarea.vencida ? 'Vencida' : tarea.estado}
                </span>
              </div>
              <h4 className="font-extrabold text-slate-800 text-base leading-snug">{tarea.tarea}</h4>
              <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
                <Archive size={12} className="text-slate-400" />
                {tarea.productoMedico ? `${tarea.productoMedico.nombre} (Stock: ${Number(tarea.productoMedico.stock || 0).toFixed(1)} ${tarea.productoMedico.unidad})` : tarea.producto || 'Sin insumo ligado'}
              </p>
            </button>
            <div className="flex items-center gap-2 justify-end shrink-0">
              {tarea.estado !== 'hecho' ? (
                <button type="button" onClick={() => handleActualizarTareaSanidad(tarea.id, { estado: 'hecho' })} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-emerald-600/10 transition-colors">
                  Completar
                </button>
              ) : (
                <button type="button" onClick={() => handleActualizarTareaSanidad(tarea.id, { estado: 'pendiente' })} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-2 rounded-xl text-xs transition-colors">
                  Reabrir
                </button>
              )}
              <button type="button" onClick={() => setAgendaDetalleAbierto(abierta ? null : tarea.id)} className="border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold px-4 py-2 rounded-xl text-xs bg-white shadow-sm transition-colors">
                Detalle
              </button>
            </div>
          </div>

          {abierta && (
            <div className="border-t border-slate-100 bg-slate-50/50 p-5 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
              <div className="space-y-2.5 text-xs text-slate-600 font-medium">
                {tarea.producto && <p><strong>Producto Recomendado:</strong> {tarea.producto}</p>}
                {tarea.productoMedico && <p className="text-indigo-600 font-semibold">Insumo en Farmacia: {tarea.productoMedico.nombre} · stock {Number(tarea.productoMedico.stock || 0).toFixed(2)} {tarea.productoMedico.unidad}</p>}
                {tarea.condicion && <p><strong>Indicación Clínica:</strong> {tarea.condicion}</p>}
                {tarea.nota && <p className="text-slate-400 bg-white p-2.5 rounded-lg border border-slate-200/60 leading-relaxed font-normal">{tarea.nota}</p>}
              </div>
              <div className="space-y-2.5">
                <textarea
                  value={tarea.observacion || ''}
                  onChange={(e) => handleActualizarTareaSanidad(tarea.id, { observacion: e.target.value })}
                  placeholder="Escribe observaciones sanitarias o de dosis..."
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-xs min-h-[80px] bg-white transition-all shadow-inner"
                />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button type="button" onClick={() => handleActualizarTareaSanidad(tarea.id, { estado: 'omitido' })} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl transition-colors">
                    Omitir Paso
                  </button>
                  <button type="button" onClick={() => handleActualizarTareaSanidad(tarea.id, { estado: 'pendiente' })} className="bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold py-2 rounded-xl shadow-sm transition-colors">
                    Pendiente
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center leading-none">
              <HeartPulse size={28} className="text-rose-600 mr-3 filter drop-shadow-[0_0_8px_rgba(239,68,68,0.25)]" /> Control Sanitario
            </h2>
            <p className="text-slate-500 text-sm mt-1.5">Agenda médica, farmacia interna y protocolos sanitarios de los corrales activos.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-center text-xs font-black uppercase tracking-wider">
            <div className="bg-rose-50 border border-rose-100 rounded-xl px-3.5 py-2 shrink-0"><p className="text-lg text-rose-700 leading-none mb-1">{resumenAgenda.vencidas}</p><p className="text-[9px] text-rose-500">Vencidas</p></div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2 shrink-0"><p className="text-lg text-amber-700 leading-none mb-1">{resumenAgenda.hoy}</p><p className="text-[9px] text-amber-500">Hoy</p></div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2 shrink-0"><p className="text-lg text-blue-700 leading-none mb-1">{resumenAgenda.semana}</p><p className="text-[9px] text-blue-500">Semana</p></div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 shrink-0"><p className="text-lg text-slate-700 leading-none mb-1">{resumenAgenda.pendientes}</p><p className="text-[9px] text-slate-500">Pend.</p></div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3.5 py-2 shrink-0"><p className="text-lg text-indigo-700 leading-none mb-1">{alertasMedicas.length}</p><p className="text-[9px] text-indigo-500">Alertas</p></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)] overflow-hidden">
          <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50">
            {[
              { id: 'agenda', icon: Calendar, label: 'Agenda Médica' },
              { id: 'corrales', icon: Box, label: 'Corrales Clínicos' },
              { id: 'bodegaMedica', icon: Archive, label: 'Farmacia & Bodega' },
              { id: 'protocolos', icon: ClipboardList, label: 'Protocolos Sanitarios' },
            ].map(t => (
              <button key={t.id} onClick={() => setSanidadTab(t.id)} className={`flex items-center px-6 py-4 font-bold text-sm transition-colors border-b-2 shrink-0 ${sanidadTab === t.id ? 'border-rose-500 text-rose-700 bg-white shadow-[inset_0_-1px_0_white]' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                {React.createElement(t.icon, { size: 17, className: 'mr-2' })} {t.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {sanidadTab === 'agenda' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-4">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-lg">Agenda de Actividades Sanitarias</h3>
                    <p className="text-xs text-slate-500 mt-1">Monitorea las tareas programadas según la edad o llegada del lote. Haz clic en Detalle para más notas.</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                    {[
                      ['hoy', 'Hoy / Vencidas'],
                      ['semana', 'Semana'],
                      ['vencidas', 'Solo Vencidas'],
                      ['todas', 'Ver Todas'],
                    ].map(([id, label]) => (
                      <button key={id} onClick={() => setSanidadFiltro(id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150 ${sanidadFiltro === id ? 'bg-white text-slate-900 shadow-sm border border-slate-200/30' : 'text-slate-400 hover:text-slate-600'}`}>{label}</button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  {Object.entries(gruposAgenda).map(([grupo, tareas]) => (
                    <div key={grupo} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h4 className={`text-xs font-black uppercase tracking-widest ${grupo.startsWith('Vencida') ? 'text-rose-600' : 'text-slate-500'}`}>{grupo}</h4>
                        <div className="h-px flex-1 bg-slate-100" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">{tareas.length} tareas</span>
                      </div>
                      <div className="space-y-2.5">
                        {tareas.map(renderTareaAgenda)}
                      </div>
                    </div>
                  ))}
                  {agendaFiltrada.length === 0 && (
                    <div className="p-12 text-center text-slate-400 italic border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 max-w-lg mx-auto">
                      <Calendar size={32} className="mx-auto text-slate-300 mb-3" />
                      No hay tareas programadas para este rango. Todo está al día.
                    </div>
                  )}
                </div>
              </div>
            )}

            {sanidadTab === 'corrales' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {lotesActivos.map(lote => {
                  const corral = listCorrales.find(c => c.id === lote.corralId);
                  const tareas = tareasEnriquecidas.filter(t => t.loteId === lote.id);
                  const pendientes = tareas.filter(t => t.estado === 'pendiente').length;
                  const vencidas = tareas.filter(t => t.vencida).length;
                  const proxima = tareas.filter(t => t.estado === 'pendiente').sort((a, b) => a.diffDias - b.diffDias)[0];
                  const riesgo = getRiesgoSanitarioLote(lote);
                  const historial = getHistorialSanitarioLote(lote);
                  const riesgoClass = riesgo.nivel === 'alto'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : riesgo.nivel === 'medio'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  return (
                    <div key={lote.id} className="border border-slate-100 rounded-2xl bg-white p-5 shadow-[0_4px_25px_rgb(0,0,0,0.008)] hover:border-slate-200 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-extrabold text-slate-800 text-lg leading-tight">{corral?.nombre || 'Corral'}</h3>
                            <p className="text-xs text-slate-400 mt-1 font-medium">{lote.cantidad} iniciales • fecha ingreso: {lote.fechaIngreso}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`text-[9px] font-black uppercase tracking-wider border px-2.5 py-1 rounded-lg ${riesgoClass}`}>Riesgo {riesgo.nivel}</span>
                            <button type="button" onClick={() => handleGenerarProtocoloLote(lote)} className="text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-2.5 py-1 rounded-lg transition-colors">
                              Re-Generar
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 mb-4 text-center text-xs font-black">
                          <div className="bg-amber-50 border border-amber-100/50 rounded-xl p-2.5"><p className="text-base text-amber-700 leading-tight">{pendientes}</p><p className="text-[9px] font-bold uppercase text-amber-500 mt-0.5">Pend.</p></div>
                          <div className="bg-rose-50 border border-rose-100/50 rounded-xl p-2.5"><p className="text-base text-rose-700 leading-tight">{vencidas}</p><p className="text-[9px] font-bold uppercase text-rose-500 mt-0.5">Venc.</p></div>
                          <div className="bg-emerald-50 border border-emerald-100/50 rounded-xl p-2.5"><p className="text-base text-emerald-700 leading-tight">{tareas.filter(t => t.estado === 'hecho').length}</p><p className="text-[9px] font-bold uppercase text-emerald-500 mt-0.5">Hechas</p></div>
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5"><p className="text-base text-slate-700 leading-tight">{riesgo.score}</p><p className="text-[9px] font-bold uppercase text-slate-400 mt-0.5">Score</p></div>
                        </div>

                        {riesgo.nivel !== 'bajo' && (
                          <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-3 mb-4 text-xs text-amber-800 font-bold leading-relaxed shadow-sm">
                            ⚠️ Alertas: {[
                              riesgo.vencidas > 0 ? `${riesgo.vencidas} vencidas` : '',
                              riesgo.hoyPendientes > 0 ? `${riesgo.hoyPendientes} hoy` : '',
                              riesgo.bajas7 > 0 ? `${riesgo.bajas7} bajas recientes` : '',
                              riesgo.obsCriticas > 0 ? `${riesgo.obsCriticas} obs. críticas` : '',
                              riesgo.sinStock > 0 ? `${riesgo.sinStock} sin stock` : ''
                            ].filter(Boolean).join(' · ')}
                          </div>
                        )}

                        {proxima ? (
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-4 shadow-inner">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Próxima Tarea Programada</p>
                            <p className="font-extrabold text-slate-800 text-sm">{proxima.tarea}</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">{proxima.rango} · {proxima.fechaObjetivo}</p>
                          </div>
                        ) : (
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-4 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5 shadow-inner">
                            <CheckCircle size={14} /> Sin tareas sanitarias pendientes.
                          </div>
                        )}
                      </div>

                      {historial.length > 0 && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">Historial Sanitario Reciente</p>
                          <div className="space-y-2 text-xs max-h-36 overflow-y-auto scrollbar-thin pr-1">
                            {historial.map(item => (
                              <div key={item.id} className="grid grid-cols-[70px_1fr] gap-3 hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
                                <span className="font-bold text-slate-400">{item.fecha.substring(5)}</span>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-700 truncate leading-snug">{item.tipo}: {item.texto}</p>
                                  {item.detalle && <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.detalle}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {lotesActivos.length === 0 && (
                  <div className="lg:col-span-2 p-12 text-center text-slate-400 italic border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 max-w-lg mx-auto">
                    <Box size={32} className="mx-auto text-slate-300 mb-3" />
                    No hay corrales activos registrados en este momento.
                  </div>
                )}
              </div>
            )}

            {sanidadTab === 'bodegaMedica' && (
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
                            {lotesActivos.map(lote => {
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
                          {tareasPendientesParaAplicacion.map(t => (
                            <option key={t.id} value={t.id}>{t.corral?.nombre} · {t.fechaObjetivo} · {t.tarea}{t.productoMedico ? ` · sugerido: ${t.productoMedico.nombre}` : ''}</option>
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
                    <span className="text-[10px] text-emerald-400/90 font-bold uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Farmacia al Día</span>
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

            {sanidadTab === 'protocolos' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg">Protocolo Sanitario Base</h3>
                  <p className="text-xs text-slate-500 mt-1">Este calendario clínico estándar se aplicará a todos los nuevos lotes cuando ingreses un corral. Modifica los pasos según las pautas de tu veterinario.</p>
                </div>
                <div className="space-y-3">
                  {listProtocoloSanitario.sort((a, b) => (Number(a.dia) || 0) - (Number(b.dia) || 0)).map(paso => (
                    <div key={paso.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-50/50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs">
                        <div>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            <span className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">{paso.rango || `Día ${paso.dia}`}</span>
                            <span className="bg-rose-50 text-rose-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-rose-100">{paso.tipo || 'Sanidad'}</span>
                            {paso.duracion && <span className="bg-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">Duración: {paso.duracion}</span>}
                          </div>
                          <h4 className="font-extrabold text-slate-800 text-sm leading-tight">{paso.tarea}</h4>
                          {paso.producto && <p className="text-slate-600 mt-1.5"><strong>Producto Sugerido:</strong> {paso.producto}</p>}
                          {getProductoMedicoLigado(paso) && (
                            <p className="text-indigo-600 font-bold mt-1 font-mono">
                              Farmacia Ligada: {getProductoMedicoLigado(paso).nombre}
                            </p>
                          )}
                          {paso.condicion && <p className="text-slate-500 mt-1 text-[11px] leading-relaxed"><strong>Condición:</strong> {paso.condicion}</p>}
                          {paso.nota && <p className="text-slate-400 bg-white p-2.5 rounded-lg border border-slate-200/50 mt-2 leading-relaxed">{paso.nota}</p>}
                        </div>
                        <button onClick={() => handleEliminarPasoProtocolo(paso.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-1 rounded-md shrink-0 self-end md:self-start" title="Eliminar paso">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAgregarPasoProtocolo} className="bg-rose-50/30 border border-rose-200/60 rounded-2xl p-5 space-y-4 text-xs font-semibold">
                  <h4 className="text-rose-900 font-extrabold text-sm flex items-center gap-1.5"><Plus size={16} /> Agregar Paso Clínico al Protocolo Base</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-500 uppercase tracking-widest font-bold mb-1">Día de Aplicación</label>
                      <input type="number" name="dia" min="0" required placeholder="Día (ej. 7)" className="w-full p-2.5 border border-rose-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 bg-white text-slate-800 font-bold" />
                    </div>
                    <div>
                      <label className="block text-slate-500 uppercase tracking-widest font-bold mb-1">Rango Descriptivo</label>
                      <input name="rango" placeholder="Ej. Día 7-10" className="w-full p-2.5 border border-rose-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 bg-white" />
                    </div>
                    <div>
                      <label className="block text-slate-500 uppercase tracking-widest font-bold mb-1">Tipo de Actividad</label>
                      <input name="tipo" placeholder="Ej. Vacunación" className="w-full p-2.5 border border-rose-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 bg-white" />
                    </div>
                    <div>
                      <label className="block text-slate-500 uppercase tracking-widest font-bold mb-1">Duración (Frecuencia)</label>
                      <input name="duracion" placeholder="Ej. 1 revisión" className="w-full p-2.5 border border-rose-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-500 uppercase tracking-widest font-bold mb-1">Acción / Tarea Principal</label>
                    <input name="tarea" required placeholder="Ej. Aplicar Ivermectina 1% inyectable" className="w-full p-2.5 border border-rose-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 bg-white" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 uppercase tracking-widest font-bold mb-1">Producto Comercial Sugerido</label>
                      <input name="producto" placeholder="Ej. Ivermectina L.A." className="w-full p-2.5 border border-rose-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 bg-white" />
                    </div>
                    <div>
                      <label className="block text-slate-500 uppercase tracking-widest font-bold mb-1">Ligar a Fármaco de Farmacia</label>
                      <select name="productoMedicoId" className="w-full p-2.5 border border-rose-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 bg-white text-slate-700">
                        <option value="">Sin ligar</option>
                        {listCatalogoMedico.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-500 uppercase tracking-widest font-bold mb-1">Indicaciones Clínicas (Dosis, Cuándo aplicar)</label>
                    <textarea name="condicion" placeholder="Sarna, piojos o comezón..." className="w-full p-3 border border-rose-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 bg-white min-h-[76px]" />
                  </div>
                  <div>
                    <label className="block text-slate-500 uppercase tracking-widest font-bold mb-1">Advertencia o Nota Técnica</label>
                    <textarea name="nota" placeholder="Pesar bien para evitar sobredosis..." className="w-full p-3 border border-rose-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 bg-white min-h-[76px]" />
                  </div>
                  <button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-3 rounded-xl transition-all shadow-md shadow-rose-600/10 flex items-center justify-center gap-1.5"><Plus size={16} /> Guardar Paso Sanitario</button>
                </form>
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
      const ventasLote = [...listVentas.filter(v => v.loteId === lote.id)].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

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
      const costoAsignadoVendidos = cerdosVendidos * costoPorCerdoOperado;
      const costoAsignadoRestantes = cerdosRestantes * costoPorCerdoOperado;
      const utilidadVentasParciales = ingresosBrutos - costoAsignadoVendidos;
      const ventaProyectadaRestantes = Math.max(0, (stats?.proyeccionVentaFinal || 0) - ingresosBrutos);
      const costoFuturoRestantes = stats?.proyeccionCostoFaltante || 0;
      const utilidadProyectadaRestantes = ventaProyectadaRestantes - costoAsignadoRestantes - costoFuturoRestantes;
      const pesoFinalRestantesLb = cerdosRestantes * Math.max(stats?.pesoActual || 0, stats?.pesoObjetivoLb || 0);
      const puntoEquilibrioRestantes = pesoFinalRestantesLb > 0 ? (costoAsignadoRestantes + costoFuturoRestantes) / pesoFinalRestantesLb : 0;
      const ventasDetalle = ventasLote.map((venta) => {
        const libras = getVentaLibras(venta);
        const cantidad = Number(venta.cantidadCerdos) || 0;
        const costoAsignado = cantidad * costoPorCerdoOperado;
        return {
          ...venta,
          libras,
          pesoPromedio: cantidad > 0 ? libras / cantidad : 0,
          costoAsignado,
          utilidadEstimada: (Number(venta.totalVenta) || 0) - costoAsignado
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
        utilidadVentasParciales,
        ventaProyectadaRestantes,
        costoFuturoRestantes,
        utilidadProyectadaRestantes,
        puntoEquilibrioRestantes,
        pesoActual: stats?.pesoActual || 0,
        pesoObjetivo: stats?.pesoObjetivoLb || 0,
        fca: stats?.fca || 0,
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
      lbsCarneVendida: acc.lbsCarneVendida + r.lbsCarneVendida,
      costoLechones: acc.costoLechones + r.costoLechones,
      costoAlimento: acc.costoAlimento + r.costoAlimento,
      costoMedicinas: acc.costoMedicinas + r.costoMedicinas,
      costoGastos: acc.costoGastos + r.costoGastos,
      costoManoObra: acc.costoManoObra + r.costoManoObra,
    }), {
      inversionTotal: 0, ingresosBrutos: 0, utilidadRealVentas: 0, valorEstimadoVivos: 0, utilidadNeta: 0, lbsCarneVendida: 0,
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

    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
        {/* ENCABEZADO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center leading-none">
              <DollarSign size={28} className="text-emerald-600 mr-3 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.25)]" /> Finanzas Globales
            </h2>
            <p className="text-slate-500 text-sm mt-1.5">
              Análisis de rentabilidad histórica — ${resumenPorLote.length} lotes (${lotesActivos} activos · ${lotesCerrados} cerrados)
            </p>
          </div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shrink-0 self-start md:self-auto">
            Datos consolidados
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 leading-none">Inversión Histórica</p>
            <p className="text-2xl font-black text-slate-800 leading-tight">{formatearMoneda(totGlobal.inversionTotal)}</p>
            <div className="mt-3.5 flex flex-wrap gap-1">
              {costItems.filter(c => c.value > 0).map(c => (
                <span key={c.label} className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md">{c.label}</span>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 leading-none">Ingresos Brutos</p>
            <p className="text-2xl font-black text-emerald-600 leading-tight">{formatearMoneda(totGlobal.ingresosBrutos)}</p>
            <p className="text-xs text-slate-500 mt-2 font-medium">{totGlobal.lbsCarneVendida.toFixed(0)} lbs vendidas</p>
          </div>

          <div className={`border rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] ${totGlobal.utilidadRealVentas >= 0 ? 'bg-emerald-50/60 border-emerald-100' : 'bg-rose-50/60 border-rose-100'}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 leading-none">Utilidad Realizada</p>
            <p className={`text-2xl font-black leading-tight ${totGlobal.utilidadRealVentas >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{formatearMoneda(totGlobal.utilidadRealVentas)}</p>
            <p className={`text-xs font-bold mt-2 ${totGlobal.utilidadRealVentas >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>Margen: {margenGlobal.toFixed(1)}%</p>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 leading-none">Utilidad Estimada</p>
            <p className={`text-2xl font-black leading-tight ${totGlobal.utilidadNeta >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
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
                                      <div className="flex justify-between"><span className="text-slate-500">Peso Promedio Actual</span><strong>{r.pesoActual > 0 ? `${r.pesoActual.toFixed(1)} lb` : 'Sin peso'}</strong></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Peso Objetivo</span><strong>{r.pesoObjetivo.toFixed(0)} lb</strong></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Conversión (FCA)</span><strong>{r.fca > 0 ? r.fca.toFixed(2) : '—'}</strong></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Carne Vendida</span><strong>{r.lbsCarneVendida.toFixed(1)} lb</strong></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Utilidad Ventas Parciales</span><strong className={r.utilidadVentasParciales >= 0 ? 'text-emerald-700' : 'text-rose-600'}>{formatearMoneda(r.utilidadVentasParciales)}</strong></div>
                                      <div className="flex justify-between border-t border-slate-100 pt-2"><span className="text-slate-500">Utilidad Proyectada Restantes</span><strong className={r.utilidadProyectadaRestantes >= 0 ? 'text-emerald-700' : 'text-rose-600'}>{formatearMoneda(r.utilidadProyectadaRestantes)}</strong></div>
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
                                              <td className="py-2 px-3 text-right font-bold text-amber-600">-{formatearMoneda(venta.costoAsignado)}</td>
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
      </div>
    );
  };
  if (!isAppReady) {
    return (
      <div className="h-dvh w-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <PiggyBank size={80} className="text-emerald-400 mb-6 animate-bounce shadow-emerald-500/20 drop-shadow-2xl" />
        <h2 className="text-3xl font-black">Conectando a la Nube...</h2>
        <p className="text-slate-400 mt-2 font-medium">Sincronizando granja de forma compartida</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh bg-slate-100 font-sans text-slate-800 overflow-hidden">
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
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      <aside className={`fixed inset-y-0 left-0 z-40 w-[min(18rem,86vw)] bg-[#090d16]/95 border-r border-slate-800/80 text-slate-400 flex flex-col shadow-2xl transform transition-transform duration-300 ease-in-out lg:relative lg:w-72 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-center bg-slate-950/20">
          <div className="flex items-center space-x-3 text-emerald-400">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <PiggyBank size={30} className="text-emerald-400 filter drop-shadow-[0_0_6px_rgba(52,211,153,0.3)]" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white leading-none">Porcicontrol</h1>
              <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500/70 mt-1">ERP Granja Porcina</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-7 overflow-y-auto mt-4 flex flex-col">
          <div>
            <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3">Operaciones</p>
            <div className="space-y-1.5">
              <button onClick={() => { setVista('dashboard'); setCorralSeleccionado(null); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-semibold ${vista === 'dashboard' ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border-l-4 border-emerald-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]' : 'hover:bg-slate-800/40 hover:text-slate-200'}`}>
                <LayoutDashboard size={18} className="mr-3" /> Panel Principal
              </button>

              <button onClick={() => { setVista('bodega'); setCorralSeleccionado(null); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-semibold ${vista === 'bodega' ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border-l-4 border-emerald-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]' : 'hover:bg-slate-800/40 hover:text-slate-200'}`}>
                <Archive size={18} className="mr-3" /> Bodega Central
              </button>

              <button onClick={() => { setVista('controlSanitario'); setCorralSeleccionado(null); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-semibold ${vista === 'controlSanitario' ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border-l-4 border-emerald-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]' : 'hover:bg-slate-800/40 hover:text-slate-200'}`}>
                <HeartPulse size={18} className="mr-3" /> Control Sanitario
              </button>

              <button onClick={() => { setVista('finanzasGlobales'); setCorralSeleccionado(null); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-semibold ${vista === 'finanzasGlobales' ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border-l-4 border-emerald-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]' : 'hover:bg-slate-800/40 hover:text-slate-200'}`}>
                <DollarSign size={18} className="mr-3" /> Finanzas Globales
              </button>

              <button onClick={() => { setVista('rutinaDiaria'); setCorralSeleccionado(null); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-semibold ${vista === 'rutinaDiaria' ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border-l-4 border-emerald-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]' : 'hover:bg-slate-800/40 hover:text-slate-200'}`}>
                <CheckSquare size={18} className="mr-3" /> Rutina Diaria
              </button>
            </div>
          </div>

          <div>
            <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3">Administración</p>
            <div className="space-y-1.5">
              <button onClick={() => { setVista('historial'); setCorralSeleccionado(null); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-semibold ${vista === 'historial' ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border-l-4 border-emerald-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]' : 'hover:bg-slate-800/40 hover:text-slate-200'}`}>
                <ClipboardList size={18} className="mr-3" /> Historial de Lotes
              </button>

              <button onClick={() => { setVista('config'); setCorralSeleccionado(null); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-semibold ${vista === 'config' ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border-l-4 border-emerald-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]' : 'hover:bg-slate-800/40 hover:text-slate-200'}`}>
                <Settings size={18} className="mr-3" /> Ajustes y Fórmulas
              </button>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800/60">
            <div className="px-4 py-3 mb-3 bg-slate-900/50 rounded-xl border border-slate-800/60 flex flex-col">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Usuario</span>
              <span className="text-xs text-slate-300 font-semibold truncate mt-0.5">{user.email || 'Google User'}</span>
            </div>
            <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center px-4 py-3 rounded-xl transition-all duration-200 font-bold bg-rose-500/10 hover:bg-rose-600 hover:text-slate-950 text-rose-400 border border-rose-500/20">
              <LogOut size={16} className="mr-2" /> Cerrar Sesión
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1 flex flex-col h-dvh overflow-hidden">
        <header className="bg-white border-b border-slate-100 px-3 py-3 sm:p-4 lg:p-5 flex flex-wrap gap-2 items-center justify-between relative z-10 shadow-[0_2px_15px_rgba(0,0,0,0.015)]">
          <div className="flex items-center min-w-0">
            <button onClick={() => setIsSidebarOpen(true)} className="mr-3 lg:hidden text-slate-500 hover:text-emerald-600 p-2 bg-slate-50 border border-slate-100 rounded-xl transition-colors shrink-0">
              <Menu size={20} />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center min-w-0 truncate">
              {vista === 'dashboard' && <><LayoutDashboard size={18} className="mr-2 text-emerald-600" /> Panel Principal</>}
              {vista === 'bodega' && <><Archive size={18} className="mr-2 text-amber-600" /> Bodega Central Unificada</>}
              {vista === 'controlSanitario' && <><HeartPulse size={18} className="mr-2 text-rose-600" /> Control Sanitario</>}
              {vista === 'rutinaDiaria' && <><CheckSquare size={18} className="mr-2 text-emerald-600" /> Rutina Diaria</>}
              {vista === 'corralDetail' && <><Box size={18} className="mr-2 text-emerald-600" /> Control de Corral</>}
              {vista === 'historial' && <><ClipboardList size={18} className="mr-2 text-indigo-600" /> Historial de Lotes Finalizados</>}
              {vista === 'reporteHistorial' && <><ClipboardList size={18} className="mr-2 text-indigo-600" /> Visor de Reporte Histórico</>}
              {vista === 'config' && <><Settings size={18} className="mr-2 text-blue-600" /> Ajustes</>}
              {vista === 'prepararVenta' && <><Receipt size={18} className="mr-2 text-slate-600" /> Báscula de Venta</>}
              {vista === 'resumenVenta' && <><PieChart size={18} className="mr-2 text-slate-600" /> Reportes de Venta</>}
              {vista === 'imprimirFicha' && <><Printer size={18} className="mr-2 text-slate-600" /> Ficha de Trazabilidad</>}
              {vista === 'finanzasGlobales' && <><DollarSign size={18} className="mr-2 text-emerald-600" /> Finanzas Globales</>}
            </h2>
          </div>
          <div className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest truncate max-w-full">{new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </header>
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative bg-slate-50/50">
          {vista === 'dashboard' && renderDashboard()}
          {vista === 'bodega' && renderBodega()}
          {vista === 'controlSanitario' && renderControlSanitario()}
          {vista === 'rutinaDiaria' && renderRutinaDiaria()}
          {vista === 'laboratorio' && renderLaboratorio()}
          {vista === 'historial' && renderHistorial()}
          {vista === 'config' && renderConfiguracion()}
          {vista === 'corralDetail' && renderCorralDetail()}
          {vista === 'prepararVenta' && renderPrepararVenta()}
          {vista === 'resumenVenta' && renderResumenVenta()}
          {vista === 'imprimirFicha' && renderFichaCorral()}
          {vista === 'reporteHistorial' && renderReporteHistorial()}
          {vista === 'finanzasGlobales' && renderFinanzasGlobales()}
        </div>

        {/* CHATBOT FLOTANTE IA */}
        <div className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end">
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
            className={`${isChatOpen ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/10 hover:shadow-emerald-500/20'} p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-slate-800/20 flex items-center justify-center`}
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
  const [membership, setMembership] = useState(undefined);
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

  useEffect(() => {
    if (!user) {
      setMembership(undefined);
      return undefined;
    }

    // BYPASS DE DESARROLLO LOCAL
    if (window.location.hostname === 'localhost' || globalAppId === 'agrocontrol-local') {
      setMembership({ active: true, role: 'admin' });
      return undefined;
    }

    const membershipRef = doc(db, 'artifacts', globalAppId, 'members', user.uid);
    return onSnapshot(
      membershipRef,
      snapshot => setMembership(snapshot.exists() ? snapshot.data() : null),
      error => {
        console.error('Error verificando membresía:', error);
        setMembership(null);
      }
    );
  }, [user]);

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
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <PiggyBank size={80} className="text-emerald-400 mb-6 animate-pulse drop-shadow-2xl" />
        <h2 className="text-2xl font-bold">Cargando Porcicontrol...</h2>
      </div>
    );
  }

  if (user && membership === undefined) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <PiggyBank size={80} className="text-emerald-400 mb-6 animate-pulse" />
        <h2 className="text-2xl font-bold">Verificando acceso...</h2>
      </div>
    );
  }

  if (user && (!membership?.active || !['admin', 'operator', 'viewer'].includes(membership?.role))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertTriangle size={48} className="mx-auto text-amber-500 mb-4" />
          <h1 className="text-2xl font-black text-slate-800">Cuenta sin acceso</h1>
          <p className="text-slate-600 my-4">Tu cuenta está autenticada, pero todavía no pertenece a esta granja. Un administrador debe agregarte como miembro.</p>
          <p className="text-xs text-slate-400 mb-6 break-all">UID: {user.uid}</p>
          <button onClick={() => signOut(auth)} className="bg-slate-800 text-white px-5 py-3 rounded-xl font-bold">Cerrar sesión</button>
        </div>
      </div>
    );
  }

  // SI NO HAY USUARIO, MOSTRAMOS LA PANTALLA DE LOGIN HÍBRIDA (DISEÑO PREMIUM GLOW)
  if (!user) {
    return (
      <div className="min-h-dvh w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-3 sm:p-4 font-sans text-slate-100 relative overflow-hidden">
        {/* Luces de Fondo Difusas */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-md w-full bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl sm:rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-500">
          <div className="p-5 sm:p-8 text-center border-b border-slate-800 bg-slate-950/20 relative">
            <div className="relative z-10 flex flex-col items-center">
              <div className="bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 p-4 rounded-2xl mb-4 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <PiggyBank size={48} className="text-emerald-400 filter drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white leading-none">Porcicontrol</h1>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mt-2">ERP Porcino Multiusuario</p>
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

              <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-extrabold py-3.5 rounded-xl shadow-lg shadow-emerald-500/10 transition-all transform hover:-translate-y-0.5 duration-200 mt-2">
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

