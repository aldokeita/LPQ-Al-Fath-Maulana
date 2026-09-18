const ACTIVE_SANTRI_STATUSES = new Set(['aktif', 'active']);

/**
 * Returns whether a santri record is eligible for active class views.
 * A missing status is treated as active for legacy rows, matching existing
 * dashboard queries while still excluding archived records.
 */
export const isActiveSantriRecord = (santri) => {
    if (!santri?.id || santri.deleted_at) return false;

    const normalizedStatus = santri.status == null
        ? 'aktif'
        : String(santri.status).trim().toLowerCase();

    return ACTIVE_SANTRI_STATUSES.has(normalizedStatus);
};
