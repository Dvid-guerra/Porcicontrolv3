# AgroControl Porcino

Aplicación web para controlar lotes porcinos, alimentación, inventario, sanidad, pesajes, ventas y rentabilidad.

## Requisitos

- Node.js 22 para las funciones de Firebase
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
| Empleados | `true` / `empleado` | Consulta existencias de concentrado, envía registros por corral y ve sus propias solicitudes. |
| Pendiente | `false` / `pendiente` | Nada. Aparece en **Empleados → Cuentas con acceso** para aprobarla. |

Las reglas (`firestore.rules`) son las que bloquean; la interfaz solo las refleja.

**Primer administrador (una sola vez):** después de publicar las reglas, entra a la app, y en la consola de Firebase → Firestore abre `artifacts/agrocontrol-local/members/{tu uid}` y pon `active: true` y `role: "admin"`. Las demás cuentas se aprueban desde la app.

## Registros por corral

Todo el personal inicia sesión en la misma dirección. Desde **Empleados → Cuentas con acceso**, asigná el rol de empleado a la cuenta de cada persona.

1. El empleado consulta el concentrado disponible y elige el corral para reportar concentrado servido, aplicación de medicamento, uso de insumo o baja.
2. La solicitud queda pendiente e identificada con su cuenta. Si trabaja sin señal, se envía al reconectar. Puede retirar sus solicitudes pendientes.
3. En **Empleados → Bandeja de registros**, el administrador aprueba o rechaza con conexión. Al aprobar, se comprueban las existencias o los animales vivos y se guardan juntos el movimiento y su autorización. Una solicitud rechazada conserva el motivo en el historial del empleado.

Tras desplegar, abrí una vez la app como administrador con conexión para publicar el catálogo inicial. Los cambios de inventario, corrales y lotes actualizan ese catálogo en la misma transacción. Después los empleados pueden consultarlo aunque el administrador haya cerrado sesión. En Empleados → Catálogo de corrales podés volver a publicarlo. En Empleados podés autorizar por correo una cuenta que ya exista en Firebase Authentication, aunque todavía no figure en la lista de solicitudes. Para publicar este cambio, desplegá Firestore y Hosting con el comando de empleados. El personal con una instalación del sitio anterior debe abrir la dirección principal.

## Comandos

- `npm run lint`: análisis estático.
- `npm test`: pruebas de cálculos productivos y financieros.
- `npm run build`: compilación web.
- `npm run preview`: sirve localmente la compilación de `dist/`.
- `npm run deploy:rules`: reglas de Firestore.
- `npm run deploy:empleados -- --project agroporcina`: compila y publica Firestore y Hosting para el flujo de empleados en Spark.
- `npm run deploy:functions`: proxy seguro del asistente.

## Seguridad

- El frontend se sirve con una Content Security Policy restrictiva definida en `index.html`.
- La IA se consume mediante una Function autenticada, con App Check y secreto administrado.
- Firestore requiere membresía activa y aplica permisos por rol (ver "Acceso y roles").
- No se deben guardar claves privadas, archivos `.env` ni artefactos de Firebase en el repositorio.

La clave de Gemini que estuvo incluida en versiones anteriores debe revocarse manualmente desde Google Cloud Console. Retirarla del código no invalida copias ya distribuidas.

## Modelo actual y migración futura

Los registros existentes se mantienen en documentos separados por categoría para conservar compatibilidad. Las actualizaciones funcionales usan transacciones para evitar sobrescrituras concurrentes. Para instalaciones con muchos años de datos, la siguiente migración recomendada es almacenar cada peso, consumo, venta y gasto como documento individual en subcolecciones.
