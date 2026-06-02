import React, { useState, useMemo, useEffect } from 'react';
import {
  Settings, Plus, Activity, Syringe, Wheat, Scale, Calendar, Users,
  ChevronRight, ClipboardList, CheckCircle, Trash2, TrendingUp, PiggyBank,
  AlertTriangle, HeartPulse, Receipt, PieChart, Calculator, Leaf, Printer, X, Clock,
  Archive, Box, LayoutDashboard, DollarSign, BookOpen, AlertCircle,
  CheckSquare, Beaker, ShoppingCart, FileText, Download, LogOut, Menu
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// (La importación de App.css ha sido omitida para evitar errores de compilación en este entorno. 
// En tu VS Code local, puedes volver a colocar: import './App.css'; si lo necesitas).

// --- IMPORTACIONES DE FIREBASE NUBE ---
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithCustomToken,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, enableIndexedDbPersistence } from 'firebase/firestore';

// ============================================================================
// 1. TU CONFIGURACIÓN DE FIREBASE (Proyecto: agroporcina)
// ============================================================================
const localFirebaseConfig = {
  apiKey: "AIzaSyCA5_C3pPeR4wmcBh_l9KoeYxkK1hYWqeY",
  authDomain: "agroporcina.firebaseapp.com",
  projectId: "agroporcina",
  storageBucket: "agroporcina.firebasestorage.app",
  messagingSenderId: "801753998722",
  appId: "1:801753998722:web:9e16157c0a157662e81b9b",
  measurementId: "G-6WJWTY0545"
};

// Lógica de compatibilidad para funcionar tanto en local como en este entorno de prueba
const envConfig = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
let firebaseConfig = localFirebaseConfig;
if (envConfig) {
  firebaseConfig = typeof envConfig === 'string' ? JSON.parse(envConfig) : envConfig;
}

// Inicializar Firebase y Proveedores
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
  const [state, setStateInternal] = useState(initialValue);
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
        if (Array.isArray(initialValue) && !Array.isArray(data)) {
          setStateInternal(initialValue);
        } else {
          setStateInternal(data !== undefined ? data : initialValue);
        }
      } else {
        setStateInternal(initialValue);
      }
      setIsLoaded(true);
    }, (error) => {
      console.error("Error conectando a la base de datos:", key, error);
      setIsLoaded(true);
    });

    return () => unsubscribe();
  }, [key, user, dbInstance, appId]);

  const setValue = async (value) => {
    try {
      const valueToStore = value instanceof Function ? value(state) : value;
      setStateInternal(valueToStore); // Actualización optimista (inmediata en pantalla)

      if (user && dbInstance && appId) {
        // Al guardar, lo enviamos a la carpeta compartida
        const docRef = doc(dbInstance, 'artifacts', appId, 'public', 'data', 'granja_compartida', key);
        await setDoc(docRef, { data: valueToStore }); // Guarda en la nube
      }
    } catch (error) {
      console.error("Error guardando en la nube:", key, error);
    }
  };

  return [state, setValue, isLoaded];
}

// --- DATOS POR DEFECTO ---
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

const CRONOGRAMA_ALIMENTACION = [
  { fase: 1, alimento: 'VITALECHON 1', diaInicio: 1, diaFin: 11, consumoTotalLb: 6.6 },
  { fase: 2, alimento: 'VITALECHON 2', diaInicio: 12, diaFin: 21, consumoTotalLb: 11.0 },
  { fase: 3, alimento: 'VITALECHON 3', diaInicio: 22, diaFin: 28, consumoTotalLb: 11.0 },
  { fase: 4, alimento: 'VITALECHON 4', diaInicio: 29, diaFin: 49, consumoTotalLb: 48.4 },
  { fase: 5, alimento: 'VITACERDO 1', diaInicio: 50, diaFin: 70, consumoTotalLb: 74.8 },
  { fase: 6, alimento: 'VITACERDO 2', diaInicio: 71, diaFin: 105, consumoTotalLb: 175.1 },
  { fase: 7, alimento: 'VITACERDO 3', diaInicio: 106, diaFin: 133, consumoTotalLb: 169.5 },
];

const INITIAL_CRONOGRAMA_SANIDAD = [
  { id: 'cs1', dia: 3, tarea: 'Aplicación de Hierro (2cc por lechón)' },
  { id: 'cs2', dia: 21, tarea: 'Vacunación Mycoplasma / Circovirus' },
  { id: 'cs3', dia: 45, tarea: 'Desparasitación Interna y Externa' },
];

const addDaysToDate = (dateStr, days) => {
  const result = new Date(dateStr + 'T00:00:00');
  result.setDate(result.getDate() + days);
  return result.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });
};

