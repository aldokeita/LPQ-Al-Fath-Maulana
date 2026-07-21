import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { CheckCircle, XCircle, User, MapPin, Smartphone, Clock, Trash2, LogIn, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';

const LoginLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', description: '', onConfirm: () => {} });
    const ITEMS_PER_PAGE = 15;

    const fetchLogs = useCallback(async (reset = false, overridePage) => {
        setLoading(true);
        const targetPage = reset ? 0 : (overridePage ?? page);

        try {
            let query = supabase
                .from('login_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .range(targetPage * ITEMS_PER_PAGE, (targetPage + 1) * ITEMS_PER_PAGE - 1);

            if (searchTerm) {
                query = query.or(`username_attempt.ilike.%${searchTerm}%,ip_address.ilike.%${searchTerm}%`);
            }

            const { data, error } = await query;

            if (error) throw error;

            setLogs(prev => {
                if (reset) return data || [];
                const newItems = (data || []).filter(d => !prev.some(p => p.id === d.id));
                return [...prev, ...newItems];
            });

            if (!data || data.length < ITEMS_PER_PAGE) {
                setHasMore(false);
            } else {
                setHasMore(true);
                if (!reset) setPage(targetPage + 1);
            }
        } catch (err) {
            toast({ title: 'Gagal memuat log', description: err.message, variant: 'destructive' });
        }
        setLoading(false);
    }, [page, searchTerm]);

    useEffect(() => {
        setPage(0);
        fetchLogs(true, 0);
    }, [searchTerm]);


    const handleSearch = (e) => {
        e.preventDefault();
        setPage(0);
        setLogs([]);
        fetchLogs(true, 0);
    };

    const handleDeleteLog = (logId) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Hapus Log Login',
            description: 'Apakah Anda yakin ingin menghapus catatan log ini? Tindakan ini tidak dapat dibatalkan.',
            onConfirm: async () => {
                const { error } = await supabase.from('login_logs').delete().eq('id', logId);
                if (error) {
                    toast({ title: 'Gagal Hapus Log', description: error.message, variant: 'destructive'});
                } else {
                    toast({ title: 'Berhasil', description: 'Log berhasil dihapus.'});
                    setLogs(prev => prev.filter(log => log.id !== logId));
                }
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="admin-panel-header">
                <div className="flex items-center gap-3">
                    <div className="admin-panel-header-icon">
                        <LogIn />
                    </div>
                    <div className="admin-panel-header-text">
                        <h2>Log Aktivitas Login</h2>
                        <p>Pantau aktivitas autentikasi pengguna.</p>
                    </div>
                </div>
            </div>

            <div className="admin-filter-bar">
                <div className="admin-search-input flex-1">
                    <Search />
                    <Input
                        placeholder="Cari username, IP, atau peran..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                {logs.map(log => (
                    <div key={log.id} className="admin-card p-4 group">
                        <div className="flex flex-wrap justify-between items-start gap-2">
                            <div className="flex items-center gap-3">
                                {log.status === 'success' ? (
                                    <span className="admin-status-badge admin-status-badge--success"><CheckCircle className="w-3 h-3" /> Berhasil</span>
                                ) : (
                                    <span className="admin-status-badge admin-status-badge--danger"><XCircle className="w-3 h-3" /> Gagal</span>
                                )}
                                <div className="font-bold text-base" style={{ color: 'hsl(var(--admin-text-primary))' }}>{log.username_attempt}</div>
                            </div>
                            <div className="flex items-center gap-2 text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(log.created_at).toLocaleString('id-ID')}
                                <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteLog(log.id)}>
                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                            </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1 text-sm" style={{ color: 'hsl(var(--admin-text-secondary))' }}>
                            <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" style={{ color: 'hsl(var(--admin-accent))' }}/> Peran: <span className="font-medium" style={{ color: 'hsl(var(--admin-text-primary))' }}>{log.role || 'N/A'}</span></div>
                            <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" style={{ color: 'hsl(var(--admin-accent))' }}/> Perkiraan lokasi: <span className="font-medium" style={{ color: 'hsl(var(--admin-text-primary))' }}>{[log.city, log.country].filter(Boolean).join(', ') || 'Tidak tersedia'}</span></div>
                            <div className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" style={{ color: 'hsl(var(--admin-accent))' }}/> Perangkat: <span className="font-medium" style={{ color: 'hsl(var(--admin-text-primary))' }}>{log.device || 'N/A'}</span></div>
                            <div className="col-span-1 md:col-span-3 flex items-center gap-1.5 truncate">
                                IP: <span className="font-medium" style={{ color: 'hsl(var(--admin-text-primary))' }}>{log.ip_address || 'Tidak tersedia'}</span>
                            </div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="admin-table-loading-spinner" />
                        <p className="text-sm ml-3" style={{ color: 'hsl(var(--admin-text-secondary))' }}>Memuat...</p>
                    </div>
                )}
                {!loading && logs.length === 0 && (
                    <div className="admin-table-empty">
                        <LogIn />
                        <p>Tidak ada log yang ditemukan.</p>
                    </div>
                )}
            </div>
            {hasMore && !loading && (
                <div className="text-center mt-6">
                    <Button onClick={() => fetchLogs()} variant="outline">Muat Lebih Banyak</Button>
                </div>
            )}
            <ConfirmationDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                description={confirmDialog.description}
            />
        </div>
    );
};

export default LoginLogs;
