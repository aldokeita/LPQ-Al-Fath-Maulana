import React from 'react';

/**
 * AdminSection — Section wrapper with title, optional description, and content.
 * Provides consistent spacing and hierarchy within admin tabs.
 */
const AdminSection = ({ title, description, actions, children, className = '' }) => {
  return (
    <section className={`admin-section ${className}`}>
      {(title || description || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            {title && (
              <h2
                className="text-lg font-semibold"
                style={{ color: 'hsl(var(--admin-text-primary))' }}
              >
                {title}
              </h2>
            )}
            {description && (
              <p
                className="text-sm mt-0.5"
                style={{ color: 'hsl(var(--admin-text-secondary))' }}
              >
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
};

export default AdminSection;