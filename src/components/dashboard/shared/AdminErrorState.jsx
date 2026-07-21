import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * AdminErrorState — Error display with icon, message, and optional retry action.
 * Uses admin design tokens for consistent theming.
 */
const AdminErrorState = ({
  icon: Icon = AlertTriangle,
  message = 'Terjadi kesalahan saat memuat data.',
  onRetry,
  className = '',
}) => {
  return (
    <div className={`admin-error-state ${className}`} role="alert">
      <Icon className="admin-error-state-icon" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{message}</p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="flex-shrink-0 ml-2"
          style={{
            borderColor: 'hsl(0 84% 60% / 0.3)',
            color: 'hsl(0 84% 45%)',
          }}
        >
          Coba Lagi
        </Button>
      )}
    </div>
  );
};

export default AdminErrorState;