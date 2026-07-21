import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { Users, BookOpen, Award, Calendar, UserCheck } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { resolveAvatarRecord, resolveAvatarRecords } from '@/lib/storageAdapters';

const PentashihDashboard = () => {
  const { user } = useAuth();
  const [guruData, setGuruData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [santriList, setSantriList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const [guruRes, classesRes, membershipsRes, santriRes] = await Promise.all([
        supabase
          .from('guru')
          .select('id, nama, foto_url, rfid_tag, no_hp, jabatan')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('classes')
          .select('id, nama_kelas, sesi, kategori, sort_order, id_guru, guru:id_guru(id, nama, no_hp)')
          .eq('is_active', true)
          .order('sort_order', { ascending: true, nullsFirst: false }),
        supabase
          .from('class_memberships')
          .select('id, santri_id, class_id, order_in_class, status')
          .eq('status', 'active')
          .order('order_in_class', { ascending: true, nullsFirst: false }),
        supabase
          .from('santri')
          .select('id, nama_lengkap, nama_panggilan, nomor_induk_qiroati, foto_url, avatar_path, jilid, current_class_id, sesi_mengaji, status')
          .order('nama_lengkap'),
      ]);

      const firstError = guruRes.error || classesRes.error || membershipsRes.error || santriRes.error;
      if (firstError) throw firstError;

      const resolvedGuru = await resolveAvatarRecord(guruRes.data, { ownerType: 'guru' });
      const resolvedSantri = await resolveAvatarRecords(santriRes.data, { ownerType: 'santri' });
      setGuruData(resolvedGuru || null);
      setClasses(classesRes.data || []);
      setMemberships(membershipsRes.data || []);
      setSantriList(resolvedSantri);
    } catch (error) {
      toast({ title: 'Gagal memuat dashboard pentashih', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const santriById = useMemo(
    () => Object.fromEntries(santriList.map(santri => [santri.id, santri])),
    [santriList]
  );

  const classesWithSantri = useMemo(() => {
    return classes.map(classItem => ({
      ...classItem,
      santri: memberships
        .filter(membership => membership.class_id === classItem.id)
        .map(membership => ({
          ...santriById[membership.santri_id],
          order_in_class: membership.order_in_class,
        }))
        .filter(Boolean),
    }));
  }, [classes, memberships, santriById]);

  const stats = useMemo(() => ({
    classes: classesWithSantri.length,
    santri: classesWithSantri.reduce((total, classItem) => total + classItem.santri.length, 0),
  }), [classesWithSantri]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase text-purple-700 dark:text-purple-400 tracking-wide">Dashboard Pentashih</h1>
          <p className="text-muted-foreground">Akses seluruh kelas dan detail santri LPQ.</p>
        </div>
        <div className="px-3 py-1 bg-white dark:bg-slate-800 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Card className="bg-white dark:bg-slate-800 border-l-4 border-purple-500 shadow-md">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <Users className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{stats.santri}</p>
                <p className="text-sm text-muted-foreground uppercase font-bold tracking-wider">Seluruh Santri</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-slate-800 border-l-4 border-blue-500 shadow-md">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <BookOpen className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{stats.classes}</p>
                <p className="text-sm text-muted-foreground uppercase font-bold tracking-wider">Seluruh Kelas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-4">
          {guruData ? (
            <Card className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white h-full shadow-xl relative overflow-hidden border-0">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Award className="w-32 h-32" /></div>
              <CardContent className="p-6 flex flex-col justify-center h-full relative z-10">
                <div className="flex items-center gap-4 mb-2">
                  <Avatar className="w-16 h-16 border-4 border-white/30 shadow-lg">
                    <AvatarImage src={guruData.foto_url} className="object-cover" />
                    <AvatarFallback className="text-purple-700 font-bold text-xl bg-white">{guruData.nama?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-bold leading-tight">{guruData.nama}</h2>
                    <p className="text-purple-200 text-sm font-medium bg-white/20 inline-block px-2 py-0.5 rounded-full mt-1">Pentashih</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/20 text-sm text-purple-100 flex flex-col gap-1">
                  <span className="opacity-80">ID: {guruData.rfid_tag || '-'}</span>
                  <span className="opacity-80">{guruData.no_hp || '-'}</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full bg-slate-200 animate-pulse rounded-xl" />
          )}
        </div>
      </div>

      <div className="space-y-5">
        {isLoading && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">Memuat seluruh data kelas...</CardContent>
          </Card>
        )}

        {!isLoading && classesWithSantri.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">
              <UserCheck className="w-12 h-12 mx-auto text-purple-400 mb-3" />
              <h2 className="text-xl font-bold text-foreground mb-1">Belum Ada Kelas</h2>
              <p className="text-muted-foreground">Belum ada kelas aktif yang dapat ditampilkan.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && classesWithSantri.map(classItem => (
          <Card key={classItem.id} className="bg-white dark:bg-slate-900 border border-border shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-bold text-foreground">{classItem.nama_kelas}</h2>
                    <Badge variant="outline">{classItem.kategori || 'Anak'}</Badge>
                    <Badge variant="secondary">{classItem.sesi || '-'}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Guru pengampu: {classItem.guru?.nama || 'Belum ada guru'}</p>
                </div>
                <Badge className="w-fit bg-purple-100 text-purple-700 hover:bg-purple-100">{classItem.santri.length} santri</Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 pr-3 text-left font-semibold w-12">No</th>
                      <th className="py-2 px-3 text-left font-semibold">Santri</th>
                      <th className="py-2 px-3 text-left font-semibold">Nomor Induk</th>
                      <th className="py-2 px-3 text-left font-semibold">Jilid</th>
                      <th className="py-2 pl-3 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classItem.santri.map((santri, index) => (
                      <tr key={santri.id} className="border-b last:border-0">
                        <td className="py-3 pr-3 text-muted-foreground">{index + 1}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9">
                              <AvatarImage src={santri.foto_url} />
                              <AvatarFallback>{santri.nama_lengkap?.charAt(0) || '?'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-foreground">{santri.nama_lengkap}</p>
                              <p className="text-xs text-muted-foreground">{santri.nama_panggilan || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-xs">{santri.nomor_induk_qiroati}</td>
                        <td className="py-3 px-3">{santri.jilid || '-'}</td>
                        <td className="py-3 pl-3">{santri.status || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {classItem.santri.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">Belum ada santri aktif dalam kelas ini.</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PentashihDashboard;
