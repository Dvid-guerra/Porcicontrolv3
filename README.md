# AgroControl Porcino

Aplicación web para controlar lotes porcinos, alimentación, inventario, sanidad, pesajes, ventas y rentabilidad.

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

## Acceso y roles

Crear una cuenta ya no da acceso. Cada cuenta tiene un documento en `artifacts/agrocontrol-local/members/{uid}`:

| Rol | `active` / `role` | Qué puede hacer |
| --- | --- | --- |
| Administrador | `true` / `admin` (o sin `role`) | App principal completa. Aprueba cuentas y registros de empleados. |
| Empleados | `true` / `empleado` | Solo la app de empleados: lee el catálogo sin precios y crea capturas. |
| Pendiente | `false` / `pendiente` | Nada. Aparece en **Empleados → Cuentas con acceso** para aprobarla. |

Las reglas (`firestore.rules`) son las que bloquean; la interfaz solo las refleja.

**Primer administrador (una sola vez):** después de publicar las reglas, entra a la app, y en la consola de Firebase → Firestore abre `artifacts/agrocontrol-local/members/{tu uid}` y pon `active: true` y `role: "admin"`. Las demás cuentas se aprueban desde la app.

## Plataforma de empleados

Sitio aparte (otro build y otra URL) para que el personal registre concentrado, medicamentos, insumos, pesajes y bajas sin ver la app principal.

- Código: `empleados.html` + `src/empleados/`. Lógica compartida y probada en `src/domain/capturasEmpleado.js`.
- `npm run dev:empleados` abre `http://localhost:5173/empleados.html`; `npm run build:empleados` genera `dist-empleados/`.
- Despliegue: segundo proyecto en Vercel sobre este mismo repositorio, con Build Command `npm run build:empleados` y Output Directory `dist-empleados`. Usa las mismas variables `VITE_FIREBASE_*`.
- Opcional: `VITE_URL_APP_EMPLEADOS` en la app principal muestra el enlace en la vista Empleados.

Flujo de datos:

1. La app principal publica `granja_empleados/catalogo` (corrales con lote activo y nombres de productos, **sin precios ni costos**) cada vez que algo cambia.
2. El empleado guarda una *captura* en `granja_capturas` (funciona sin señal; se envía al reconectar).
3. Un administrador la aprueba en **Empleados → Bandeja de registros**. Ahí se valida el stock, se calcula el costo y se crean los registros reales del lote. Rechazarla no toca nada.

## Comandos

- `npm run lint`: análisis estático.
- `npm test`: pruebas de cálculos productivos y financieros.
- `npm run build`: compilación web.
- `npm run build:empleados`: compilación de la app de empleados (`dist-empleados/`).
- `npm run preview`: sirve localmente la compilación de `dist/`.
- `npm run deploy:rules`: reglas de Firestore.
- `npm run deploy:functions`: proxy seguro del asistente.

## Seguridad

- El frontend se sirve con una Content Security Policy restrictiva definida en `index.html`.
- La IA se consume mediante una Function autenticada, con App Check y secreto administrado.
- Firestore requiere membresía activa y aplica permisos por rol (ver "Acceso y roles").
- No se deben guardar claves privadas, archivos `.env` ni artefactos de Firebase en el repositorio.

La clave de Gemini que estuvo incluida en versiones anteriores debe revocarse manualmente desde Google Cloud Console. Retirarla del código no invalida copias ya distribuidas.

## Modelo actual y migración futura

Los registros existentes se mantienen en documentos separados por categoría para conservar compatibilidad. Las actualizaciones funcionales usan transacciones para evitar sobrescrituras concurrentes. Para instalaciones con muchos años de datos, la siguiente migración recomendada es almacenar cada peso, consumo, venta y gasto como documento individual en subcolecciones.
