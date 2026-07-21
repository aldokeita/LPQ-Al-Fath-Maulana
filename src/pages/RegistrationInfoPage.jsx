import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  ClipboardList,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  Info,
  Sparkles,
  GraduationCap,
  Users,
  Clock,
  Award,
} from 'lucide-react';
import { fetchWebsiteContentMap, getPublicContentErrorMessage } from '@/lib/publicContentAdapters';
import { DEFAULT_ENROLLMENT_DATA } from '@/lib/enrollmentContent';
import '@/styles/public-enrollment.css';

/* ---------- Animation Variants ---------- */
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } },
};

const panelIn = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.25 } },
};

/* ---------- Sub-components ---------- */
const LoadingSkeleton = () => (
  <div aria-hidden="true" className="reg-skeleton">
    <div className="reg-skeleton__hero" />
    <div className="reg-skeleton__nav">
      <div className="reg-skeleton__card" />
      <div className="reg-skeleton__card" />
    </div>
    <div className="reg-skeleton__body">
      <div className="reg-skeleton__block" />
      <div className="reg-skeleton__block reg-skeleton__block--sm" />
    </div>
  </div>
);

const EmptyState = () => (
  <div className="reg-empty">
    <ClipboardList />
    <h3>Belum ada informasi pendaftaran</h3>
    <p>Informasi pendaftaran akan tampil di sini setelah tersedia.</p>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="reg-empty">
    <ClipboardList />
    <h3>Gagal memuat informasi pendaftaran</h3>
    <p>{message}</p>
    {onRetry && (
      <button className="reg-retry" onClick={onRetry} type="button">
        <RefreshCw className="h-4 w-4" />
        Coba lagi
      </button>
    )}
  </div>
);

/* ---------- Enrollment Intro (Hero replacement) ---------- */
const METHOD_HIGHLIGHTS = [
  { icon: GraduationCap, label: 'Metode Qiroati', desc: 'Baca lancar dalam waktu singkat' },
  { icon: Users, label: 'Ustadz & Ustadzah', desc: 'Pengajar bersertifikat & berpengalaman' },
  { icon: Clock, label: 'Jadwal Fleksibel', desc: 'Pagi, siang, atau malam' },
  { icon: Award, label: 'Kurikulum Terstruktur', desc: 'Tahap demi tahap terukur' },
];

