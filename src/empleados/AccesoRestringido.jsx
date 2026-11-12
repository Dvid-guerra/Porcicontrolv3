import { LogOut } from 'lucide-react';
import { ROL } from './accesos.js';

const MENSAJES = {
  [ROL.pendiente]: {
    titulo: 'Tu cuenta está pendiente de aprobación',
    texto: 'Un administrador de la granja tiene que autorizarla en Porcicontrol, sección Empleados → Cuentas. Mientras tanto no podés ver ningún dato.'
  },
  [ROL.empleado]: {
    titulo: 'Esta cuenta es de empleados',
    texto: 'Con esta cuenta solo se puede usar la app de registro para empleados. La app principal es para administradores.'
  },
  'sin-conexion': {
    titulo: 'Hace falta internet',
    texto: 'Conectate una vez para comprobar el acceso de esta cuenta.'
  },
  'sin-reglas': {
    titulo: 'Faltan publicar los permisos',
    texto: 'Firestore rechazó la consulta de acceso. Publicá las reglas nuevas con "npm run deploy:rules" y volvé a entrar.'
  },
  error: {
    titulo: 'No se pudo comprobar el acceso',
    texto: 'Revisá la conexión y recargá la página.'
  }
};

// Pantalla para cuentas que iniciaron sesión pero no son administradoras.
export default function AccesoRestringido({ estado, user, marca, urlEmpleados, onSalir }) {
  const { titulo, texto } = MENSAJES[estado] || MENSAJES.error;
  return (
    <div className="min-h-dvh w-full flex flex-col items-center justify-center bg-sidebar text-sidebar-ink px-5 py-8">
      {marca && <img src={marca} alt="Guerra Farm" className="h-20 w-auto mb-5" />}
      <div className="w-full max-w-md bg-surface-raised text-ink rounded-ds-lg shadow-pop p-6 space-y-4">
        <h1 className="type-title">{titulo}</h1>
        <p className="type-body text-ink-muted">{texto}</p>
        <p className="type-small text-ink-muted break-all">Cuenta: {user?.email || user?.uid}</p>
        {estado === ROL.empleado && urlEmpleados && (
          <a href={urlEmpleados} className="flex h-12 items-center justify-center rounded-ds-md bg-primary text-on-primary type-strong">
            Abrir la app de empleados
          </a>
        )}
        <button type="button" onClick={onSalir} className="w-full h-12 rounded-ds-md border border-line-strong type-strong flex items-center justify-center gap-2">
          <LogOut size={16} aria-hidden="true" /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}