const safeArr = (val, fallback = []) => Array.isArray(val) ? val : fallback;

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
  const [cronogramaSanidadBase, setCronogramaSanidadBase, l6] = useCloudStorage('agro_cronogramabase', INITIAL_CRONOGRAMA_SANIDAD, user, db, appId);

  const [corrales, setCorrales, l7] = useCloudStorage('agro_corrales', [
    { id: 'c1', nombre: 'Corral 1', capacidad: 15 },
    { id: 'c2', nombre: 'Corral 2', capacidad: 15 },
    { id: 'c3', nombre: 'Corral 3', capacidad: 15 },
    { id: 'c4', nombre: 'Corral 4', capacidad: 15 },
  ], user, db, appId);

  const [lotes, setLotes, l8] = useCloudStorage('agro_lotes', [], user, db, appId);
  const [pesos, setPesos, l9] = useCloudStorage('agro_pesos', [], user, db, appId);
  const [alimentos, setAlimentos, l10] = useCloudStorage('agro_alimentos', [], user, db, appId);
  const [vacunas, setVacunas, l11] = useCloudStorage('agro_vacunas', [], user, db, appId);
  const [bajas, setBajas, l12] = useCloudStorage('agro_bajas', [], user, db, appId);
  const [gastosExtra, setGastosExtra, l13] = useCloudStorage('agro_gastosextra', [], user, db, appId);
  const [comprasBodega, setComprasBodega, l14] = useCloudStorage('agro_bodega', [], user, db, appId);
  const [tareasSanidad, setTareasSanidad, l15] = useCloudStorage('agro_tareassanidad', [], user, db, appId);
  const [ventas, setVentas, l16] = useCloudStorage('agro_ventas', [], user, db, appId);
  const [constanteSchaeffer, setConstanteSchaeffer, l17] = useCloudStorage('agro_constante_schaeffer', 400, user, db, appId);
  const [notificacionesPush, setNotificacionesPush, l18] = useCloudStorage('agro_notificaciones_push', [], user, db, appId);

  // PANTALLA DE CARGA MIENTRAS SE CONECTA A FIREBASE
  const isAppReady = l1 && l2 && l3 && l4 && l5 && l6 && l7 && l8 && l9 && l10 && l11 && l12 && l13 && l14 && l15 && l16 && l17 && l18;

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
  const listTareas = safeArr(tareasSanidad);
  const listVentas = safeArr(ventas);
  const listCronoBase = safeArr(cronogramaSanidadBase, INITIAL_CRONOGRAMA_SANIDAD);

  // --- NAVEGACIÓN Y PANTALLAS ---
  const [vista, setVista] = useState('dashboard');
  const [corralSeleccionado, setCorralSeleccionado] = useState(null);
  const [loteHistorialSeleccionado, setLoteHistorialSeleccionado] = useState(null);
  const [tabActiva, setTabActiva] = useState('resumen');
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
  }, [isAppReady, listCatAlimentos]);

  const emitirNotificacionPush = (mensaje) => {
    const userName = user?.displayName || user?.email?.split('@')[0] || 'Un usuario';
    const nueva = { id: `notif_${Date.now()}`, mensaje: `${userName}: ${mensaje}`, clientId: CLIENT_ID, fecha: Date.now() };
    setNotificacionesPush(prev => {
      const validas = (prev || []).filter(n => (Date.now() - n.fecha) < 24 * 60 * 60 * 1000);
      return [...validas.slice(-49), nueva];
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
          new Notification('AgroControl Porcino', { body: ultima.mensaje });
        }
      }
    }
  }, [notificacionesPush, isAppReady, CLIENT_ID]);

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

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;

    // Agregar el mensaje del usuario a la vista
    const userMessage = { role: 'user', content: chatInput };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // 1. INYECCIÓN DE CONTEXTO EN TIEMPO REAL
      const statsLotesActivos = listLotes.filter(l => l.estado === 'Activo').map(lote => {
        const stats = calcularEstadisticasLote(lote);
        const corral = listCorrales.find(c => c.id === lote.corralId);
        return {
          corral: corral ? corral.nombre : 'Desconocido',
          cerdosActuales: stats.cantidadActual,
          mortalidadPorcentaje: stats.mortalidadPorcentaje.toFixed(1) + '%',
          conversionFCA: stats.fca.toFixed(2),
          utilidadNetaActual: formatearMoneda(stats.utilidadNeta),
          diasEnEngorda: stats.diasLote,
          pesoPromedioActualLb: stats.pesoActual
        };
      });

      const inventarioResumen = inventarioCentral.map(i => ({ nombre: i.nombre, stockLbs: i.stockLbs.toFixed(1) }));

      const contextoGranja = {
        inventario: inventarioResumen,
        corralesActivosStats: statsLotesActivos,
        factorSchaeffer: constanteSchaeffer,
      };

      const systemPrompt = `Eres el Ingeniero Agrónomo, Zootecnista y experto financiero virtual integrado en Porcicontrol. Tienes acceso al estado en tiempo real de mi granja en este JSON. 

REGLAS ESTRICTAS:
1. Usa formato Markdown SIEMPRE (negritas, listas, emojis).
2. Si te preguntan sobre el estado de la granja, menciona métricas explícitas como la Conversión Alimenticia (FCA), Utilidad y Mortalidad de los corrales activos usando la información del JSON.
3. Sé amigable pero muy profesional y analítico. Da consejos accionables basados en el FCA y Mortalidad.
4. NO inventes datos de los corrales. Separa consejos médicos de financieros.

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

      // 2. LLAMADA A LA API DE GEMINI
      const API_KEY = "AIzaSyDyXIsSd3yWHWGecCbRuLyKrkyc2DCxpFA";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: geminiHistory
        })
      });

      const data = await response.json();

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
      setPesos([...listPesos, nuevoPeso]);
      emitirNotificacionPush(`Nuevo peso registrado: ${parseFloat(pesoLb).toFixed(2)} lb en Lote activo.`);
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

  // --- IMPRESIÓN PDF SEGURA ---
  const descargarPDF = (elementoId, nombreArchivo) => {
    const element = document.getElementById(elementoId);
    if (!element) return;
    mostrarAlerta("Generando PDF", "El documento se está procesando. Por favor, espera...");
    const opt = { margin: 0.4, filename: nombreArchivo, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };

    if (typeof window.html2pdf !== 'undefined') {
      window.html2pdf().set(opt).from(element).save();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => { window.html2pdf().set(opt).from(element).save(); };
      document.body.appendChild(script);
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

  const ordenCompraLista = useMemo(() => {
    const necesidadesGlobales = new Map();

    listLotes.filter(l => l.estado === 'Activo').forEach(lote => {
      const stats = calcularEstadisticasLote(lote);
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
  }, [listLotes, listAlimentos, inventarioCentral, listFormulas, listCatAlimentos, listCatIngredientes]);

  // --- ESTADÍSTICAS DEL LOTE ---
  function calcularEstadisticasLote(lote, muertesExtraHipoteticas = 0) {
    if (!lote) return null;
    const bajasLote = listBajas.filter(b => b.loteId === lote.id);
    const alimentosLote = listAlimentos.filter(a => a.loteId === lote.id);
    const ventasLote = listVentas.filter(v => v.loteId === lote.id);

    const cerdosVendidos = ventasLote.reduce((acc, v) => acc + (v.cantidadCerdos || 0), 0);
    const cantidadActual = Math.max(0, (lote.cantidad || 0) - bajasLote.reduce((s, b) => s + (b.cantidad || 0), 0) - cerdosVendidos);
    const cantidadParaProyeccion = Math.max(0, cantidadActual - muertesExtraHipoteticas);

    const fSalida = lote.fechaSalida ? new Date(lote.fechaSalida + 'T00:00:00') : new Date();
    const fIngreso = lote.fechaIngreso ? new Date(lote.fechaIngreso + 'T00:00:00') : new Date();
    let diasLote = Math.ceil(Math.abs(fSalida - fIngreso) / (1000 * 60 * 60 * 24));
    if (isNaN(diasLote) || diasLote < 1) diasLote = 1;

    const pesosLote = listPesos.filter(p => p.loteId === lote.id).sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    const pesoActual = pesosLote.length > 0 ? (pesosLote[0].pesoPromedio || 0) : 0;
    const pesoInicial = pesosLote.length > 0 ? (pesosLote[pesosLote.length - 1].pesoPromedio || 0) : 0;

    const gananciaTotalLb = pesoActual - pesoInicial;
    const adg = gananciaTotalLb / diasLote;
    const consumoTotalLb = alimentosLote.reduce((s, a) => s + (a.cantidadLb || 0), 0);

    const fca = (gananciaTotalLb * cantidadActual) > 0 ? (consumoTotalLb / (gananciaTotalLb * cantidadActual)) : 0;
    const cerdosComprados = lote.cantidad || 1;
    const mortalidadPorcentaje = ((cerdosComprados - (cerdosComprados - bajasLote.reduce((s, b) => s + (b.cantidad || 0), 0))) / cerdosComprados) * 100;

    const costoInvertidoTotal = ((lote.cantidad || 0) * (lote.costoLechon || 0)) + alimentosLote.reduce((s, a) => s + (a.costo || 0), 0) + listVacunas.filter(v => v.loteId === lote.id).reduce((s, v) => s + (v.costo || 0), 0) + listGastosExtra.filter(g => g.loteId === lote.id).reduce((s, g) => s + (g.monto || 0), 0);
    const ingresosRealesVentas = ventasLote.reduce((acc, v) => acc + (v.totalVenta || 0), 0);
    const ingresoTotalFinal = ingresosRealesVentas + (pesoActual * cantidadActual * (lote.precioVentaLibra || 0));
    const utilidadNeta = ingresoTotalFinal - costoInvertidoTotal - (lote.manoObra || 0);

    const pesoObjetivoLb = 220;
    let proyeccionVentaFinal = 0, proyeccionUtilidadFinal = 0, proyeccionLibrasFaltantes = 0, proyeccionAlimentoFaltante = 0, proyeccionCostoFaltante = 0;

    if (pesoActual < pesoObjetivoLb && cantidadParaProyeccion > 0) {
      proyeccionLibrasFaltantes = (pesoObjetivoLb - pesoActual) * cantidadParaProyeccion;
      proyeccionAlimentoFaltante = proyeccionLibrasFaltantes * (fca > 0 ? fca : 2.5);
      proyeccionCostoFaltante = proyeccionAlimentoFaltante * ((listCatAlimentos.find(a => a.nombre.includes('VITACERDO 3'))?.precioSaco || 259) / 100);
      proyeccionVentaFinal = (pesoObjetivoLb * cantidadParaProyeccion * (lote.precioVentaLibra || 0)) + ingresosRealesVentas;
      proyeccionUtilidadFinal = proyeccionVentaFinal - (costoInvertidoTotal + proyeccionCostoFaltante + (lote.manoObra || 0));
    } else {
      proyeccionUtilidadFinal = utilidadNeta;
      proyeccionVentaFinal = ingresoTotalFinal;
    }

    const estaListoParaMezclas = pesoActual >= (pesoAlertaMezcla || 100);

    return {
      cantidadActual, diasLote, pesoInicial, pesoActual, adg, consumoTotalLb, fca, mortalidadPorcentaje,
      costoLechones: (lote.cantidad || 0) * (lote.costoLechon || 0),
      costoAlimento: alimentosLote.reduce((s, a) => s + (a.costo || 0), 0),
      costoAlimentoTolva: alimentosLote.filter(a => !a.esSuplemento).reduce((s, a) => s + (a.costo || 0), 0),
      costoAlimentoSuplemento: alimentosLote.filter(a => a.esSuplemento).reduce((s, a) => s + (a.costo || 0), 0),
      totalSanidad: listVacunas.filter(v => v.loteId === lote.id).reduce((s, v) => s + (v.costo || 0), 0),
      totalGastosExtras: listGastosExtra.filter(g => g.loteId === lote.id).reduce((s, g) => s + (g.monto || 0), 0),
      costoInvertidoTotal, ingresoEstimado: ingresoTotalFinal, utilidadNeta,
      proyeccionLibrasFaltantes, proyeccionAlimentoFaltante, proyeccionCostoFaltante,
      ventasLote, proyeccionVentaFinal, proyeccionUtilidadFinal, pesoObjetivoLb,
      estaListoParaMezclas, cantidadParaProyeccion
    };
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
  const handleAgregarCorral = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setCorrales([...listCorrales, { id: `c_${Date.now()}`, nombre: fd.get('nombre'), capacidad: parseInt(fd.get('capacidad')) }]);
    e.target.reset();
  };

  const handleEliminarCorral = (id) => {
    if (getLoteActivo(id)) return mostrarAlerta("Corral en Uso", "No se puede eliminar un corral que tiene un lote activo.");
    pedirConfirmacion("Eliminar Corral", "¿Estás seguro de eliminar este corral? Esta acción no se puede deshacer.", () => {
      setCorrales(listCorrales.filter(c => c.id !== id));
    });
  };

  const handleEliminarDato = (tipo, id) => {
    pedirConfirmacion("Eliminar Registro", "¿Deseas borrar este registro de forma permanente?", () => {
      if (tipo === 'alimento') setAlimentos(listAlimentos.filter(a => a.id !== id));
      if (tipo === 'peso') setPesos(listPesos.filter(p => p.id !== id));
      if (tipo === 'sanidad') setTareasSanidad(listTareas.filter(t => t.id !== id));
      if (tipo === 'vacuna') setVacunas(listVacunas.filter(v => v.id !== id));
      if (tipo === 'gasto') setGastosExtra(listGastosExtra.filter(g => g.id !== id));
      if (tipo === 'baja') setBajas(listBajas.filter(b => b.id !== id));
      if (tipo === 'bodega') setComprasBodega(listCompras.filter(b => b.id !== id));
    });
  };

  const handleActualizarMetaSuplemento = (loteId, faseNum, porcentajeStr) => {
    const porc = parseFloat(porcentajeStr);
    setLotes(listLotes.map(l => {
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
    const nuevo = { id: `cat_${Date.now()}`, nombre: fd.get('nombre').toUpperCase(), precioSaco: parseFloat(fd.get('precio')), librasPorSaco: parseFloat(fd.get('libras')) };
    setCatalogoAlimento([...listCatAlimentos, nuevo]);
    e.target.reset();
    mostrarAlerta("Éxito", "Nuevo producto agregado al catálogo de concentrados.");
  };

  const handleEliminarAlimentoCatalogo = (id) => {
    pedirConfirmacion("Eliminar del Catálogo", "¿Estás seguro de eliminar este producto? Desaparecerá de las opciones.", () => { setCatalogoAlimento(listCatAlimentos.filter(item => item.id !== id)); });
  };

  const handleAgregarIngredienteCatalogo = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nuevo = { id: `ing_${Date.now()}`, nombre: fd.get('nombre').toUpperCase(), precioSaco: parseFloat(fd.get('precio')), librasPorSaco: parseFloat(fd.get('libras')) };
    setCatalogoIngredientes([...listCatIngredientes, nuevo]);
    e.target.reset();
    mostrarAlerta("Éxito", "Nuevo ingrediente extra agregado al catálogo.");
  };

  const handleEliminarIngredienteCatalogo = (id) => {
    pedirConfirmacion("Eliminar Ingrediente", "¿Estás seguro de eliminar este ingrediente de tu catálogo?", () => { setCatalogoIngredientes(listCatIngredientes.filter(item => item.id !== id)); });
  };

  const handleAgregarReglaMezcla = (e) => {
    e.preventDefault();
    setReglasMezcla([...listReglasMezcla, { id: Date.now(), base: formReglaBase, aditivo: formReglaAditivo, factor: parseFloat(formReglaFactor) }]);
    mostrarAlerta("Regla Agregada", "El aditivo se calculará automáticamente en el formulador.");
  };

  const handleEliminarReglaMezcla = (id) => {
    setReglasMezcla(listReglasMezcla.filter(r => r.id !== id));
  };

  const handleAgregarIngredienteFormula = (e) => {
    e.preventDefault();
    if (!formIngrediente || !formPorcentaje) return mostrarAlerta("Error", "Selecciona un ingrediente y un porcentaje.");
    setFormulasEtapas(listFormulas.map(f => {
      if (f.fase !== faseFormEdicion) return f;
      if (safeArr(f.ingredientes).find(i => i.nombre === formIngrediente)) return f;
      return { ...f, ingredientes: [...safeArr(f.ingredientes), { nombre: formIngrediente, porcentaje: parseFloat(formPorcentaje) }] };
    }));
    setFormIngrediente(''); setFormPorcentaje('');
  };

  const handleEliminarIngredienteFormula = (faseNum, nombreIng) => {
    setFormulasEtapas(listFormulas.map(f => {
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
  const handleIngresoLote = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const fechaIng = fd.get('fechaIngreso');
    const nl = {
      id: `l_${Date.now()}`,
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

    let nuevosPesos = [...listPesos];
    if (fd.get('pesoInicial')) {
      nuevosPesos.push({ id: `p_${Date.now()}`, loteId: nl.id, fecha: fechaIng, pesoPromedio: parseFloat(fd.get('pesoInicial')) });
      setPesos(nuevosPesos);
    }

    const tareasHeredadas = listCronoBase.map((t, i) => ({ id: `ts_${Date.now()}_${i}`, loteId: nl.id, dia: t.dia, tarea: t.tarea }));
    setTareasSanidad([...listTareas, ...tareasHeredadas]);
    setLotes([...listLotes, nl]);
    setTabActiva('resumen');
  };

  const handleEliminarLoteActivo = () => {
    pedirConfirmacion("Anular Lote", "¿Estás seguro de eliminar este lote completo? Se borrarán sus animales, registros de alimentos y pesos.", () => {
      const loteActivo = getLoteActivo(corralSeleccionado.id);
      if (!loteActivo) return;
      setLotes(listLotes.filter(l => l.id !== loteActivo.id));
      setAlimentos(listAlimentos.filter(a => a.loteId !== loteActivo.id));
      setPesos(listPesos.filter(p => p.loteId !== loteActivo.id));
      setVacunas(listVacunas.filter(v => v.loteId !== loteActivo.id));
      setBajas(listBajas.filter(b => b.loteId !== loteActivo.id));
      setGastosExtra(listGastosExtra.filter(g => g.loteId !== loteActivo.id));
      setTareasSanidad(listTareas.filter(t => t.loteId !== loteActivo.id));
      setVista('dashboard');
    });
  };

  const handleEliminarLoteHistorial = (id) => {
    pedirConfirmacion("Eliminar del Historial", "¿Estás seguro de borrar este lote permanentemente? Se perderán las estadísticas de esta venta.", () => {
      setLotes(listLotes.filter(l => l.id !== id));
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

    setAlimentos([...listAlimentos, {
      id: `a_${Date.now()}`, loteId: loteActivo.id, fecha: fd.get('fecha'),
      tipo: puroInput.tipo, cantidadLb: librasSuministradas,
      costo: costoTotal,
      esSuplemento: false, ahorro: 0, costoPorLb: (info.precioSaco / (info.librasPorSaco || 50)),
      faseRegistro: faseDestinoSeleccionada
    }]);
    setPuroInput({ ...puroInput, cantidad: '' });
    emitirNotificacionPush(`Se agregaron ${librasSuministradas} lbs de ${puroInput.tipo} a tolva.`);
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

    setAlimentos([...listAlimentos, {
      id: `a_${Date.now()}`, loteId: loteActivo.id, fecha: fd.get('fecha'),
      tipo: `Ración Paralela (Suplemento)`,
      cantidadLb: pesoRealTotal, costo: costoTotalRacion,
      esSuplemento: true, detalleMezcla: detalleArray.join(' + '),
      costoPorLb: (costoTotalRacion / pesoRealTotal),
      faseRegistro: faseDestinoSeleccionada,
      ingredientesUsados: extrasCompletos
    }]);
    setSuplementoItems([{ id: Date.now(), tipo: '', libras: '' }]);
    mostrarAlerta("Ración Extra Suministrada", "Los suplementos han sido descontados de bodega y registrados como gasto extra de esta etapa.");
  };

  const handleComprarBodega = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setComprasBodega([...listCompras, {
      id: `cb_${Date.now()}`,
      fecha: fd.get('fecha'),
      tipo: fd.get('tipo'),
      sacos: parseFloat(fd.get('sacos')),
      costoTotal: parseFloat(fd.get('costoTotal')),
      categoria: bodegaCategoria
    }]);
    e.target.reset();
    emitirNotificacionPush(`Compra registrada: ${parseFloat(fd.get('sacos'))} sacos de ${fd.get('tipo')}.`);
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

    pedirConfirmacion("Confirmar Venta en Báscula", `¿Registrar la venta de ${ventaPesos.length} cerdos por un total de ${formatearMoneda(totalDinero)}?`, () => {
      const nuevaVenta = {
        id: `vnt_${Date.now()}`,
        loteId: loteActivo.id,
        fecha: new Date().toISOString().split('T')[0],
        cantidadCerdos: ventaPesos.length,
        totalLibras: totalLbs,
        precioLibra: ventaPrecio,
        totalVenta: totalDinero
      };
      setVentas([...listVentas, nuevaVenta]);
      setVentaPesos([]);
      setTipoReporteImpresion('cliente');
      setVista('resumenVenta');
    });
  };

  const confirmarVentaYCerrar = () => {
    pedirConfirmacion("Cerrar Lote Oficialmente", "¿Deseas finalizar el lote y guardarlo en el historial permanentemente?", () => {
      const loteActivo = getLoteActivo(corralSeleccionado.id);
      setLotes(listLotes.map(l => l.id === loteActivo.id ? { ...l, estado: 'Cerrado', fechaSalida: new Date().toISOString().split('T')[0] } : l));
      setVista('dashboard');
    });
  };

  const avanzarLoteDeEtapa = (loteId, nuevaEtapaNum) => {
    const hoy = new Date().toISOString().split('T')[0];
    setLotes(listLotes.map(l => {
      if (l.id !== loteId) return l;
      const newHistorial = safeArr(l.historialFases).filter(h => h.fase < nuevaEtapaNum);
      newHistorial.push({ fase: nuevaEtapaNum, fechaInicio: hoy });
      return { ...l, faseActual: nuevaEtapaNum, historialFases: newHistorial };
    }));
    mostrarAlerta("Etapa Avanzada", `El sistema ha recalculado las fechas futuras y documentado tu ahorro financiero de la etapa anterior.`);
  };

  // --- RENDER: HISTORIAL DE LOTES ---
  const renderHistorial = () => {
    const lotesCerrados = listLotes.filter(l => l.state === 'Cerrado' || l.estado === 'Cerrado').sort((a, b) => new Date(b.fechaSalida || 0) - new Date(a.fechaSalida || 0));

    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-300">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-black text-slate-800 flex items-center">
              <ClipboardList className="mr-3 text-indigo-600" size={32} /> Historial de Lotes Finalizados
            </h2>
            <p className="text-slate-500 mt-2">
              Consulta los reportes financieros y zootécnicos de las engordas pasadas.
            </p>
          </div>
        </div>

        {lotesCerrados.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center">
            <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <Archive size={40} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">No hay lotes en el historial</h3>
            <p className="text-slate-500">
              Cuando finalices y vendas un lote activo, aparecerá automáticamente aquí para tu registro histórico.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {lotesCerrados.map(lote => {
              const corralInfo = listCorrales.find(c => c.id === lote.corralId) || { nombre: 'Corral Eliminado' };
              const st = calcularEstadisticasLote(lote);
              const fechaIngresoStr = new Date(lote.fechaIngreso + 'T00:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
              const fechaSalidaStr = lote.fechaSalida ? new Date(lote.fechaSalida + 'T00:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

              return (
                <div key={lote.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group flex flex-col">
                  <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-lg">{corralInfo.nombre}</h4>
                      <p className="text-xs text-slate-400 font-medium">{fechaIngresoStr} al {fechaSalidaStr}</p>
                    </div>
                    <div className="bg-slate-700/50 p-2 rounded-lg border border-slate-600">
                      <CheckCircle size={20} className="text-emerald-400" />
                    </div>
                  </div>
                  <div className="p-5 space-y-4 flex-1">
                    <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                      <span className="text-slate-500 font-medium">Cerdos Vendidos:</span>
                      <span className="font-bold text-slate-800">{st.cantidadActual} <span className="text-[10px] font-normal text-slate-400 uppercase">de {lote.cantidad}</span></span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                      <span className="text-slate-500 font-medium">Mortalidad:</span>
                      <span className={`font-bold ${st.mortalidadPorcentaje > 5 ? 'text-rose-500' : 'text-slate-800'}`}>{st.mortalidadPorcentaje.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                      <span className="text-slate-500 font-medium">Conversión (FCA):</span>
                      <span className="font-bold text-indigo-700">{st.fca.toFixed(2)}</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Utilidad Neta del Lote</p>
                      <p className={`text-2xl font-black tracking-tight ${st.utilidadNeta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatearMoneda(st.utilidadNeta)}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-2">
                    <button
                      onClick={() => { setLoteHistorialSeleccionado(lote); setVista('reporteHistorial'); }}
                      className="flex-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center shadow-sm"
                    >
                      <FileText size={16} className="mr-2" /> Ver Reporte Final
                    </button>
                    <button
                      onClick={() => handleEliminarLoteHistorial(lote.id)}
                      className="px-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-100"
                      title="Eliminar del historial permanentemente"
                    >
                      <Trash2 size={18} />
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

  // --- RENDER: DASHBOARD ---
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

    const notifsPushMapeadas = (notificacionesPush || [])
      .filter(n => (Date.now() - n.fecha) < 24 * 60 * 60 * 1000)
      .map(n => ({ corralNombre: 'Actividad', alertaEspecial: true, mensaje: n.mensaje }))
      .reverse();
    
    const alertasFinales = [...notifsPushMapeadas, ...alertasCambio];

    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-300">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-black text-slate-800">Estado de la Granja</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Box size={24} /></div>
              <span className="text-xs font-bold text-slate-400">PRODUCCIÓN</span>
            </div>
            <h3 className="text-slate-500 text-sm font-medium">Corrales Activos</h3>
            <p className="text-3xl font-black text-slate-800">{listCorrales.filter(c => getLoteActivo(c.id)).length} <span className="text-lg font-medium text-slate-400">/ {listCorrales.length}</span></p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><TrendingUp size={24} /></div>
              <span className="text-xs font-bold text-slate-400">POBLACIÓN</span>
            </div>
            <h3 className="text-slate-500 text-sm font-medium">Cerdos en Engorda</h3>
            <p className="text-3xl font-black text-slate-800">
              {listLotes.filter(l => l.estado === 'Activo').reduce((acc, curr) => {
                const bajasL = listBajas.filter(b => b.loteId === curr.id).reduce((s, b) => s + (b.cantidad || 0), 0);
                return acc + ((curr.cantidad || 0) - bajasL);
              }, 0)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><Archive size={24} /></div>
              <span className="text-xs font-bold text-slate-400">ALMACÉN</span>
            </div>
            <h3 className="text-slate-500 text-sm font-medium">Sacos en Bodega</h3>
            <p className="text-3xl font-black text-slate-800">{totalSacosBodegaCentral.toFixed(1)} <span className="text-lg font-medium text-slate-400">sacos</span></p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-xl"><Clock size={24} /></div>
              <span className="text-xs font-bold text-slate-400">ALERTAS</span>
            </div>
            <h3 className="text-slate-500 text-sm font-medium">Notificaciones</h3>
            {alertasFinales.length > 0 ? (
              <div className="mt-3 space-y-3 max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                {alertasFinales.map((alerta, i) => (
                  <div key={i} className={`text-sm border-l-2 pl-2 leading-tight ${alerta.alertaEspecial ? 'border-emerald-500 text-emerald-700 font-bold bg-emerald-50 p-2 rounded-r' : 'border-amber-400'}`}>
                    {alerta.alertaEspecial ? (
                      <span>{alerta.corralNombre}: {alerta.mensaje}</span>
                    ) : (
                      <span><span className="font-bold text-slate-800">{alerta.corralNombre}:</span> {alerta.motivo === 'consumo' ? `Etapa al ${alerta.porcentaje}%.` : 'Días cumplidos.'} <br /><span className="text-amber-600 font-bold text-[10px]">PREPARAR: {alerta.proximoAlimento}</span></span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-3xl font-black text-slate-800 mt-2">0 <span className="text-lg font-medium text-slate-400">Pendientes</span></p>
            )}
          </div>
        </div>

        <h3 className="text-xl font-bold text-slate-800 mb-4">Supervisión de Corrales</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {listCorrales.map(corral => {
            const lote = getLoteActivo(corral.id);
            const stats = calcularEstadisticasLote(lote);
            return (
              <div key={corral.id} onClick={() => { setCorralSeleccionado(corral); setVista('corralDetail'); setTabActiva('resumen'); }} className={`cursor-pointer transition-all hover:-translate-y-1 p-6 rounded-2xl border-2 ${lote ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-200 bg-white shadow-sm'}`}>
                <div className="flex justify-between mb-4">
                  <h4 className="font-bold text-xl text-slate-800">{corral.nombre}</h4>
                  <div className={`px-2 py-1 text-[10px] font-black rounded-full uppercase ${lote ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>{lote ? 'Ocupado' : 'Vacío'}</div>
                </div>
                {lote ? (
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between"><span>Cerdos Vivos:</span><span className="font-bold">{stats?.cantidadActual}</span></div>
                    <div className="flex justify-between items-center">
                      <span>Peso Prom:</span>
                      <span className="font-bold flex items-center gap-1">
                        {stats?.pesoActual} lb
                        {stats?.estaListoParaMezclas && <Leaf size={14} className="text-emerald-500" title="Listo para formulación" />}
                      </span>
                    </div>
                    <div className="flex justify-between"><span>Días:</span><span className="font-bold">{stats?.diasLote}</span></div>
                  </div>
                ) : <div className="h-20 flex flex-col items-center justify-center text-slate-300"><Plus size={24} className="mb-2" /><span className="text-xs font-bold">Ingresar Lote</span></div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- RENDER: ERP DE BODEGA ---
  const renderBodega = () => {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-black text-slate-800 flex items-center"><Archive className="mr-3 text-amber-500" size={32} /> Bodega Central Unificada</h2>
          <button onClick={() => descargarPDF('orden-compra-pdf', 'Orden_Compra_Granja.pdf')} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-5 rounded-xl shadow-md transition-colors flex items-center">
            <Download size={18} className="mr-2" /> Generar Orden de Compra (PDF)
          </button>
        </div>

        <p className="text-slate-500 mb-8 max-w-2xl">Aquí visualizas todo el alimento físico que tienes en la granja. El inventario se descuenta de forma automática en el momento en que registras alimentos o suplementos dentro de un corral.</p>

        {/* CONTENEDOR OCULTO PARA EL PDF DE ORDEN DE COMPRA */}
        <div className="absolute -left-[9999px]">
          <div id="orden-compra-pdf" className="p-12 w-[800px] bg-white text-black">
            <div className="text-center border-b-4 border-slate-900 pb-6 mb-8">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">ORDEN DE COMPRA SUGERIDA</h1>
              <p className="text-xl font-bold text-slate-500 mt-2 uppercase tracking-widest">Porcicontrol</p>
              <p className="text-sm mt-4 font-bold">Fecha de Emisión: {new Date().toLocaleDateString('es-GT')}</p>
            </div>
            <p className="mb-6 text-slate-700 text-lg">El sistema ha cruzado la etapa actual de todos los corrales contra el inventario físico global en la Bodega Central. Debes comprar los siguientes insumos para que la granja termine su etapa vigente sin interrupciones:</p>

            <table className="w-full text-left border-collapse border border-slate-300">
              <thead className="bg-slate-100">
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
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><Plus size={20} className="mr-2 text-amber-500" /> Ingresar Compra a Bodega</h3>
              <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setBodegaCategoria('concentrado')} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${bodegaCategoria === 'concentrado' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Concentrados</button>
                <button onClick={() => setBodegaCategoria('ingrediente')} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${bodegaCategoria === 'ingrediente' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Extras (Mezcla)</button>
              </div>
              <form onSubmit={handleComprarBodega} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Compra</label><input type="date" name="fecha" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" /></div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Producto</label>
                  <select name="tipo" required className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                    {bodegaCategoria === 'concentrado' ? listCatAlimentos.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>) : listCatIngredientes.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Sacos / Quintales</label><input type="number" name="sacos" step="0.5" required className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Costo (Q)</label><input type="number" name="costoTotal" step="0.01" required className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" /></div>
                </div>
                <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors shadow-md">Registrar Ingreso</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-lg text-slate-800 mb-2">Libreta de Ingresos</h3>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                {[...listCompras].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm">
                    <div>
                      <p className="font-bold text-slate-800">{c.tipo}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{c.categoria === 'ingrediente' ? 'EXTRA' : 'COMERCIAL'}</p>
                      <p className="text-xs text-slate-500">{c.fecha} • {c.sacos} sacos</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-rose-600">-{formatearMoneda(c.costoTotal)}</span>
                      <button onClick={() => handleEliminarDato('bodega', c.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
                {listCompras.length === 0 && <p className="text-slate-400 italic text-center py-4">No hay compras recientes.</p>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-800 text-white flex items-center justify-between">
                <div className="flex items-center"><Box size={20} className="text-emerald-400 mr-2" /><h3 className="font-bold text-lg">Inventario Físico en Bodega</h3></div>
                <span className="text-xs text-slate-400 font-medium">Actualizado en tiempo real desde la nube</span>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-slate-500">
                    <th className="p-4 font-bold">Materia Prima</th>
                    <th className="p-4 font-bold text-center">Tipo</th>
                    <th className="p-4 font-bold text-center">Sacos Disp.</th>
                    <th className="p-4 font-bold text-right">Libras Reales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventarioCentral.map(item => {
                    if (item.stockLbs <= 0 && listCompras.filter(c => c.tipo === item.nombre).length === 0) return null;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-slate-800">{item.nombre} <span className="text-[10px] text-slate-400 font-normal ml-1">({item.librasPorSaco}lb/sac)</span></td>
                        <td className="p-4 text-center text-xs font-bold text-slate-400 uppercase">{item.isConcentrado ? 'Comercial' : 'Extra'}</td>
                        <td className="p-4 text-center">
                          <span className={`px-3 py-1 rounded-full font-black text-lg ${item.stockSacos <= 2 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {item.stockSacos.toFixed(1)}
                          </span>
                        </td>
                        <td className="p-4 text-right font-medium text-slate-600">{item.stockLbs.toFixed(1)} lbs</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- RENDER: LABORATORIO DE MEZCLAS ---
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

    let aditivosCostoTotal = 0;
    adits.forEach(a => {
      const pAditivo = getPrecioPorLibra(a.tipo);
      const costoA = a.lbs * pAditivo;
      costoMezcla += costoA;
      aditivosCostoTotal += costoA;
    });

    const costoPuro = labTotalLbs * precioConc;
    const ahorroEnLote = costoPuro - costoMezcla;

    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto animate-in fade-in duration-300">
        <div className="mb-8">
          <h2 className="text-3xl font-black text-slate-800 flex items-center"><Beaker className="mr-3 text-indigo-500" size={32} /> Laboratorio de Mezclas</h2>
          <p className="text-slate-500 mt-2">Diseña y prueba recetas virtualmente antes de dárselas a los animales para proyectar su rentabilidad y ahorro.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center"><Settings size={20} className="mr-2 text-indigo-500" /> Parámetros de la Prueba</h3>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tamaño del Lote a Preparar</label>
                <div className="flex items-center">
                  <input type="number" value={labTotalLbs} onChange={e => setLabTotalLbs(parseFloat(e.target.value) || 0)} className="flex-1 p-3 border border-slate-300 rounded-l-xl outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-black" />
                  <span className="bg-slate-100 border-y border-r border-slate-300 px-4 py-3 rounded-r-xl font-bold text-slate-600">Libras</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Porcentaje de Inclusión (Materia Prima)</label>
                <div className="flex items-center gap-4">
                  <input type="range" min="0" max="100" value={labPorcMezcla} onChange={e => setLabPorcMezcla(parseInt(e.target.value))} className="flex-1" />
                  <span className="font-black text-2xl text-indigo-600 w-16 text-right">{labPorcMezcla}%</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Concentrado Comercial Base</label>
                <select value={labConc} onChange={e => setLabConc(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl outline-none bg-slate-50 font-bold text-slate-700">
                  {listCatAlimentos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Materia Prima a Añadir</label>
                <select value={labMatPrima} onChange={e => setLabMatPrima(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl outline-none bg-slate-50 font-bold text-slate-700">
                  {listCatIngredientes.map(i => <option key={i.id} value={i.nombre}>{i.nombre}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800 text-white">
              <h3 className="font-black text-xl mb-4 text-emerald-400">Receta Formulada</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <span className="font-bold">{labConc}</span>
                  <span className="font-black text-lg">{concLbs.toFixed(2)} lbs</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <span className="font-bold text-emerald-300">{labMatPrima}</span>
                  <span className="font-black text-lg text-emerald-300">{matLbs.toFixed(2)} lbs</span>
                </div>
                {adits.map((a, i) => (
                  <div key={i} className="flex justify-between items-center pb-2 pl-4 border-l-2 border-amber-500/50">
                    <span className="font-medium text-amber-200">+ {a.tipo} (Auto)</span>
                    <span className="font-bold text-amber-200">{a.lbs.toFixed(3)} lbs</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-bold text-lg text-slate-800 mb-4">Análisis Financiero</h3>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600 font-medium">Costo si fuera 100% Puro:</span>
                  <span className="font-bold text-rose-600">{formatearMoneda(costoPuro)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                  <span className="text-indigo-800 font-bold">Costo Real de la Mezcla:</span>
                  <span className="font-black text-indigo-700 text-xl">{formatearMoneda(costoMezcla)}</span>
                </div>
              </div>

              <div className="text-center bg-emerald-50 border border-emerald-200 p-6 rounded-xl">
                <p className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-2">Ahorro en este Lote</p>
                <p className={`text-4xl font-black ${ahorroEnLote > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {ahorroEnLote > 0 ? '+' : ''}{formatearMoneda(ahorroEnLote)}
                </p>
                <p className="text-sm font-bold text-emerald-700 mt-2">Costando {formatearMoneda(costoMezcla / labTotalLbs)} por Libra.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: CONFIGURACIÓN ---
  const renderConfiguracion = () => (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-3xl font-black text-slate-800">Ajustes del Sistema</h2>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><Box className="mr-2 text-emerald-500" /> Corrales</h3>
        <form onSubmit={handleAgregarCorral} className="flex gap-3 mb-6">
          <input name="nombre" placeholder="Nombre corral (Ej. Corral 1)" required className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
          <input name="capacidad" type="number" placeholder="Capacidad (Cerdos)" required className="w-48 p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
          <button type="submit" className="bg-emerald-600 text-white font-bold px-6 rounded-xl hover:bg-emerald-700 transition-colors">Crear</button>
        </form>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {listCorrales.map(c => (
            <div key={c.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div><p className="font-bold text-slate-800">{c.nombre}</p><p className="text-xs text-slate-500">Capacidad: {c.capacidad} cerdos</p></div>
              <button onClick={() => handleEliminarCorral(c.id)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={20} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><DollarSign className="mr-2 text-blue-500" /> Catálogo de Concentrados</h3>
          <p className="text-sm text-slate-500 mb-6">Actualiza los precios y pesos de las marcas comerciales que compras.</p>

          <form onSubmit={handleAgregarAlimentoCatalogo} className="flex flex-col gap-3 mb-8 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <input type="text" name="nombre" placeholder="Nombre (Ej. ENGORDE MAX)" required className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white" />
            <div className="flex gap-2">
              <input type="number" name="libras" placeholder="Lbs por Saco" required min="1" step="0.1" className="w-1/2 p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white" />
              <input type="number" step="0.01" name="precio" placeholder="Precio Q" required min="0" className="w-1/2 p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white" />
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold p-2.5 rounded-lg transition-colors flex items-center justify-center shadow-sm">
              <Plus size={18} className="mr-1" /> Agregar Concentrado
            </button>
          </form>

          <div className="space-y-2">
            {listCatAlimentos.map(item => (
              <div key={item.id} className="flex flex-col p-3 border border-slate-100 rounded-lg bg-slate-50 group">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm text-slate-700">{item.nombre}</span>
                  <button onClick={() => handleEliminarAlimentoCatalogo(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors" title="Eliminar"><Trash2 size={16} /></button>
                </div>
                <div className="flex items-center gap-2 w-full justify-between">
                  <div className="flex items-center">
                    <input type="number" step="1" value={item.librasPorSaco} onChange={(e) => setCatalogoAlimento(listCatAlimentos.map(i => i.id === item.id ? { ...i, librasPorSaco: parseFloat(e.target.value) || 0 } : i))} className="w-14 p-1.5 text-center text-sm border border-slate-300 rounded outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                    <span className="text-slate-400 text-xs ml-1">lbs</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-slate-400 text-sm mr-1">Q</span>
                    <input type="number" value={item.precioSaco} onChange={(e) => setCatalogoAlimento(listCatAlimentos.map(i => i.id === item.id ? { ...i, precioSaco: parseFloat(e.target.value) || 0 } : i))} className="w-20 p-1.5 text-right font-bold text-blue-700 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><Leaf className="mr-2 text-amber-500" /> Catálogo Ingredientes (Mezclas)</h3>
          <p className="text-sm text-slate-500 mb-6">Agrega maíz, soya u otros ingredientes extra. Si usas líquidos (melaza), calcula cuánto pesa tu caneca en libras y regístralo aquí.</p>

          <form onSubmit={handleAgregarIngredienteCatalogo} className="flex flex-col gap-3 mb-8 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
            <input type="text" name="nombre" placeholder="Nombre (Ej. MAÍZ AMARILLO)" required className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white" />
            <div className="flex gap-2">
              <input type="number" name="libras" placeholder="Lbs por QQ/Saco" required min="1" step="0.1" className="w-1/2 p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white" />
              <input type="number" step="0.01" name="precio" placeholder="Precio Q" required min="0" className="w-1/2 p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white" />
            </div>
            <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-bold p-2.5 rounded-lg transition-colors flex items-center justify-center shadow-sm">
              <Plus size={18} className="mr-1" /> Agregar Ingrediente
            </button>
          </form>

          <div className="space-y-2 flex-1">
            {listCatIngredientes.map(item => (
              <div key={item.id} className="flex flex-col p-3 border border-slate-100 rounded-lg bg-slate-50 group">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm text-slate-700">{item.nombre}</span>
                  <button onClick={() => handleEliminarIngredienteCatalogo(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors" title="Eliminar"><Trash2 size={16} /></button>
                </div>
                <div className="flex items-center gap-2 w-full justify-between">
                  <div className="flex items-center">
                    <input type="number" step="1" value={item.librasPorSaco} onChange={(e) => setCatalogoIngredientes(listCatIngredientes.map(i => i.id === item.id ? { ...i, librasPorSaco: parseFloat(e.target.value) || 0 } : i))} className="w-14 p-1.5 text-center text-sm border border-slate-300 rounded outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                    <span className="text-slate-400 text-xs ml-1">lbs</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-slate-400 text-sm mr-1">Q</span>
                    <input type="number" value={item.precioSaco} onChange={(e) => setCatalogoIngredientes(listCatIngredientes.map(i => i.id === item.id ? { ...i, precioSaco: parseFloat(e.target.value) || 0 } : i))} className="w-20 p-1.5 text-right font-bold text-amber-700 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-amber-500 bg-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <h4 className="font-bold text-slate-700 mb-2 flex items-center"><Scale size={16} className="mr-2 text-emerald-500" /> Notificación de Transición</h4>
            <p className="text-xs text-slate-500 mb-3">Establece el peso mínimo a partir del cual los cerdos están listos para empezar a consumir mezclas.</p>
            <div className="flex items-center">
              <input type="number" value={pesoAlertaMezcla} onChange={(e) => setPesoAlertaMezcla(parseFloat(e.target.value) || 0)} className="w-24 p-2 text-center border border-emerald-300 rounded-l-lg outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-800" />
              <span className="bg-emerald-100 text-emerald-800 font-bold px-4 py-2 rounded-r-lg border-y border-r border-emerald-300">Libras</span>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <h4 className="font-bold text-slate-700 mb-2 flex items-center"><Calculator size={16} className="mr-2 text-indigo-500" /> Constante Fórmula de Schaeffer</h4>
            <p className="text-xs text-slate-500 mb-3">Ajusta la constante divisor para el cálculo: Peso (lbs) = (G² × L) / Constante</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <input type="number" step="0.1" value={constanteSchaeffer} onChange={(e) => setConstanteSchaeffer(parseFloat(e.target.value) || 400)} className="w-32 p-2 text-center border border-indigo-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-800" />
              </div>
              <span className="text-slate-600 text-sm font-medium">(Valor típico: 400)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 p-8 rounded-2xl shadow-xl text-white">
        <h3 className="font-black text-2xl mb-2 flex items-center text-emerald-400"><BookOpen className="mr-3" size={28} /> Reglas de Aditivos para Mezclas</h3>
        <p className="text-slate-400 mb-8 max-w-2xl">Configura qué aditivo y en qué proporción se agregará cuando uses una materia prima base (Ej. 0.012 lbs de Melaza por cada 1 lb de Maíz). El Formulador en el corral calculará esto automáticamente por ti.</p>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h4 className="font-bold text-lg mb-4">Nueva Regla</h4>
            <form onSubmit={handleAgregarReglaMezcla} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Por cada 1 libra de esto...</label>
                <select value={formReglaBase} onChange={(e) => setFormReglaBase(e.target.value)} required className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-white">
                  <option value="">Materia Prima Base...</option>
                  {listCatIngredientes.map(i => <option key={`base-${i.id}`} value={i.nombre}>{i.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Agregar este aditivo...</label>
                <select value={formReglaAditivo} onChange={(e) => setFormReglaAditivo(e.target.value)} required className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-white">
                  <option value="">Aditivo...</option>
                  {listCatIngredientes.map(i => <option key={`adi-${i.id}`} value={i.nombre}>{i.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Multiplicado por este factor (Lbs)</label>
                <input type="number" step="0.001" min="0" value={formReglaFactor} onChange={(e) => setFormReglaFactor(e.target.value)} required placeholder="Ej. 0.012" className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-white font-bold text-emerald-400" />
              </div>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black p-3 rounded-lg transition-colors flex items-center justify-center mt-2">
                <Plus size={18} className="mr-2" /> Añadir Regla
              </button>
            </form>
          </div>

          <div className="md:col-span-7">
            <h4 className="font-bold text-xl mb-4 text-emerald-400">Reglas Activas</h4>
            {!listReglasMezcla.length ? (
              <div className="bg-slate-800/50 border border-dashed border-slate-600 rounded-xl p-8 text-center text-slate-500">
                Aún no tienes reglas de aditivos automáticos.
              </div>
            ) : (
              <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900 border-b border-slate-700">
                    <tr>
                      <th className="p-4 text-slate-400 font-bold uppercase tracking-wider text-xs">Materia Prima</th>
                      <th className="p-4 text-slate-400 font-bold uppercase tracking-wider text-xs">Aditivo Agregado</th>
                      <th className="p-4 text-slate-400 font-bold uppercase tracking-wider text-xs text-right">Factor</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {listReglasMezcla.map((regla) => (
                      <tr key={regla.id} className="hover:bg-slate-700/30">
                        <td className="p-4 font-bold">{regla.base}</td>
                        <td className="p-4 font-bold text-emerald-400">+ {regla.aditivo}</td>
                        <td className="p-4 text-right font-black text-white">x {regla.factor}</td>
                        <td className="p-4 text-right"><button onClick={() => handleEliminarReglaMezcla(regla.id)} className="text-slate-500 hover:text-rose-400 transition-colors"><Trash2 size={16} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 p-8 rounded-2xl shadow-xl text-white">
        <h3 className="font-black text-2xl mb-2 flex items-center text-emerald-400"><BookOpen className="mr-3" size={28} /> Fórmulas Zootécnicas por Etapa</h3>
        <p className="text-slate-400 mb-8 max-w-2xl">Diseña la receta porcentual exacta para cada etapa. El sistema usará esto para calcular y descontar automáticamente los ingredientes en la sub-bodega de los corrales cuando uses el Formulador.</p>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h4 className="font-bold text-lg mb-4">Editar Receta</h4>
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Seleccionar Etapa</label>
              <select value={faseFormEdicion} onChange={(e) => setFaseFormEdicion(parseInt(e.target.value))} className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-white">
                {CRONOGRAMA_ALIMENTACION.map(f => (
                  <option key={f.fase} value={f.fase}>Etapa {f.fase} ({f.alimento})</option>
                ))}
              </select>
            </div>
            <form onSubmit={handleAgregarIngredienteFormula} className="space-y-4 border-t border-slate-700 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Ingrediente</label>
                <select value={formIngrediente} onChange={(e) => setFormIngrediente(e.target.value)} required className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-white">
                  <option value="">Seleccionar del catálogo...</option>
                  {listCatAlimentos.map(c => <option key={`c-${c.id}`} value={c.nombre}>{c.nombre} (Concentrado)</option>)}
                  {listCatIngredientes.map(i => <option key={`i-${i.id}`} value={i.nombre}>{i.nombre} (Extra)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Porcentaje de Inclusión (%)</label>
                <input type="number" step="0.1" min="0.1" max="100" value={formPorcentaje} onChange={(e) => setFormPorcentaje(e.target.value)} required placeholder="Ej. 25" className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-white" />
              </div>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black p-3 rounded-lg transition-colors flex items-center justify-center">
                <Plus size={18} className="mr-2" /> Añadir a la Receta
              </button>
            </form>
          </div>

          <div className="md:col-span-7">
            {listFormulas.map(formula => {
              if (formula.fase !== faseFormEdicion) return null;
              const sumaTotal = safeArr(formula.ingredientes).reduce((sum, i) => sum + (parseFloat(i.porcentaje) || 0), 0);

              return (
                <div key={formula.fase} className="animate-in fade-in">
                  <h4 className="font-bold text-xl mb-4 text-emerald-400">Receta: Etapa {formula.fase}</h4>
                  {safeArr(formula.ingredientes).length === 0 ? (
                    <div className="bg-slate-800/50 border border-dashed border-slate-600 rounded-xl p-8 text-center text-slate-500">
                      Aún no has definido una fórmula para esta etapa. El sistema pedirá concentrado comercial puro por defecto.
                    </div>
                  ) : (
                    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900 border-b border-slate-700">
                          <tr>
                            <th className="p-4 text-slate-400 font-bold uppercase tracking-wider text-xs">Materia Prima</th>
                            <th className="p-4 text-slate-400 font-bold uppercase tracking-wider text-xs text-right">Porcentaje (%)</th>
                            <th className="p-4"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {formula.ingredientes.map((ing, idx) => (
                            <tr key={idx} className="hover:bg-slate-700/30">
                              <td className="p-4 font-bold">{ing.nombre}</td>
                              <td className="p-4 text-right font-black text-emerald-400">{ing.porcentaje}%</td>
                              <td className="p-4 text-right"><button onClick={() => handleEliminarIngredienteFormula(formula.fase, ing.nombre)} className="text-slate-500 hover:text-rose-400 transition-colors"><Trash2 size={16} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className={`p-4 flex justify-between items-center font-black ${sumaTotal === 100 ? 'bg-emerald-900/40 text-emerald-400' : 'bg-rose-900/40 text-rose-400'}`}>
                        <span>TOTAL DE LA MEZCLA:</span>
                        <span>{sumaTotal.toFixed(1)}%</span>
                      </div>
                      {sumaTotal !== 100 && (
                        <div className="px-4 py-3 bg-rose-500/10 text-rose-400 text-xs font-bold flex items-center border-t border-rose-500/20">
                          <AlertTriangle size={14} className="mr-2" /> La suma debe ser exactamente 100% para que el sistema pueda formular correctamente.
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
      <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-300">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-4xl font-black text-slate-800">{corralSeleccionado.nombre}</h2>
            <p className="text-slate-500 font-medium mt-1 flex items-center"><Users size={16} className="mr-1" /> Capacidad Máxima: {corralSeleccionado.capacidad} cerdos</p>
          </div>
          {loteActivo && (
            <div className="flex flex-wrap gap-3 justify-end">
              <button onClick={handleEliminarLoteActivo} className="bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white font-bold py-2 px-4 rounded-xl transition-all shadow-sm flex items-center border border-rose-200" title="Eliminar este lote completamente">
                <Trash2 size={18} className="mr-2" /> Anular Lote
              </button>
              <button onClick={() => setVista('imprimirFicha')} className="bg-white text-slate-700 hover:bg-slate-50 font-bold py-2 px-4 rounded-xl transition-all shadow-sm flex items-center border border-slate-200">
                <Printer size={18} className="mr-2" /> Ficha
              </button>
              <button onClick={() => { setTipoReporteImpresion('interno'); setVista('resumenVenta'); }} className="bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold py-2 px-4 rounded-xl transition-all shadow-sm flex items-center">
                <PieChart size={18} className="mr-2" /> Reporte Final
              </button>
              <button onClick={prepararVentaLote} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white font-bold py-2 px-4 rounded-xl transition-all shadow-sm flex items-center border border-emerald-200">
                <Scale size={18} className="mr-2" /> Vender en Báscula
              </button>
            </div>
          )}
        </div>

        {!loteActivo ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto text-center mt-12">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"><Plus size={40} /></div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Corral Vacío</h3>
            <p className="text-slate-500 mb-8">Ingresa los datos del nuevo grupo de cerdos para comenzar a llevar su control.</p>
            <form onSubmit={handleIngresoLote} className="space-y-5 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold text-slate-700 mb-1">Fecha Ingreso</label><input type="date" name="fechaIngreso" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-3 border border-slate-300 rounded-xl outline-none" /></div>
                <div><label className="block text-sm font-bold text-slate-700 mb-1">Cantidad</label><input type="number" name="cantidad" required min="1" max={corralSeleccionado.capacidad} className="w-full p-3 border border-slate-300 rounded-xl outline-none" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold text-slate-700 mb-1">Raza (Opcional)</label><input type="text" name="raza" placeholder="Ej. Pietrain" className="w-full p-3 border border-slate-300 rounded-xl outline-none" /></div>
                <div><label className="block text-sm font-bold text-slate-700 mb-1">Peso Promedio Inicial (lb)</label><input type="number" name="pesoInicial" step="0.1" required className="w-full p-3 border border-slate-300 rounded-xl outline-none" /></div>
              </div>
              <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-colors mt-4 text-lg">Comenzar Lote</button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50">
              {[
                { id: 'resumen', icon: PieChart, label: 'Resumen' },
                { id: 'cronograma', icon: Clock, label: 'Cronograma' },
                { id: 'alimento', icon: Wheat, label: 'Alimentación (Tolvas)' },
                { id: 'peso', icon: Scale, label: 'Control Peso' },
                { id: 'sanidad', icon: HeartPulse, label: 'Sanidad & Bajas' },
                { id: 'finanzas', icon: Calculator, label: 'Finanzas & Simulación' },
              ].map(t => (
                <button key={t.id} onClick={() => setTabActiva(t.id)} className={`flex items-center px-6 py-4 font-bold text-sm transition-colors border-b-2 ${tabActiva === t.id ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                  {React.createElement(t.icon, { size: 18, className: "mr-2" })} {t.label}
                </button>
              ))}
            </div>

            <div className="p-8 bg-white min-h-[500px]">

              {/* TAB: RESUMEN */}
              {tabActiva === 'resumen' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
                  <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                    <h3 className="font-bold text-xl text-blue-900 mb-6 flex items-center"><Activity size={24} className="mr-2 text-blue-600" /> Rendimiento Zootécnico</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center"><span className="text-slate-600 font-medium">Animales Vivos:</span><span className={`font-black text-xl ${stats.mortalidadPorcentaje > 5 ? 'text-rose-500' : 'text-slate-800'}`}>{stats.cantidadActual} <span className="text-sm font-normal text-slate-500">({stats.mortalidadPorcentaje.toFixed(1)}% Mortalidad)</span></span></div>
                      <div className="flex justify-between items-center"><span className="text-slate-600 font-medium">Días en granja:</span><span className="font-bold text-xl text-slate-800">{stats.diasLote}</span></div>
                      <div className={`flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border ${stats.estaListoParaMezclas ? 'border-emerald-300 bg-emerald-50' : 'border-blue-100'}`}>
                        <span className={stats.estaListoParaMezclas ? 'text-emerald-800 font-bold' : 'text-blue-800 font-bold'}>Peso Promedio Actual:</span>
                        <span className={`font-black text-2xl flex items-center ${stats.estaListoParaMezclas ? 'text-emerald-700' : 'text-blue-700'}`}>{stats.pesoActual} lbs {stats.estaListoParaMezclas && <Leaf size={20} className="ml-2" title="¡Listo para Mezclas!" />}</span>
                      </div>
                      <div className="flex justify-between items-center"><span className="text-slate-600 font-medium">Ganancia Diaria (GMD):</span><span className="font-bold text-slate-800">{stats.adg.toFixed(2)} lbs/día</span></div>
                      <div className={`p-4 rounded-xl border mt-4 ${stats.fca > 3 ? 'bg-orange-100 border-orange-200' : 'bg-emerald-50 border-emerald-200'}`}>
                        <div className="flex justify-between items-center">
                          <span className={`font-bold ${stats.fca > 3 ? 'text-orange-800' : 'text-emerald-800'} flex items-center`}>Conversión (FCA)</span>
                          <span className={`font-black text-3xl ${stats.fca > 3 ? 'text-orange-600' : 'text-emerald-600'}`}>{stats.fca.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100">
                    <h3 className="font-bold text-xl text-emerald-900 mb-6 flex items-center"><PiggyBank size={24} className="mr-2 text-emerald-600" /> Inversión a la Fecha</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center"><span className="text-slate-600 font-medium">Lechones (Estimado):</span><span className="font-bold text-rose-500">-{formatearMoneda(stats.costoLechones)}</span></div>
                      <div className="flex justify-between items-center"><span className="text-slate-600 font-medium">Alimentación (Tolvas + Extras):</span><span className="font-bold text-rose-500">-{formatearMoneda(stats.costoAlimento)}</span></div>
                      <div className="flex justify-between items-center"><span className="text-slate-600 font-medium">Sanidad y Gastos Fijos:</span><span className="font-bold text-rose-500">-{formatearMoneda(stats.totalSanidad + stats.totalGastosExtras)}</span></div>
                      <div className="flex justify-between items-center pt-4 mt-2 border-t border-slate-200"><span className="text-slate-800 font-black text-lg">TOTAL INVERTIDO:</span><span className="font-black text-rose-600 text-2xl">-{formatearMoneda(stats.costoInvertidoTotal)}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: CRONOGRAMA CON FECHAS REALES Y SALTO DE ETAPA */}
              {tabActiva === 'cronograma' && (() => {
                const fasesDinamicas = getFasesDinamicas(loteActivo);
                const fechaEstimadaVenta = fasesDinamicas[fasesDinamicas.length - 1].fechaFinCalc;
                const fechaEstimadaStr = fechaEstimadaVenta.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
                const hoyDate = new Date();

                return (
                  <div className="animate-in fade-in duration-300">
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-8 flex justify-between items-center shadow-sm">
                      <span className="font-bold text-indigo-800">Días Reales de Engorde:</span>
                      <span className="text-2xl font-black text-indigo-600">{stats.diasLote}</span>
                    </div>
                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                      {fasesDinamicas.map(fase => {
                        const metaFase = fase.consumoTotalLb * stats.cantidadActual;
                        const consumidoFase = getConsumidoEnFase(loteActivo.id, fase);
                        const suplementosEnFase = getSuplementosEnFase(loteActivo.id, fase.fase);

                        // LÓGICA DE BARRA COMPARTIDA
                        const totalConsumido = consumidoFase + suplementosEnFase.lbs;
                        const porcentajeProgresoTotal = metaFase > 0 ? Math.min((totalConsumido / metaFase) * 100, 100) : 0;
                        const porcTolva = metaFase > 0 ? (consumidoFase / metaFase) * 100 : 0;
                        const porcSuplemento = metaFase > 0 ? (suplementosEnFase.lbs / metaFase) * 100 : 0;

                        // GUARDIA DE SEGURIDAD
                        const metaSuplementoPorc = loteActivo.metasSuplementos?.[fase.fase] || 0;
                        const limiteExcedido = metaSuplementoPorc > 0 && porcSuplemento > metaSuplementoPorc;

                        let porcentajeDias = 0;
                        if (fase.estado === 'pasada') {
                          porcentajeDias = 100;
                        } else if (fase.estado === 'actual') {
                          const diasPasadosEnFase = Math.ceil((hoyDate - fase.fechaInicioCalc) / (1000 * 60 * 60 * 24));
                          porcentajeDias = Math.max(0, Math.min((diasPasadosEnFase / fase.idealDuracion) * 100, 100)).toFixed(0);
                        }

                        const colores = {
                          pasada: 'bg-slate-100 border-slate-200 opacity-60',
                          actual: 'bg-indigo-50 border-indigo-300 shadow-md ring-2 ring-indigo-100 ring-offset-2',
                          futuro: 'bg-white border-slate-200'
                        };

                        const presupuestoLleno = porcentajeProgresoTotal >= 95;
                        const fInicioStr = fase.fechaInicioCalc.toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
                        const fFinStr = fase.fechaFinCalc.toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });

                        return (
                          <div key={fase.fase} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active`}>
                            <div className="hidden md:block w-32 text-right pr-6">
                              <p className={`text-sm font-bold ${fase.estado === 'actual' ? 'text-indigo-700' : 'text-slate-500'}`}>{fase.estado === 'pasada' ? 'Completada' : fase.estado === 'actual' ? 'En Progreso' : 'Proyectada'}</p>
                            </div>
                            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ${fase.estado === 'actual' ? 'bg-indigo-500' : fase.estado === 'pasada' ? 'bg-emerald-400' : 'bg-slate-200'}`}>
                              {fase.estado === 'pasada' ? <CheckCircle size={16} className="text-white" /> : <span className={`text-xs font-bold ${fase.estado === 'actual' ? 'text-white' : 'text-slate-500'}`}>{fase.fase}</span>}
                            </div>
                            <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl border transition-all ${colores[fase.estado]}`}>
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className={`text-xs font-bold uppercase tracking-wider mb-1 block ${fase.estado === 'actual' ? 'text-indigo-600' : 'text-slate-400'}`}>
                                    Etapa {fase.fase} • {fInicioStr} al {fFinStr}
                                  </span>
                                  <h4 className={`text-lg font-black ${fase.estado === 'actual' ? 'text-indigo-900' : 'text-slate-700'}`}>
                                    {fase.alimento}
                                  </h4>
                                </div>
                                {fase.estado === 'actual' && (
                                  <span className="bg-indigo-600 text-white text-[10px] font-black tracking-widest px-3 py-1 rounded-full shadow-sm">VIGENTE</span>
                                )}
                              </div>

                              <div className={`mt-4 border-t pt-4 ${fase.estado === 'actual' ? 'border-indigo-100' : 'border-slate-200/60'}`}>

                                {/* BARRA COMPARTIDA MULTICOLOR (TOLVAS + SUPLEMENTO) */}
                                <div className={`p-3 rounded-xl border mb-4 transition-colors ${limiteExcedido ? 'bg-rose-50 border-rose-200 shadow-sm' : 'bg-white/60 border-white'}`}>
                                  <div className="flex justify-between text-xs mb-1 items-end">
                                    <span className="text-indigo-900 font-black uppercase tracking-wider flex items-center">
                                      <Wheat size={14} className="mr-1" /> Presupuesto Total de Alimento
                                    </span>
                                    <span className="font-black text-indigo-700 text-base">{porcentajeProgresoTotal.toFixed(1)}%</span>
                                  </div>
                                  <div className="flex justify-between text-[10px] text-slate-500 mb-2">
                                    <span>Consumido: <strong className="text-slate-700">{totalConsumido.toFixed(1)} lbs</strong></span>
                                    <span>Meta: <strong className="text-slate-700">{metaFase.toFixed(1)} lbs</strong></span>
                                  </div>

                                  {/* BARRA MULTICOLOR */}
                                  <div className="w-full bg-slate-200 rounded-full h-3 flex overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500 transition-all duration-500"
                                      style={{ width: `${Math.min(porcTolva, 100)}%` }}
                                      title={`Tolva: ${porcTolva.toFixed(1)}%`}
                                    ></div>
                                    <div
                                      className={`h-full transition-all duration-500 ${limiteExcedido ? 'bg-rose-500' : 'bg-amber-400'}`}
                                      style={{ width: `${Math.min(porcSuplemento, 100 - Math.min(porcTolva, 100))}%` }}
                                      title={`Suplemento: ${porcSuplemento.toFixed(1)}%`}
                                    ></div>
                                  </div>

                                  <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest mt-1">
                                    <span className="text-emerald-600">Tolva: {porcTolva.toFixed(1)}%</span>
                                    <span className={limiteExcedido ? 'text-rose-600' : 'text-amber-600'}>Suplemento: {porcSuplemento.toFixed(1)}%</span>
                                  </div>
                                </div>

                                {/* GUARDIA DE SEGURIDAD (AJUSTE Y VIGILANCIA DE SUPLEMENTOS) */}
                                <div className={`p-3 rounded-xl border mb-4 shadow-sm transition-colors ${limiteExcedido ? 'bg-rose-100/50 border-rose-300' : 'bg-white/60 border-white'}`}>
                                  <div className="flex justify-between items-center text-xs mb-2">
                                    <span className={`font-bold flex items-center ${limiteExcedido ? 'text-rose-900' : 'text-amber-900'}`}>
                                      <Activity size={14} className={`mr-1.5 ${limiteExcedido ? 'text-rose-600' : 'text-amber-600'}`} />
                                      Control de Suplementos
                                    </span>
                                    <div className={`flex items-center border rounded-md px-2 py-1 shadow-sm transition-colors ${limiteExcedido ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200'}`} title="Porcentaje de la meta total permitido para suplementos">
                                      <span className="text-slate-500 mr-1 text-[10px] font-bold">LÍMITE:</span>
                                      <input
                                        type="number"
                                        className={`w-10 outline-none font-black text-right bg-transparent ${limiteExcedido ? 'text-rose-700' : 'text-amber-700'}`}
                                        placeholder="0"
                                        value={loteActivo.metasSuplementos?.[fase.fase] ?? ''}
                                        onChange={(e) => handleActualizarMetaSuplemento(loteActivo.id, fase.fase, e.target.value)}
                                      />
                                      <span className={`font-black ml-0.5 ${limiteExcedido ? 'text-rose-700' : 'text-amber-700'}`}>%</span>
                                    </div>
                                  </div>

                                  <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
                                    <span>Entregado: <strong className="text-slate-700">{suplementosEnFase.lbs.toFixed(1)} lbs</strong> | {formatearMoneda(suplementosEnFase.costo)}</span>
                                    {metaSuplementoPorc > 0 ? (
                                      <span>Techo: <strong className="text-slate-700">{(metaFase * (metaSuplementoPorc / 100)).toFixed(1)} lbs</strong></span>
                                    ) : (
                                      <span>(Sin límite)</span>
                                    )}
                                  </div>

                                  {limiteExcedido && (
                                    <div className="text-[10px] font-black text-rose-600 bg-rose-100 p-1.5 rounded mt-2 text-center uppercase tracking-widest border border-rose-200">
                                      ⚠️ Límite Excedido
                                    </div>
                                  )}
                                </div>

                                {/* BARRA SECUNDARIA: DÍAS (REFERENCIA) */}
                                {fase.estado !== 'pasada' && (
                                  <div>
                                    <div className="flex justify-between text-[10px] mb-1 font-bold text-slate-500 uppercase tracking-widest">
                                      <span>Tiempo Transcurrido (Ref.)</span>
                                      <span>{porcentajeDias}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                                      <div className={`h-1.5 rounded-full transition-all duration-500 ${porcentajeDias >= 100 ? 'bg-slate-400' : 'bg-indigo-300'}`} style={{ width: `${Math.min(porcentajeDias, 100)}%` }}></div>
                                    </div>
                                  </div>
                                )}

                                {/* RESULTADOS DE EFICIENCIA FINANCIERA */}
                                {fase.estado === 'pasada' && (() => {
                                  const ahorro = getAhorroFase(loteActivo.id, fase.fase, stats.cantidadActual);
                                  if (!ahorro) return null;
                                  return (
                                    <div className="mt-4 bg-emerald-50/50 border border-emerald-200 rounded-xl p-4">
                                      <h5 className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-3 flex items-center"><TrendingUp size={14} className="mr-1" /> Resultados Financieros de Etapa</h5>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-3">
                                        <div>
                                          <p className="text-emerald-700/70 text-[10px] font-bold uppercase">Meta en Tolva</p>
                                          <p className="font-black text-emerald-800">{ahorro.metaLbs.toFixed(0)} lbs</p>
                                        </div>
                                        <div>
                                          <p className="text-emerald-700/70 text-[10px] font-bold uppercase">Consumo Real Tolva</p>
                                          <p className="font-black text-emerald-800">{ahorro.consumidoTolvaLbs.toFixed(0)} lbs</p>
                                        </div>
                                      </div>
                                      <div className="space-y-1.5 text-xs text-slate-600 mb-3 border-t border-emerald-200/50 pt-3">
                                        <div className="flex justify-between"><span>Concentrado Ahorrado:</span><span className="font-bold text-emerald-600">+{formatearMoneda(ahorro.valorAhorradoConc)}</span></div>
                                        <div className="flex justify-between"><span>Costo Suplementos:</span><span className="font-bold text-rose-500">-{formatearMoneda(ahorro.costoSups)}</span></div>
                                      </div>
                                      <div className="bg-white p-2.5 rounded-lg border border-emerald-200 flex justify-between items-center shadow-sm">
                                        <span className="text-emerald-800 font-black text-[10px] uppercase tracking-wider">Ahorro Neto Real:</span>
                                        <span className={`font-black text-lg ${ahorro.ahorroNeto > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{ahorro.ahorroNeto > 0 ? '+' : ''}{formatearMoneda(ahorro.ahorroNeto)}</span>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {fase.estado === 'actual' && fase.fase < 7 && (
                                  <div className="flex flex-col gap-2 mt-5 border-t border-indigo-200 pt-3">
                                    {presupuestoLleno ? (
                                      <button onClick={() => avanzarLoteDeEtapa(loteActivo.id, fase.fase + 1)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl shadow-md transition-all text-sm flex justify-center items-center transform hover:scale-[1.02]">
                                        <CheckCircle size={18} className="mr-1.5" /> Presupuesto Lleno: Avanzar a Etapa {fase.fase + 1}
                                      </button>
                                    ) : (
                                      <button onClick={() => pedirConfirmacion("Forzar Avance de Etapa", "¿Quieres terminar esta etapa de forma anticipada gracias a los suplementos? El sistema calculará automáticamente tu ahorro financiero neto a partir de hoy.", () => avanzarLoteDeEtapa(loteActivo.id, fase.fase + 1))} className="w-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold py-2.5 rounded-lg transition-colors text-xs flex justify-center items-center">
                                        Forzar avance anticipado de etapa
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mt-8">
                        <div className="hidden md:block w-32 text-right pr-6">
                          <p className="text-sm font-bold text-emerald-600">Proyección Acordeón</p>
                          <p className="text-[10px] text-slate-400 leading-tight">Basado en tu ritmo real</p>
                        </div>
                        <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-md z-10 bg-emerald-500 text-white">
                          <PiggyBank size={22} />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl border bg-emerald-50 border-emerald-200 shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-xs font-bold uppercase tracking-wider mb-1 block text-emerald-600">
                                Fecha de Venta Ajustada
                              </span>
                              <h4 className="text-xl font-black text-emerald-900">
                                Listo para Mercado
                              </h4>
                            </div>
                          </div>
                          <div className="flex flex-col text-sm mt-2 pt-3 border-t border-emerald-200/60 space-y-2">
                            <div className="flex items-center">
                              <Calendar size={16} className="text-emerald-600 mr-2" />
                              <span className="text-emerald-800">
                                Fecha dinámica: <strong className="font-black text-emerald-700">{fechaEstimadaStr}</strong>
                              </span>
                            </div>
                            <div className="flex items-center">
                              <Scale size={16} className="text-emerald-600 mr-2" />
                              <span className="text-emerald-800">
                                Peso objetivo: <strong className="font-black text-emerald-700">220+ lbs</strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })()}

              {/* TAB: ALIMENTACIÓN SEPARADA */}
              {tabActiva === 'alimento' && (() => {
                const faseCalculadaPorDias = CRONOGRAMA_ALIMENTACION.find(f => stats.diasLote >= f.diaInicio && stats.diasLote <= f.diaFin)?.fase || 7;
                const faseActualLote = loteActivo.faseActual || faseCalculadaPorDias;

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-300">
                    <div className="lg:col-span-6">

                      <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex mb-6">
                        <button onClick={() => setTipoRegistroAlimento('tolva')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${tipoRegistroAlimento === 'tolva' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                          <Box size={18} className="mr-2" /> 1. Llenar Tolvas
                        </button>
                        <button onClick={() => setTipoRegistroAlimento('suplemento')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${tipoRegistroAlimento === 'suplemento' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                          <Leaf size={18} className="mr-2" /> 2. Ración Extra (Suplemento)
                        </button>
                      </div>

                      {/* --- FORMULARIO TOLVAS --- */}
                      {tipoRegistroAlimento === 'tolva' && (
                        <form onSubmit={handleGuardarTolva} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                          <div className="mb-6 pb-4 border-b border-slate-100">
                            <h3 className="font-black text-xl text-slate-800 flex items-center"><Wheat size={22} className="mr-2 text-emerald-500" /> Suministro de Concentrado Base</h3>
                            <p className="text-xs text-slate-500 mt-1">Este alimento hará avanzar la barra de presupuesto de la etapa.</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Fecha</label>
                              <input type="date" name="fecha" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50" />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Etapa de Registro</label>
                              <select name="faseDestino" defaultValue={faseActualLote} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50 font-bold text-indigo-700">
                                {CRONOGRAMA_ALIMENTACION.map(f => (
                                  <option key={f.fase} value={f.fase}>Etapa {f.fase}: {f.alimento}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Concentrado Comercial (Puro)</label>
                              <select required value={puroInput.tipo} onChange={(e) => setPuroInput({ ...puroInput, tipo: e.target.value })} className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-bold text-slate-700">
                                {listCatAlimentos.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                              </select>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Cantidad Vaciada</label>
                                <div className="flex border border-slate-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-emerald-500">
                                  <input type="number" step="0.1" required value={puroInput.cantidad} onChange={(e) => setPuroInput({ ...puroInput, cantidad: e.target.value })} className="w-1/2 p-2.5 outline-none font-bold" placeholder="Ej. 2" />
                                  <select value={puroInput.unidad} onChange={(e) => setPuroInput({ ...puroInput, unidad: e.target.value })} className="w-1/2 p-2.5 bg-slate-100 border-l border-slate-300 outline-none text-slate-700 font-bold text-sm">
                                    <option value="sacos">Sacos Enteros</option>
                                    <option value="libras">Libras Sueltas</option>
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Costo Imputado</label>
                                <div className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-bold flex items-center h-[46px]">{formatearMoneda(costoCalculadoPuro)}</div>
                              </div>
                            </div>
                          </div>
                          <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl mt-8 transition-colors shadow-md text-lg">Registrar Llenado de Tolva</button>
                        </form>
                      )}

                      {/* --- FORMULARIO SUPLEMENTOS (Carrito) --- */}
                      {tipoRegistroAlimento === 'suplemento' && (
                        <form onSubmit={handleGuardarSuplemento} className="p-6 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm">
                          <div className="mb-6 pb-4 border-b border-amber-200">
                            <h3 className="font-black text-xl text-amber-900 flex items-center"><ShoppingCart size={22} className="mr-2 text-amber-600" /> Ración Paralela (Suplementos)</h3>
                            <p className="text-xs text-amber-700 mt-1">Este alimento es "extra" y acelera el engorde. Su costo se sumará independientemente.</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                              <label className="block text-sm font-bold text-amber-900 mb-1">Fecha</label>
                              <input type="date" name="fecha" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2.5 border border-amber-300 rounded-lg outline-none bg-white" />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-amber-900 mb-1">Etapa de Registro</label>
                              <select name="faseDestino" defaultValue={faseActualLote} className="w-full p-2.5 border border-amber-300 rounded-lg outline-none bg-white font-bold text-indigo-700">
                                {CRONOGRAMA_ALIMENTACION.map(f => (
                                  <option key={f.fase} value={f.fase}>Etapa {f.fase}: {f.alimento}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="space-y-3 mb-6">
                            <label className="block text-sm font-bold text-amber-900">Ingredientes de la Ración (Cubeta)</label>
                            {suplementoItems.map((item, index) => (
                              <div key={item.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-amber-200 shadow-sm">
                                <select required value={item.tipo} onChange={(e) => setSuplementoItems(suplementoItems.map(i => i.id === item.id ? { ...i, tipo: e.target.value } : i))} className="flex-1 p-2 bg-transparent outline-none text-sm font-bold text-slate-700">
                                  <option value="">Seleccionar ingrediente...</option>
                                  <optgroup label="Ingredientes Extra">
                                    {listCatIngredientes.map(i => <option key={i.id} value={i.nombre}>{i.nombre}</option>)}
                                  </optgroup>
                                  <optgroup label="Concentrados (Como base de mezcla)">
                                    {listCatAlimentos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                                  </optgroup>
                                </select>
                                <div className="w-28 flex items-center bg-slate-50 border border-slate-200 rounded-md">
                                  <input type="number" step="0.1" required value={item.libras} onChange={(e) => setSuplementoItems(suplementoItems.map(i => i.id === item.id ? { ...i, libras: e.target.value } : i))} placeholder="Lbs" className="w-full p-2 bg-transparent outline-none text-right font-bold text-amber-700" />
                                  <span className="text-xs font-bold text-slate-400 px-2">lbs</span>
                                </div>
                                {suplementoItems.length > 1 && (
                                  <button type="button" onClick={() => setSuplementoItems(suplementoItems.filter(i => i.id !== item.id))} className="p-2 text-rose-400 hover:text-rose-600 bg-rose-50 rounded-md transition-colors"><Trash2 size={16} /></button>
                                )}
                              </div>
                            ))}

                            <button type="button" onClick={() => setSuplementoItems([...suplementoItems, { id: Date.now(), tipo: '', libras: '' }])} className="w-full py-2.5 border-2 border-dashed border-amber-300 text-amber-700 font-bold rounded-lg hover:bg-amber-100 transition-colors flex items-center justify-center text-sm">
                              <Plus size={16} className="mr-2" /> Agregar otro ingrediente a la ración
                            </button>
                          </div>

                          <button type="submit" className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl transition-colors shadow-md text-lg">Registrar Ración Suplementaria</button>
                        </form>
                      )}

                    </div>

                    <div className="lg:col-span-6 flex flex-col h-full">

                      {/* PANEL DE ACUMULADOS POR DIETA */}
                      <h3 className="font-bold text-lg text-slate-800 mb-3 flex items-center"><PieChart size={20} className="mr-2 text-indigo-500" /> Resumen Acumulado por Tipo</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 max-h-56 overflow-y-auto pr-1">
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

                          if (acumulados.length === 0) return <div className="col-span-2 text-sm text-slate-400 italic p-4 bg-slate-50 rounded-xl border border-slate-200">No hay consumos registrados aún.</div>;

                          return acumulados.map((item, idx) => (
                            <div key={idx} className={`p-3 rounded-xl border ${item.esSuplemento ? 'bg-amber-50/60 border-amber-200' : 'bg-emerald-50/60 border-emerald-200'} flex justify-between items-center shadow-sm`}>
                              <div className="overflow-hidden pr-2">
                                <p className="text-xs font-black text-slate-800 truncate" title={item.tipo}>{item.tipo}</p>
                                <p className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${item.esSuplemento ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {item.esSuplemento ? 'Suplemento' : 'Tolva'}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-black text-slate-700">{item.libras.toFixed(1)} <span className="text-[10px] font-normal">lbs</span></p>
                                <p className="text-[10px] text-slate-500 font-bold">{formatearMoneda(item.costo)}</p>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>

                      <h3 className="font-bold text-lg text-slate-800 mb-4">Historial de Consumo Detallado</h3>
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm flex-1 max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b border-slate-100 sticky top-0"><tr className="text-slate-600"><th className="p-4 font-semibold">Fecha</th><th className="p-4 font-semibold">Alimento</th><th className="p-4 font-semibold text-right">Libras</th><th className="p-4 font-semibold text-right">Costo</th><th className="p-4"></th></tr></thead>
                          <tbody className="divide-y divide-slate-100">
                            {listAlimentos.filter(a => a.loteId === loteActivo.id).sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0)).map(a => (
                              <tr key={a.id} className="hover:bg-slate-50">
                                <td className="p-4 text-slate-500">{a.fecha}</td>
                                <td className="p-4">
                                  <p className="font-bold text-slate-800">{a.tipo} <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] ml-1">E{a.faseRegistro}</span></p>
                                  {a.esSuplemento && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider block w-fit mt-1.5">SUPLEMENTO</span>}
                                  {a.esSuplemento && <span className="text-xs text-slate-500 ml-1 italic block mt-1">({a.detalleMezcla})</span>}
                                </td>
                                <td className="p-4 text-right font-black text-slate-700">{a.cantidadLb.toFixed(1)} lb</td>
                                <td className="p-4 text-right"><p className="text-rose-600 font-bold">-{formatearMoneda(a.costo)}</p></td>
                                <td className="p-4 text-right"><button onClick={() => handleEliminarDato('alimento', a.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button></td>
                              </tr>
                            ))}
                            {listAlimentos.filter(a => a.loteId === loteActivo.id).length === 0 && (
                              <tr><td colSpan="4" className="py-4 text-center text-slate-400 italic">No hay registros de alimentación para este lote.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB: PESO */}
              {tabActiva === 'peso' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 animate-in fade-in duration-300">
                  <div className="md:col-span-4">
                    <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><Scale size={20} className="mr-2 text-blue-600" /> Registrar Pesaje</h3>

                    {/* SECCIÓN: INGRESO DIRECTO */}
                    <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 space-y-4 mb-4">
                      <h4 className="font-semibold text-blue-900 text-sm uppercase tracking-wide">Ingreso Directo</h4>
                      <form onSubmit={handleGuardarPesoDirecto} className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Fecha del Pesaje</label>
                          <input
                            type="date"
                            value={fechaPesaje}
                            onChange={(e) => setFechaPesaje(e.target.value)}
                            required
                            className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Peso Promedio (lb)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={pesoIngresado}
                            onChange={(e) => setPesoIngresado(e.target.value)}
                            placeholder="Ej: 75.5"
                            required
                            className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={guardandoPeso}
                          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
                        >
                          {guardandoPeso ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                              Guardando...
                            </>
                          ) : (
                            <>
                              <CheckCircle size={18} />
                              Guardar Peso (Directo)
                            </>
                          )}
                        </button>
                      </form>
                    </div>

                    {/* SECCIÓN: FÓRMULA DE SCHAEFFER (COLAPSABLE) */}
                    <div className="bg-indigo-50/50 border border-indigo-200 rounded-2xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandirSchaeffer(!expandirSchaeffer)}
                        className="w-full p-4 flex items-center justify-between hover:bg-indigo-100/50 transition-colors font-semibold text-indigo-900 uppercase text-sm tracking-wide"
                      >
                        <span className="flex items-center gap-2">
                          <Calculator size={18} />
                          Fórmula de Schaeffer
                        </span>
                        <ChevronRight size={20} className={`transition-transform ${expandirSchaeffer ? 'rotate-90' : ''}`} />
                      </button>

                      {expandirSchaeffer && (
                        <div className="px-6 pb-6 pt-2 border-t border-indigo-200 space-y-4">
                          <div className="bg-white/50 p-3 rounded-lg border border-indigo-100">
                            <p className="text-xs text-indigo-700 font-mono font-bold">Peso (lbs) = (G² × L) / {parseFloat(constanteSchaeffer) || 400}</p>
                            <p className="text-[11px] text-indigo-600 mt-1">G = Circunferencia (pulg) | L = Longitud (pulg)</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Circunferencia (cm)</label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={circunferenciaCm}
                                onChange={(e) => setCircunferenciaCm(e.target.value)}
                                placeholder="Ej: 95"
                                className="w-full p-3 border border-indigo-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">Longitud (cm)</label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={longitudCm}
                                onChange={(e) => setLongitudCm(e.target.value)}
                                placeholder="Ej: 58"
                                className="w-full p-3 border border-indigo-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
                              />
                            </div>
                          </div>

                          {pesoSchaefferCalculado !== null && (
                            <div className="bg-indigo-600 text-white p-4 rounded-xl text-center shadow-lg shadow-indigo-200">
                              <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">Peso Calculado</p>
                              <p className="text-4xl font-black tracking-tight">{pesoSchaefferCalculado.toFixed(2)}</p>
                              <p className="text-indigo-200 font-semibold mt-1">libras</p>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={handleGuardarPesoSchaeffer}
                            disabled={!pesoSchaefferCalculado || guardandoPeso}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-bold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
                          >
                            {guardandoPeso ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                Guardando...
                              </>
                            ) : (
                              <>
                                <CheckCircle size={18} />
                                Guardar Peso (Schaeffer)
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-8">
                    <h3 className="font-bold text-lg text-slate-800 mb-4">Historial de Crecimiento</h3>
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr className="text-slate-600">
                            <th className="p-4 font-semibold">Fecha</th>
                            <th className="p-4 font-semibold text-right">Peso</th>
                            <th className="p-4 font-semibold text-center">Método</th>
                            <th className="p-4"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {listPesos.filter(p => p.loteId === loteActivo.id && p.pesoPromedio).sort((a, b) => {
                            const fechaA = a.fecha ? new Date(a.fecha + 'T00:00:00').getTime() : 0;
                            const fechaB = b.fecha ? new Date(b.fecha + 'T00:00:00').getTime() : 0;
                            return fechaB - fechaA;
                          }).map(p => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="p-4 text-slate-600 font-medium">{p.fecha}</td>
                              <td className="p-4 text-right font-black text-blue-600 text-lg">{parseFloat(p.pesoPromedio).toFixed(2)} lb</td>
                              <td className="p-4 text-center">
                                {p.metodo === 'schaeffer' ? (
                                  <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Schaeffer</span>
                                ) : (
                                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Directo</span>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <button onClick={() => handleEliminarDato('peso', p.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {listPesos.filter(p => p.loteId === loteActivo.id).length === 0 && (
                            <tr>
                              <td colSpan="4" className="p-4 text-center text-slate-400 italic text-sm">
                                No hay registros de peso
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: SANIDAD Y BAJAS */}
              {tabActiva === 'sanidad' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                  <div className="space-y-8">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><Syringe size={20} className="mr-2 text-indigo-500" /> Tratamientos Médicos</h3>
                      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target); setVacunas([...listVacunas, { id: `v_${Date.now()}`, loteId: loteActivo.id, fecha: fd.get('fecha'), nombre: fd.get('nombre'), costo: parseFloat(fd.get('costo')) || 0 }]); e.target.reset(); }} className="space-y-4 bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div><label className="block text-sm font-bold text-slate-700 mb-1">Fecha</label><input type="date" name="fecha" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-3 border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                          <div><label className="block text-sm font-bold text-slate-700 mb-1">Costo Total (Q)</label><input type="number" name="costo" step="0.01" required className="w-full p-3 border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                        </div>
                        <div><label className="block text-sm font-bold text-slate-700 mb-1">Medicamento (Ej. Hierro, Suero)</label><input type="text" name="nombre" required className="w-full p-3 border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                        <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-sm">Registrar Gasto Médico</button>
                      </form>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><Receipt size={20} className="mr-2 text-slate-500" /> Gastos Operativos (Flete, Luz)</h3>
                      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target); setGastosExtra([...listGastosExtra, { id: `g_${Date.now()}`, loteId: loteActivo.id, fecha: fd.get('fecha'), descripcion: fd.get('descripcion'), monto: parseFloat(fd.get('monto')) }]); e.target.reset(); }} className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div><label className="block text-sm font-bold text-slate-700 mb-1">Fecha</label><input type="date" name="fecha" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-3 border border-slate-300 rounded-xl outline-none" /></div>
                          <div><label className="block text-sm font-bold text-slate-700 mb-1">Monto (Q)</label><input type="number" name="monto" step="0.01" required className="w-full p-3 border border-slate-300 rounded-xl outline-none" /></div>
                        </div>
                        <div><label className="block text-sm font-bold text-slate-700 mb-1">Concepto</label><input type="text" name="descripcion" required className="w-full p-3 border border-slate-300 rounded-xl outline-none" /></div>
                        <button type="submit" className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors shadow-sm">Añadir Gasto</button>
                      </form>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><HeartPulse size={20} className="mr-2 text-rose-500" /> Registro de Mortalidad Inteligente</h3>
                    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target); const cant = parseInt(fd.get('cantidad')); if (cant > stats.cantidadActual) return mostrarAlerta("Error", "No puedes dar de baja más cerdos de los que tienes vivos."); setBajas([...listBajas, { id: `b_${Date.now()}`, loteId: loteActivo.id, fecha: fd.get('fecha'), causa: fd.get('causa'), cantidad: cant }]); e.target.reset(); }} className="space-y-4 bg-rose-50/50 p-6 rounded-2xl border border-rose-100 mb-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-bold text-slate-700 mb-1">Fecha Baja</label><input type="date" name="fecha" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-3 border border-rose-200 rounded-xl outline-none" /></div>
                        <div><label className="block text-sm font-bold text-slate-700 mb-1">Cant. Muertes</label><input type="number" name="cantidad" required min="1" className="w-full p-3 border border-rose-200 rounded-xl outline-none" /></div>
                      </div>
                      <div><label className="block text-sm font-bold text-slate-700 mb-1">Causa</label><input type="text" name="causa" required placeholder="Ej. Diarrea..." className="w-full p-3 border border-rose-200 rounded-xl outline-none" /></div>
                      <button type="submit" className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors shadow-sm">Registrar Baja Definitiva</button>
                    </form>

                    <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider mb-2 flex justify-between items-end">
                      <span>Historial de Bajas</span>
                      <span className="text-xs font-normal normal-case text-slate-400">*Pérdida = Costo del lechón + Su alimento.</span>
                    </h3>
                    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm mb-6 max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                          <tr className="text-slate-600">
                            <th className="p-3 font-semibold">Causa y Fecha</th>
                            <th className="p-3 font-semibold text-center">Bajas</th>
                            <th className="p-3 font-semibold text-right">Pérdida Económica</th>
                            <th className="p-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {listBajas.filter(b => b.loteId === loteActivo.id).map(b => {
                            const alimentosHastaBaja = listAlimentos.filter(a => a.loteId === loteActivo.id && new Date(a.fecha) <= new Date(b.fecha));
                            const costoAlimentoTotal = alimentosHastaBaja.reduce((sum, a) => sum + (a.costo || 0), 0);
                            const costoAlimentoCerdo = costoAlimentoTotal / (loteActivo.cantidad || 1);
                            const costoPorCerdoMuerto = (loteActivo.costoLechon || 0) + costoAlimentoCerdo;
                            const perdidaTotalBaja = b.cantidad * costoPorCerdoMuerto;

                            return (
                              <tr key={b.id} className="hover:bg-slate-50">
                                <td className="p-3">
                                  <p className="font-bold text-slate-800">{b.causa}</p>
                                  <p className="text-xs text-slate-500">{b.fecha}</p>
                                </td>
                                <td className="p-3 text-center font-black text-rose-600">
                                  {b.cantidad}
                                </td>
                                <td className="p-3 text-right">
                                  <p className="font-bold text-rose-600">-{formatearMoneda(perdidaTotalBaja)}</p>
                                  <p className="text-[10px] text-slate-500 mt-1">Valor animal: {formatearMoneda(costoPorCerdoMuerto)} c/u</p>
                                </td>
                                <td className="p-3 text-right">
                                  <button onClick={() => handleEliminarDato('baja', b.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider mb-2">Historial de Egresos Extra</h3>
                    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-sm">
                        <tbody className="divide-y divide-slate-100">
                          {listGastosExtra.filter(g => g.loteId === loteActivo.id).map(g => (
                            <tr key={g.id} className="hover:bg-slate-50"><td className="p-3"><p className="font-bold text-slate-800">{g.descripcion}</p><p className="text-xs text-slate-500">{g.fecha}</p></td><td className="p-3 text-right font-bold text-rose-600">-{formatearMoneda(g.monto)}</td><td className="p-3 text-right"><button onClick={() => handleEliminarDato('gasto', g.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button></td></tr>
                          ))}
                          {listVacunas.filter(v => v.loteId === loteActivo.id).map(v => (
                            <tr key={v.id} className="hover:bg-slate-50"><td className="p-3"><p className="font-bold text-indigo-800">{v.nombre} <span className="bg-indigo-100 text-indigo-700 px-1 rounded text-[10px] ml-1">MÉDICO</span></p><p className="text-xs text-slate-500">{v.fecha}</p></td><td className="p-3 text-right font-bold text-rose-600">-{formatearMoneda(v.costo)}</td><td className="p-3 text-right"><button onClick={() => handleEliminarDato('vacuna', v.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button></td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: FINANZAS Y SIMULADOR */}
              {tabActiva === 'finanzas' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in duration-300">
                  <div className="xl:col-span-4 space-y-6">
                    <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 shadow-sm">
                      <h3 className="font-bold text-lg text-emerald-800 mb-4 flex items-center"><Calculator size={20} className="mr-2" /> Variables del Negocio</h3>
                      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target); setLotes(listLotes.map(l => l.id === loteActivo.id ? { ...l, costoLechon: parseFloat(fd.get('costoLechon')) || 0, precioVentaLibra: parseFloat(fd.get('precioVentaLibra')) || 0, manoObra: parseFloat(fd.get('manoObra')) || 0 } : l)); mostrarAlerta("Éxito", "Parámetros actualizados. El simulador se ha recalculado."); }} className="space-y-5">
                        <p className="text-sm text-emerald-700 leading-relaxed border-b border-emerald-200 pb-4">Define los costos base para que el simulador proyecte tus ganancias reales.</p>
                        <div><label className="block text-sm font-bold text-slate-700 mb-1">Costo Individual por Lechón (Q)</label><input type="number" name="costoLechon" step="0.01" required defaultValue={loteActivo.costoLechon} className="w-full p-3 border border-emerald-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white" /></div>
                        <div><label className="block text-sm font-bold text-slate-700 mb-1">Mano de Obra (A pagar al final) (Q)</label><input type="number" name="manoObra" step="0.01" required defaultValue={loteActivo.manoObra} className="w-full p-3 border border-emerald-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white" /></div>
                        <div><label className="block text-sm font-bold text-slate-700 mb-1">Precio de Venta Esperado (Q / Libra)</label><input type="number" name="precioVentaLibra" step="0.01" required defaultValue={loteActivo.precioVentaLibra} className="w-full p-3 border border-emerald-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white" /></div>
                        <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl transition-all shadow-md mt-4">Aplicar Costos</button>
                      </form>
                    </div>

                    <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-200 shadow-sm">
                      <h3 className="font-bold text-lg text-amber-800 mb-4 flex items-center"><AlertTriangle size={20} className="mr-2" /> Escenario de Estrés</h3>
                      <div className="space-y-4">
                        <p className="text-sm text-amber-700">Calcula cómo se vería afectada tu ganancia final si sufres muertes adicionales antes de la venta.</p>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Muertes Extra Hipotéticas</label>
                          <div className="flex items-center gap-3">
                            <input type="range" min="0" max={stats.cantidadActual} value={simuladorMuertesExtra} onChange={(e) => setSimuladorMuertesExtra(parseInt(e.target.value))} className="flex-1" />
                            <span className="font-black text-2xl text-amber-600 w-12 text-center">{simuladorMuertesExtra}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-2 text-center border-t border-amber-200 pt-2">Simulando vender: <strong>{stats.cantidadParaProyeccion} cerdos.</strong></p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-8">
                    <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><TrendingUp size={20} className="mr-2 text-indigo-500" /> Simulador de Venta (Meta: {stats.pesoObjetivoLb} lbs o más)</h3>

                    {stats.pesoActual >= stats.pesoObjetivoLb ? (
                      <div className="bg-slate-800 text-white p-10 rounded-3xl text-center shadow-lg border-4 border-emerald-500 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><PiggyBank size={150} /></div>
                        <CheckCircle size={64} className="mx-auto text-emerald-400 mb-4 relative z-10" />
                        <h4 className="text-3xl font-black mb-2 relative z-10">¡Lote Listo para Venta!</h4>
                        <p className="text-slate-300 mb-8 text-lg relative z-10">Tus animales han superado el peso objetivo.</p>
                        <div className="bg-slate-900/80 p-6 rounded-2xl inline-block border border-slate-700 relative z-10">
                          <p className="text-sm text-slate-400 uppercase tracking-widest mb-2 font-bold">Utilidad Neta Real Hoy</p>
                          <p className="text-5xl font-black text-emerald-400">{formatearMoneda(stats.utilidadNeta)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-3xl shadow-lg overflow-hidden">
                        <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
                          <div className="absolute right-0 top-0 bottom-0 opacity-20"><TrendingUp size={120} className="-mr-4" /></div>
                          <h4 className="text-indigo-200 font-bold mb-4 uppercase tracking-wider text-sm relative z-10">Proyección a Cierre de Ciclo</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                            <div><p className="text-indigo-200 mb-1">Peso Faltante a Fabricar</p><p className="text-3xl font-black">{stats.proyeccionLibrasFaltantes.toFixed(0)} lbs</p></div>
                            <div><p className="text-indigo-200 mb-1">Alimento Necesario</p><p className="text-3xl font-black">{(stats.proyeccionAlimentoFaltante / 100).toFixed(1)} <span className="text-lg font-normal">Sacos (100lb)</span></p></div>
                          </div>
                        </div>

                        <div className="p-8 space-y-5 text-lg">
                          <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-4">
                            <span className="text-slate-500 font-medium">Inversión hundida a la fecha:</span>
                            <span className="font-bold text-slate-800">-{formatearMoneda(stats.costoInvertidoTotal)}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-4">
                            <span className="text-slate-500 font-medium flex items-center"><AlertTriangle size={18} className="text-amber-500 mr-2" /> Costo de alimento que falta:</span>
                            <span className="font-bold text-rose-500">-{formatearMoneda(stats.proyeccionCostoFaltante)}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-4">
                            <span className="text-slate-800 font-black">Venta Bruta Total (Al llegar a meta):</span>
                            <span className="font-black text-emerald-600 text-2xl">+{formatearMoneda(stats.proyeccionVentaFinal)}</span>
                          </div>

                          <div className="bg-slate-50 border border-slate-200 p-8 rounded-3xl mt-6 text-center shadow-inner relative">
                            {simuladorMuertesExtra > 0 && <div className="absolute top-4 right-4 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full animate-pulse">Escenario Pesimista Activo</div>}
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">Ganancia Neta Limpia (Proyección)</p>
                            <p className={`text-6xl font-black tracking-tight ${stats.proyeccionUtilidadFinal > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {formatearMoneda(stats.proyeccionUtilidadFinal)}
                            </p>
                            <p className="text-slate-500 text-sm mt-4 font-medium max-w-lg mx-auto">Este dinero ya descuenta la compra de lechones, todo el alimento (pasado y futuro), medicinas, extras, mano de obra y las {simuladorMuertesExtra} posibles bajas.</p>
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
      <div className="bg-slate-100 min-h-screen p-4 md:p-8 flex justify-center animate-in fade-in">
        <div className="bg-white max-w-3xl w-full rounded-2xl shadow-xl">
          <div className="bg-slate-800 p-4 flex justify-between items-center rounded-t-2xl">
            <button onClick={() => setVista('corralDetail')} className="text-slate-300 hover:text-white font-medium flex items-center"><ChevronRight size={20} className="rotate-180 mr-1" /> Volver</button>
            <button onClick={() => descargarPDF('ficha-pdf', `Ficha_${corralSeleccionado.nombre}.pdf`)} className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2 px-6 rounded-xl flex items-center shadow-lg shadow-emerald-500/30 transition-colors"><Printer size={18} className="mr-2" /> Descargar PDF</button>
          </div>

          <div id="ficha-pdf" className="p-12 w-full bg-white text-black border-8 border-slate-900 rounded-b-2xl">
            <div className="text-center border-b-4 border-slate-900 pb-6 mb-8">
              <h1 className="text-7xl font-black text-slate-900 tracking-tighter uppercase">{corralSeleccionado.nombre}</h1>
              <p className="text-2xl font-bold text-slate-500 mt-2 uppercase tracking-widest">Porcicontrol</p>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-10">
              <div className="bg-slate-100 p-6 rounded-2xl border-2 border-slate-300 text-center">
                <p className="text-sm font-black text-slate-500 uppercase tracking-widest mb-1">Cerdos Vivos</p>
                <p className="text-6xl font-black text-slate-900">{st.cantidadActual} <span className="text-2xl text-slate-500 font-bold">cabezas</span></p>
              </div>
              <div className="bg-slate-100 p-6 rounded-2xl border-2 border-slate-300 text-center">
                <p className="text-sm font-black text-slate-500 uppercase tracking-widest mb-1">Días de Engorde</p>
                <p className="text-6xl font-black text-slate-900">{st.diasLote} <span className="text-2xl text-slate-500 font-bold">días</span></p>
              </div>
            </div>

            <div className="bg-indigo-50 border-4 border-indigo-900 p-8 rounded-3xl mb-10 text-center">
              <p className="text-lg font-black text-indigo-800 uppercase tracking-widest mb-2">Alimentación Actual ({etapaActual})</p>
              <p className="text-5xl font-black text-indigo-900 mb-2">{alimentoActual}</p>
              {faseActual && <p className="text-sm font-bold text-indigo-700 uppercase tracking-widest border-t border-indigo-200 pt-3 mt-3 inline-block">Vigente: {fInicioStr} al {fFinStr}</p>}
            </div>

            <div className="grid grid-cols-2 gap-8 mb-10 text-center">
              <div>
                <p className="text-sm font-bold text-slate-500 uppercase border-b-2 border-slate-200 pb-2 mb-3">Fecha de Ingreso</p>
                <p className="text-2xl font-bold text-slate-800">{fechaIngresoFormateada}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-500 uppercase border-b-2 border-slate-200 pb-2 mb-3">Último Peso Promedio</p>
                <p className="text-2xl font-bold text-slate-800">{st.pesoActual > 0 ? `${st.pesoActual} lbs` : 'No registrado'}</p>
              </div>
            </div>

            <div className="border-t-4 border-slate-900 pt-8 mt-12">
              <p className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6">Notas / Tratamientos Médicos (Manual)</p>
              <div className="border-b-2 border-dashed border-slate-400 mb-8 h-8"></div>
              <div className="border-b-2 border-dashed border-slate-400 mb-8 h-8"></div>
              <div className="border-b-2 border-dashed border-slate-400 mb-8 h-8"></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPrepararVenta = () => {
    const loteActivo = getLoteActivo(corralSeleccionado.id);
    const totalLbs = ventaPesos.reduce((a, b) => a + b, 0);
    const totalDinero = totalLbs * ventaPrecio;

    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto animate-in fade-in duration-300">
        <button onClick={() => setVista('corralDetail')} className="flex items-center text-emerald-600 hover:text-emerald-800 mb-6 font-medium transition-colors">
          <ChevronRight size={20} className="rotate-180 mr-1" /> Volver al Corral
        </button>

        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-800 flex items-center"><Scale size={28} className="mr-3 text-emerald-500" /> Báscula y Calculadora de Venta</h2>
            <p className="text-slate-500 font-medium mt-1">Registra el peso exacto de cada animal al momento de cargar el camión.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-800">1. Configurar Precio</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Precio acordado por Libra (Q)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-slate-500 font-bold">Q</span>
                    <input type="number" step="0.01" value={ventaPrecio} onChange={(e) => setVentaPrecio(parseFloat(e.target.value) || 0)} className="w-full pl-10 p-3 border border-emerald-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-lg font-bold text-emerald-800 bg-emerald-50/30" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-lg text-slate-800 mb-4">2. Ingreso de Pesos en Báscula</h3>
              <form onSubmit={(e) => { e.preventDefault(); if (pesoInputVenta) { setVentaPesos([...ventaPesos, parseFloat(pesoInputVenta)]); setPesoInputVenta(''); } }} className="flex gap-3 mb-6">
                <input type="number" step="0.1" value={pesoInputVenta} onChange={(e) => setPesoInputVenta(e.target.value)} placeholder="Ej. 225.5" autoFocus className="flex-1 p-4 border-2 border-slate-300 rounded-xl outline-none focus:border-emerald-500 text-2xl font-black text-center" />
                <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-8 rounded-xl transition-colors shadow-md flex items-center">
                  <Plus size={24} className="mr-2" /> Agregar
                </button>
              </form>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[150px]">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Cerdos Pesados ({ventaPesos.length})</h4>
                {ventaPesos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-24 text-slate-400">
                    <span className="italic">No hay cerdos en la lista. Empieza a pesar.</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {ventaPesos.map((peso, index) => (
                      <div key={index} className="bg-white border border-slate-300 shadow-sm pl-4 pr-1 py-1.5 rounded-lg flex items-center gap-3 animate-in zoom-in duration-200">
                        <span className="font-bold text-slate-800 text-lg">{peso} <span className="text-xs text-slate-500 font-normal">lbs</span></span>
                        <button onClick={() => setVentaPesos(ventaPesos.filter((_, i) => i !== index))} className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-md transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-slate-900 rounded-3xl p-6 shadow-xl text-white sticky top-8">
              <h3 className="font-black text-xl mb-6 text-emerald-400 flex items-center border-b border-slate-700 pb-4"><Receipt size={24} className="mr-2" /> Ticket de Venta</h3>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-end">
                  <span className="text-slate-400 text-sm">Cerdos a vender:</span>
                  <span className="text-2xl font-bold">{ventaPesos.length}</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-slate-400 text-sm">Libras Totales:</span>
                  <span className="text-2xl font-bold text-amber-400">{totalLbs.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-slate-400 text-sm">Precio por Lb:</span>
                  <span className="text-lg font-medium">Q{ventaPrecio.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-center mb-8">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Monto a Cobrar</p>
                <p className="text-4xl font-black text-emerald-500">{formatearMoneda(totalDinero)}</p>
              </div>

              <button onClick={procesarVenta} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-lg flex items-center justify-center">
                <CheckCircle size={24} className="mr-2" /> Procesar Venta
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
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-orange-500" />
            <h3 className="text-2xl font-bold text-slate-800 mb-2">No hay lote activo</h3>
            <p className="text-slate-500 mb-6">Selecciona un corral con un lote activo para ver el reporte final.</p>
            <button onClick={() => setVista('dashboard')} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-6 rounded-xl">
              Volver al Dashboard
            </button>
          </div>
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
      <div className="bg-slate-100 min-h-screen p-4 md:p-8 flex justify-center">
        <div className="bg-white max-w-4xl w-full rounded-2xl shadow-xl">

          <div className="bg-slate-900 p-4 flex flex-col sm:flex-row justify-between items-center rounded-t-2xl gap-4">
            <button onClick={() => setVista('corralDetail')} className="text-slate-300 hover:text-white font-medium flex items-center">
              <ChevronRight size={20} className="rotate-180 mr-1" /> Volver al Corral
            </button>

            <div className="flex bg-slate-800 p-1.5 rounded-lg border border-slate-700">
              <button onClick={() => setTipoReporteImpresion('interno')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${tipoReporteImpresion === 'interno' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                Reporte Interno
              </button>
              <button onClick={() => setTipoReporteImpresion('cliente')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${tipoReporteImpresion === 'cliente' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                Ticket Cliente
              </button>
            </div>

            <div className="flex space-x-3">
              <button onClick={() => descargarPDF('documento-pdf', `Reporte_${corralSeleccionado.nombre}.pdf`)} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 px-4 rounded-lg flex items-center transition-colors">
                <Printer size={18} className="mr-2" /> Descargar PDF
              </button>
              <button onClick={confirmarVentaYCerrar} className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2.5 px-4 rounded-lg flex items-center shadow-lg shadow-emerald-500/30 transition-colors">
                <CheckCircle size={18} className="mr-2" /> Confirmar Cierre Oficial
              </button>
            </div>
          </div>

          <div id="documento-pdf" className="bg-white text-black w-full">
            {tipoReporteImpresion === 'cliente' ? (
              <div className="p-12 min-h-[600px] flex flex-col">
                <div className="border-b-2 border-slate-800 pb-6 mb-8 text-center">
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">NOTA DE VENTA</h1>
                  <p className="text-slate-600 mt-1 text-lg font-medium">Porcicontrol</p>
                </div>

                <div className="flex justify-end items-start mb-12">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha de Operación</p>
                    <p className="text-lg font-bold text-slate-800">{hoy}</p>
                    <p className="text-sm font-medium text-slate-500 mt-2">Origen: {corralSeleccionado.nombre}</p>
                  </div>
                </div>

                <div className="flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-y-2 border-slate-800 text-slate-800">
                        <th className="py-4 px-4 font-bold uppercase text-sm">Descripción</th>
                        <th className="py-4 px-4 font-bold uppercase text-sm text-center">Cantidad</th>
                        <th className="py-4 px-4 font-bold uppercase text-sm text-right">Peso Total</th>
                        <th className="py-4 px-4 font-bold uppercase text-sm text-right">Precio/Lb</th>
                        <th className="py-4 px-4 font-bold uppercase text-sm text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-200">
                        <td className="py-6 px-4">
                          <p className="font-bold text-lg text-slate-800">Cerdos Vivos de Engorde</p>
                          <p className="text-sm text-slate-500">Raza/Cruce: {loteActivo.raza || 'Estándar'}</p>
                        </td>
                        <td className="py-6 px-4 text-center font-bold text-lg">{ticketCerdos} <span className="text-sm font-normal text-slate-500">cabezas</span></td>
                        <td className="py-6 px-4 text-right font-bold text-lg">{ticketLibras.toFixed(1)} <span className="text-sm font-normal text-slate-500">lbs</span></td>
                        <td className="py-6 px-4 text-right font-medium text-lg">Q{ticketPrecio.toFixed(2)}</td>
                        <td className="py-6 px-4 text-right font-black text-xl">Q{ticketTotal.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="flex justify-end mt-8">
                    <div className="w-full sm:w-1/2 bg-slate-50 p-6 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500 font-bold">Subtotal:</span>
                        <span className="font-medium">Q{ticketTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-300 pt-4 mt-4">
                        <span className="text-slate-800 font-black text-xl uppercase tracking-wider">TOTAL A PAGAR</span>
                        <span className="font-black text-3xl text-slate-900">Q{ticketTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-20 pt-8 border-t-2 border-slate-200 text-center">
                  <p className="text-lg font-bold text-slate-600 mb-16">¡Gracias por su compra!</p>
                  <div className="grid grid-cols-2 gap-12 max-w-2xl mx-auto">
                    <div>
                      <div className="border-b-2 border-slate-400 mb-2"></div>
                      <p className="text-sm font-bold text-slate-500 uppercase">Entregué Conforme (Granja)</p>
                    </div>
                    <div>
                      <div className="border-b-2 border-slate-400 mb-2"></div>
                      <p className="text-sm font-bold text-slate-500 uppercase">Recibí Conforme (Cliente)</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 w-full">
                <div className="border-b-4 border-emerald-800 pb-6 mb-8 flex justify-between items-end">
                  <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight">REPORTE FINAL DE LOTE</h1>
                    <p className="text-slate-500 mt-2 text-lg font-medium">Porcicontrol (Documento Interno - Histórico)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-800 font-bold text-2xl uppercase">{corralNombre}</p>
                    <p className="text-slate-500 mt-2 text-sm font-bold">Ingreso: <span className="font-normal">{fechaIngresoFormat}</span></p>
                    <p className="text-slate-500 text-sm font-bold">Cierre: <span className="font-normal">{fechaCierre}</span></p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-center">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Cerdos Vendidos</p>
                    <p className="text-3xl font-black text-slate-800">{st.cantidadActual} <span className="text-base font-normal text-slate-500">/ {loteActivo.cantidad}</span></p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-center">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Días de Engorde</p>
                    <p className="text-3xl font-black text-slate-800">{st.diasLote}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-center">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Mortalidad</p>
                    <p className="text-3xl font-black text-rose-600">{st.mortalidadPorcentaje.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="mb-10 page-break-inside-avoid">
                  <h3 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">1. Rendimiento Zootécnico (Libras)</h3>
                  <table className="w-full text-left text-base">
                    <tbody>
                      <tr className="border-b border-slate-100"><td className="py-3 text-slate-600 w-1/2">Peso Promedio Inicial</td><td className="py-3 font-semibold">{st.pesoInicial} lbs</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-3 text-slate-600">Peso Promedio Final (Venta)</td><td className="py-3 font-black text-lg text-emerald-700">{st.pesoActual} lbs</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-3 text-slate-600">Ganancia Media Diaria (GMD)</td><td className="py-3 font-semibold">{st.adg.toFixed(2)} lbs / día</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-3 text-slate-600">Consumo Total de Alimento</td><td className="py-3 font-semibold">{st.consumoTotalLb} lbs</td></tr>
                      <tr className="bg-slate-50"><td className="py-3 px-2 text-slate-800 font-bold">Conversión Alimenticia (FCA)</td><td className="py-3 px-2 font-black text-indigo-700">{st.fca.toFixed(2)} lbs alimento/lb carne</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="mb-10 page-break-inside-avoid">
                  <h3 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">2. Resumen Financiero y Utilidad</h3>
                  <table className="w-full text-left text-base">
                    <tbody>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-600 w-1/2">Compra de Lechones</td><td className="py-2 font-semibold text-right text-rose-600">-{formatearMoneda(st.costoLechones)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-600">Alimento Base (Tolvas)</td><td className="py-2 font-semibold text-right text-rose-600">-{formatearMoneda(st.costoAlimentoTolva)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-600">Raciones Suplementarias (Extras)</td><td className="py-2 font-semibold text-right text-rose-600">-{formatearMoneda(st.costoAlimentoSuplemento)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-600">Gasto Sanidad y Medicamentos</td><td className="py-2 font-semibold text-right text-rose-600">-{formatearMoneda(st.totalSanidad)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-600">Gastos Adicionales (Egresos Extras)</td><td className="py-2 font-semibold text-right text-rose-600">-{formatearMoneda(st.totalGastosExtras)}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-2 text-slate-600">Mano de Obra</td><td className="py-2 font-semibold text-right text-rose-600">-{formatearMoneda(loteActivo.manoObra)}</td></tr>

                      <tr className="bg-rose-50"><td className="py-3 px-2 text-rose-900 font-bold">TOTAL COSTOS / INVERSIÓN</td><td className="py-3 px-2 font-black text-right text-rose-700">-{formatearMoneda(st.costoInvertidoTotal + loteActivo.manoObra)}</td></tr>

                      <tr><td className="py-6"></td><td></td></tr>

                      <tr className="border-b border-slate-200"><td className="py-3 text-slate-800 font-bold">Libras Totales Vendidas (A Q{loteActivo.precioVentaLibra}/lb)</td><td className="py-3 font-black text-right text-emerald-600 text-xl">+{formatearMoneda(st.ingresoEstimado)}</td></tr>

                      <tr className="bg-slate-800 text-white"><td className="py-4 px-4 font-black text-xl uppercase">Utilidad Neta del Lote</td><td className="py-4 px-4 font-black text-right text-2xl">{formatearMoneda(st.utilidadNeta)}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="mb-10 page-break-inside-avoid">
                  <h3 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">3. Análisis Gráfico</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6 text-center">Curva de Crecimiento (Lbs)</h4>
                      <div className="flex items-end justify-around h-48 gap-2 border-b border-slate-300 pb-1 px-2">
                        {historialPesos.map(p => {
                          const alturaBarra = Math.max((p.pesoPromedio / maxPeso) * 100, 5);
                          return (
                            <div key={p.id} className="flex flex-col items-center flex-1 h-full justify-end">
                              <div className="text-xs font-bold text-emerald-700 mb-1">{p.pesoPromedio}</div>
                              <div className="w-full max-w-[40px] rounded-t-sm" style={{ height: `${alturaBarra}%`, backgroundColor: '#10b981' }}></div>
                              <div className="text-[10px] text-slate-500 mt-2 whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
                                {p.fecha.substring(5)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {historialPesos.length === 0 && (
                        <div className="text-center text-slate-400 italic mt-10">No hay pesos registrados.</div>
                      )}
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-center">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6 text-center">Distribución de Costos</h4>
                      <div className="space-y-5 px-2">
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
                              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                                <span>{gasto.label}</span>
                                <span>{porcentaje.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${porcentaje}%`, backgroundColor: gasto.color }}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-10">
                  <h3 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">4. Historial Detallado de Alimentación</h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-slate-100 border-b border-slate-300">
                        <tr>
                          <th className="py-2 px-3 font-bold text-slate-700">Fecha</th>
                          <th className="py-2 px-3 font-bold text-slate-700">Alimento / Mezcla</th>
                          <th className="py-2 px-3 font-bold text-right text-slate-700">Libras Suministradas</th>
                          <th className="py-2 px-3 font-bold text-right text-slate-700">Costo (Q)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {listAlimentos.filter(a => a.loteId === loteActivo.id).sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0)).map(a => (
                          <tr key={a.id} className="break-inside-avoid hover:bg-slate-50">
                            <td className="py-2 px-3 text-slate-600 font-medium">{a.fecha}</td>
                            <td className="py-2 px-3">
                              <span className="font-bold text-slate-800">{a.tipo}</span>
                              {a.esSuplemento && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider block w-fit mt-1">SUPLEMENTO</span>}
                              {a.esSuplemento && <span className="text-xs text-slate-500 ml-1 italic block mt-1">({a.detalleMezcla})</span>}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-700">{a.cantidadLb.toFixed(1)} lbs</td>
                            <td className="py-2 px-3 text-right font-bold text-rose-600">-{formatearMoneda(a.costo)}</td>
                          </tr>
                        ))}
                        {listAlimentos.filter(a => a.loteId === loteActivo.id).length === 0 && (
                          <tr><td colSpan="4" className="py-4 text-center text-slate-400 italic">No hay registros de alimentación para este lote.</td></tr>
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

  // =========================================================================
  // MÓDULO: FINANZAS GLOBALES — Rentabilidad histórica de toda la granja
  // =========================================================================
  const renderFinanzasGlobales = () => {
    // 1. AGREGACIÓN FINANCIERA HISTÓRICA (todos los lotes: Activos y Cerrados)
    const resumenPorLote = listLotes.map(lote => {
      const alimentosLote = listAlimentos.filter(a => a.loteId === lote.id);
      const vacunasLote = listVacunas.filter(v => v.loteId === lote.id);
      const gastosLote = listGastosExtra.filter(g => g.loteId === lote.id);
      const ventasLote = listVentas.filter(v => v.loteId === lote.id);
      const bajasLote = listBajas.filter(b => b.loteId === lote.id);

      const costoLechones = (lote.cantidad || 0) * (lote.costoLechon || 0);
      const costoAlimento = alimentosLote.reduce((s, a) => s + (a.costo || 0), 0);
      const costoMedicinas = vacunasLote.reduce((s, v) => s + (v.costo || 0), 0);
      const costoGastos = gastosLote.reduce((s, g) => s + (g.monto || 0), 0);
      const costoManoObra = lote.manoObra || 0;
      const inversionTotal = costoLechones + costoAlimento + costoMedicinas + costoGastos + costoManoObra;

      const ingresosBrutos = ventasLote.reduce((s, v) => s + (v.totalVenta || 0), 0);
      const utilidadNeta = ingresosBrutos - inversionTotal;

      const lbsCarneVendida = ventasLote.reduce((s, v) => {
        const lbsPorCerdo = v.pesosVenta
          ? v.pesosVenta.reduce((a, p) => a + (p.peso || 0), 0)
          : (v.pesoPromedioLibras || 0) * (v.cantidadCerdos || 0);
        return s + lbsPorCerdo;
      }, 0);
      const costoPorLibra = lbsCarneVendida > 0 ? inversionTotal / lbsCarneVendida : 0;
      const cerdosVendidos = ventasLote.reduce((s, v) => s + (v.cantidadCerdos || 0), 0);
      const bajasTotales = bajasLote.reduce((s, b) => s + (b.cantidad || 0), 0);

      return {
        id: lote.id,
        nombre: listCorrales.find(c => c.id === lote.corralId)?.nombre || `Lote ${lote.id}`,
        estado: lote.estado || 'Activo',
        fechaIngreso: lote.fechaIngreso || '—',
        cantidadInicial: lote.cantidad || 0,
        costoLechones, costoAlimento, costoMedicinas, costoGastos, costoManoObra,
        inversionTotal, ingresosBrutos, utilidadNeta,
        lbsCarneVendida, costoPorLibra, cerdosVendidos, bajasTotales,
      };
    });

    // 2. TOTALES GLOBALES
    const totGlobal = resumenPorLote.reduce((acc, r) => ({
      inversionTotal: acc.inversionTotal + r.inversionTotal,
      ingresosBrutos: acc.ingresosBrutos + r.ingresosBrutos,
      utilidadNeta: acc.utilidadNeta + r.utilidadNeta,
      lbsCarneVendida: acc.lbsCarneVendida + r.lbsCarneVendida,
      costoLechones: acc.costoLechones + r.costoLechones,
      costoAlimento: acc.costoAlimento + r.costoAlimento,
      costoMedicinas: acc.costoMedicinas + r.costoMedicinas,
      costoGastos: acc.costoGastos + r.costoGastos,
      costoManoObra: acc.costoManoObra + r.costoManoObra,
    }), {
      inversionTotal: 0, ingresosBrutos: 0, utilidadNeta: 0, lbsCarneVendida: 0,
      costoLechones: 0, costoAlimento: 0, costoMedicinas: 0, costoGastos: 0, costoManoObra: 0,
    });

    const costoPorLibraGlobal = totGlobal.lbsCarneVendida > 0
      ? totGlobal.inversionTotal / totGlobal.lbsCarneVendida : 0;
    const margenGlobal = totGlobal.ingresosBrutos > 0
      ? ((totGlobal.utilidadNeta / totGlobal.ingresosBrutos) * 100) : 0;

    // 3. ESTRUCTURA DE COSTOS para barras CSS
    const costItems = [
      { label: 'Lechones', value: totGlobal.costoLechones, color: 'bg-blue-500' },
      { label: 'Alimento', value: totGlobal.costoAlimento, color: 'bg-amber-500' },
      { label: 'Medicinas', value: totGlobal.costoMedicinas, color: 'bg-red-400' },
      { label: 'Gastos Extra', value: totGlobal.costoGastos, color: 'bg-purple-500' },
      { label: 'Mano de Obra', value: totGlobal.costoManoObra, color: 'bg-slate-400' },
    ];
    const maxCosto = Math.max(...costItems.map(c => c.value), 1);
    const lotesActivos = resumenPorLote.filter(r => r.estado === 'Activo').length;
    const lotesCerrados = resumenPorLote.filter(r => r.estado === 'Cerrado').length;

    return (
      <div className="p-4 md:p-6 space-y-6 max-w-screen-xl mx-auto">

        {/* ENCABEZADO */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <DollarSign size={26} className="text-emerald-600" />
              Finanzas Globales
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Análisis de rentabilidad histórica — {resumenPorLote.length} lotes ({lotesActivos} activos · {lotesCerrados} cerrados)
            </p>
          </div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            Datos acumulados hasta hoy
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Inversión Histórica</p>
            <p className="text-2xl font-black text-slate-800">{formatearMoneda(totGlobal.inversionTotal)}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {costItems.filter(c => c.value > 0).map(c => (
                <span key={c.label} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{c.label}</span>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Ingresos Brutos</p>
            <p className="text-2xl font-black text-emerald-600">{formatearMoneda(totGlobal.ingresosBrutos)}</p>
            <p className="text-xs text-slate-500 mt-2">{totGlobal.lbsCarneVendida.toFixed(0)} lbs de carne registradas</p>
          </div>

          <div className={`border rounded-xl p-4 shadow-sm ${totGlobal.utilidadNeta >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
            }`}>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Utilidad Neta Global</p>
            <p className={`text-2xl font-black ${totGlobal.utilidadNeta >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}>{formatearMoneda(totGlobal.utilidadNeta)}</p>
            <p className={`text-xs font-bold mt-2 ${totGlobal.utilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-500'
              }`}>Margen: {margenGlobal.toFixed(1)}%</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Costo / Libra Carne</p>
            <p className="text-2xl font-black text-slate-700">
              {costoPorLibraGlobal > 0 ? formatearMoneda(costoPorLibraGlobal) : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-2">Promedio histórico ponderado</p>
          </div>
        </div>

        {/* ESTRUCTURA DE COSTOS — barra horizontal CSS */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Estructura de Costos Acumulada</h3>
          <div className="space-y-3">
            {costItems.map(item => {
              const pct = totGlobal.inversionTotal > 0
                ? ((item.value / totGlobal.inversionTotal) * 100).toFixed(1) : 0;
              const barW = maxCosto > 0 ? (item.value / maxCosto) * 100 : 0;
              return (
                <div key={item.label} className="grid grid-cols-[110px_1fr_120px] items-center gap-3">
                  <span className="text-xs font-bold text-slate-600 truncate">{item.label}</span>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${barW}%` }} />
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-700">{formatearMoneda(item.value)}</span>
                    <span className="text-[10px] text-slate-400 ml-1">({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TABLA DETALLE POR LOTE */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Rentabilidad por Lote</h3>
            <span className="text-xs text-slate-400 font-medium">{resumenPorLote.length} lotes totales</span>
          </div>
          {resumenPorLote.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm font-medium">No hay lotes registrados aún.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-bold text-slate-600">Lote</th>
                    <th className="py-3 px-4 font-bold text-slate-600">Estado</th>
                    <th className="py-3 px-4 font-bold text-right text-slate-600">Inversión</th>
                    <th className="py-3 px-4 font-bold text-right text-slate-600">Ingresos</th>
                    <th className="py-3 px-4 font-bold text-right text-slate-600">Utilidad</th>
                    <th className="py-3 px-4 font-bold text-right text-slate-600">Q/lb Carne</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resumenPorLote.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-800">{r.nombre}</p>
                        <p className="text-xs text-slate-400">{r.cantidadInicial} lechones · {r.fechaIngreso}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${r.estado === 'Activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>{r.estado}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-700">{formatearMoneda(r.inversionTotal)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatearMoneda(r.ingresosBrutos)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${r.utilidadNeta >= 0 ? 'text-emerald-700' : 'text-red-600'
                        }`}>{formatearMoneda(r.utilidadNeta)}</td>
                      <td className="py-3 px-4 text-right text-slate-600 font-medium">
                        {r.costoPorLibra > 0 ? formatearMoneda(r.costoPorLibra) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={2} className="py-3 px-4 font-black text-slate-700 uppercase text-xs tracking-widest">TOTALES GLOBALES</td>
                    <td className="py-3 px-4 text-right font-black text-slate-800">{formatearMoneda(totGlobal.inversionTotal)}</td>
                    <td className="py-3 px-4 text-right font-black text-emerald-700">{formatearMoneda(totGlobal.ingresosBrutos)}</td>
                    <td className={`py-3 px-4 text-right font-black ${totGlobal.utilidadNeta >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}>{formatearMoneda(totGlobal.utilidadNeta)}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-700">
                      {costoPorLibraGlobal > 0 ? formatearMoneda(costoPorLibraGlobal) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

      </div>
    );
  };
  // =========================================================================
  // FIN MÓDULO FINANZAS GLOBALES
  // =========================================================================

  if (!isAppReady) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <PiggyBank size={80} className="text-emerald-400 mb-6 animate-bounce shadow-emerald-500/20 drop-shadow-2xl" />
        <h2 className="text-3xl font-black">Conectando a la Nube...</h2>
        <p className="text-slate-400 mt-2 font-medium">Sincronizando granja de forma compartida</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
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
          className="fixed inset-0 bg-slate-900/50 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 text-slate-300 flex flex-col shadow-2xl transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-center">
          <div className="flex items-center space-x-3 text-emerald-400">
            <PiggyBank size={36} />
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white leading-none">Porcicontrol</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">ERP Porcino</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto mt-4 flex flex-col">
          <div>
            <p className="px-4 text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Operaciones</p>

            <button onClick={() => { setVista('dashboard'); setCorralSeleccionado(null); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-bold ${vista === 'dashboard' ? 'bg-emerald-500 text-slate-900 shadow-md' : 'hover:bg-slate-800 hover:text-emerald-400'}`}>
              <LayoutDashboard size={20} className="mr-3" /> Panel Principal
            </button>

            <button onClick={() => { setVista('bodega'); setCorralSeleccionado(null); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-bold ${vista === 'bodega' ? 'bg-emerald-500 text-slate-900 shadow-md' : 'hover:bg-slate-800 hover:text-emerald-400'}`}>
              <Archive size={20} className="mr-3" /> Bodega Central
            </button>

            {/* Finanzas Globales */}
            <button onClick={() => { setVista('finanzasGlobales'); setCorralSeleccionado(null); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-bold ${vista === 'finanzasGlobales' ? 'bg-emerald-500 text-slate-900 shadow-md' : 'hover:bg-slate-800 hover:text-emerald-400'}`}>
              <DollarSign size={20} className="mr-3" /> Finanzas Globales
            </button>

            <button onClick={() => { setVista('laboratorio'); setCorralSeleccionado(null); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-bold ${vista === 'laboratorio' ? 'bg-emerald-500 text-slate-900 shadow-md' : 'hover:bg-slate-800 hover:text-emerald-400'}`}>
              <Beaker size={20} className="mr-3" /> Lab. Mezclas
            </button>

            <p className="px-4 text-xs font-black uppercase tracking-widest text-slate-500 mb-2 mt-8">Administración</p>

            <button onClick={() => { setVista('historial'); setCorralSeleccionado(null); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-bold ${vista === 'historial' ? 'bg-emerald-500 text-slate-900 shadow-md' : 'hover:bg-slate-800 hover:text-emerald-400'}`}>
              <ClipboardList size={20} className="mr-3" /> Historial de Lotes
            </button>

            <button onClick={() => { setVista('config'); setCorralSeleccionado(null); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-bold ${vista === 'config' ? 'bg-emerald-500 text-slate-900 shadow-md' : 'hover:bg-slate-800 hover:text-emerald-400'}`}>
              <Settings size={20} className="mr-3" /> Ajustes y Fórmulas
            </button>
          </div>

          {/* Botón de Cerrar Sesión al final del Sidebar */}
          <div className="mt-auto pt-8">
            <div className="px-4 py-3 mb-2 bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Usuario Activo</span>
              <span className="text-xs text-slate-300 font-medium truncate">{user.email || 'Cuenta de Google'}</span>
            </div>
            <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center px-4 py-3 rounded-xl transition-all duration-200 font-bold bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20">
              <LogOut size={18} className="mr-2" /> Cerrar Sesión
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 p-4 md:p-6 shadow-sm flex items-center justify-between relative z-10">
          <div className="flex items-center">
            <button onClick={() => setIsSidebarOpen(true)} className="mr-4 md:hidden text-slate-500 hover:text-emerald-600 transition-colors">
              <Menu size={24} />
            </button>
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
              {vista === 'dashboard' && <><LayoutDashboard size={18} className="mr-2 text-emerald-600" /> Panel Principal</>}
              {vista === 'bodega' && <><Archive size={18} className="mr-2 text-amber-600" /> Bodega Central Unificada</>}
              {vista === 'laboratorio' && <><Beaker size={18} className="mr-2 text-indigo-600" /> Laboratorio de Mezclas</>}
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
          <div className="text-xs font-black text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </header>
        <div className="flex-1 overflow-y-auto relative bg-slate-50/50">
          {vista === 'dashboard' && renderDashboard()}
          {vista === 'bodega' && renderBodega()}
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
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
          {/* Ventana del Chat */}
          {isChatOpen && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-80 sm:w-96 h-[500px] max-h-[75vh] mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
              {/* Header */}
              <div className="bg-emerald-600 p-4 flex justify-between items-center text-white shrink-0">
                <div className="flex items-center gap-2">
                  <Activity size={20} className="animate-pulse" />
                  <span className="font-bold">Asistente de Granja</span>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="hover:bg-emerald-700 p-1 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Mensajes */}
              <div className="flex-1 p-4 overflow-y-auto bg-slate-50 flex flex-col gap-3">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-slate-500 text-sm mt-10">
                    <Activity size={32} className="mx-auto text-emerald-300 mb-2" />
                    <p>¡Hola! Conozco todo tu inventario y lotes actuales. ¿Qué deseas saber?</p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`p-3 rounded-xl max-w-[85%] shrink-0 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-emerald-600 text-white self-end rounded-tr-none shadow-md' : 'bg-white border border-slate-200 text-slate-700 self-start rounded-tl-none shadow-sm'}`}>
                      {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <ReactMarkdown 
                          components={{
                            strong: ({node, ...props}) => <strong className="font-bold text-emerald-800" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-4 my-2" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-4 my-2" {...props} />,
                            li: ({node, ...props}) => <li className="mb-1" {...props} />,
                            h1: ({node, ...props}) => <h1 className="text-xl font-bold my-2" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-lg font-bold my-2" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-md font-bold my-1" {...props} />,
                            p: ({node, ...props}) => <p className="mb-2" {...props} />
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="bg-white border border-slate-200 text-slate-500 self-start rounded-xl rounded-tl-none shadow-sm p-3 text-sm flex gap-1 items-center">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-slate-200 bg-white shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                    placeholder="Escribe tu pregunta..."
                    className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    onClick={handleSendChatMessage}
                    disabled={isChatLoading || !chatInput.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-xl disabled:opacity-50 transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Botón Flotante */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`${isChatOpen ? 'bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-500'} text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center`}
          >
            {isChatOpen ? <X size={28} /> : <Activity size={28} />}
          </button>
        </div>

      </main>
    </div>
  );
}

// ============================================================================
// COMPONENTE CONTENEDOR (LOGIN Y AUTENTICACIÓN HÍBRIDA)
// ============================================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // Estados para el login con correo
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Escuchar si el usuario inicia o cierra sesión
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
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
      } else {
        setAuthError('Error al conectar con Google. Revisa tu configuración en Firebase o usa tu correo.');
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

  // SI NO HAY USUARIO, MOSTRAMOS LA PANTALLA DE LOGIN HÍBRIDA
  if (!user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4 font-sans text-slate-800">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5"><PiggyBank size={150} /></div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="bg-emerald-500/20 p-4 rounded-full mb-4 border border-emerald-500/30">
                <PiggyBank size={48} className="text-emerald-400" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white leading-none">Porcicontrol</h1>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-500 mt-2">Acceso a la Granja</p>
            </div>
          </div>

          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
              {isRegistering ? 'Crear una cuenta nueva' : 'Identifícate para continuar'}
            </h2>

            {authError && (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-sm font-bold flex items-center mb-6 border border-rose-200">
                <AlertTriangle size={18} className="mr-2 shrink-0" />
                {authError}
              </div>
            )}

            {/* Formulario de Correo / Contraseña */}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="tu@correo.com"
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 transition-all"
                />
              </div>

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl shadow-lg shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 mt-2">
                {isRegistering ? 'Registrarme' : 'Entrar con Correo'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
                className="text-slate-500 text-sm font-bold hover:text-emerald-700 transition-colors"
              >
                {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
              </button>
            </div>

            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-slate-200"></div>
              <span className="px-3 text-xs font-bold text-slate-400 uppercase tracking-widest">O</span>
              <div className="flex-1 border-t border-slate-200"></div>
            </div>

            {/* Botón de Google */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 px-4 rounded-xl border-2 border-slate-200 transition-all flex items-center justify-center gap-3"
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