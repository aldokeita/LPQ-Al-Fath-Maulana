import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import { resolveAvatarUrl } from '@/lib/storageAdapters';
import { getCardFontEmbedCSS } from '@/lib/cardFonts';
import { CARD_H, CARD_W } from '@/components/dashboard/assistant/SantriCards';

// Bagian bersama untuk membuat, mempratinjau, dan mengekspor kartu santri (Kartu Santri dan modal ulang tahun).

const AMIRI_HREF = 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap';

// Font Arab hanya dimuat saat studio kartu dibuka.
export const useArabicFont = () => {
  useEffect(() => {
    if (document.querySelector(`link[href="${AMIRI_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = AMIRI_HREF;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }, []);
};

// Pratinjau kartu ukuran tetap yang diperkecil mengikuti lebar layar.
export const ScaledPreview = ({ children }) => {
  const boxRef = useRef(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const update = () => setScale(Math.min(1, el.clientWidth / CARD_W));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={boxRef} className="w-full max-w-[540px]">
      <div style={{ width: CARD_W * scale, height: CARD_H * scale }} className="overflow-hidden rounded-[28px] shadow-xl shadow-slate-900/15">
        <div style={{ width: CARD_W, height: CARD_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
      </div>
    </div>
  );
};

// Foto santri dibaca sebagai data URL agar ikut tergambar saat kartu diekspor ke PNG.
export const loadAvatar = async (santriId) => {
  const url = await resolveAvatarUrl({ ownerType: 'santri', ownerId: santriId });
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
};

// Safari dan semua browser di iPad/iPhone (WebKit) sering menggambar SVG foreignObject sebelum gambar di
// dalamnya siap, sehingga render pertama kehilangan logo, foto, dan latar. Render diulang dan hasil terakhir dipakai.
const isWebKit = () => typeof navigator !== 'undefined'
  && /AppleWebKit/i.test(navigator.userAgent) && !/Chrome\/|Chromium|Edg\/|Android/i.test(navigator.userAgent);

const decodeImages = (node) => Promise.all([...node.querySelectorAll('img')].map((img) => (
  img.complete && img.naturalWidth ? img.decode?.().catch(() => {}) : new Promise((resolve) => {
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
  })
)));

// Salin teks ke papan klip; cadangan lewat textarea tersembunyi untuk browser lama.
export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(area);
    area.select();
    let done = false;
    try { done = document.execCommand('copy'); } catch { done = false; }
    area.remove();
    return done;
  }
};


export const renderCardBlob = async (node) => {
  await document.fonts?.ready;
  await decodeImages(node);
  const fontEmbedCSS = await getCardFontEmbedCSS();
  const options = {
    pixelRatio: 2, width: CARD_W, height: CARD_H, backgroundColor: 'transparent',
    ...(fontEmbedCSS ? { fontEmbedCSS } : {}),
  };
  if (isWebKit()) {
    // Dua render pemanasan agar gambar tertanam ikut tergambar pada render ketiga.
    await toBlob(node, options);
    await toBlob(node, options);
  }
  return toBlob(node, options);
};


// Bagikan gambar lewat menu bagikan perangkat; bila tidak didukung, unduh berkas PNG. Mengembalikan 'shared' atau 'downloaded'.
export const shareOrDownloadCard = async ({ blob, fileName, title, text, mode = 'share' }) => {
  const file = new File([blob], fileName, { type: 'image/png' });
  if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: text || undefined, title });
      return 'shared';
    } catch (err) {
      if (err?.name !== 'NotAllowedError') throw err;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
};
