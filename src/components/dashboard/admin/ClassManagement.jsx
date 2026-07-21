
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2, Search, History, UserPlus, Users, Check, Clock, BarChart2, GripVertical, FileSpreadsheet, Filter, ArrowRight, Phone, Eye, User, Settings, GraduationCap, Briefcase, ListOrdered, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/customSupabaseClient';
import { useDrag, useDrop } from 'react-dnd';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Badge } from '@/components/ui/badge';
import SantriDetailModal from '../shared/SantriDetailModal';
import JilidChangeModal from './JilidChangeModal';
import ClassPerformanceModal from './ClassPerformanceModal';
import * as XLSX from 'xlsx';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import AdultClassManagement from './AdultClassManagement';
import { getSessionName, getSessionNumber, getAllSessions } from '@/utils/sessionMapping';
import { mapClassForLegacyUi, mapSantriForLegacyUi } from '@/lib/dataMasterAdapters';
import { resolveAvatarRecord, resolveAvatarRecords } from '@/lib/storageAdapters';

const ItemTypes = {
  SANTRI: 'santri',
  CLASS: 'class',
  SESSION: 'session',
  CLASS_ORDER: 'class_order'
};

const jilidOptions = [
  'Pra TK A', 'Pra TK B', 'Pra TK C', 'Jilid 1A', 'Jilid 1B', 'Jilid 1C', 'Jilid 2A', 'Jilid 2B',
  'Jilid 3A', 'Jilid 3B', 'Jilid 4A', 'Jilid 4B', 'Jilid 5A', 'Jilid 5B', 'Jilid Juz 27', 'Jilid 6A', 'Jilid 6B',
  'Al-Qur\'an', 'Ghorib Tajwid', 'Finishing'
];

// Draggable Session Item for Config
const DraggableSessionItem = ({ name, time, index, moveSession, onDelete, onUpdate }) => {
    const ref = useRef(null);
    const [{ handlerId }, drop] = useDrop({
        accept: ItemTypes.SESSION,
        collect(monitor) { return { handlerId: monitor.getHandlerId() }; },
        hover(item, monitor) {
            if (!ref.current) return;
            const dragIndex = item.index;
            const hoverIndex = index;
            if (dragIndex === hoverIndex) return;
            const hoverBoundingRect = ref.current?.getBoundingClientRect();
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset();
            const hoverClientY = clientOffset.y - hoverBoundingRect.top;
            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
            moveSession(dragIndex, hoverIndex);
            item.index = hoverIndex;
        },
    });
    const [{ isDragging }, drag] = useDrag({
        type: ItemTypes.SESSION,
        item: () => ({ name, index }),
        collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    });
    drag(drop(ref));

    return (
        <div ref={ref} data-handler-id={handlerId} className={`flex items-center gap-2 p-2 rounded-lg border bg-slate-50 dark:bg-slate-800 mb-2 ${isDragging ? 'opacity-50' : 'opacity-100'}`}>
            <div className="cursor-grab text-muted-foreground"><GripVertical className="w-4 h-4"/></div>
            <div className="flex-1 font-semibold">{name}</div>
            <Input type="time" className="w-24 h-8 text-sm" value={time} onChange={e => onUpdate(name, e.target.value)} />
            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30" onClick={() => onDelete(name)}>
                <Trash2 className="w-4 h-4"/>
            </Button>
        </div>
    );
};

// Draggable Class Item for Reorder Modal
const DraggableClassOrderItem = ({ classItem, index, moveClassOrder }) => {
    const ref = useRef(null);
    const [{ handlerId }, drop] = useDrop({
        accept: ItemTypes.CLASS_ORDER,
        collect(monitor) { return { handlerId: monitor.getHandlerId() }; },
        hover(item, monitor) {
            if (!ref.current) return;
            const dragIndex = item.index;
            const hoverIndex = index;
            if (dragIndex === hoverIndex) return;
            const hoverBoundingRect = ref.current?.getBoundingClientRect();
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset();
            const hoverClientY = clientOffset.y - hoverBoundingRect.top;
            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
            moveClassOrder(dragIndex, hoverIndex);
            item.index = hoverIndex;
        },
    });
    const [{ isDragging }, drag] = useDrag({
        type: ItemTypes.CLASS_ORDER,
        item: () => ({ id: classItem.id, index }),
        collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    });
    drag(drop(ref));

    return (
        <div ref={ref} data-handler-id={handlerId} className={`flex items-center justify-between p-3 mb-2 bg-white dark:bg-slate-800 border rounded-lg shadow-sm cursor-move ${isDragging ? 'opacity-50' : 'opacity-100'}`}>
            <div className="flex items-center gap-3">
                <GripVertical className="w-5 h-5 text-muted-foreground" />
                <div>
                    <p className="font-semibold text-sm">{classItem.nama_kelas}</p>
                    <p className="text-xs text-muted-foreground">{classItem.guru?.nama || 'Tanpa Guru'} â€¢ {getSessionName(classItem.sesi)}</p>
                </div>
            </div>
        </div>
    );
};

