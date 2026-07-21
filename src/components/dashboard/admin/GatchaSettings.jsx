import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Save, Plus, Trash2, Gift, ScrollText, Percent } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const GatchaSettings = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [config, setConfig] = useState({
        challenges: [
            { id: 1, text: "Sambung Ayat Surat An-Naba", difficulty: "Medium" },
            { id: 2, text: "Sebutkan 5 Hukum Tajwid", difficulty: "Hard" },
            { id: 3, text: "Baca Doa Sebelum Makan", difficulty: "Easy" }
        ],
        rewards: [
            { id: 1, type: "points", value: 10, label: "10 Poin Tambahan", weight: 50 },
            { id: 2, type: "points", value: 25, label: "25 Poin Tambahan", weight: 30 },
            { id: 3, type: "item", value: "Snack", label: "Voucher Snack", weight: 20 }
        ]
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase.from('website_content').select('content').eq('key', 'gatcha_config').maybeSingle();
            if (data?.content) {
                setConfig(data.content);
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

    // Challenge Handlers
    const addChallenge = () => {
        const newId = Math.max(0, ...config.challenges.map(c => c.id)) + 1;
        setConfig(prev => ({ ...prev, challenges: [...prev.challenges, { id: newId, text: "", difficulty: "Medium" }] }));
    };
    const updateChallenge = (id, field, value) => {
        setConfig(prev => ({ ...prev, challenges: prev.challenges.map(c => c.id === id ? { ...c, [field]: value } : c) }));
    };
    const removeChallenge = (id) => {
        setConfig(prev => ({ ...prev, challenges: prev.challenges.filter(c => c.id !== id) }));
    };

    // Reward Handlers
    const addReward = () => {
        const newId = Math.max(0, ...config.rewards.map(r => r.id)) + 1;
        setConfig(prev => ({ ...prev, rewards: [...prev.rewards, { id: newId, type: "points", value: 0, label: "", weight: 10 }] }));
    };
    const updateReward = (id, field, value) => {
        setConfig(prev => ({ ...prev, rewards: prev.rewards.map(r => r.id === id ? { ...r, [field]: value } : r) }));
    };
    const removeReward = (id) => {
        setConfig(prev => ({ ...prev, rewards: prev.rewards.filter(r => r.id !== id) }));
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-primary">Konfigurasi Gatcha Game</h2>
                    <p className="text-muted-foreground">Atur tantangan dan hadiah untuk event Gatcha.</p>
                </div>
                <Button onClick={saveConfig} disabled={isLoading}><Save className="w-4 h-4 mr-2"/> Simpan Perubahan</Button>
            </div>

            <Tabs defaultValue="challenges">
                <TabsList>
                    <TabsTrigger value="challenges"><ScrollText className="w-4 h-4 mr-2"/> Tantangan</TabsTrigger>
                    <TabsTrigger value="rewards"><Gift className="w-4 h-4 mr-2"/> Hadiah & Persentase</TabsTrigger>
                </TabsList>

                <TabsContent value="challenges" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Daftar Tantangan Random</CardTitle>
                            <CardDescription>Tantangan ini akan muncul secara acak saat santri bermain.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {config.challenges.map((challenge) => (
                                <div key={challenge.id} className="flex gap-4 items-start border p-3 rounded-lg">
                                    <div className="flex-1 space-y-2">
                                        <Label>Isi Tantangan</Label>
                                        <Input
                                            value={challenge.text}
                                            onChange={(e) => updateChallenge(challenge.id, 'text', e.target.value)}
                                            placeholder="Contoh: Sambung Ayat..."
                                        />
                                    </div>
                                    <div className="w-32 space-y-2">
                                        <Label>Kesulitan</Label>
                                        <Select value={challenge.difficulty} onValueChange={(val) => updateChallenge(challenge.id, 'difficulty', val)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Easy">Mudah</SelectItem>
                                                <SelectItem value="Medium">Sedang</SelectItem>
                                                <SelectItem value="Hard">Sulit</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button variant="destructive" size="icon" className="mt-8" onClick={() => removeChallenge(challenge.id)}>
                                        <Trash2 className="w-4 h-4"/>
                                    </Button>
                                </div>
                            ))}
                            <Button variant="outline" className="w-full border-dashed" onClick={addChallenge}><Plus className="w-4 h-4 mr-2"/> Tambah Tantangan</Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="rewards" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Daftar Hadiah & Probabilitas</CardTitle>
                            <CardDescription>Total Weight akan dihitung otomatis sebagai pembagi probabilitas.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {config.rewards.map((reward) => (
                                <div key={reward.id} className="flex flex-col md:flex-row gap-4 items-start border p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                                    <div className="w-32 space-y-2">
                                        <Label>Tipe</Label>
                                        <Select value={reward.type} onValueChange={(val) => updateReward(reward.id, 'type', val)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="points">Poin</SelectItem>
                                                <SelectItem value="item">Barang</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <Label>Label Tampilan</Label>
                                        <Input value={reward.label} onChange={(e) => updateReward(reward.id, 'label', e.target.value)} placeholder="Nama Hadiah" />
                                    </div>
                                    <div className="w-32 space-y-2">
                                        <Label>{reward.type === 'points' ? 'Nilai Poin' : 'Info Barang'}</Label>
                                        <Input
                                            type={reward.type === 'points' ? "number" : "text"}
                                            value={reward.value}
                                            onChange={(e) => updateReward(reward.id, 'value', e.target.value)}
                                        />
                                    </div>
                                    <div className="w-24 space-y-2">
                                        <Label className="flex items-center"><Percent className="w-3 h-3 mr-1"/> Bobot</Label>
                                        <Input type="number" min="1" value={reward.weight} onChange={(e) => updateReward(reward.id, 'weight', parseInt(e.target.value) || 1)} />
                                    </div>
                                    <Button variant="destructive" size="icon" className="mt-8" onClick={() => removeReward(reward.id)}>
                                        <Trash2 className="w-4 h-4"/>
                                    </Button>
                                </div>
                            ))}
                            <Button variant="outline" className="w-full border-dashed" onClick={addReward}><Plus className="w-4 h-4 mr-2"/> Tambah Hadiah</Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default GatchaSettings;
