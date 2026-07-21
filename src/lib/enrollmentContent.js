export const DEFAULT_ENROLLMENT_DATA = {
  categories: [
    {
      id: 'tpq',
      name: 'Santri TPQ (Anak)',
      description: 'Program pembelajaran Al-Qur\'an untuk mulai dari usia 3 - 16 tahun dengan kurikulum terstruktur dan lingkungan belajar yang menyenangkan.',
      icon: '👦',
      fees: [
        { id: 'f1', name: 'Sarpras', amount: 'Rp 115.000', order: 1 },
        { id: 'f2', name: 'Seragam', amount: 'Rp 175.000', order: 2 },
        { id: 'f3', name: 'Buku Prestasi', amount: 'Rp 10.000', order: 3 },
        { id: 'f4', name: 'ID Card', amount: 'Rp 25.000', order: 4 },
        { id: 'f5', name: 'Buku Jilid', amount: 'Rp 25.000', order: 5 },
        { id: 'f6', name: 'SPP Awal', amount: 'Rp 100.000', order: 6 },
      ],
      totalFee: 'Rp 450.000',
      notes: [
        { id: 'n1', icon: '💰', text: 'Biaya pendaftaran dapat dicicil selama satu bulan.' },
        { id: 'n2', icon: '👨‍👩‍👧‍👦', text: 'Tersedia paket khusus untuk keluarga dengan lebih dari satu santri.' },
        { id: 'n3', icon: '📚', text: 'Pembelajaran dimulai setelah seluruh syarat administrasi terpenuhi.' },
        { id: 'n4', icon: '🤝', text: 'Kedua orang tua/wali mendampingi calon santri saat pendaftaran.' },
      ],
      requirements: [
        { id: 'r1', text: 'Kedua wali dan calon santri hadir saat mengisi formulir pendaftaran.' },
        { id: 'r2', text: 'Mengisi formulir pendaftaran dengan lengkap dan benar.' },
        { id: 'r3', text: 'Fotokopi Akta Kelahiran satu lembar.' },
        { id: 'r4', text: 'Fotokopi Kartu Keluarga satu lembar.' },
        { id: 'r5', text: 'Pasfoto ukuran 3×4 sebanyak dua lembar.' },
        { id: 'r6', text: 'Materai Rp 10.000.' },
      ],
      order: 1,
    },
    {
      id: 'dewasa',
      name: 'Santri Dewasa',
      description: 'Program pembelajaran Al-Qur\'an untuk usia dewasa di atas 17 tahun dengan jadwal fleksibel dan pendekatan personal.',
      icon: '🎓',
      fees: [
        { id: 'f7', name: 'Sarpras', amount: 'Rp 115.000', order: 1 },
        { id: 'f8', name: 'Buku Prestasi', amount: 'Rp 10.000', order: 2 },
        { id: 'f9', name: 'Buku Jilid', amount: 'Rp 25.000', order: 3 },
        { id: 'f10', name: 'SPP Awal', amount: 'Rp 100.000', order: 4 },
      ],
      totalFee: 'Rp 250.000',
      notes: [
        { id: 'n5', icon: '🎓', text: 'Usia minimal 17 tahun.' },
        { id: 'n6', icon: '🤝', text: 'Berkomitmen mengikuti pembelajaran secara rutin.' },
        { id: 'n7', icon: '📅', text: 'Jadwal pagi, siang, atau malam ditentukan sesuai kesepakatan.' },
        { id: 'n8', icon: '💰', text: 'Biaya pendaftaran dibayarkan pada awal masuk.' },
      ],
      requirements: [
        { id: 'r7', text: 'Mengisi formulir pendaftaran.' },
        { id: 'r8', text: 'Menyerahkan satu lembar fotokopi KTP.' },
        { id: 'r9', text: 'Membayar biaya administrasi pendaftaran.' },
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
