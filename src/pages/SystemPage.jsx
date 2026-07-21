import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Clock,
  Users,
  BookOpen,
  Edit,
  AlertTriangle,
  HeartHandshake as Handshake,
  ArrowRight,
  CheckCircle2,
  Sunrise,
  Sun,
  Sunset,
  GraduationCap,
  Star,
  ClipboardCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import '@/styles/public-learning-system.css';

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

const systemPoints = [
  {
    icon: Clock,
    title: "Jadwal & Sesi Mengaji",
    short: "Tiga sesi fleksibel, Senin–Jumat.",
    details: ["Sesi TPQ tersedia pada pagi, siang, dan sore agar keluarga dapat memilih waktu belajar yang sesuai.", "Hari Jumat digunakan untuk penguatan hafalan, muraja'ah, dan praktik ibadah sesuai agenda kelas."]
  },
  {
    icon: Users,
    title: "Struktur Kelas Efektif",
    short: "Kelas kecil, perhatian lebih personal.",
    details: ["Setiap kelas dibatasi maksimal 15 santri.", "Santri dikelompokkan berdasarkan jilid atau tingkat kemampuan agar materi tetap tepat sasaran."]
  },
  {
    icon: BookOpen,
    title: "Alur Pembelajaran Harian",
    short: "Drilling, klasikal, dan setoran individual.",
    details: ["Pembelajaran bergerak dari penguatan hafalan, penjelasan klasikal, setoran bacaan individual, hingga evaluasi dan tindak lanjut."]
  },
  {
    icon: Edit,
    title: "Buku Prestasi & Penilaian",
    short: "Perkembangan dicatat dan dipantau bersama.",
    details: ["Guru mencatat hasil bacaan pada buku prestasi agar wali dapat mengikuti perkembangan dan perbaikan yang diperlukan."]
  },
  {
    icon: AlertTriangle,
    title: "Prinsip Kedisiplinan Qiroati",
    short: "Ketuntasan bacaan menjadi prioritas.",
    details: ["Santri melanjutkan materi setelah bacaan sebelumnya dinilai cukup kuat, sehingga fondasi tidak dikorbankan demi kecepatan."]
  },
  {
    icon: Handshake,
    title: "Sinergi dengan Wali Santri",
    short: "Kerja sama aktif antara lembaga dan keluarga.",
    details: ["Wali memberi paraf pada buku prestasi dan mendukung pembiasaan adab serta latihan santri di rumah."]
  }
];

/* ---------- Daily Learning Flow Data ---------- */
const dailyFlow = [
  {
    time: 'Tahap 1',
    label: 'Drilling',
    variant: 'start',
    icon: Sparkles,
    text: "Penguatan hafalan secara klasikal: surat pendek, doa harian, atau muraja'ah sesuai agenda hari.",
  },
  {
    time: 'Tahap 2',
    label: 'Pembelajaran Klasikal',
    variant: 'mid',
    icon: BookOpen,
    text: 'Guru menggunakan peraga atau kartu untuk menjelaskan materi jilid secara bersama-sama.',
  },
  {
    time: 'Tahap 3',
    label: 'Setoran Individual',
    variant: 'late',
    icon: Users,
    text: 'Santri menyetorkan bacaan kepada guru dan hasilnya dicatat dalam buku prestasi.',
  },
  {
    time: 'Tahap 4',
    label: 'Evaluasi & Penutup',
    variant: 'end',
    icon: ClipboardCheck,
    text: 'Guru memberi evaluasi, penguatan, atau pendampingan personal sesuai kebutuhan santri.',
  },
];

/* ---------- Schedule Sessions ---------- */
const scheduleSessions = [
  {
    name: 'Sesi Pagi',
    time: '08.00–09.15 WIB',
    detail: 'Sesi TPQ pagi, Senin–Jumat.',
    variant: 'pagi',
    icon: Sunrise,
    emoji: '🌅',
  },
  {
    name: 'Sesi Siang',
    time: '14.00–15.15 WIB',
    detail: 'Sesi TPQ siang, Senin–Jumat.',
    variant: 'siang',
    icon: Sun,
    emoji: '☀️',
  },
  {
    name: 'Sesi Sore',
    time: '16.00–17.15 WIB',
    detail: 'Sesi TPQ sore, Senin–Jumat.',
    variant: 'sore',
    icon: Sunset,
    emoji: '🌇',
  },
];

