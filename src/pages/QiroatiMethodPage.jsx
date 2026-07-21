import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  BookOpen,
  ArrowRight,
  PlayCircle,
} from 'lucide-react';
import SplitText from '@/components/reactbits/SplitText/SplitText';
import GradientText from '@/components/reactbits/GradientText/GradientText';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import '@/styles/public-qiroati.css';

/* ---------- Animation Variants ---------- */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/* ---------- Principles Data ---------- */
const principles = [
  {
    title: 'Ketepatan Makhraj',
    text: 'Setiap huruf dibaca dari titik keluarnya yang benar. Guru memastikan santri memahami dan menerapkan makhraj sejak awal, bukan sekadar meniru suara.',
    accent: 'indigo',
  },
  {
    title: 'Ketepatan Sifat',
    text: 'Selain makhraj, setiap huruf memiliki sifat tertentu — ada yang lembut, ada yang berat. Kombinasi makhraj dan sifat inilah yang menghasilkan bacaan yang benar.',
    accent: 'amber',
  },
  {
    title: 'Tartil, Tidak Tergesa',
    text: 'Metode Qiroati menekankan kelancaran tanpa terburu-buru. Santri diajak membaca dengan tempo yang terjaga, memperhatikan setiap bacaan panjang dan pendek.',
    accent: 'emerald',
  },
  {
    title: 'Tajwid Sejak Dasar',
    text: 'Hukum tajwid bukan materi lanjutan yang ditambahkan nanti. Sejak jilid awal, santri sudah dibimbing menerapkan kaidah tajwid secara bertahap.',
    accent: 'sky',
  },
  {
    title: 'Ketuntasan',
    text: 'Santri tidak akan dibolehkan melangkah ke materi berikutnya selama bacaan pada materi sebelumnya belum benar. Ini menjaga fondasi yang kokoh.',
    accent: 'rose',
  },
  {
    title: 'Mandiri Setelah Contoh',
    text: 'Guru memberikan contoh dan pengarahan yang cukup, lalu santri membaca secara mandiri. Pendekatan ini melatih kemampuan membaca Al-Qur\'an secara otonom.',
    accent: 'indigo',
  },
];

/* ---------- Learning Journey Data ---------- */
const journeySteps = [
  {
    label: 'Tahap 1',
    title: 'Pengenalan Huruf dan Harakat',
    text: 'Santri mulai dengan mengenal bentuk dan bunyi setiap huruf hijaiyah, lengkap dengan tanda baca dasar: fathah, kasrah, dan dhommah.',
  },
  {
    label: 'Tahap 2',
    title: 'Bacaan Panjang dan Pendek',
    text: 'Materi dilanjutkan dengan bacaan long vowel (alif, wawu, ya), bacaan lurus, dan bacaan ghunnah. Setiap konsep dibahas secara terpisah dan tuntas.',
  },
  {
    label: 'Tahap 3',
    title: 'Hukum Tajwid Tingkat Lanjut',
    text: 'Memasuki bacaan iklab, qalqalah, idgham, ikhfa\', dan hukum-hukum tajwid lainnya. Bacaan gharib dan musykilat juga mulai diperkenalkan.',
  },
  {
    label: 'Tahap 4',
    title: 'Bacaan dalam Konteks Ayat',
    text: 'Santri mulai membaca langsung dari Al-Qur\'an, menerapkan seluruh hukum tajwid yang telah dipelajari dalam bacaan yang utuh dan bermakna.',
  },
  {
    label: 'Tahap 5',
    title: 'Tajwid dan Kelancaran',
    text: 'Tingkat lanjut untuk memperdalam penguasaan tajwid secara menyeluruh. Santri membaca dengan tartil, memperhatikan makna, dan menjaga kualitas bacaan.',
  },
];

/* ======================================== */
/*            MAIN COMPONENT                */
/* ======================================== */

