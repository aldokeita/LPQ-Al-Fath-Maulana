export const DEFAULT_ENROLLMENT_DATA = {
  categories: [
    {
      id: 'tpq',
      name: 'Santri TPQ (Anak)',
      description: 'Program pembelajaran Al-Qur\'an untuk mulai dari usia 3 - 16 tahun dengan kurikulum terstruktur dan lingkungan belajar yang menyenangkan.',
      icon: '👦',
      fees: [
        { id: 'f1', name: 'Komponen biaya belum diisi', amount: 'Belum ditetapkan', order: 1 },
      ],
      totalFee: 'Belum ditetapkan',
      notes: [
        { id: 'n1', icon: '📌', text: 'Catatan pendaftaran resmi belum diisi.' },
      ],
      requirements: [
        { id: 'r1', text: 'Persyaratan resmi belum diisi.' },
      ],
      order: 1,
    },
    {
      id: 'dewasa',
      name: 'Santri Dewasa',
      description: 'Program pembelajaran Al-Qur\'an untuk usia dewasa di atas 17 tahun dengan jadwal fleksibel dan pendekatan personal.',
      icon: '🎓',
      fees: [
        { id: 'f7', name: 'Komponen biaya belum diisi', amount: 'Belum ditetapkan', order: 1 },
      ],
      totalFee: 'Belum ditetapkan',
      notes: [
        { id: 'n5', icon: '📌', text: 'Catatan pendaftaran resmi belum diisi.' },
      ],
      requirements: [
        { id: 'r7', text: 'Persyaratan resmi belum diisi.' },
      ],
      order: 2,
    },
  ],
};

export const createDefaultEnrollmentData = () => JSON.parse(JSON.stringify(DEFAULT_ENROLLMENT_DATA));

const cleanText = (value) => String(value ?? '').trim();

export const prepareEnrollmentDataForSave = (value) => {
  const categories = Array.isArray(value?.categories) ? value.categories : [];
  if (categories.length === 0) throw new Error('Minimal satu kategori pendaftaran harus tersedia.');

  return {
    ...value,
    categories: categories.map((category, categoryIndex) => {
      const name = cleanText(category.name);
      if (!name) throw new Error(`Nama kategori ke-${categoryIndex + 1} wajib diisi.`);

      const fees = (category.fees || []).map((fee, feeIndex) => {
        const feeName = cleanText(fee.name);
        const amount = cleanText(fee.amount);
        if (!feeName || !amount) throw new Error(`Biaya ke-${feeIndex + 1} pada ${name} belum lengkap.`);
        return { ...fee, name: feeName, amount, order: feeIndex + 1 };
      });

      const notes = (category.notes || []).map((note, noteIndex) => {
        const text = cleanText(note.text);
        if (!text) throw new Error(`Catatan ke-${noteIndex + 1} pada ${name} belum diisi.`);
        return { ...note, icon: cleanText(note.icon) || '📌', text };
      });

      const requirements = (category.requirements || []).map((requirement, requirementIndex) => {
        const text = cleanText(requirement.text);
        if (!text) throw new Error(`Syarat ke-${requirementIndex + 1} pada ${name} belum diisi.`);
        return { ...requirement, text };
      });

      return {
        ...category,
        name,
        description: cleanText(category.description),
        totalFee: cleanText(category.totalFee),
        fees,
        notes,
        requirements,
        order: categoryIndex + 1,
      };
    }),
  };
};
