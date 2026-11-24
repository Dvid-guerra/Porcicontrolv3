import { LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { onSnapshot, runTransaction } from 'firebase/firestore';
import { refInvitacion, refMiembro, ROL } from './accesos.js';

const MENSAJES = {
  [ROL.pendiente]: {
    titulo: 'Tu cuenta está pendiente de aprobación',
    texto: 'Un administrador de la granja tiene que autorizarla en Porcicontrol, sección Empleados → Cuentas. Mientras tanto no podés ver ningún dato.'
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
export default function AccesoRestringido({ estado, user, db, appId, marca, onSalir }) {
  const [invitada, setInvitada] = useState(false);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (estado !== ROL.pendiente || !user.email) return;
    return onSnapshot(refInvitacion(db, appId, user.email), snap => setInvitada(snap.exists()), () => setInvitada(false));
  }, [db, appId, user, estado]);
  const activar = async () => {
    setOcupado(true);
    try {
      await user.reload();
      if (!user.emailVerified) {
        await sendEmailVerification(user);
        setAviso('Abrí el enlace de verificación en tu correo y después pulsá Activar acceso.');
        return;
      }
      await user.getIdToken(true);
      const invitacion = refInvitacion(db, appId, user.email);
      const miembro = refMiembro(db, appId, user.uid);
      await runTransaction(db, async tx => {
        const [permiso, cuenta] = await Promise.all([tx.get(invitacion), tx.get(miembro)]);
        if (!permiso.exists() || !cuenta.exists() || cuenta.data().active) return;
        tx.update(miembro, { active: true, role: ROL.empleado });
        tx.delete(invitacion);
      });
    } catch {
      setAviso('No se pudo activar el acceso. Revisá el correo y la conexión, o pedí que aprueben tu solicitud.');
    } finally {
      setOcupado(false);
    }
  };
  const { titulo, texto } = MENSAJES[estado] || MENSAJES.error;
  return (
    <div className="min-h-dvh w-full flex flex-col items-center justify-center bg-sidebar text-sidebar-ink px-5 py-8">
      {marca && <img src={marca} alt="Guerra Farm" className="h-20 w-auto mb-5" />}
      <div className="w-full max-w-md bg-surface-raised text-ink rounded-ds-lg shadow-pop p-6 space-y-4">
        <h1 className="type-title">{titulo}</h1>
        <p className="type-body text-ink-muted">{texto}</p>
        <p className="type-small text-ink-muted break-all">Cuenta: {user?.email || user?.uid}</p>
        {estado === ROL.pendiente && invitada && <button type="button" disabled={ocupado} onClick={activar} className="w-full h-12 rounded-ds-md bg-primary text-on-primary type-strong">Activar acceso de empleado</button>}
        {aviso && <p role="status" className="type-small">{aviso}</p>}
        <button type="button" onClick={onSalir} className="w-full h-12 rounded-ds-md border border-line-strong type-strong flex items-center justify-center gap-2">
          <LogOut size={16} aria-hidden="true" /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}