/* ---------- Assessment Cards ---------- */
const assessmentItems = [
  {
    icon: Star,
    title: 'Buku Prestasi',
    text: 'Setiap santri memiliki catatan perkembangan bacaan dan perbaikan yang perlu dilanjutkan.',
    color: 'emerald',
  },
  {
    icon: Edit,
    title: 'Paraf Wali Santri',
    text: 'Wali diharapkan memeriksa dan memberi paraf setiap hari sebagai bentuk pendampingan bersama.',
    color: 'violet',
  },
  {
    icon: ShieldCheck,
    title: 'Standar Kelulusan',
    text: 'Kelulusan halaman menekankan bacaan yang benar dan tuntas sebelum menerima materi baru.',
    color: 'rose',
  },
  {
    icon: GraduationCap,
    title: 'Kenaikan Jilid',
    text: 'Kenaikan jilid mengikuti hasil evaluasi guru dan kesiapan bacaan santri.',
    color: 'amber',
  },
];

/* ---------- Discipline Principles ---------- */
const principles = [
  'Kualitas bacaan ditempatkan di atas kecepatan menyelesaikan materi.',
  'Santri memperbaiki kesalahan mendasar sebelum melanjutkan ke halaman berikutnya.',
  'Rutinitas kelas membentuk disiplin, adab, dan tanggung jawab belajar.',
];

/* ---------- Synergy Points ---------- */
const synergyPoints = [
  'Wali memantau buku prestasi dan mendampingi latihan santri di rumah.',
  'Pertemuan dan komunikasi wali digunakan untuk menyelaraskan pendampingan belajar.',
  'Orang tua dari calon santri usia lima tahun ke bawah mengikuti kelas dewasa; biaya pendaftarannya dibebaskan.',
];

/* ======================================== */
/*            MAIN COMPONENT                */
/* ======================================== */

