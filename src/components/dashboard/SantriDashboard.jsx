
import React, { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BarChart3, BookOpen, CheckCircle as CheckCircleFull, Clock3, Edit, Mic, PlayCircle, Send, Star, Upload, Users, Video, XCircle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BirthdayGreeting from '@/components/BirthdayGreeting';
import HafalanDisplay from '@/components/dashboard/shared/HafalanDisplay';
import SantriAbsensiRecap from '@/components/dashboard/santri/SantriAbsensiRecap';
import SantriPaymentHistory from '@/components/dashboard/santri/SantriPaymentHistory';
import AttendanceDetailsModal from '@/components/dashboard/shared/AttendanceDetailsModal';
import AttendanceStatusIcon from '@/components/dashboard/shared/AttendanceStatusIcon';
import DashboardDisclosure from '@/components/dashboard/shared/DashboardDisclosure';
import SantriDevelopmentProfile from '@/components/dashboard/shared/SantriDevelopmentProfile';
import { buildSessionStartTimestamp, calculateTimeDifference, resolveAttendanceRecordStatus } from '@/utils/AttendanceStatusLogic';
import {
  createMurojaahSubmission,
  DEVELOPMENT_SCORE_OPTIONS,
  fetchHafalanItems,
  fetchMyClassmatesToday,
  getAcademicErrorMessage,
  getDevelopmentScoreMeta,
  getHafalanProgramScope,
  groupHafalanItemsByJilid,
  groupHafalanItemsByTarget,
  PTPT_TAHFIZH_TARGETS,
  progressStatusToComplete
} from '@/lib/academicAdapters';
import { deleteAvatar, getStorageErrorMessage, resolveAvatarUrl, uploadAvatar } from '@/lib/storageAdapters';
import { getSessionName } from '@/utils/sessionMapping';
import { resolveSantriLevel } from '@/lib/santriLevel';
import AvatarPreviewDialog from '@/components/dashboard/shared/AvatarPreviewDialog';

const SantriLevelScene = lazy(() => import('@/components/dashboard/santri/SantriLevelScene'));

/**
 * SANTRI AUTHENTICATION FLOW DOCUMENTATION:
 *
 * 1. Login Trigger: Santri inputs `nama_panggilan` (as username) and `nomor_induk_qiroati` (as password) in LoginPage.jsx.
 * 2. Auth Context: LoginPage calls `signInWithUsername(username, password)` from SupabaseAuthContext.jsx.
 * 3. Auth Call: The context invokes the `signin-with-nomor-induk` Edge Function.
 * 4. Database Logic:
 *    - The function checks the `santri` table.
 *    - It first tries email + password (for Santri Dewasa).
 *    - It falls back to `nama_panggilan` + `nomor_induk_qiroati` (for Santri Anak/TPQ).
 *    - If successful, it generates and returns a custom JWT containing `user_metadata` (role: 'santri', kategori: 'Anak'/'Dewasa').
 * 5. Session Set: SupabaseAuthContext receives the tokens and calls `supabase.auth.setSession()`.
 * 6. Dashboard Access: SantriDashboard reads `user.id` from `useAuth()` to load their profile, attendance, and progress.
 */

// Helper functions for Youtube
const getYoutubeVideoId = (url) => {
  if (!url) return null; let videoId = null;
  try { const urlObj = new URL(url); if (urlObj.hostname === 'youtu.be') videoId = urlObj.pathname.slice(1); else if (urlObj.hostname.includes('youtube.com')) { if (urlObj.pathname.includes('/embed/')) videoId = urlObj.pathname.split('/embed/')[1].split('?')[0]; else videoId = urlObj.searchParams.get('v'); }
  } catch (e) { const embedMatch = url.match(/embed\/([^?&/\s]+)/); if (embedMatch) videoId = embedMatch[1]; }
  return videoId;
};
const getYoutubeThumbnail = (url) => getYoutubeVideoId(url) ? `https://img.youtube.com/vi/${getYoutubeVideoId(url)}/mqdefault.jpg` : "";
const getEmbedUrl = (url) => getYoutubeVideoId(url) ? `https://www.youtube.com/embed/${getYoutubeVideoId(url)}` : null;

// Helper function for Google Drive Embed extraction
const extractSrc = (iframeString) => {
    if (!iframeString) return null;
    const match = iframeString.match(/src=["'](.*?)["']/);
    return match ? match[1] : null;
};

const getGoogleDriveId = (embedCode) => {
    const src = extractSrc(embedCode);
    if (!src) return null;
    const match = src.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
};

const getGoogleDriveThumbnail = (embedCode) => {
    const id = getGoogleDriveId(embedCode);
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w640` : null;
};

const getSessionStartTimestamp = (dateStr, sesiName) => {
    const normalizedSession = getSessionName(sesiName);
    return normalizedSession ? buildSessionStartTimestamp(dateStr, normalizedSession) : null;
};

const scoreToneClasses = {
  slate: 'bg-slate-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500'
};

const HafalanSection = ({
  title,
  category,
  items = [],
  hafalanData = [],
  tone = 'emerald',
  targets = [1, 2, 3, 4, 5, 6],
  titlePrefix = 'Jilid',
  isTahfizh = false
}) => {
  const safeItems = Array.isArray(items) ? items : [];
  const safeHafalanData = Array.isArray(hafalanData) ? hafalanData : [];

  const scoreData = {};
  safeItems.forEach(i => {
      if (!i) return;
      const progress = safeHafalanData.find(h =>
          h && (h.item_id === i.id || (h.category === category && h.item_name === i.item_name))
      );
      scoreData[i.item_name] = progress
          ? Number(progress.score || (progressStatusToComplete(progress.status) ? 4 : 1))
          : null;
  });

  const itemsByJilid = isTahfizh
    ? groupHafalanItemsByTarget(safeItems, targets)
    : groupHafalanItemsByJilid(safeItems);
  const scoredValues = Object.values(scoreData).filter((score) => Number.isInteger(score) && score >= 1 && score <= 4);
  const averageScore = scoredValues.length
    ? scoredValues.reduce((total, score) => total + score, 0) / scoredValues.length
    : 0;
  const averageMeta = averageScore ? getDevelopmentScoreMeta(Math.round(averageScore)) : null;
  const memorizedCount = Object.values(scoreData).filter((score) => Number(score) === 4).length;
  const notMemorizedCount = Math.max(0, safeItems.length - memorizedCount);

  return (
    <DashboardDisclosure
      title={title}
      description={isTahfizh
        ? 'Pantau skor hafalan tahfizh dari Juz 1, 2, 28, 29, dan 30.'
        : `Pantau skor dan capaian hafalan ${title.toLowerCase()} dari seluruh jilid.`}
      icon={BookOpen}
      tone={tone}
      summary={(
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="min-w-[66px] rounded-md bg-muted/60 px-2 py-1.5">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Rata-rata</p>
            <p className="text-sm font-black text-foreground">{averageScore ? averageScore.toFixed(1) : '—'}<span className="text-[10px] text-muted-foreground"> / 4</span></p>
          </div>
          <div className="min-w-[62px] rounded-md bg-emerald-50 px-2 py-1.5 dark:border dark:border-emerald-400/25 dark:bg-slate-900/70">
            <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">Hafal</p>
            <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">{memorizedCount}</p>
          </div>
          <div className="min-w-[72px] rounded-md bg-amber-50 px-2 py-1.5 dark:bg-amber-950/30">
            <p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">Belum</p>
            <p className="text-sm font-black text-amber-700 dark:text-amber-300">{notMemorizedCount}</p>
          </div>
        </div>
      )}
    >
      <div className="mb-5 grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {DEVELOPMENT_SCORE_OPTIONS.map((option) => (
          <div key={option.score} className="flex items-start gap-2.5">
            <span className={cn('mt-1.5 h-2.5 w-2.5 flex-none rounded-full', scoreToneClasses[option.tone])} aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-foreground">{option.score} · {option.code}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{option.label}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-semibold text-foreground">{isTahfizh ? 'Rincian per target juz' : 'Rincian per jilid'}</p>
        <p className="text-muted-foreground">
          {averageMeta ? `Capaian saat ini: ${averageMeta.code} · ${averageMeta.label}` : 'Belum ada skor dari guru'}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {targets.map((jilid) => (
          <HafalanDisplay
            key={jilid}
            jilid={jilid}
            titlePrefix={titlePrefix}
            items={itemsByJilid[jilid]}
            isDraggable={false}
            scoreData={scoreData}
          />
        ))}
      </div>
    </DashboardDisclosure>
  );
};

const MurojaahRecorder = ({ santriId, hafalanItems, onSubmissionSuccess, isAdult }) => {
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedItem, setSelectedItem] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const categories = [...new Set(hafalanItems.map(i => i.category))];
    const filteredItems = [...new Set(hafalanItems.filter(i => i.category === selectedCategory).map(i => i.item_name))];

    useEffect(() => {
      if (!categories.length || categories.includes(selectedCategory)) return;
      setSelectedCategory(categories[0]);
      setSelectedItem('');
    }, [categories, selectedCategory]);

    const handleSend = () => {
        if(!selectedItem) return;
        setIsUploading(true);
        setTimeout(async () => {
            let error = null;
            try {
                await createMurojaahSubmission({
                    santriId,
                    type: selectedCategory,
                    content: selectedItem,
                    userId: santriId
                });
            } catch (err) {
                error = err;
            }
            setIsUploading(false);
            if (error) {
                toast({ title: 'Gagal', description: getAcademicErrorMessage(error), variant: 'destructive'});
            } else {
                setSelectedItem('');
                toast({ title: 'Berhasil', description: 'Setoran hafalan berhasil dikirim!'});
                if (onSubmissionSuccess) onSubmissionSuccess();
            }
        }, 1000);
    };

    return (<Card className={cn("lg:col-span-1", isAdult ? "bg-white/80 dark:bg-black/40 border-purple-500/30 backdrop-blur-sm text-gray-800 dark:text-white" : "")}><CardHeader><CardTitle className={cn("flex items-center gap-2", isAdult ? "text-purple-700 dark:text-purple-300" : "text-primary")}><Mic className="w-6 h-6"/> Pojok Muroja'ah</CardTitle></CardHeader><CardContent className="space-y-4"><Select value={selectedCategory} onValueChange={setSelectedCategory}><SelectTrigger className={isAdult ? "bg-white dark:bg-black/50 border-gray-300 dark:border-purple-500/30 text-gray-900 dark:text-white" : ""}><SelectValue placeholder="Pilih Kategori" /></SelectTrigger><SelectContent>{categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select><Select value={selectedItem} onValueChange={setSelectedItem}><SelectTrigger className={isAdult ? "bg-white dark:bg-black/50 border-gray-300 dark:border-purple-500/30 text-gray-900 dark:text-white" : ""}><SelectValue placeholder="Pilih Hafalan" /></SelectTrigger><SelectContent>{filteredItems.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><div className="flex justify-center gap-4"><Button onClick={handleSend} size="lg" disabled={isUploading || !selectedItem} className={isAdult ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}>{isUploading ? 'Mengirim...' : <><Send className="w-4 h-4 mr-2"/> Kirim Setoran</>}</Button></div></CardContent></Card>);
};

const classmateAttendanceMeta = (status) => {
    if (status === 'Hadir') {
        return { label: 'Hadir', Icon: CheckCircleFull, tone: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-950/30 dark:text-emerald-200' };
    }
    if (status === 'Terlambat') {
        return { label: 'Terlambat', Icon: Clock3, tone: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200' };
    }
    if (status && status !== 'Belum Hadir') {
        return { label: status, Icon: XCircle, tone: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200' };
    }
    return { label: 'Belum Hadir', Icon: Clock3, tone: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300' };
};

const ClassmatesList = ({ classmates, loading, error, onRetry }) => (
    <Card className="overflow-hidden border border-white/70 bg-white/80 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75">
        <CardHeader className="border-b border-blue-100/80 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-violet-500/10 dark:border-white/10">
            <CardTitle className="flex items-center gap-2 text-lg text-[#112D4E] dark:text-white">
                <Users className="h-5 w-5 text-blue-500" />
                Manajemen Kelas & Absensi Hari Ini
            </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
            {loading ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" aria-label="Memuat teman sekelas">
                    {[0, 1, 2].map((item) => <div key={item} className="h-[72px] animate-pulse rounded-lg border border-slate-200/70 bg-slate-100/80 dark:border-white/10 dark:bg-slate-900/70" />)}
                </div>
            ) : error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-5 text-center dark:border-rose-400/25 dark:bg-rose-950/25" role="alert">
                    <p className="font-semibold text-rose-800 dark:text-rose-200">Data teman sekelas belum dapat dimuat.</p>
                    <p className="mt-1 text-sm text-rose-700/80 dark:text-rose-300/80">{error}</p>
                    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>Coba lagi</Button>
                </div>
            ) : (
                <ul className="grid max-h-[300px] grid-cols-1 gap-3 overflow-y-auto pr-1 custom-scrollbar md:grid-cols-2 lg:grid-cols-3" aria-label="Teman satu kelas">
                    {classmates.length > 0 ? classmates.map((friend) => {
                        const attendance = classmateAttendanceMeta(friend.attendance_status);
                        const StatusIcon = attendance.Icon;
                        return (
                            <li key={friend.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-white/80 bg-white/75 p-3 shadow-[4px_4px_12px_rgba(15,23,42,0.08),-4px_-4px_12px_rgba(255,255,255,0.8)] transition-shadow hover:shadow-md dark:border-white/10 dark:bg-slate-900/70 dark:shadow-none">
                                <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                    <AvatarImage src={friend.foto_url} />
                                    <AvatarFallback>{friend?.nama_lengkap?.charAt(0) || 'S'}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{friend.nama_lengkap}</p>
                                    <p className="truncate text-xs text-muted-foreground">{friend.jilid}</p>
                                </div>
                                <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold', attendance.tone)}>
                                    <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                    {attendance.label}
                                </span>
                            </li>
                        );
                    }) : (
                        <li className="col-span-full rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center dark:border-white/15 dark:bg-slate-900/50">
                            <Users className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
                            <p className="mt-2 font-semibold text-foreground">Belum ada teman sekelas.</p>
                            <p className="mt-1 text-sm text-muted-foreground">Teman yang aktif di kelas yang sama akan tampil di sini.</p>
                        </li>
                    )}
                </ul>
            )}
        </CardContent>
    </Card>
);

const EditProfileDialog = ({ isOpen, onOpenChange, santri, onUpdate }) => {
    const [formData, setFormData] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const photoInputRef = React.useRef(null);

    useEffect(() => {
        if (santri) setFormData(santri);
    }, [santri]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const { path, signedUrl } = await uploadAvatar({ ownerType: 'santri', ownerId: santri.id, file });
            setFormData(prev => ({ ...prev, avatar_path: path, foto_url: signedUrl || prev.foto_url }));
            toast({ title: "Foto Berhasil Diupload", description: "Foto profil tersimpan di Storage dan tetap tampil setelah refresh." });
        } catch (error) {
            toast({ title: "Gagal Upload Foto", description: getStorageErrorMessage(error), variant: "destructive" });
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleDeletePhoto = async () => {
        setIsUploading(true);
        try {
            await deleteAvatar({ ownerType: 'santri', ownerId: santri.id });
            setFormData(prev => ({ ...prev, avatar_path: null, foto_url: '' }));
            toast({ title: "Foto Dihapus", description: "Foto profil Anda telah dihapus dari Storage." });
        } catch (error) {
            toast({ title: "Gagal Hapus Foto", description: getStorageErrorMessage(error), variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        const { nama_panggilan, password, points, jilid, sesi_mengaji, nomor_induk_qiroati, class: classObj, id_kelas, ...allowedData } = formData;
        const { error } = await supabase.from('santri').update(allowedData).eq('id', santri.id);
        setIsSaving(false);
        if (error) toast({ title: "Gagal", description: error.message, variant: "destructive" });
        else { toast({ title: "Berhasil", description: "Profil berhasil diperbarui." }); onUpdate(); onOpenChange(false); }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Edit Profil Santri</DialogTitle><DialogDescription>Perbarui data detail santri.</DialogDescription></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    <div className="col-span-full bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <Avatar className="w-24 h-24 border-4 border-white shadow-md"><AvatarImage src={formData.foto_url} /><AvatarFallback>{formData.nama_lengkap?.charAt(0)}</AvatarFallback></Avatar>
                            <div className="space-y-2 flex-1">
                                <h4 className="fontsemibold text-sm text-blue-800 dark:text-blue-300">Ganti Foto Profil</h4>
                                <div className="text-xs text-muted-foreground space-y-1"><p>Pastikan wajah Anda terlihat jelas.</p><p className="font-semibold text-orange-600">Foto hingga 12 MB dikompres otomatis menjadi WebP.</p></div>
                                <div className="flex flex-wrap gap-2 mt-2"><Button type="button" size="sm" variant="outline" onClick={() => photoInputRef.current?.click()} disabled={isUploading}><Upload className="w-4 h-4 mr-2" /> {isUploading ? 'Mengupload...' : 'Pilih Foto'}</Button><Button type="button" size="sm" variant="outline" onClick={handleDeletePhoto} disabled={isUploading || !formData.foto_url}>Hapus Foto</Button><input type="file" ref={photoInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} /></div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Nama Lengkap</label><Input name="nama_lengkap" value={formData.nama_lengkap || ''} onChange={handleChange} /></div>
                    <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Nama Panggilan (Username)</label><Input value={formData.nama_panggilan || ''} disabled className="bg-muted" /></div>
                    <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Tempat Lahir</label><Input name="tempat_lahir" value={formData.tempat_lahir || ''} onChange={handleChange} /></div>
                    <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Tanggal Lahir</label><Input type="date" name="tanggal_lahir" value={formData.tanggal_lahir || ''} onChange={handleChange} /></div>
                    <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Nama Ayah</label><Input name="nama_ayah" value={formData.nama_ayah || ''} onChange={handleChange} /></div>
                    <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Nama Ibu</label><Input name="nama_ibu" value={formData.nama_ibu || ''} onChange={handleChange} /></div>
                    <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">No. HP Wali</label><Input name="no_hp_ortu" value={formData.no_hp_ortu || ''} onChange={handleChange} /></div>
                    <div className="space-y-2 col-span-full"><label className="text-xs font-medium text-muted-foreground">Alamat</label><Textarea name="alamat" value={formData.alamat || ''} onChange={handleChange} /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const SantriDashboard = ({ isAdult = false }) => {
  const { user } = useAuth();
  const [santriData, setSantriData] = useState(null);
  const [hafalan, setHafalan] = useState([]);
  const [murojaahSubmissions, setMurojaahSubmissions] = useState([]);
  const [hafalanItems, setHafalanItems] = useState([]);
  const [videos, setVideos] = useState([]);
  const [levelConfig, setLevelConfig] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [isHafalanModalOpen, setIsHafalanModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
  const [dailyAttendance, setDailyAttendance] = useState([]);
  const [classmates, setClassmates] = useState([]);
  const [classmatesState, setClassmatesState] = useState({ loading: true, error: '' });

  // Own Attendance modal state
  const [myAttendanceRecord, setMyAttendanceRecord] = useState(null);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  const initializeData = useCallback(async () => {
    if (!user) return;

    const [santriResult, itemsResult, videosResult, levelConfigResult] = await Promise.all([
        supabase.from('santri').select('*, class:current_class_id(*, guru:id_guru(nama))').eq('id', user.id).single(),
        fetchHafalanItems(),
        supabase.from('website_content').select('content').eq('key', 'hafalanVideos').maybeSingle(),
        supabase.from('website_content').select('content').eq('key', 'level_config').maybeSingle()
    ]);

        if (santriResult.data) {
        const foto_url = await resolveAvatarUrl({
            ownerType: 'santri',
            ownerId: santriResult.data.id,
            avatarPath: santriResult.data.avatar_path,
            fallbackUrl: santriResult.data.foto_url,
        });
        const santri = { ...santriResult.data, foto_url, id_kelas: santriResult.data.current_class_id };
        setSantriData(santri);

        const todayStr = new Date().toLocaleDateString('en-CA');

        const [hafalanData, submissionsData, attendanceData] = await Promise.all([
            supabase.from('hafalan_progress').select('*').eq('santri_id', santri.id),
            supabase.from('murojaah_submissions').select('id,santri_id,type,content,recording_path,status,feedback,submitted_at,reviewed_at,created_at').eq('santri_id', santri.id).order('created_at', { ascending: false }),
            supabase.from('attendance').select('*').eq('attendance_date', todayStr).eq('user_id', santri.id)
        ]);

        if (hafalanData.data) setHafalan(hafalanData.data);
        if (submissionsData.data) setMurojaahSubmissions(submissionsData.data);
        if (attendanceData.data) {
            setDailyAttendance(attendanceData.data.map(a => a.user_id));
            if (attendanceData.data.length > 0) {
                setMyAttendanceRecord(attendanceData.data[0]);
            } else {
                setMyAttendanceRecord(null);
            }
        }

        setClassmatesState({ loading: true, error: '' });
        if (santri.current_class_id) {
            try {
                const classmateRows = await fetchMyClassmatesToday();
                const classmatesWithAvatars = await Promise.all(classmateRows.map(async (friend) => {
                    const friendAvatar = await resolveAvatarUrl({
                        ownerType: 'santri',
                        ownerId: friend.id,
                        avatarPath: friend.avatar_path,
                        fallbackUrl: friend.foto_url,
                    });
                    return { ...friend, foto_url: friendAvatar };
                }));
                setClassmates(classmatesWithAvatars);
                setClassmatesState({ loading: false, error: '' });
            } catch (classmatesError) {
                setClassmates([]);
                setClassmatesState({ loading: false, error: getAcademicErrorMessage(classmatesError) });
            }
        } else {
            setClassmates([]);
            setClassmatesState({ loading: false, error: '' });
        }
    }
    if (Array.isArray(itemsResult)) {
      const programScope = getHafalanProgramScope(santriResult.data);
      setHafalanItems(itemsResult.filter((item) => item.program_scope === programScope));
    }
    if (videosResult.data?.content) setVideos(videosResult.data.content);
    else setVideos([]);
    setLevelConfig(levelConfigResult.data?.content || null);
  }, [user]);

  useEffect(() => { initializeData(); }, [initializeData]);

  const openMyAttendanceModal = () => {
      setIsAttendanceModalOpen(true);
  };

  if (!santriData) return <div className="p-8 text-center text-muted-foreground">Memuat data santri...</div>;

  const jilidVideos = videos.reduce((acc, video) => { const jilid = video.jilid || 'Lainnya'; if (!acc[jilid]) acc[jilid] = []; acc[jilid].push(video); return acc; }, {});
  const hasAttendedToday = dailyAttendance.includes(santriData.id);
  const sessionName = getSessionName(santriData.sesi_mengaji || santriData.class?.sesi) || '-';
  const levelInfo = resolveSantriLevel({ points: santriData.points, gender: santriData.jenis_kelamin, config: levelConfig });

  const attendanceSessionName = myAttendanceRecord?.attended_session || sessionName;
  const attendanceSessionStart = getSessionStartTimestamp(new Date().toLocaleDateString('en-CA'), attendanceSessionName);
  const myStatus = myAttendanceRecord
    ? resolveAttendanceRecordStatus(myAttendanceRecord, attendanceSessionStart)
    : 'Tidak Hadir';

  const myAttendanceDetails = {
      id: myAttendanceRecord?.id,
      user_id: santriData.id,
      user_role: 'santri',
      status: myStatus,
      attendance_date: new Date().toLocaleDateString('en-CA'),
      sesi: sessionName,
      attended_session: attendanceSessionName,
      class_id: santriData.id_kelas,
      checkInTimestamp: myAttendanceRecord?.check_in_timestamp,
      sessionStartTime: attendanceSessionStart,
      lateMinutes: myAttendanceRecord ? calculateTimeDifference(myAttendanceRecord.check_in_timestamp, attendanceSessionStart) : 0
  };

  return (
    <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        <BirthdayGreeting user={santriData} type="Santri" />
        <h1 className="text-3xl md:text-4xl font-bold text-[#112D4E] dark:text-white mb-8 flex items-center justify-between font-cinzel">
            Dashboard Santri
        </h1>
        <section className="relative mb-8 overflow-hidden rounded-2xl border border-white/80 bg-slate-100 text-slate-900 shadow-[14px_14px_32px_rgba(15,23,42,0.16),-12px_-12px_28px_rgba(255,255,255,0.92)] dark:border-white/10 dark:bg-slate-950 dark:text-white dark:shadow-[14px_14px_32px_rgba(0,0,0,0.5),-10px_-10px_26px_rgba(30,41,59,0.3)]">
          <Suspense fallback={null}><SantriLevelScene accentColor={levelInfo.accentColor} points={santriData.points} /></Suspense>
          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: levelInfo.accentColor }} />
          <div className="relative z-10 grid gap-7 p-5 sm:p-7 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:p-8">
            <div className="flex justify-center lg:justify-start">
              <div className="rounded-full bg-slate-100 p-2 shadow-[inset_5px_5px_12px_rgba(15,23,42,0.12),inset_-5px_-5px_12px_rgba(255,255,255,0.9)] dark:bg-slate-900 dark:shadow-[inset_5px_5px_12px_rgba(0,0,0,0.45),inset_-5px_-5px_12px_rgba(51,65,85,0.28)]">
                <button type="button" onClick={() => setIsAvatarPreviewOpen(true)} className="block rounded-full transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" aria-label="Lihat foto profil santri">
                  <Avatar className="h-28 w-28 border-4 border-white bg-slate-100 shadow-xl dark:border-slate-700 sm:h-32 sm:w-32">
                    <AvatarImage src={santriData?.foto_url} className="object-cover" />
                    <AvatarFallback className="bg-slate-200 text-3xl font-black text-slate-700 dark:bg-slate-800 dark:text-white">{santriData?.nama_lengkap?.charAt(0) || 'S'}</AvatarFallback>
                  </Avatar>
                </button>
              </div>
            </div>

            <div className="min-w-0 text-center lg:text-left">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em]" style={{ color: levelInfo.textColor }}>Profil belajar santri</p>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{santriData.nama_lengkap}</h2>
              <p className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground sm:text-base lg:justify-start">
                <Users className="h-4 w-4" /> {santriData.class?.nama_kelas || 'Belum masuk kelas'}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:max-w-xl sm:grid-cols-4">
                {[
                  [getHafalanProgramScope(santriData) === 'PTPT' ? 'Target' : 'Jilid', santriData.jilid || '-'],
                  ['Poin', santriData.points || 0],
                  ['Level', levelInfo.name],
                  ['Sesi', sessionName],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-md border border-white/80 bg-slate-100/90 px-3 py-2.5 shadow-[inset_3px_3px_7px_rgba(15,23,42,0.1),inset_-3px_-3px_7px_rgba(255,255,255,0.9)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/85 dark:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.4),inset_-3px_-3px_7px_rgba(51,65,85,0.24)]">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
                    <p className="mt-0.5 truncate text-sm font-black sm:text-base" title={String(value)}>{label === 'Poin' ? <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{value}</span> : value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[190px] lg:grid-cols-1">
              <Button onClick={() => setIsInfoModalOpen(true)} variant="outline" className="border-white/80 bg-slate-100 shadow-[5px_5px_12px_rgba(15,23,42,0.12),-5px_-5px_12px_rgba(255,255,255,0.9)] transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary hover:text-primary-foreground dark:border-white/10 dark:bg-slate-900 dark:hover:border-primary dark:hover:bg-primary dark:hover:text-primary-foreground"><Edit className="mr-2 h-4 w-4" /> Edit Profil</Button>
              <button
                type="button"
                onClick={openMyAttendanceModal}
                className={cn(
                  'lpq-shiny-button flex min-h-10 items-center justify-center gap-3 rounded-md px-4 py-2 text-sm font-semibold shadow-md transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  hasAttendedToday ? 'bg-emerald-600 text-white hover:bg-emerald-700 dark:border dark:border-emerald-400/40 dark:bg-slate-800 dark:hover:bg-slate-700' : 'bg-slate-800 text-white hover:bg-slate-700'
                )}
              >
                <AttendanceStatusIcon status={myStatus} className="pointer-events-none" />
                <span className="flex flex-col text-left leading-tight">
                  <span className="text-[10px] uppercase opacity-80">Absen hari ini</span>
                  <span>{hasAttendedToday ? myStatus : 'Belum Absen'}</span>
                </span>
              </button>
            </div>
          </div>
        </section>
        <Tabs defaultValue="overview" className="space-y-6">
            <div className="no-scrollbar overflow-x-auto pb-1">
              <TabsList className="h-auto min-w-max rounded-lg bg-white p-1 shadow-sm dark:border dark:border-white/10 dark:bg-slate-950/80">
                <TabsTrigger value="overview" className="whitespace-nowrap">Ringkasan</TabsTrigger>
                <TabsTrigger value="attendance" className="whitespace-nowrap">Rekap Absensi</TabsTrigger>
                <TabsTrigger value="payments" className="whitespace-nowrap">Riwayat Pembayaran</TabsTrigger>
                <TabsTrigger value="learning" className="whitespace-nowrap">Muroja'ah & Video</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview">
                 <div className="space-y-6">
                   <ClassmatesList classmates={classmates} loading={classmatesState.loading} error={classmatesState.error} onRetry={initializeData} />
                   <div className="space-y-4">
                     <div className="flex items-end justify-between gap-4">
                       <div>
                         <p className="text-xs font-bold uppercase tracking-wider text-primary">Perkembangan belajar</p>
                         <h2 className="mt-1 text-xl font-black text-foreground sm:text-2xl">Progres hafalan dan karakter</h2>
                       </div>
                       <BarChart3 className="hidden h-7 w-7 text-primary/60 sm:block" aria-hidden="true" />
                     </div>
                     {getHafalanProgramScope(santriData) === 'PTPT' ? (
                       <HafalanSection
                         title="Tahfizh PTPT"
                         category="Tahfizh"
                         items={(Array.isArray(hafalanItems) ? hafalanItems : []).filter(i => i && i.category === 'Tahfizh')}
                         hafalanData={hafalan}
                         tone="violet"
                         targets={PTPT_TAHFIZH_TARGETS}
                         titlePrefix=""
                         isTahfizh
                       />
                     ) : (
                       <>
                         <HafalanSection title="Do'a" category="Doa" items={(Array.isArray(hafalanItems) ? hafalanItems : []).filter(i => i && i.category === 'Doa')} hafalanData={hafalan} tone="emerald" />
                         <HafalanSection title="Sholat" category="Sholat" items={(Array.isArray(hafalanItems) ? hafalanItems : []).filter(i => i && i.category === 'Sholat')} hafalanData={hafalan} tone="sky" />
                         <HafalanSection title="Surat" category="Surat" items={(Array.isArray(hafalanItems) ? hafalanItems : []).filter(i => i && i.category === 'Surat')} hafalanData={hafalan} tone="violet" />
                       </>
                     )}
                     <SantriDevelopmentProfile santriId={santriData.id} editable={false} collapsible />
                   </div>
                 </div>
             </TabsContent>

            <TabsContent value="attendance">
                <SantriAbsensiRecap />
            </TabsContent>

            <TabsContent value="payments">
                <SantriPaymentHistory />
            </TabsContent>

            <TabsContent value="learning">
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">Ruang belajar mandiri</p>
                  <h2 className="mt-1 text-xl font-black text-foreground sm:text-2xl">Muroja'ah dan video hafalan</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Kirim setoran hafalan dan buka video panduan tanpa memenuhi halaman ringkasan.</p>
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <MurojaahRecorder santriId={santriData.id} hafalanItems={hafalanItems} onSubmissionSuccess={() => initializeData()} isAdult={false} />
                  <Card className="group overflow-hidden border-none bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-700 text-white shadow-xl">
                    <CardContent className="flex min-h-[250px] flex-col items-start justify-between p-7 sm:p-8">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/20 bg-white/15 backdrop-blur-sm"><PlayCircle className="h-7 w-7" /></div>
                      <div className="mt-10">
                        <h3 className="text-2xl font-black">Video Hafalan</h3>
                        <p className="mt-2 max-w-md text-sm leading-relaxed text-indigo-100">Tonton panduan sesuai jilid untuk menemani latihan di rumah.</p>
                        <Button type="button" onClick={() => setIsHafalanModalOpen(true)} className="mt-5 bg-white text-indigo-700 hover:bg-indigo-50">Buka Video</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
        </Tabs>

        <EditProfileDialog isOpen={isInfoModalOpen} onOpenChange={setIsInfoModalOpen} santri={santriData} onUpdate={initializeData} />
        <AvatarPreviewDialog open={isAvatarPreviewOpen} onOpenChange={setIsAvatarPreviewOpen} imageUrl={santriData.foto_url} name={santriData.nama_lengkap} description="Foto profil santri yang sedang digunakan." />

        <Dialog open={isHafalanModalOpen} onOpenChange={setIsHafalanModalOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Video Hafalan Santri</DialogTitle><DialogDescription>Pilih kategori video hafalan yang ingin ditonton.</DialogDescription></DialogHeader>
                <Tabs defaultValue="Jilid 1" className="w-full">
                    <div className="overflow-x-auto pb-2"><TabsList>{Object.keys(jilidVideos).sort().map(jilid => (<TabsTrigger key={jilid} value={jilid}>{jilid}</TabsTrigger>))}</TabsList></div>
                    {Object.keys(jilidVideos).sort().map(jilid => (
                        <TabsContent key={jilid} value={jilid}>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto p-1">
                                {jilidVideos[jilid].map(video => (
                                    <div key={video.id} onClick={() => setPlayingVideo(video)} className="cursor-pointer group space-y-2">
                                        <div className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                                            {video.google_drive_embed ? (<div className="w-full h-full bg-indigo-50 dark:bg-slate-800 flex items-center justify-center relative overflow-hidden"><div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center"><div className="bg-white dark:bg-black/20 p-3 rounded-full mb-2"><Video className="w-8 h-8 text-indigo-500" /></div><span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">Google Drive Video</span></div>{getGoogleDriveThumbnail(video.google_drive_embed) && (<img src={getGoogleDriveThumbnail(video.google_drive_embed)} alt={video.title} className="w-full h-full object-cover relative z-10" onError={(e) => e.target.style.display = 'none'} />)}<div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center z-20 transition-colors"><PlayCircle className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" /></div></div>) : (<><img src={getYoutubeThumbnail(video.url)} alt={video.title} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><PlayCircle className="w-12 h-12 text-white/80" /></div></>)}
                                        </div>
                                        <p className="font-semibold text-center text-sm truncate px-2" title={video.title}>{video.title}</p>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            </DialogContent>
        </Dialog>
        {playingVideo && (<Dialog open={!!playingVideo} onOpenChange={() => setPlayingVideo(null)}><DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none"><div className="aspect-video w-full h-full relative">{playingVideo.google_drive_embed ? (<iframe className="w-full h-full" src={extractSrc(playingVideo.google_drive_embed)} title={playingVideo.title} allow="autoplay" allowFullScreen></iframe>) : (<iframe className="w-full h-full" src={getEmbedUrl(playingVideo.url)} title={playingVideo.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>)}</div></DialogContent></Dialog>)}

        <AttendanceDetailsModal isOpen={isAttendanceModalOpen} onClose={() => setIsAttendanceModalOpen(false)} details={myAttendanceDetails} onSuccess={initializeData} />
    </div>
  );
};
export default SantriDashboard;
