import { AlertTriangle, Ban, CheckCircle2, Clock, HeartPulse, Info, Scale } from 'lucide-react';

export const STATUS = {
  meta: { label: 'Al día', tone: 'success', icon: CheckCircle2 },
  listo: { label: 'Listo para venta', tone: 'success', icon: Scale },
  sinPesar: { label: 'Sin pesar', tone: 'warning', icon: Clock },
  bajo: { label: 'Stock bajo', tone: 'warning', icon: AlertTriangle },
  mortalidad: { label: 'Mortalidad alta', tone: 'danger', icon: HeartPulse },
  sobreEngorde: { label: 'Sobre-engorde', tone: 'danger', icon: AlertTriangle },
  critico: { label: 'Stock crítico', tone: 'danger', icon: AlertTriangle },
  bloqueada: { label: 'Venta bloqueada', tone: 'info', icon: Ban },
  aviso: { label: 'Aviso', tone: 'info', icon: Info },
};
