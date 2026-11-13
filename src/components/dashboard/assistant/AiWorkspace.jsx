import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Award, Bot, Check, Copy, FileText, Loader2, MessageCircle, MessageSquarePlus, StickyNote, RefreshCw, Send,
  Sparkles, Target, Trash2, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { AI_PROVIDERS, fillAiPlaceholders } from '@/lib/assistantAlerts';
import {
  deleteAiConversation, fetchAiClasses, fetchAiClassRoster, fetchAiConversations, fetchAiMessages, fetchAssistantSettings,
  fetchLatestAiReport, fetchMyAiFeedback, fetchSantriSnapshots, requestAiReport, requestClassInsight, sendAiChat,
} from '@/lib/assistantAlertAdapters';
import { saveSantriNote } from '@/lib/academicAdapters';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { generateWhatsAppLink } from '@/utils/whatsappMessages';
import AiText from '@/components/dashboard/assistant/AiText';
import AiFeedback from '@/components/dashboard/assistant/AiFeedback';
import MicButton from '@/components/dashboard/assistant/MicButton';
import { appendTranscript } from '@/lib/speechInput';
import '@/styles/attention-panel.css';

const ALL = '__semua__';
const providerLabel = (id) => AI_PROVIDERS.find((p) => p.id === id)?.label || id;
const formatTime = (iso) => {
  try {
    return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};
const fillCodes = (text, nama) => String(text || '').replace(/\bS(\d{1,3})\b/g, (m) => nama?.[m] || m);
const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(id || ''));

// ===== Gambaran kelas =====

