import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Crown, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { getPublicContentErrorMessage, saveWebsiteContentItem } from '@/lib/publicContentAdapters';
import {
  DEFAULT_BADGE_PRIVILEGES, normalizeBadgePrivileges, PRIVILEGE_INTRO_MAX_LENGTH, PRIVILEGE_MAX_ITEMS, PRIVILEGE_MAX_LENGTH,
  SANTRI_BADGE_PRIVILEGES_KEY,
} from '@/lib/santriBadges';

// Daftar hak istimewa santri peraih badge; tampil sebagai halaman khusus pada cetakan A4.
const SantriBadgePrivilegesEditor = ({ value, onSaved }) => {
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => { setDraft(value); }, [value]);

  const cleaned = normalizeBadgePrivileges(draft);
  const isDirty = JSON.stringify(cleaned) !== JSON.stringify(normalizeBadgePrivileges(value));

  const setItem = (index, text) => setDraft((current) => ({ ...current, items: current.items.map((item, i) => (i === index ? text : item)) }));
  const removeItem = (index) => setDraft((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }));
  const addItem = () => setDraft((current) => ({ ...current, items: [...current.items, ''] }));
  const moveItem = (index, delta) => setDraft((current) => {
    const items = [...current.items];
    const target = index + delta;
    if (target < 0 || target >= items.length) return current;
    [items[index], items[target]] = [items[target], items[index]];
    return { ...current, items };
  });

  const save = async () => {
    setIsSaving(true);
    try {
      await saveWebsiteContentItem({ key: SANTRI_BADGE_PRIVILEGES_KEY, content: { ...cleaned, updatedAt: new Date().toISOString() }, isPublic: true });
      onSaved(cleaned);
      toast({ title: 'Hak istimewa tersimpan', description: 'Halaman hak istimewa ikut tercetak saat menekan Cetak A4.' });
    } catch (saveError) {
      toast({ title: 'Hak istimewa gagal disimpan', description: getPublicContentErrorMessage(saveError), variant: 'destructive' });
    }
    setIsSaving(false);
  };

  return (
    <section className="space-y-4 rounded-xl border bg-background/70 p-4" aria-labelledby="badge-privileges-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 id="badge-privileges-title" className="flex items-center gap-2 text-base font-semibold">
            <Crown className="h-5 w-5 text-amber-500" aria-hidden="true" /> Hak istimewa santri berprestasi
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">Dicetak sebagai halaman terakhir pada Cetak A4. Kosongkan daftar bila halaman ini tidak perlu dicetak.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setDraft(value)} disabled={!isDirty || isSaving}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Batalkan
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={!isDirty || isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
            Simpan Hak Istimewa
          </Button>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="badge-privileges-intro">Kalimat pembuka</Label>
        <Textarea id="badge-privileges-intro" rows={2} maxLength={PRIVILEGE_INTRO_MAX_LENGTH} value={draft.intro}
          onChange={(e) => setDraft((current) => ({ ...current, intro: e.target.value }))} className="text-sm" />
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Daftar hak istimewa</p>
        {draft.items.length === 0 && (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Belum ada hak istimewa. Halaman ini tidak ikut dicetak.</p>
        )}
        <ol className="grid gap-2">
          {draft.items.map((item, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={index} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 sm:flex">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-xs font-bold text-teal-700 dark:text-teal-300" aria-hidden="true">{index + 1}</span>
              <Input value={item} maxLength={PRIVILEGE_MAX_LENGTH} onChange={(e) => setItem(index, e.target.value)}
                aria-label={`Hak istimewa ${index + 1}`} placeholder="Contoh: Pulang lebih dulu setelah membaca doa penutup." className="min-w-0 flex-1" />
              <div className="col-start-2 flex justify-end gap-1 sm:contents">
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label={`Naikkan hak istimewa ${index + 1}`}>
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => moveItem(index, 1)} disabled={index === draft.items.length - 1} aria-label={`Turunkan hak istimewa ${index + 1}`}>
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive hover:text-destructive" onClick={() => removeItem(index)} aria-label={`Hapus hak istimewa ${index + 1}`}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={draft.items.length >= PRIVILEGE_MAX_ITEMS}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Tambah hak istimewa
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...DEFAULT_BADGE_PRIVILEGES, items: [...DEFAULT_BADGE_PRIVILEGES.items] })}>
            Pakai contoh bawaan
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Maksimal {PRIVILEGE_MAX_ITEMS} butir, masing-masing {PRIVILEGE_MAX_LENGTH} karakter. Baris kosong diabaikan saat disimpan.</p>
      </div>
    </section>
  );
};

export default SantriBadgePrivilegesEditor;
