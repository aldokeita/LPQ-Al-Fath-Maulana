export const MONTH_NAMES = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
];

export const PAYMENT_DETAIL_SELECT = `
    id,
    santri_id,
    bulan,
    tahun,
    jumlah,
    tanggal_pembayaran,
    metode_pembayaran,
    status,
    catatan,
    transaction_id,
    created_at,
    santri:santri_id(id, nama_lengkap, nomor_induk_qiroati, kategori, no_hp_ortu)
`;

export const PAYMENT_HISTORY_SELECT = `
    id,
    santri_id,
    bulan,
    tahun,
    jumlah,
    tanggal_pembayaran,
    metode_pembayaran,
    status,
    catatan,
    transaction_id,
    created_at
`;

export const monthNameToNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value >= 1 && value <= 12 ? value : null;
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric;
    const index = MONTH_NAMES.findIndex(month => month.toLowerCase() === String(value).toLowerCase());
    return index >= 0 ? index + 1 : null;
};

export const monthNumberToName = (value) => {
    const monthNumber = monthNameToNumber(value);
    return monthNumber ? MONTH_NAMES[monthNumber - 1] : '-';
};

export const selectedMonthToNumber = (value) => {
    if (value === 'all') return 'all';
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) return null;
    return numeric >= 0 && numeric <= 11 ? numeric + 1 : numeric;
};

export const formatPaymentPeriod = (bulan, tahun) => {
    if (!bulan && !tahun) return '-';
    return `${bulan ? monthNumberToName(bulan) : '-'} ${tahun || ''}`.trim();
};

export const formatSantriCategory = (value) => {
    const category = String(value || '').trim();
    if (!category) return 'TPQ';
    if (category.toUpperCase() === 'PTPT') return 'PTPT';
    if (category.toLowerCase() === 'dewasa') return 'Dewasa';
    if (category.toLowerCase() === 'anak' || category.toUpperCase() === 'TPQ') return 'TPQ';
    return category;
};

export const validatePaymentAmount = (amount) => Number.isFinite(Number(amount)) && Number(amount) >= 0;

export const getSharedDefaultSppAmount = (santriList = []) => {
    if (!Array.isArray(santriList) || santriList.length === 0) return null;
    const amounts = santriList.map((santri) => Number(santri?.default_spp_amount));
    if (amounts.some((amount) => !Number.isFinite(amount) || amount < 10000)) return null;
    return amounts.every((amount) => amount === amounts[0]) ? amounts[0] : null;
};

export const getPaymentErrorMessage = (error) => {
    const message = String(error?.message || '');
    if (message.includes('payments_active_santri_bulan_tahun_unique')) {
        return 'Pembayaran santri untuk bulan dan tahun tersebut sudah tercatat.';
    }
    if (error?.code === '23505' || message.includes('payments_transaction_id_unique')) {
        return 'Pembayaran duplikat terdeteksi. Silakan ulangi proses pembayaran.';
    }
    if (message.toLowerCase().includes('row-level security') || error?.code === '42501') {
        return 'Anda tidak memiliki akses untuk melakukan aksi pembayaran ini.';
    }
    if (message.includes('payments_status_check')) {
        return 'Status pembayaran tidak valid.';
    }
    if (message.includes('jumlah')) {
        return 'Nominal pembayaran tidak valid.';
    }
    return message || 'Operasi pembayaran gagal.';
};
