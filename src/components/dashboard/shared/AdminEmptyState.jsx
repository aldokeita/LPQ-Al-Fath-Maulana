import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * AdminEmptyState — Empty state display with icon, title, description, and optional action.
 * Uses admin design tokens for consistent theming.
 */
const AdminEmptyState = ({
  icon: Icon = Inbox,
  title = 'Belum ada data',
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`admin-empty-state ${className}`}>
      <Icon className="admin-empty-state-icon" aria-hidden="true" />
      <h3 className="admin-empty-state-title">{title}</h3>
      {description && (
        <p className="admin-empty-state-description">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default AdminEmptyState;