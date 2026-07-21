import { Eye, EyeOff } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * MaskedValue — Animated reveal/hide for sensitive values like currency.
 * Preserves exact existing behavior from AdminDashboard.
 */
const MaskedValue = ({ value, show, prefix = "Rp " }) => (
  <AnimatePresence mode="wait">
    {show ? (
      <motion.span
        key="value"
        initial={{ opacity: 0, filter: "blur(5px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, filter: "blur(5px)" }}
        transition={{ duration: 0.3 }}
      >
        {prefix}{value.toLocaleString('id-ID')}
      </motion.span>
    ) : (
      <motion.span
        key="masked"
        initial={{ opacity: 0, filter: "blur(5px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, filter: "blur(5px)" }}
        transition={{ duration: 0.3 }}
        className="font-mono tracking-widest"
      >
        {prefix}••••••
      </motion.span>
    )}
  </AnimatePresence>
);

/**
 * AdminStatCard — Premium stat card for dashboard overview.
 * Uses admin design tokens for consistent light/dark theming.
 *
 * Props:
 * - label: string — stat label
 * - value: number | string — stat value
 * - icon: LucideIcon — icon component
 * - variant: 'default' | 'accent' | 'amber' | 'clickable'
 * - masked: boolean — whether to show masked toggle
 * - showMask: boolean — current mask state
 * - onToggleMask: function — mask toggle handler
 * - prefix: string — currency prefix (default "Rp ")
 * - onClick: function — click handler (for clickable cards)
 * - className: string — additional classes
 */
const AdminStatCard = ({
  label,
  value,
  icon: Icon,
  variant = 'default',
  masked = false,
  showMask = false,
  onToggleMask,
  prefix = "Rp ",
  onClick,
  className = '',
}) => {
  const supportedVariants = new Set(['students', 'income', 'expense', 'kiosk']);
  const variantClass = supportedVariants.has(variant) ? `admin-stat-card--${variant}` : '';

  const clickableClass = onClick ? 'admin-stat-card--clickable' : '';

  const Component = onClick ? 'button' : 'div';
  const extraProps = onClick ? { onClick, type: 'button' } : {};

  return (
    <Component
      className={`admin-stat-card ${variantClass} ${clickableClass} ${className}`}
      {...extraProps}
    >
      <div className="admin-stat-card-content text-left">
        <div className="flex items-center gap-2 mb-2">
          <p className="admin-stat-card-label">{label}</p>
          {masked && onToggleMask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMask();
              }}
              className="transition-colors hover:opacity-80"
              style={{ color: 'hsl(var(--admin-text-muted))' }}
              aria-label={showMask ? 'Sembunyikan nilai' : 'Tampilkan nilai'}
            >
              {showMask ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        <p className="admin-stat-card-value">
          {masked ? (
            <MaskedValue value={value} show={showMask} prefix={prefix} />
          ) : typeof value === 'number' ? (
            value.toLocaleString('id-ID')
          ) : (
            value
          )}
        </p>
      </div>
      {Icon && (
        <Icon className="admin-stat-card-icon" aria-hidden="true" />
      )}
    </Component>
  );
};

export default AdminStatCard;
