import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Award, Bot, Loader2, MessageSquarePlus, RefreshCw, Send, Sparkles, Target, Trash2, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { AI_PROVIDERS } from '@/lib/assistantAlerts';
import {
  deleteAiConversation, fetchAiClasses, fetchAiClassRoster, fetchAiConversations, fetchAiMessages, fetchAssistantSettings,
  requestClassInsight, sendAiChat,
} from '@/lib/assistantAlertAdapters';
import AiText from '@/components/dashboard/assistant/AiText';
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

const Bubble = ({ role, children }) => (
  <li className={cn('flex', role === 'user' ? 'justify-end' : 'justify-start')}>
    <div className={cn('max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm',
      role === 'user' ? 'rounded-br-md bg-primary text-primary-foreground' : 'attention-ai rounded-bl-md text-foreground')}>
      {children}
    </div>
  </li>
);

const SUGGESTIONS = [
  'Siapa yang perlu saya dampingi pekan ini?',
  'Bagaimana memotivasi santri yang lama di jilidnya?',
  'Ide apresiasi untuk santri yang rajin?',
];

const AiChat = ({ classId, roster }) => {
  const [santriId, setSantriId] = useState(ALL);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
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
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: message }]);
    setDraft('');
    try {
      const res = await sendAiChat({ conversationId, classId, santriId: santriId === ALL ? null : santriId, message });
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: res.answer }]);
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
                {classConversations.map((c) => <SelectItem key={c.id} value={c.id}>{c.judul}</SelectItem>)}
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
        {messages.map((m) => <Bubble key={m.id} role={m.role}>{m.role === 'assistant' ? <AiText text={m.content} /> : m.content}</Bubble>)}
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

      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <Label htmlFor="ai-chat-input" className="sr-only">Pertanyaan untuk asisten</Label>
        <Textarea id="ai-chat-input" rows={2} maxLength={2000} value={draft} disabled={isSending}
          placeholder="Contoh: Hafalan apa yang sebaiknya dilatih Bilal pekan ini?"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          className="min-h-[44px] resize-none" />
        <Button type="submit" className="attention-action-primary h-11 shrink-0" disabled={isSending || !draft.trim()} aria-label="Kirim pertanyaan">
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
      <p className="text-[11px] text-foreground/60">Jawaban AI bisa keliru; periksa sebelum dipakai. Riwayat percakapan hanya terlihat oleh Anda.</p>
    </div>
  );
};

// ===== Ruang kerja =====

// Tampil hanya bila admin menyalakan AI dan pengguna punya kelas TPQ anak (kosong bagi guru saat mode senyap).
const AiWorkspace = ({ className }) => {
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
    fetchAiClassRoster(classId).then(setRoster).catch(() => setRoster([]));
  }, [classId]);

  if (!enabled || classes.length === 0) return null;

  const tabs = [
    { id: 'kelas', label: 'Gambaran kelas', icon: Users },
    { id: 'chat', label: 'Tanya asisten', icon: MessageSquarePlus },
  ];

  return (
    <section className={cn('attention-shell mb-8 rounded-3xl', className)} aria-labelledby="ai-workspace-title">
      <div className="attention-aurora" aria-hidden="true" />
      <header className="relative flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <span className="attention-ai-badge flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="ai-workspace-title" className="text-lg font-semibold leading-tight text-foreground">Asisten AI</h2>
          <p className="text-sm text-foreground/75">Gambaran kelas dan konsultasi berdasarkan data santri.</p>
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
        <div className="mb-4 inline-flex rounded-xl bg-muted/60 p-1" role="tablist" aria-label="Fitur asisten AI">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" id={`ai-tab-${id}`} aria-selected={tab === id} aria-controls={`ai-panel-${id}`}
              onClick={() => setTab(id)}
              className={cn('flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tab === id ? 'bg-background text-foreground shadow-sm' : 'text-foreground/70 hover:text-foreground')}>
              <Icon className="h-4 w-4" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        <div id={`ai-panel-${tab}`} role="tabpanel" aria-labelledby={`ai-tab-${tab}`}>
          {classId && (tab === 'kelas' ? <ClassInsight classId={classId} /> : <AiChat classId={classId} roster={roster} />)}
        </div>
      </div>
    </section>
  );
};

export default AiWorkspace;
