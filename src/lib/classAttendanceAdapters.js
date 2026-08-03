import { supabase } from '@/lib/customSupabaseClient';

const isActiveSantriStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  return !normalized || normalized === 'aktif' || normalized === 'active';
};

const sortRoster = (left, right) => {
  const leftOrder = Number.isFinite(left.order_in_class) ? left.order_in_class : Number.MAX_SAFE_INTEGER;
  const rightOrder = Number.isFinite(right.order_in_class) ? right.order_in_class : Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) return leftOrder - rightOrder;

  const byName = String(left.nama_lengkap || '').localeCompare(String(right.nama_lengkap || ''), 'id');
  if (byName !== 0) return byName;
  return String(left.id).localeCompare(String(right.id));
};

export const fetchClassAttendanceSource = async ({ year }) => {
  const calendarStart = `${year}-01-01`;
  const calendarEnd = `${year}-12-31`;

  const [classResult, santriResult, membershipResult, calendarResult] = await Promise.all([
    supabase
      .from('classes')
      .select('id, nama_kelas, id_guru, sesi, kategori, sort_order, is_active, guru:id_guru(id, nama)')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true, nullsFirst: false }),
    supabase
      .from('santri')
      .select('id, nama_lengkap, no_hp_ortu, jilid, current_class_id, order_in_class, status, deleted_at')
      .is('deleted_at', null)
      .order('order_in_class', { ascending: true, nullsFirst: false }),
    supabase
      .from('class_memberships')
      .select('santri_id, class_id, order_in_class')
      .eq('status', 'active'),
    supabase
      .from('academic_calendar')
      .select('date, is_holiday')
      .gte('date', calendarStart)
      .lte('date', calendarEnd)
      .eq('is_holiday', true),
  ]);

  const firstError = [
    classResult.error,
    santriResult.error,
    membershipResult.error,
    calendarResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new Error(firstError.message || 'Gagal memuat sumber data absensi kelas.');
  }

  const membershipsBySantri = new Map(
    (membershipResult.data || []).map((membership) => [membership.santri_id, membership]),
  );
  const classMap = new Map((classResult.data || []).map((classItem) => [classItem.id, {
    ...classItem,
    roster: [],
    warnings: [],
  }]));

  (santriResult.data || [])
    .filter((santri) => isActiveSantriStatus(santri.status))
    .forEach((santri) => {
      const membership = membershipsBySantri.get(santri.id);
      const resolvedClassId = santri.current_class_id || membership?.class_id || null;
      const targetClass = classMap.get(resolvedClassId);

      if (!targetClass) return;

      const hasMembershipMismatch = Boolean(
        santri.current_class_id
        && membership?.class_id
        && santri.current_class_id !== membership.class_id,
      );

      targetClass.roster.push({
        ...santri,
        order_in_class: santri.order_in_class ?? membership?.order_in_class ?? null,
        hasMembershipMismatch,
      });
    });

  const classes = Array.from(classMap.values()).map((classItem) => {
    const roster = [...classItem.roster].sort(sortRoster);
    const missingFieldCount = roster.filter((santri) => !santri.jilid || !santri.no_hp_ortu).length;
    const mismatchCount = roster.filter((santri) => santri.hasMembershipMismatch).length;
    const warnings = [];

    if (!classItem.guru?.nama) warnings.push('Guru belum ditentukan');
    if (missingFieldCount > 0) warnings.push(`${missingFieldCount} data santri belum lengkap`);
    if (mismatchCount > 0) warnings.push(`${mismatchCount} membership perlu diperiksa`);

    return { ...classItem, roster, warnings, missingFieldCount, mismatchCount };
  });

  return {
    classes,
    holidays: new Set((calendarResult.data || []).map((entry) => entry.date)),
    fetchedAt: new Date(),
  };
};