const ClassInsight = ({ classId }) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setData(null);
    requestClassInsight(classId, { onlyCached: true })
      .then((res) => { if (active) setData(res?.hasil ? res : null); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [classId]);

  const generate = async (refresh) => {
    setIsGenerating(true);
    setError(null);
    try {
      setData(await requestClassInsight(classId, { refresh }));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const hasil = data?.hasil;
  const nama = data?.nama || {};
  const perhatian = hasil?.sorotan?.filter((s) => s.jenis === 'perhatian') || [];
  const apresiasi = hasil?.sorotan?.filter((s) => s.jenis === 'apresiasi') || [];

  if (isLoading) {
    return <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuat…</p>;
  }

  return (
    <div className="space-y-4" aria-busy={isGenerating}>
      {!hasil && !isGenerating && (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-5 sm:flex-row sm:items-center">
          <Users className="h-8 w-8 shrink-0 text-violet-500" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-foreground/80">
            Minta AI membaca seluruh kelas: siapa yang perlu didampingi, siapa yang layak diapresiasi, dan apa fokus kelas pekan ini.
          </p>
          <Button type="button" className="attention-action-primary" onClick={() => generate(false)}>
            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" /> Buat gambaran kelas
          </Button>
        </div>
      )}

      {isGenerating && (
        <div className="space-y-2 py-2" role="status">
          <span className="sr-only">Membaca data kelas…</span>
          {[11, 9, 10, 7].map((w) => <div key={w} className="attention-ai-skeleton h-3 rounded-full" style={{ width: `${w * 8}%` }} />)}
        </div>
      )}

      {error && !isGenerating && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}
        </p>
      )}

      {hasil && !isGenerating && (
        <>
          <div className="attention-ai rounded-2xl p-4">
            <p className="text-sm text-foreground">{fillCodes(hasil.ringkasan, nama)}</p>
            {hasil.fokus_pekan_ini && (
              <p className="mt-3 flex items-start gap-2 text-sm font-medium text-foreground">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                <span>Fokus pekan ini: {fillCodes(hasil.fokus_pekan_ini, nama)}</span>
              </p>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 dark:border-rose-400/20 dark:bg-rose-500/5" aria-label="Perlu didampingi">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-200"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> Perlu didampingi</h4>
              {perhatian.length === 0 ? <p className="text-sm text-foreground/70">Tidak ada yang menonjol.</p> : (
                <ul className="space-y-2">
                  {perhatian.map((s) => (
                    <li key={s.kode + s.catatan} className="text-sm"><span className="font-semibold text-foreground">{nama[s.kode] || s.kode}</span>
                      <span className="text-foreground/75"> — {fillCodes(s.catatan, nama)}</span></li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:border-emerald-400/20 dark:bg-emerald-500/5" aria-label="Layak diapresiasi">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200"><Award className="h-4 w-4" aria-hidden="true" /> Layak diapresiasi</h4>
              {apresiasi.length === 0 ? <p className="text-sm text-foreground/70">Belum ada yang disorot.</p> : (
                <ul className="space-y-2">
                  {apresiasi.map((s) => (
                    <li key={s.kode + s.catatan} className="text-sm"><span className="font-semibold text-foreground">{nama[s.kode] || s.kode}</span>
                      <span className="text-foreground/75"> — {fillCodes(s.catatan, nama)}</span></li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section aria-label="Saran untuk seluruh kelas">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Saran untuk seluruh kelas</h4>
            <ol className="space-y-2">
              {hasil.saran_umum.map((step, index) => (
                <li key={step.judul} className="flex gap-2.5 text-sm">
                  <span className="attention-ai-step flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">{index + 1}</span>
                  <span className="min-w-0"><span className="block font-medium text-foreground">{fillCodes(step.judul, nama)}</span>
                    {step.alasan && <span className="block text-xs text-foreground/70">{fillCodes(step.alasan, nama)}</span>}</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-[11px] text-foreground/60">
            <span className="min-w-0 flex-1">
              Dibuat AI ({providerLabel(data.provider)} · {data.model}) · {formatTime(data.created_at)}.
              {data.usang && <span className="font-medium text-amber-700 dark:text-amber-300"> Data kelas sudah berubah sejak dibuat.</span>} Periksa sebelum dipakai.
            </span>
            <AiFeedback jenis="kelas" targetId={data.id} />
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => generate(true)}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Perbarui
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

// ===== Tanya asisten =====

const Bubble = ({ role, children, footer }) => (
  <li className={cn('flex flex-col', role === 'user' ? 'items-end' : 'items-start')}>
    <div className={cn('max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm',
      role === 'user' ? 'rounded-br-md bg-primary text-primary-foreground' : 'attention-ai rounded-bl-md text-foreground')}>
      {children}
    </div>
    {footer && <div className={cn('mt-1 flex w-full max-w-[88%] flex-wrap items-center gap-1', role === 'user' && 'justify-end')}>{footer}</div>}
  </li>
);

// Simpan isi pesan sebagai catatan guru untuk santri yang sedang dibahas; guru menyunting dulu sebelum menyimpan.
const SaveNote = ({ santriId, santriName, text, onDone }) => {
  const { user } = useAuth();
  const [note, setNote] = useState(String(text || '').replace(/\*\*/g, '').trim().slice(0, 2000));
  const [isSaving, setIsSaving] = useState(false);
  const save = async () => {
    if (!note.trim()) return;
    setIsSaving(true);
    try {
      await saveSantriNote({ santriId, note, userId: user?.id });
      toast({ title: 'Catatan tersimpan', description: `Tercatat di profil ${santriName}.` });
      onDone();
    } catch (err) {
      toast({ title: 'Catatan gagal disimpan', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="mt-1 w-full space-y-2 rounded-xl border border-border/70 bg-background/80 p-2.5 text-left">
      <Label htmlFor={`note-${santriId}`} className="text-xs">Catatan untuk {santriName}</Label>
      <Textarea id={`note-${santriId}`} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className="text-sm" />
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onDone}>Batal</Button>
        <Button type="button" size="sm" className="attention-action-primary h-8" onClick={save} disabled={isSaving || !note.trim()}>
          {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <StickyNote className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />} Simpan catatan
        </Button>
      </div>
    </div>
  );
};

const SUGGESTIONS = [
  'Siapa yang perlu saya dampingi pekan ini?',
  'Bagaimana memotivasi santri yang lama di jilidnya?',
  'Ide apresiasi untuk santri yang rajin?',
];

const AiChat = ({ classId, roster, focus }) => {
  const [santriId, setSantriId] = useState(ALL);
  const [feedback, setFeedback] = useState({});
  const [noteFor, setNoteFor] = useState(null);
  const appliedFocus = useRef(null);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState(null);
  const listRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await fetchAiConversations());
    } catch {
      setConversations([]);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { setSantriId(ALL); setConversationId(null); setMessages([]); }, [classId]);
  // Dari tombol "Tanya AI" di kartu santri: pilih santri itu setelah daftar kelasnya termuat.
  useEffect(() => {
    if (!focus || appliedFocus.current === focus.nonce || focus.classId !== classId) return;
    if (!roster.some((r) => r.id === focus.santriId)) return;
    appliedFocus.current = focus.nonce;
    setSantriId(focus.santriId);
    setConversationId(null);
    setMessages([]);
    setError(null);
    document.getElementById('ai-chat-input')?.focus({ preventScroll: true });
  }, [focus, roster, classId]);
  useEffect(() => {
    const ids = messages.filter((m) => m.role === 'assistant' && isUuid(m.id) && !(m.id in feedback)).map((m) => m.id);
    if (!ids.length) return;
    fetchMyAiFeedback('chat', ids)
      .then((map) => setFeedback((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, map[id] || null])) })))
      .catch(() => {});
  }, [messages, feedback]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, isSending]);

  const openConversation = async (id) => {
    if (id === 'baru') { setConversationId(null); setMessages([]); return; }
    const conv = conversations.find((c) => c.id === id);
    setConversationId(id);
    setError(null);
    if (conv?.santri_id && roster.some((r) => r.id === conv.santri_id)) setSantriId(conv.santri_id);
    try {
      setMessages(await fetchAiMessages(id));
    } catch (err) {
      setError(err.message);
    }
  };

  const removeConversation = async () => {
    if (!conversationId) return;
    try {
      await deleteAiConversation(conversationId);
      setConversationId(null);
      setMessages([]);
      loadConversations();
      toast({ title: 'Percakapan dihapus' });
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: err.message, variant: 'destructive' });
    }
  };

  const send = async (text) => {
    const message = String(text ?? draft).trim();
    if (!message || isSending) return;
    setIsSending(true);
    setError(null);
    const tempId = `u-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content: message }]);
    setDraft('');
    try {
      const res = await sendAiChat({ conversationId, classId, santriId: santriId === ALL ? null : santriId, message });
      const answerId = res.message_id || `a-${Date.now()}`;
      if (res.message_id) setFeedback((prev) => ({ ...prev, [res.message_id]: null }));
      setMessages((prev) => [
        ...prev.map((m) => (m.id === tempId && res.user_message_id ? { ...m, id: res.user_message_id } : m)),
        { id: answerId, role: 'assistant', content: res.answer },
      ]);
      if (!conversationId) { setConversationId(res.conversation_id); loadConversations(); }
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.slice(0, -1));
      setDraft(message);
    } finally {
      setIsSending(false);
    }
  };

  const classConversations = conversations.filter((c) => c.class_id === classId);
  const focusSantri = santriId !== ALL ? roster.find((r) => r.id === santriId) : null;
  const focusName = focusSantri ? (focusSantri.panggilan || focusSantri.nama.split(' ')[0]) : '';

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="ai-chat-santri">Bahas santri</Label>
          <Select value={santriId} onValueChange={setSantriId}>
            <SelectTrigger id="ai-chat-santri"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Seluruh kelas</SelectItem>
              {roster.map((s) => <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ai-chat-history">Percakapan</Label>
          <div className="flex gap-2">
            <Select value={conversationId || 'baru'} onValueChange={openConversation}>
              <SelectTrigger id="ai-chat-history" className="min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baru">Percakapan baru</SelectItem>
                {classConversations.map((c) => <SelectItem key={c.id} value={c.id}>{c.sumber === 'telegram' ? `Telegram · ${c.judul}` : c.judul}</SelectItem>)}
              </SelectContent>
            </Select>
            {conversationId && (
              <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={removeConversation} aria-label="Hapus percakapan ini">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <ul ref={listRef} className="max-h-[26rem] min-h-[10rem] space-y-3 overflow-y-auto rounded-2xl border border-border/60 bg-background/40 p-3" aria-live="polite" aria-label="Isi percakapan">
        {messages.length === 0 && !isSending && (
          <li className="flex flex-col items-center gap-3 py-6 text-center">
            <Bot className="h-8 w-8 text-violet-500" aria-hidden="true" />
            <p className="max-w-sm text-sm text-foreground/75">
              Tanyakan apa saja tentang santri atau kelas Anda. Asisten membaca hafalan, skor, poin, karakter, kehadiran, dan catatan; nama tidak dikirim ke AI.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((q) => (
                <button key={q} type="button" onClick={() => send(q)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-muted active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {q}
                </button>
              ))}
            </div>
          </li>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role}
            footer={((m.role === 'assistant' && isUuid(m.id)) || focusSantri) && (
              <>
                {m.role === 'assistant' && isUuid(m.id) && <AiFeedback jenis="chat" targetId={m.id} initial={feedback[m.id]}
                  onChange={(value) => setFeedback((prev) => ({ ...prev, [m.id]: value }))} />}
                {focusSantri && noteFor !== m.id && (
                  <button type="button" onClick={() => setNoteFor(m.id)}
                    className="flex h-8 items-center gap-1 rounded-full px-2 text-xs text-foreground/60 transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <StickyNote className="h-3.5 w-3.5" aria-hidden="true" /> Simpan jadi catatan
                  </button>
                )}
                {focusSantri && noteFor === m.id && (
                  <SaveNote santriId={focusSantri.id} santriName={focusName} text={m.content} onDone={() => setNoteFor(null)} />
                )}
              </>
            )}>
            {m.role === 'assistant' ? <AiText text={m.content} /> : m.content}
          </Bubble>
        ))}
        {isSending && (
          <li className="flex justify-start" role="status">
            <div className="attention-ai flex items-center gap-2 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm text-foreground/70">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Asisten sedang menyusun jawaban…
            </div>
          </li>
        )}
      </ul>

      {error && (
        <p className="flex items-start gap-2 text-sm text-destructive" role="alert"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</p>
      )}

      {heard && (
        <p className="truncate text-xs italic text-foreground/60" role="status" aria-live="polite">Mendengarkan: {heard}…</p>
      )}
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <Label htmlFor="ai-chat-input" className="sr-only">Pertanyaan untuk asisten</Label>
        <Textarea id="ai-chat-input" rows={2} maxLength={2000} value={draft} disabled={isSending}
          placeholder="Contoh: Hafalan apa yang sebaiknya dilatih Bilal pekan ini?"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          className="min-h-[44px] resize-none" />
        <MicButton disabled={isSending} onInterim={setHeard}
          onText={(t) => setDraft((d) => appendTranscript(d, t).slice(0, 2000))} />
        <Button type="submit" className="attention-action-primary h-11 shrink-0" disabled={isSending || !draft.trim()} aria-label="Kirim pertanyaan">
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
      <p className="text-[11px] text-foreground/60">Jawaban AI bisa keliru; periksa sebelum dipakai. Riwayat percakapan hanya terlihat oleh Anda.</p>
    </div>
  );
};

// ===== Rapor wali =====

const REPORT_LABELS = {
  pembuka: null, kehadiran: 'Kehadiran', bacaan: 'Bacaan Qiroati', hafalan: 'Hafalan', karakter: 'Karakter & adab',
  apresiasi: 'Apresiasi', saran_rumah: 'Saran di rumah', penutup: null,
};
const currentMonth = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7);
const monthLabel = (bulan) => {
  try {
    return new Date(`${bulan}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  } catch {
    return bulan;
  }
};

const composeReport = (hasil, { nama, guru, bulan }) => [
  `*Rapor perkembangan ${monthLabel(bulan)}*`,
  ...Object.entries(REPORT_LABELS)
    .filter(([key]) => hasil?.[key])
    .map(([key, label]) => (label ? `*${label}:* ` : '') + fillAiPlaceholders(hasil[key], { nama, guru })),
].join('\n\n');

const ReportPanel = ({ roster, guruName, focusSantriId }) => {
  const [santriId, setSantriId] = useState(focusSantriId && roster.some((r) => r.id === focusSantriId) ? focusSantriId : '');
  const [report, setReport] = useState(null);
  const [text, setText] = useState('');
  const [phone, setPhone] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [heard, setHeard] = useState('');
  const caretRef = useRef(null);
  const santri = roster.find((r) => r.id === santriId);
  const nama = santri ? (santri.panggilan || santri.nama.split(' ')[0]) : '';

  useEffect(() => {
    if (!santriId) return undefined;
    let active = true;
    setIsLoading(true);
    setError(null);
    setReport(null);
    setText('');
    Promise.all([fetchLatestAiReport(santriId), fetchSantriSnapshots([santriId]).catch(() => [])])
      .then(([latest, snaps]) => {
        if (!active) return;
        setPhone(snaps?.[0]?.no_hp_wali || null);
        if (latest && latest.bulan === currentMonth()) setReport(latest);
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [santriId]);

  useEffect(() => {
    caretRef.current = null;
    if (report?.hasil) setText(composeReport(report.hasil, { nama, guru: guruName, bulan: report.bulan || currentMonth() }));
  }, [report, nama, guruName]);

  const generate = async (refresh) => {
    setIsGenerating(true);
    setError(null);
    try {
      setReport(await requestAiReport(santriId, { refresh }));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Dikte disisipkan di posisi kursor (atau di akhir teks bila kolom belum pernah disentuh).
  const latestText = useRef(text);
  latestText.current = text;
  const dictate = (spoken) => {
    const current = latestText.current;
    const at = Math.min(caretRef.current ?? current.length, current.length);
    const before = appendTranscript(current.slice(0, at), spoken);
    const after = current.slice(at);
    const next = before + (after && !/^\s/.test(after) ? ' ' : '') + after;
    caretRef.current = before.length;
    latestText.current = next;
    setText(next);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: 'Tidak dapat menyalin', description: 'Salin teks secara manual.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3" aria-busy={isGenerating}>
      <div className="grid gap-1.5 sm:max-w-sm">
        <Label htmlFor="ai-report-santri">Santri</Label>
        <Select value={santriId || undefined} onValueChange={setSantriId}>
          <SelectTrigger id="ai-report-santri"><SelectValue placeholder="Pilih santri" /></SelectTrigger>
          <SelectContent>{roster.map((s) => <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!santriId && (
        <p className="flex items-center gap-2 rounded-2xl border border-dashed border-border p-5 text-sm text-foreground/75">
          <FileText className="h-6 w-6 shrink-0 text-violet-500" aria-hidden="true" />
          Pilih santri untuk menyusun draf rapor bulanan bagi wali. Draf bisa Anda sunting sebelum dikirim lewat WhatsApp.
        </p>
      )}

      {santriId && isLoading && (
        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuat…</p>
      )}

      {santriId && !isLoading && !report && !isGenerating && (
        <Button type="button" className="attention-action-primary" onClick={() => generate(false)}>
          <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" /> Susun rapor {monthLabel(currentMonth())}
        </Button>
      )}

      {isGenerating && (
        <div className="space-y-2 py-2" role="status">
          <span className="sr-only">Menyusun rapor…</span>
          {[10, 8, 11, 9, 6].map((w) => <div key={w} className="attention-ai-skeleton h-3 rounded-full" style={{ width: `${w * 8}%` }} />)}
        </div>
      )}

      {error && !isGenerating && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}
        </p>
      )}

      {report?.hasil && !isGenerating && (
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <Label htmlFor="ai-report-text">Draf rapor untuk wali {nama} (bisa disunting)</Label>
            <MicButton size="sm" onInterim={setHeard} onText={dictate} />
          </div>
          {heard && <p className="truncate text-xs italic text-foreground/60" role="status" aria-live="polite">Mendengarkan: {heard}…</p>}
          <Textarea id="ai-report-text" rows={14} value={text} onChange={(e) => setText(e.target.value)}
            onSelect={(e) => { caretRef.current = e.target.selectionStart; }}
            onBlur={(e) => { caretRef.current = e.target.selectionStart; }} className="text-sm leading-relaxed" />
          <div className="flex flex-wrap items-center gap-2">
            {phone ? (
              <Button asChild size="sm" variant="outline" className="h-9 border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10">
                <a href={generateWhatsAppLink(phone, text)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden="true" /> Kirim via WhatsApp<span className="sr-only"> (membuka WhatsApp)</span>
                </a>
              </Button>
            ) : <span className="text-xs text-foreground/60">Nomor wali belum tercatat; salin lalu kirim manual.</span>}
            <Button type="button" size="sm" variant="ghost" className="h-9" onClick={copy}>
              {copied ? <Check className="mr-1.5 h-4 w-4" aria-hidden="true" /> : <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />}
              {copied ? 'Tersalin' : 'Salin'}
            </Button>
            <span className="flex-1" />
            <AiFeedback jenis="rapor" targetId={report.id} />
            <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => generate(true)}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Susun ulang
            </Button>
          </div>
          <p className="text-[11px] text-foreground/60">
            Dibuat AI ({providerLabel(report.provider)} · {report.model}) · {formatTime(report.created_at)}. Baca dan sesuaikan sebelum dikirim; suntingan tidak disimpan.
          </p>
        </div>
      )}
    </div>
  );
};

// ===== Ruang kerja =====

// Tampil hanya bila admin menyalakan AI dan pengguna punya kelas TPQ anak (kosong bagi guru saat mode senyap).
const AiWorkspace = ({ className, guruName }) => {
  const sectionRef = useRef(null);
  const [focus, setFocus] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(null);
  const [roster, setRoster] = useState([]);
  const [tab, setTab] = useState('kelas');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const settings = await fetchAssistantSettings();
        if (!settings?.ai?.enabled) return;
        const list = await fetchAiClasses();
        if (!active) return;
        setEnabled(true);
        setClasses(list);
        setClassId(list[0]?.id || null);
      } catch {
        if (active) setEnabled(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!classId) return;
    setRoster([]);
    fetchAiClassRoster(classId).then(setRoster).catch(() => setRoster([]));
  }, [classId]);

  // Tombol "Tanya AI" di kartu Perlu Perhatian.
  useEffect(() => {
    const onAsk = (event) => {
      const { santriId, classId: target } = event.detail || {};
      if (!santriId) return;
      const cls = classes.find((c) => c.id === target) ? target : classId;
      setClassId(cls);
      setTab('chat');
      setFocus({ santriId, classId: cls, nonce: Date.now() });
      requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    window.addEventListener('lpq:ai-ask', onAsk);
    return () => window.removeEventListener('lpq:ai-ask', onAsk);
  }, [classes, classId]);

  if (!enabled || classes.length === 0) return null;

  const tabs = [
    { id: 'kelas', label: 'Gambaran kelas', icon: Users },
    { id: 'chat', label: 'Tanya asisten', icon: MessageSquarePlus },
    { id: 'rapor', label: 'Rapor wali', icon: FileText },
  ];

  return (
    <section ref={sectionRef} className={cn('attention-shell mb-8 scroll-mt-20 rounded-3xl', className)} aria-labelledby="ai-workspace-title">
      <div className="attention-aurora" aria-hidden="true" />
      <header className="relative flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <span className="attention-ai-badge flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="ai-workspace-title" className="text-lg font-semibold leading-tight text-foreground">Asisten AI</h2>
          <p className="text-sm text-foreground/75">Gambaran kelas, konsultasi, dan draf rapor wali berdasarkan data santri.</p>
        </div>
        {classes.length > 1 && (
          <div className="w-full sm:w-56">
            <Label htmlFor="ai-class" className="sr-only">Kelas</Label>
            <Select value={classId || undefined} onValueChange={setClassId}>
              <SelectTrigger id="ai-class"><SelectValue /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nama_kelas}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
      </header>
      <div className="relative px-4 pb-5 sm:px-5">
        <div className="mb-4 flex max-w-full overflow-x-auto rounded-xl bg-muted/60 p-1 sm:inline-flex" role="tablist" aria-label="Fitur asisten AI">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" id={`ai-tab-${id}`} aria-selected={tab === id} aria-controls={`ai-panel-${id}`}
              onClick={() => setTab(id)}
              className={cn('flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tab === id ? 'bg-background text-foreground shadow-sm' : 'text-foreground/70 hover:text-foreground')}>
              <Icon className="h-4 w-4" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        <div id={`ai-panel-${tab}`} role="tabpanel" aria-labelledby={`ai-tab-${tab}`}>
          {classId && tab === 'kelas' && <ClassInsight classId={classId} />}
          {classId && tab === 'chat' && <AiChat classId={classId} roster={roster} focus={focus} />}
          {classId && tab === 'rapor' && (
            <ReportPanel key={`${classId}-${roster.length}`} roster={roster} guruName={guruName}
              focusSantriId={focus?.classId === classId ? focus.santriId : null} />
          )}
        </div>
      </div>
    </section>
  );
};

export default AiWorkspace;
