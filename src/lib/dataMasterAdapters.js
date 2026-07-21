export const activeStatusValues = new Set(['aktif', 'active']);

export const mapSantriForLegacyUi = (santri) => ({
  ...santri,
  id_kelas: santri.current_class_id ?? santri.id_kelas ?? null,
  class: santri.class ?? santri.current_class ?? null,
  tanggal_pendaftaran: santri.tanggal_pendaftaran ?? santri.created_at ?? null,
});

export const mapClassForLegacyUi = (classItem) => ({
  ...classItem,
  order: classItem.sort_order ?? classItem.order ?? 0,
});

export const normalizeNomorIndukQiroati = (value) => String(value ?? '').trim();

export const normalizeDefaultSppAmount = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

export const pickSantriProfileFields = (input) => {
  const nomorInduk = normalizeNomorIndukQiroati(input.nomor_induk_qiroati);

  return {
    nomor_induk_qiroati: nomorInduk,
    nama_lengkap: input.nama_lengkap?.trim(),
    nama_panggilan: input.nama_panggilan?.trim() || null,
    kategori: input.kategori || 'Anak',
    jenis_kelamin: input.jenis_kelamin || null,
    tanggal_lahir: input.tanggal_lahir || null,
    tempat_lahir: input.tempat_lahir || null,
    alamat: input.alamat || null,
    no_hp_ortu: input.no_hp_ortu || null,
    foto_url: input.foto_url || null,
    avatar_path: input.avatar_path || null,
    rfid_tag: input.rfid_tag || null,
    current_class_id: input.current_class_id ?? input.id_kelas ?? null,
    sesi_mengaji: input.sesi_mengaji || null,
    jilid: input.jilid || null,
    tanggal_pendaftaran: input.tanggal_pendaftaran || null,
    nama_ayah: input.nama_ayah || null,
    nama_ibu: input.nama_ibu || null,
    no_kk: input.no_kk || null,
    no_nik: input.no_nik || null,
    berkas_foto: Boolean(input.berkas_foto),
    berkas_akta: Boolean(input.berkas_akta),
    berkas_kk: Boolean(input.berkas_kk),
    berkas_form: Boolean(input.berkas_form),
    link_qiroati: input.link_qiroati || null,
    default_spp_amount: normalizeDefaultSppAmount(input.default_spp_amount),
    status: input.status || 'Aktif',
    points: Number(input.points) || 0,
    order_in_class: input.order_in_class ?? null,
  };
};

const normalizeComparableValue = (value) => {
  if (value === undefined || value === '') return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isNaN(value)) return null;
  return value;
};

export const pickChangedSantriProfileFields = (input, original = {}) => {
  const next = pickSantriProfileFields(input);
  const previous = pickSantriProfileFields({
    ...original,
    current_class_id: original.current_class_id ?? original.id_kelas ?? null,
    id_kelas: original.current_class_id ?? original.id_kelas ?? null,
  });

  return Object.entries(next).reduce((payload, [key, value]) => {
    if (normalizeComparableValue(value) !== normalizeComparableValue(previous[key])) {
      payload[key] = value;
    }
    return payload;
  }, {});
};

export const pickGuruProfileFields = (input, role = 'guru') => ({
  nama: input.nama?.trim(),
  email: input.email?.trim() || null,
  no_hp: input.no_hp || null,
  alamat: input.alamat || null,
  foto_url: input.avatar_path ? null : (input.foto_url || null),
  avatar_path: input.avatar_path || null,
  rfid_tag: input.rfid_tag || null,
  jabatan: input.jabatan || null,
  roles: role === 'pentashih'
    ? Array.from(new Set([...(input.roles || []), 'Pentashih']))
    : (input.roles || []).filter((item) => item !== 'Pentashih'),
  is_notulen: Boolean(input.is_notulen),
  jenis_kelamin: input.jenis_kelamin || null,
  tanggal_lahir: input.tanggal_lahir || null,
  status_guru: input.status_guru || null,
  status: input.status || 'active',
});

export const getOperationalRoleFromGuruForm = (input) =>
  (input.roles || []).includes('Pentashih') ? 'pentashih' : 'guru';
