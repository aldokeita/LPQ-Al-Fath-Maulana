import React from 'react';

/**
 * AdminFormSection — Form section grouping with title, description, and content.
 * Provides consistent visual grouping for forms within admin dashboard.
 */
const AdminFormSection = ({ title, description, children, className = '' }) => {
  return (
    <div className={`admin-form-section ${className}`}>
      {title && (
        <h3 className="admin-form-section-title">{title}</h3>
      )}
      {description && (
        <p
          className="text-sm mb-4"
          style={{ color: 'hsl(var(--admin-text-secondary))' }}
        >
          {description}
        </p>
      )}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

/**
 * AdminFormField — Individual form field wrapper with label, helper, required indicator.
 */
const AdminFormField = ({ label, required, helper, error, children, className = '' }) => {
  return (
    <div className={className}>
      {label && (
        <label className="admin-form-label">
          {label}
          {required && <span className="admin-form-required" aria-label="wajib diisi">*</span>}
        </label>
      )}
      {children}
      {helper && !error && (
        <p className="admin-form-helper">{helper}</p>
      )}
      {error && (
        <p className="text-xs mt-1" style={{ color: 'hsl(0 84% 55%)' }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

AdminFormSection.Field = AdminFormField;

export default AdminFormSection;