const ReorderClassesModal = ({ isOpen, onClose, classes, onSave }) => {
    const [orderedClasses, setOrderedClasses] = useState([]);

    useEffect(() => {
        if (isOpen) {
            setOrderedClasses([...classes].sort((a, b) => (a.order || 0) - (b.order || 0)));
        }
    }, [isOpen, classes]);

    const moveClassOrder = useCallback((dragIndex, hoverIndex) => {
        setOrderedClasses((prevClasses) => {
            const newClasses = [...prevClasses];
            const [draggedClass] = newClasses.splice(dragIndex, 1);
            newClasses.splice(hoverIndex, 0, draggedClass);
            return newClasses;
        });
    }, []);

    const handleSave = () => {
        onSave(orderedClasses);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Atur Urutan Kelas</DialogTitle>
                    <DialogDescription>Geser untuk mengubah urutan tampilan kelas.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar my-4">
                    {orderedClasses.map((cls, index) => (
                        <DraggableClassOrderItem
                            key={cls.id}
                            index={index}
                            classItem={cls}
                            moveClassOrder={moveClassOrder}
                        />
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Batal</Button>
                    <Button onClick={handleSave}>Simpan Urutan</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const SessionConfigDialog = ({ open, onOpenChange, config, onSave }) => {
    const [localSessions, setLocalSessions] = useState([]);
    const [newSessionName, setNewSessionName] = useState('');
    const [newSessionTime, setNewSessionTime] = useState('');

    useEffect(() => {
        if (config) {
            setLocalSessions(Object.entries(config).map(([name, time]) => ({ name, time })));
        }
    }, [config, open]);

    const handleUpdateSession = (name, newTime) => {
        setLocalSessions(prev => prev.map(s => s.name === name ? { ...s, time: newTime } : s));
    };

    const handleDeleteSession = (name) => {
        setLocalSessions(prev => prev.filter(s => s.name !== name));
    };

    const handleAddSession = () => {
        if (!newSessionName || !newSessionTime) return;
        if (localSessions.some(s => s.name.toLowerCase() === newSessionName.toLowerCase())) {
            toast({ title: "Sesi sudah ada", description: "Nama sesi tidak boleh sama.", variant: "destructive" });
            return;
        }
        setLocalSessions(prev => [...prev, { name: newSessionName, time: newSessionTime }]);
        setNewSessionName('');
        setNewSessionTime('');
    };

    const moveSession = useCallback((dragIndex, hoverIndex) => {
        setLocalSessions((prev) => {
            const updated = [...prev];
            const [moved] = updated.splice(dragIndex, 1);
            updated.splice(hoverIndex, 0, moved);
            return updated;
        });
    }, []);

    const handleSave = () => {
        onSave(localSessions);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Konfigurasi Waktu Sesi</DialogTitle>
                    <DialogDescription>Atur nama, waktu, dan urutan sesi.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-1 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                         {localSessions.map((session, index) => (
                             <DraggableSessionItem
                                key={session.name}
                                index={index}
                                name={session.name}
                                time={session.time}
                                moveSession={moveSession}
                                onUpdate={handleUpdateSession}
                                onDelete={handleDeleteSession}
                             />
                         ))}
                         {localSessions.length === 0 && <div className="text-center text-sm text-muted-foreground py-4">Belum ada sesi dikonfigurasi.</div>}
                    </div>

                    <div className="flex gap-2 items-end pt-4 border-t">
                        <div className="flex-1 space-y-1">
                            <label className="text-xs font-medium">Nama Sesi Baru</label>
                            <Input placeholder="Contoh: Shubuh" value={newSessionName} onChange={e => setNewSessionName(e.target.value)} className="h-9"/>
                        </div>
                        <div className="w-24 space-y-1">
                             <label className="text-xs font-medium">Waktu</label>
                             <Input type="time" value={newSessionTime} onChange={e => setNewSessionTime(e.target.value)} className="h-9"/>
                        </div>
                        <Button onClick={handleAddSession} size="icon" className="h-9 w-9 shrink-0 bg-green-600 hover:bg-green-700">
                            <Plus className="w-4 h-4"/>
                        </Button>
                    </div>
                </div>
                <DialogFooter><Button onClick={handleSave}>Simpan Konfigurasi</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const DraggableSantri = ({ santri, index, moveSantri, hasAttended, onViewDetails }) => {
  const ref = useRef(null);
  const [{ handlerId }, drop] = useDrop({
    accept: ItemTypes.SANTRI,
    collect(monitor) { return { handlerId: monitor.getHandlerId() }; },
    hover(item, monitor) {
      if (!ref.current) return;
      if (item.fromClassId !== santri.id_kelas) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
      moveSantri(dragIndex, hoverIndex, santri.id_kelas);
      item.index = hoverIndex;
    },
  });
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.SANTRI,
    item: { santriId: santri.id, fromClassId: santri.id_kelas, index },
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
  }));
  drag(drop(ref));
  return (
    <div ref={ref} data-handler-id={handlerId} style={{ opacity: isDragging ? 0.3 : 1 }} className="flex items-center justify-between gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-move shadow-sm group relative hover:shadow-md transition-all border border-transparent hover:border-primary/20">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative cursor-pointer" onClick={() => onViewDetails(santri)}>
            <Avatar className="w-9 h-9">
                <AvatarImage src={santri.foto_url} />
                <AvatarFallback>{santri.nama_lengkap.charAt(0)}</AvatarFallback>
            </Avatar>
            {hasAttended && (
                <div className="absolute -bottom-1 -right-1 z-10 drop-shadow-md">
                    <Check className="w-5 h-5 text-green-500 font-bold" strokeWidth={4} />
                </div>
            )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{santri.nama_lengkap}</p>
          <p className="text-xs text-muted-foreground">{santri.jilid}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onViewDetails(santri); }}><Eye className="w-3 h-3" /></Button>
      </div>
    </div>
  );
};

const DroppableColumn = React.forwardRef(({ title, children, onDrop, icon, isOverClass, capacityText, capacityColor, borderColor }, ref) => {
  const [{ isOverSantri }, dropSantri] = useDrop(() => ({
    accept: ItemTypes.SANTRI,
    drop: (item) => onDrop(item),
    collect: (monitor) => ({ isOverSantri: !!monitor.isOver() && monitor.canDrop() }),
  }));
  const combinedRef = (node) => { dropSantri(node); if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; };
  const getBackgroundColor = () => {
    if (isOverClass) return 'bg-yellow-100 dark:bg-emerald-900/50';
    if (isOverSantri) return 'bg-blue-100 dark:bg-emerald-900/50';
    return 'bg-background dark:bg-gray-800/50';
  };
  return (
    <div ref={combinedRef} className={`p-4 rounded-xl shadow-lg border-2 ${borderColor || 'border-transparent'} space-y-4 transition-all duration-300 ${getBackgroundColor()} hover:shadow-xl`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-primary w-full overflow-hidden"><div className="shrink-0">{icon}</div><span className="whitespace-nowrap truncate">{title}</span>{capacityText && (<span className={`text-sm font-medium ml-auto ${capacityColor}`}>{capacityText}</span>)}</div>
      </div>
      <div className="space-y-2 min-h-[150px] max-h-96 overflow-y-auto pr-2 rounded-lg custom-scrollbar">{children}</div>
    </div>
  );
});
DroppableColumn.displayName = 'DroppableColumn';

const ClassCard = ({ classItem, index, children, onDropSantri, onEdit, onDelete, onShowDetails, onShowPerformance, santriCount, userRole }) => {
  const ref = useRef(null);
  const [{ handlerId }, drop] = useDrop({
    accept: ItemTypes.CLASS,
    collect(monitor) { return { handlerId: monitor.getHandlerId() }; },
    hover(item, monitor) {
    },
  });

  let capacityColor = 'text-blue-600 dark:text-emerald-400';
  let borderColor = 'border-blue-500 dark:border-emerald-500';
  if (santriCount > 15) { capacityColor = 'text-red-600 dark:text-red-400'; borderColor = 'border-red-500'; }
  else if (santriCount >= 11) { capacityColor = 'text-yellow-600 dark:text-yellow-400'; borderColor = 'border-yellow-500'; }

  drop(ref);
  const waLink = classItem.guru?.no_hp ? `https://wa.me/${classItem.guru.no_hp.replace(/\D/g, '').replace(/^0/, '62')}` : null;

  return (
    <div ref={ref} data-handler-id={handlerId}>
      <DroppableColumn ref={ref} title={classItem.nama_kelas} onDrop={item => onDropSantri(item, classItem.id)} icon={<Users className="w-5 h-5"/>} capacityText={`${santriCount}/15`} capacityColor={capacityColor} borderColor={borderColor}>
        <div className="flex justify-between items-start">
          <div><div className="text-sm text-muted-foreground mb-2">{classItem.guru?.nama || 'Belum ada guru'}{waLink && (<a href={waLink} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center text-green-600 hover:underline"><Phone className="w-3 h-3 mr-1" /> WA</a>)}</div></div>
        </div>
        <div className="flex justify-end gap-2 mb-2 border-b pb-2 flex-wrap">
          {userRole !== 'pentashih' && (<><Button size="sm" variant="outline" onClick={() => onEdit(classItem)}><Edit className="w-3 h-3"/></Button><Button size="sm" variant="destructive" onClick={() => onDelete(classItem.id)}><Trash2 className="w-3 h-3"/></Button></>)}
          <div className="flex gap-1 ml-auto"><Button size="sm" onClick={() => onShowDetails(classItem)} title="Detail Kelas"><BarChart2 className="w-3 h-3 mr-1"/> Detail</Button></div>
        </div>
        {children}
        {(!children || children.length === 0) && <div className="text-center py-8 text-muted-foreground">Tarik santri ke sini</div>}
      </DroppableColumn>
    </div>
  );
};

const GenericClassManagement = ({ userRole, kategori = 'Anak', configKey = 'anakSessionConfig', title = 'Manajemen Kelas (TPQ)', subtitle = 'Atur pembagian kelas, guru pengampu, dan mutasi santri TPQ.' }) => {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [santriList, setSantriList] = useState([]);
  const [guruList, setGuruList] = useState([]);
  const [dailyAttendance, setDailyAttendance] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPerformanceOpen, setIsPerformanceOpen] = useState(false);
  const [isSantriDetailOpen, setIsSantriDetailOpen] = useState(false);
  const [isJilidModalOpen, setIsJilidModalOpen] = useState(false);
  const [isReorderOpen, setIsReorderOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSantri, setSelectedSantri] = useState(null);
  const [jilidChangeData, setJilidChangeData] = useState(null);
  const [mutationHistory, setMutationHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [historyFilters, setHistoryFilters] = useState({ search: '', class: 'all', date: '' });
  const [santriSearch, setSantriSearch] = useState('');
  const [unassignedFilterJilid, setUnassignedFilterJilid] = useState('all');
  const [formData, setFormData] = useState({ nama_kelas: '', sesi: '', id_guru: null, notes: '', kategori });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', description: '', onConfirm: () => {} });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [sessionTimes, setSessionTimes] = useState({ 'Pagi': '08:00', 'Siang': '14:00', 'Sore': '16:00' });
  const [sessionFilters, setSessionFilters] = useState(Object.keys(sessionTimes));

  const fetchAllData = useCallback(async () => {
    const today = new Date().toLocaleDateString('en-CA');
    try {
        const [
          { data: classData, error: classError },
          { data: guruData, error: guruError },
          { data: rawSantriData, error: santriError },
          { data: attendanceData, error: attendanceError },
          { data: configData }
        ] = await Promise.all([
          supabase
            .from('classes')
            .select('id, nama_kelas, id_guru, sesi, kategori, sort_order, is_active, guru:id_guru(id, nama, foto_url, no_hp)')
            .order('sort_order', { ascending: true, nullsFirst: false }),
          supabase.from('guru').select('id, nama, foto_url, no_hp, roles, status'),
          supabase
            .from('santri')
            .select('id, nomor_induk_qiroati, nama_lengkap, nama_panggilan, kategori, jenis_kelamin, tanggal_lahir, tempat_lahir, alamat, no_hp_ortu, foto_url, avatar_path, rfid_tag, current_class_id, sesi_mengaji, jilid, status, points, order_in_class, created_at')
            .order('order_in_class', { ascending: true, nullsFirst: false }),
          supabase.from('attendance').select('*').eq('attendance_date', today),
          supabase.from('website_content').select('content').eq('key', configKey).maybeSingle()
        ]);

        if (classError || guruError || santriError || attendanceError) {
          toast({ title: 'Gagal memuat data', description: (classError || guruError || santriError || attendanceError).message, variant: 'destructive' });
          return;
        }

        const resolvedGuruData = await resolveAvatarRecords(guruData, { ownerType: 'guru' });
        const resolvedSantriData = await resolveAvatarRecords(rawSantriData, { ownerType: 'santri' });
        const resolvedClassData = await Promise.all((classData || []).map(async (classItem) => ({
            ...classItem,
            guru: await resolveAvatarRecord(classItem.guru, { ownerType: 'guru' }),
        })));
        const mappedClasses = resolvedClassData.map(mapClassForLegacyUi);
        const filteredClasses = mappedClasses.filter(c => {
            if (c.is_active === false) return false;
            if (kategori === 'Anak') return !c.kategori || c.kategori.toLowerCase() === 'anak';
            return c.kategori === kategori;
        });
        setClasses(filteredClasses);

        setGuruList(resolvedGuruData);

        const filteredSantri = resolvedSantriData.map(mapSantriForLegacyUi).filter(s => {
            const isMatch = kategori === 'Anak' ? (!s.kategori || s.kategori.toLowerCase() === 'anak' || s.kategori.toLowerCase() === 'tpq') : s.kategori === kategori;
            const isActive = !s.status || s.status.toLowerCase() === 'aktif' || s.status.toLowerCase() === 'active';
            return isMatch && isActive;
        });
        setSantriList(filteredSantri);

        setDailyAttendance(attendanceData || []);

        if (configData?.content) {
            let parsed = configData.content;
            let times = {};
            let filters = [];
            if (Array.isArray(parsed)) {
                parsed.forEach(item => {
                    times[item.name] = item.time;
                    filters.push(item.name);
                });
            } else {
                times = parsed;
                filters = Object.keys(parsed);
            }
            setSessionTimes(times);
            setSessionFilters(filters);
            setFormData(prev => ({...prev, sesi: filters[0] || ''}));
        } else {
            const mappedSessions = getAllSessions().map(s => s.name);
            setSessionFilters(mappedSessions);
            setFormData(prev => ({...prev, sesi: mappedSessions[0] || ''}));
        }
    } catch (err) {
        console.error("Error in fetchAllData:", err);
    }
  }, [kategori, configKey]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const handleSaveConfig = async (newLocalSessions) => {
      try {
          const arrayConfig = newLocalSessions.map(s => ({ name: s.name, time: s.time }));
          const { data: existingConfig, error: fetchError } = await supabase.from('website_content').select('id').eq('key', configKey).maybeSingle();

          if (fetchError) throw fetchError;

          let saveError;
          if (existingConfig) {
              const { error } = await supabase.from('website_content').update({ content: arrayConfig }).eq('id', existingConfig.id);
              saveError = error;
          } else {
              const { error } = await supabase.from('website_content').insert({ key: configKey, content: arrayConfig });
              saveError = error;
          }

          if (saveError) throw saveError;

          const newSessionTimes = {};
          newLocalSessions.forEach(s => newSessionTimes[s.name] = s.time);
          setSessionTimes(newSessionTimes);

          const newSessionKeys = newLocalSessions.map(s => s.name);
          setSessionFilters(newSessionKeys);

          setFormData(prev => ({
              ...prev,
              sesi: newSessionKeys.includes(prev.sesi) ? prev.sesi : (newSessionKeys[0] || '')
          }));

          setIsConfigOpen(false);
          toast({ title: 'Berhasil', description: 'Konfigurasi sesi berhasil disimpan dan diperbarui.' });

          setTimeout(() => {
              fetchAllData();
          }, 800);

      } catch (err) {
          console.error("Error saving config:", err);
          toast({ title: 'Gagal', description: 'Gagal menyimpan konfigurasi sesi: ' + err.message, variant: 'destructive' });
      }
  };

  const saveReorderedClasses = async (orderedClasses) => {
      setClasses(orderedClasses);

      const updates = orderedClasses.map((cls, index) =>
        supabase.from('classes').update({ sort_order: index + 1 }).eq('id', cls.id)
      );
      const results = await Promise.all(updates);
      const firstError = results.find(result => result.error)?.error;
      if (firstError) {
          toast({ title: 'Gagal', description: firstError.message, variant: 'destructive' });
          fetchAllData();
      } else {
          toast({ title: 'Berhasil', description: 'Urutan kelas diperbarui.' });
      }
  };

  const moveSantri = useCallback(() => {
    // Reorder/mutasi santri membutuhkan operasi backend atomik agar current_class_id
    // dan class_memberships tetap konsisten.
  }, []);

  useEffect(() => {
    let filtered = mutationHistory;
    if (historyFilters.search) filtered = filtered.filter(m => m.santri?.nama_lengkap.toLowerCase().includes(historyFilters.search.toLowerCase()));
    if (historyFilters.class !== 'all') filtered = filtered.filter(m => m.from_class_id === historyFilters.class || m.to_class_id === historyFilters.class);
    if (historyFilters.date) filtered = filtered.filter(m => new Date(m.mutation_date).toISOString().split('T')[0] === historyFilters.date);
    setFilteredHistory(filtered);
  }, [mutationHistory, historyFilters]);

  const handleShowDetails = (classItem) => { setSelectedClass(classItem); setIsDetailOpen(true); };
  const handleShowPerformance = (classItem) => { setSelectedClass(classItem); setIsPerformanceOpen(true); };
  const handleViewSantriDetails = (santri) => { setSelectedSantri(santri); setIsSantriDetailOpen(true); };

  const resetForm = () => {
      const sessions = Object.keys(sessionTimes);
      setFormData({ nama_kelas: '', sesi: sessions[0] || '', id_guru: null, notes: '', kategori });
      setEditingClass(null);
  };

  const handleAdd = () => { resetForm(); setIsFormOpen(true); };

  const handleEdit = (classItem) => {
      setEditingClass(classItem);
      setFormData({
          nama_kelas: classItem.nama_kelas,
          sesi: getSessionName(classItem.sesi),
          id_guru: classItem.id_guru,
          notes: classItem.notes || '',
          kategori
      });
      setIsFormOpen(true);
  };

  const confirmDeleteClass = (id) => {
    setConfirmDialog({
        isOpen: true,
        title: 'Nonaktifkan Kelas',
        description: 'Kelas akan dinonaktifkan. Kelas yang masih memiliki membership aktif tidak akan diubah agar data santri tetap konsisten.',
        onConfirm: async () => {
            const { count, error: membershipError } = await supabase
              .from('class_memberships')
              .select('id', { count: 'exact', head: true })
              .eq('class_id', id)
              .eq('status', 'active');
            if (membershipError) {
              toast({ title: 'Gagal memeriksa kelas', description: membershipError.message, variant: 'destructive' });
              return;
            }
            if (count > 0) {
              toast({
                title: 'Kelas masih berisi santri',
                description: 'Pindahkan santri melalui operasi backend atomik sebelum menonaktifkan kelas.',
                variant: 'destructive'
              });
              return;
            }
            const { error } = await supabase.from('classes').update({ is_active: false }).eq('id', id);
            if (error) toast({ title: 'Gagal menonaktifkan', description: error.message, variant: 'destructive' });
            else { toast({ title: 'Berhasil!', description: 'Kelas telah dinonaktifkan.' }); fetchAllData(); }
        }
    });
  };

  const handleDropSantri = async (item, toClassId) => {
    if (item.fromClassId === toClassId) return;
    if (userRole !== 'admin') {
      toast({ title: 'Akses ditolak', description: 'Hanya admin yang boleh memindahkan kelas santri.', variant: 'destructive' });
      return;
    }
    if (!toClassId) {
      toast({
        title: 'Kelas tujuan belum dipilih',
        description: 'Mengeluarkan santri dari kelas perlu operasi backend terpisah dan masih ditunda.',
        variant: 'destructive'
      });
      return;
    }

    const targetClass = classes.find(c => c.id === toClassId);
    const { data, error } = await supabase.rpc('move_santri_to_class', {
      p_santri_id: item.santriId,
      p_to_class_id: toClassId,
      p_reason: `Mutasi kelas melalui dashboard admin${targetClass ? ` ke ${targetClass.nama_kelas}` : ''}`,
    });

    if (error) {
      toast({ title: 'Gagal memindahkan santri', description: error.message, variant: 'destructive' });
      fetchAllData();
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    toast({
      title: result?.changed ? 'Berhasil!' : 'Data disinkronkan',
      description: result?.message || 'Mutasi kelas selesai.',
    });
    fetchAllData();
  };

  const initiateJilidChange = (santri, direction) => {
      const currentIndex = jilidOptions.indexOf(santri.jilid);
      if (direction === 'up') {
        if (currentIndex >= jilidOptions.length - 1) { toast({ title: 'Info', description: 'Santri sudah di jilid terakhir.' }); return; }
        setJilidChangeData({ santri, direction: 'up', currentJilid: santri.jilid, nextJilid: jilidOptions[currentIndex + 1] });
      } else {
        if (currentIndex <= 0) { toast({ title: 'Info', description: 'Santri sudah di jilid pertama.' }); return; }
        setJilidChangeData({ santri, direction: 'down', currentJilid: santri.jilid, nextJilid: jilidOptions[currentIndex - 1] });
      }
      setIsJilidModalOpen(true);
  };

  const confirmJilidChange = async () => {
      if (!jilidChangeData) return;
      const { santri, currentJilid, nextJilid } = jilidChangeData;
      const { error: updateError } = await supabase.from('santri').update({ jilid: nextJilid }).eq('id', santri.id);
      if (updateError) { toast({ title: 'Gagal!', description: updateError.message, variant: 'destructive' }); return; }
      await supabase.from('jilid_history').insert({ santri_id: santri.id, from_jilid: currentJilid, to_jilid: nextJilid, changed_by: user.id });
      toast({ title: 'Berhasil!', description: `Jilid santri diubah ke ${nextJilid}.` });
      fetchAllData(); setIsJilidModalOpen(false); setJilidChangeData(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const classData = {
      nama_kelas: formData.nama_kelas,
      sesi: formData.sesi,
      id_guru: formData.id_guru || null,
      kategori,
    };
    if (!editingClass) {
      classData.sort_order = classes.reduce((max, c) => Math.max(max, c.sort_order || c.order || 0), 0) + 1;
      classData.is_active = true;
    }
    const { error } = editingClass
      ? await supabase.from('classes').update(classData).eq('id', editingClass.id)
      : await supabase.from('classes').insert(classData);
    if (error) toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Berhasil!', description: 'Data kelas berhasil disimpan.' }); setIsFormOpen(false); fetchAllData(); }
  };

  const showHistory = async () => {
    const { data, error } = await supabase.from('class_mutations').select('*, santri:santri_id(id, nama_lengkap, foto_url, avatar_path), from_class:from_class_id(nama_kelas, sesi, guru:id_guru(nama)), to_class:to_class_id(nama_kelas, sesi, guru:id_guru(nama))').order('mutation_date', { ascending: false });
    if (error) { toast({ title: 'Gagal memuat riwayat', description: error.message, variant: 'destructive'}); }
    else {
      const resolvedHistory = await Promise.all((data || []).map(async (entry) => ({
        ...entry,
        santri: await resolveAvatarRecord(entry.santri, { ownerType: 'santri' }),
      })));
      setMutationHistory(resolvedHistory);
      setFilteredHistory(resolvedHistory);
      setIsHistoryOpen(true);
    }
  };

  const confirmDeleteHistory = (id) => {
    setConfirmDialog({
        isOpen: true,
        title: 'Hapus Riwayat',
        description: 'Apakah Anda yakin ingin menghapus riwayat ini? Tindakan ini tidak dapat dibatalkan.',
        onConfirm: async () => {
            const { error } = await supabase.from('class_mutations').delete().eq('id', id);
            if (error) toast({ title: 'Gagal menghapus', variant: 'destructive' });
            else { toast({ title: 'Berhasil', description: 'Riwayat berhasil dihapus.' }); setMutationHistory(prev => prev.filter(m => m.id !== id)); }
        }
    });
  };

  const toggleSessionFilter = (session) => { setSessionFilters(prev => prev.includes(session) ? prev.filter(s => s !== session) : [...prev, session]); };

  const classesBySession = useMemo(() => {
    const grouped = {};
    Object.keys(sessionTimes).forEach(key => grouped[key] = []);
    classes.forEach(c => {
        const sessionName = getSessionName(c.sesi);
        if (!grouped[sessionName]) grouped[sessionName] = [];
        grouped[sessionName].push(c);
    });
    Object.keys(grouped).forEach(key => grouped[key].sort((a,b) => (a.order || 0) - (b.order || 0)));
    return grouped;
  }, [classes, sessionTimes]);

  const santriByClass = useMemo(() => {
    const grouped = classes.reduce((acc, cls) => ({ ...acc, [cls.id]: [] }), {});
    const sortedSantri = [...santriList].sort((a, b) => (a.order_in_class || 999) - (b.order_in_class || 999));
    const lowercasedSearch = santriSearch.toLowerCase();
    sortedSantri.forEach(s => { if (s.id_kelas && grouped[s.id_kelas] && (!lowercasedSearch || s.nama_lengkap.toLowerCase().includes(lowercasedSearch))) { grouped[s.id_kelas].push(s); } });
    return grouped;
  }, [classes, santriList, santriSearch]);

  const attendanceById = useMemo(() => new Set(dailyAttendance.map(a => a.user_id)), [dailyAttendance]);
  const filteredUnassignedSantri = useMemo(() => santriList.filter(s => !s.id_kelas && (unassignedFilterJilid === 'all' || s.jilid === unassignedFilterJilid) && (!santriSearch || s.nama_lengkap.toLowerCase().includes(santriSearch.toLowerCase()))), [santriList, santriSearch, unassignedFilterJilid]);
  const handleExportToExcel = () => {
    try {
        const data = [];
        if (!sessionTimes || Object.keys(sessionTimes).length === 0) {
            toast({ title: 'Data Kosong', description: 'Tidak ada sesi terdaftar untuk diekspor.', variant: 'destructive' });
            return;
        }

        Object.keys(sessionTimes).forEach(session => {
            const classGroup = classesBySession[session] || [];
            classGroup.forEach(cls => {
                const students = santriByClass[cls.id] || [];
                if (students.length > 0) {
                    students.forEach(s => {
                        data.push({
                            Sesi: getSessionName(cls.sesi) || '',
                            Kelas: cls.nama_kelas || '',
                            Guru: cls.guru?.nama || '-',
                            Santri: s.nama_lengkap || '-',
                            Jilid: s.jilid || '-'
                        });
                    });
                } else {
                    data.push({
                        Sesi: getSessionName(cls.sesi) || '',
                        Kelas: cls.nama_kelas || '',
                        Guru: cls.guru?.nama || '-',
                        Santri: '(Kosong)',
                        Jilid: '-'
                    });
                }
            });
        });

        if (data.length === 0) {
            toast({ title: 'Data Kosong', description: 'Tidak ada data kelas atau santri untuk diekspor.', variant: 'destructive' });
            return;
        }

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{wch: 15}, {wch: 20}, {wch: 30}, {wch: 30}, {wch: 15}];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Kelas ${kategori}`);

        const dateStr = new Date().toLocaleDateString('id-ID').replace(/\//g, '-');
        XLSX.writeFile(wb, `Kelas_LPQ_${kategori}_${dateStr}.xlsx`);

        toast({ title: 'Ekspor Berhasil', description: 'File Excel berhasil diunduh.' });
    } catch (error) {
        console.error("Export Error:", error);
        toast({ title: 'Ekspor Gagal', description: error.message || 'Terjadi kesalahan saat mengekspor data.', variant: 'destructive' });
    }
  };

  return (
      <div className="space-y-6">
        <div className="admin-panel-header">
          <div className="flex items-center gap-3">
             <div className="admin-panel-header-icon">
                {kategori === 'Anak' ? <GraduationCap /> : <BookOpen />}
             </div>
             <div className="admin-panel-header-text">
                <h2>{title}</h2>
                <p>{subtitle}</p>
             </div>
          </div>

          <div className="admin-panel-header-actions">
            <div className="admin-action-cluster">
                {userRole !== 'pentashih' && (
                    <button onClick={handleExportToExcel} className="admin-action-cluster-btn">
                        <FileSpreadsheet className="w-3.5 h-3.5"/> Export
                    </button>
                )}
                <button onClick={showHistory} className="admin-action-cluster-btn">
                    <History className="w-3.5 h-3.5"/> Riwayat
                </button>
                {userRole === 'admin' && (
                    <button onClick={() => setIsConfigOpen(true)} className="admin-action-cluster-btn">
                         <Settings className="w-3.5 h-3.5"/> Config Sesi
                    </button>
                )}
            </div>
            {userRole !== 'pentashih' && (
                <>
                    <button onClick={() => setIsReorderOpen(true)} className="admin-panel-primary-btn" style={{ backgroundColor: 'hsl(var(--admin-accent-amber))' }}>
                        <ListOrdered className="w-4 h-4"/> Atur Urutan
                    </button>
                    <button onClick={handleAdd} className="admin-panel-primary-btn">
                        <Plus className="w-4 h-4"/> Tambah Kelas
                    </button>
                </>
            )}
          </div>
        </div>

        <div className="admin-filter-bar">
            <div className="admin-search-input">
                <Search />
                <Input
                    placeholder="Cari santri berdasarkan nama..."
                    value={santriSearch}
                    onChange={e => setSantriSearch(e.target.value)}
                />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                {Object.keys(sessionTimes).map(session => (
                    <button
                        key={session}
                        onClick={() => toggleSessionFilter(session)}
                        className={sessionFilters.includes(session) ? "admin-segmented-control-item active" : "admin-segmented-control-item"}
                    >
                        {session} <span className="ml-1 opacity-70 text-[10px]">({sessionTimes[session]})</span>
                    </button>
                ))}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <DroppableColumn title="Santri Belum Masuk Kelas" onDrop={(item) => handleDropSantri(item, null)} icon={<UserPlus className="w-5 h-5"/>}>
            <div className="p-2 space-y-2 sticky top-0 bg-background z-10"><Select value={unassignedFilterJilid} onValueChange={setUnassignedFilterJilid}><SelectTrigger className="h-9"><SelectValue placeholder="Filter Jilid"/></SelectTrigger><SelectContent><SelectItem value="all">Semua Jilid</SelectItem>{jilidOptions.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent></Select></div>
            {filteredUnassignedSantri.map((santri, index) => <DraggableSantri key={santri.id} index={index} santri={santri} moveSantri={moveSantri} hasAttended={attendanceById.has(santri.id)} onViewDetails={handleViewSantriDetails} />)}
            {filteredUnassignedSantri.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">Tidak ada santri.</p>}
          </DroppableColumn>
        </div>

        {Object.keys(sessionTimes).map(session => sessionFilters.includes(session) && classesBySession[session] && (
          <div key={session} className="space-y-4">
            <div className="flex items-center gap-2 border-b-2 border-primary/10 pb-2 mb-4">
                 <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 text-lg px-3 py-1">{session}</Badge>
                 <span className="text-muted-foreground font-medium flex items-center gap-1"><Clock className="w-4 h-4"/> {sessionTimes[session]}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {classesBySession[session].map((classItem) => (
                <ClassCard key={classItem.id} index={classes.findIndex(c => c.id === classItem.id)} classItem={classItem} onDropSantri={handleDropSantri} onEdit={handleEdit} onDelete={confirmDeleteClass} onShowDetails={handleShowPerformance} onShowPerformance={handleShowPerformance} santriCount={(santriByClass[classItem.id] || []).length} userRole={userRole}>
                  {(santriByClass[classItem.id] || []).map((santri, santriIndex) => (
                    <DraggableSantri
                        key={santri.id}
                        santri={santri}
                        index={santriIndex}
                        moveSantri={moveSantri}
                        hasAttended={attendanceById.has(santri.id)}
                        onViewDetails={handleViewSantriDetails}
                    />
                  ))}
                </ClassCard>
              ))}
              {classesBySession[session].length === 0 && (
                  <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                      Belum ada kelas untuk sesi {session}.
                  </div>
              )}
            </div>
          </div>
        ))}

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingClass ? 'Edit Kelas' : 'Tambah Kelas'}</DialogTitle>
                <DialogDescription className="sr-only">Formulir untuk menambah atau mengedit kelas.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label>Nama Kelas</label><Input value={formData.nama_kelas} onChange={e => setFormData({ ...formData, nama_kelas: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label>Sesi</label>
                    <Select value={formData.sesi} onValueChange={val => setFormData({ ...formData, sesi: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.keys(sessionTimes).map(s => <SelectItem key={s} value={s}>{s} ({sessionTimes[s]})</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div><label>Guru</label><Select value={formData.id_guru || 'none'} onValueChange={val => setFormData({ ...formData, id_guru: val === 'none' ? null : val })}><SelectTrigger><SelectValue placeholder="Pilih Guru"/></SelectTrigger><SelectContent><SelectItem value="none">Tidak ada</SelectItem>{guruList.map(g => <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div><label>Catatan</label><Textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })}/></div>
              <DialogFooter><Button type="submit">Simpan</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
                <DialogTitle>Riwayat Mutasi Santri</DialogTitle>
                <DialogDescription className="sr-only">Daftar riwayat mutasi kelas santri.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 my-4">
                <div className="relative flex-grow"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/><Input placeholder="Cari nama santri..." value={historyFilters.search} onChange={e => setHistoryFilters({...historyFilters, search: e.target.value})} className="pl-9"/></div>
                <Input type="date" value={historyFilters.date} onChange={e => setHistoryFilters({...historyFilters, date: e.target.value})} className="w-auto"/>
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {filteredHistory.map(m => (
                <div key={m.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm relative hover:shadow-md transition-all">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                             <Avatar className="h-14 w-14 border-2 border-white shadow-md"><AvatarImage src={m.santri?.foto_url} /><AvatarFallback className="text-lg font-bold bg-slate-200">{m.santri?.nama_lengkap?.[0]}</AvatarFallback></Avatar>
                            <div>
                                <h4 className="font-bold text-lg text-primary">{m.santri?.nama_lengkap || 'Santri Dihapus'}</h4>
                                <div className="flex items-center text-xs text-muted-foreground mt-1 gap-2"><Clock className="w-3 h-3" />{new Date(m.mutation_date).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                   {m.from_jilid && m.to_jilid ? (<div className="flex items-center gap-1 bg-white/50 dark:bg-black/20 px-2 py-1 rounded-md w-fit mt-1 border border-slate-100 dark:border-slate-700"><span className="font-semibold text-red-500">{m.from_jilid}</span><ArrowRight className="w-3 h-3 text-slate-400" /><span className="font-semibold text-green-500">{m.to_jilid}</span></div>) : 'Perubahan Kelas'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 flex-1 justify-center md:px-8">
                            <div className="flex flex-col items-end min-w-[120px]"><p className="font-bold text-sm">{m.from_class?.nama_kelas || 'Luar Kelas'}</p><div className="flex items-center gap-1 text-xs text-muted-foreground"><User className="w-3 h-3"/> {m.from_class?.guru?.nama || '-'}</div>{m.from_class && <Badge variant="outline" className="text-[10px] mt-1 bg-white">{getSessionName(m.from_class.sesi)}</Badge>}</div>
                            <div className="flex flex-col items-center px-2"><ArrowRight className="text-muted-foreground w-5 h-5" /><span className="text-[10px] font-bold uppercase text-muted-foreground mt-1">Pindah</span></div>
                            <div className="flex flex-col items-start min-w-[120px]"><p className="font-bold text-sm">{m.to_class?.nama_kelas || 'Luar Kelas'}</p><div className="flex items-center gap-1 text-xs text-muted-foreground"><User className="w-3 h-3"/> {m.to_class?.guru?.nama || '-'}</div>{m.to_class && <Badge variant="outline" className="text-[10px] mt-1 bg-white">{getSessionName(m.to_class.sesi)}</Badge>}</div>
                        </div>
                        <div><Button variant="ghost" size="icon" onClick={() => confirmDeleteHistory(m.id)} className="text-red-500 hover:bg-red-50 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4"/></Button></div>
                    </div>
                </div>
              ))}
              {filteredHistory.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-50"><History className="w-12 h-12 mb-2"/><p>Tidak ada riwayat mutasi.</p></div>}
            </div>
          </DialogContent>
        </Dialog>

        <SantriDetailModal santri={selectedSantri} isOpen={isSantriDetailOpen} onOpenChange={setIsSantriDetailOpen} onPromote={() => initiateJilidChange(selectedSantri, 'up')} onDemote={() => initiateJilidChange(selectedSantri, 'down')} />
        <JilidChangeModal isOpen={isJilidModalOpen} onClose={() => setIsJilidModalOpen(false)} onConfirm={confirmJilidChange} {...jilidChangeData} kategori={kategori} />
        <ClassPerformanceModal isOpen={isPerformanceOpen} onClose={() => setIsPerformanceOpen(false)} classItem={selectedClass} />
        <ConfirmationDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} description={confirmDialog.description} />

        <SessionConfigDialog open={isConfigOpen} onOpenChange={setIsConfigOpen} config={sessionTimes} onSave={handleSaveConfig} />

        <ReorderClassesModal isOpen={isReorderOpen} onClose={() => setIsReorderOpen(false)} classes={classes} onSave={saveReorderedClasses} />
      </div>
  );
};

const ClassManagementWrapper = ({ userRole = 'admin' }) => {
    const [activeTab, setActiveTab] = useState("tpq");

    const subTabs = [
        { id: 'tpq', label: 'Santri TPQ', icon: GraduationCap },
        { id: 'ptpt', label: 'Santri PTPT', icon: BookOpen },
        { id: 'dewasa', label: 'Santri Dewasa', icon: Briefcase },
    ];

  return (
      <div>
        <div className="flex justify-center mb-6">
            <div className="admin-segmented-control">
                {subTabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`admin-segmented-control-item ${activeTab === tab.id ? 'active' : ''}`}
                    >
                        {activeTab === tab.id && (
                            <motion.span
                                layoutId="class-management-active-pill"
                                className="admin-segmented-control-indicator"
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

            <TabsContent value="tpq">
                <GenericClassManagement key="tpq" userRole={userRole} kategori="Anak" configKey="anakSessionConfig" title="Manajemen Kelas (TPQ)" subtitle="Atur pembagian kelas, guru pengampu, dan mutasi santri TPQ." />
            </TabsContent>
            <TabsContent value="ptpt">
                <GenericClassManagement key="ptpt" userRole={userRole} kategori="PTPT" configKey="ptptSessionConfig" title="Manajemen Kelas (PTPT)" subtitle="Atur pembagian kelas, guru pengampu, dan mutasi santri PTPT." />
            </TabsContent>
            <TabsContent value="dewasa">
                <AdultClassManagement />
            </TabsContent>
        </Tabs>
      </div>
  );
}

export default ClassManagementWrapper;
