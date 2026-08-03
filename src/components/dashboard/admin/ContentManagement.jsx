import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Edit, Trophy, Star, Sun, Moon, Video, Users, BookCopy, MessageSquare, FileText, Library, Building, Mail, Info, Image as ImageIcon, CalendarClock, HelpCircle, Home, Heart, Save } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { RotateCcw, ClipboardList, GripVertical, PlusCircle, MinusCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { motion } from 'framer-motion';
import HafalanDisplay from '@/components/dashboard/shared/HafalanDisplay';
import { createHafalanItem, deactivateHafalanItem, fetchHafalanItems, getAcademicErrorMessage, updateHafalanItem } from '@/lib/academicAdapters';
import { getStorageErrorMessage, uploadWebsiteAsset } from '@/lib/storageAdapters';
import { createDefaultEnrollmentData, prepareEnrollmentDataForSave } from '@/lib/enrollmentContent';
import { defaultContent, mergeHomepageContent } from '@/components/public/home/homeUtils';
import {
  archiveAnnouncement,
  archiveNews,
  deleteFeedback,
  fetchAdminAnnouncements,
  fetchAdminFeedbacks,
  fetchAdminNews,
  getPublicContentErrorMessage,
  assertNonEmptyWebsiteContentString,
  saveAnnouncement,
  saveNews,
  saveWebsiteContentItem,
  saveWebsiteContentItems,
  slugify
} from '@/lib/publicContentAdapters';

const TPQ_LEVELS = [1, 2, 3, 4, 5, 6].map(String);
const PTPT_LEVELS = ['Juz 1', 'Juz 2', 'Juz 28', 'Juz 29', 'Juz 30'];

const HafalanItemManager = ({
  category,
  programScope = 'TPQ',
  title = category,
  levels = TPQ_LEVELS,
  levelPrefix = 'Jilid'
}) => {
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [targetJilid, setTargetJilid] = useState(String(levels[0]));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [category, programScope]);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const data = await fetchHafalanItems(category, programScope);
      setItems(data || []);
    } catch (error) {
      toast({ title: "Gagal memuat item hafalan", description: getAcademicErrorMessage(error), variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    try {
      await createHafalanItem({
        category,
        programScope,
        itemName: newItemName,
        itemOrder: items.length + 1,
        jilid: targetJilid
      });
      setNewItemName('');
      fetchItems();
      toast({ title: "Berhasil", description: "Item hafalan baru ditambahkan." });
    } catch (error) {
      toast({ title: "Gagal menambah item", description: getAcademicErrorMessage(error), variant: "destructive" });
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Yakin ingin menghapus item ini?')) return;
    try {
      await deactivateHafalanItem(id);
      fetchItems();
      toast({ title: "Berhasil", description: "Item hafalan telah dinonaktifkan." });
    } catch (error) {
      toast({ title: "Gagal menghapus item", description: getAcademicErrorMessage(error), variant: "destructive" });
    }
  };

  const handleItemDrop = async (itemId, newJilid) => {
    // Optimistic update
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, jilid: newJilid } : item));

    try {
        await updateHafalanItem(itemId, { jilid: newJilid });
      toast({ title: "Berhasil", description: `Item dipindahkan ke ${[levelPrefix, newJilid].filter(Boolean).join(' ')}` });
    } catch (error) {
        toast({ title: "Gagal memindahkan item", description: getAcademicErrorMessage(error), variant: "destructive" });
        fetchItems(); // Revert on error
    }
  };

  // Group items by Jilid for display
  const itemsByJilid = Object.fromEntries(levels.map((level, index) => [
    String(level),
    items.filter((item) => {
      const itemLevel = String(item.jilid || '');
      return itemLevel === String(level) || (index === 0 && !itemLevel);
    })
  ]));

  return (
    <section className="space-y-6 rounded-lg border bg-muted/20 p-4 sm:p-6" aria-labelledby={`hafalan-${programScope}-${category}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
          <div>
            <h4 id={`hafalan-${programScope}-${category}`} className="text-xl font-black text-foreground sm:text-2xl">{title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {programScope === 'PTPT'
                ? 'Kurikulum tahfizh PTPT terpisah dari hafalan TPQ dan dinilai dengan skala 1–4.'
                : 'Atur urutan hafalan TPQ berdasarkan jilid pembelajaran.'}
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Select value={targetJilid} onValueChange={setTargetJilid}>
                <SelectTrigger className="w-[120px] bg-background"><SelectValue placeholder={levelPrefix || 'Target'} /></SelectTrigger>
                <SelectContent>
                    {levels.map((level) => (
                      <SelectItem key={level} value={String(level)}>
                        {[levelPrefix, level].filter(Boolean).join(' ')}
                      </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Input placeholder="Nama hafalan baru..." value={newItemName} onChange={e => setNewItemName(e.target.value)} className="min-w-[200px] flex-1 bg-background" />
            <Button onClick={handleAddItem}><Plus className="w-4 h-4 mr-2"/> Tambah</Button>
          </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {levels.map(jilid => (
              <HafalanDisplay
                  key={jilid}
                  jilid={jilid}
                  titlePrefix={levelPrefix}
                  items={itemsByJilid[jilid]}
                  isDraggable={true}
                  onItemDrop={handleItemDrop}
                  onDeleteItem={handleDeleteItem}
                  isLoading={isLoading}
              />
          ))}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
          Tarik dan lepas item hafalan untuk memindahkannya ke target lain.
      </p>
    </section>
  );
};

const ContentManagement = () => {
  const [content, setContent] = useState({
    ...defaultContent, qiroatiLogoUrl: '', brochures: [], pustaka: [], news: [], announcements: [], qiroatiVideos: [], hafalanVideos: [], waliDiscussions: [], santriOfTheMonth: [], guruOfTheMonth: null, leaderboard: [], parentingArticles: [], model3dSettings: { autoRotate: false, autoRotateSpeed: 0.34, rotationX: 0, rotationY: 0, rotationZ: 0 }
  });

  const [feedbacks, setFeedbacks] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalType, setModalType] = useState('');
  const [formState, setFormState] = useState({});
  const [santriList, setSantriList] = useState([]);
  const [guruList, setGuruList] = useState([]);
  const [activeTab, setActiveTab] = useState("homepage");
  const [enrollmentData, setEnrollmentData] = useState({ categories: [] });
  const [isEnrollmentSaving, setIsEnrollmentSaving] = useState(false);

  useEffect(() => { fetchContent(); fetchSantriAndGuru(); fetchFeedbacks(); }, []);

  const fetchFeedbacks = async () => {
    try {
      setFeedbacks(await fetchAdminFeedbacks());
    } catch (error) {
      toast({ title: "Gagal Memuat Pesan", description: getPublicContentErrorMessage(error), variant: "destructive" });
    }
  };

  const handleDeleteFeedback = async (id) => {
    if (!window.confirm('Yakin ingin menghapus pesan ini?')) return;
    try {
      await deleteFeedback(id);
      toast({ title: "Pesan dihapus!" });
      fetchFeedbacks();
    } catch (error) {
      toast({ title: "Gagal Menghapus Pesan", description: getPublicContentErrorMessage(error), variant: "destructive" });
    }
  }

  const fetchSantriAndGuru = async () => {
    const { data: santriData } = await supabase.from('santri').select('id, nama_lengkap, foto_url').eq('status', 'Aktif').order('nama_lengkap', { ascending: true });
    const { data: guruData } = await supabase.from('guru').select('id, nama, foto_url').order('nama', { ascending: true });
    setSantriList(santriData || []);
    setGuruList(guruData || []);
  };

  const fetchContent = async () => {
    const { data, error } = await supabase.from('website_content').select('key, content');
    if (error) return;
    const newContent = data.reduce((acc, item) => { acc[item.key] = item.content; return acc; }, {});
    const arrayKeys = ['heroSlides', 'brochures', 'pustaka', 'facilities', 'qiroatiVideos', 'hafalanVideos', 'waliDiscussions', 'santriOfTheMonth', 'leaderboard', 'parentingArticles', 'galleryPhotos', 'schedules', 'faqs'];
    arrayKeys.forEach(key => { if (!newContent[key] || !Array.isArray(newContent[key])) newContent[key] = []; });
    if(!newContent.quotas) newContent.quotas = { pagi: 0, siang: 0, sore: 0, dewasaPagi: 0, dewasaSiang: 0, dewasaMalam: 0 };
    Object.assign(newContent, mergeHomepageContent(newContent));
    if(!newContent.model3dSettings || typeof newContent.model3dSettings !== 'object' || Array.isArray(newContent.model3dSettings)) {
      newContent.model3dSettings = { autoRotate: false, autoRotateSpeed: 0.34, rotationX: 0, rotationY: 0, rotationZ: 0 };
    }
    // Parse enrollmentInfo
    if (newContent.enrollmentInfo && typeof newContent.enrollmentInfo === 'object' && Array.isArray(newContent.enrollmentInfo.categories) && newContent.enrollmentInfo.categories.length > 0) {
      setEnrollmentData(newContent.enrollmentInfo);
    } else {
      setEnrollmentData(createDefaultEnrollmentData());
    }
    try {
      const [news, announcements] = await Promise.all([fetchAdminNews(), fetchAdminAnnouncements()]);
      setContent(prev => ({ ...prev, ...newContent, news, announcements }));
    } catch (contentError) {
      toast({ title: "Gagal Memuat Berita/Pengumuman", description: getPublicContentErrorMessage(contentError), variant: "destructive" });
      setContent(prev => ({ ...prev, ...newContent, news: [], announcements: [] }));
    }
  };

  const handleSaveAll = async () => {
    const excludedKeys = new Set(['news', 'announcements']);
    const dataToUpsert = Object.keys(content)
      .filter(key => !excludedKeys.has(key))
      .map(key => ({ key, content: content[key], is_public: true }));
    try {
      await saveWebsiteContentItems(dataToUpsert);
      toast({ title: "Konten Disimpan!", description: `Semua perubahan telah berhasil disimpan.` });
    } catch (error) {
      toast({ title: "Gagal Menyimpan!", description: getPublicContentErrorMessage(error), variant: "destructive" });
    }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    let folder = 'general';
    if (['news', 'announcements', 'parentingArticles'].includes(type)) folder = 'article-images';
    else if (type === 'facilities') folder = 'facilities-images';
    else if (['brochures', 'pustaka'].includes(type)) folder = type;
    else if (['logoUrl', 'qiroatiLogoUrl'].includes(type)) folder = 'logos';
    else if (type === 'ctaBackgroundUrl') folder = 'backgrounds';
    else if (type === 'heroSlides') folder = 'hero-slides';
    else if (type === 'galleryPhotos') folder = 'gallery';

    const assetKey = type === 'logoUrl'
      ? 'logo'
      : (type === 'qiroatiLogoUrl' ? 'qiroati-logo' : (type === 'ctaBackgroundUrl' ? 'cta-background' : null));
    let publicUrl = '';
    try {
      const result = await uploadWebsiteAsset({ folder, key: assetKey, file });
      publicUrl = result.publicUrl;
      if (!publicUrl || !String(publicUrl).trim()) {
        throw new Error('Upload berhasil, tetapi URL aset tidak tersedia.');
      }
    } catch (error) {
      toast({ title: "Upload Gagal!", description: getStorageErrorMessage(error), variant: "destructive" });
      return;
    }

    if (['logoUrl', 'qiroatiLogoUrl'].includes(type)) {
      try {
        const logoUrl = assertNonEmptyWebsiteContentString(type, publicUrl);
        const saved = await saveWebsiteContentItem({ key: type, content: logoUrl, isPublic: true });
        setContent(prev => ({ ...prev, [type]: saved.content || logoUrl }));
        toast({
          title: type === 'qiroatiLogoUrl' ? 'Logo Qiroati Disimpan!' : 'Logo Disimpan!',
          description: 'Logo berhasil diunggah dan langsung tersedia untuk dokumen absensi.',
        });
      } catch (error) {
        toast({ title: "Logo Gagal Disimpan", description: getPublicContentErrorMessage(error), variant: "destructive" });
      }
      return;
    }
    if (type === 'ctaBackgroundUrl') { setContent(prev => ({ ...prev, [type]: publicUrl })); }
    else if (['brochures', 'pustaka'].includes(type)) { const newFile = { id: Date.now(), name: file.name, url: publicUrl }; setContent(prev => ({...prev, [type]: [...(prev[type] || []), newFile]})); }
    else if (type === 'galleryPhotos') { setFormState(prev => ({ ...prev, url: publicUrl })); }
    else { setFormState(prev => ({ ...prev, image_url: publicUrl })); }
    toast({ title: "Upload Berhasil!", description: `${file.name} berhasil diunggah.` });
  };

  const handleHeroImageUpload = async (e, slideId) => {
    const file = e.target.files[0];
    if (!file) return;
    const folder = 'hero-slides';
    let publicUrl = '';
    try {
      const result = await uploadWebsiteAsset({ folder, key: `slide-${slideId}`, file });
      publicUrl = result.publicUrl;
    } catch (error) {
      return toast({ title: "Upload Gagal!", description: getStorageErrorMessage(error), variant: "destructive" });
    }
    setContent(prev => ({ ...prev, heroSlides: prev.heroSlides.map(slide => slide.id === slideId ? { ...slide, url: publicUrl } : slide) }));
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    if (item) { setEditingItem(item); setFormState(item); }
    else { setEditingItem(null); setFormState({}); }
    setIsModalOpen(true);
  };

  const handleModalSubmit = async () => {
    if (modalType === 'news' || modalType === 'announcements') {
      try {
        if (!formState.slug) setFormState(prev => ({ ...prev, slug: slugify(prev.title) }));
        if (modalType === 'news') await saveNews({ ...formState, slug: formState.slug || slugify(formState.title) });
        else await saveAnnouncement({ ...formState, slug: formState.slug || slugify(formState.title) });
        toast({ title: "Konten Disimpan", description: modalType === 'news' ? "Berita telah diperbarui." : "Pengumuman telah diperbarui." });
        setIsModalOpen(false);
        fetchContent();
      } catch (error) {
        toast({ title: "Gagal Menyimpan Konten", description: getPublicContentErrorMessage(error), variant: "destructive" });
      }
      return;
    }
    let updatedList;
    if (editingItem) updatedList = content[modalType].map(item => item.id === editingItem.id ? formState : item);
    else updatedList = [...(content[modalType] || []), { ...formState, id: Date.now() }];
    setContent(prev => ({ ...prev, [modalType]: updatedList }));
    setIsModalOpen(false);
  };

  const handleDeleteItem = async (type, id) => {
    if (window.confirm('Anda yakin ingin menghapus item ini?')) {
      if (type === 'news' || type === 'announcements') {
        try {
          if (type === 'news') await archiveNews(id);
          else await archiveAnnouncement(id);
          toast({ title: "Konten Dinonaktifkan", description: "Konten tidak lagi tampil di halaman publik." });
          fetchContent();
        } catch (error) {
          toast({ title: "Gagal Menonaktifkan Konten", description: getPublicContentErrorMessage(error), variant: "destructive" });
        }
        return;
      }
      const updatedList = content[type].filter(item => item.id !== id);
      setContent(prev => ({ ...prev, [type]: updatedList }));
    }
  };

  const handleHeroSlideChange = (id, field, value) => { setContent(prev => ({ ...prev, heroSlides: prev.heroSlides.map(slide => slide.id === id ? { ...slide, [field]: value } : slide) })); };
  const addHeroSlide = () => { if (content.heroSlides?.length >= 5) return; setContent(prev => ({ ...prev, heroSlides: [...(prev.heroSlides || []), { id: Date.now(), url: '/logo-lpq-al-fath-maulana.webp', text: 'Teks slide baru', author: 'LPQ Al-Fath Maulana' }] })); };
  const handleSantriOfTheMonthChange = (index, personId, alasan) => { const person = santriList.find(p => p.id === personId); if (person) { const newSantriOTM = [...content.santriOfTheMonth]; newSantriOTM[index] = { ...person, alasan }; setContent(prev => ({ ...prev, santriOfTheMonth: newSantriOTM })); } };
  const handleGuruOfTheMonthChange = (personId, alasan) => { const person = guruList.find(p => p.id === personId); if (person) setContent(prev => ({ ...prev, guruOfTheMonth: { ...person, alasan } })); };
  const handleLeaderboardChange = (index, personId, achievement) => { const person = santriList.find(p => p.id === personId); if (person) { const newLeaderboard = [...content.leaderboard]; newLeaderboard[index] = { ...person, achievement }; setContent(prev => ({ ...prev, leaderboard: newLeaderboard })); } };
  const handleOpacityChange = (key, value) => { setContent(prev => ({...prev, [key]: value[0]})); };

  /* ---- Enrollment Data Handlers ---- */
  const updateEnrollmentCategory = (catIndex, field, value) => {
    setEnrollmentData(prev => {
      const cats = [...prev.categories];
      cats[catIndex] = { ...cats[catIndex], [field]: value };
      return { ...prev, categories: cats };
    });
  };

  const addEnrollmentCategory = () => {
    const newCat = {
      id: `cat-${Date.now()}`,
      name: 'Kategori Baru',
      description: '',
      icon: '📋',
      fees: [],
      totalFee: '',
      notes: [],
      requirements: [],
      order: enrollmentData.categories.length + 1,
    };
    setEnrollmentData(prev => ({ ...prev, categories: [...prev.categories, newCat] }));
  };

  const removeEnrollmentCategory = (catIndex) => {
    if (!window.confirm('Hapus kategori ini beserta seluruh data biaya, catatan, dan syaratnya?')) return;
    setEnrollmentData(prev => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== catIndex),
    }));
  };

  const addFeeItem = (catIndex) => {
    const cats = [...enrollmentData.categories];
    const fees = [...(cats[catIndex].fees || [])];
    fees.push({ id: `f-${Date.now()}`, name: '', amount: '', order: fees.length + 1 });
    cats[catIndex] = { ...cats[catIndex], fees };
    setEnrollmentData({ ...enrollmentData, categories: cats });
  };

  const updateFeeItem = (catIndex, feeIndex, field, value) => {
    const cats = [...enrollmentData.categories];
    const fees = [...cats[catIndex].fees];
    fees[feeIndex] = { ...fees[feeIndex], [field]: value };
    cats[catIndex] = { ...cats[catIndex], fees };
    setEnrollmentData({ ...enrollmentData, categories: cats });
  };

  const removeFeeItem = (catIndex, feeIndex) => {
    const cats = [...enrollmentData.categories];
    cats[catIndex] = { ...cats[catIndex], fees: cats[catIndex].fees.filter((_, i) => i !== feeIndex) };
    setEnrollmentData({ ...enrollmentData, categories: cats });
  };

  const addNoteItem = (catIndex) => {
    const cats = [...enrollmentData.categories];
    const notes = [...(cats[catIndex].notes || [])];
    notes.push({ id: `n-${Date.now()}`, icon: '📌', text: '' });
    cats[catIndex] = { ...cats[catIndex], notes };
    setEnrollmentData({ ...enrollmentData, categories: cats });
  };

  const updateNoteItem = (catIndex, noteIndex, field, value) => {
    const cats = [...enrollmentData.categories];
    const notes = [...cats[catIndex].notes];
    notes[noteIndex] = { ...notes[noteIndex], [field]: value };
    cats[catIndex] = { ...cats[catIndex], notes };
    setEnrollmentData({ ...enrollmentData, categories: cats });
  };

  const removeNoteItem = (catIndex, noteIndex) => {
    const cats = [...enrollmentData.categories];
    cats[catIndex] = { ...cats[catIndex], notes: cats[catIndex].notes.filter((_, i) => i !== noteIndex) };
    setEnrollmentData({ ...enrollmentData, categories: cats });
  };

  const addRequirementItem = (catIndex) => {
    const cats = [...enrollmentData.categories];
    const requirements = [...(cats[catIndex].requirements || [])];
    requirements.push({ id: `r-${Date.now()}`, text: '' });
    cats[catIndex] = { ...cats[catIndex], requirements };
    setEnrollmentData({ ...enrollmentData, categories: cats });
  };

  const updateRequirementItem = (catIndex, reqIndex, value) => {
    const cats = [...enrollmentData.categories];
    const requirements = [...cats[catIndex].requirements];
    requirements[reqIndex] = { ...requirements[reqIndex], text: value };
    cats[catIndex] = { ...cats[catIndex], requirements };
    setEnrollmentData({ ...enrollmentData, categories: cats });
  };

  const removeRequirementItem = (catIndex, reqIndex) => {
    const cats = [...enrollmentData.categories];
    cats[catIndex] = { ...cats[catIndex], requirements: cats[catIndex].requirements.filter((_, i) => i !== reqIndex) };
    setEnrollmentData({ ...enrollmentData, categories: cats });
  };

  const moveCategory = (catIndex, direction) => {
    const cats = [...enrollmentData.categories];
    const targetIndex = catIndex + direction;
    if (targetIndex < 0 || targetIndex >= cats.length) return;
    [cats[catIndex], cats[targetIndex]] = [cats[targetIndex], cats[catIndex]];
    // Update order
    cats.forEach((c, i) => { c.order = i + 1; });
    setEnrollmentData({ ...enrollmentData, categories: cats });
  };

  const handleSaveEnrollment = async () => {
    setIsEnrollmentSaving(true);
    try {
      const normalizedEnrollmentData = prepareEnrollmentDataForSave(enrollmentData);
      const saved = await saveWebsiteContentItem({
        key: 'enrollmentInfo',
        content: normalizedEnrollmentData,
        isPublic: true,
      });
      setEnrollmentData(saved.content || normalizedEnrollmentData);
      toast({ title: "Tersimpan!", description: "Informasi pendaftaran berhasil disimpan." });
    } catch (error) {
      toast({ title: "Gagal Menyimpan", description: getPublicContentErrorMessage(error), variant: "destructive" });
    } finally {
      setIsEnrollmentSaving(false);
    }
  };

  const tabs = [
      { id: 'homepage', label: 'Halaman Depan', icon: Home },
      { id: 'apresiasi', label: 'Apresiasi', icon: Heart },
      { id: 'media', label: 'Media & Galeri', icon: ImageIcon },
      { id: 'enrollment', label: 'Informasi Pendaftaran', icon: ClipboardList },
      { id: 'pesan', label: 'Pesan Masuk', icon: Mail },
      { id: 'hafalan', label: 'Hafalan', icon: BookCopy },
  ];

  const renderModalContent = () => {
    if (!modalType) return null;
    return (
      <>
        <div className="space-y-4">
          {modalType === 'news' && (<><Input placeholder="Judul" value={formState.title || ''} onChange={e => setFormState(p => ({...p, title: e.target.value, slug: p.slug || slugify(e.target.value)}))} /><Input placeholder="Slug" value={formState.slug || ''} onChange={e => setFormState(p => ({...p, slug: slugify(e.target.value)}))} /><Select value={formState.status || 'draft'} onValueChange={val => setFormState(p => ({...p, status: val}))}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Nonaktif</SelectItem></SelectContent></Select><Textarea placeholder="Ringkasan" value={formState.summary || ''} onChange={e => setFormState(p => ({...p, summary: e.target.value}))} /><Textarea placeholder="Konten Lengkap" rows={10} value={formState.content || ''} onChange={e => setFormState(p => ({...p, content: e.target.value}))} /><Input placeholder="URL Gambar" value={formState.image_url || ''} onChange={e => setFormState(p => ({...p, image_url: e.target.value}))} /><Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'news')} /></>)}
          {modalType === 'parentingArticles' && (<><Input placeholder="Judul" value={formState.title || ''} onChange={e => setFormState(p => ({...p, title: e.target.value}))} /><Input placeholder="Penulis" value={formState.author || ''} onChange={e => setFormState(p => ({...p, author: e.target.value}))} /><Textarea placeholder="Ringkasan" value={formState.summary || ''} onChange={e => setFormState(p => ({...p, summary: e.target.value}))} /><Textarea placeholder="Konten Lengkap" rows={10} value={formState.content || ''} onChange={e => setFormState(p => ({...p, content: e.target.value}))} /><Input placeholder="URL Gambar" value={formState.image_url || ''} onChange={e => setFormState(p => ({...p, image_url: e.target.value}))} /></>)}
          {modalType === 'announcements' && (<><Input placeholder="Judul" value={formState.title || ''} onChange={e => setFormState(p => ({...p, title: e.target.value, slug: p.slug || slugify(e.target.value)}))} /><Input placeholder="Slug" value={formState.slug || ''} onChange={e => setFormState(p => ({...p, slug: slugify(e.target.value)}))} /><Select value={formState.status || 'draft'} onValueChange={val => setFormState(p => ({...p, status: val}))}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Nonaktif</SelectItem></SelectContent></Select><Select value={formState.priority || 'normal'} onValueChange={val => setFormState(p => ({...p, priority: val}))}><SelectTrigger><SelectValue placeholder="Prioritas" /></SelectTrigger><SelectContent><SelectItem value="low">Rendah</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">Tinggi</SelectItem></SelectContent></Select><Input type="date" value={formState.valid_until || ''} onChange={e => setFormState(p => ({...p, valid_until: e.target.value}))} /><Textarea placeholder="Ringkasan" value={formState.summary || ''} onChange={e => setFormState(p => ({...p, summary: e.target.value}))} /><Textarea placeholder="Konten" rows={8} value={formState.content || ''} onChange={e => setFormState(p => ({...p, content: e.target.value}))} /><Input placeholder="URL Gambar" value={formState.image_url || ''} onChange={e => setFormState(p => ({...p, image_url: e.target.value}))} /><Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'announcements')} /></>)}
          {modalType === 'facilities' && (<><Input placeholder="Nama Fasilitas" value={formState.name || ''} onChange={e => setFormState(p => ({...p, name: e.target.value}))} /><Textarea placeholder="Deskripsi" value={formState.description || ''} onChange={e => setFormState(p => ({...p, description: e.target.value}))} /><Input placeholder="URL Gambar" value={formState.image_url || ''} onChange={e => setFormState(p => ({...p, image_url: e.target.value}))} /></>)}
          {['qiroatiVideos', 'hafalanVideos'].includes(modalType) && (<><Input placeholder="Judul Video" value={formState.title || ''} onChange={e => setFormState(p => ({...p, title: e.target.value}))} /><Input placeholder="URL Embed Video Youtube" value={formState.url || ''} onChange={e => setFormState(p => ({...p, url: e.target.value}))} />{modalType === 'hafalanVideos' && (<div className="space-y-2"><Textarea placeholder='Google Drive Embed Code' value={formState.google_drive_embed || ''} onChange={e => setFormState(p => ({...p, google_drive_embed: e.target.value}))} className="font-mono text-xs" rows={3}/><p className="text-[10px] text-muted-foreground">Isi salah satu: YouTube URL atau Google Drive Embed.</p></div>)}{modalType === 'hafalanVideos' && (<Select value={formState.jilid} onValueChange={val => setFormState(p => ({...p, jilid: val}))}><SelectTrigger><SelectValue placeholder="Pilih Jilid" /></SelectTrigger><SelectContent>{['Jilid 1', 'Jilid 2', 'Jilid 3', 'Jilid 4', 'Jilid 5', 'Jilid 6', 'Lainnya'].map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent></Select>)}</>)}
          {modalType === 'waliDiscussions' && (<><Input placeholder="Judul Diskusi" value={formState.title || ''} onChange={e => setFormState(p => ({...p, title: e.target.value}))} /><div className="grid grid-cols-2 gap-4"><Input type="date" value={formState.date || ''} onChange={e => setFormState(p => ({...p, date: e.target.value}))} /><Input type="time" value={formState.time || ''} onChange={e => setFormState(p => ({...p, time: e.target.value}))} /></div><Select value={formState.platform} onValueChange={val => setFormState(p => ({...p, platform: val}))}><SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger><SelectContent><SelectItem value="Google Meet">Google Meet</SelectItem><SelectItem value="Zoom">Zoom</SelectItem></SelectContent></Select><Input placeholder="Link Meeting" value={formState.link || ''} onChange={e => setFormState(p => ({...p, link: e.target.value}))} /><Textarea placeholder="Deskripsi Topik" value={formState.description || ''} onChange={e => setFormState(p => ({...p, description: e.target.value}))} /></>)}
          {modalType === 'galleryPhotos' && (<><Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'galleryPhotos')} /><Input placeholder="Caption Foto" value={formState.caption || ''} onChange={e => setFormState(p => ({...p, caption: e.target.value}))} />{formState.url && <img src={formState.url} alt="Preview" className="w-full h-40 object-cover rounded-md mt-2" />}</>)}
          {modalType === 'schedules' && (<><Input placeholder="Judul" value={formState.title || ''} onChange={e => setFormState(p => ({...p, title: e.target.value}))} /><Input placeholder="Waktu" value={formState.time || ''} onChange={e => setFormState(p => ({...p, time: e.target.value}))} /><Input placeholder="Keterangan" value={formState.type || ''} onChange={e => setFormState(p => ({...p, type: e.target.value}))} /></>)}
          {modalType === 'faqs' && (<><Input placeholder="Pertanyaan" value={formState.question || ''} onChange={e => setFormState(p => ({...p, question: e.target.value}))} /><Textarea placeholder="Jawaban" value={formState.answer || ''} onChange={e => setFormState(p => ({...p, answer: e.target.value}))} /></>)}
        </div>
        <div className="flex justify-end mt-4"><Button onClick={handleModalSubmit}>Simpan</Button></div>
      </>
    );
  };

  const ContentSection = ({ title, modalType, data, icon, renderItem }) => (
    <div className="admin-card p-4">
      <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-xl flex items-center gap-2">{icon} {title}</h3><Button onClick={() => openModal(modalType)}><Plus className="w-4 h-4 mr-2" />Tambah</Button></div>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
        {data.map(item => (<div key={item.id} className="flex justify-between items-center p-2 border rounded-lg bg-background">{renderItem(item)}<div className="flex-shrink-0"><Button variant="ghost" size="icon" onClick={() => openModal(modalType, item)}><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteItem(modalType, item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div></div>))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="admin-panel-header">
        <div className="flex items-center gap-3">
          <div className="admin-panel-header-icon">
            <FileText />
          </div>
          <div className="admin-panel-header-text">
            <h2>Manajemen Konten Website</h2>
            <p>Kelola konten yang tampil di halaman publik LPQ Al-Fath Maulana.</p>
          </div>
        </div>
        <div className="admin-panel-header-actions">
          <button onClick={handleSaveAll} className="admin-panel-primary-btn">
            <Save className="w-4 h-4" /> Simpan Semua Perubahan
          </button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-center mb-6">
            <div className="admin-segmented-control">
                {tabs.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ease-out flex items-center gap-2 ${activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}>
                        {activeTab === tab.id && (<motion.div layoutId="content-pill" className="absolute inset-0 bg-blue-600 dark:bg-blue-500 shadow-sm rounded-full" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />)}
                        <span className="relative z-10 flex items-center gap-2"><tab.icon className="w-4 h-4" />{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>

        <TabsContent value="homepage" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="admin-card p-4">
                <h3 className="font-bold text-xl mb-1">Logo LPQ</h3>
                <p className="mb-4 text-sm text-muted-foreground">Dipakai pada website dan sisi kiri header absensi kelas.</p>
                <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleFileUpload(e, 'logoUrl')} />
                {content.logoUrl && <img src={content.logoUrl} alt="Pratinjau logo LPQ" className="w-24 h-24 mt-3 bg-gray-100 p-2 rounded-xl object-contain" />}
              </div>
              <div className="admin-card p-4 border-cyan-200/70 dark:border-cyan-900/60">
                <h3 className="font-bold text-xl mb-1">Logo Qiroati</h3>
                <p className="mb-4 text-sm text-muted-foreground">Ditampilkan di sisi kanan header absensi. PNG atau WebP transparan memberikan hasil terbaik.</p>
                <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleFileUpload(e, 'qiroatiLogoUrl')} />
                {content.qiroatiLogoUrl
                  ? <img src={content.qiroatiLogoUrl} alt="Pratinjau logo Qiroati" className="w-24 h-24 mt-3 bg-gray-100 p-2 rounded-xl object-contain" />
                  : <div className="mt-3 flex h-24 w-24 items-center justify-center rounded-xl border border-dashed text-center text-[10px] text-muted-foreground">Belum<br />diunggah</div>}
              </div>
            </div>
            <div className="admin-card p-4">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-xl">Slideshow</h3><Button onClick={addHeroSlide} size="sm"><Plus className="w-4 h-4 mr-2" /> Tambah Slide</Button></div>
                <div className="mb-4"><label className="block text-sm font-medium mb-1">Timer Slideshow (ms)</label><Input type="number" value={content.slideshowTimer} onChange={e => setContent(p => ({...p, slideshowTimer: parseInt(e.target.value, 10)}))} /></div>
                 <div className="space-y-2 mb-4"><label className="font-medium">Kegelapan Overlay Slideshow</label><div className="flex items-center gap-4"><Sun className="w-5 h-5"/><Slider value={[content.heroOverlayOpacity || 0.6]} max={1} step={0.1} onValueChange={(val) => handleOpacityChange('heroOverlayOpacity', val)} /><Moon className="w-5 h-5"/></div></div>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">{content.heroSlides.map((slide) => (<div key={slide.id} className="admin-card p-4 space-y-3 bg-background"><div className="flex flex-col md:flex-row items-start gap-4"><img alt="Slide Preview" className="w-24 h-16 object-cover rounded-md bg-secondary" src={slide.url} /><div className="flex-grow space-y-2"><Textarea placeholder="Teks Utama" value={slide.text || ''} onChange={e => handleHeroSlideChange(slide.id, 'text', e.target.value)} /><Input placeholder="Author" value={slide.author || ''} onChange={(e) => handleHeroSlideChange(slide.id, 'author', e.target.value)} /></div></div><div className="flex gap-2"><Input type="file" accept="image/*" onChange={(e) => handleHeroImageUpload(e, slide.id)} className="w-full" /><Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteItem('heroSlides', slide.id)}><Trash2 className="w-4 h-4" /></Button></div></div>))}</div>
            </div>
             <div className="admin-card p-4">
              <h3 className="font-bold text-xl mb-4">Background CTA</h3><Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'ctaBackgroundUrl')} />{content.ctaBackgroundUrl && <img src={content.ctaBackgroundUrl} alt="CTA Background Preview" className="w-48 h-auto mt-2 bg-gray-200 p-2 rounded-md" />}
              <div className="mt-4 space-y-2"><label className="font-medium">Tingkat Kegelapan Overlay</label><div className="flex items-center gap-4"><Sun className="w-5 h-5"/><Slider value={[content.ctaBackgroundOverlayOpacity]} max={1} step={0.1} onValueChange={(val) => handleOpacityChange('ctaBackgroundOverlayOpacity', val)} /><Moon className="w-5 h-5"/></div></div>
            </div>
            <ContentSection title="Jadwal Pembelajaran" modalType="schedules" data={content.schedules} icon={<CalendarClock/>} renderItem={item => <div className="text-sm"><p className="font-bold">{item.title}</p><p>{item.time}</p></div>} />
            <ContentSection title="FAQ (Tanya Jawab)" modalType="faqs" data={content.faqs} icon={<HelpCircle/>} renderItem={item => <div className="text-sm"><p className="font-bold">{item.question}</p></div>} />
            <div className="admin-card p-4"><h3 className="font-bold text-xl mb-4">Kuota Santri</h3><div className="grid grid-cols-2 md:grid-cols-3 gap-4">{Object.keys(content.quotas).map(k => <div key={k}><label className="text-sm capitalize">{k.replace(/([A-Z])/g, ' $1')}</label><Input type="number" value={content.quotas[k] || 0} onChange={e => setContent(p => ({...p, quotas: {...p.quotas, [k]: parseInt(e.target.value)}}))} /></div>)}</div></div>
            <div className="admin-card p-4 space-y-4">
              <h3 className="font-bold text-xl flex items-center gap-2"><RotateCcw className="w-5 h-5" /> Model 3D</h3>
              <p className="text-sm text-muted-foreground">Atur rotasi model 3D yang tampil di bagian hero halaman depan.</p>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">Auto-Rotate</p>
                  <p className="text-sm text-muted-foreground">Putar model secara otomatis</p>
                </div>
                <Switch
                  checked={content.model3dSettings?.autoRotate || false}
                  onCheckedChange={(checked) => setContent(prev => ({
                    ...prev,
                    model3dSettings: { ...prev.model3dSettings, autoRotate: checked }
                  }))}
                />
              </div>
              {content.model3dSettings?.autoRotate && (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-sm">Kecepatan Putar</label>
                    <span className="text-xs text-muted-foreground">{(content.model3dSettings?.autoRotateSpeed || 0.34).toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[content.model3dSettings?.autoRotateSpeed || 0.34]}
                    min={0.05}
                    max={2.0}
                    step={0.05}
                    onValueChange={(val) => setContent(prev => ({
                      ...prev,
                      model3dSettings: { ...prev.model3dSettings, autoRotateSpeed: val[0] }
                    }))}
                  />
                </div>
              )}
              <div className="space-y-3 rounded-lg border p-3">
                <label className="font-medium text-sm">Rotasi Awal (derajat)</label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { axis: 'rotationX', label: 'Sumbu X' },
                    { axis: 'rotationY', label: 'Sumbu Y' },
                    { axis: 'rotationZ', label: 'Sumbu Z' },
                  ].map(({ axis, label }) => (
                    <div key={axis} className="space-y-1">
                      <label className="text-xs text-muted-foreground">{label}</label>
                      <Input
                        type="number"
                        min={-180}
                        max={180}
                        step={1}
                        value={content.model3dSettings?.[axis] ?? 0}
                        onChange={(e) => setContent(prev => ({
                          ...prev,
                          model3dSettings: { ...prev.model3dSettings, [axis]: parseFloat(e.target.value) || 0 }
                        }))}
                      />
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setContent(prev => ({
                    ...prev,
                    model3dSettings: { ...prev.model3dSettings, rotationX: 0, rotationY: 0, rotationZ: 0 }
                  }))}
                >
                  <RotateCcw className="w-3 h-3 mr-2" /> Reset ke Default
                </Button>
              </div>
            </div>
        </TabsContent>

        <TabsContent value="apresiasi" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 flex gap-3 mb-4"><Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" /><div className="text-sm text-blue-700 dark:text-blue-300"><p className="font-bold mb-1">Info Pindah Lokasi</p><p>Pengaturan <strong>TV Leaderboard</strong> telah dipindahkan ke menu <strong>Pengaturan TV</strong> sesuai permintaan.</p></div></div>
          <div className="admin-card p-4"><h3 className="font-bold text-xl mb-4 flex items-center"><Star className="w-6 h-6 mr-2 text-blue-500" /> Papan Peringkat (Website)</h3>{[0, 1, 2].map(index => (<div key={index} className="admin-card p-4 space-y-3 mb-4 bg-background"><h4 className="font-semibold">Peringkat #{index + 1}</h4><Select onValueChange={val => handleLeaderboardChange(index, val, content.leaderboard?.[index]?.achievement || '')} value={content.leaderboard?.[index]?.id}><SelectTrigger><SelectValue placeholder="Pilih Santri" /></SelectTrigger><SelectContent>{santriList.map(s => <SelectItem key={s.id} value={s.id}>{s.nama_lengkap}</SelectItem>)}</SelectContent></Select><Input placeholder="Deskripsi Prestasi" value={content.leaderboard?.[index]?.achievement || ''} onChange={e => handleLeaderboardChange(index, content.leaderboard?.[index]?.id, e.target.value)} /></div>))}</div>
          <div className="admin-card p-4"><h3 className="font-bold text-xl mb-4 flex items-center"><Trophy className="w-6 h-6 mr-2 text-amber-500" /> Santri of the Month</h3>{[0, 1, 2].map(index => (<div key={index} className="admin-card p-4 space-y-3 mb-4 bg-background"><h4 className="font-semibold">Pilihan Santri #{index + 1}</h4><Select onValueChange={val => handleSantriOfTheMonthChange(index, val, content.santriOfTheMonth?.[index]?.alasan || '')} value={content.santriOfTheMonth?.[index]?.id}><SelectTrigger><SelectValue placeholder="Pilih Santri" /></SelectTrigger><SelectContent>{santriList.map(s => <SelectItem key={s.id} value={s.id}>{s.nama_lengkap}</SelectItem>)}</SelectContent></Select><Input placeholder="Alasan apresiasi..." value={content.santriOfTheMonth?.[index]?.alasan || ''} onChange={e => handleSantriOfTheMonthChange(index, content.santriOfTheMonth?.[index]?.id, e.target.value)} /></div>))}</div>
          <div className="admin-card p-4"><h3 className="font-bold text-xl mb-4 flex items-center"><Trophy className="w-6 h-6 mr-2 text-amber-500" /> Guru of the Month</h3><div className="admin-card p-4 space-y-3 bg-background"><Select onValueChange={val => handleGuruOfTheMonthChange(val, content.guruOfTheMonth?.alasan || '')} value={content.guruOfTheMonth?.id}><SelectTrigger><SelectValue placeholder="Pilih Guru" /></SelectTrigger><SelectContent>{guruList.map(g => <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>)}</SelectContent></Select><Input placeholder="Alasan apresiasi..." value={content.guruOfTheMonth?.alasan || ''} onChange={e => handleGuruOfTheMonthChange(content.guruOfTheMonth?.id, e.target.value)} /></div></div>
        </TabsContent>

        <TabsContent value="media" className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="col-span-full"><ContentSection title="Galeri Kegiatan" modalType="galleryPhotos" data={content.galleryPhotos} icon={<ImageIcon/>} renderItem={item => <div className="flex items-center gap-2"><img src={item.url} className="w-12 h-12 object-cover rounded-md" /><p className="truncate">{item.caption}</p></div>} /></div>
            <div className="admin-card p-4 space-y-4"><h3 className="font-bold text-xl flex items-center gap-2"><FileText/> Brosur Pendaftaran</h3><Input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'brochures')} /><div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">{content.brochures.map(file => (<div key={file.id} className="flex justify-between items-center p-2 border rounded-lg bg-background"><span>{file.name}</span><Button variant="ghost" size="icon" onClick={() => handleDeleteItem('brochures', file.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div>))}</div></div>
            <div className="admin-card p-4 space-y-4"><h3 className="font-bold text-xl flex items-center gap-2"><Library/> Pustaka Digital</h3><Input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'pustaka')} /><div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">{content.pustaka.map(file => (<div key={file.id} className="flex justify-between items-center p-2 border rounded-lg bg-background"><span>{file.name}</span><Button variant="ghost" size="icon" onClick={() => handleDeleteItem('pustaka', file.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div>))}</div></div>
            <ContentSection title="Berita" modalType="news" data={content.news} icon={<BookCopy/>} renderItem={item => <p className="truncate">{item.title}</p>} />
            <ContentSection title="Pengumuman" modalType="announcements" data={content.announcements} icon={<MessageSquare/>} renderItem={item => <p className="truncate">{item.title}</p>} />
            <ContentSection title="Artikel Parenting" modalType="parentingArticles" data={content.parentingArticles} icon={<Users/>} renderItem={item => <p className="truncate">{item.title}</p>} />
            <ContentSection title="Diskusi Wali Santri" modalType="waliDiscussions" data={content.waliDiscussions} icon={<Users/>} renderItem={item => <p className="truncate">{item.title} - {item.date}</p>} />
            <ContentSection title="Video Qiroati" modalType="qiroatiVideos" data={content.qiroatiVideos} icon={<Video/>} renderItem={item => <p className="truncate">{item.title}</p>} />
            <ContentSection title="Video Hafalan" modalType="hafalanVideos" data={content.hafalanVideos} icon={<Video/>} renderItem={item => <p className="truncate">{item.title}</p>} />
          <ContentSection title="Fasilitas" modalType="facilities" data={content.facilities} icon={<Building/>} renderItem={item => <p className="truncate">{item.name}</p>} />
        </TabsContent>
        <TabsContent value="enrollment" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-xl flex items-center gap-2"><ClipboardList className="w-5 h-5" /> Informasi Pendaftaran</h3>
              <p className="text-sm text-muted-foreground mt-1">Kelola biaya, catatan, dan syarat pendaftaran yang tampil di halaman publik.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addEnrollmentCategory}>
                <Plus className="mr-2 h-4 w-4" /> Tambah Kategori
              </Button>
              <Button type="button" size="sm" onClick={handleSaveEnrollment} disabled={isEnrollmentSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isEnrollmentSaving ? 'Menyimpan…' : 'Simpan Pendaftaran'}
              </Button>
            </div>
          </div>
          {enrollmentData.categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Belum ada kategori pendaftaran</p>
              <p className="text-sm mt-1">Klik "Tambah Kategori" untuk memulai.</p>
            </div>
          ) : (
            enrollmentData.categories.map((cat, ci) => (
              <div key={cat.id || ci} className="admin-card p-4 space-y-4 bg-background">
                {/* Category Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Input
                      aria-label="Ikon kategori"
                      value={cat.icon || ''}
                      onChange={e => updateEnrollmentCategory(ci, 'icon', e.target.value)}
                      className="w-16 shrink-0 text-center text-xl"
                      placeholder="📋"
                    />
                    <Input
                      value={cat.name || ''}
                      onChange={e => updateEnrollmentCategory(ci, 'name', e.target.value)}
                      className="min-w-0 flex-1 font-bold"
                      placeholder="Nama kategori"
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveCategory(ci, -1)} disabled={ci === 0} aria-label="Pindahkan kategori ke atas">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveCategory(ci, 1)} disabled={ci === enrollmentData.categories.length - 1} aria-label="Pindahkan kategori ke bawah">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeEnrollmentCategory(ci)} aria-label="Hapus kategori">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Deskripsi kategori</label>
                  <Textarea
                    value={cat.description || ''}
                    onChange={e => updateEnrollmentCategory(ci, 'description', e.target.value)}
                    placeholder="Jelaskan kategori pendaftaran ini"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Total Biaya (teks)</label>
                  <Input value={cat.totalFee || ''} onChange={e => updateEnrollmentCategory(ci, 'totalFee', e.target.value)} placeholder="Rp 450.000" />
                </div>

                {/* Fees */}
                <div className="p-3 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-sm">Biaya</h4>
                    <Button variant="outline" size="sm" onClick={() => addFeeItem(ci)}><PlusCircle className="w-3.5 h-3.5 mr-1" />Tambah Biaya</Button>
                  </div>
                  {(cat.fees || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Belum ada item biaya</p>
                  ) : (
                    <div className="space-y-2">
                      {cat.fees.map((fee, fi) => (
                        <div key={fee.id || fi} className="flex items-center gap-2">
                          <Input value={fee.name} onChange={e => updateFeeItem(ci, fi, 'name', e.target.value)} placeholder="Nama biaya" className="flex-1" />
                          <Input value={fee.amount} onChange={e => updateFeeItem(ci, fi, 'amount', e.target.value)} placeholder="Rp 0" className="w-36" />
                          <label className="flex items-center gap-1 text-xs whitespace-nowrap"><input type="checkbox" checked={!!fee.disabled} onChange={e => updateFeeItem(ci, fi, 'disabled', e.target.checked)} />Nonaktif</label>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFeeItem(ci, fi)}><MinusCircle className="w-3.5 h-3.5 text-destructive" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="p-3 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-sm">Catatan Penting</h4>
                    <Button variant="outline" size="sm" onClick={() => addNoteItem(ci)}><PlusCircle className="w-3.5 h-3.5 mr-1" />Tambah Catatan</Button>
                  </div>
                  {(cat.notes || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Belum ada catatan</p>
                  ) : (
                    <div className="space-y-2">
                      {cat.notes.map((note, ni) => (
                        <div key={note.id || ni} className="flex items-center gap-2">
                          <Input value={note.icon} onChange={e => updateNoteItem(ci, ni, 'icon', e.target.value)} placeholder="📌" className="w-14 text-center" />
                          <Input value={note.text} onChange={e => updateNoteItem(ci, ni, 'text', e.target.value)} placeholder="Isi catatan" className="flex-1" />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeNoteItem(ci, ni)}><MinusCircle className="w-3.5 h-3.5 text-destructive" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Requirements */}
                <div className="p-3 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-sm">Syarat Pendaftaran</h4>
                    <Button variant="outline" size="sm" onClick={() => addRequirementItem(ci)}><PlusCircle className="w-3.5 h-3.5 mr-1" />Tambah Syarat</Button>
                  </div>
                  {(cat.requirements || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Belum ada syarat</p>
                  ) : (
                    <div className="space-y-2">
                      {cat.requirements.map((req, ri) => (
                        <div key={req.id || ri} className="flex items-center gap-2">
                          <Input value={req.text} onChange={e => updateRequirementItem(ci, ri, e.target.value)} placeholder="Isi syarat" className="flex-1" />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRequirementItem(ci, ri)}><MinusCircle className="w-3.5 h-3.5 text-destructive" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </TabsContent>
        <TabsContent value="pesan" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <h3 className="font-bold text-xl flex items-center gap-2"><Mail />Pesan dari Pengunjung</h3>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                {feedbacks.length > 0 ? feedbacks.map(fb => (<div key={fb.id} className="admin-card p-4 bg-background relative"><Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => handleDeleteFeedback(fb.id)}><Trash2 className="h-4 w-4" /></Button><p className="font-semibold text-lg">{fb.nama || 'Anonim'}</p><div className="text-sm text-muted-foreground mb-2"><span>{fb.email || '-'}</span> | <span>{fb.phone || '-'}</span> | <span>{new Date(fb.created_at).toLocaleString('id-ID')}</span></div><p className="whitespace-pre-wrap">{fb.message}</p></div>)) : (<p className="text-center text-muted-foreground py-4">Tidak ada pesan masuk.</p>)}
            </div>
        </TabsContent>
        <TabsContent value="hafalan" className="animate-in fade-in slide-in-from-bottom-2">
          <Tabs defaultValue="tpq" className="space-y-5">
            <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-lg bg-muted p-1 sm:w-auto">
              <TabsTrigger value="tpq" className="min-w-[150px]">Hafalan TPQ</TabsTrigger>
              <TabsTrigger value="ptpt" className="min-w-[150px]">Hafalan PTPT</TabsTrigger>
            </TabsList>
            <TabsContent value="tpq" className="space-y-6">
              <HafalanItemManager category="Doa" programScope="TPQ" />
              <HafalanItemManager category="Sholat" programScope="TPQ" />
              <HafalanItemManager category="Surat" programScope="TPQ" />
            </TabsContent>
            <TabsContent value="ptpt">
              <HafalanItemManager
                category="Tahfizh"
                programScope="PTPT"
                title="Kurikulum Tahfizh PTPT"
                levels={PTPT_LEVELS}
                levelPrefix=""
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{editingItem ? 'Edit' : 'Tambah'} {modalType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</DialogTitle><DialogDescription>Pastikan untuk menyimpan semua perubahan setelah selesai mengedit.</DialogDescription></DialogHeader>{renderModalContent()}</DialogContent></Dialog>
    </div>
  );
};

export default ContentManagement;
