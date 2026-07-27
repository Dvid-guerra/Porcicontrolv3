# AgroControl Porcino

Aplicación web y de escritorio para controlar lotes porcinos, alimentación, inventario, sanidad, pesajes, ventas y rentabilidad.

## Requisitos

- Node.js 20 o superior
- Un proyecto Firebase con Authentication, Firestore, Functions y App Check
- Firebase CLI autenticado para despliegues

## Configuración local

1. Copia `.env.example` como `.env.local` y completa la configuración pública de Firebase y la clave de sitio de reCAPTCHA Enterprise.
2. Instala dependencias con `npm ci`.
3. Ejecuta `npm run dev`.

La clave de Gemini no pertenece en archivos `.env` del frontend. Se configura como secreto de Functions:

```powershell
npx firebase functions:secrets:set GEMINI_API_KEY
```

## Acceso por granja

Los datos de la granja predeterminada usan el identificador `agrocontrol-local`. El acceso es de un solo nivel: cualquier cuenta autenticada (correo/contraseña o Google) puede entrar y usar la app por completo. No hay roles ni una colección de miembros que aprobar manualmente.

## Comandos

- `npm run lint`: análisis estático.
- `npm test`: pruebas de cálculos productivos y financieros.
- `npm run build`: compilación web.
- `npm run build-exe`: instalador de Windows.
- `npm run deploy:rules`: reglas de Firestore.
- `npm run deploy:functions`: proxy seguro del asistente.

## Seguridad

- Electron ejecuta el renderer aislado, sin acceso a Node.
- La IA se consume mediante una Function autenticada, con App Check y secreto administrado.
- Firestore requiere membresía activa y aplica permisos por rol.
- No se deben guardar claves privadas, archivos `.env`, instaladores ni artefactos de Firebase en el repositorio.

La clave de Gemini que estuvo incluida en versiones anteriores debe revocarse manualmente desde Google Cloud Console. Retirarla del código no invalida copias ya distribuidas.

## Modelo actual y migración futura

Los registros existentes se mantienen en documentos separados por categoría para conservar compatibilidad. Las actualizaciones funcionales usan transacciones para evitar sobrescrituras concurrentes. Para instalaciones con muchos años de datos, la siguiente migración recomendada es almacenar cada peso, consumo, venta y gasto como documento individual en subcolecciones.
