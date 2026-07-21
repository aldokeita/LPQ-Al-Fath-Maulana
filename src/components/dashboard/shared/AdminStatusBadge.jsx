import React from 'react';

/**
 * AdminStatusBadge — Semantic status badge with icon + text.
 * Never relies on color alone to convey meaning.
 * Uses admin design tokens for consistent theming.
 *
 * Props:
 * - status: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
 * - icon: LucideIcon (optional)
 * - children: badge text
 * - className: string
 */
const AdminStatusBadge = ({ status = 'neutral', icon: Icon, children, className = '' }) => {
  const statusClass = `admin-status-badge--${status}`;
  return (
    <span className={`admin-status-badge ${statusClass} ${className}`}>
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
};

export default AdminStatusBadge;