import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NotFoundPage = () => (
  <section className="relative isolate flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-20">
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.16),transparent_46%)]" />
    <div className="w-full max-w-xl rounded-[2rem] border border-border/60 bg-background/75 p-8 text-center shadow-2xl shadow-primary/10 backdrop-blur-xl sm:p-12">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">404</p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">Halaman tidak ditemukan</h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">
        Alamat yang Anda buka tidak tersedia atau sudah dipindahkan. Kembali ke beranda untuk melanjutkan.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild>
          <Link to="/"><Home className="mr-2 h-4 w-4" />Kembali ke Beranda</Link>
        </Button>
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />Halaman Sebelumnya
        </Button>
      </div>
    </div>
  </section>
);

export default NotFoundPage;
