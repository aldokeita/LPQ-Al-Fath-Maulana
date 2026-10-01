import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Archive, Plus, Edit, Search, Upload, ArrowUpDown, FileCheck, Download, XCircle, Trophy, Users, Filter, ArrowRightLeft, User, Phone, GraduationCap, FileText, Lock, Star, Bell, Cake, Copy, BookOpen, CheckCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/customSupabaseClient';
import { enableEdgeFunctions, edgeFunctionDisabledMessage } from '@/lib/featureFlags';
import { loadXlsx } from '@/lib/xlsxLoader';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { validatePassword } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import BirthdayNotificationModal from '@/components/dashboard/shared/BirthdayNotificationModal';
import { motion } from 'framer-motion';
import { getSessionName, getSessionNumber, getAllSessions } from '@/utils/sessionMapping';
import { mapSantriForLegacyUi, normalizeNomorIndukQiroati, pickChangedSantriProfileFields, pickSantriProfileFields } from '@/lib/dataMasterAdapters';
import { getStorageErrorMessage, resolveAvatarUrl, uploadAvatar } from '@/lib/storageAdapters';
import { getBirthdaysThisMonth } from '@/lib/birthdayUtils';
import { archiveSantriAccounts, getFunctionErrorMessage } from '@/lib/santriArchiveAdapters';
import { copyTextToClipboard } from '@/lib/clipboardUtils';
import SantriImportDialog from './SantriImportDialog';
import SantriArchiveDialog from '@/components/dashboard/admin/SantriArchiveDialog';
import DataPagination from '@/components/dashboard/shared/DataPagination';

const PAGE_SIZE = 10;

const jilidOptions = [
    'Pra TK A', 'Pra TK B', 'Pra TK C',
    'Jilid 1A', 'Jilid 1B', 'Jilid 1C',
    'Jilid 2A', 'Jilid 2B',
    'Jilid 3A', 'Jilid 3B',
    'Jilid 4A', 'Jilid 4B',
    'Jilid 5A', 'Jilid 5B',
    'Jilid Juz 27',
    'Jilid 6A', 'Jilid 6B',
    'Al-Qur\'an', 'Ghorib Tajwid', 'Finishing'
];

const ptptTargetOptions = ['Juz 1', 'Juz 2', 'Juz 28', 'Juz 29', 'Juz 30'];

const SANTRI_BASE_SELECT = 'id, nomor_induk_qiroati, nama_lengkap, nama_panggilan, kategori, jenis_kelamin, tanggal_lahir, tempat_lahir, alamat, no_hp_ortu, foto_url, avatar_path, rfid_tag, current_class_id, sesi_mengaji, jilid, status, points, order_in_class, created_at, updated_at, deleted_at';
const SANTRI_EXTENDED_SELECT = `${SANTRI_BASE_SELECT}, tanggal_pendaftaran, nama_ayah, nama_ibu, no_kk, no_nik, berkas_foto, berkas_akta, berkas_kk, berkas_form, link_qiroati, default_spp_amount`;

const getSelectedClassId = (input) => input?.current_class_id || input?.id_kelas || null;

const isMissingSantriExtendedColumn = (error) =>
  error?.code === '42703' ||
  /column santri\.(tanggal_pendaftaran|nama_ayah|nama_ibu|no_kk|no_nik|berkas_foto|berkas_akta|berkas_kk|berkas_form|link_qiroati) does not exist/i.test(error?.message || '');

