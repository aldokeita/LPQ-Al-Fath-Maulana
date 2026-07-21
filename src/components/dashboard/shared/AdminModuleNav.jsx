import React from 'react';
import { LayoutGroup, motion } from 'framer-motion';

/**
 * AdminModuleNav — Premium horizontal pill-based module navigation.
 * Groups admin tabs into logical categories with subtle visual separators.
 * Supports scroll fade indicators for mobile/tablet overflow.
 *
 * Props:
 * - tabs: Array<{ value, label, icon, group }> — tab definitions with group key
 * - activeTab: string — current active tab value
 * - onTabChange: (tabValue: string) => void — tab change handler
 *
 * Groups: 'data', 'akademik', 'keuangan', 'konten', 'sistem'
 */

const GROUP_ORDER = ['data', 'akademik', 'keuangan', 'konten', 'sistem'];
const GROUP_LABELS = {
  data: 'Data',
  akademik: 'Akademik',
  keuangan: 'Keuangan',
  konten: 'Konten',
  sistem: 'Sistem',
};

const AdminModuleNav = ({ tabs, activeTab, onTabChange }) => {
  // Group tabs
  const groupedTabs = React.useMemo(() => {
    const groups = {};
    tabs.forEach((tab) => {
      const group = tab.group || 'sistem';
      if (!groups[group]) groups[group] = [];
      groups[group].push(tab);
    });
    return GROUP_ORDER
      .filter((g) => groups[g]?.length > 0)
      .map((g) => ({ key: g, label: GROUP_LABELS[g], items: groups[g] }));
  }, [tabs]);

  const handleKeyDown = (e, idx) => {
    const flatTabs = tabs;
    let nextIdx = idx;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIdx = (idx + 1) % flatTabs.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIdx = (idx - 1 + flatTabs.length) % flatTabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIdx = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIdx = flatTabs.length - 1;
    } else {
      return;
    }
    onTabChange(flatTabs[nextIdx].value);
  };

  // Build flat index for keyboard navigation
  let flatIdx = 0;

  return (
    <div className="admin-module-nav" role="tablist" aria-label="Navigasi modul admin">
      <LayoutGroup id="admin-module-navigation">
      <div className="flex flex-wrap items-center gap-2 px-2 md:px-0 py-1">
        {groupedTabs.map((group, groupIdx) => (
          <React.Fragment key={group.key}>
            {groupIdx > 0 && (
              <div className="admin-nav-group-separator" aria-hidden="true" />
            )}
            <span className="admin-nav-group-label hidden md:inline" aria-hidden="true">
              {group.label}
            </span>
            {group.items.map((tab) => {
              const currentFlatIdx = flatIdx++;
              const isActive = activeTab === tab.value;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.value}
                  data-tab-value={tab.value}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  className={`admin-nav-pill lpq-shiny-button ${isActive ? 'active' : ''}`}
                  onClick={() => onTabChange(tab.value)}
                  onKeyDown={(e) => handleKeyDown(e, currentFlatIdx)}
                >
                  {isActive && (
                    <motion.span
                      layoutId="admin-module-active-pill"
                      className="admin-nav-pill-indicator"
                      transition={{ type: 'spring', stiffness: 430, damping: 34, mass: 0.72 }}
                    />
                  )}
                  {Icon && (
                    <Icon className="admin-nav-pill-icon relative z-10" aria-hidden="true" />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      </LayoutGroup>
    </div>
  );
};

export default AdminModuleNav;
