import React from 'react';

/**
 * AdminToolbar — Search/filter/action bar for tables.
 * Provides consistent toolbar layout above data tables.
 * Does NOT replace existing search/filter logic — only provides layout container.
 */
const AdminToolbar = ({ children, className = '' }) => {
  return (
    <div className={`admin-toolbar ${className}`}>
      {children}
    </div>
  );
};

/** Toolbar group — clusters related controls together */
const AdminToolbarGroup = ({ children, className = '' }) => {
  return (
    <div className={`admin-toolbar-group ${className}`}>
      {children}
    </div>
  );
};

/** Spacer — pushes subsequent groups to the right */
const AdminToolbarSpacer = () => {
  return <div className="flex-1" />;
};

AdminToolbar.Group = AdminToolbarGroup;
AdminToolbar.Spacer = AdminToolbarSpacer;

export default AdminToolbar;