import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt } from 'lucide-react';
import { PAYMENT_HISTORY_SELECT, monthNumberToName } from '@/lib/paymentAdapters';

const SantriPaymentHistory = () => {
    const { user } = useAuth();
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPayments = async () => {
            if (!user?.id) return;
            setIsLoading(true);
            try {
                const { data, error: fetchError } = await supabase
                    .from('payments')
                    .select(PAYMENT_HISTORY_SELECT)
                    .eq('santri_id', user.id)
                    .order('tanggal_pembayaran', { ascending: false });

                if (fetchError) throw fetchError;
                setPayments(data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPayments();
    }, [user?.id]);

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Memuat riwayat pembayaran...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

    return (
        <Card className="bg-white dark:bg-[#112D4E] shadow-xl border-none">
            <CardHeader className="border-b dark:border-slate-800 pb-4">
                <CardTitle className="text-xl md:text-2xl text-[#3F72AF] dark:text-blue-400 flex items-center gap-2">
                    <Receipt className="w-6 h-6" />
                    Riwayat Pembayaran
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto max-h-96 custom-scrollbar p-4">
                    {payments.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b dark:border-gray-700 border-gray-200">
                                    <th className="text-left py-3 px-4 text-muted-foreground font-semibold">Tanggal</th>
                                    <th className="text-left py-3 px-4 text-muted-foreground font-semibold">Keterangan</th>
                                    <th className="text-right py-3 px-4 text-muted-foreground font-semibold">Jumlah</th>
                                    <th className="text-center py-3 px-4 text-muted-foreground font-semibold">Metode</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((p) => (
                                    <tr key={p.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                        <td className="py-4 px-4 whitespace-nowrap">
                                            {p.tanggal_pembayaran ? new Date(p.tanggal_pembayaran).toLocaleDateString('id-ID', {
                                                day: '2-digit', month: 'long', year: 'numeric'
                                            }) : '-'}
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="font-medium text-slate-800 dark:text-slate-200">
                                                {p.bulan ? `SPP ${monthNumberToName(p.bulan)} ${p.tahun}` : p.catatan || 'Pembayaran'}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-right font-bold text-slate-700 dark:text-slate-300">
                                            Rp {(p.jumlah || 0).toLocaleString('id-ID')}
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                                {p.metode_pembayaran || 'Tunai'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-16 text-muted-foreground flex flex-col items-center justify-center">
                            <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-4" />
                            <p className="text-lg font-medium text-slate-600 dark:text-slate-400">Belum ada riwayat pembayaran</p>
                            <p className="text-sm mt-1">Pembayaran yang Anda lakukan akan muncul di sini.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default SantriPaymentHistory;