const SantriManagement = ({ subCategory = 'tpq' }) => {
  const academicLevelOptions = subCategory === 'ptpt' ? ptptTargetOptions : jilidOptions;
  const { user, role } = useAuth();
  const [santriList, setSantriList] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const [classesList, setClassesList] = useState([]);
  const [sessionOptions, setSessionOptions] = useState([]);

  const [filters, setFilters] = useState({ search: '', sesi: 'all', jilid: 'all', rfid: 'all' });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [editingSantri, setEditingSantri] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'nama_lengkap', direction: 'ascending' });
  const [selectedSantri, setSelectedSantri] = useState(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const photoInputRef = React.useRef(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', description: '', onConfirm: () => {} });
  const [previewImage, setPreviewImage] = useState(null);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [birthdayCount, setBirthdayCount] = useState(0);
  const [birthdayStudents, setBirthdayStudents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSantri, setTotalSantri] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [formData, setFormData] = useState({
    nama_lengkap: '', nama_panggilan: '', nomor_induk_qiroati: '', jenis_kelamin: 'Laki-laki', tempat_lahir: '', tanggal_lahir: '', tanggal_pendaftaran: '',
    nama_ayah: '', nama_ibu: '', no_hp_ortu: '', alamat: '', status: 'Aktif', foto_url: '', password: '', sesi_mengaji: '', rfid_tag: '',
    jilid: subCategory === 'ptpt' ? 'Juz 30' : 'Pra TK A', no_kk: '', no_nik: '', berkas_foto: false, berkas_akta: false, berkas_kk: false, berkas_form: false, link_qiroati: '', default_spp_amount: '', id_kelas: null, points: 0, kategori: subCategory === 'ptpt' ? 'PTPT' : 'Anak'
  });

  useEffect(() => {
      setBirthdayCount(getBirthdaysThisMonth(birthdayStudents).length);
  }, [birthdayStudents]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedSantri(new Set());
  }, [subCategory, filters.sesi, filters.jilid, filters.rfid, debouncedSearch, sortConfig]);

  const loadData = useCallback(async (currentTab = subCategory) => {
    setIsLoadingData(true);
    setFetchError(null);
    try {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const normalizedSearch = debouncedSearch.replace(/[%_,().]/g, ' ').trim();
      const categoryValues = currentTab === 'ptpt' ? ['PTPT', 'ptpt'] : ['Anak', 'anak', 'TPQ', 'tpq'];
      const sortColumn = ['nama_lengkap', 'tanggal_pendaftaran', 'jenis_kelamin', 'jilid', 'sesi_mengaji'].includes(sortConfig.key)
        ? sortConfig.key
        : 'nama_lengkap';

      const fetchSantri = async (selectColumns = SANTRI_EXTENDED_SELECT) => {
        let query = supabase
          .from('santri')
          .select(selectColumns, { count: 'exact' })
          .is('deleted_at', null)
          .in('kategori', categoryValues)
          .or('status.is.null,status.ilike.aktif,status.ilike.active');

        if (normalizedSearch) {
          query = query.or(`nama_lengkap.ilike.%${normalizedSearch}%,nama_panggilan.ilike.%${normalizedSearch}%,nama_ayah.ilike.%${normalizedSearch}%,rfid_tag.ilike.%${normalizedSearch}%`);
        }
        if (filters.sesi !== 'all') query = query.in('sesi_mengaji', [String(getSessionNumber(filters.sesi)), filters.sesi]);
        if (filters.jilid !== 'all') query = query.eq('jilid', filters.jilid);
        if (filters.rfid === 'assigned') query = query.not('rfid_tag', 'is', null).neq('rfid_tag', '');
        if (filters.rfid === 'unassigned') query = query.or('rfid_tag.is.null,rfid_tag.eq.');

        return query
          .order(sortColumn, { ascending: sortConfig.direction === 'ascending', nullsFirst: false })
          .range(from, to);
      };

      const [santriRes, classesRes, birthdayRes] = await Promise.all([
        fetchSantri(),
        supabase.from('classes').select('id, nama_kelas, guru:id_guru(nama)'),
        supabase
          .from('santri')
          .select('id, nama_lengkap, tanggal_lahir, no_hp_ortu, foto_url, avatar_path')
          .is('deleted_at', null)
          .or('status.is.null,status.ilike.aktif,status.ilike.active')
      ]);

      const resolvedSantriRes = isMissingSantriExtendedColumn(santriRes.error)
        ? await fetchSantri(SANTRI_BASE_SELECT)
        : santriRes;

      if (resolvedSantriRes.error) {
          console.error("Query execution error for santri:", resolvedSantriRes.error);
          setFetchError(resolvedSantriRes.error.message);
          toast({ title: "Gagal Memuat Data Santri", description: resolvedSantriRes.error.message, variant: "destructive" });
      } else {
          const mappedSantri = await Promise.all((resolvedSantriRes.data || []).map(async (item) => {
              const foto_url = await resolveAvatarUrl({
                  ownerType: 'santri',
                  ownerId: item.id,
                  avatarPath: item.avatar_path,
                  fallbackUrl: item.foto_url,
              });
              return mapSantriForLegacyUi({ ...item, foto_url });
          }));
          setSantriList(mappedSantri);
          setTotalSantri(resolvedSantriRes.count || 0);

          const totalPages = Math.max(1, Math.ceil((resolvedSantriRes.count || 0) / PAGE_SIZE));
          if (currentPage > totalPages) setCurrentPage(totalPages);
      }

      if (!birthdayRes.error) {
        const birthdaysThisMonth = getBirthdaysThisMonth(birthdayRes.data || []);
        const resolvedBirthdays = await Promise.all(birthdaysThisMonth.map(async (item) => ({
          ...item,
          foto_url: await resolveAvatarUrl({
            ownerType: 'santri',
            ownerId: item.id,
            avatarPath: item.avatar_path,
            fallbackUrl: item.foto_url,
          }),
        })));
        setBirthdayStudents(resolvedBirthdays);
      }

      if (classesRes.error) {
          toast({ title: "Error", description: "Gagal memuat data kelas.", variant: "destructive" });
      } else {
          const tpqClasses = (classesRes.data || []).filter(c => !c.kategori || c.kategori.toLowerCase() === 'anak' || c.kategori.toLowerCase() === 'ptpt');
          setClassesList(tpqClasses);
      }

      const mappedSessions = getAllSessions().map(s => s.name);
      setSessionOptions(mappedSessions);
      setFormData(prev => editingSantri ? prev : ({...prev, sesi_mengaji: mappedSessions[0] || ''}));

    } catch (err) {
      console.error('Unexpected error during loadData:', err);
      setFetchError(err.message);
      toast({ title: "Error Sistem", description: "Terjadi kesalahan tidak terduga saat mengambil data.", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [currentPage, debouncedSearch, filters.jilid, filters.rfid, filters.sesi, sortConfig, subCategory]);

  useEffect(() => {
    loadData(subCategory);
  }, [loadData, subCategory]);

  const classGuruMap = useMemo(() => {
    return classesList.reduce((acc, cls) => {
      acc[cls.id] = cls.guru?.nama || 'Belum ada guru';
      return acc;
    }, {});
  }, [classesList]);

  const handleDownloadData = async () => {
    try {
      const XLSX = await loadXlsx();
      const normalizedSearch = filters.search.replace(/[%_,().]/g, ' ').trim();
      const categoryValues = subCategory === 'ptpt' ? ['PTPT', 'ptpt'] : ['Anak', 'anak', 'TPQ', 'tpq'];
      let query = supabase
        .from('santri')
        .select(SANTRI_EXTENDED_SELECT)
        .is('deleted_at', null)
        .in('kategori', categoryValues)
        .or('status.is.null,status.ilike.aktif,status.ilike.active');

      if (normalizedSearch) {
        query = query.or(`nama_lengkap.ilike.%${normalizedSearch}%,nama_panggilan.ilike.%${normalizedSearch}%,nama_ayah.ilike.%${normalizedSearch}%,rfid_tag.ilike.%${normalizedSearch}%`);
      }
      if (filters.sesi !== 'all') query = query.in('sesi_mengaji', [String(getSessionNumber(filters.sesi)), filters.sesi]);
      if (filters.jilid !== 'all') query = query.eq('jilid', filters.jilid);
      if (filters.rfid === 'assigned') query = query.not('rfid_tag', 'is', null).neq('rfid_tag', '');
      if (filters.rfid === 'unassigned') query = query.or('rfid_tag.is.null,rfid_tag.eq.');

      const { data, error } = await query.order('nama_lengkap').range(0, 4999);
      if (error) throw error;

      const dataToExport = (data || []).map(mapSantriForLegacyUi).map(s => ({
          'Nama Lengkap': s.nama_lengkap, 'Nama Panggilan': s.nama_panggilan, 'Jilid': s.jilid, 'Tempat Lahir': s.tempat_lahir,
          'Tanggal Lahir': s.tanggal_lahir, 'Jenis Kelamin': s.jenis_kelamin, 'Alamat': s.alamat, 'Sesi': getSessionName(s.sesi_mengaji),
          'Tanggal Masuk': s.tanggal_pendaftaran, 'Nama Ibu': s.nama_ibu, 'Nama Ayah': s.nama_ayah, 'No. HP Wali': s.no_hp_ortu,
          'No. KK': s.no_kk, 'No. NIK': s.no_nik, 'No. Induk Qiroati': s.nomor_induk_qiroati, 'Status': s.status, 'RFID': s.rfid_tag, 'Kategori': s.kategori
      }));
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Data Santri ${subCategory.toUpperCase()}`);
      XLSX.writeFile(workbook, `Data_Santri_${subCategory.toUpperCase()}.xlsx`);
    } catch (error) {
      toast({ title: 'Export gagal', description: error.message || 'Data santri tidak dapat diekspor.', variant: 'destructive' });
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!editingSantri?.id) {
        toast({ title: "Simpan Akun Terlebih Dahulu", description: "Avatar memakai path berdasarkan UUID akun. Simpan data santri sebelum upload foto.", variant: "destructive" });
        e.target.value = '';
        return;
    }

    setIsUploading(true);

    try {
        const { path, signedUrl } = await uploadAvatar({ ownerType: 'santri', ownerId: editingSantri.id, file });
        const { data, error } = await supabase
            .from('santri')
            .update({ avatar_path: path })
            .eq('id', editingSantri.id)
            .select('id, avatar_path, foto_url')
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Avatar terunggah, tetapi referensi profil santri tidak tersimpan.');

        const finalUrl = signedUrl || formData.foto_url || '';
        setFormData(prev => ({ ...prev, avatar_path: path, foto_url: finalUrl }));
        setEditingSantri(prev => prev ? ({ ...prev, avatar_path: path, foto_url: finalUrl }) : prev);
        setSantriList(prev => prev.map(item => item.id === editingSantri.id ? ({ ...item, avatar_path: path, foto_url: finalUrl }) : item));
        toast({ title: "Upload Berhasil", description: "Avatar tersimpan dan akan tetap muncul setelah refresh." });
    } catch (error) {
        toast({ title: "Upload Gagal", description: getStorageErrorMessage(error), variant: "destructive" });
    } finally {
        setIsUploading(false);
        e.target.value = '';
    }
  };

  const triggerPhotoUpload = () => photoInputRef.current?.click();

  const handleNicknameChange = (e) => {
    const nickname = e.target.value.replace(/\s/g, '');
    const capitalized = nickname.charAt(0).toUpperCase() + nickname.slice(1);
    setFormData(prev => ({ ...prev, nama_panggilan: capitalized }));
  };

  const handleQiroatiIdChange = (e) => {
    const qiroatiId = e.target.value;
    setFormData(prev => ({ ...prev, nomor_induk_qiroati: qiroatiId, password: qiroatiId }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalFormData = { ...formData, kategori: subCategory === 'ptpt' ? 'PTPT' : 'Anak' };
    finalFormData.nomor_induk_qiroati = normalizeNomorIndukQiroati(finalFormData.nomor_induk_qiroati);

    // Ensure we save the numeric equivalent for sesi to match backend constraints
    if (finalFormData.sesi_mengaji) {
        finalFormData.sesi_mengaji = getSessionNumber(finalFormData.sesi_mengaji);
    }

    const requiredFields = [
      ['nama_lengkap', 'Nama lengkap'],
      ['tanggal_lahir', 'Tanggal lahir'],
      ['jenis_kelamin', 'Jenis kelamin'],
      ['jilid', subCategory === 'ptpt' ? 'Target tahfizh' : 'Jilid'],
      ['sesi_mengaji', 'Sesi'],
    ];
    const missingField = requiredFields.find(([field]) => !String(finalFormData[field] ?? '').trim());
    if (missingField) {
        toast({ title: "Gagal", description: `${missingField[1]} wajib diisi.`, variant: "destructive"});
        return;
    }

    if (!finalFormData.nama_panggilan) {
        finalFormData.nama_panggilan = finalFormData.nama_lengkap.trim().split(/\s+/)[0] || null;
    }

    if (!finalFormData.password) finalFormData.password = finalFormData.nomor_induk_qiroati;

    if (finalFormData.password && finalFormData.password.length < 4) {
        toast({ title: "Validasi Password Gagal", description: "Password minimal 4 karakter.", variant: "destructive" });
      return;
    }

    if (finalFormData.default_spp_amount !== '' && finalFormData.default_spp_amount !== null) {
      const defaultSppAmount = Number(finalFormData.default_spp_amount);
      if (!Number.isFinite(defaultSppAmount) || defaultSppAmount < 10000) {
        toast({ title: "Default SPP Tidak Valid", description: "Default SPP minimal Rp10.000 atau kosongkan jika belum ditentukan.", variant: "destructive" });
        return;
      }
      finalFormData.default_spp_amount = defaultSppAmount;
    }

    try {
      let targetId = editingSantri?.id;

      if (!editingSantri) {
        if (!enableEdgeFunctions) {
          toast({ title: "Fitur belum aktif", description: edgeFunctionDisabledMessage, variant: "destructive" });
          return;
        }
        const { data, error } = await supabase.functions.invoke('manage-user', {
          body: {
            action: 'create',
            role: 'santri',
            profile: pickSantriProfileFields(finalFormData),
            initial_password: finalFormData.password,
          },
        });

        if (error) {
          throw new Error(await getFunctionErrorMessage(error, 'Akun santri gagal dibuat.'));
        }
        if (!data?.ok || !data?.data?.user_id) {
          throw new Error(data?.error?.message || 'Akun santri gagal dibuat.');
        }
        targetId = data.data.user_id;
      }

      const profilePayload = editingSantri
        ? pickChangedSantriProfileFields(finalFormData, editingSantri)
        : pickSantriProfileFields(finalFormData);
      const selectedClassId = getSelectedClassId(finalFormData);
      const originalClassId = getSelectedClassId(editingSantri);
      const classChanged = Boolean(selectedClassId) && selectedClassId !== originalClassId;
      const shouldArchiveAfterSave = String(finalFormData.status || '').toLowerCase() === 'nonaktif';

      if (Object.prototype.hasOwnProperty.call(profilePayload, 'current_class_id')) {
        delete profilePayload.current_class_id;
      }
      if (shouldArchiveAfterSave) delete profilePayload.status;

      if (editingSantri && Object.keys(profilePayload).length === 0 && !classChanged && !shouldArchiveAfterSave) {
        toast({
          title: "Tidak ada perubahan",
          description: "Tidak ada field santri yang berbeda dari data tersimpan. Ubah minimal satu field lalu simpan kembali.",
          variant: "destructive"
        });
        return;
      }

      const needsAuthEdgeFunction = shouldArchiveAfterSave;
      if (needsAuthEdgeFunction && !enableEdgeFunctions) {
        toast({ title: "Fitur belum aktif", description: edgeFunctionDisabledMessage, variant: "destructive" });
        return;
      }

      if (editingSantri && Object.prototype.hasOwnProperty.call(profilePayload, 'nomor_induk_qiroati')) {
        if (!enableEdgeFunctions) {
          toast({ title: "Fitur belum aktif", description: edgeFunctionDisabledMessage, variant: "destructive" });
          return;
        }

        const { data, error } = await supabase.functions.invoke('manage-user', {
          body: {
            action: 'update',
            role: 'santri',
            target_user_id: targetId,
            profile: { nomor_induk_qiroati: profilePayload.nomor_induk_qiroati },
          },
        });

        if (error) throw new Error(await getFunctionErrorMessage(error, 'Login santri gagal disinkronkan.'));
        if (!data?.ok) throw new Error(data?.error?.message || 'Login santri gagal disinkronkan.');
        delete profilePayload.nomor_induk_qiroati;
      }

      if (Object.keys(profilePayload).length > 0) {
        const { data: savedSantri, error } = await supabase
          .from('santri')
          .update(profilePayload)
          .eq('id', targetId)
          .select('id')
          .maybeSingle();

        if (error) throw error;
        if (!savedSantri) throw new Error('Data santri tidak tersimpan karena tidak ada row yang diperbarui.');
      }

      if (classChanged) {
        const { error: classError } = await supabase.rpc('move_santri_to_class', {
          p_santri_id: targetId,
          p_to_class_id: selectedClassId,
          p_reason: editingSantri ? 'Perubahan kelas dari Data Santri' : 'Penempatan kelas awal dari Data Santri',
        });
        if (classError) throw classError;
      }

      if (shouldArchiveAfterSave) {
        await archiveSantriAccounts([targetId], 'Dinonaktifkan melalui form Data Santri');
      }

      toast({
        title: "Berhasil!",
        description: shouldArchiveAfterSave
          ? "Data santri tersimpan dan dipindahkan ke arsip."
          : (editingSantri ? "Data santri berhasil diperbarui" : "Santri baru berhasil ditambahkan"),
      });
      await loadData(subCategory);
      window.dispatchEvent(new CustomEvent('lpq:santri-data-changed'));
      setIsFormOpen(false);
      resetForm();
    } catch (error) {
      toast({ title: "Gagal!", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (santri) => {
    setEditingSantri(santri);
    setFormData({...santri, points: santri.points || 0, sesi_mengaji: getSessionName(santri.sesi_mengaji)});
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (selectedSantri.size === 0) return;
    const idsToDelete = Array.from(selectedSantri);

    setConfirmDialog({
      isOpen: true,
      title: 'Pindahkan ke Arsip',
      description: `${selectedSantri.size} santri akan dinonaktifkan dan dipindahkan ke arsip. Kelas, hafalan, karakter, absensi, pembayaran, dan seluruh riwayat tetap tersimpan serta dapat dipulihkan kapan saja.`,
      onConfirm: async () => {
        if (!enableEdgeFunctions) {
          toast({ title: "Fitur belum aktif", description: edgeFunctionDisabledMessage, variant: "destructive" });
          return;
        }

        try {
          await archiveSantriAccounts(idsToDelete, 'Dipindahkan ke arsip dari Data Santri');
          await loadData(subCategory);
          window.dispatchEvent(new CustomEvent('lpq:santri-data-changed'));
          setSelectedSantri(new Set());
          toast({ title: "Masuk arsip", description: "Santri terpilih telah diarsipkan tanpa menghapus riwayatnya." });
        } catch (error) {
          toast({ title: "Gagal!", description: error.message, variant: "destructive" });
        }
      }
    });
  };

  const handleBulkStatusChange = async (status) => {
    if (selectedSantri.size === 0) return;
    const confirmationText = status === 'Aktif' ? 'mengaktifkan' : 'menonaktifkan';
    setConfirmDialog({
      isOpen: true,
      title: 'Ubah Status Santri',
      description: `Yakin ingin ${confirmationText} ${selectedSantri.size} data santri terpilih?`,
      onConfirm: async () => {
        const idsToUpdate = Array.from(selectedSantri);

        if (!enableEdgeFunctions) {
          toast({ title: "Fitur belum aktif", description: edgeFunctionDisabledMessage, variant: "destructive" });
          return;
        }

        try {
          await archiveSantriAccounts(idsToUpdate, 'Dinonaktifkan dari Data Santri');
          await loadData(subCategory);
          window.dispatchEvent(new CustomEvent('lpq:santri-data-changed'));
          setSelectedSantri(new Set());
          toast({ title: "Santri dinonaktifkan", description: "Data dipindahkan ke arsip dan dapat dipulihkan kapan saja." });
        } catch (error) {
          toast({ title: "Gagal!", description: error.message, variant: "destructive" });
        }
      }
    });
  };

  const getMigrationLabel = (targetCategory) => targetCategory === 'Anak' ? 'TPQ' : targetCategory;

  const migrateSantriCategory = async (santriId, targetCategory, reason) => {
      const { data, error } = await supabase.rpc('change_santri_category', {
          p_santri_id: santriId,
          p_target_category: targetCategory,
          p_reason: reason,
      });
      if (error) throw error;
      return data?.[0];
  };

  const handleMigration = async (targetCategory) => {
      if (!editingSantri) return;
      const targetLabel = getMigrationLabel(targetCategory);

      setConfirmDialog({
          isOpen: true,
          title: `Migrasi ke ${targetLabel}`,
          description: `Yakin ingin memindahkan ${editingSantri.nama_lengkap} ke kategori ${targetLabel}? Santri akan dikeluarkan dari kelas saat ini.`,
          onConfirm: async () => {
              try {
                  const result = await migrateSantriCategory(
                      editingSantri.id,
                      targetCategory,
                      `Migrasi ke ${targetLabel} melalui Edit Data Santri`,
                  );
                  toast({ title: 'Migrasi berhasil', description: result?.message || `${editingSantri.nama_lengkap} dipindahkan ke kategori ${targetLabel}.` });
                  setIsFormOpen(false);
                  setEditingSantri(null);
                  await loadData(subCategory);
              } catch (error) {
                  toast({ title: 'Migrasi gagal', description: error.message, variant: 'destructive' });
              }
          }
      });
  };

  const handleBulkMigration = (targetCategory) => {
      if (selectedSantri.size === 0) return;
      const targetLabel = getMigrationLabel(targetCategory);
      const selectedIds = Array.from(selectedSantri);

      setConfirmDialog({
          isOpen: true,
          title: `Migrasi ${selectedIds.length} Santri ke ${targetLabel}`,
          description: `Kelas aktif seluruh santri terpilih akan dilepas sebelum dipindahkan ke kategori ${targetLabel}.`,
          onConfirm: async () => {
              let migrated = 0;
              const failures = [];

              for (const santriId of selectedIds) {
                  try {
                      await migrateSantriCategory(
                          santriId,
                          targetCategory,
                          `Migrasi massal ke ${targetLabel} dari tabel Data Santri`,
                      );
                      migrated += 1;
                  } catch (error) {
                      failures.push(error?.message || 'Migrasi gagal');
                  }
              }

              await loadData(subCategory);
              setSelectedSantri(new Set());
              window.dispatchEvent(new CustomEvent('lpq:santri-data-changed'));

              if (failures.length > 0) {
                  toast({
                      title: 'Migrasi selesai sebagian',
                      description: `${migrated} berhasil, ${failures.length} gagal. ${failures[0]}`,
                      variant: 'destructive',
                  });
              } else {
                  toast({ title: 'Migrasi berhasil', description: `${migrated} santri dipindahkan ke kategori ${targetLabel}.` });
              }
          },
      });
  };

  const toggleSelect = (id) => {
    const newSelection = new Set(selectedSantri);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedSantri(newSelection);
  };

  const toggleSelectAll = (isChecked) => {
    if (isChecked) setSelectedSantri(new Set(sortedAndFilteredSantri.map(s => s.id)));
    else setSelectedSantri(new Set());
  };

  const resetForm = () => {
    setFormData({
      nama_lengkap: '', nama_panggilan: '', nomor_induk_qiroati: '', jenis_kelamin: 'Laki-laki', tempat_lahir: '', tanggal_lahir: '', tanggal_pendaftaran: '',
      nama_ayah: '', nama_ibu: '', no_hp_ortu: '', alamat: '', status: 'Aktif', foto_url: '', password: '', sesi_mengaji: sessionOptions[0] || 'Pagi', rfid_tag: '',
      jilid: subCategory === 'ptpt' ? 'Juz 30' : 'Pra TK A', no_kk: '', no_nik: '', berkas_foto: false, berkas_akta: false, berkas_kk: false, berkas_form: false, link_qiroati: '', id_kelas: null, points: 0, kategori: subCategory === 'ptpt' ? 'PTPT' : 'Anak'
    });
    setEditingSantri(null);
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key, direction });
  };

  const handleCopyRFID = async (rfid) => {
    if (!rfid) {
        toast({ title: "Gagal", description: "Tidak ada RFID tag untuk disalin.", variant: "destructive" });
        return;
    }
    try {
        await copyTextToClipboard(rfid);
        toast({
            title: "RFID disalin",
            description: "RFID tag disalin ke clipboard.",
            className: "bg-green-50 border-green-200 text-green-700",
            action: <CheckCircle className="w-5 h-5 text-green-600"/>
        });
    } catch {
        toast({ title: "Gagal Copy", description: "Tidak bisa menyalin RFID.", variant: "destructive" });
    }
  };

  const handleCopyIndukQiroati = async (induk) => {
    if (!induk) {
        toast({ title: "Gagal", description: "Nomor Induk Qiroati tidak tersedia.", variant: "destructive" });
        return;
    }
    try {
        await copyTextToClipboard(induk);
        toast({
            title: "Nomor Induk disalin",
            description: "Nomor induk disalin ke clipboard.",
            className: "bg-green-50 border-green-200 text-green-700",
            action: <CheckCircle className="w-5 h-5 text-green-600"/>
        });
    } catch {
        toast({ title: "Gagal Copy", description: "Tidak bisa menyalin Nomor Induk.", variant: "destructive" });
    }
  };

  const sortedAndFilteredSantri = useMemo(() => {
    let sortableItems = [...santriList];
    if (filters.sesi !== 'all') sortableItems = sortableItems.filter(s => getSessionName(s.sesi_mengaji) === filters.sesi);
    if (filters.jilid !== 'all') sortableItems = sortableItems.filter(s => s.jilid === filters.jilid);
    if (filters.rfid !== 'all') {
        sortableItems = sortableItems.filter(s => filters.rfid === 'assigned' ? !!s.rfid_tag : !s.rfid_tag);
    }
    if (filters.search) {
      const lowercasedFilter = filters.search.toLowerCase();
      sortableItems = sortableItems.filter(s =>
        s.nama_lengkap.toLowerCase().includes(lowercasedFilter) ||
        (s.nama_panggilan && s.nama_panggilan.toLowerCase().includes(lowercasedFilter)) ||
        (s.nama_ayah && s.nama_ayah.toLowerCase().includes(lowercasedFilter)) ||
        (s.rfid_tag && s.rfid_tag.toLowerCase().includes(lowercasedFilter))
      );
    }
    sortableItems.sort((a, b) => {
      if (sortConfig.key === 'guru_pengampu') {
        const nameA = classGuruMap[a.current_class_id || a.id_kelas] || 'zzzz';
        const nameB = classGuruMap[b.current_class_id || b.id_kelas] || 'zzzz';
        if (nameA < nameB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (nameA > nameB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      }
      if (!a[sortConfig.key] || !b[sortConfig.key]) return 0;
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });
    return sortableItems;
  }, [santriList, filters, sortConfig, classGuruMap]);

  return (
    <div>
      <div className="admin-panel-header">
          <div className="flex items-center gap-3">
             <div className="admin-panel-header-icon">
                <Users />
             </div>
             <div className="admin-panel-header-text">
                <h2>Manajemen Santri ({subCategory.toUpperCase()})</h2>
                <p>Kelola data santri, {subCategory === 'ptpt' ? 'target tahfizh' : 'jilid'}, dan status aktif.</p>
             </div>
          </div>

          <div className="admin-panel-header-actions">
            <button onClick={() => setIsArchiveOpen(true)} className="admin-action-cluster-btn">
                <Archive className="w-4 h-4" /> Arsip
            </button>
            <button
                onClick={() => setIsBirthdayModalOpen(true)}
                className="admin-action-cluster-btn relative"
                style={{ border: '1px solid hsl(330 80% 85%)', color: 'hsl(330 60% 55%)' }}
            >
                <Cake className="w-4 h-4" />
                {birthdayCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full shadow-sm animate-bounce leading-none">
                        {birthdayCount}
                    </span>
                )}
            </button>

            {selectedSantri.size > 0 && (
                <div className="admin-bulk-bar">
                    {subCategory === 'ptpt' && (
                        <button onClick={() => handleBulkMigration('Anak')} className="admin-bulk-btn">
                            <ArrowRightLeft className="w-3.5 h-3.5"/> Ke TPQ
                        </button>
                    )}
                    {subCategory !== 'ptpt' && (
                        <button onClick={() => handleBulkMigration('PTPT')} className="admin-bulk-btn">
                            <ArrowRightLeft className="w-3.5 h-3.5"/> Ke PTPT
                        </button>
                    )}
                    <button onClick={() => handleBulkMigration('Dewasa')} className="admin-bulk-btn">
                        <ArrowRightLeft className="w-3.5 h-3.5"/> Ke Dewasa
                    </button>
                    <button onClick={() => handleBulkStatusChange('Nonaktif')} className="admin-bulk-btn admin-bulk-btn--deactivate">
                        <XCircle className="w-3.5 h-3.5"/> Non-Aktif
                    </button>
                    <button onClick={handleDelete} className="admin-bulk-btn admin-bulk-btn--delete">
                        <Archive className="w-3.5 h-3.5"/> Arsipkan ({selectedSantri.size})
                    </button>
                </div>
            )}
            <div className="admin-action-cluster">
                 <button onClick={() => setIsBulkUploadOpen(true)} className="admin-action-cluster-btn">
                    <Upload className="w-3.5 h-3.5"/> Import
                 </button>
                 <button onClick={handleDownloadData} className="admin-action-cluster-btn">
                    <Download className="w-3.5 h-3.5"/> Export
                 </button>
            </div>
            <button onClick={() => { resetForm(); setIsFormOpen(true); }} className="admin-panel-primary-btn">
                <Plus className="w-4 h-4"/> Tambah Santri
            </button>
          </div>
      </div>

       <div className="admin-filter-bar">
            <div className="admin-search-input">
                <Search />
                <Input
                    placeholder="Cari santri berdasarkan nama, wali, atau RFID..."
                    value={filters.search}
                    onChange={e => setFilters(f => ({...f, search: e.target.value}))}
                />
            </div>
            <div className="admin-filter-selects">
                <Select value={filters.sesi} onValueChange={val => setFilters(f => ({...f, sesi: val}))}>
                    <SelectTrigger><SelectValue placeholder="Sesi" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Semua Sesi</SelectItem>{sessionOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.jilid} onValueChange={val => setFilters(f => ({...f, jilid: val}))}>
                    <SelectTrigger><SelectValue placeholder={subCategory === 'ptpt' ? 'Target Tahfizh' : 'Jilid'} /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Semua {subCategory === 'ptpt' ? 'Target' : 'Jilid'}</SelectItem>{academicLevelOptions.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.rfid} onValueChange={val => setFilters(f => ({...f, rfid: val}))}>
                    <SelectTrigger><SelectValue placeholder="RFID" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Semua RFID</SelectItem><SelectItem value="assigned">Ada RFID</SelectItem><SelectItem value="unassigned">Tanpa RFID</SelectItem></SelectContent>
                </Select>
            </div>
       </div>

      {fetchError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl mb-4 flex items-center justify-between">
          <p className="font-medium">Gagal memuat data santri: <span className="font-normal">{fetchError}</span></p>
          <Button variant="outline" size="sm" onClick={() => loadData(subCategory)}>Coba Lagi</Button>
        </div>
      )}

      <div className="admin-table-shell">
        {isLoadingData && (
            <div className="admin-table-loading">
                <div className="admin-table-loading-spinner"></div>
                <p>Sedang memproses data...</p>
            </div>
        )}
        <div className="admin-table-scroll">
        <table>
          <thead>
            <tr>
              <th className="p-3 w-10"><Checkbox onCheckedChange={toggleSelectAll} checked={sortedAndFilteredSantri.length > 0 && selectedSantri.size === sortedAndFilteredSantri.length} /></th>
              <th className="p-3 text-left w-12 text-xs font-semibold text-muted-foreground uppercase tracking-wider">No.</th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('nama_lengkap')}><div className="flex items-center">Nama <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('tanggal_pendaftaran')}><div className="flex items-center">Tgl Masuk <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('jenis_kelamin')}><div className="flex items-center">L/P <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('guru_pengampu')}><div className="flex items-center">Guru Pengampu <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('jilid')}><div className="flex items-center">{subCategory === 'ptpt' ? 'Target' : 'Jilid'} <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('sesi_mengaji')}><div className="flex items-center">Sesi <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Berkas</th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-950 divide-y divide-slate-100 dark:divide-slate-800">
            {sortedAndFilteredSantri.map((santri, index) => (
              <tr key={santri.id} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group">
                <td className="p-3"><Checkbox onCheckedChange={() => toggleSelect(santri.id)} checked={selectedSantri.has(santri.id)} /></td>
                <td className="p-3 text-muted-foreground font-mono text-xs">{((currentPage - 1) * PAGE_SIZE) + index + 1}</td>
                <td className="p-3">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-700 cursor-pointer hover:scale-105 transition-transform" onClick={() => setPreviewImage(santri.foto_url)}>
                            <AvatarImage src={santri.foto_url} />
                            <AvatarFallback className="bg-blue-100 text-blue-700 font-bold text-xs">{santri.nama_lengkap.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <button
                                type="button"
                                className="font-medium text-left text-foreground cursor-pointer hover:text-blue-600 hover:underline flex items-center gap-1 group/name focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-sm"
                                onClick={() => handleCopyRFID(santri.rfid_tag)}
                                title="Klik untuk menyalin RFID"
                                aria-label={`Salin RFID ${santri.nama_lengkap}`}
                            >
                                {santri.nama_lengkap}
                                <Copy className="w-3 h-3 opacity-0 group-hover/name:opacity-50" />
                            </button>
                            <button
                                type="button"
                                className="text-xs text-left text-muted-foreground font-mono cursor-pointer hover:text-green-600 hover:underline flex items-center gap-1 group/nick focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded-sm"
                                onClick={() => handleCopyIndukQiroati(santri.nomor_induk_qiroati)}
                                title="Klik untuk menyalin No Induk Qiroati"
                                aria-label={`Salin Nomor Induk Qiroati ${santri.nama_panggilan || santri.nama_lengkap}`}
                            >
                                {santri.nama_panggilan}
                                <Copy className="w-3 h-3 opacity-0 group-hover/nick:opacity-50" />
                            </button>
                        </div>
                    </div>
                </td>
                <td className="p-3 text-sm text-muted-foreground">{new Date(santri.tanggal_pendaftaran).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: '2-digit'})}</td>
                <td className="p-3"><Badge variant="outline" className={santri.jenis_kelamin === 'Laki-laki' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-pink-50 text-pink-700 border-pink-200"}>{santri.jenis_kelamin === 'Laki-laki' ? 'L' : 'P'}</Badge></td>
                <td className="p-3 text-sm font-medium text-foreground">{classGuruMap[santri.current_class_id || santri.id_kelas] || <span className="text-muted-foreground italic text-xs">Belum ada</span>}</td>
                <td className="p-3"><Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200">{santri.jilid}</Badge></td>
                <td className="p-3"><span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{getSessionName(santri.sesi_mengaji)}</span></td>
                <td className="p-3"><div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 border"><FileCheck className={`w-4 h-4 ${santri.berkas_foto && santri.berkas_akta && santri.berkas_kk && santri.berkas_form ? 'text-green-500' : 'text-slate-300'}`} /></div></td>
                <td className="p-3"><Button onClick={() => handleEdit(santri)} size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 rounded-full"><Edit className="w-4 h-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoadingData && sortedAndFilteredSantri.length === 0 && !fetchError && (
            <div className="admin-table-empty">
                <Search />
                <p>Tidak ada data santri ditemukan.</p>
            </div>
        )}
        </div>
        <DataPagination
          currentPage={currentPage}
          totalItems={totalSantri}
          pageSize={PAGE_SIZE}
          onPageChange={(page) => {
            setSelectedSantri(new Set());
            setCurrentPage(page);
          }}
          itemLabel="santri"
        />
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>{editingSantri ? `Edit Data Santri ${subCategory.toUpperCase()}` : `Tambah Santri ${subCategory.toUpperCase()} Baru`}</DialogTitle></DialogHeader>

          <form onSubmit={handleSubmit} className="admin-edit-shell">
            <div className="admin-edit-body">

                {/* 1. Header & Photo Section */}
                <div className="admin-edit-photo-area">
                    <Avatar className="w-20 h-20 border-2 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0" style={{ borderColor: 'hsl(var(--admin-border))' }} onClick={() => formData.foto_url && setPreviewImage(formData.foto_url)}>
                        <AvatarImage src={formData.foto_url} />
                        <AvatarFallback style={{ backgroundColor: 'hsl(var(--admin-accent-soft))', color: 'hsl(var(--admin-accent))' }}><Upload className="w-6 h-6" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 w-full space-y-2">
                        <div className="flex gap-2 flex-wrap">
                             <Button type="button" onClick={triggerPhotoUpload} variant="outline" size="sm" disabled={isUploading || !editingSantri?.id} title={!editingSantri?.id ? 'Simpan akun sebelum upload avatar.' : undefined}>{isUploading ? 'Mengunggah...' : 'Upload Foto'}</Button>
                             <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} className="hidden" />
                        </div>
                        <p className="text-[10px]" style={{ color: 'hsl(var(--admin-text-muted))' }}>JPG, PNG, WebP (Max 2 MB). Simpan akun baru sebelum upload.</p>
                        <div className="relative">
                            <Input type="text" placeholder="https://example.com/foto.jpg" value={formData.foto_url || ''} onChange={(e) => setFormData({ ...formData, foto_url: e.target.value })} className="pl-9 text-xs" />
                            <Upload className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'hsl(var(--admin-text-muted))' }}/>
                        </div>
                    </div>
                </div>

                {/* 2. Personal Information Section */}
                <div className="admin-edit-section">
                    <div className="admin-edit-section-header"><User /> Informasi Pribadi</div>
                    <div className="admin-edit-field-grid">
                        <div className="admin-edit-field"><label>Nama Lengkap</label><Input type="text" value={formData.nama_lengkap || ''} onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })} required /></div>
                        <div className="admin-edit-field"><label>Nama Panggilan</label><Input type="text" value={formData.nama_panggilan || ''} onChange={handleNicknameChange} /></div>
                        <div className="admin-edit-field"><label>Jenis Kelamin</label><Select value={formData.jenis_kelamin} onValueChange={val => setFormData({ ...formData, jenis_kelamin: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Laki-laki">Laki-laki</SelectItem><SelectItem value="Perempuan">Perempuan</SelectItem></SelectContent></Select></div>
                        <div className="admin-edit-field"><label>Tempat Lahir</label><Input type="text" value={formData.tempat_lahir || ''} onChange={(e) => setFormData({ ...formData, tempat_lahir: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>Tanggal Lahir</label><Input type="date" value={formData.tanggal_lahir || ''} onChange={(e) => setFormData({ ...formData, tanggal_lahir: e.target.value })} required /></div>
                        <div className="admin-edit-field"><label>Tanggal Masuk</label><Input type="date" value={formData.tanggal_pendaftaran || ''} onChange={(e) => setFormData({ ...formData, tanggal_pendaftaran: e.target.value })} /></div>
                    </div>
                </div>

                {/* 3. Family & Contact Section */}
                <div className="admin-edit-section">
                    <div className="admin-edit-section-header"><Users /> Keluarga & Kontak</div>
                    <div className="admin-edit-field-grid">
                        <div className="admin-edit-field"><label>Nama Ayah</label><Input type="text" value={formData.nama_ayah || ''} onChange={(e) => setFormData({ ...formData, nama_ayah: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>Nama Ibu</label><Input type="text" value={formData.nama_ibu || ''} onChange={(e) => setFormData({ ...formData, nama_ibu: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>No. HP Wali</label><Input type="tel" value={formData.no_hp_ortu || ''} onChange={(e) => setFormData({ ...formData, no_hp_ortu: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>No. KK</label><Input type="text" value={formData.no_kk || ''} onChange={(e) => setFormData({ ...formData, no_kk: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>No. NIK</label><Input type="text" value={formData.no_nik || ''} onChange={(e) => setFormData({ ...formData, no_nik: e.target.value })} /></div>
                        <div className="admin-edit-field admin-edit-field-full"><label>Alamat</label><Textarea value={formData.alamat || ''} onChange={(e) => setFormData({ ...formData, alamat: e.target.value })} className="min-h-[60px]" /></div>
                    </div>
                </div>

                {/* 4. Academic Section */}
                <div className="admin-edit-section">
                    <div className="admin-edit-section-header"><GraduationCap /> Akademik & Sistem</div>
                    <div className="admin-edit-field-grid">
                        <div className="admin-edit-field"><label>No. Induk Qiroati</label><Input type="text" value={formData.nomor_induk_qiroati || ''} onChange={handleQiroatiIdChange} required={!editingSantri} /></div>
                        <div className="admin-edit-field"><label>RFID Tag</label><Input type="text" value={formData.rfid_tag || ''} onChange={(e) => setFormData({ ...formData, rfid_tag: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>Status</label><Select value={formData.status} onValueChange={val => setFormData({ ...formData, status: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Aktif">Aktif</SelectItem><SelectItem value="Nonaktif">Non-Aktif</SelectItem></SelectContent></Select></div>
                        <div className="admin-edit-field"><label>Sesi Mengaji</label><Select value={formData.sesi_mengaji} onValueChange={val => setFormData({ ...formData, sesi_mengaji: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sessionOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                        <div className="admin-edit-field"><label>{subCategory === 'ptpt' ? 'Target Tahfizh' : 'Jilid'}</label><Select value={formData.jilid} onValueChange={val => setFormData({ ...formData, jilid: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{academicLevelOptions.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent></Select></div>
                        <div className="admin-edit-field"><label>Kelas Aktif <span className="normal-case text-[10px]" style={{ color: 'hsl(var(--admin-text-muted))' }}>(untuk Absensi)</span></label><Select value={getSelectedClassId(formData) || undefined} onValueChange={val => setFormData({ ...formData, current_class_id: val, id_kelas: val })}><SelectTrigger><SelectValue placeholder="Pilih kelas aktif" /></SelectTrigger><SelectContent>{classesList.map(cls => <SelectItem key={cls.id} value={cls.id}>{cls.nama_kelas}{cls.guru?.nama ? ` - ${cls.guru.nama}` : ''}</SelectItem>)}</SelectContent></Select></div>
                        <div className="admin-edit-field"><label>Link Qiroati</label><Input type="text" value={formData.link_qiroati || ''} onChange={(e) => setFormData({ ...formData, link_qiroati: e.target.value })} /></div>
                        <div className="admin-edit-field">
                            <label>Default SPP Bulanan</label>
                            <Input type="number" min="10000" step="1000" value={formData.default_spp_amount ?? ''} onChange={(e) => setFormData({ ...formData, default_spp_amount: e.target.value })} placeholder="Contoh: 70000" />
                            <span className="text-[10px]" style={{ color: 'hsl(var(--admin-text-muted))' }}>Opsional. Nominal ini otomatis dipilih saat pembayaran SPP.</span>
                        </div>
                        <div className="admin-edit-field">
                            <label className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500"/> Poin Gamifikasi</label>
                            <Input type="number" min="0" step="0.5" value={formData.points ?? 0} onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })} />
                        </div>
                    </div>

                    <div className="admin-edit-access-card mt-4">
                        <h4><Lock /> Akses Login</h4>
                        <div className="admin-edit-field-grid">
                            <div className="admin-edit-field"><label>Username</label><Input type="text" value={formData.nama_panggilan || ''} readOnly style={{ opacity: 0.7 }} /></div>
                            <div className="admin-edit-field"><label>Password</label><Input type="text" value={formData.password || ''} onChange={(e) => setFormData({ ...formData, password: e.target.value })} disabled={Boolean(editingSantri)} required={!editingSantri} placeholder={editingSantri ? 'Reset password melalui alur admin terpisah' : ''} /></div>
                        </div>
                    </div>
                </div>

                {/* 5. Document Section */}
                <div className="admin-edit-section">
                     <div className="admin-edit-section-header"><FileText /> Kelengkapan Berkas</div>
                     <div className="admin-edit-field-grid">
                        <div className="flex items-center space-x-2"><Checkbox id="berkas_foto" checked={Boolean(formData.berkas_foto)} onCheckedChange={(checked) => setFormData({ ...formData, berkas_foto: Boolean(checked) })} /><label htmlFor="berkas_foto" className="text-sm" style={{ color: 'hsl(var(--admin-text-secondary))' }}>Foto</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="berkas_akta" checked={Boolean(formData.berkas_akta)} onCheckedChange={(checked) => setFormData({ ...formData, berkas_akta: Boolean(checked) })} /><label htmlFor="berkas_akta" className="text-sm" style={{ color: 'hsl(var(--admin-text-secondary))' }}>Akta Kelahiran</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="berkas_kk" checked={Boolean(formData.berkas_kk)} onCheckedChange={(checked) => setFormData({ ...formData, berkas_kk: Boolean(checked) })} /><label htmlFor="berkas_kk" className="text-sm" style={{ color: 'hsl(var(--admin-text-secondary))' }}>Kartu Keluarga</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="berkas_form" checked={Boolean(formData.berkas_form)} onCheckedChange={(checked) => setFormData({ ...formData, berkas_form: Boolean(checked) })} /><label htmlFor="berkas_form" className="text-sm" style={{ color: 'hsl(var(--admin-text-secondary))' }}>Formulir</label></div>
                    </div>
                </div>

            </div>

            <div className="admin-edit-footer">
                {editingSantri && (
                    <div className="flex flex-wrap gap-2">
                        {subCategory === 'ptpt' ? (
                            <Button type="button" variant="outline" className="border-cyan-200 text-cyan-700 hover:bg-cyan-50 hover:text-cyan-800" onClick={() => handleMigration('Anak')}>
                                <ArrowRightLeft className="w-4 h-4 mr-2"/> Migrasi ke TPQ
                            </Button>
                        ) : (
                            <Button type="button" variant="outline" className="border-cyan-200 text-cyan-700 hover:bg-cyan-50 hover:text-cyan-800" onClick={() => handleMigration('PTPT')}>
                                <ArrowRightLeft className="w-4 h-4 mr-2"/> Migrasi ke PTPT
                            </Button>
                        )}
                        <Button type="button" variant="outline" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200" onClick={() => handleMigration('Dewasa')}>
                            <ArrowRightLeft className="w-4 h-4 mr-2"/> Migrasi ke Dewasa
                        </Button>
                    </div>
                )}
                <div className="admin-edit-footer-actions">
                    <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
                    <Button type="submit">{editingSantri ? 'Simpan Perubahan' : 'Tambah Santri'}</Button>
                </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isBulkUploadOpen && <SantriImportDialog
        open={isBulkUploadOpen}
        onOpenChange={setIsBulkUploadOpen}
        userRole={role}
        category={subCategory === 'ptpt' ? 'PTPT' : 'Anak'}
        onComplete={async () => {
          await loadData(subCategory);
          window.dispatchEvent(new CustomEvent('lpq:santri-data-changed'));
        }}
      />}
      <BirthdayNotificationModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} students={birthdayStudents} />
      <SantriArchiveDialog
        open={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        categories={subCategory === 'ptpt' ? ['PTPT'] : ['Anak', 'TPQ']}
        title={`Arsip Santri ${subCategory.toUpperCase()}`}
        onRestored={() => loadData(subCategory)}
      />

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
      />

      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-transparent border-none shadow-none">
            {previewImage && <img src={previewImage} alt="Preview" className="w-full h-auto rounded-lg shadow-2xl" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SantriManagement;
