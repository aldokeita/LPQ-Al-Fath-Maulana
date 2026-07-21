import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const AvatarPreviewDialog = ({ open, onOpenChange, imageUrl, name, description }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg overflow-hidden p-0">
      <div className="flex min-h-[320px] items-center justify-center bg-slate-100 p-4 dark:bg-slate-950 sm:min-h-[460px]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Foto profil ${name || 'pengguna'}`}
            className="max-h-[72vh] w-full rounded-lg object-contain shadow-2xl"
          />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-slate-200 text-5xl font-black text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            {name?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}
      </div>
      <DialogHeader className="px-6 pb-6">
        <DialogTitle>{name || 'Foto Profil'}</DialogTitle>
        <DialogDescription>{description || (imageUrl ? 'Preview foto profil.' : 'Foto profil belum tersedia.')}</DialogDescription>
      </DialogHeader>
    </DialogContent>
  </Dialog>
);

export default AvatarPreviewDialog;
