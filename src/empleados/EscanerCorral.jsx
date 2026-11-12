import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { parseCorralQrPayload } from '../domain/qrTolva.js';
import {
  calcularTamanoCaptura,
  crearControlEscaneoRepetido,
  describirErrorCamara,
  soportaDeteccionNativaQr
} from '../domain/qrScanner.js';

// Lector del rótulo QR del corral (los mismos rótulos que imprime Porcicontrol).
// Usa el detector nativo del navegador cuando existe y jsQR como respaldo.
export default function EscanerCorral({ corrales, onCorral, onCerrar }) {
  const videoRef = useRef(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    let stream = null;
    let temporizador = null;
    const control = crearControlEscaneoRepetido();
    const lienzo = document.createElement('canvas');

    const procesar = (textoQr) => {
      if (!control.debeProcesar(textoQr)) return;
      const resultado = parseCorralQrPayload(textoQr, corrales);
      if (!resultado.ok) {
        setAviso('Ese QR no es de un corral de la granja.');
        return;
      }
      if (!resultado.corral.loteId) {
        setAviso(`${resultado.corral.nombre} no tiene cerdos ahorita.`);
        return;
      }
      onCorral(resultado.corral);
    };

    const iniciar = async () => {
      const soportaMediaDevices = Boolean(navigator.mediaDevices?.getUserMedia);
      if (!window.isSecureContext || !soportaMediaDevices) {
        setError(describirErrorCamara({ soportaMediaDevices, contextoSeguro: window.isSecureContext }).mensaje);
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (err) {
        if (activo) setError(describirErrorCamara({ error: err }).mensaje);
        return;
      }
      if (!activo) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      let detectorNativo = null;
      let jsQR = null;
      if (soportaDeteccionNativaQr(window)) {
        try {
          detectorNativo = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch {
          detectorNativo = null;
        }
      }
      if (!detectorNativo) {
        const modulo = await import('jsqr');
        jsQR = modulo.default || modulo;
      }

      const leerCuadro = async () => {
        if (!activo) return;
        try {
          if (video.readyState >= 2 && video.videoWidth > 0) {
            if (detectorNativo) {
              const codigos = await detectorNativo.detect(video);
              if (codigos[0]?.rawValue) procesar(codigos[0].rawValue);
            } else {
              const medida = calcularTamanoCaptura({ ancho: video.videoWidth, alto: video.videoHeight });
              if (medida) {
                lienzo.width = medida.ancho;
                lienzo.height = medida.alto;
                const ctx = lienzo.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(video, 0, 0, medida.ancho, medida.alto);
                const imagen = ctx.getImageData(0, 0, medida.ancho, medida.alto);
                const codigo = jsQR(imagen.data, imagen.width, imagen.height);
                if (codigo?.data) procesar(codigo.data);
              }
            }
          }
        } catch {
          // Un cuadro ilegible no detiene el lector.
        }
        if (activo) temporizador = setTimeout(leerCuadro, 250);
      };
      leerCuadro();
    };

    iniciar();

    return () => {
      activo = false;
      if (temporizador) clearTimeout(temporizador);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [corrales, onCorral, intento]);

  return (
    <div className="fixed inset-0 z-50 bg-forest-950 flex flex-col" role="dialog" aria-modal="true" aria-label="Escanear QR del corral">
      <div className="flex items-center justify-between px-4 py-3 text-cream">
        <p className="type-heading">Apuntá al QR del corral</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar cámara" className="h-12 w-12 flex items-center justify-center rounded-ds-md bg-sidebar-active">
          <X size={24} aria-hidden="true" />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        {!error && <div aria-hidden="true" className="absolute inset-0 m-auto h-56 w-56 rounded-ds-lg border-4 border-wheat" />}
      </div>
      <div className="px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-cream min-h-[5.5rem]">
        {error ? (
          <div role="alert" className="space-y-3">
            <p className="type-body">{error}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setError(''); setIntento((n) => n + 1); }} className="h-12 flex-1 rounded-ds-md bg-cream text-forest type-strong">Reintentar</button>
              <button type="button" onClick={onCerrar} className="h-12 flex-1 rounded-ds-md border border-cream type-strong">Elegir de la lista</button>
            </div>
          </div>
        ) : (
          <p role="status" className="type-body">{aviso || 'Mantené el rótulo dentro del cuadro.'}</p>
        )}
      </div>
    </div>
  );
}
