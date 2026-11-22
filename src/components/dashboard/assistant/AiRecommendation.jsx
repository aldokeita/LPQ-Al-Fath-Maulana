import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, Loader2, MessageCircle, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { generateWhatsAppLink } from '@/utils/whatsappMessages';
import AiFeedback from '@/components/dashboard/assistant/AiFeedback';
import { AI_PROVIDERS, fillAiPlaceholders } from '@/lib/assistantAlerts';
import { requestAiRecommendation } from '@/lib/assistantAlertAdapters';

const providerLabel = (id) => AI_PROVIDERS.find((p) => p.id === id)?.label || id;

const formatTime = (iso) => {
  try {
    return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

// Saran AI untuk satu santri. Dibuat hanya saat diminta (hemat biaya); hasil tersimpan dipakai ulang.
// Nama asli diisi di browser: server dan penyedia AI hanya melihat placeholder {nama}/{guru}.
const AiRecommendation = ({ santriId, nickname, guruName, phone, initial }) => {
  const [rec, setRec] = useState(initial || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Saran tersimpan dimuat panel setelah kartu tampil; pakai bila belum ada yang lebih baru.
  useEffect(() => {
    if (initial) setRec((current) => (current && current.created_at >= initial.created_at ? current : initial));
  }, [initial]);

  const fill = (text) => fillAiPlaceholders(text, { nama: nickname, guru: guruName });

  const request = async (refresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      setRec(await requestAiRecommendation(santriId, { refresh }));
    } catch (err) {
      setError(err.message || 'Saran AI gagal dibuat.');
    } finally {
      setIsLoading(false);
    }
  };

  const message = rec?.hasil?.pesan_wali ? fill(rec.hasil.pesan_wali) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Tidak bisa menyalin', description: 'Salin teks secara manual.', variant: 'destructive' });
    }
  };

  return (
    <section className="attention-ai mt-3 rounded-2xl p-3" aria-label="Saran AI" aria-busy={isLoading}>
      <header className="flex items-center gap-2">
        <span className="attention-ai-badge flex h-7 w-7 shrink-0 items-center justify-center rounded-xl">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <h5 className="text-sm font-semibold text-foreground">Saran AI</h5>
        {rec && !isLoading && (
          <Button type="button" size="sm" variant="ghost" className="ml-auto h-8 px-2 text-xs" onClick={() => request(true)}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Perbarui
          </Button>
        )}
      </header>

      {!rec && !isLoading && !error && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="min-w-0 flex-1 text-xs text-foreground/75">Langkah tindak lanjut dan draf pesan wali dari data santri ini. Nama tidak dikirim ke AI.</p>
          <Button type="button" size="sm" className="attention-action-primary" onClick={() => request(false)}>
            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" /> Minta saran
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="mt-3 space-y-2" role="status">
          <span className="sr-only">Menyusun saran…</span>
          <div className="attention-ai-skeleton h-3 w-11/12 rounded-full" />
          <div className="attention-ai-skeleton h-3 w-9/12 rounded-full" />
          <div className="attention-ai-skeleton h-3 w-10/12 rounded-full" />
        </div>
      )}

      {error && !isLoading && (
        <div className="mt-2 flex flex-wrap items-start gap-2 text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{error}</span>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => request(false)}>Coba lagi</Button>
        </div>
      )}

      {rec?.hasil && !isLoading && (
        <div className="mt-2 space-y-3 text-sm">
          <p className="text-foreground">{fill(rec.hasil.ringkasan)}</p>
          <ol className="space-y-2">
            {rec.hasil.langkah.map((step, index) => (
              <li key={index} className="flex gap-2.5">
                <span className="attention-ai-step flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">{index + 1}</span>
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{fill(step.judul)}</span>
                  {step.alasan && <span className="block text-xs text-foreground/70">{fill(step.alasan)}</span>}
                </span>
              </li>
            ))}
          </ol>
          {message && (
            <details className="group rounded-xl border border-border/70 bg-background/60 p-2.5">
              <summary className="cursor-pointer select-none text-xs font-semibold text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Draf pesan untuk wali
              </summary>
              <p className="mt-2 whitespace-pre-line text-sm text-foreground">{message}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {phone && (
                  <Button asChild size="sm" variant="outline" className="h-8 border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10">
                    <a href={generateWhatsAppLink(phone, message)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Kirim via WhatsApp<span className="sr-only"> (membuka WhatsApp)</span>
                    </a>
                  </Button>
                )}
                <Button type="button" size="sm" variant="ghost" className="h-8" onClick={copy}>
                  {copied ? <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
                  {copied ? 'Tersalin' : 'Salin'}
                </Button>
              </div>
            </details>
          )}
          <div className="flex items-center gap-2">
            <p className={cn('min-w-0 flex-1 text-[11px] text-foreground/60')}>
              Dibuat AI ({providerLabel(rec.provider)} · {rec.model}) · {formatTime(rec.created_at)}. Periksa sebelum dipakai.
            </p>
            <AiFeedback jenis="rekomendasi" targetId={rec.id} />
          </div>
        </div>
      )}
    </section>
  );
};

export default AiRecommendation;
