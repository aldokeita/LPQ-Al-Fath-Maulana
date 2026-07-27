
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Database, Download, Upload, FileJson, FileSpreadsheet, FileText, AlertTriangle, CheckCircle, Loader2, Save, Lock, Eye, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { enableEdgeFunctions } from '@/lib/featureFlags';
import { parseSpreadsheetFile, SPREADSHEET_LIMITS, validateSpreadsheetFile } from '@/lib/spreadsheetImport';

const BACKUP_TABLES = [
    'guru',
    'classes',
    'santri',
    'class_memberships',
    'class_mutations',
    'jilid_history',
    'attendance',
    'academic_calendar',
    'payments',
    'expenses',
    'website_content',
    'login_logs',
];

// Parent tables always run before rows that reference them.
const RESTORE_TABLE_ORDER = [
    'guru',
    'classes',
    'santri',
    'class_memberships',
    'class_mutations',
    'jilid_history',
    'attendance',
    'academic_calendar',
    'payments',
    'expenses',
    'website_content',
    'login_logs',
];

const OPTIONAL_FOREIGN_KEY_COLUMNS = {
    classes: new Set(['id_guru']),
    santri: new Set(['current_class_id']),
    class_memberships: new Set(['assigned_by']),
    class_mutations: new Set(['from_class_id', 'to_class_id', 'mutated_by']),
    jilid_history: new Set(['changed_by']),
    attendance: new Set(['class_id']),
    payments: new Set(['created_by', 'updated_by']),
    expenses: new Set(['created_by', 'updated_by']),
    login_logs: new Set(['user_id']),
};

const OPERATOR_FOREIGN_KEY_COLUMNS = new Set([
    'assigned_by',
    'changed_by',
    'mutated_by',
    'created_by',
    'updated_by',
]);

const RECOVERABLE_ROW_ERROR_CODES = new Set([
    '22007',
    '22P02',
    '23502',
    '23503',
    '23505',
    '23514',
]);

const TABLE_UNAVAILABLE_ERROR_CODES = new Set(['42P01', 'PGRST205']);
const BACKUP_PAGE_SIZE = 1000;
const RESTORE_CHUNK_SIZE = 200;

