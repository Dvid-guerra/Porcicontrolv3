import { FOCUS_RING } from './uiConstants.js';
import { STATUS } from './status.js';

const BUTTON_VARIANTS = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'bg-surface-raised text-ink border border-line-strong hover:bg-surface-sunken',
  quiet: 'text-ink hover:bg-surface-sunken',
};

const BUTTON_SIZES = {
  sm: 'h-control-sm px-3 gap-1.5',
  md: 'h-control-md px-4 gap-2 max-md:h-12',
  field: 'h-control-field px-5 gap-2.5 w-full',
};

export function Button({ variant = 'secondary', size = 'md', icon: Icon, className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-ds-md type-strong whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none ${FOCUS_RING} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={size === 'field' ? 22 : 16} aria-hidden="true" className="shrink-0" />}
      {children}
    </button>
  );
}

const TONE_CLASSES = {
  success: 'bg-success-soft text-success border-success',
  warning: 'bg-warning-soft text-warning border-warning',
  danger: 'bg-danger-soft text-danger border-danger',
  info: 'bg-info-soft text-info border-info',
};

export function StatusBadge({ status, children }) {
  const config = STATUS[status] ?? STATUS.aviso;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 h-6 px-2 rounded-ds-sm border whitespace-nowrap type-small ${TONE_CLASSES[config.tone]}`}>
      <Icon size={13} aria-hidden="true" className="shrink-0" />
      {children ?? config.label}
    </span>
  );
}

export function Card({ title, subtitle, actions, className = '', children }) {
  return (
    <section className={`bg-surface-raised border border-line rounded-ds-lg shadow-card ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div>
            {title && <h2 className="type-heading text-ink">{title}</h2>}
            {subtitle && <p className="type-small text-ink-muted mt-0.5">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`bg-surface-sunken rounded-ds-sm motion-safe:animate-pulse ${className}`} />;
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10">
      {Icon && <Icon size={28} aria-hidden="true" className="text-ink-muted mb-3" />}
      <p className="type-strong text-ink">{title}</p>
      {children && <p className="type-body text-ink-muted mt-1 max-w-sm">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
