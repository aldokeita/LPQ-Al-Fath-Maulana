import React, { useEffect, useMemo, useState } from 'react';
import { Archive, GraduationCap, Loader2, RotateCcw, Search, UserCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { getArchivedSantri, setSantriArchived } from '@/lib/santriArchiveAdapters';
import { getSessionName } from '@/utils/sessionMapping';

const SantriArchiveDialog = ({ open, onOpenChange, categories, title = 'Arsip Santri', onRestored }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [search, setSearch] = useState('');
  const categoriesKey = categories.join('|');

  const loadArchive = async () => {
    setLoading(true);
    try {
      setRows(await getArchivedSantri(categories));
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

  const restore = async (item) => {
    setRestoringId(item.id);
    try {
      await setSantriArchived({ santriId: item.id, archived: false });
      setRows((current) => current.filter((row) => row.id !== item.id));
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[86vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                Data akademik, kelas, hafalan, karakter, absensi, dan transaksi tetap tersimpan.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama, nomor induk, atau kelas..."
            className="pl-9"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Memuat arsip santri...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center text-muted-foreground">
              <UserCheck className="h-8 w-8" />
              <div>
                <p className="font-medium text-foreground">Arsip masih kosong</p>
                <p className="text-sm">Santri yang dinonaktifkan atau dihapus akan muncul di sini.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRows.map((item) => (
                <article key={item.id} className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
                  <Avatar className="h-11 w-11 border">
                    <AvatarImage src={item.foto_url} alt={`Avatar ${item.nama_lengkap}`} />
                    <AvatarFallback>{item.nama_lengkap?.charAt(0) || 'S'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{item.nama_lengkap}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{item.class_name}</span>
                      <span>{item.jilid || 'Jilid belum diatur'}</span>
                      <span>{getSessionName(item.sesi_mengaji) || 'Sesi belum diatur'}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={restoringId === item.id}
                    onClick={() => restore(item)}
                    className="shrink-0"
                  >
                    {restoringId === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                    Pulihkan
                  </Button>
                </article>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SantriArchiveDialog;
