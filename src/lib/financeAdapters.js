import { supabase } from '@/lib/customSupabaseClient';

export const expenseCategories = [
    'Operasional',
    'Konsumsi',
    'Acara',
    'Perawatan',
    'Transportasi',
    'Administrasi',
    'Promosi/Marketing',
    'Donasi/Sosial',
    'Inventaris',
    'Teknologi',
    'Lainnya'
];

export const monthNames = [
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
    'Desember'
];

const toDateString = (date) => date.toISOString().slice(0, 10);

export const getMonthOptions = () => monthNames.map((label, index) => ({
    label,
    value: index + 1
}));

export const getPeriodDateRange = ({ year, month = 'all' }) => {
    const selectedYear = Number(year);
    if (!Number.isInteger(selectedYear)) {
        throw new Error('Tahun tidak valid.');
    }

    if (month === 'all') {
        return {
            startDate: `${selectedYear}-01-01`,
            endDate: `${selectedYear}-12-31`
        };
    }

    const selectedMonth = Number(month);
    if (!Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) {
        throw new Error('Bulan tidak valid.');
    }

    const start = new Date(Date.UTC(selectedYear, selectedMonth - 1, 1));
    const end = new Date(Date.UTC(selectedYear, selectedMonth, 0));
    return {
        startDate: toDateString(start),
        endDate: toDateString(end)
    };
};

export const parseCurrencyAmount = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Nominal wajib lebih besar dari nol.');
    }
    return Math.round(amount * 100) / 100;
};

export const formatRupiah = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export const normalizeExpensePayload = (formData, userId) => {
    if (!formData?.tanggal_pengeluaran || Number.isNaN(Date.parse(formData.tanggal_pengeluaran))) {
        throw new Error('Tanggal pengeluaran wajib valid.');
    }

    const jumlah = parseCurrencyAmount(formData.jumlah);
    const kategori = String(formData.kategori || '').trim();
    const deskripsi = String(formData.deskripsi || '').trim();

    if (!kategori) {
        throw new Error('Kategori pengeluaran wajib diisi.');
    }

    if (!deskripsi) {
        throw new Error('Keterangan pengeluaran wajib diisi.');
    }

    return {
        tanggal_pengeluaran: formData.tanggal_pengeluaran,
        kategori,
        deskripsi,
        jumlah,
        updated_by: userId || null
    };
};

export const fetchExpensesByPeriod = async ({ year, month = 'all' }) => {
    const { startDate, endDate } = getPeriodDateRange({ year, month });
    const { data, error } = await supabase
        .from('expenses')
        .select('id,tanggal_pengeluaran,kategori,deskripsi,jumlah,created_at,updated_at,deleted_at')
        .is('deleted_at', null)
        .gte('tanggal_pengeluaran', startDate)
        .lte('tanggal_pengeluaran', endDate)
        .order('tanggal_pengeluaran', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const createExpense = async (formData, userId) => {
    const payload = {
        ...normalizeExpensePayload(formData, userId),
        created_by: userId || null
    };

    const { data, error } = await supabase
        .from('expenses')
        .insert(payload)
        .select('id,tanggal_pengeluaran,kategori,deskripsi,jumlah')
        .single();

    if (error) throw error;
    return data;
};

export const updateExpense = async (id, formData, userId) => {
    const payload = normalizeExpensePayload(formData, userId);
    const { data, error } = await supabase
        .from('expenses')
        .update(payload)
        .eq('id', id)
        .is('deleted_at', null)
        .select('id,tanggal_pengeluaran,kategori,deskripsi,jumlah')
        .single();

    if (error) throw error;
    return data;
};

export const softDeleteExpense = async (id, userId) => {
    const { error } = await supabase
        .from('expenses')
        .update({
            deleted_at: new Date().toISOString(),
            updated_by: userId || null
        })
        .eq('id', id)
        .is('deleted_at', null);

    if (error) throw error;
};

const sumAmounts = (rows) => rows.reduce((totalCents, row) => {
    const cents = Math.round(Number(row.jumlah || 0) * 100);
    return totalCents + cents;
}, 0) / 100;

export const fetchCashflowSummary = async ({ year, month = 'all' }) => {
    const selectedYear = Number(year);
    const selectedMonth = month === 'all' ? 'all' : Number(month);

    let paymentsQuery = supabase
        .from('payments')
        .select('jumlah,bulan,tahun,status,deleted_at')
        .eq('tahun', selectedYear)
        .eq('status', 'paid')
        .is('deleted_at', null);

    if (selectedMonth !== 'all') {
        paymentsQuery = paymentsQuery.eq('bulan', selectedMonth);
    }

    const [paymentsResult, expenses] = await Promise.all([
        paymentsQuery,
        fetchExpensesByPeriod({ year: selectedYear, month: selectedMonth })
    ]);

    if (paymentsResult.error) throw paymentsResult.error;

    const totalPemasukan = sumAmounts(paymentsResult.data || []);
    const totalPengeluaran = sumAmounts(expenses);

    return {
        totalPemasukan,
        totalPengeluaran,
        saldoBersih: Math.round((totalPemasukan - totalPengeluaran) * 100) / 100,
        paymentCount: (paymentsResult.data || []).length,
        expenseCount: expenses.length
    };
};

export const getFinanceErrorMessage = (error) => {
    const message = String(error?.message || error || '');
    if (message.includes('row-level security') || error?.code === '42501') {
        return 'Anda tidak memiliki akses untuk mengelola data keuangan ini.';
    }
    if (message.includes('jumlah') || message.includes('Nominal')) {
        return 'Nominal wajib lebih besar dari nol.';
    }
    return message || 'Operasi keuangan gagal.';
};
