import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Upload, Music, Settings as SettingsIcon } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import { motion } from 'framer-motion';

const MEDIA_SETTINGS_TABS = [
    { id: 'playlist', label: 'Playlist & Upload', icon: Music },
    { id: 'settings', label: 'Pengaturan Player', icon: SettingsIcon },
];

const MediaPlayerSettings = ({
    isOpen,
    onOpenChange,
    onUpdate,
    isShuffle,
    isLoop,
    isCrossfade,
    onToggleShuffle,
    onToggleLoop,
    onToggleCrossfade,
}) => {
    const [activeTab, setActiveTab] = useState('playlist');
    const [uploading, setUploading] = useState(false);
    const [playlist, setPlaylist] = useState([]);

    // File Upload State
    const [selectedFile, setSelectedFile] = useState(null);
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');

    // Delete Confirmation State
    const [deleteConfirmation, setDeleteConfirmation] = useState({
        isOpen: false,
        trackId: null,
        trackName: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchPlaylist();
        }
    }, [isOpen]);

    const fetchPlaylist = async () => {
        const { data, error } = await supabase
            .from('music_files')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        if (error) {
            setPlaylist([]);
            return;
        }
        setPlaylist(data || []);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            // Auto-fill title from filename
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            if (!title) setTitle(nameWithoutExt);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !title) {
            toast({ title: "Error", description: "Pilih file dan isi judul lagu.", variant: "destructive" });
            return;
        }

        setUploading(true);
        try {
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `playlist/${fileName}`;

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage.from('music-files').upload(filePath, selectedFile);
            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage.from('music-files').getPublicUrl(filePath);

            // 3. Save to DB
            const { error: dbError } = await supabase.from('music_files').insert({
                title,
                artist: artist || 'Unknown Artist',
                filename: selectedFile.name,
                storage_path: filePath,
                file_url: publicUrl
            });

            if (dbError) throw dbError;

            toast({ title: "Berhasil", description: "Lagu berhasil ditambahkan." });
            setSelectedFile(null);
            setTitle('');
            setArtist('');
            fetchPlaylist();
            if(onUpdate) onUpdate();
        } catch (error) {
            toast({ title: "Gagal", description: error.message || "Gagal mengupload lagu.", variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteClick = (track) => {
        setDeleteConfirmation({
            isOpen: true,
            trackId: track.id,
            trackName: track.title
        });
    };

    const handleConfirmDelete = async () => {
        const { trackId } = deleteConfirmation;
        if (!trackId) return;

        try {
            const { error } = await supabase.from('music_files').update({ is_active: false }).eq('id', trackId);
            if (error) throw error;

            toast({ title: "Terhapus", description: "Lagu dihapus dari playlist." });
            fetchPlaylist();
            if(onUpdate) onUpdate();
        } catch (error) {
            toast({ title: "Gagal", description: error.message, variant: "destructive" });
        } finally {
            setDeleteConfirmation({ isOpen: false, trackId: null, trackName: '' });
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="media-settings-glass max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader className="media-settings-glass__header">
                        <DialogTitle>Pengaturan Media Player</DialogTitle>
                        <DialogDescription>Kelola playlist dan pengaturan pemutar musik.</DialogDescription>
                    </DialogHeader>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
                        <div className="media-settings-glass__tabs" role="tablist" aria-label="Pengaturan media player">
                            {MEDIA_SETTINGS_TABS.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        className={`media-settings-glass__tab ${isActive ? 'is-active' : ''}`}
                                        onClick={() => setActiveTab(tab.id)}
                                    >
                                        {isActive && (
                                            <motion.span
                                                layoutId="media-settings-active-pill"
                                                className="media-settings-glass__tab-pill"
                                                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                            />
                                        )}
                                        <span className="media-settings-glass__tab-label">
                                            <Icon className="w-4 h-4" />
                                            {tab.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <TabsContent value="playlist" className="flex-1 overflow-hidden flex flex-col space-y-4 pt-4">
                            <Card className="media-settings-glass__panel shrink-0">
                                <CardContent className="pt-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Judul Lagu</Label>
                                            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Murottal Juz 30" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Artis / Qori</Label>
                                            <Input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Contoh: Mishary Rashid" />
                                        </div>
                                    </div>
                                    <div className="flex gap-4 items-end">
                                        <div className="flex-1 space-y-2">
                                            <Label>File Audio (MP3/WAV)</Label>
                                            <Input type="file" accept="audio/*" onChange={handleFileChange} />
                                        </div>
                                        <Button onClick={handleUpload} disabled={uploading}>
                                            {uploading ? <span className="animate-pulse">Uploading...</span> : <><Upload className="w-4 h-4 mr-2"/> Upload</>}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="media-settings-glass__playlist flex-1 min-h-[200px] rounded-2xl relative overflow-hidden">
                                 <ScrollArea className="h-full w-full p-4">
                                    {playlist.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                                            <Music className="w-12 h-12 mb-2 opacity-20" />
                                            <p>Belum ada lagu di playlist.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {playlist.map((track) => (
                                                <div key={track.id} className="media-settings-glass__track flex items-center justify-between p-3 rounded-xl transition-all">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="media-settings-glass__track-icon p-2 rounded-full">
                                                            <Music className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-medium truncate">{track.title}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteClick(track)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        </TabsContent>

                        <TabsContent value="settings" className="pt-4 space-y-4">
                            <Card className="media-settings-glass__panel">
                                <CardContent className="pt-6 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Shuffle Default</Label>
                                            <p className="text-sm text-muted-foreground">Aktifkan mode acak secara default saat player dimuat.</p>
                                        </div>
                                        <Switch checked={Boolean(isShuffle)} onCheckedChange={(checked) => { if (checked !== isShuffle) onToggleShuffle?.(); toast({ title: "Shuffle diperbarui", description: checked ? "Urutan lagu akan diacak." : "Playlist kembali berurutan." }); }} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Loop Default</Label>
                                            <p className="text-sm text-muted-foreground">Ulangi playlist secara otomatis.</p>
                                        </div>
                                        <Switch checked={Boolean(isLoop)} onCheckedChange={(checked) => { if (checked !== isLoop) onToggleLoop?.(); toast({ title: "Loop diperbarui", description: checked ? "Playlist akan diputar berulang." : "Playlist berhenti di lagu terakhir." }); }} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Crossfade</Label>
                                            <p className="text-sm text-muted-foreground">Transisi halus antar lagu (efek fade-out/fade-in).</p>
                                        </div>
                                        <Switch checked={Boolean(isCrossfade)} onCheckedChange={(checked) => { if (checked !== isCrossfade) onToggleCrossfade?.(); toast({ title: "Crossfade diperbarui", description: checked ? "Transisi antar lagu dibuat lebih halus." : "Transisi lagu kembali langsung." }); }} />
                                    </div>
                                </CardContent>
                            </Card>
                            <div className="media-settings-glass__note p-4 rounded-xl text-sm">
                                Pengaturan aktif langsung pada Media Player dan tersimpan untuk browser perangkat ini.
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            <ConfirmationDialog
                open={deleteConfirmation.isOpen}
                onOpenChange={(open) => setDeleteConfirmation(prev => ({ ...prev, isOpen: open }))}
                title="Hapus Lagu"
                description={`Apakah Anda yakin ingin menghapus lagu "${deleteConfirmation.trackName}"? Tindakan ini tidak dapat dibatalkan.`}
                onConfirm={handleConfirmDelete}
                confirmText="Hapus"
                cancelText="Batal"
                variant="destructive"
            />
        </>
    );
};

export default MediaPlayerSettings;
