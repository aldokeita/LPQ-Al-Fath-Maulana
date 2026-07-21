
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Archive, Plus, Edit, Search, Upload, ArrowUpDown, Download, XCircle, Trophy, User, Mail, Key, Briefcase, Filter, FileSpreadsheet, ArrowRightLeft, GraduationCap, MapPin } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/customSupabaseClient';
import { enableEdgeFunctions, edgeFunctionDisabledMessage } from '@/lib/featureFlags';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { validatePassword } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getSessionName, getSessionNumber, getAllSessions } from '@/utils/sessionMapping';
import { getStorageErrorMessage, resolveAvatarRecords, uploadAvatar } from '@/lib/storageAdapters';
import { mapSantriForLegacyUi, normalizeNomorIndukQiroati, pickChangedSantriProfileFields, pickSantriProfileFields } from '@/lib/dataMasterAdapters';
import { archiveSantriAccounts } from '@/lib/santriArchiveAdapters';
import SantriArchiveDialog from '@/components/dashboard/admin/SantriArchiveDialog';

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

const BulkUploadModal = ({ isOpen, onClose, onUpload, category = 'Dewasa' }) => {
  const [file, setFile] = useState(null);
  const [textData, setTextData] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('excel');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) setFile(selectedFile);
  };

  const downloadTemplate = () => {
    const headers = [
      "Nama Lengkap", "Username (Panggilan)", "Password", "Jilid", "Tempat Lahir", "Tgl Lahir (YYYY-MM-DD)",
      "Jenis Kelamin (L/P)", "Alamat", "Sesi", "Tgl Masuk (YYYY-MM-DD)", "No HP WA"
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Santri Dewasa");
    XLSX.writeFile(wb, "Template_Import_Santri_Dewasa.xlsx");
  };

  const processExcel = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          resolve(json);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleProcess = async () => {
    setIsLoading(true);
    let rawData = [];

    try {
      if (activeTab === 'excel' && file) {
        rawData = await processExcel(file);
      } else if (activeTab === 'text' && textData) {
        rawData = textData.trim().split('\n').map(line => line.split('\t').map(v => v.trim()));
      }

      if (!rawData || rawData.length === 0) throw new Error("Data kosong.");

      onUpload(rawData, activeTab === 'excel');
      onClose();
      setFile(null);
      setTextData('');
    } catch (error) {
      toast({ title: "Error", description: "Gagal memproses data: " + error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Data Santri Dewasa Massal</DialogTitle>
          <DialogDescription>Pilih metode import data.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 mb-4 border-b">
            <Button variant={activeTab === 'excel' ? 'default' : 'ghost'} onClick={() => setActiveTab('excel')} className="rounded-b-none">File Excel/CSV</Button>
            <Button variant={activeTab === 'text' ? 'default' : 'ghost'} onClick={() => setActiveTab('text')} className="rounded-b-none">Copy-Paste Teks</Button>
        </div>

        {activeTab === 'excel' ? (
            <div className="space-y-6 py-4">
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <FileSpreadsheet className="w-12 h-12 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-700">{file ? file.name : "Klik untuk upload file Excel (.xlsx, .xls) atau CSV"}</p>
                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                </div>
                <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg">
                    <span className="text-sm text-blue-700">Belum punya format?</span>
                    <Button variant="outline" size="sm" onClick={downloadTemplate} className="border-blue-200 text-blue-700 hover:bg-blue-100">
                        <Download className="w-4 h-4 mr-2"/> Download Template
                    </Button>
                </div>
            </div>
        ) : (
            <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Format: Nama Lengkap | Username | Password | Jilid | ... (Tab Separated)</p>
                <Textarea
                    placeholder="Paste data dari Excel di sini..."
                    className="min-h-[300px] font-mono text-xs"
                    value={textData}
                    onChange={e => setTextData(e.target.value)}
                />
            </div>
        )}

        <DialogFooter>
          <Button onClick={handleProcess} disabled={isLoading || (activeTab === 'excel' && !file) || (activeTab === 'text' && !textData)}>
            {isLoading ? 'Memproses...' : 'Proses Data'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const UploadReportModal = ({ isOpen, onClose, report, onConfirm }) => {
  if (!report) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Laporan Validasi Data</DialogTitle>
          <DialogDescription>Tinjau data sebelum disimpan ke database.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <p className="text-sm text-green-600 font-medium">Data Valid</p>
                <p className="text-2xl font-bold text-green-700">{report.validCount}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                <p className="text-sm text-red-600 font-medium">Data Error</p>
                <p className="text-2xl font-bold text-red-700">{report.errorCount}</p>
            </div>
        </div>

        {report.errors.length > 0 && (
            <div className="space-y-2 mb-4">
                <h4 className="font-semibold text-sm">Detail Error:</h4>
                <div className="bg-slate-50 p-3 rounded-lg border text-xs max-h-40 overflow-y-auto">
                    <ul className="space-y-1 text-red-600">
                        {report.errors.map((err, idx) => (
                            <li key={idx}><strong>Baris {err.row}:</strong> {err.reason} ({err.name})</li>
                        ))}
                    </ul>
                </div>
            </div>
        )}

        {report.validData.length > 0 && (
             <div className="space-y-2">
                <h4 className="font-semibold text-sm">Preview Data Valid (5 Teratas):</h4>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 border-b">
                            <tr>
                                <th className="p-2">Nama</th>
                                <th className="p-2">Username</th>
                                <th className="p-2">Jilid</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.validData.slice(0, 5).map((d, i) => (
                                <tr key={i} className="border-b last:border-0">
                                    <td className="p-2">{d.nama_lengkap}</td>
                                    <td className="p-2">{d.nama_panggilan}</td>
                                    <td className="p-2">{d.jilid}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={onClose}>Batal</Button>
            <Button onClick={onConfirm} disabled={report.validCount === 0}>
                Simpan {report.validCount} Data Valid
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SantriDewasaManagement = () => {
  const { user } = useAuth();
  const [santriList, setSantriList] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [sessionOptions, setSessionOptions] = useState([]);

  const [filters, setFilters] = useState({ search: '', sesi: 'all', jilid: 'all', rfid: 'all' });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [uploadReport, setUploadReport] = useState(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [editingSantri, setEditingSantri] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'nama_lengkap', direction: 'ascending' });
  const [selectedSantri, setSelectedSantri] = useState(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const photoInputRef = React.useRef(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', description: '', onConfirm: () => {} });
  const [previewImage, setPreviewImage] = useState(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  const [formData, setFormData] = useState({
    nomor_induk_qiroati: '', nama_lengkap: '', nama_panggilan: '', jenis_kelamin: 'Laki-laki', tempat_lahir: '', tanggal_lahir: '', tanggal_pendaftaran: '',
    no_hp_ortu: '', alamat: '', status: 'Aktif', foto_url: '', email: '', password: '', sesi_mengaji: '', rfid_tag: '',
    jilid: 'Jilid 1A', id_kelas: null, kategori: 'Dewasa'
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      console.log('--- INVESTIGATION: Fetching all santri (Dewasa) ---');
      const [santriRes, classesRes, configRes] = await Promise.all([
        supabase.from('santri').select('*'),
        supabase.from('classes').select('id, nama_kelas, kategori, guru:id_guru(nama)'),
        supabase.from('website_content').select('content').eq('key', 'adultSessionConfig').maybeSingle()
      ]);

      if (santriRes.data) {
          const uniqueKategoris = [...new Set(santriRes.data.map(s => s.kategori))];
          console.log(`Raw Santri Data (Dewasa Context): ${santriRes.data.length} records`);
          console.log("Unique kategoris found:", uniqueKategoris);
      }

      if (santriRes.error) {
          toast({ title: "Error", description: "Gagal memuat data santri dewasa.", variant: "destructive" });
      } else {
          // Client-side filtering to be safe against case inconsistencies
          const filteredDewasa = (santriRes.data || []).filter(s => {
              const isDewasa = s.kategori && s.kategori.toLowerCase() === 'dewasa';
              const isActive = !s.deleted_at && (!s.status || s.status.toLowerCase() === 'aktif' || s.status.toLowerCase() === 'active');
              return isDewasa && isActive;
          });
          const mappedDewasa = filteredDewasa.map(mapSantriForLegacyUi);
          const resolvedDewasa = await resolveAvatarRecords(mappedDewasa, { ownerType: 'santri' });
          setSantriList(resolvedDewasa);
      }

      if (classesRes.error) {
          toast({ title: "Error", description: "Gagal memuat data kelas dewasa.", variant: "destructive" });
      } else {
          const dewasaClasses = (classesRes.data || []).filter(c => c.kategori && c.kategori.toLowerCase() === 'dewasa');
          setClassesList(dewasaClasses);
      }

      const mappedSessions = getAllSessions().map(s => s.name);
      setSessionOptions(mappedSessions);
      setFormData(prev => ({...prev, sesi_mengaji: mappedSessions[0] || ''}));

    } catch (err) {
      console.error("Error loading data:", err);
      toast({ title: "Error", description: "Terjadi kesalahan tidak terduga.", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  };

  const classGuruMap = useMemo(() => {
    return classesList.reduce((acc, cls) => {
      acc[cls.id] = cls.guru?.nama || 'Belum ada guru';
      return acc;
    }, {});
  }, [classesList]);

  // Bulk Import Logic
  const handleDataProcessing = (rawData, isExcel) => {
    const headerRow = rawData[0];
    const dataRows = rawData.slice(1);

    const mapHeader = (h) => {
        const lower = String(h).toLowerCase().trim();
        if (lower.includes('lengkap') || lower === 'nama') return 'nama_lengkap';
        if (lower.includes('username') || lower.includes('panggilan')) return 'nama_panggilan';
        if (lower.includes('password')) return 'password';
        if (lower.includes('jilid')) return 'jilid';
        if (lower.includes('tempat')) return 'tempat_lahir';
        if (lower.includes('tgl lahir') || lower.includes('tanggal lahir')) return 'tanggal_lahir';
        if (lower.includes('kelamin') || lower === 'jk' || lower === 'l/p') return 'jenis_kelamin';
        if (lower.includes('alamat')) return 'alamat';
        if (lower.includes('sesi')) return 'sesi_mengaji';
        if (lower.includes('masuk') || lower.includes('daftar')) return 'tanggal_pendaftaran';
        if (lower.includes('hp') || lower.includes('wa')) return 'no_hp_ortu';
        return null;
    };

    const validData = [];
    const errors = [];

    dataRows.forEach((row, idx) => {
        if (!row || row.length === 0 || row.every(c => !c)) return;

        const santri = { kategori: 'Dewasa', status: 'Aktif', points: 0 };
        let hasName = false;

        headerRow.forEach((h, colIdx) => {
            const field = mapHeader(h);
            if (field) {
                let val = row[colIdx];
                if (field === 'tanggal_lahir' || field === 'tanggal_pendaftaran') {
                    if (val && typeof val === 'number') {
                        const date = new Date((val - (25567 + 2)) * 86400 * 1000);
                        val = date.toISOString().split('T')[0];
                    }
                }
                if (field === 'jenis_kelamin') {
                    val = (String(val).toLowerCase().startsWith('p')) ? 'Perempuan' : 'Laki-laki';
                }
                santri[field] = val;
                if (field === 'nama_lengkap' && val) hasName = true;
            }
        });

        if (!hasName) {
            errors.push({ row: idx + 2, name: 'Unknown', reason: 'Nama Lengkap kosong' });
            return;
        }

        if (!santri.nama_panggilan) {
             errors.push({ row: idx + 2, name: santri.nama_lengkap, reason: 'Username kosong' });
             return;
        }

        if (!santri.password) {
             errors.push({ row: idx + 2, name: santri.nama_lengkap, reason: 'Password kosong' });
             return;
        }

        validData.push(santri);
    });

    setUploadReport({ validData, errors, validCount: validData.length, errorCount: errors.length });
    setIsReportOpen(true);
  };

  const confirmBulkUpload = async () => {
      if (!uploadReport?.validData) return;
      const { error } = await supabase.from('santri').insert(uploadReport.validData);
      if (error) {
          toast({ title: "Gagal Menyimpan", description: error.message, variant: "destructive" });
      } else {
          toast({ title: "Berhasil", description: `${uploadReport.validCount} data santri dewasa berhasil diimport.` });
          loadData();
          setIsReportOpen(false);
          setUploadReport(null);
      }
  };

  const handleDownloadData = () => {
    const dataToExport = santriList.map(s => ({
        'Nama Lengkap': s.nama_lengkap, 'Username': s.nama_panggilan, 'Jilid': s.jilid,
        'Tempat Lahir': s.tempat_lahir, 'Tanggal Lahir': s.tanggal_lahir, 'Jenis Kelamin': s.jenis_kelamin,
        'Alamat': s.alamat, 'Sesi': getSessionName(s.sesi_mengaji), 'Tanggal Masuk': s.tanggal_pendaftaran,
        'No. HP': s.no_hp_ortu,
        'Status': s.status, 'RFID': s.rfid_tag
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Santri Dewasa");
    XLSX.writeFile(workbook, "Data_Santri_Dewasa.xlsx");
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
        setFormData(prev => ({ ...prev, avatar_path: path, foto_url: signedUrl || prev.foto_url }));
        toast({ title: "Upload Berhasil" });
    } catch (error) {
        toast({ title: "Upload Gagal", description: getStorageErrorMessage(error), variant: "destructive" });
    } finally {
        setIsUploading(false);
        e.target.value = '';
    }
  };

  const triggerPhotoUpload = () => photoInputRef.current?.click();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalFormData = { ...formData, kategori: 'Dewasa', points: 0 };
    finalFormData.nomor_induk_qiroati = normalizeNomorIndukQiroati(finalFormData.nomor_induk_qiroati);

    if (!finalFormData.nama_panggilan) {
        toast({ title: "Gagal", description: "Username (Nama Panggilan) wajib diisi.", variant: "destructive" });
        return;
    }

    if (!editingSantri && !finalFormData.password) {
        toast({ title: "Gagal", description: "Password wajib diisi untuk santri baru.", variant: "destructive" });
        return;
    }

    if (finalFormData.password) {
      const passwordError = validatePassword(finalFormData.password);
      if (passwordError) {
          toast({ title: "Validasi Password Gagal", description: passwordError, variant: "destructive" });
          return;
      }
    }

    if (!enableEdgeFunctions) {
      toast({ title: "Fitur belum aktif", description: edgeFunctionDisabledMessage, variant: "destructive" });
      return;
    }

    try {
      let targetId = editingSantri?.id;
      const selectedClassId = finalFormData.id_kelas || null;
      const originalClassId = editingSantri?.current_class_id ?? editingSantri?.id_kelas ?? null;
      const classChanged = selectedClassId !== originalClassId;
      const profilePayload = editingSantri
        ? pickChangedSantriProfileFields(finalFormData, editingSantri)
        : pickSantriProfileFields(finalFormData);
      const shouldArchiveAfterSave = String(finalFormData.status || '').toLowerCase() === 'nonaktif';

      delete profilePayload.current_class_id;
      if (shouldArchiveAfterSave) delete profilePayload.status;
      profilePayload.kategori = 'Dewasa';
      profilePayload.nomor_induk_qiroati = finalFormData.nomor_induk_qiroati || null;

      if (classChanged && !selectedClassId) {
        throw new Error('Pilih kelas tujuan. Pengeluaran dari kelas dilakukan melalui migrasi kategori yang aman.');
      }

      if (!editingSantri) {
        const { data, error } = await supabase.functions.invoke('manage-user', {
          body: {
            action: 'create',
            role: 'santri',
            profile: profilePayload,
            initial_password: finalFormData.password,
          },
        });
        if (error) throw error;
        if (!data?.ok || !data?.data?.user_id) throw new Error(data?.error?.message || 'Akun santri dewasa gagal dibuat.');
        targetId = data.data.user_id;
      } else if (Object.keys(profilePayload).length > 0) {
        const { data, error } = await supabase.functions.invoke('manage-user', {
          body: {
            action: 'update',
            role: 'santri',
            target_user_id: targetId,
            profile: profilePayload,
          },
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error?.message || 'Data santri dewasa gagal diperbarui.');
      }

      if (classChanged && selectedClassId) {
        const { error } = await supabase.rpc('move_santri_to_class', {
          p_santri_id: targetId,
          p_to_class_id: selectedClassId,
          p_reason: editingSantri ? 'Perubahan kelas santri dewasa' : 'Penempatan kelas awal santri dewasa',
        });
        if (error) throw error;
      }

      if (shouldArchiveAfterSave) {
        await archiveSantriAccounts([targetId], 'Dinonaktifkan melalui form Data Santri Dewasa');
      }

      toast({
        title: "Berhasil!",
        description: shouldArchiveAfterSave
          ? "Data santri tersimpan dan dipindahkan ke arsip."
          : (editingSantri ? "Data santri berhasil diperbarui" : "Santri dewasa berhasil ditambahkan")
      });
      await loadData();
      window.dispatchEvent(new CustomEvent('lpq:santri-data-changed'));
      setIsFormOpen(false);
      resetForm();
    } catch (error) {
      toast({ title: "Gagal!", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (santri) => {
    setEditingSantri(santri);
    setFormData({...santri, points: 0, sesi_mengaji: getSessionName(santri.sesi_mengaji)});
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (selectedSantri.size === 0) return;
    const idsToDelete = Array.from(selectedSantri);

    setConfirmDialog({
      isOpen: true,
      title: 'Pindahkan ke Arsip',
      description: `${selectedSantri.size} santri dewasa akan dinonaktifkan. Seluruh kelas, hafalan, karakter, absensi, pembayaran, dan riwayat tetap tersimpan untuk dipulihkan nanti.`,
      onConfirm: async () => {
        try {
          await archiveSantriAccounts(idsToDelete, 'Dipindahkan ke arsip dari Data Santri Dewasa');
          await loadData();
          window.dispatchEvent(new CustomEvent('lpq:santri-data-changed'));
          setSelectedSantri(new Set());
          toast({ title: "Masuk arsip", description: "Santri dewasa telah diarsipkan tanpa menghapus riwayatnya." });
        } catch (error) {
          toast({ title: "Gagal!", description: error.message, variant: "destructive" });
        }
      }
    });
  };

  const handleMigration = async () => {
      if (!editingSantri) return;

      setConfirmDialog({
          isOpen: true,
          title: 'Migrasi ke TPQ',
          description: `Yakin ingin memindahkan ${editingSantri.nama_lengkap} ke kategori TPQ (Anak)? Santri akan dikeluarkan dari kelas Dewasa saat ini.`,
          onConfirm: async () => {
              const { data, error } = await supabase.rpc('change_santri_category', {
                  p_santri_id: editingSantri.id,
                  p_target_category: 'Anak',
                  p_reason: 'Migrasi santri dewasa ke TPQ oleh admin',
              });

              if (error) {
                  toast({ title: "Gagal", description: error.message, variant: "destructive" });
              } else {
                  toast({ title: "Berhasil", description: data?.[0]?.message || "Santri berhasil dipindahkan ke kategori TPQ (Anak)." });
                  setIsFormOpen(false);
                  await loadData();
              }
          }
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
        nomor_induk_qiroati: '', nama_lengkap: '', nama_panggilan: '', jenis_kelamin: 'Laki-laki', tempat_lahir: '', tanggal_lahir: '', tanggal_pendaftaran: '',
        no_hp_ortu: '', alamat: '', status: 'Aktif', foto_url: '', email: '', password: '', sesi_mengaji: sessionOptions[0] || 'Malam', rfid_tag: '',
        jilid: 'Jilid 1A', id_kelas: null, points: 0, kategori: 'Dewasa'
    });
    setEditingSantri(null);
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredSantri = useMemo(() => {
    let sortableItems = [...santriList];
    if (filters.sesi !== 'all') sortableItems = sortableItems.filter(s => getSessionName(s.sesi_mengaji) === filters.sesi);
    if (filters.jilid !== 'all') sortableItems = sortableItems.filter(s => s.jilid === filters.jilid);
    if (filters.search) {
      const lowercasedFilter = filters.search.toLowerCase();
      sortableItems = sortableItems.filter(s =>
        s.nama_lengkap.toLowerCase().includes(lowercasedFilter) ||
        (s.nama_panggilan && s.nama_panggilan.toLowerCase().includes(lowercasedFilter)) ||
        (s.no_hp_ortu && s.no_hp_ortu.toLowerCase().includes(lowercasedFilter))
      );
    }
    sortableItems.sort((a, b) => {
      if (!a[sortConfig.key] || !b[sortConfig.key]) return 0;
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });
    return sortableItems;
  }, [santriList, filters, sortConfig]);

  return (
    <div>
      <div className="admin-panel-header">
          <div className="flex items-center gap-3">
             <div className="admin-panel-header-icon">
                <Briefcase />
             </div>
             <div className="admin-panel-header-text">
                <h2>Manajemen Santri Dewasa</h2>
                <p>Kelola data santri, jilid, dan sesi khusus dewasa.</p>
             </div>
          </div>

          <div className="admin-panel-header-actions">
            <button onClick={() => setIsArchiveOpen(true)} className="admin-action-cluster-btn">
                <Archive className="w-4 h-4" /> Arsip
            </button>
            {selectedSantri.size > 0 && (
                <div className="admin-bulk-bar">
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
                    placeholder="Cari nama, username, no hp..."
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
                    <SelectTrigger><SelectValue placeholder="Jilid" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Semua Jilid</SelectItem>{jilidOptions.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent>
                </Select>
            </div>
       </div>

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
              <th className="p-3 text-left w-12 text-xs font-semibold uppercase tracking-wider" style={{ color: 'hsl(var(--admin-text-muted))' }}>No.</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'hsl(var(--admin-text-muted))' }} onClick={() => requestSort('nama_lengkap')}><div className="flex items-center">Nama <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'hsl(var(--admin-text-muted))' }} onClick={() => requestSort('nama_panggilan')}><div className="flex items-center">Username <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'hsl(var(--admin-text-muted))' }} onClick={() => requestSort('no_hp_ortu')}><div className="flex items-center">No. HP <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'hsl(var(--admin-text-muted))' }} onClick={() => requestSort('rfid_tag')}><div className="flex items-center">Token RFID <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'hsl(var(--admin-text-muted))' }} onClick={() => requestSort('sesi_mengaji')}><div className="flex items-center">Sesi <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'hsl(var(--admin-text-muted))' }} onClick={() => requestSort('jilid')}><div className="flex items-center">Jilid <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'hsl(var(--admin-text-muted))' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {sortedAndFilteredSantri.map((santri, index) => (
              <tr key={santri.id} className="group">
                <td className="p-3"><Checkbox onCheckedChange={() => toggleSelect(santri.id)} checked={selectedSantri.has(santri.id)} /></td>
                <td className="p-3 font-mono text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>{index + 1}</td>
                <td className="p-3">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border cursor-pointer hover:scale-105 transition-transform" style={{ borderColor: 'hsl(var(--admin-border))' }} onClick={() => setPreviewImage(santri.foto_url)}>
                            <AvatarImage src={santri.foto_url} /><AvatarFallback style={{ backgroundColor: 'hsl(var(--admin-accent-soft))', color: 'hsl(var(--admin-accent))' }} className="text-xs font-bold">{santri.nama_lengkap.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="font-medium" style={{ color: 'hsl(var(--admin-text-primary))' }}>{santri.nama_lengkap}</div>
                            <div className="text-xs font-mono" style={{ color: 'hsl(var(--admin-text-muted))' }}>{santri.nama_panggilan}</div>
                        </div>
                    </div>
                </td>
                <td className="p-3 font-mono text-xs" style={{ color: 'hsl(var(--admin-text-secondary))' }}>{santri.nama_panggilan || '-'}</td>
                <td className="p-3 text-xs" style={{ color: 'hsl(var(--admin-text-secondary))' }}>{santri.no_hp_ortu || '-'}</td>
                <td className="p-3 text-xs font-mono" style={{ color: 'hsl(var(--admin-text-muted))' }}>{santri.rfid_tag || '-'}</td>
                <td className="p-3"><span className="text-xs font-medium px-2 py-1 rounded-md" style={{ backgroundColor: 'hsl(var(--admin-surface-sunken))', color: 'hsl(var(--admin-text-secondary))' }}>{getSessionName(santri.sesi_mengaji)}</span></td>
                <td className="p-3"><span className="admin-status-badge admin-status-badge--info">{santri.jilid}</span></td>
                <td className="p-3"><Button onClick={() => handleEdit(santri)} size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full" style={{ color: 'hsl(var(--admin-text-muted))' }}><Edit className="w-4 h-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoadingData && sortedAndFilteredSantri.length === 0 && (
            <div className="admin-table-empty">
                <Search />
                <p>Tidak ada data santri ditemukan.</p>
            </div>
        )}
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingSantri ? 'Edit Santri Dewasa' : 'Tambah Santri Dewasa'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-muted/20 rounded-xl border">
                <Avatar className="w-24 h-24 border-4 border-background shadow-md cursor-pointer hover:opacity-80 transition-opacity" onClick={() => formData.foto_url && setPreviewImage(formData.foto_url)}>
                    <AvatarImage src={formData.foto_url} /><AvatarFallback><Upload /></AvatarFallback>
                </Avatar>
                <div className="flex-1 w-full space-y-2">
                    <div className="flex gap-2">
                         <Button type="button" onClick={triggerPhotoUpload} variant="outline" disabled={isUploading || !enableEdgeFunctions || !editingSantri?.id} title={!enableEdgeFunctions ? edgeFunctionDisabledMessage : (!editingSantri?.id ? 'Simpan akun sebelum upload avatar.' : undefined)}>{isUploading ? 'Mengunggah...' : 'Upload Foto'}</Button>
                         <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} className="hidden" />
                      </div>
                      <p className="text-[10px] text-muted-foreground">JPG, PNG, WebP (Max 2 MB). Simpan akun baru sebelum upload.</p>
                    <div className="relative">
                        <Input type="text" placeholder="https://example.com/foto.jpg" value={formData.foto_url || ''} onChange={(e) => setFormData({ ...formData, foto_url: e.target.value })} className="pl-9 text-xs" />
                        <Upload className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground"/>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="personal" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="personal" className="flex items-center gap-2"><User className="w-4 h-4"/> Data Diri & Kontak</TabsTrigger>
                    <TabsTrigger value="academic" className="flex items-center gap-2"><GraduationCap className="w-4 h-4"/> Data Akademik</TabsTrigger>
                </TabsList>

                <TabsContent value="personal">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Informasi Pribadi & Kontak</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Nama Lengkap</label><Input type="text" value={formData.nama_lengkap || ''} onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })} required /></div>
                                <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1"><User className="w-3 h-3"/> Username (Login)</label><Input type="text" value={formData.nama_panggilan || ''} onChange={(e) => setFormData({ ...formData, nama_panggilan: e.target.value })} required /></div>
                                <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Nomor Induk Qiroati <span className="normal-case opacity-70">(opsional)</span></label><Input type="text" value={formData.nomor_induk_qiroati || ''} onChange={(e) => setFormData({ ...formData, nomor_induk_qiroati: e.target.value })} /></div>
                                <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1"><Key className="w-3 h-3"/> Password Awal</label><Input type="password" value={formData.password || ''} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required={!editingSantri} disabled={Boolean(editingSantri)} placeholder={editingSantri ? 'Kelola melalui reset password' : 'Masukkan password awal'} /></div>
                                <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Nomor HP (WA)</label><Input type="tel" value={formData.no_hp_ortu || ''} onChange={(e) => setFormData({ ...formData, no_hp_ortu: e.target.value })} /></div>
                                <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Jenis Kelamin</label><Select value={formData.jenis_kelamin} onValueChange={val => setFormData({ ...formData, jenis_kelamin: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Laki-laki">Laki-laki</SelectItem><SelectItem value="Perempuan">Perempuan</SelectItem></SelectContent></Select></div>
                                <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Tempat Lahir</label><Input type="text" value={formData.tempat_lahir || ''} onChange={(e) => setFormData({ ...formData, tempat_lahir: e.target.value })} /></div>
                                <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Tanggal Lahir</label><Input type="date" value={formData.tanggal_lahir || ''} onChange={(e) => setFormData({ ...formData, tanggal_lahir: e.target.value })} /></div>
                                <div className="col-span-full space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Alamat</label><Textarea value={formData.alamat || ''} onChange={(e) => setFormData({ ...formData, alamat: e.target.value })} /></div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="academic">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Data Akademik</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Jilid</label><Select value={formData.jilid} onValueChange={val => setFormData({ ...formData, jilid: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{jilidOptions.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent></Select></div>
                                <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Sesi Mengaji</label><Select value={formData.sesi_mengaji} onValueChange={val => setFormData({ ...formData, sesi_mengaji: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sessionOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                                <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Kelas Dewasa</label><Select value={formData.id_kelas || 'none'} onValueChange={val => setFormData({ ...formData, id_kelas: val === 'none' ? null : val })}><SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger><SelectContent><SelectItem value="none">Belum Masuk Kelas</SelectItem>{classesList.map(c => <SelectItem key={c.id} value={c.id}>{c.nama_kelas}</SelectItem>)}</SelectContent></Select></div>
                                <div className="space-y-1.5"><label className="text-xs font-medium uppercase text-muted-foreground">Token RFID</label><Input type="text" value={formData.rfid_tag || ''} onChange={(e) => setFormData({ ...formData, rfid_tag: e.target.value })} /></div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <DialogFooter className="pt-4 flex justify-between sm:justify-between w-full">
                {editingSantri && (
                    <Button type="button" variant="outline" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200" onClick={handleMigration}>
                        <ArrowRightLeft className="w-4 h-4 mr-2"/> Migrasi ke TPQ
                    </Button>
                )}
                <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
                    <Button type="submit">{editingSantri ? 'Simpan Perubahan' : 'Tambah Santri Dewasa'}</Button>
                </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BulkUploadModal isOpen={isBulkUploadOpen} onClose={() => setIsBulkUploadOpen(false)} onUpload={handleDataProcessing} category="Dewasa" />
      <UploadReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} report={uploadReport} onConfirm={confirmBulkUpload} />
      <SantriArchiveDialog
        open={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        categories={['Dewasa']}
        title="Arsip Santri Dewasa"
        onRestored={loadData}
      />
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
      />

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-transparent border-none shadow-none">
            <div className="relative w-full h-[80vh] flex items-center justify-center">
                <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full"
                    onClick={() => setPreviewImage(null)}
                >
                    <XCircle className="w-6 h-6" />
                </Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SantriDewasaManagement;