const BackupRestoreManagement = () => {
    const { toast } = useToast();
    const { role, user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [restoreFile, setRestoreFile] = useState(null);
    const [restoreData, setRestoreData] = useState(null);
    const [showConfirmRestore, setShowConfirmRestore] = useState(false);
    const [progress, setProgress] = useState('');
    const [activeTab, setActiveTab] = useState("backup");
    const [lastRestoreReport, setLastRestoreReport] = useState(null);

    // Password Protection States
    const [passwordDialog, setPasswordDialog] = useState({ isOpen: false, action: null, format: null }); // action: 'backup' or 'restore'
    const [passwordInput, setPasswordInput] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    if (role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center p-4">
                <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Akses Ditolak</h2>
                <p className="text-slate-600 dark:text-slate-400 mt-2">Anda tidak memiliki akses ke fitur ini. Hanya admin yang dapat mengakses backup/restore.</p>
            </div>
        );
    }

    const generateFilename = (type, ext) => {
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
        return `backup-lpq-${type}-${dateStr}-${timeStr}.${ext}`;
    };

    const fetchTableData = async (tableName) => {
        const rows = [];
        let page = 0;

        while (true) {
            const from = page * BACKUP_PAGE_SIZE;
            const to = from + BACKUP_PAGE_SIZE - 1;
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .range(from, to);

            if (error) throw new Error(`${tableName}: ${error.message}`);
            rows.push(...(data || []));
            if (!data || data.length < BACKUP_PAGE_SIZE) break;
            page += 1;
        }

        return rows;
    };

    const createDirectBackup = async () => {
        const backup = {};
        const skippedTables = [];

        for (const tableName of BACKUP_TABLES) {
            setProgress(`Mengambil tabel ${tableName}...`);
            try {
                backup[tableName] = await fetchTableData(tableName);
            } catch (error) {
                skippedTables.push({ table: tableName, reason: error.message });
                console.warn(`Backup melewati tabel ${tableName}:`, error);
            }
        }

        const includedTables = Object.keys(backup);
        if (includedTables.length === 0) {
            throw new Error('Tidak ada tabel yang dapat dibaca oleh akun admin ini.');
        }

        backup._backup_meta = {
            app: 'LPQ Al-Fath Maulana',
            version: 2,
            created_at: new Date().toISOString(),
            created_by: user?.email || user?.id || 'admin',
            included_tables: includedTables,
            skipped_tables: skippedTables,
        };

        return backup;
    };

    const getForeignKeyColumn = (tableName, error) => {
        const constraintMatch = String(error?.message || '').match(
            /foreign key constraint "([^"]+)"/i
        );
        const constraintName = constraintMatch?.[1];
        const prefix = `${tableName}_`;
        if (!constraintName?.startsWith(prefix) || !constraintName.endsWith('_fkey')) return null;
        return constraintName.slice(prefix.length, -'_fkey'.length);
    };

    const repairSingleRowRelation = (tableName, row, error) => {
        const column = getForeignKeyColumn(tableName, error);
        if (!column || !Object.prototype.hasOwnProperty.call(row, column)) return null;

        const optionalColumns = OPTIONAL_FOREIGN_KEY_COLUMNS[tableName] || new Set();
        const replacement = OPERATOR_FOREIGN_KEY_COLUMNS.has(column)
            ? (user?.id || null)
            : null;

        if (!optionalColumns.has(column) && !OPERATOR_FOREIGN_KEY_COLUMNS.has(column)) {
            return null;
        }
        if (row[column] === replacement) return null;

        return {
            row: { ...row, [column]: replacement },
            message: `${tableName}.${column} disesuaikan karena referensi lama tidak tersedia`,
        };
    };

    const upsertRowsResilient = async (tableName, inputRows, report) => {
        let rows = inputRows.map((row) => ({ ...row }));

        for (let attempt = 0; attempt < 32; attempt += 1) {
            const { error } = await supabase
                .from(tableName)
                .upsert(rows, { onConflict: 'id' });

            if (!error) {
                report.restoredRows += rows.length;
                return;
            }

            const missingColumnMatch = String(error.message || '').match(
                /Could not find the '([^']+)' column of '([^']+)' in the schema cache/i
            );
            const missingColumn = missingColumnMatch?.[1];
            const errorTable = missingColumnMatch?.[2];

            if (missingColumn && errorTable === tableName) {
                const columnExists = rows.some((row) =>
                    Object.prototype.hasOwnProperty.call(row, missingColumn)
                );
                if (!columnExists) throw new Error(`${tableName}: ${error.message}`);

                rows = rows.map((row) => {
                    const cleanedRow = { ...row };
                    delete cleanedRow[missingColumn];
                    return cleanedRow;
                });
                report.removedLegacyColumns.add(`${tableName}.${missingColumn}`);
                continue;
            }

            if (TABLE_UNAVAILABLE_ERROR_CODES.has(error.code)) {
                report.skippedTables.add(tableName);
                report.skippedRows.push(...rows.map((row) => ({
                    table: tableName,
                    id: row.id || null,
                    reason: error.message,
                })));
                return;
            }

            if (error.code === '42501' || /row-level security|permission denied/i.test(error.message || '')) {
                throw new Error(`${tableName}: akses admin ditolak oleh kebijakan database. ${error.message}`);
            }

            if (rows.length > 1 && (
                RECOVERABLE_ROW_ERROR_CODES.has(error.code)
                || /violates .* constraint/i.test(error.message || '')
            )) {
                const middle = Math.ceil(rows.length / 2);
                await upsertRowsResilient(tableName, rows.slice(0, middle), report);
                await upsertRowsResilient(tableName, rows.slice(middle), report);
                return;
            }

            if (rows.length === 1 && (
                error.code === '23503'
                || /foreign key constraint/i.test(error.message || '')
            )) {
                const repaired = repairSingleRowRelation(tableName, rows[0], error);
                if (repaired) {
                    rows = [repaired.row];
                    report.repairedRelations.add(repaired.message);
                    continue;
                }
            }

            if (rows.length === 1 && (
                RECOVERABLE_ROW_ERROR_CODES.has(error.code)
                || /violates .* constraint/i.test(error.message || '')
            )) {
                report.skippedRows.push({
                    table: tableName,
                    id: rows[0]?.id || null,
                    reason: error.message,
                });
                return;
            }

            throw new Error(`${tableName}: ${error.message}`);
        }

        throw new Error(`${tableName}: proses sanitasi melewati batas aman.`);
    };

    const restoreDirectly = async (payload) => {
        const allowedPayload = RESTORE_TABLE_ORDER
            .filter((tableName) => Array.isArray(payload?.[tableName]))
            .map((tableName) => ({ tableName, rows: payload[tableName] }));

        if (allowedPayload.length === 0) {
            throw new Error('File tidak memiliki tabel yang diizinkan untuk dipulihkan.');
        }

        const report = {
            restoredRows: 0,
            restoredTables: 0,
            removedLegacyColumns: new Set(),
            repairedRelations: new Set(),
            skippedTables: new Set(),
            skippedRows: [],
        };

        setProgress('Preflight: memeriksa urutan tabel dan relasi data...');

        for (const { tableName, rows } of allowedPayload) {
            if (rows.length === 0) continue;
            setProgress(`Memulihkan ${tableName} (${rows.length} baris)...`);
            const restoredBefore = report.restoredRows;

            for (let index = 0; index < rows.length; index += RESTORE_CHUNK_SIZE) {
                const chunk = rows.slice(index, index + RESTORE_CHUNK_SIZE);
                await upsertRowsResilient(tableName, chunk, report);
            }

            if (report.restoredRows > restoredBefore) report.restoredTables += 1;
        }

        if (report.restoredRows === 0) {
            const firstReason = report.skippedRows[0]?.reason;
            throw new Error(firstReason || 'Tidak ada baris yang dapat dipulihkan.');
        }

        return {
            restoredRows: report.restoredRows,
            restoredTables: report.restoredTables,
            removedLegacyColumns: [...report.removedLegacyColumns],
            repairedRelations: [...report.repairedRelations],
            skippedTables: [...report.skippedTables],
            skippedRows: report.skippedRows,
        };
    };

    // Initiate Backup with Password Check
    const initiateBackup = (format) => {
        setPasswordInput('');
        setPasswordDialog({ isOpen: true, action: 'backup', format });
    };

    // Initiate Restore with Password Check
    const initiateRestore = () => {
        setPasswordInput('');
        setPasswordDialog({ isOpen: true, action: 'restore', format: null });
    };

    const verifyAndProceed = async () => {
        if (!passwordInput) {
            toast({ title: "Gagal", description: "Password wajib diisi.", variant: "destructive" });
            return;
        }

        setIsVerifying(true);
        try {
            console.log("Verifying admin password via Supabase Auth...");
            const { data, error } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: passwordInput
            });

            if (error) {
                console.error("Password verification error:", error.message);
                throw new Error("Password salah atau verifikasi gagal.");
            }
            if (!data?.user) {
                console.error("Password Verification Failed: Empty data returned");
                throw new Error("Password salah atau akun tidak ditemukan.");
            }

            // If verified
            toast({ title: "Verifikasi Berhasil", description: "Password benar. Melanjutkan proses...", className: "bg-green-50 text-green-800 border-green-200" });
            setPasswordDialog({ isOpen: false, action: null, format: null });

            if (passwordDialog.action === 'backup') {
                executeBackup(passwordDialog.format);
            } else if (passwordDialog.action === 'restore') {
                parseFile();
            }

        } catch (err) {
            console.error("Verification Exception:", err);
            toast({ title: "Verifikasi Gagal", description: err.message || "Terjadi kesalahan saat memverifikasi password.", variant: "destructive" });
        } finally {
            setIsVerifying(false);
        }
    };

    const executeBackup = async (format) => {
        setIsLoading(true);
        setProgress('Mengambil data dari server...');
        try {
            let data = null;

            if (enableEdgeFunctions) {
                try {
                    const { data: edgeData, error: edgeError } = await supabase.functions.invoke('backup-database');
                    if (edgeError || edgeData?.error) throw new Error(edgeError?.message || edgeData?.error);
                    data = edgeData;
                } catch (edgeError) {
                    console.warn('Edge Function backup tidak tersedia, memakai jalur admin langsung:', edgeError);
                }
            }

            if (!data) data = await createDirectBackup();
            setProgress('Memproses file...');

            if (format === 'json') {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = generateFilename('full', 'json');
                a.click();
                window.URL.revokeObjectURL(url);
            } else if (format === 'xlsx') {
                const wb = XLSX.utils.book_new();
                Object.keys(data).forEach(tableName => {
                    if (data[tableName] && data[tableName].length > 0) {
                        const ws = XLSX.utils.json_to_sheet(data[tableName]);
                        XLSX.utils.book_append_sheet(wb, ws, tableName.substring(0, 31));
                    }
                });
                XLSX.writeFile(wb, generateFilename('full', 'xlsx'));
            } else if (format === 'csv') {
                const santriData = data['santri'] || [];
                if (santriData.length > 0) {
                    const ws = XLSX.utils.json_to_sheet(santriData);
                    const csv = XLSX.utils.sheet_to_csv(ws);
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = generateFilename('santri', 'csv');
                    a.click();
                    window.URL.revokeObjectURL(url);
                    toast({ title: "Info CSV", description: "Format CSV hanya mengunduh data Santri. Gunakan XLSX/JSON untuk backup penuh." });
                } else {
                    toast({ title: "Data Kosong", description: "Tidak ada data santri untuk diexport ke CSV.", variant: "warning" });
                }
            }

            console.log("Backup file successfully generated and downloaded.");
            toast({ title: "Backup Berhasil", description: "File backup telah berhasil dibuat dan diunduh.", className: "bg-green-50 dark:bg-green-900 border-green-200" });
        } catch (error) {
            console.error('Execute Backup Full Error:', error);
            toast({ variant: "destructive", title: "Backup Gagal", description: error.message || "Terjadi kesalahan sistem saat membuat backup." });
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    };

    const handleFileSelect = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const extension = file.name.split('.').pop()?.toLowerCase();
        if (!['json', 'xlsx', 'csv'].includes(extension)) {
            toast({ variant: 'destructive', title: 'Format Tidak Didukung', description: 'Gunakan file JSON, XLSX, atau CSV hasil backup LPQ.' });
            event.target.value = '';
            return;
        }

        if (extension !== 'json') {
            try {
                validateSpreadsheetFile(file, {
                    allowedExtensions: ['xlsx', 'csv'],
                    maxBytes: SPREADSHEET_LIMITS.restore.maxBytes,
                });
            } catch (error) {
                toast({ variant: 'destructive', title: 'File Tidak Valid', description: error.message });
                event.target.value = '';
                return;
            }
        } else if (file.size <= 0 || file.size > SPREADSHEET_LIMITS.restore.maxBytes) {
            toast({ variant: 'destructive', title: 'File Tidak Valid', description: 'File JSON harus berukuran antara 1 byte dan 25 MB.' });
            event.target.value = '';
            return;
        }

        setRestoreFile(file);
        setRestoreData(null);
        setLastRestoreReport(null);
    };

    const parseFile = async () => {
        if (!restoreFile) return;
        setIsLoading(true);
        setProgress('Menganalisis file...');

        try {
            console.log(`Parsing file: ${restoreFile.name}`);
            let parsedData;
            if (restoreFile.name.toLowerCase().endsWith('.json')) {
                parsedData = JSON.parse(await restoreFile.text());
            } else {
                const sheets = await parseSpreadsheetFile(restoreFile, {
                    allowedExtensions: ['xlsx', 'csv'],
                    output: 'records',
                    limits: SPREADSHEET_LIMITS.restore,
                    maxBytes: SPREADSHEET_LIMITS.restore.maxBytes,
                });
                if (restoreFile.name.toLowerCase().endsWith('.csv')) {
                    parsedData = { santri: sheets[Object.keys(sheets)[0]] };
                } else {
                    parsedData = sheets;
                }
            }

            if (!parsedData || typeof parsedData !== 'object' || Array.isArray(parsedData) || Object.keys(parsedData).length === 0) {
                throw new Error("File kosong atau format data tidak dapat diekstrak.");
            }

            const recognizedTables = BACKUP_TABLES.filter((tableName) => Array.isArray(parsedData[tableName]));
            if (recognizedTables.length === 0) throw new Error('File tidak berisi tabel LPQ yang dikenali.');

            setRestoreData(parsedData);
            setShowConfirmRestore(true);

        } catch (error) {
            console.error("File parsing error:", error);
            toast({ variant: "destructive", title: "Format File Salah", description: error.message || "Gagal mengurai isi file backup." });
        } finally {
            setIsLoading(false);
        }
    };

    const executeRestore = async () => {
        setIsLoading(true);
        setShowConfirmRestore(false);
        setLastRestoreReport(null);
        setProgress('Preflight: memeriksa file, schema, dan relasi database...');

        try {
            let restoreResult = null;

            if (enableEdgeFunctions) {
                try {
                    const { data: edgeData, error: edgeError } = await supabase.functions.invoke('restore-database', {
                        body: { data: restoreData },
                    });
                    if (edgeError || edgeData?.error) throw new Error(edgeError?.message || edgeData?.error);
                    restoreResult = edgeData || { restoredRows: 0 };
                } catch (edgeError) {
                    console.warn('Edge Function restore tidak tersedia, memakai jalur admin langsung:', edgeError);
                }
            }

            if (!restoreResult) restoreResult = await restoreDirectly(restoreData);

            setLastRestoreReport(restoreResult);
            const skippedCount = restoreResult.skippedRows?.length || 0;
            toast({
                title: skippedCount > 0 ? 'Restore Selesai dengan Catatan' : 'Restore Berhasil',
                description: (restoreResult.restoredRows ?? 0) + ' baris dipulihkan'
                    + (skippedCount ? ', ' + skippedCount + ' baris tidak kompatibel dilewati.' : '.'),
                className: skippedCount > 0
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : 'bg-green-50 dark:bg-green-900 border-green-200',
            });

            setRestoreFile(null);
            setRestoreData(null);
        } catch (error) {
            console.error("Execute Restore Full Error:", error);
            toast({ variant: "destructive", title: "Restore Gagal", description: error.message || "Terjadi kesalahan saat memulihkan database." });
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    };

    const tabs = [
        { id: 'backup', label: 'Backup Data', icon: Download },
        { id: 'restore', label: 'Restore Data', icon: Upload },
    ];

    const restoreTableNames = restoreData
        ? BACKUP_TABLES.filter((tableName) => Array.isArray(restoreData[tableName]))
        : [];
    const restoreRowCount = restoreTableNames.reduce(
        (total, tableName) => total + restoreData[tableName].length,
        0
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="admin-bulk-import-surface overflow-hidden rounded-3xl border-0">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg"><Database className="w-6 h-6 text-blue-600 dark:text-blue-400" /></div>
                        <div><CardTitle className="text-2xl font-bold text-slate-800 dark:text-white">Backup & Restore Database</CardTitle><CardDescription>Kelola cadangan data sistem untuk keamanan dan pemulihan bencana. Jalur admin langsung aktif dan Edge Function digunakan otomatis bila tersedia.</CardDescription></div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="flex justify-center mb-8">
                            <div className="admin-glass-tab-list inline-flex p-1 rounded-full gap-1">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                                            admin-glass-tab-button relative px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2
                                            ${activeTab === tab.id ? 'text-primary dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}
                                        `}
                                    >
                                        {activeTab === tab.id && (
                                            <motion.div
                                                layoutId="backup-pill"
                                                className="admin-glass-tab-indicator"
                                                transition={{ type: 'spring', stiffness: 430, damping: 34, mass: 0.72 }}
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

                        <TabsContent value="backup" className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Button variant="outline" className="h-32 flex flex-col items-center justify-center gap-3 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group" onClick={() => initiateBackup('json')} disabled={isLoading}>
                                    <FileJson className="w-10 h-10 text-yellow-500 group-hover:scale-110 transition-transform" />
                                    <div className="text-center"><div className="font-bold text-slate-700 dark:text-slate-200">Format JSON</div><div className="text-xs text-muted-foreground mt-1">Lengkap & Terstruktur</div></div>
                                </Button>
                                <Button variant="outline" className="h-32 flex flex-col items-center justify-center gap-3 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group" onClick={() => initiateBackup('xlsx')} disabled={isLoading}>
                                    <FileSpreadsheet className="w-10 h-10 text-green-600 group-hover:scale-110 transition-transform" />
                                    <div className="text-center"><div className="font-bold text-slate-700 dark:text-slate-200">Format Excel (XLSX)</div><div className="text-xs text-muted-foreground mt-1">Mudah Dibaca & Edit</div></div>
                                </Button>
                                <Button variant="outline" className="h-32 flex flex-col items-center justify-center gap-3 hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group" onClick={() => initiateBackup('csv')} disabled={isLoading}>
                                    <FileText className="w-10 h-10 text-slate-500 group-hover:scale-110 transition-transform" />
                                    <div className="text-center"><div className="font-bold text-slate-700 dark:text-slate-200">Format CSV</div><div className="text-xs text-muted-foreground mt-1">Data Santri Saja</div></div>
                                </Button>
                            </div>

                            {isLoading && (
                                <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 p-4 rounded-xl flex items-center justify-center gap-3 animate-pulse">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="font-medium">{progress || 'Sedang memproses...'}</span>
                                </div>
                            )}

                            <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                <AlertTitle className="text-amber-800 dark:text-amber-300">Informasi Penting</AlertTitle>
                                <AlertDescription className="text-amber-700 dark:text-amber-400">Backup mencakup seluruh data tabel sistem (Santri, Guru, Kelas, Keuangan, dll). Pastikan simpan file di tempat yang aman karena berisi data sensitif.</AlertDescription>
                            </Alert>
                        </TabsContent>

                        <TabsContent value="restore" className="space-y-6">
                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-sm"><Upload className="w-8 h-8 text-blue-500" /></div>
                                    <div><h3 className="font-semibold text-lg text-slate-700 dark:text-slate-200">Upload File Backup</h3><p className="text-sm text-muted-foreground mt-1">Seret file ke sini atau klik untuk memilih file (JSON, XLSX, CSV)</p></div>
                                    <input type="file" accept=".json,.xlsx,.csv" onChange={handleFileSelect} className="hidden" id="file-upload" disabled={isLoading} />
                                    <label htmlFor="file-upload"><Button variant="outline" className="cursor-pointer" asChild><span>Pilih File</span></Button></label>
                                    {restoreFile && (<div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg mt-2"><FileText className="w-4 h-4" /><span className="font-mono text-sm">{restoreFile.name}</span></div>)}
                                </div>
                            </div>

                            <Button className="w-full h-12 text-lg font-semibold shadow-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" onClick={initiateRestore} disabled={!restoreFile || isLoading}>{isLoading ? <><Loader2 className="w-5 h-5 animate-spin mr-2"/> {progress || 'Memproses...'}</> : 'Mulai Proses Restore'}</Button>

                            {lastRestoreReport && (
                                <div className="admin-bulk-import-surface rounded-2xl p-5 text-sm">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                                        <div className="min-w-0 space-y-3">
                                            <div>
                                                <p className="font-bold text-slate-900 dark:text-white">Laporan Restore Terakhir</p>
                                                <p className="text-slate-600 dark:text-slate-300">
                                                    {lastRestoreReport.restoredRows || 0} baris dari {lastRestoreReport.restoredTables || 0} tabel berhasil dipulihkan.
                                                </p>
                                            </div>
                                            {lastRestoreReport.removedLegacyColumns?.length > 0 && (
                                                <p className="break-words text-amber-700 dark:text-amber-300">
                                                    Kolom legacy dihapus: {lastRestoreReport.removedLegacyColumns.join(', ')}
                                                </p>
                                            )}
                                            {lastRestoreReport.repairedRelations?.length > 0 && (
                                                <p className="break-words text-blue-700 dark:text-blue-300">
                                                    Relasi diperbaiki: {lastRestoreReport.repairedRelations.join('; ')}
                                                </p>
                                            )}
                                            {lastRestoreReport.skippedRows?.length > 0 && (
                                                <p className="text-rose-700 dark:text-rose-300">
                                                    {lastRestoreReport.skippedRows.length} baris tidak kompatibel dilewati agar tabel lain tetap dapat dipulihkan.
                                                </p>
                                            )}
                                            {lastRestoreReport.skippedTables?.length > 0 && (
                                                <p className="text-rose-700 dark:text-rose-300">
                                                    Tabel tidak tersedia: {lastRestoreReport.skippedTables.join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50">
                                <AlertTriangle className="h-4 w-4" /><AlertTitle>Perhatian Ekstra</AlertTitle><AlertDescription>Proses restore akan menimpa data yang ada jika ditemukan ID yang sama (Upsert). Pastikan file backup valid. Tindakan ini tidak dapat dibatalkan secara otomatis.</AlertDescription>
                            </Alert>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Password Verification Dialog */}
            <Dialog open={passwordDialog.isOpen} onOpenChange={(open) => !open && setPasswordDialog({ ...passwordDialog, isOpen: false })}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-primary">
                            <Lock className="w-5 h-5" /> Verifikasi Keamanan
                        </DialogTitle>
                        <DialogDescription>
                            Masukkan password admin Anda untuk melanjutkan proses <strong>{passwordDialog.action === 'backup' ? 'Backup' : 'Restore'}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="verification-password">Password Admin</Label>
                            <div className="relative">
                                <Input
                                    id="verification-password"
                                    type={showPassword ? "text" : "password"}
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    placeholder="Masukkan password..."
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                                </button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPasswordDialog({ ...passwordDialog, isOpen: false })} disabled={isVerifying}>Batal</Button>
                        <Button onClick={verifyAndProceed} disabled={isVerifying || !passwordInput} className="bg-primary">
                            {isVerifying ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Verifikasi'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Restore Dialog */}
            <Dialog open={showConfirmRestore} onOpenChange={setShowConfirmRestore}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-5 h-5"/> Konfirmasi Restore Database</DialogTitle>
                        <DialogDescription>
                            Anda akan melakukan restore data dari file <strong>{restoreFile?.name}</strong>.
                            <br/><br/>
                            Tabel yang Diizinkan: <strong>{restoreTableNames.length}</strong>
                            <br/>
                            Total Baris: <strong>{restoreRowCount}</strong>
                            <br/>
                            Data dengan ID yang sama akan diperbarui dan data baru akan ditambahkan.
                            <br/><br/>
                            Apakah Anda yakin ingin melanjutkan?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter><Button variant="outline" onClick={() => setShowConfirmRestore(false)}>Batal</Button><Button variant="destructive" onClick={executeRestore}>Ya, Lakukan Restore</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default BackupRestoreManagement;
