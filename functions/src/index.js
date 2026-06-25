import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const APP_ID = 'agrocontrol-local';
const MAX_PROMPT_CHARS = 90_000;

export const askFarmAssistant = onCall(
  // App Check queda desactivado temporalmente hasta configurar reCAPTCHA Enterprise en Firebase.
  // La función sigue protegida por Firebase Auth y membresía activa en Firestore.
  { secrets: [geminiApiKey], enforceAppCheck: false, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const membership = await getFirestore()
      .doc(`artifacts/${APP_ID}/members/${request.auth.uid}`)
      .get();
    if (!membership.exists || membership.data()?.active !== true) {
      throw new HttpsError('permission-denied', 'No perteneces a esta granja.');
    }

    const systemPrompt = String(request.data?.systemPrompt || '');
    const contents = Array.isArray(request.data?.contents) ? request.data.contents : [];
    const payloadSize = systemPrompt.length + JSON.stringify(contents).length;
    if (!systemPrompt || payloadSize > MAX_PROMPT_CHARS) {
      throw new HttpsError('invalid-argument', 'La solicitud está vacía o excede el límite permitido.');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey.value()}`,
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
      console.error('Gemini error', response.status, await response.text());
      throw new HttpsError('internal', 'El asistente no está disponible temporalmente.');
    }

    const data = await response.json();
    return { candidates: data.candidates || [] };
  }
);
