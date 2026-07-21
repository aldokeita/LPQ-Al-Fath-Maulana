import React, { useMemo } from 'react';
import { Cake, MessageCircle, PartyPopper } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildBirthdayWhatsappUrl, getBirthdaysThisMonth } from '@/lib/birthdayUtils';

const BirthdayNotificationModal = ({ isOpen, onClose, students = [], audience = 'santri' }) => {
  const birthdaysThisMonth = useMemo(() => getBirthdaysThisMonth(students), [students]);

  const openWhatsappGreeting = (student) => {
    const url = buildBirthdayWhatsappUrl(student, audience);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="lpq-dialog-surface max-h-[88vh] max-w-2xl overflow-hidden border-slate-200/90 bg-slate-50/[0.97] p-0 shadow-[0_28px_90px_rgba(15,23,42,0.2)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/[0.94]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.1),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.08),transparent_42%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.14),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_42%)]" />
        <DialogHeader className="relative border-b border-slate-200/80 px-6 pb-5 pt-6 text-left dark:border-white/10 sm:px-8 sm:pt-8">
          <DialogTitle className="flex items-center gap-2 text-2xl font-black text-slate-900 dark:text-white">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300">
              <Cake className="h-5 w-5" />
            </span>
            {audience === 'guru' ? 'Ulang Tahun Guru Bulan Ini' : 'Ulang Tahun Santri Bulan Ini'}
          </DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-300">
            {audience === 'guru' ? 'Daftar pengajar yang berulang tahun pada bulan berjalan.' : 'Daftar santri yang berulang tahun pada bulan berjalan.'}
          </DialogDescription>
        </DialogHeader>

        {birthdaysThisMonth.length > 0 ? (
          <div className="relative grid max-h-[62vh] gap-3 overflow-y-auto px-6 py-5 sm:grid-cols-2 sm:px-8">
            {birthdaysThisMonth.map((student) => {
              const hasWhatsapp = student.isBirthdayToday && Boolean(buildBirthdayWhatsappUrl(student, audience));
              return (
                <article key={student.id} className="group flex flex-col gap-4 rounded-xl border border-slate-200/90 bg-white/[0.92] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_34px_rgba(15,23,42,0.07)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-rose-200 hover:bg-white hover:shadow-[0_18px_42px_rgba(190,24,93,0.12)] dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-rose-400/30 dark:hover:bg-white/[0.075]">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12 border-2 border-rose-300">
                        <AvatarImage src={student.foto_url} className="object-cover" />
                        <AvatarFallback>{student.nama_lengkap?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-white">
                        <PartyPopper className="h-3 w-3" />
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900 dark:text-white">{student.nama_lengkap}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="secondary">{student.age} tahun</Badge>
                        <Badge variant={student.isBirthdayToday ? 'default' : 'outline'}>{student.isBirthdayToday ? 'Hari ini' : `Tanggal ${student.birthdayDay}`}</Badge>
                        {(student.class?.nama_kelas || (audience === 'guru' && student.jabatan)) && <Badge variant="outline">{student.class?.nama_kelas || student.jabatan}</Badge>}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openWhatsappGreeting(student)}
                    disabled={!hasWhatsapp}
                    className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
                    title={hasWhatsapp ? `Kirim ucapan untuk ${student.nama_lengkap}` : student.isBirthdayToday ? 'Nomor WhatsApp belum tersedia' : 'Ucapan WhatsApp aktif pada hari ulang tahun'}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" /> Ucapkan
                  </Button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="relative flex flex-col items-center justify-center px-6 py-14 text-center text-muted-foreground">
            <Cake className="mb-3 h-9 w-9 opacity-30" />
            <p className="font-semibold text-foreground">Belum ada ulang tahun bulan ini</p>
            <p className="mt-1 text-sm">Daftar akan muncul saat ada tanggal lahir pada bulan berjalan.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BirthdayNotificationModal;
