import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Save, Plus, Trash2, Percent, Gamepad2, Trophy, X, RefreshCw, BarChart2, User, UserCheck, Sparkles, Clock3, Settings2, MessageSquare, Link2, ExternalLink, ShieldCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { doaHarian, bacaanShalat, suratPendek } from '@/data/islamicContent';
import { motion } from 'framer-motion';
import AttendanceConfiguration from './AttendanceConfiguration';
import { enableGameFeatures } from '@/lib/featureFlags';
import { saveWebsiteContentItem } from '@/lib/publicContentAdapters';
import { createDefaultSantriLevelConfig, normalizeLevelConfigShape } from '@/lib/santriLevel';
import { DEFAULT_WHATSAPP_TEMPLATES, fetchWhatsAppTemplates, saveWhatsAppTemplates } from '@/lib/whatsappTemplateAdapters';
import { fetchWhatsAppGroupLinks, isValidWhatsAppGroupLink, saveWhatsAppGroupLinks, validateWhatsAppGroupLinks, WHATSAPP_JILID_OPTIONS } from '@/lib/whatsappGroupLinksAdapters';

const GameConfiguration = () => {
    const [activeTab, setActiveTab] = useState('attendance');
    const tabs = [
        { id: 'attendance', label: 'Waktu Absensi', icon: Clock3 },
        { id: 'levels', label: 'Konfigurasi Level', icon: BarChart2 },
        { id: 'whatsapp', label: 'Pesan WhatsApp', icon: MessageSquare },
        ...(enableGameFeatures ? [
            { id: 'gatcha', label: 'Gatcha Game', icon: Gamepad2 },
            { id: 'quiz', label: 'Quiz Hafalan', icon: Trophy },
        ] : []),
    ];

    return (
        <div className="game-config-shell space-y-6">
            <div className="game-config-hero">
                <div className="game-config-hero__icon"><Settings2 className="w-6 h-6" /></div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight">Konfigurasi Sistem</h2>
                    <p className="text-sm text-muted-foreground mt-1">Atur waktu absensi serta pengalaman permainan dan gamifikasi.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex justify-start mb-6 overflow-x-auto pb-1">
                    <div className="game-config-tabs inline-flex p-1.5 rounded-2xl gap-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ease-out flex items-center gap-2 whitespace-nowrap
                                    ${activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}
                                `}
                            >
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="game-pill"
                                        className="game-config-tabs__active absolute inset-0 shadow-sm rounded-xl"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <TabsContent value="attendance" className="animate-in fade-in slide-in-from-bottom-2">
                    <AttendanceConfiguration />
                </TabsContent>

                <TabsContent value="gatcha" className="animate-in fade-in slide-in-from-bottom-2">
                    <GatchaSettings />
                </TabsContent>

                <TabsContent value="quiz" className="animate-in fade-in slide-in-from-bottom-2">
                    <QuizSettings />
                </TabsContent>

                <TabsContent value="levels" className="animate-in fade-in slide-in-from-bottom-2">
                    <LevelSettings />
                </TabsContent>

                <TabsContent value="whatsapp" className="animate-in fade-in slide-in-from-bottom-2">
                    <WhatsAppTemplateSettings />
                </TabsContent>
            </Tabs>
        </div>
    );
};

const GatchaSettings = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [config, setConfig] = useState({
        challenges: [],
        rewards: [
            { id: 1, type: "points", value: 10, label: "10 Poin Tambahan", weight: 50 },
            { id: 2, type: "item", value: "Snack", label: "Voucher Snack", weight: 20 }
        ]
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const populateDefaultChallenges = () => {
        const newChallenges = [];
        let idCounter = 1;
        suratPendek.slice(0, 10).forEach(surat => {
            newChallenges.push({ id: idCounter++, text: `Bacakan ${surat}`, difficulty: 'Medium' });
        });
        doaHarian.slice(0, 10).forEach(doa => {
            newChallenges.push({ id: idCounter++, text: `Bacakan ${doa}`, difficulty: 'Easy' });
        });
        bacaanShalat.slice(0, 5).forEach(bacaan => {
            newChallenges.push({ id: idCounter++, text: `Praktikkan ${bacaan}`, difficulty: 'Hard' });
        });
        return newChallenges;
    };

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase.from('website_content').select('content').eq('key', 'gatcha_config').maybeSingle();
            if (data?.content) {
                if (!data.content.challenges || data.content.challenges.length === 0) {
                    setConfig({ ...data.content, challenges: populateDefaultChallenges() });
                } else {
                    setConfig(data.content);
                }
            } else {
                setConfig({
                    challenges: populateDefaultChallenges(),
                    rewards: config.rewards
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const saveConfig = async () => {
        setIsLoading(true);
        const { error } = await supabase.from('website_content').upsert({ key: 'gatcha_config', content: config }, { onConflict: 'key' });
        if (error) toast({ title: "Gagal Simpan", description: error.message, variant: "destructive" });
        else toast({ title: "Berhasil", description: "Pengaturan Gatcha disimpan." });
        setIsLoading(false);
    };

    const resetToDefaults = () => {
        if(window.confirm("Reset tantangan ke paket standar Islami? Tantangan custom akan hilang.")) {
            setConfig(prev => ({ ...prev, challenges: populateDefaultChallenges() }));
            toast({ title: "Reset Berhasil", description: "Tantangan telah direset ke standar Islami." });
        }
    };

    const updateChallenge = (id, field, value) => setConfig(prev => ({ ...prev, challenges: prev.challenges.map(c => c.id === id ? { ...c, [field]: value } : c) }));
    const addChallenge = () => { const newId = Math.max(0, ...config.challenges.map(c => c.id)) + 1; setConfig(prev => ({ ...prev, challenges: [...prev.challenges, { id: newId, text: "", difficulty: "Medium" }] })); };
    const removeChallenge = (id) => setConfig(prev => ({ ...prev, challenges: prev.challenges.filter(c => c.id !== id) }));

    const updateReward = (id, field, value) => setConfig(prev => ({ ...prev, rewards: prev.rewards.map(r => r.id === id ? { ...r, [field]: value } : r) }));
    const addReward = () => { const newId = Math.max(0, ...config.rewards.map(r => r.id)) + 1; setConfig(prev => ({ ...prev, rewards: [...prev.rewards, { id: newId, type: "points", value: 0, label: "", weight: 10 }] })); };
    const removeReward = (id) => setConfig(prev => ({ ...prev, rewards: prev.rewards.filter(r => r.id !== id) }));

    return (
        <div className="game-config-panel game-config-panel--gatcha space-y-6">
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetToDefaults} className="hover:bg-yellow-50 border-yellow-200 text-yellow-700"><RefreshCw className="w-4 h-4 mr-2"/> Reset Konten Islami</Button>
                <Button onClick={saveConfig} disabled={isLoading} className="bg-primary"><Save className="w-4 h-4 mr-2"/> Simpan Perubahan Gatcha</Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-md border-0">
                    <CardHeader><CardTitle>Tantangan</CardTitle><CardDescription>Daftar tantangan yang muncul acak.</CardDescription></CardHeader>
                    <CardContent className="space-y-4 h-96 overflow-y-auto pr-2 custom-scrollbar">
                        {config.challenges.map((c) => (
                            <div key={c.id} className="flex gap-2 items-start border p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-white transition-colors">
                                <div className="flex-1 space-y-2">
                                    <Input value={c.text} onChange={(e) => updateChallenge(c.id, 'text', e.target.value)} placeholder="Tantangan..." className="h-9 text-sm"/>
                                    <Select value={c.difficulty} onValueChange={(val) => updateChallenge(c.id, 'difficulty', val)}>
                                        <SelectTrigger className="h-8 text-xs w-full"><SelectValue/></SelectTrigger>
                                        <SelectContent><SelectItem value="Easy">Mudah</SelectItem><SelectItem value="Medium">Sedang</SelectItem><SelectItem value="Hard">Sulit</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-100" onClick={() => removeChallenge(c.id)}><Trash2 className="w-4 h-4"/></Button>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={addChallenge}><Plus className="w-4 h-4 mr-2"/> Tambah Tantangan</Button>
                    </CardContent>
                </Card>
                <Card className="shadow-md border-0">
                    <CardHeader><CardTitle>Hadiah</CardTitle><CardDescription>Hadiah dan probabilitas (bobot).</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        {config.rewards.map((r) => (
                            <div key={r.id} className="flex flex-col gap-2 border p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-white transition-colors">
                                <div className="flex gap-2">
                                    <Select value={r.type} onValueChange={(val) => updateReward(r.id, 'type', val)}>
                                        <SelectTrigger className="h-9 w-28 text-xs"><SelectValue/></SelectTrigger>
                                        <SelectContent><SelectItem value="points">Poin</SelectItem><SelectItem value="item">Barang</SelectItem></SelectContent>
                                    </Select>
                                    <Input value={r.label} onChange={(e) => updateReward(r.id, 'label', e.target.value)} placeholder="Label Hadiah" className="h-9 text-sm flex-1"/>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-100" onClick={() => removeReward(r.id)}><Trash2 className="w-4 h-4"/></Button>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <div className="flex-1 relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{r.type === 'points' ? 'Nilai:' : 'Item:'}</span>
                                        <Input type={r.type === 'points' ? "number" : "text"} value={r.value} onChange={(e) => updateReward(r.id, 'value', e.target.value)} className="h-9 text-sm pl-12"/>
                                    </div>
                                    <div className="flex items-center w-28 relative">
                                        <Percent className="w-3 h-3 absolute left-2 text-muted-foreground"/>
                                        <Input type="number" value={r.weight} onChange={(e) => updateReward(r.id, 'weight', parseInt(e.target.value)||0)} className="h-9 text-sm pl-6" placeholder="Bobot"/>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={addReward}><Plus className="w-4 h-4 mr-2"/> Tambah Hadiah</Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

const QuizSettings = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [quizConfig, setQuizConfig] = useState([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');

    const defaultQuizData = [
        { id: 1, label: 'Doa Harian', color: '#3b82f6', items: doaHarian },
        { id: 2, label: 'Surat Pendek', color: '#a855f7', items: suratPendek },
        { id: 3, label: 'Bacaan Shalat', color: '#f59e0b', items: bacaanShalat }
    ];

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const { data } = await supabase.from('website_content').select('content').eq('key', 'quiz_hafalan_config').maybeSingle();
            if (data?.content) {
                const loadedCats = data.content.categories || (Array.isArray(data.content) ? data.content : []);
                const filteredCats = loadedCats.filter((category) =>
                    String(category.label || '').trim().toLowerCase() !== 'staging test'
                );
                const canonicalLabels = {
                    doa: 'Doa Harian',
                    'doa harian': 'Doa Harian',
                    surat: 'Surat Pendek',
                    'surat pendek': 'Surat Pendek',
                    sholat: 'Bacaan Shalat',
                    shalat: 'Bacaan Shalat',
                    'bacaan sholat': 'Bacaan Shalat',
                    'bacaan shalat': 'Bacaan Shalat'
                };
                const normalizedCategories = filteredCats.map((category, index) => ({
                    ...category,
                    id: category.id ?? `category-${index + 1}`,
                    label: canonicalLabels[String(category.label || '').trim().toLowerCase()] || category.label,
                    items: Array.isArray(category.items) ? category.items : []
                }));
                const requiredCategories = defaultQuizData.filter((required) =>
                    !normalizedCategories.some((category) => category.label === required.label)
                );
                const nextCategories = normalizedCategories.length === 0
                    ? defaultQuizData
                    : [...normalizedCategories, ...requiredCategories];
                setQuizConfig(nextCategories);

                if (filteredCats.length !== loadedCats.length) {
                    await supabase.from('website_content').upsert({
                        key: 'quiz_hafalan_config',
                        content: {
                            ...(Array.isArray(data.content) ? {} : data.content),
                            categories: nextCategories
                        }
                    }, { onConflict: 'key' });
                }
            } else {
                setQuizConfig(defaultQuizData);
            }
            setIsLoading(false);
        };
        load();
    }, []);

    const saveQuizConfig = async () => {
        setIsLoading(true);
        const payload = {
            categories: quizConfig.filter((category) =>
                String(category.label || '').trim().toLowerCase() !== 'staging test'
            )
        };
        const { error } = await supabase.from('website_content').upsert({ key: 'quiz_hafalan_config', content: payload }, { onConflict: 'key' });
        if (error) toast({ title: "Gagal Simpan", description: error.message, variant: "destructive" });
        else toast({ title: "Berhasil", description: "Konfigurasi Quiz disimpan." });
        setIsLoading(false);
    };

    const resetToDefaults = () => {
        if(window.confirm("Reset quiz ke konten standar (Doa, Surat, Sholat)?")) {
            setQuizConfig(defaultQuizData);
            toast({ title: "Reset Berhasil", description: "Quiz telah direset ke konten standar." });
        }
    }

    const addCategory = () => {
        if (!newCategoryName) return;
        const newId = Math.max(0, ...quizConfig.map(c => c.id)) + 1;
        setQuizConfig([...quizConfig, { id: newId, label: newCategoryName, color: newCategoryColor, items: [] }]);
        setNewCategoryName('');
    };
    const removeCategory = (id) => setQuizConfig(prev => prev.filter(c => c.id !== id));

    const addItem = (catId, item) => {
        if(!item) return;
        setQuizConfig(prev => prev.map(c => c.id === catId ? { ...c, items: [...c.items, item] } : c));
    };
    const removeItem = (catId, idx) => {
        setQuizConfig(prev => prev.map(c => c.id === catId ? { ...c, items: c.items.filter((_, i) => i !== idx) } : c));
    };

    return (
        <div className="game-config-panel game-config-panel--quiz space-y-6">
            <div className="game-config-section-heading">
                <div>
                    <h3 className="text-lg font-black flex items-center gap-2"><Sparkles className="w-5 h-5 text-cyan-500" /> Bank Soal Quiz Hafalan</h3>
                    <p className="text-sm text-muted-foreground">Kategori dan soal di sini langsung digunakan roda quiz; guru memilih serta menilai santri tanpa RFID.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={resetToDefaults}><RefreshCw className="w-4 h-4 mr-2"/> Reset</Button>
                    <Button onClick={saveQuizConfig} disabled={isLoading} className="game-config-save"><Save className="w-4 h-4 mr-2"/> Simpan Quiz</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 h-fit">
                    <CardHeader><CardTitle>Tambah Kategori</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div><Label>Nama Kategori</Label><Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Misal: Hadits"/></div>
                        <div><Label>Warna</Label><Input type="color" value={newCategoryColor} onChange={e => setNewCategoryColor(e.target.value)} className="h-10 cursor-pointer w-full"/></div>
                        <Button onClick={addCategory} className="w-full" variant="outline"><Plus className="w-4 h-4 mr-2"/> Tambah</Button>
                    </CardContent>
                </Card>

                <div className="md:col-span-2 space-y-4">
                    {quizConfig.map(cat => (
                        <Card key={cat.id}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-lg flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={{background: cat.color}}></div> {cat.label}</CardTitle>
                                    <Button variant="ghost" size="sm" onClick={() => removeCategory(cat.id)} className="text-red-500"><Trash2 className="w-4 h-4"/></Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <Input id={`new-item-${cat.id}`} placeholder="Tambah pertanyaan/item..." className="h-8 text-sm" onKeyDown={(e) => { if(e.key==='Enter'){ addItem(cat.id, e.currentTarget.value); e.currentTarget.value=''; }}}/>
                                        <Button size="sm" onClick={() => { const el = document.getElementById(`new-item-${cat.id}`); addItem(cat.id, el.value); el.value=''; }}><Plus className="w-4 h-4"/></Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {cat.items.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="game-quiz-item-chip"
                                                style={{ '--quiz-item-accent': cat.color }}
                                            >
                                                <span className="game-quiz-item-chip__dot" />
                                                <span>{item}</span>
                                                <button onClick={() => removeItem(cat.id, idx)} aria-label={`Hapus ${item}`}><X className="w-3 h-3"/></button>
                                            </div>
                                        ))}
                                        {cat.items.length === 0 && <span className="text-xs text-muted-foreground italic">Belum ada item</span>}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};

const createDefaultLevelConfig = () => createDefaultSantriLevelConfig();

const normalizeLevel = (level, fallbackColor = '#3b82f6') => {
    const color = level.color || level.accentColor || fallbackColor;
    return {
        ...level,
        color,
        accentColor: color,
        cardBgColor: '#ffffff',
        textColor: color,
        cardBorderThickness: level.cardDepth ?? level.cardBorderThickness ?? 8,
        avatarBorderThickness: level.avatarDepth ?? level.avatarBorderThickness ?? 4,
        enableGradient: true,
        textGradient: true
    };
};

const normalizeEditableLevelConfig = (content) => {
    const defaults = createDefaultLevelConfig();
    const normalized = normalizeLevelConfigShape(content);
    return {
        male: (normalized.male.length > 0 ? normalized.male : defaults.male)
            .map((level, index) => normalizeLevel({ ...level, id: index + 1, name: level.name || level.label || `Level ${index + 1}` }, '#3b82f6')),
        female: (normalized.female.length > 0 ? normalized.female : defaults.female)
            .map((level, index) => normalizeLevel({ ...level, id: index + 1, name: level.name || level.label || `Level ${index + 1}` }, '#ec4899')),
    };
};

const LevelSettings = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [levelConfig, setLevelConfig] = useState(createDefaultLevelConfig);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase.from('website_content').select('content').eq('key', 'level_config').maybeSingle();
                if (error) throw error;
                if (data?.content) {
                    setLevelConfig(normalizeEditableLevelConfig(data.content));
                }
            } catch (error) {
                toast({ title: 'Gagal Memuat Konfigurasi Level', description: error.message || 'Konfigurasi default tetap dapat diedit dan disimpan.', variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const saveLevelConfig = async () => {
        setIsSaving(true);
        try {
            const normalizedConfig = {
                male: levelConfig.male.map((level) => normalizeLevel(level, '#3b82f6')).sort((a, b) => a.min - b.min),
                female: levelConfig.female.map((level) => normalizeLevel(level, '#ec4899')).sort((a, b) => a.min - b.min)
            };
            for (const [gender, levels] of Object.entries(normalizedConfig)) {
                if (levels.length === 0) throw new Error(`Minimal satu level santri ${gender === 'male' ? 'putra' : 'putri'} wajib tersedia.`);
                levels.forEach((level) => {
                    if (!level.name?.trim()) throw new Error('Nama level tidak boleh kosong.');
                    if (!Number.isFinite(Number(level.min)) || !Number.isFinite(Number(level.max)) || Number(level.min) > Number(level.max)) {
                        throw new Error(`Rentang poin level ${level.name} tidak valid.`);
                    }
                });
            }

            const saved = await saveWebsiteContentItem({ key: 'level_config', content: normalizedConfig, isPublic: true });
            const savedConfig = normalizeLevelConfigShape(saved?.content);
            if (savedConfig.male.length === 0 || savedConfig.female.length === 0) {
                throw new Error('Konfigurasi tersimpan tanpa data level lengkap.');
            }
            setLevelConfig(normalizeEditableLevelConfig(saved.content));
            toast({ title: "Berhasil", description: "Konfigurasi level putra dan putri sudah aktif pada profil absensi digital." });
        } catch (error) {
            toast({ title: "Gagal Simpan", description: error.message || 'Konfigurasi level tidak dapat disimpan.', variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const updateLevel = (gender, id, field, value) => {
        setLevelConfig((previous) => ({
            ...previous,
            [gender]: previous[gender].map((level) => level.id === id ? { ...level, [field]: value } : level)
        }));
    };

    const addLevel = (gender) => {
        const newId = Math.max(0, ...levelConfig[gender].map((level) => level.id)) + 1;
        const color = gender === 'female' ? '#ec4899' : '#3b82f6';
        setLevelConfig((previous) => ({
            ...previous,
            [gender]: [
                ...previous[gender],
                normalizeLevel({
                    id: newId,
                    name: 'Level Baru',
                    min: 0,
                    max: 0,
                    color,
                    cardBorderThickness: 8,
                    avatarBorderThickness: 4
                }, color)
            ]
        }));
    };

    const removeLevel = (gender, id) => {
        setLevelConfig((previous) => ({
            ...previous,
            [gender]: previous[gender].filter((level) => level.id !== id)
        }));
    };

    const renderLevelList = (gender, levels) => (
        <div className="space-y-4">
            <div className="game-level-note">
                <Sparkles className="w-5 h-5" />
                <p>Background profile card tetap putih. Warna di bawah hanya mengubah aksen, aura, nama, waktu, dan ikon sesuai level.</p>
            </div>
            {levels.map((level) => (
                <div
                    key={level.id}
                    className="game-level-card"
                    style={{
                        '--level-preview-accent': level.color,
                        '--level-card-depth': `${Math.max(0, Number(level.cardBorderThickness) || 0)}px`,
                        '--level-avatar-depth': `${Math.max(0, Number(level.avatarBorderThickness) || 0)}px`
                    }}
                >
                    <div className="game-level-card__preview">
                        <div className="game-level-card__avatar">{gender === 'female' ? 'P' : 'L'}</div>
                        <div className="min-w-0">
                            <p className="game-level-card__name">Nama Santri</p>
                            <p className="game-level-card__meta">{level.name || 'Level Baru'} · {level.min}–{level.max} poin</p>
                        </div>
                        <div className="game-level-card__accent" aria-label="Warna aksen level" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-4">
                            <Label className="text-xs font-semibold">Nama Level</Label>
                            <Input value={level.name} onChange={(event) => updateLevel(gender, level.id, 'name', event.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                            <Label className="text-xs font-semibold">Min Poin</Label>
                            <Input type="number" value={level.min} onChange={(event) => updateLevel(gender, level.id, 'min', Number.parseInt(event.target.value, 10) || 0)} />
                        </div>
                        <div className="md:col-span-2">
                            <Label className="text-xs font-semibold">Max Poin</Label>
                            <Input type="number" value={level.max} onChange={(event) => updateLevel(gender, level.id, 'max', Number.parseInt(event.target.value, 10) || 0)} />
                        </div>
                        <div className="md:col-span-3">
                            <Label className="text-xs font-semibold">Warna Aksen</Label>
                            <Input type="color" value={level.color} onChange={(event) => updateLevel(gender, level.id, 'color', event.target.value)} className="h-10 cursor-pointer w-full" />
                        </div>
                        <div className="md:col-span-1 flex justify-center">
                            <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => removeLevel(gender, level.id)} aria-label="Hapus level">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="md:col-span-6">
                            <div className="game-level-depth-control">
                                <div>
                                    <Label className="text-xs font-semibold">Depth Card</Label>
                                    <p className="text-[11px] text-muted-foreground">Mengatur ketebalan shadow card, bukan border.</p>
                                </div>
                                <span>{level.cardBorderThickness ?? 8}px</span>
                            </div>
                            <Input
                                type="range"
                                min="0"
                                max="16"
                                step="1"
                                value={level.cardBorderThickness ?? 8}
                                onChange={(event) => updateLevel(gender, level.id, 'cardBorderThickness', Number(event.target.value))}
                                className="game-level-range"
                            />
                        </div>
                        <div className="md:col-span-6">
                            <div className="game-level-depth-control">
                                <div>
                                    <Label className="text-xs font-semibold">Depth Avatar</Label>
                                    <p className="text-[11px] text-muted-foreground">Mengatur ketebalan shadow frame avatar.</p>
                                </div>
                                <span>{level.avatarBorderThickness ?? 4}px</span>
                            </div>
                            <Input
                                type="range"
                                min="0"
                                max="16"
                                step="1"
                                value={level.avatarBorderThickness ?? 4}
                                onChange={(event) => updateLevel(gender, level.id, 'avatarBorderThickness', Number(event.target.value))}
                                className="game-level-range"
                            />
                        </div>
                    </div>
                </div>
            ))}
            <Button variant="outline" onClick={() => addLevel(gender)} className="game-level-add w-full">
                <Plus className="w-4 h-4 mr-2" /> Tambah Level
            </Button>
        </div>
    );

    return (
        <div className="game-config-panel game-config-panel--levels space-y-6">
            <div className="game-config-section-heading">
                <div>
                    <h3 className="text-lg font-black">Level & Visual Profile Card</h3>
                    <p className="text-sm text-muted-foreground">Atur rentang poin, nama level, warna aksen, serta depth neumorphic untuk santri putra dan putri.</p>
                </div>
                <Button type="button" onClick={saveLevelConfig} disabled={isLoading || isSaving} className="game-config-save">
                    <Save className="w-4 h-4 mr-2"/> {isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi Level'}
                </Button>
            </div>

            <Tabs defaultValue="male" className="w-full">
                <TabsList className="game-level-gender-tabs w-full grid grid-cols-2">
                    <TabsTrigger value="male"><User className="w-4 h-4 mr-2"/> Santri Putra</TabsTrigger>
                    <TabsTrigger value="female"><UserCheck className="w-4 h-4 mr-2"/> Santri Putri</TabsTrigger>
                </TabsList>
                <TabsContent value="male" className="mt-5">
                    {renderLevelList('male', levelConfig.male)}
                </TabsContent>
                <TabsContent value="female" className="mt-5">
                    {renderLevelList('female', levelConfig.female)}
                </TabsContent>
            </Tabs>
        </div>
    );
};

const TEMPLATE_FIELDS = [
    {
        key: 'jilidPromotion',
        title: 'Kenaikan Jilid',
        description: 'Pesan untuk wali saat santri melanjutkan ke jilid berikutnya.',
        variables: ['nama_santri', 'jilid_lama', 'jilid_baru', 'link_grup', 'nama_lembaga'],
    },
    {
        key: 'jilidDemotion',
        title: 'Penurunan / Penguatan Jilid',
        description: 'Pesan pendampingan saat santri perlu menguatkan pembelajaran di jilid tujuan.',
        variables: ['nama_santri', 'jilid_lama', 'jilid_baru', 'link_grup', 'nama_lembaga'],
    },
    {
        key: 'paymentReceipt',
        title: 'Bukti Pembayaran',
        description: 'Pesan yang menyertai rincian transaksi pembayaran kepada wali santri.',
        variables: ['nama_santri', 'nomor_induk', 'rincian', 'nominal', 'tanggal', 'periode', 'metode', 'transaction_id', 'status', 'nama_lembaga'],
    },
];

const WhatsAppTemplateSettings = () => {
    const [templates, setTemplates] = useState({ ...DEFAULT_WHATSAPP_TEMPLATES });
    const [groupLinks, setGroupLinks] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let active = true;
        Promise.all([fetchWhatsAppTemplates(), fetchWhatsAppGroupLinks()])
            .then(([templateData, linkData]) => {
                if (!active) return;
                setTemplates(templateData);
                setGroupLinks(linkData);
            })
            .catch((error) => {
                if (active) toast({ title: 'Gagal memuat pengaturan WhatsApp', description: error.message, variant: 'destructive' });
            })
            .finally(() => active && setIsLoading(false));
        return () => { active = false; };
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            for (const field of TEMPLATE_FIELDS) {
                if (!templates[field.key]?.trim()) throw new Error(`Template ${field.title} tidak boleh kosong.`);
            }
            validateWhatsAppGroupLinks(groupLinks);
            const [savedTemplates, savedLinks] = await Promise.all([
                saveWhatsAppTemplates(templates),
                saveWhatsAppGroupLinks(groupLinks),
            ]);
            setTemplates(savedTemplates);
            setGroupLinks(savedLinks);
            toast({ title: 'Pengaturan tersimpan', description: 'Template dan link grup per jilid langsung digunakan pada pesan WhatsApp.' });
        } catch (error) {
            toast({ title: 'Gagal menyimpan pengaturan', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const jilidRows = [
        ...WHATSAPP_JILID_OPTIONS,
        ...Object.keys(groupLinks).filter((jilid) => !WHATSAPP_JILID_OPTIONS.includes(jilid)),
    ];

    return (
        <div className="game-config-panel space-y-5">
            <div className="game-config-section-heading">
                <div>
                    <h3 className="text-lg font-black">Editor Pesan WhatsApp</h3>
                    <p className="text-sm text-muted-foreground">Atur isi pesan dan tautan grup tujuan dalam satu tempat.</p>
                </div>
                <Button type="button" onClick={handleSave} disabled={isLoading || isSaving} className="game-config-save">
                    <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </Button>
            </div>

            <section className="whatsapp-links-glass" aria-labelledby="whatsapp-group-links-title">
                <div className="whatsapp-links-glass__heading">
                    <div className="whatsapp-links-glass__icon" aria-hidden="true"><Link2 className="h-5 w-5" /></div>
                    <div>
                        <h4 id="whatsapp-group-links-title" className="font-black text-foreground">Link grup per jilid</h4>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            <code>{'{{link_grup}}'}</code> mengikuti <code>{'{{jilid_baru}}'}</code>. Kosongkan kolom jika grup belum tersedia.
                        </p>
                    </div>
                    <div className="whatsapp-links-glass__privacy">
                        <ShieldCheck className="h-3.5 w-3.5" /> Hanya admin yang dapat mengubah
                    </div>
                </div>

                {isLoading ? (
                    <div className="whatsapp-links-glass__loading" role="status">Memuat link grup...</div>
                ) : (
                    <div className="whatsapp-links-glass__grid">
                        {jilidRows.map((jilid) => {
                            const link = groupLinks[jilid] || '';
                            return (
                                <div key={jilid} className="whatsapp-links-glass__row">
                                    <Label htmlFor={`group-link-${jilid}`} className="whatsapp-links-glass__label">{jilid}</Label>
                                    <div className="whatsapp-links-glass__control">
                                        <Input
                                            id={`group-link-${jilid}`}
                                            type="url"
                                            inputMode="url"
                                            value={link}
                                            onChange={(event) => setGroupLinks((current) => ({ ...current, [jilid]: event.target.value }))}
                                            placeholder="https://chat.whatsapp.com/..."
                                            autoComplete="off"
                                            aria-describedby={`group-link-help-${jilid}`}
                                        />
                                        {isValidWhatsAppGroupLink(link) && (
                                            <a href={link} target="_blank" rel="noreferrer" className="whatsapp-links-glass__open" aria-label={`Buka link grup ${jilid}`}>
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        )}
                                    </div>
                                    <span id={`group-link-help-${jilid}`} className="sr-only">Masukkan link undangan grup WhatsApp untuk {jilid}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
                {TEMPLATE_FIELDS.map((field, index) => (
                    <section key={field.key} className={`rounded-lg border bg-background/80 p-4 shadow-sm ${index === 2 ? 'xl:col-span-2' : ''}`}>
                        <div className="mb-3">
                            <h4 className="font-bold text-foreground">{field.title}</h4>
                            <p className="text-xs leading-relaxed text-muted-foreground">{field.description}</p>
                        </div>
                        <Textarea
                            value={templates[field.key] || ''}
                            onChange={(event) => setTemplates((current) => ({ ...current, [field.key]: event.target.value }))}
                            className="min-h-64 resize-y font-mono text-xs leading-relaxed"
                            aria-label={`Template WhatsApp ${field.title}`}
                        />
                        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Variabel tersedia">
                            {field.variables.map((variable) => (
                                <code key={variable} className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{'{{'}{variable}{'}}'}</code>
                            ))}
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2 px-0 text-xs"
                            onClick={() => setTemplates((current) => ({ ...current, [field.key]: DEFAULT_WHATSAPP_TEMPLATES[field.key] }))}
                        >
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Kembalikan contoh awal
                        </Button>
                    </section>
                ))}
            </div>
        </div>
    );
};

export default GameConfiguration;
