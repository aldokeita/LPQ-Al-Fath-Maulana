import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Send, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  createTelegramLinkToken, getAssistantErrorMessage, getMyTelegramLink, unlinkMyTelegram,
} from '@/lib/assistantAlertAdapters';

const POLL_MS = 4000;
const POLL_LIMIT = 45; // ±3 menit, sama dengan masa berlaku tautan yang wajar dipakai.

// Menyambungkan akun guru/admin ke bot Telegram lembaga lewat token sekali pakai.
// Tidak tampil sama sekali bila admin belum mengaktifkan Telegram (kecuali showWhenDisabled).
const TelegramConnect = ({ className, showWhenDisabled = false }) => {
  const [status, setStatus] = useState(null);
  const [link, setLink] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const polls = useRef(0);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const next = await getMyTelegramLink();
      setStatus(next);
      return next;
    } catch {
      setStatus(null);
      return null;
    }
  }, []);

  useEffect(() => { load(); return () => clearTimeout(timer.current); }, [load]);

  const poll = useCallback(async () => {
    const next = await load();
    if (next?.linked) {
      setLink(null);
      toast({ title: 'Telegram tersambung', description: 'Ringkasan dan peringatan akan dikirim ke Telegram Anda.' });
      return;
    }
    polls.current += 1;
    if (polls.current < POLL_LIMIT) timer.current = setTimeout(poll, POLL_MS);
  }, [load]);

  const connect = async () => {
    setIsBusy(true);
    try {
      const token = await createTelegramLinkToken();
      setLink(`https://t.me/${status.bot_username}?start=${token}`);
      polls.current = 0;
      clearTimeout(timer.current);
      timer.current = setTimeout(poll, POLL_MS);
    } catch (err) {
      toast({ title: 'Gagal membuat tautan', description: getAssistantErrorMessage(err), variant: 'destructive' });
    } finally {
      setIsBusy(false);
    }
  };

  const disconnect = async () => {
    setIsBusy(true);
    try {
      await unlinkMyTelegram();
      await load();
      toast({ title: 'Telegram diputus', description: 'Anda tidak akan menerima notifikasi Telegram lagi.' });
    } catch (err) {
      toast({ title: 'Gagal memutus', description: getAssistantErrorMessage(err), variant: 'destructive' });
    } finally {
      setIsBusy(false);
    }
  };

  if (!status) return null;
  const ready = status.enabled && status.bot_username;
  if (!ready && !showWhenDisabled) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-sky-300/60 bg-sky-50/70 px-3 py-2.5 text-sm dark:border-sky-400/20 dark:bg-sky-500/10', className)}>
      <Send className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden="true" />
      {!ready && (
        <p className="min-w-0 flex-1 text-sky-900 dark:text-sky-100">
          Telegram belum aktif. Isi nama bot dan nyalakan Telegram di pengaturan notifikasi.
        </p>
      )}
      {ready && status.linked && (
        <>
          <p className="min-w-0 flex-1 text-sky-900 dark:text-sky-100">
            <CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
            Telegram tersambung{status.linked_at && <> sejak {new Date(status.linked_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</>}.
          </p>
          <Button type="button" size="sm" variant="ghost" onClick={disconnect} disabled={isBusy}>
            {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Unlink className="mr-2 h-4 w-4" aria-hidden="true" />} Putuskan
          </Button>
        </>
      )}
      {ready && !status.linked && !link && (
        <>
          <p className="min-w-0 flex-1 text-sky-900 dark:text-sky-100">Terima ringkasan harian dan peringatan prioritas tinggi lewat Telegram.</p>
          <Button type="button" size="sm" onClick={connect} disabled={isBusy}>
            {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="mr-2 h-4 w-4" aria-hidden="true" />} Sambungkan Telegram
          </Button>
        </>
      )}
      {ready && !status.linked && link && (
        <>
          <p className="min-w-0 flex-1 text-sky-900 dark:text-sky-100" role="status">
            Buka Telegram, lalu tekan <strong>Start</strong> di bot @{status.bot_username}. Tautan berlaku 15 menit.
          </p>
          <Button asChild size="sm">
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Send className="mr-2 h-4 w-4" aria-hidden="true" /> Buka Telegram<span className="sr-only"> (tab baru)</span>
            </a>
          </Button>
        </>
      )}
    </div>
  );
};

export default TelegramConnect;