const QiroatiMethodPage = () => {
  const [videos, setVideos] = useState([]);
  const [playingVideo, setPlayingVideo] = useState(null);

  useEffect(() => {
    const fetchVideos = async () => {
      const { data, error } = await supabase
        .from('website_content')
        .select('content')
        .eq('key', 'qiroatiVideos')
        .maybeSingle();

      const defaultVideos = [];

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching videos:', error);
        setVideos(defaultVideos);
      } else {
        setVideos(data?.content || defaultVideos);
      }
    };

    fetchVideos();
  }, []);

  const getYoutubeVideoId = (url) => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname === 'youtu.be') return urlObj.pathname.slice(1);
      if (urlObj.hostname.includes('youtube.com')) {
        if (urlObj.pathname.includes('/embed/')) return urlObj.pathname.split('/embed/')[1].split('?')[0];
        return urlObj.searchParams.get('v');
      }
    } catch {
      const embedMatch = url.match(/embed\/([^?&/\s]+)/);
      if (embedMatch) return embedMatch[1];
    }
    return null;
  };

  const getYoutubeThumbnail = (url) => {
    const videoId = getYoutubeVideoId(url);
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
  };

  const getEmbedUrl = (url) => {
    const videoId = getYoutubeVideoId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  return (
    <>
      <Helmet>
        <title>Metode Qiroati - LPQ Al-Fath Maulana</title>
        <meta
          name="description"
          content="Pelajari Metode Qiroati, metode praktis belajar membaca Al-Qur'an yang menekankan ketepatan makhraj, sifat huruf, dan tartil sejak tahap dasar."
        />
        <link rel="canonical" href="https://domain-belum-diisi.invalid/metode-qiroati" />
      </Helmet>

      <div className="qm-page">
        {/* ---- HERO ---- */}
        <section className="qm-hero" aria-labelledby="qm-hero-title">
          <motion.div
            className="qm-hero__inner"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <span className="qm-hero__badge">
              <BookOpen className="w-3.5 h-3.5" />
              Metode Qiroati
            </span>
            <h1 id="qm-hero-title" className="qm-hero__title">
              <SplitText
                text="Disiplin di Balik"
                splitType="words"
                delay={80}
                duration={0.8}
                className="qm-hero__title-line"
              />
              <span className="qm-hero__title-line qm-hero__title-accent-wrap">
                <GradientText
                  colors={['#6366f1', '#818cf8', '#a78bfa', '#6366f1']}
                  animationSpeed={6}
                  showBorder={false}
                  direction="horizontal"
                >
                  Bacaan Tartil
                </GradientText>
              </span>
            </h1>
            <p className="qm-hero__desc">
              Metode praktis belajar membaca Al-Qur'an yang menekankan ketepatan sejak awal — karena bacaan yang benar tidak dibentuk secara kebetulan.
            </p>
          </motion.div>
        </section>

        <div className="qm-container">

          {/* ---- ORIGIN SECTION ---- */}
          <section className="qm-section" aria-labelledby="qm-origin-title">
            <motion.div
              className="qm-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="qm-section__kicker">
                <BookOpen className="w-3.5 h-3.5" />
                Asal Usul
              </p>
              <h2 id="qm-origin-title" className="qm-section__title">
                Apa Itu{' '}
                <GradientText
                  colors={['#3730a3', '#6366f1', '#a78bfa', '#3730a3']}
                  animationSpeed={8}
                  showBorder={false}
                >
                  Metode Qiroati
                </GradientText>
                ?
              </h2>
              <p className="qm-section__desc">
                Metode Qiroati adalah sistem pembelajaran membaca Al-Qur'an yang dirancang agar setiap orang bisa belajar dengan benar, tidak sekadar cepat selesai.
              </p>
            </motion.div>

            <motion.div
              className="qm-origin"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
            >
              <motion.div className="qm-origin__card" variants={staggerItem}>
                <span className="qm-origin__card-number" aria-hidden="true">01</span>
                <h3 className="qm-origin__card-title">Metode Praktis Belajar Membaca Al-Qur'an</h3>
                <p className="qm-origin__card-text">
                  Qiroati hadir dari kebutuhan nyata: banyak orang kesulitan belajar membaca Al-Qur'an karena metode yang tersedia kurang terstruktur atau terlalu bergantung pada kemampuan guru semata.
                </p>
                <p className="qm-origin__card-text">
                  Metode ini menyajikan materi secara bertahap — mulai dari pengenalan huruf, harakat, bacaan panjang-pendek, hingga hukum tajwid yang kompleks — dalam buku-buku jilid yang sistematis.
                </p>
                <div className="qm-origin__founder">
                  <div className="qm-origin__founder-avatar">DS</div>
                  <div>
                    <p className="qm-origin__founder-name">KH. Dachlan Salim Zarkasyi</p>
                    <p className="qm-origin__founder-role">Penyusun Metode Qiroati</p>
                  </div>
                </div>
              </motion.div>

              <motion.div className="qm-origin__card" variants={staggerItem}>
                <span className="qm-origin__card-number" aria-hidden="true">02</span>
                <h3 className="qm-origin__card-title">Visi dan Misi</h3>
                <p className="qm-origin__card-text">
                  <strong>Visi:</strong> Menjaga kemurnian bacaan Al-Qur'an sebagaimana diajarkan oleh Rasulullah SAW kepada para sahabatnya.
                </p>
                <p className="qm-origin__card-text">
                  <strong>Misi:</strong> Menyebarluaskan cara belajar membaca Al-Qur'an yang mudah, cepat, dan benar ke seluruh lapisan masyarakat.
                </p>
                <p className="qm-origin__card-text" style={{ marginTop: '0.75rem', fontStyle: 'italic', color: 'var(--qm-indigo)' }}>
                  "Hanya guru yang bersyahadah yang boleh mengajarkan Qiroati."
                </p>
                <p className="qm-origin__card-text" style={{ fontSize: '0.8125rem' }}>
                  — KH. Dachlan Salim Zarkasyi, dari situs resmi qiroati.org
                </p>
              </motion.div>
            </motion.div>
          </section>

          {/* ---- QUOTE ---- */}
          <section className="qm-section" style={{ paddingTop: 0 }} aria-label="Kutipan KH. Dachlan Salim Zarkasyi">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              <div className="qm-quote-block">
                <div className="qm-quote-block__content">
                  <div className="qm-quote-block__mark" aria-hidden="true">"</div>
                  <p className="qm-quote-block__text">
                    Saya tidak pingin yang pakai Qiroati banyak. Saya pingin anak yang ngaji pakai Qiroati, ngajinya benar.
                  </p>
                  <p className="qm-quote-block__attribution">
                    — <strong>KH. Dachlan Salim Zarkasyi</strong>, dari qiroati.com
                  </p>
                </div>
              </div>
            </motion.div>
          </section>

          {/* ---- PRINCIPLES ---- */}
          <section className="qm-section" aria-labelledby="qm-principles-title">
            <motion.div
              className="qm-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
            <p className="qm-section__kicker">
                Prinsip
              </p>
              <h2 id="qm-principles-title" className="qm-section__title">
                Prinsip Pembelajaran{' '}
                <GradientText
                  colors={['#3730a3', '#6366f1', '#a78bfa', '#3730a3']}
                  animationSpeed={8}
                  showBorder={false}
                >
                  Qiroati
                </GradientText>
              </h2>
              <p className="qm-section__desc">
                Fondasi yang membuat Qiroati berbeda dari sekadar "belajar baca" — setiap prinsip dirancang agar bacaan benar sejak awal.
              </p>
            </motion.div>

            <motion.div
              className="qm-principles-grid"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
            >
              {principles.map((item, idx) => (
                <motion.div key={item.title} className="qm-principle-card" variants={staggerItem}>
                  <div className={`qm-principle-card__accent qm-principle-card__accent--${item.accent}`} aria-hidden="true" />
                  <span className={`qm-principle-card__number qm-principle-card__number--${item.accent}`} aria-hidden="true">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <h3 className="qm-principle-card__title">{item.title}</h3>
                  <p className="qm-principle-card__text">{item.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </section>

          <hr className="qm-divider" />

          {/* ---- LEARNING JOURNEY ---- */}
          <section className="qm-section" aria-labelledby="qm-journey-title">
            <motion.div
              className="qm-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="qm-section__kicker">
                Tahapan Belajar
              </p>
              <h2 id="qm-journey-title" className="qm-section__title">
                Alur Pembelajaran{' '}
                <span className="qm-title-blur">Bertahap</span>
              </h2>
              <p className="qm-section__desc">
                Materi disusun secara bertahap dan sistematis. Setiap jilid harus benar-benar dikuasai sebelum melangkah ke jilid berikutnya.
              </p>
            </motion.div>

            <motion.div
              className="qm-journey"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
              role="list"
              aria-label="Tahapan pembelajaran Qiroati"
            >
              {journeySteps.map((step, i) => (
                <motion.div key={step.label} className="qm-journey__step" variants={staggerItem} role="listitem">
                  <div className={`qm-journey__marker qm-journey__marker--${i + 1}`} aria-hidden="true">
                    {i + 1}
                  </div>
                  <p className="qm-journey__label">{step.label}</p>
                  <h3 className="qm-journey__title">{step.title}</h3>
                  <p className="qm-journey__text">{step.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </section>

          <hr className="qm-divider" />

          {/* ---- APPLICATION AT LPQ ---- */}
          <section className="qm-section" aria-labelledby="qm-application-title">
            <motion.div
              className="qm-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="qm-section__kicker">
                Di LPQ Al-Fath Maulana
              </p>
              <h2 id="qm-application-title" className="qm-section__title">
                Penerapan di{' '}
                <GradientText
                  colors={['#047857', '#10b981', '#6ee7b7', '#047857']}
                  animationSpeed={7}
                  showBorder={false}
                >
                  LPQ Al-Fath Maulana
                </GradientText>
              </h2>
              <p className="qm-section__desc">
                Qiroati bukan sekadar metode di atas kertas — kami menerapkannya secara langsung dalam setiap sesi pembelajaran.
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              <div className="qm-application">
                <div className="qm-application__grid">
                  <div className="qm-application__item">
                    <div className="qm-application__item-num">01</div>
                    <div>
                      <h3 className="qm-application__item-title">Bimbingan Makhraj & Sifat</h3>
                      <p className="qm-application__item-text">
                        Guru membimbing santri secara individual saat setoran bacaan, memastikan makhraj dan sifat huruf benar sebelum melanjutkan.
                      </p>
                    </div>
                  </div>

                  <div className="qm-application__item">
                    <div className="qm-application__item-num">02</div>
                    <div>
                      <h3 className="qm-application__item-title">Standar Kelulusan yang Disiplin</h3>
                      <p className="qm-application__item-text">
                        Santri tidak akan diluluskan ke halaman berikutnya jika masih terdapat kesalahan fatal. Kualitas diutamakan di atas kecepatan.
                      </p>
                    </div>
                  </div>

                  <div className="qm-application__item">
                    <div className="qm-application__item-num">03</div>
                    <div>
                      <h3 className="qm-application__item-title">Pengajar yang Telah Dibina</h3>
                      <p className="qm-application__item-text">
                        Guru di LPQ Al-Fath Maulana mendapatkan pembinaan dan pemahaman tentang metode Qiroati agar dapat menyampaikan materi dengan benar.
                      </p>
                    </div>
                  </div>

                  <div className="qm-application__item">
                    <div className="qm-application__item-num">04</div>
                    <div>
                      <h3 className="qm-application__item-title">Pendampingan Wali Santri</h3>
                      <p className="qm-application__item-text">
                        Buku prestasi memungkinkan wali santri memantau progres bacaan anak setiap hari dan memberikan dukungan di rumah.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          {/* ---- VIDEOS ---- */}
          {videos.length > 0 && (
            <section className="qm-section" aria-labelledby="qm-videos-title">
              <motion.div
                className="qm-section__header"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
              >
              <p className="qm-section__kicker">
                Video
              </p>
                <h2 id="qm-videos-title" className="qm-section__title">
                <span className="qm-title-split">
                  {'Video Pembelajaran'.split(' ').map((word, i) => (
                    <span key={i} className="qm-title-split__word" style={{ animationDelay: `${i * 0.08}s` }}>
                      {word}{' '}
                    </span>
                  ))}
                </span>
              </h2>
                <p className="qm-section__desc">
                  Lihat bagaimana metode Qiroati diterapkan dalam praktik pembelajaran.
                </p>
              </motion.div>

              <motion.div
                className="qm-videos-grid"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={staggerContainer}
              >
                {videos.map((video) => (
                  <motion.div
                    key={video.id}
                    className="qm-video-card"
                    variants={staggerItem}
                    onClick={() => setPlayingVideo(video)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') setPlayingVideo(video); }}
                    aria-label={`Putar video: ${video.title}`}
                  >
                    <div className="qm-video-card__thumb">
                      <img
                        src={getYoutubeThumbnail(video.url)}
                        alt={video.title}
                        loading="lazy"
                      />
                      <div className="qm-video-card__play">
                        <PlayCircle className="w-12 h-12 text-white/80" />
                      </div>
                    </div>
                    <div className="qm-video-card__info">
                      <h3 className="qm-video-card__title">{video.title}</h3>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </section>
          )}

          {/* ---- CTA ---- */}
          <section className="qm-cta" aria-labelledby="qm-cta-title">
            <motion.div
              className="qm-cta__inner"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              <h2 id="qm-cta-title" className="qm-cta__title">Tertarik Belajar dengan Metode Qiroati?</h2>
              <p className="qm-cta__desc">
                Pelajari lebih lanjut tentang sistem pendaftaran dan mulai perjalanan belajar Al-Qur'an yang benar bersama LPQ Al-Fath Maulana.
              </p>
              <div className="qm-cta__actions">
                <Link to="/pendaftaran/informasi" className="qm-cta__btn qm-cta__btn--primary">
                  Informasi Pendaftaran
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/kontak" className="qm-cta__btn qm-cta__btn--secondary">
                  Hubungi Kami
                </Link>
              </div>
            </motion.div>
          </section>

        </div>
      </div>

      {/* ---- Video Dialog ---- */}
      {playingVideo && (
        <Dialog open={!!playingVideo} onOpenChange={() => setPlayingVideo(null)}>
          <DialogContent className="max-w-3xl p-0">
            <div className="aspect-video">
              <iframe
                className="w-full h-full"
                src={getEmbedUrl(playingVideo.url)}
                title={playingVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default QiroatiMethodPage;
