// ============================================================================
// DOMINIO: LÓGICA PURA DEL LECTOR QR DE CAMPO (CÁMARA + FOTO)
// Sin DOM, sin React: aquí vive todo lo que se puede probar sin un navegador.
// El ciclo de vida de la cámara vive en App.jsx; las decisiones viven aquí.
// ============================================================================

// Un galpón tiene poca luz y el operario mantiene el rótulo QR encuadrado varios
// segundos. Si el código no resuelve a un corral, no queremos repintar el error
// cuatro veces por segundo: lo ignoramos mientras siga a la vista y solo volvemos
// a procesarlo cuando desaparezca del encuadre este tiempo.
const VENTANA_ANTIRREBOTE_MS = 2500;

// Decodificar el cuadro completo de una cámara de 1280x720 en un teléfono viejo
// desperdicia CPU: 640 px de lado mayor es suficiente para un QR impreso a 5 cm
// y multiplica por cuatro los cuadros analizados por segundo.
const LADO_MAXIMO_CAPTURA = 640;

export const MOTIVO_CAMARA = {
  SIN_HTTPS: 'sinHttps',
  SIN_SOPORTE: 'sinSoporte',
  PERMISO_DENEGADO: 'permisoDenegado',
  SIN_CAMARA: 'sinCamara',
  CAMARA_OCUPADA: 'camaraOcupada',
  DESCONOCIDO: 'desconocido'
};

/**
 * Traduce un fallo de `getUserMedia` (o la ausencia de la API) a un mensaje
 * accionable en español y dice si vale la pena ofrecer el botón "Reintentar".
 *
 * `contextoSeguro` es `window.isSecureContext`: servir la app por http:// en una
 * IP de la LAN —lo típico al probar desde el teléfono— deja `mediaDevices`
 * indefinido, y culpar al navegador manda al operario a buscar donde no es.
 */
export function describirErrorCamara({
  error = null,
  soportaMediaDevices = true,
  contextoSeguro = true
} = {}) {
  if (!contextoSeguro) {
    return {
      motivo: MOTIVO_CAMARA.SIN_HTTPS,
      mensaje: 'La cámara solo funciona en sitios seguros. Abre la app con https:// (no con la IP de la red) y vuelve a intentar.',
      reintentable: false
    };
  }

  if (!soportaMediaDevices) {
    return {
      motivo: MOTIVO_CAMARA.SIN_SOPORTE,
      mensaje: 'Este navegador no permite abrir la cámara. Usa la opción de foto del QR o toca el corral en la lista.',
      reintentable: false
    };
  }

  const nombre = String(error?.name || '');

  if (nombre === 'NotAllowedError' || nombre === 'PermissionDeniedError' || nombre === 'SecurityError') {
    return {
      motivo: MOTIVO_CAMARA.PERMISO_DENEGADO,
      mensaje: 'Bloqueaste el permiso de cámara. Habilítalo en el candado de la barra de direcciones y toca Reintentar.',
      reintentable: true
    };
  }

  if (nombre === 'NotFoundError' || nombre === 'DevicesNotFoundError' || nombre === 'OverconstrainedError') {
    return {
      motivo: MOTIVO_CAMARA.SIN_CAMARA,
      mensaje: 'No se encontró ninguna cámara en este dispositivo. Usa la foto del QR o toca el corral en la lista.',
      reintentable: false
    };
  }

  if (nombre === 'NotReadableError' || nombre === 'TrackStartError' || nombre === 'AbortError') {
    return {
      motivo: MOTIVO_CAMARA.CAMARA_OCUPADA,
      mensaje: 'Otra app está usando la cámara. Ciérrala (WhatsApp, Cámara, Zoom) y toca Reintentar.',
      reintentable: true
    };
  }

  return {
    motivo: MOTIVO_CAMARA.DESCONOCIDO,
    mensaje: 'No se pudo abrir la cámara. Toca Reintentar, usa la foto del QR o elige el corral en la lista.',
    reintentable: true
  };
}

/**
 * Antirrebote del escaneo continuo: evita reprocesar el mismo texto mientras el
 * rótulo sigue en el encuadre. Cada avistamiento refresca la ventana, así que un
 * QR desconocido se reporta una sola vez por más que el operario lo sostenga.
 */
export function crearControlEscaneoRepetido({ ventanaMs = VENTANA_ANTIRREBOTE_MS } = {}) {
  let ultimoTexto = null;
  let ultimoInstante = 0;

  return {
    debeProcesar(texto, ahora = Date.now()) {
      const limpio = String(texto ?? '').trim();
      if (!limpio) return false;

      const esRepetidoReciente = limpio === ultimoTexto && ahora - ultimoInstante < ventanaMs;
      ultimoTexto = limpio;
      ultimoInstante = ahora;

      return !esRepetidoReciente;
    },
    reiniciar() {
      ultimoTexto = null;
      ultimoInstante = 0;
    }
  };
}

/**
 * Reduce el cuadro de video al tamaño mínimo que todavía decodifica bien,
 * conservando la proporción. Devuelve enteros listos para un `<canvas>`.
 */
export function calcularTamanoCaptura({ ancho, alto, ladoMaximo = LADO_MAXIMO_CAPTURA } = {}) {
  const anchoFuente = Math.floor(Number(ancho) || 0);
  const altoFuente = Math.floor(Number(alto) || 0);
  if (anchoFuente <= 0 || altoFuente <= 0) return null;

  const ladoMayor = Math.max(anchoFuente, altoFuente);
  const limite = Math.max(1, Math.floor(Number(ladoMaximo) || LADO_MAXIMO_CAPTURA));
  if (ladoMayor <= limite) {
    return { ancho: anchoFuente, alto: altoFuente, escala: 1 };
  }

  const escala = limite / ladoMayor;
  return {
    ancho: Math.max(1, Math.round(anchoFuente * escala)),
    alto: Math.max(1, Math.round(altoFuente * escala)),
    escala
  };
}

/**
 * ¿Hay `BarcodeDetector` nativo? Chrome/Edge en Android y escritorio sí;
 * Safari (todo iOS) y Firefox no, y ahí entra el decodificador empaquetado.
 */
export function soportaDeteccionNativaQr(ambito) {
  return Boolean(ambito && typeof ambito.BarcodeDetector === 'function');
}
