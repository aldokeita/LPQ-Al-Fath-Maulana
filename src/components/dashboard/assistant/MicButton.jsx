import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { getSpeechRecognition, SPEECH_ERRORS, SPEECH_LANG } from '@/lib/speechInput';

// Tombol dikte Bahasa Indonesia (Web Speech API). Tidak tampil di browser yang tidak mendukung;
// guru tetap bisa memakai mic pada keyboard. Teks final dikirim lewat onText; teks sementara
// ditampilkan lewat onInterim agar guru melihat apa yang sedang dikenali.
const MicButton = ({ onText, onInterim, disabled = false, className, size = 'md' }) => {
  const [Recognition] = useState(() => getSpeechRecognition());
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const handlers = useRef({ onText, onInterim });
  handlers.current = { onText, onInterim };

  const stop = () => {
    try { recRef.current?.stop(); } catch { /* sudah berhenti */ }
  };

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* abaikan */ } }, []);
  useEffect(() => { if (disabled) stop(); }, [disabled]);

  if (!Recognition) return null;

  const start = () => {
    const rec = new Recognition();
    rec.lang = SPEECH_LANG;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) handlers.current.onText?.(transcript);
        else interim += transcript;
      }
      handlers.current.onInterim?.(interim.trim());
    };
    rec.onerror = (event) => {
      if (event.error === 'aborted') return;
      toast({
        title: 'Dikte suara berhenti',
        description: SPEECH_ERRORS[event.error] || 'Pengenalan suara gagal. Coba lagi atau gunakan mic pada keyboard.',
        variant: event.error === 'no-speech' ? undefined : 'destructive',
      });
    };
    rec.onend = () => {
      setListening(false);
      handlers.current.onInterim?.('');
      recRef.current = null;
    };
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      toast({ title: 'Mikrofon belum bisa dipakai', description: 'Coba lagi sebentar lagi.', variant: 'destructive' });
    }
  };

  const dim = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  return (
    <button type="button" onClick={listening ? stop : start} disabled={disabled && !listening}
      aria-pressed={listening} aria-label={listening ? 'Berhenti mendikte' : 'Dikte dengan suara (Bahasa Indonesia)'}
      title={listening ? 'Berhenti mendikte' : 'Dikte dengan suara (Bahasa Indonesia)'}
      className={cn('relative flex shrink-0 items-center justify-center rounded-xl border transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        dim,
        listening
          ? 'border-rose-300 bg-rose-500 text-white shadow-[0_0_0_4px_rgba(244,63,94,0.18)] dark:border-rose-400/40'
          : 'border-border bg-background text-foreground/75 hover:bg-muted hover:text-foreground',
        className)}>
      {listening && <span className="absolute inset-0 rounded-xl bg-rose-500/40 motion-safe:animate-ping" aria-hidden="true" />}
      {listening ? <Square className="relative h-4 w-4" aria-hidden="true" fill="currentColor" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
};

export default MicButton;
