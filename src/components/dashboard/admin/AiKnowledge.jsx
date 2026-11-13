import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, Loader2, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { deleteAiKnowledge, fetchAiKnowledge, saveAiKnowledge } from '@/lib/assistantAlertAdapters';

const EMPTY = { judul: '', kategori: 'Umum', isi: '', aktif: true };
const ISI_MAX = 8000;

// Pustaka materi Qiroati untuk AI. Setiap permintaan hanya membawa materi yang paling relevan
// (dipilih dari kata kunci pertanyaan, jilid, dan jenis perkara), jadi pustaka boleh panjang.
const AiKnowledge = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await fetchAiKnowledge());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (item) => {
    setEditing(item?.id || 'baru');
    setForm(item ? { judul: item.judul, kategori: item.kategori, isi: item.isi, aktif: item.aktif } : EMPTY);
  };

  const valid = form.judul.trim().length >= 3 && form.isi.trim().length >= 10;

  const save = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setIsSaving(true);
    try {
      const original = items.find((i) => i.id === editing);
      const next = { judul: form.judul.trim(), kategori: form.kategori.trim() || 'Umum', isi: form.isi.trim(), aktif: form.aktif };
      const patch = original
        ? Object.fromEntries(Object.entries(next).filter(([k, v]) => original[k] !== v))
        : next;
      if (original && Object.keys(patch).length === 0) { setEditing(null); return; }
      await saveAiKnowledge({ id: original?.id, patch, userId: user?.id });
      toast({ title: 'Materi tersimpan', description: next.judul });
      setEditing(null);
      load();
    } catch (err) {
      toast({ title: 'Gagal menyimpan materi', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = async (item, aktif) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, aktif } : i)));
    try {
      await saveAiKnowledge({ id: item.id, patch: { aktif } });
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, aktif: item.aktif } : i)));
      toast({ title: 'Gagal mengubah status', description: err.message, variant: 'destructive' });
    }
  };

  const confirmDelete = async () => {
    const item = toDelete;
    setToDelete(null);
    try {
      await deleteAiKnowledge(item.id);
      toast({ title: 'Materi dihapus', description: item.judul });
      load();
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start gap-3 space-y-0">
        <div className="min-w-0 flex-1">
          <CardTitle className="flex items-center gap-2 text-lg"><BookOpen className="h-5 w-5 text-violet-600 dark:text-violet-300" aria-hidden="true" /> Pustaka materi AI</CardTitle>
          <CardDescription>
            Materi Qiroati, target hafalan per jilid, adab, dan tips mengajar. AI memilih materi yang paling relevan untuk setiap saran dan jawaban. Jangan menulis nama santri.
          </CardDescription>
        </div>
        {editing === null && (
          <Button type="button" onClick={() => startEdit(null)}><Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Tambah materi</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {editing !== null && (
          <form onSubmit={save} className="space-y-3 rounded-xl border border-border/70 p-4" aria-label={editing === 'baru' ? 'Materi baru' : 'Ubah materi'}>
            <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
              <div className="grid gap-1.5">
                <Label htmlFor="kb-judul">Judul</Label>
                <Input id="kb-judul" maxLength={120} value={form.judul} onChange={(e) => setForm((f) => ({ ...f, judul: e.target.value }))}
                  placeholder="Contoh: Target bacaan Jilid 3" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="kb-kategori">Kategori</Label>
                <Input id="kb-kategori" maxLength={40} value={form.kategori} onChange={(e) => setForm((f) => ({ ...f, kategori: e.target.value }))}
                  placeholder="Jilid, Hafalan, Adab…" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="kb-isi">Isi materi</Label>
              <Textarea id="kb-isi" rows={8} maxLength={ISI_MAX} value={form.isi} onChange={(e) => setForm((f) => ({ ...f, isi: e.target.value }))}
                className="text-sm leading-relaxed" required />
              <p className="text-right text-xs tabular-nums text-muted-foreground">{form.isi.length}/{ISI_MAX}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch id="kb-aktif" className="data-[state=unchecked]:bg-slate-300 dark:data-[state=unchecked]:bg-slate-600"
                  checked={form.aktif} onCheckedChange={(v) => setForm((f) => ({ ...f, aktif: v }))} />
                <Label htmlFor="kb-aktif" className="text-sm">Dipakai AI</Label>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={isSaving}>Batal</Button>
                <Button type="submit" disabled={!valid || isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />} Simpan materi
                </Button>
              </div>
            </div>
          </form>
        )}

        {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuat pustaka…</p>}
        {error && <p className="flex items-center gap-2 text-sm text-destructive" role="alert"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> {error}</p>}
        {!isLoading && !error && items.length === 0 && editing === null && (
          <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            Belum ada materi. AI tetap memakai pengetahuan dasar lembaga dari pengaturan di atas.
          </p>
        )}

        {items.length > 0 && (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.judul}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.kategori} · {item.isi.length} karakter · {item.isi.slice(0, 90)}</p>
                </div>
                <Switch aria-label={`Pakai materi ${item.judul}`} className="data-[state=unchecked]:bg-slate-300 dark:data-[state=unchecked]:bg-slate-600"
                  checked={item.aktif} onCheckedChange={(v) => toggle(item, v)} />
                <Button type="button" size="icon" variant="ghost" onClick={() => startEdit(item)} aria-label={`Ubah ${item.judul}`}><Pencil className="h-4 w-4" aria-hidden="true" /></Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => setToDelete(item)} aria-label={`Hapus ${item.judul}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={Boolean(toDelete)} onOpenChange={(open) => { if (!open) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus materi?</AlertDialogTitle>
            <AlertDialogDescription>
              “{toDelete?.judul}” akan dihapus permanen dan tidak lagi dipakai AI. Untuk menyimpannya, matikan saja sakelar “Dipakai AI”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default AiKnowledge;
