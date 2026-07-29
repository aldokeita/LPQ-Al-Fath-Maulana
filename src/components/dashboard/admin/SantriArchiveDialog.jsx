import React, { useEffect, useMemo, useState } from 'react';
import { Archive, AlertTriangle, GraduationCap, Loader2, RotateCcw, Search, Trash2, UserCheck, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { getArchivedSantri, setSantriArchived, permanentlyDeleteSantri } from '@/lib/santriArchiveAdapters';
import { getSessionName } from '@/utils/sessionMapping';

const SantriArchiveDialog = ({ open, onOpenChange, categories, title = 'Arsip Santri', onRestored }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Modal confirmation state
  const [confirmModal, setConfirmModal] = useState({ open: false, targetItems: [] });
  const [isDeletingProcess, setIsDeletingProcess] = useState(false);
  
  // Failure report modal
  const [deleteReport, setDeleteReport] = useState({ open: false, successCount: 0, failures: [] });

  const categoriesKey = categories.join('|');

  const loadArchive = async () => {
    setLoading(true);
    try {
      setRows(await getArchivedSantri(categories));
      setSelectedIds(new Set());
    } catch (error) {
      toast({ title: 'Gagal memuat arsip', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadArchive();
  }, [open, categoriesKey]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((item) => [
      item.nama_lengkap,
      item.nama_panggilan,
      item.nomor_induk_qiroati,
      item.class_name,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [rows, search]);

  const isAllSelected = useMemo(() => {
    if (filteredRows.length === 0) return false;
    return filteredRows.every((item) => selectedIds.has(item.id));
  }, [filteredRows, selectedIds]);

  const handleSelectAll = (checked) => {
    if (checked) {
      const next = new Set(selectedIds);
      filteredRows.forEach((item) => next.add(item.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filteredRows.forEach((item) => next.delete(item.id));
      setSelectedIds(next);
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const restore = async (item) => {
    setRestoringId(item.id);
    try {
      await setSantriArchived({ santriId: item.id, archived: false });
      setRows((current) => current.filter((row) => row.id !== item.id));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      await onRestored?.();
      window.dispatchEvent(new CustomEvent('lpq:santri-data-changed'));
      toast({
        title: 'Santri dipulihkan',
        description: `${item.nama_lengkap} kembali aktif beserta kelas dan seluruh riwayatnya.`,
      });
    } catch (error) {
      toast({ title: 'Gagal memulihkan santri', description: error.message, variant: 'destructive' });
    } finally {
      setRestoringId(null);
    }
  };

  const requestSingleDelete = (item) => {
    setConfirmModal({ open: true, targetItems: [item] });
  };

  const requestBatchDelete = () => {
    const targetItems = rows.filter((item) => selectedIds.has(item.id));
    if (targetItems.length === 0) return;
    setConfirmModal({ open: true, targetItems });
  };

  const executeDeletePermanent = async () => {
    const targets = confirmModal.targetItems;
    if (targets.length === 0) return;

    setIsDeletingProcess(true);
    let successCount = 0;
    const failures = [];

    for (const item of targets) {
      try {
        setDeletingId(item.id);
        await permanentlyDeleteSantri({ santriId: item.id });
        successCount++;
        setRows((current) => current.filter((row) => row.id !== item.id));
        setSelectedIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
      } catch (err) {
        failures.push({
          name: item.nama_lengkap || 'Santri tanpa nama',
          reason: err.message || 'Gagal menghapus data dari database.',
        });
      }
    }

    setIsDeletingProcess(false);
    setDeletingId(null);
    setConfirmModal({ open: false, targetItems: [] });
    await onRestored?.();
    window.dispatchEvent(new CustomEvent('lpq:santri-data-changed'));

    if (failures.length === 0) {
      toast({
        title: 'Penghapusan permanen berhasil',
        description: `${successCount} santri berhasil dihapus secara permanen dari sistem.`,
      });
    } else {
      setDeleteReport({ open: true, successCount, failures });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-hidden flex flex-col p-0 gap-0">
          {/* Header */}
          <div className="p-6 pb-4 border-b">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md">
                  <Archive className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
                  <DialogDescription className="text-xs">
                    Kelola santri nonaktif. Gunakan ikon sampah atau centang beberapa santri untuk menghapus secara permanen.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Filter & Select All Bar */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari nama, nomor induk, atau kelas..."
                  className="pl-9 text-xs"
                />
              </div>

              {filteredRows.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 border text-xs font-semibold shrink-0 cursor-pointer select-none" onClick={() => handleSelectAll(!isAllSelected)}>
                  <Checkbox
                    id="select-all-archive"
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="select-all-archive" className="cursor-pointer text-slate-700 dark:text-slate-300">
                    Pilih Semua ({filteredRows.length})
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* List Content */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-2">
            {loading ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm">Memuat arsip santri...</p>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-center text-muted-foreground p-6">
                <UserCheck className="h-8 w-8 text-slate-400" />
                <div>
                  <p className="font-semibold text-foreground">Arsip masih kosong</p>
                  <p className="text-xs">Santri yang dinonaktifkan atau diarsip akan muncul di sini.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pb-12">
                {filteredRows.map((item) => {
                  const isChecked = selectedIds.has(item.id);
                  const isOperating = restoringId === item.id || deletingId === item.id;

                  return (
                    <article
                      key={item.id}
                      className={`flex flex-col gap-3 rounded-2xl border p-3.5 transition-all sm:flex-row sm:items-center ${
                        isChecked
                          ? 'border-rose-300 bg-rose-500/5 dark:border-rose-900/50 dark:bg-rose-950/20'
                          : 'bg-card hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                        <Avatar className="h-11 w-11 border shrink-0">
                          <AvatarImage src={item.foto_url} alt={`Avatar ${item.nama_lengkap}`} />
                          <AvatarFallback>{item.nama_lengkap?.charAt(0) || 'S'}</AvatarFallback>
                        </Avatar>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-bold text-slate-900 dark:text-slate-100 text-sm">{item.nama_lengkap}</p>
                          {item.nomor_induk_qiroati && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border">
                              NIQ: {item.nomor_induk_qiroati}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 font-medium">
                            <GraduationCap className="h-3.5 w-3.5" />{item.class_name}
                          </span>
                          <span>•</span>
                          <span>{item.jilid || 'Jilid belum diatur'}</span>
                          <span>•</span>
                          <span>{getSessionName(item.sesi_mengaji) || 'Sesi belum diatur'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isOperating}
                          onClick={() => restore(item)}
                          className="h-9 px-3 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                        >
                          {restoringId === item.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Pulihkan
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isOperating}
                          onClick={() => requestSingleDelete(item)}
                          title="Hapus Permanen Santri Ini"
                          className="h-9 px-3 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* Floating Action Bar at Bottom for Selected Items */}
          {selectedIds.size > 0 && (
            <div className="p-4 bg-slate-900/95 backdrop-blur-xl border-t text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white font-bold text-xs">
                  {selectedIds.size}
                </span>
                <span>santri dipilih untuk tindakan masal</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-slate-300 hover:text-white hover:bg-white/10 text-xs rounded-xl flex-1 sm:flex-initial"
                >
                  Batal Pilih
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={requestBatchDelete}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-lg flex-1 sm:flex-initial"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Hapus Permanen ({selectedIds.size} santri)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog before Permanent Deletion */}
      <Dialog open={confirmModal.open} onOpenChange={(val) => !isDeletingProcess && setConfirmModal({ ...confirmModal, open: val })}>
        <DialogContent className="max-w-md p-6 rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-3 text-rose-600 mb-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 dark:bg-rose-500/20">
                <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Konfirmasi Hapus Permanen
                </DialogTitle>
                <p className="text-xs text-rose-600 font-semibold">Tindakan ini tidak dapat dibatalkan!</p>
              </div>
            </div>
          </DialogHeader>

          <div className="py-3 text-xs text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed">
            <p>
              Anda akan menghapus secara permanen{' '}
              <strong className="text-slate-900 dark:text-white underline">
                {confirmModal.targetItems.length} santri
              </strong>{' '}
              berikut:
            </p>

            <ul className="max-h-36 overflow-y-auto rounded-xl bg-slate-100 dark:bg-slate-800/70 p-3 space-y-1.5 border font-mono text-[11px]">
              {confirmModal.targetItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between text-slate-800 dark:text-slate-200">
                  <span className="truncate max-w-[200px] font-sans font-bold">• {item.nama_lengkap}</span>
                  <span className="text-[10px] text-muted-foreground">{item.nomor_induk_qiroati || 'Tanpa NIQ'}</span>
                </li>
              ))}
            </ul>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-[11px] space-y-1">
              <p className="font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5"/> Perhatian Penting:</p>
              <p>Seluruh akun login, riwayat kelas, data absensi, hafalan, penilaian karakter, dan riwayat pembayaran akan dihapus sampai ke akar-akarnya dari sistem.</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isDeletingProcess}
              onClick={() => setConfirmModal({ open: false, targetItems: [] })}
              className="rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeletingProcess}
              onClick={executeDeletePermanent}
              className="bg-rose-600 hover:bg-rose-700 font-bold rounded-xl"
            >
              {isDeletingProcess ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus Permanen...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Ya, Hapus Permanen
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Failure/Partial Rejection Report Modal */}
      <Dialog open={deleteReport.open} onOpenChange={(val) => setDeleteReport({ ...deleteReport, open: val })}>
        <DialogContent className="max-w-md p-6 rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
              <DialogTitle className="text-base font-bold">Laporan Penghapusan Permanen</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              {deleteReport.successCount} santri berhasil dihapus. Terdapat {deleteReport.failures.length} santri yang ditolak/gagal dihapus oleh sistem.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Daftar Santri Gagal Dihapus:</p>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {deleteReport.failures.map((f, i) => (
                <div key={i} className="p-3 rounded-xl bg-amber-500/10 border border-amber-200 dark:border-amber-900/50 text-xs">
                  <p className="font-bold text-amber-900 dark:text-amber-200">{f.name}</p>
                  <p className="text-muted-foreground text-[11px] mt-0.5">Alasan Penolakan: {f.reason}</p>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" onClick={() => setDeleteReport({ open: false, successCount: 0, failures: [] })} className="w-full rounded-xl">
              Saya Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SantriArchiveDialog;