const EnrollmentIntro = ({ categories, activeId, onSelect }) => (
  <section className="reg-intro" aria-labelledby="reg-intro-title">
    {/* Decorative background */}
    <div className="reg-intro__bg" aria-hidden="true">
      <div className="reg-intro__orb reg-intro__orb--1" />
      <div className="reg-intro__orb reg-intro__orb--2" />
      <div className="reg-intro__pattern" />
    </div>

    <div className="reg-container reg-intro__inner">
      {/* Left: text */}
      <motion.div
        className="reg-intro__text"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeUp} className="reg-intro__breadcrumb">
          <Link to="/">Beranda</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Informasi Pendaftaran</span>
        </motion.div>

        <motion.h1 variants={fadeUp} id="reg-intro-title">
          Kenapa Harus <em>Qiroati</em> di LPQ Al-Fath Maulana?
        </motion.h1>

        <motion.p variants={fadeUp} className="reg-intro__lead">
          Metode Qiroati membantu Anda atau buah hati membaca Al-Qur'an dengan lancar dan benar dalam waktu yang lebih singkat — langsung dari tahap dasar hingga mahir.
        </motion.p>
      </motion.div>

      {/* Right: method highlights */}
      <motion.div
        className="reg-intro__highlights"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        {METHOD_HIGHLIGHTS.map((item) => (
          <motion.div key={item.label} variants={fadeUp} className="reg-highlight">
            <div className="reg-highlight__icon-wrap">
              <item.icon className="reg-highlight__icon" />
            </div>
            <div className="reg-highlight__text">
              <span className="reg-highlight__label">{item.label}</span>
              <span className="reg-highlight__desc">{item.desc}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

/* ---------- Category Navigator (Segmented pill) ---------- */
const CategoryNav = ({ categories, activeId, onSelect }) => (
  <nav className="reg-nav" aria-label="Pilih kategori pendaftaran">
    <div className="reg-container">
      <div className="reg-nav__rail" role="tablist" aria-label="Kategori pendaftaran">
        {categories.map((cat) => (
          <button
            key={cat.id}
            role="tab"
            id={`reg-tab-${cat.id}`}
            aria-selected={activeId === cat.id}
            aria-controls={`reg-panel-${cat.id}`}
            className={`reg-nav__btn${activeId === cat.id ? ' reg-nav__btn--active' : ''}`}
            onClick={() => onSelect(cat.id)}
            tabIndex={activeId === cat.id ? 0 : -1}
          >
            {activeId === cat.id && (
              <motion.span
                className="reg-nav__indicator"
                layoutId="reg-nav-indicator"
                transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className="reg-nav__btn-content">
              <span className="reg-nav__btn-icon" aria-hidden="true">{cat.icon}</span>
              <span className="reg-nav__btn-text">{cat.name}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  </nav>
);

/* ---------- Fee Module ---------- */
const FEE_EMOJI = ['🏢', '👕', '📖', '🪪', '📚', '💰', '🏫', '🎒', '📝', '✅', '🎓', '🎁'];

const FeeModule = ({ fees, totalFee }) => (
  <div className="reg-fee">
    <div className="reg-fee__header">
      <div className="reg-fee__icon-wrap">
        <Banknote className="h-5 w-5" />
      </div>
      <div>
        <h3 className="reg-fee__title">Rincian Biaya</h3>
        <p className="reg-fee__subtitle">Komponen biaya pendaftaran</p>
      </div>
    </div>

    <div className="reg-fee__list">
      {fees.map((fee, idx) => (
        <div
          key={fee.id}
          className={`reg-fee__row${fee.disabled ? ' reg-fee__row--muted' : ''}`}
        >
          <span className="reg-fee__emoji" aria-hidden="true">{FEE_EMOJI[idx % FEE_EMOJI.length]}</span>
          <span className="reg-fee__name">{fee.name}</span>
          <span className="reg-fee__dots" aria-hidden="true" />
          <span className="reg-fee__amount">{fee.amount}</span>
        </div>
      ))}
    </div>

    {totalFee && (
      <div className="reg-fee__total">
        <span className="reg-fee__total-label">Total Pendaftaran</span>
        <span className="reg-fee__total-amount">{totalFee}</span>
      </div>
    )}
  </div>
);

/* ---------- Requirements Checklist ---------- */
const RequirementsPanel = ({ requirements }) => (
  <div className="reg-req">
    <div className="reg-req__header">
      <div className="reg-req__icon-wrap">
        <ClipboardCheck className="h-5 w-5" />
      </div>
      <div>
        <h3 className="reg-req__title">Syarat Pendaftaran</h3>
        <p className="reg-req__subtitle">Dokumen yang perlu disiapkan</p>
      </div>
    </div>

    <ol className="reg-req__list" role="list">
      {requirements.map((req) => (
        <li key={req.id} className="reg-req__item">
          <CheckCircle2 className="reg-req__check" aria-hidden="true" />
          <span className="reg-req__text">{req.text}</span>
        </li>
      ))}
    </ol>
  </div>
);

/* ---------- Notes Context Panel ---------- */
const NotesPanel = ({ notes }) => (
  <div className="reg-notes">
    <div className="reg-notes__header">
      <Info className="h-4 w-4" />
      <h3 className="reg-notes__title">Catatan Penting</h3>
    </div>
    <div className="reg-notes__list">
      {notes.map((note) => (
        <div key={note.id} className="reg-notes__item">
          <CheckCircle2 className="reg-notes__check" aria-hidden="true" />
          <span className="reg-notes__text">{note.text}</span>
        </div>
      ))}
    </div>
  </div>
);

/* ---------- Category Content Canvas ---------- */
const CategoryCanvas = ({ category }) => (
  <motion.div
    className="reg-canvas"
    variants={panelIn}
    initial="hidden"
    animate="visible"
    exit="exit"
    key={category.id}
    role="tabpanel"
    id={`reg-panel-${category.id}`}
    aria-labelledby={`reg-tab-${category.id}`}
  >
    {/* Category identity banner */}
    <div className="reg-canvas__banner">
      <span className="reg-canvas__banner-icon" aria-hidden="true">{category.icon}</span>
      <div className="reg-canvas__banner-text">
        <h2>{category.name}</h2>
        {category.description && <p>{category.description}</p>}
      </div>
    </div>

    {/* Content grid */}
    <div className="reg-canvas__grid">
      <div className="reg-canvas__main">
        <FeeModule fees={category.fees} totalFee={category.totalFee} />
      </div>
      <div className="reg-canvas__side">
        <RequirementsPanel requirements={category.requirements || []} />
        {category.notes && category.notes.length > 0 && (
          <NotesPanel notes={category.notes} />
        )}
      </div>
    </div>
  </motion.div>
);

/* ---------- CTA Section ---------- */
const ClosingCTA = () => (
  <section className="reg-cta" aria-labelledby="reg-cta-title">
    <div className="reg-cta__bg" aria-hidden="true">
      <div className="reg-cta__orb" />
    </div>
    <div className="reg-container reg-cta__inner">
      <motion.div
        className="reg-cta__content"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <BookOpen className="reg-cta__icon" aria-hidden="true" />
        <h2 id="reg-cta-title">Siap Untuk Bergabung?</h2>
        <p>
          Hubungi kami untuk informasi lebih lanjut atau langsung lakukan pendaftaran di lokasi LPQ Al-Fath Maulana.
        </p>
        <div className="reg-cta__actions">
          <span className="reg-cta__btn reg-cta__btn--primary" aria-disabled="true">
            WhatsApp resmi belum diisi
            <ArrowRight className="h-4 w-4" />
          </span>
          <Link to="/" className="reg-cta__btn reg-cta__btn--secondary">
            Kembali ke Beranda
          </Link>
        </div>
      </motion.div>
    </div>
  </section>
);

/* ---------- Main Page ---------- */
const RegistrationInfoPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('tpq');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const contentMap = await fetchWebsiteContentMap({
        keys: ['enrollmentInfo'],
        publicOnly: true,
      });
      const raw = contentMap.enrollmentInfo;
      if (raw && typeof raw === 'object' && Array.isArray(raw.categories) && raw.categories.length > 0) {
        const sorted = {
          ...raw,
          categories: [...raw.categories].sort((a, b) => (a.order || 0) - (b.order || 0)),
        };
        setData(sorted);
      } else {
        setData(DEFAULT_ENROLLMENT_DATA);
      }
    } catch (err) {
      setData(DEFAULT_ENROLLMENT_DATA);
      console.warn('Enrollment data fetch failed, using defaults:', getPublicContentErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categories = data?.categories || [];
  const currentCategory = categories.find((c) => c.id === activeCategory) || categories[0];

  return (
    <div className="reg-page">
      <Helmet>
        <title>Informasi Pendaftaran — LPQ Al-Fath Maulana</title>
        <meta
          name="description"
          content="Informasi lengkap pendaftaran santri baru LPQ Al-Fath Maulana — biaya, syarat, dan prosedur untuk program TPQ anak maupun dewasa."
        />
        <link rel="canonical" href="https://deployment-belum-diisi.invalid/pendaftaran/informasi" />
        <meta property="og:title" content="Informasi Pendaftaran — LPQ Al-Fath Maulana" />
        <meta property="og:description" content="Informasi lengkap pendaftaran santri baru LPQ Al-Fath Maulana — biaya, syarat, dan prosedur untuk program TPQ anak maupun dewasa." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://deployment-belum-diisi.invalid/pendaftaran/informasi" />
      </Helmet>

      {loading ? (
        <>
          <LoadingSkeleton />
          <div className="reg-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
            <div className="reg-loading" aria-live="polite">
              <Loader2 className="h-5 w-5" />
              <p>Memuat informasi pendaftaran…</p>
            </div>
          </div>
        </>
      ) : error ? (
        <div className="reg-container" style={{ paddingTop: '8rem', paddingBottom: '4rem' }}>
          <ErrorState message={error} onRetry={fetchData} />
        </div>
      ) : categories.length === 0 ? (
        <div className="reg-container" style={{ paddingTop: '8rem', paddingBottom: '4rem' }}>
          <EmptyState />
        </div>
      ) : (
        <>
          {/* Enrollment Intro Section */}
          <EnrollmentIntro
            categories={categories}
            activeId={activeCategory}
            onSelect={setActiveCategory}
          />

          {/* Sticky Category Navigator */}
          <CategoryNav
            categories={categories}
            activeId={activeCategory}
            onSelect={setActiveCategory}
          />

          {/* Content Canvas */}
          <div className="reg-container" style={{ paddingTop: 'clamp(1.5rem, 3vw, 2.5rem)', paddingBottom: 'clamp(2rem, 4vw, 3.5rem)' }}>
            <AnimatePresence mode="wait">
              {currentCategory && <CategoryCanvas category={currentCategory} />}
            </AnimatePresence>
          </div>

          {/* Closing CTA */}
          <ClosingCTA />
        </>
      )}
    </div>
  );
};

export default RegistrationInfoPage;
