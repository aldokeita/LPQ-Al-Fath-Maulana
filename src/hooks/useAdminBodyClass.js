import { useEffect } from 'react';

/**
 * Adds/removes `lpq-admin-context` class on <body> while the component is mounted.
 * Used to scope portal-rendered dropdowns (Radix Select, Popover, DropdownMenu)
 * to admin styling without affecting public pages.
 */
export default function useAdminBodyClass(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    document.body.classList.add('lpq-admin-context');
    return () => {
      document.body.classList.remove('lpq-admin-context');
    };
  }, [enabled]);
}