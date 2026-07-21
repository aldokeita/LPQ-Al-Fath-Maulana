export const enableEdgeFunctions = import.meta.env.VITE_ENABLE_EDGE_FUNCTIONS === 'true';
export const enableDeferredFeatures = import.meta.env.VITE_ENABLE_DEFERRED_FEATURES === 'true';

// Backup & Restore is available by default for admins and has its own emergency kill switch.
export const enableBackupRestore = import.meta.env.VITE_ENABLE_BACKUP_RESTORE !== 'false';

// Game modules are production-ready and enabled by default.
// Set VITE_ENABLE_GAME_FEATURES=false as an emergency kill switch.
export const enableGameFeatures = import.meta.env.VITE_ENABLE_GAME_FEATURES !== 'false';

export const edgeFunctionDisabledMessage =
  'Fitur ini akan diaktifkan setelah Supabase baru dan Edge Function tersedia.';
