import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Tv, Save, Layout, Users, Trophy, Star, BookCopy, User, Calendar, Smartphone, Globe, Clock, Timer, MessageSquare, MonitorPlay, Monitor, Settings2, UserMinus } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { motion } from 'framer-motion';
import { OFFICIAL_CONTACT, OFFICIAL_QUOTAS } from '@/lib/institutionContent';

const TvDisplaySettings = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [santriList, setSantriList] = useState([]);
    const [activeTab, setActiveTab] = useState("general");
    const [config, setConfig] = useState({
        transitionTime: 15,
        showSeconds: true,
        showAdults: true,
        enabledSessions: { attendance: true, quotas: true, wali: true, profiles: true, leaderboard: true },
        sessionSettings: { attendance: { orientation: 'landscape', showAdultClasses: false }, quotas: { orientation: 'landscape' }, wali: { orientation: 'landscape' }, profiles: { orientation: 'landscape', mode: 'auto', maxPages: 0 }, leaderboard: { orientation: 'landscape' } },
        sessionQuotas: { pagi: OFFICIAL_QUOTAS.pagi, siang: OFFICIAL_QUOTAS.siang, sore: OFFICIAL_QUOTAS.sore },
        registration: { startDate: '', endDate: '', contactWa: '6285783227144', websiteUrl: OFFICIAL_CONTACT.website.replace(/^https?:\/\//, '') },
        leaderboard: {},
        durations: { quotas: 15, wali: 30, waliMessage: 10, leaderboard: 15, attendancePage: 10, profilesPage: 10, profilesTotal: 300 }
    });

    useEffect(() => { fetchSettings(); fetchSantri(); }, []);

    const fetchSantri = async () => {
        const { data } = await supabase.from('santri').select('id, nama_lengkap').eq('status', 'Aktif').order('nama_lengkap');
        if (data) setSantriList(data);
    };

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const { data: configData } = await supabase.from('website_content').select('content').eq('key', 'tv_config').maybeSingle();
            if (configData?.content) {
                setConfig(prev => ({ ...prev, ...configData.content, sessionSettings: { ...prev.sessionSettings, ...configData.content.sessionSettings }, sessionQuotas: { ...prev.sessionQuotas, ...configData.content.sessionQuotas }, registration: { ...prev.registration, ...configData.content.registration }, leaderboard: { ...prev.leaderboard, ...configData.content.leaderboard }, durations: { ...prev.durations, ...configData.content.durations }, showAdults: configData.content.showAdults !== undefined ? configData.content.showAdults : true }));
            }
        } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };

    const saveConfig = async () => {
        setIsLoading(true);
        const { error } = await supabase.from('website_content').upsert({ key: 'tv_config', content: config }, { onConflict: 'key' });
        if (error) toast({ title: "Gagal Simpan Konfigurasi", description: error.message, variant: "destructive" });
        else toast({ title: "Berhasil", description: "Konfigurasi TV disimpan dan akan segera aktif." });
        setIsLoading(false);
    };

    const sessions = [{ id: 'attendance', label: 'Detail Absensi & Kelas', icon: MonitorPlay }, { id: 'quotas', label: 'Kuota Per Sesi', icon: Users }, { id: 'wali', label: 'Info Wali Santri', icon: MessageSquare }, { id: 'profiles', label: 'Kartu Profil Santri', icon: User }, { id: 'leaderboard', label: 'Leaderboard Prestasi', icon: Trophy }];
    const categories = [{ id: 'disciplined', label: 'Santri Paling Disiplin', icon: Trophy }, { id: 'drilling', label: 'Santri Terbaik Drilling', icon: Star }, { id: 'memorization', label: 'Santri Hafalan Terbanyak', icon: BookCopy }];
    const tabs = [{ id: 'general', label: 'Umum & Sesi', icon: Settings2 }, { id: 'quotas', label: 'Kuota & Pendaftaran', icon: Users }, { id: 'leaderboard', label: 'Leaderboard', icon: Trophy }];

    const handleLeaderboardChange = (category, session, gender, value) => {
        setConfig(prev => ({ ...prev, leaderboard: { ...prev.leaderboard, [category]: { ...prev.leaderboard?.[category], [session]: { ...prev.leaderboard?.[category]?.[session], [gender]: value === 'none' ? null : value } } } }));
    };

    const updateDuration = (key, value) => { setConfig(prev => ({ ...prev, durations: { ...prev.durations, [key]: parseInt(value) || 10 } })); };
    const updateSessionSetting = (sessionId, settingKey, value) => { setConfig(prev => ({ ...prev, sessionSettings: { ...prev.sessionSettings, [sessionId]: { ...prev.sessionSettings?.[sessionId], [settingKey]: value } } })); };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Tv className="w-5 h-5"/> Konfigurasi Tampilan TV</CardTitle><CardDescription>Pusat pengaturan untuk Mode TV Display.</CardDescription></CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="flex justify-center mb-6">
                            <div className="admin-glass-tab-list inline-flex p-1 rounded-full gap-1">
                                {tabs.map((tab) => (
                                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`admin-glass-tab-button relative px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${activeTab === tab.id ? 'text-primary dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}>
                                        {activeTab === tab.id && (<motion.div layoutId="tv-pill" className="admin-glass-tab-indicator" transition={{ type: 'spring', stiffness: 430, damping: 34, mass: 0.72 }} />)}
                                        <span className="relative z-10 flex items-center gap-2"><tab.icon className="w-4 h-4" />{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <TabsContent value="general" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border shadow-sm">
                                <div className="space-y-3">
                                    <Label className="flex items-center gap-2 font-bold text-primary"><Timer className="w-4 h-4"/> Default Transisi (Detik)</Label>
                                    <div className="flex gap-2"><Input type="number" min="5" className="text-lg font-mono font-bold bg-white dark:bg-black" value={config.transitionTime} onChange={(e) => setConfig({ ...config, transitionTime: parseInt(e.target.value) || 15 })} /><span className="flex items-center text-sm text-muted-foreground">Detik</span></div>
                                    <p className="text-[10px] text-muted-foreground">Fallback jika durasi spesifik tidak diatur.</p>
                                </div>
                                <div className="space-y-3">
                                    <Label className="flex items-center gap-2 font-bold text-primary"><Clock className="w-4 h-4"/> Format Jam Digital</Label>
                                    <Select value={config.showSeconds ? 'yes' : 'no'} onValueChange={(val) => setConfig({ ...config, showSeconds: val === 'yes' })}><SelectTrigger className="bg-white dark:bg-black"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Tampilkan Detik (HH:MM:SS)</SelectItem><SelectItem value="no">Jam & Menit Saja (HH:MM)</SelectItem></SelectContent></Select>
                                </div>
                                <div className="space-y-3 md:col-span-2 border-t pt-4">
                                    <Label className="flex items-center gap-2 font-bold text-primary mb-2"><UserMinus className="w-4 h-4"/> Filter Data Global</Label>
                                    <div className="flex items-center justify-between bg-white dark:bg-black p-3 rounded-lg border"><div className="flex flex-col"><span className="font-bold text-sm">Tampilkan Data Santri Dewasa (Global)</span><span className="text-xs text-muted-foreground">Jika non-aktif, santri dewasa akan disembunyikan dari semua sesi kecuali diatur khusus.</span></div><Switch checked={config.showAdults} onCheckedChange={(checked) => setConfig({ ...config, showAdults: checked })} /></div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b pb-2"><Label className="text-lg font-black flex items-center gap-2"><Layout className="w-5 h-5 text-slate-500"/> Konfigurasi Sesi Tampilan</Label></div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {sessions.map(session => (
                                        <div key={session.id} className={`p-4 rounded-xl border-2 transition-all ${config.enabledSessions[session.id] ? 'border-primary/50 bg-primary/5 shadow-sm' : 'border-dashed bg-slate-50 opacity-70'}`}>
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${config.enabledSessions[session.id] ? 'bg-white text-primary shadow-sm' : 'bg-slate-200 text-slate-500'}`}><session.icon className="w-5 h-5" /></div><div><h4 className="font-bold text-sm">{session.label}</h4><p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{session.id}</p></div></div>
                                                <Switch checked={config.enabledSessions[session.id]} onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabledSessions: { ...prev.enabledSessions, [session.id]: checked } }))} />
                                            </div>
                                            {config.enabledSessions[session.id] && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Orientasi Layar</Label><Select value={config.sessionSettings?.[session.id]?.orientation || 'landscape'} onValueChange={(val) => updateSessionSetting(session.id, 'orientation', val)}><SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="landscape"><div className="flex items-center gap-2"><Monitor className="w-3 h-3"/> Landscape</div></SelectItem><SelectItem value="portrait"><div className="flex items-center gap-2"><Smartphone className="w-3 h-3"/> Portrait</div></SelectItem></SelectContent></Select></div>
                                                        {session.id === 'profiles' ? (<div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Mode Tampilan</Label><Select value={config.sessionSettings?.profiles?.mode || 'auto'} onValueChange={(val) => updateSessionSetting('profiles', 'mode', val)}><SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Tampilkan Semua (Auto)</SelectItem><SelectItem value="manual">Durasi Manual (Fixed)</SelectItem></SelectContent></Select></div>) : (<div className="space-y-1"><Label className="text-[10px] text-muted-foreground">{session.id === 'attendance' ? 'Durasi Per Kelas' : session.id === 'wali' ? 'Durasi Per Pesan' : 'Total Durasi (Detik)'}</Label><Input type="number" min="5" className="h-8 text-xs font-mono text-right bg-white dark:bg-slate-900" value={session.id === 'attendance' ? config.durations?.attendancePage : session.id === 'wali' ? config.durations?.waliMessage : config.durations?.[session.id]} onChange={(e) => updateDuration(session.id === 'attendance' ? 'attendancePage' : session.id === 'wali' ? 'waliMessage' : session.id, e.target.value)} /></div>)}
                                                    </div>
                                                    {session.id === 'attendance' && (<div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded border flex items-center justify-between"><Label className="text-[10px] cursor-pointer" htmlFor="show-adult-class">Tampilkan Kelas Dewasa (Malam)</Label><Switch id="show-adult-class" checked={config.sessionSettings?.attendance?.showAdultClasses || false} onCheckedChange={(checked) => updateSessionSetting('attendance', 'showAdultClasses', checked)} className="scale-75"/></div>)}
                                                    {session.id === 'profiles' && (<div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border space-y-3"><div className="flex items-center gap-2 mb-1"><Settings2 className="w-3 h-3 text-muted-foreground"/><span className="text-[10px] font-bold uppercase text-muted-foreground">Pengaturan Lanjutan Profil</span></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label className="text-[10px]">Durasi Per Halaman</Label><Input type="number" min="5" className="h-7 text-xs font-mono" value={config.durations?.profilesPage || 10} onChange={(e) => updateDuration('profilesPage', e.target.value)}/></div>{config.sessionSettings?.profiles?.mode === 'manual' && (<div className="space-y-1"><Label className="text-[10px]">Total Durasi Sesi</Label><Input type="number" min="30" className="h-7 text-xs font-mono" value={config.durations?.profilesTotal || 300} onChange={(e) => updateDuration('profilesTotal', e.target.value)}/></div>)}<div className="space-y-1 col-span-2"><Label className="text-[10px]">Batasi Jumlah Halaman (0 = Semua)</Label><Input type="number" min="0" className="h-7 text-xs font-mono" value={config.sessionSettings?.profiles?.maxPages || 0} onChange={(e) => updateSessionSetting('profiles', 'maxPages', parseInt(e.target.value) || 0)}/></div></div></div>)}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="quotas" className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4"><p className="text-sm text-blue-700">Atur kapasitas maksimal santri untuk setiap sesi dan informasi pendaftaran.</p></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 border-b pb-6">
                                <div className="space-y-2"><Label className="flex items-center gap-2"><Calendar className="w-4 h-4"/> Tanggal Buka Pendaftaran</Label><Input type="date" value={config.registration?.startDate || ''} onChange={(e) => setConfig(prev => ({ ...prev, registration: { ...prev.registration, startDate: e.target.value } }))} /></div>
                                <div className="space-y-2"><Label className="flex items-center gap-2"><Calendar className="w-4 h-4"/> Tanggal Tutup Pendaftaran</Label><Input type="date" value={config.registration?.endDate || ''} onChange={(e) => setConfig(prev => ({ ...prev, registration: { ...prev.registration, endDate: e.target.value } }))} /></div>
                                <div className="space-y-2"><Label className="flex items-center gap-2"><Smartphone className="w-4 h-4"/> Nomor WhatsApp Admin</Label><Input placeholder="628..." value={config.registration?.contactWa || ''} onChange={(e) => setConfig(prev => ({ ...prev, registration: { ...prev.registration, contactWa: e.target.value } }))} /></div>
                                <div className="space-y-2"><Label className="flex items-center gap-2"><Globe className="w-4 h-4"/> Website URL</Label><Input placeholder="lpqalfathmaulana.id" value={config.registration?.websiteUrl || ''} onChange={(e) => setConfig(prev => ({ ...prev, registration: { ...prev.registration, websiteUrl: e.target.value } }))} /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{['pagi', 'siang', 'sore'].map(sesi => (<div key={sesi} className="space-y-2"><Label className="capitalize">Kuota Sesi {sesi}</Label><div className="flex items-center gap-2"><Users className="w-4 h-4 text-muted-foreground" /><Input type="number" min="0" value={config.sessionQuotas[sesi] || 0} onChange={(e) => setConfig(prev => ({ ...prev, sessionQuotas: { ...prev.sessionQuotas, [sesi]: parseInt(e.target.value) || 0 } }))} /></div></div>))}</div>
                        </TabsContent>

                        <TabsContent value="leaderboard" className="space-y-8">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6"><p className="text-sm text-blue-700">Pilih satu Santri Putra dan satu Santri Putri terbaik untuk setiap kategori dan sesi.</p></div>
                            {categories.map(category => (
                                <div key={category.id} className="border rounded-xl p-4 space-y-4 bg-slate-50/50">
                                    <h3 className="font-bold text-lg flex items-center gap-2 text-primary"><category.icon className="w-5 h-5" /> {category.label}</h3>
                                    <div className="grid md:grid-cols-3 gap-6">
                                        {['Pagi', 'Siang', 'Sore'].map(session => (
                                            <div key={session} className="bg-white p-3 rounded-lg border shadow-sm">
                                                <h4 className="text-sm font-bold text-center mb-3 uppercase text-muted-foreground border-b pb-2">{session}</h4>
                                                <div className="space-y-3">
                                                    <div className="space-y-1"><Label className="text-xs text-blue-600 flex items-center gap-1"><User className="w-3 h-3"/> Putra</Label><Select value={config.leaderboard?.[category.id]?.[session]?.['male'] || "none"} onValueChange={(val) => handleLeaderboardChange(category.id, session, 'male', val)}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih Santri" /></SelectTrigger><SelectContent><SelectItem value="none">- Kosong -</SelectItem>{santriList.filter(s => true).map(s => (<SelectItem key={s.id} value={s.id}>{s.nama_lengkap}</SelectItem>))}</SelectContent></Select></div>
                                                    <div className="space-y-1"><Label className="text-xs text-pink-600 flex items-center gap-1"><User className="w-3 h-3"/> Putri</Label><Select value={config.leaderboard?.[category.id]?.[session]?.['female'] || "none"} onValueChange={(val) => handleLeaderboardChange(category.id, session, 'female', val)}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih Santri" /></SelectTrigger><SelectContent><SelectItem value="none">- Kosong -</SelectItem>{santriList.map(s => (<SelectItem key={s.id} value={s.id}>{s.nama_lengkap}</SelectItem>))}</SelectContent></Select></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </TabsContent>
                    </Tabs>
                    <div className="mt-6 flex justify-end"><Button onClick={saveConfig} disabled={isLoading} className="w-full md:w-auto"><Save className="w-4 h-4 mr-2"/> Simpan Semua Pengaturan</Button></div>
                </CardContent>
            </Card>
        </div>
    );
};

export default TvDisplaySettings;