const SystemPage = () => {
  return (
    <>
      <Helmet>
        <title>Sistem Mengaji - LPQ Al-Fath Maulana</title>
        <meta name="description" content="Pelajari alur dan sistem pembelajaran mengaji dengan metode Qiroati di LPQ Al-Fath Maulana." />
      </Helmet>

      <div className="ls-page">
        {/* ---- HERO ---- */}
        <section className="ls-hero" aria-labelledby="ls-hero-title">
          <motion.div
            className="ls-hero__inner"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <span className="ls-hero__badge">
              <BookOpen className="w-3.5 h-3.5" />
              Metode Qiroati
            </span>
            <h1 id="ls-hero-title" className="ls-hero__title">
              Sistem <span className="ls-hero__title-accent">Pembelajaran</span> Mengaji
            </h1>
            <p className="ls-hero__desc">
              Memahami alur pembelajaran yang terstruktur, efektif, dan berorientasi pada kualitas untuk membentuk generasi Qur'ani.
            </p>
          </motion.div>
        </section>

        <div className="ls-container">

          {/* ---- OVERVIEW SECTION ---- */}
          <section className="ls-section" aria-labelledby="ls-overview-title">
            <motion.div
              className="ls-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="ls-section__kicker">
                <Sparkles className="w-3.5 h-3.5" />
                Sekilas
              </p>
              <h2 id="ls-overview-title" className="ls-section__title">Sistem yang Terstruktur</h2>
              <p className="ls-section__desc">
                Tiga pilar utama membentuk fondasi pembelajaran di LPQ Al-Fath Maulana: jadwal fleksibel, kelas efektif, dan alur harian yang terarah.
              </p>
            </motion.div>

            <motion.div
              className="ls-overview-grid"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
            >
              {[
                { icon: Clock, title: 'Jadwal Fleksibel', text: 'Tiga sesi belajar setiap hari (Senin-Jumat) untuk mengakomodasi berbagai jadwal keluarga.', color: 'emerald' },
                { icon: Users, title: 'Kelas Kecil & Fokus', text: 'Maksimal 15 santri per kelas untuk perhatian personal dan progres optimal.', color: 'amber' },
                { icon: BookOpen, title: 'Alur Harian Terarah', text: 'Drilling, klasikal, setoran individual, dan evaluasi — terstruktur dalam setiap sesi.', color: 'sky' },
              ].map((card) => (
                <motion.div key={card.title} className="ls-overview-card" variants={staggerItem}>
                  <div className={`ls-overview-card__icon ls-overview-card__icon--${card.color}`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                  <h3 className="ls-overview-card__title">{card.title}</h3>
                  <p className="ls-overview-card__text">{card.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* ---- SCHEDULE SECTION ---- */}
          <section className="ls-section" aria-labelledby="ls-schedule-title">
            <motion.div
              className="ls-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="ls-section__kicker">
                <Clock className="w-3.5 h-3.5" />
                Sesi Belajar
              </p>
              <h2 id="ls-schedule-title" className="ls-section__title">Tiga Sesi Fleksibel</h2>
              <p className="ls-section__desc">
                Setiap sesi berlangsung selama 1 jam 15 menit, dirancang untuk pembelajaran yang efektif dan fokus.
              </p>
            </motion.div>

            <motion.div
              className="ls-schedule-grid"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
            >
              {scheduleSessions.map((session) => (
                <motion.div
                  key={session.name}
                  className={`ls-schedule-card ls-schedule-card--${session.variant}`}
                  variants={staggerItem}
                >
                  <div className="ls-schedule-card__icon">
                    <span role="img" aria-hidden="true">{session.emoji}</span>
                  </div>
                  <h3 className="ls-schedule-card__name">{session.name}</h3>
                  <p className="ls-schedule-card__time">{session.time}</p>
                  <p className="ls-schedule-card__detail">{session.detail}</p>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* ---- DAILY FLOW TIMELINE ---- */}
          <section className="ls-section" aria-labelledby="ls-flow-title">
            <motion.div
              className="ls-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="ls-section__kicker">
                <BookOpen className="w-3.5 h-3.5" />
                Alur Harian
              </p>
              <h2 id="ls-flow-title" className="ls-section__title">Alur Pembelajaran Harian</h2>
              <p className="ls-section__desc">
                Setiap sesi mengaji memiliki ritme yang terstruktur: drilling, klasikal, setoran individual, dan evaluasi.
              </p>
            </motion.div>

            <motion.div
              className="ls-timeline"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
              role="list"
              aria-label="Alur pembelajaran harian"
            >
              {dailyFlow.map((step, i) => (
                <motion.div key={step.label} className="ls-timeline__item" variants={staggerItem} role="listitem">
                  <div className={`ls-timeline__marker ls-timeline__marker--${step.variant}`} aria-hidden="true">
                    {i + 1}
                  </div>
                  <div className="ls-timeline__body">
                    <span className="ls-timeline__time">
                      <Clock className="w-3 h-3" />
                      {step.time}
                    </span>
                    <h3 className="ls-timeline__label">{step.label}</h3>
                    <p
                      className="ls-timeline__text"
                      dangerouslySetInnerHTML={{ __html: step.text }}
                    />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* ---- CLASS STRUCTURE ---- */}
          <section className="ls-section" aria-labelledby="ls-structure-title">
            <motion.div
              className="ls-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="ls-section__kicker">
                <Users className="w-3.5 h-3.5" />
                Struktur Kelas
              </p>
              <h2 id="ls-structure-title" className="ls-section__title">Struktur Kelas Efektif</h2>
              <p className="ls-section__desc">
                Setiap kelas dirancang untuk memberikan perhatian maksimal kepada setiap santri.
              </p>
            </motion.div>

            <motion.div
              className="ls-structure"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              <div className="ls-structure__visual">
                <div className="ls-structure__badge">
                  <span className="ls-structure__number">15</span>
                </div>
                <span className="ls-structure__label">Santri per Kelas</span>
              </div>
              <div className="ls-structure__content">
                <h3 className="ls-structure__title">Kelas Kecil, Perhatian Maksimal</h3>
                <p className="ls-structure__text">
                  Untuk menjaga kualitas, setiap kelas dibatasi maksimal hanya 15 santri. Struktur ini memungkinkan guru untuk memberikan perhatian yang lebih personal.
                </p>
                <ul className="ls-structure__list" role="list">
                  <li className="ls-structure__list-item">
                    <CheckCircle2 className="w-4 h-4 ls-structure__list-icon" />
                    <span>Perhatian personal dari guru untuk setiap santri</span>
                  </li>
                  <li className="ls-structure__list-item">
                    <CheckCircle2 className="w-4 h-4 ls-structure__list-icon" />
                    <span>Dikelompokkan berdasarkan jilid atau tingkat kemampuan</span>
                  </li>
                  <li className="ls-structure__list-item">
                    <CheckCircle2 className="w-4 h-4 ls-structure__list-icon" />
                    <span>Materi yang disampaikan sesuai dengan level santri</span>
                  </li>
                </ul>
              </div>
            </motion.div>
          </section>

          {/* ---- ASSESSMENT & EVALUATION ---- */}
          <section className="ls-section" aria-labelledby="ls-assessment-title">
            <motion.div
              className="ls-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="ls-section__kicker">
                <GraduationCap className="w-3.5 h-3.5" />
                Evaluasi & Penilaian
              </p>
              <h2 id="ls-assessment-title" className="ls-section__title">Evaluasi & Kenaikan Jilid</h2>
              <p className="ls-section__desc">
                Pemantauan progres yang transparan dan standar kelulusan yang disiplin untuk memastikan kualitas bacaan.
              </p>
            </motion.div>

            <motion.div
              className="ls-assessment-grid"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
            >
              {assessmentItems.map((item) => (
                <motion.div key={item.title} className="ls-assessment-card" variants={staggerItem}>
                  <div className={`ls-assessment-card__icon ls-assessment-card__icon--${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <h3 className="ls-assessment-card__title">{item.title}</h3>
                  <p className="ls-assessment-card__text">{item.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* ---- DISCIPLINE PRINCIPLES ---- */}
          <section className="ls-section" aria-labelledby="ls-principles-title">
            <motion.div
              className="ls-section__header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="ls-section__kicker">
                <ShieldCheck className="w-3.5 h-3.5" />
                Prinsip
              </p>
              <h2 id="ls-principles-title" className="ls-section__title">Prinsip Kedisiplinan Qiroati</h2>
              <p className="ls-section__desc">
                Kualitas di atas kuantitas — memastikan setiap santri memiliki fondasi bacaan yang kokoh.
              </p>
            </motion.div>

            <motion.div
              className="ls-principles"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
              role="list"
              aria-label="Prinsip kedisiplinan"
            >
              {principles.map((text, i) => (
                <motion.div key={i} className="ls-principle" variants={staggerItem} role="listitem">
                  <div className="ls-principle__marker" aria-hidden="true">{i + 1}</div>
                  <div className="ls-principle__content">
                    <p
                      className="ls-principle__text"
                      dangerouslySetInnerHTML={{ __html: text }}
                    />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* ---- SYNERGY SECTION ---- */}
          <section className="ls-section" aria-labelledby="ls-synergy-title">
            <motion.div
              className="ls-synergy"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              <div className="ls-synergy__inner">
                <div>
                  <div className="ls-synergy__icon">
                    <Handshake className="w-7 h-7" />
                  </div>
                  <h2 id="ls-synergy-title" className="ls-synergy__title">Sinergi dengan Wali Santri</h2>
                  <ul className="ls-synergy__list" role="list">
                    {synergyPoints.map((point, i) => (
                      <li key={i} className="ls-synergy__list-item">
                        <CheckCircle2 className="w-4 h-4 ls-synergy__check" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="ls-synergy__visual" aria-hidden="true">
                  <span className="ls-synergy__handshake">🤝</span>
                  <span className="ls-synergy__visual-label">Kerja Sama</span>
                </div>
              </div>
            </motion.div>
          </section>

          {/* ---- CTA ---- */}
          <section className="ls-cta" aria-labelledby="ls-cta-title">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              <h2 id="ls-cta-title" className="ls-cta__title">Tertarik Bergabung?</h2>
              <p className="ls-cta__desc">
                Pelajari lebih lanjut tentang sistem pendaftaran dan mulai perjalanan belajar Al-Qur'an anak Anda bersama LPQ Al-Fath Maulana.
              </p>
              <div className="ls-cta__actions">
                <Link to="/pendaftaran/informasi" className="ls-cta__btn ls-cta__btn--primary">
                  Informasi Pendaftaran
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/kontak" className="ls-cta__btn ls-cta__btn--secondary">
                  Hubungi Kami
                </Link>
              </div>
            </motion.div>
          </section>

        </div>
      </div>
    </>
  );
};

export default SystemPage;
