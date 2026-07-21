import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  Check,
  X,
  BookOpen,
  Gamepad2,
  ChevronRight,
  Library,
  Puzzle,
  Search,
  Volume2,
  ArrowRight,
  Sparkles,
  GraduationCap,
  Star,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import '@/styles/public-edumedia.css';

/* ---------- Animation Variants ---------- */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

/* ---------- Tajwid Data ---------- */
const tajwidTerms = [
  { id: 1, term: 'Ikhfa', definition: 'Menyamarkan atau membunyikan antara Izhar dan Idgham, siap untuk didengungkan.', color: 'teal' },
  { id: 2, term: 'Idgham', definition: 'Menggabungkan atau memasukkan huruf pertama ke huruf kedua.', color: 'violet' },
  { id: 3, term: 'Iqlab', definition: 'Mengganti bunyi huruf Nun Sukun atau Tanwin menjadi Mim.', color: 'amber' },
  { id: 4, term: 'Izhar', definition: 'Membaca huruf Nun Sukun atau Tanwin dengan jelas tanpa dengung.', color: 'green' },
  { id: 5, term: 'Qalqalah', definition: 'Memantulkan bunyi huruf pada huruf-huruf tertentu saat sukun.', color: 'coral' },
];

/* ---------- Hijaiyah Letters ---------- */
const letters = [
  { char: 'ا', name: 'Alif' }, { char: 'ب', name: 'Ba' }, { char: 'ت', name: 'Ta' }, { char: 'ث', name: 'Tsa' },
  { char: 'ج', name: 'Jim' }, { char: 'ح', name: 'Ha' }, { char: 'خ', name: 'Kho' }, { char: 'د', name: 'Dal' },
  { char: 'ذ', name: 'Dzal' }, { char: 'ر', name: 'Ro' }, { char: 'ز', name: 'Zay' }, { char: 'س', name: 'Sin' },
  { char: 'ش', name: 'Syin' }, { char: 'ص', name: 'Shod' }, { char: 'ض', name: 'Dhod' }, { char: 'ط', name: 'Tho' },
  { char: 'ظ', name: 'Zho' }, { char: 'ع', name: 'Ain' }, { char: 'غ', name: 'Ghoin' }, { char: 'ف', name: 'Fa' },
  { char: 'ق', name: 'Qof' }, { char: 'ك', name: 'Kaf' }, { char: 'ل', name: 'Lam' }, { char: 'م', name: 'Mim' },
  { char: 'ن', name: 'Nun' }, { char: 'ه', name: 'Ha' }, { char: 'و', name: 'Waw' }, { char: 'ي', name: 'Ya' },
];

/* ---------- Learning Modules Definition ---------- */
const learningModules = [
  { id: 'game', label: 'Tebak Huruf', icon: Gamepad2, desc: 'Uji kemampuanmu' },
  { id: 'explore', label: 'Jelajahi Huruf', icon: Search, desc: 'Kenali setiap huruf' },
  { id: 'tajwid', label: 'Kamus Tajwid', icon: BookOpen, desc: 'Istilah tajwid' },
];

/* ================================================================
   Hijaiyah Explorer — Interactive alphabet browser
   ================================================================ */
const HijaiyahExplorer = () => {
  const [activeLetter, setActiveLetter] = useState(null);
  const [filter, setFilter] = useState('');

  const filteredLetters = letters.filter(
    (l) => l.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <section className="edu-section" aria-labelledby="edu-explorer-heading">
      <div className="edu-section__header">
        <p className="edu-section__kicker">
          <Search className="w-3.5 h-3.5" />
          Jelajahi
        </p>
        <h2 id="edu-explorer-heading" className="edu-section__title">Huruf Hijaiyah</h2>
        <p className="edu-section__desc">
          Pilih huruf untuk melihat nama dan bentuknya. Cocok untuk pemula yang baru belajar membaca Al-Qur'an.
        </p>
      </div>

      {/* Search filter */}
      <div className="edu-explorer__search-wrap">
        <Search className="edu-explorer__search-icon" aria-hidden="true" />
        <input
          type="text"
          className="edu-explorer__search"
          placeholder="Cari huruf..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Cari huruf hijaiyah"
        />
      </div>

      {/* Letter grid */}
      <motion.div
        className="edu-explorer__grid"
        role="listbox"
        aria-label="Daftar huruf hijaiyah"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-30px' }}
      >
        {filteredLetters.length === 0 ? (
          <p className="edu-explorer__empty">Huruf tidak ditemukan.</p>
        ) : (
          filteredLetters.map((letter) => {
            const isActive = activeLetter?.name === letter.name;
            return (
              <motion.button
                key={letter.name}
                className={`edu-explorer__card ${isActive ? 'edu-explorer__card--active' : ''}`}
                role="option"
                aria-selected={isActive}
                aria-label={`Huruf ${letter.name}: ${letter.char}`}
                onClick={() => setActiveLetter(isActive ? null : letter)}
                variants={staggerItem}
              >
                <span className="edu-explorer__char" aria-hidden="true">{letter.char}</span>
                <span className="edu-explorer__name">{letter.name}</span>
              </motion.button>
            );
          })
        )}
      </motion.div>

      {/* Detail panel */}
      <AnimatePresence mode="wait">
        {activeLetter && (
          <motion.div
            className="edu-explorer__detail"
            key={activeLetter.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            role="region"
            aria-label={`Detail huruf ${activeLetter.name}`}
          >
            <div className="edu-explorer__detail-char">{activeLetter.char}</div>
            <div className="edu-explorer__detail-info">
              <h3 className="edu-explorer__detail-name">{activeLetter.name}</h3>
              <p className="edu-explorer__detail-desc">
                Huruf <strong>{activeLetter.name}</strong> ditulis dengan bentuk <span className="edu-explorer__detail-arabic">{activeLetter.char}</span> dalam bahasa Arab.
              </p>
            </div>
            <button
              className="edu-explorer__detail-close"
              onClick={() => setActiveLetter(null)}
              aria-label="Tutup detail huruf"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

/* ================================================================
   Hijaiyah Quiz — Guess the letter game
   ================================================================ */
const HijaiyahQuiz = () => {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [clickedOption, setClickedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);

  const generateQuestion = useCallback(() => {
    setFeedback(null);
    setClickedOption(null);
    const correctLetter = letters[Math.floor(Math.random() * letters.length)];
    let tempOptions = [correctLetter.name];

    while (tempOptions.length < 4) {
      const randomLetter = letters[Math.floor(Math.random() * letters.length)];
      if (!tempOptions.includes(randomLetter.name)) {
        tempOptions.push(randomLetter.name);
      }
    }

    setCurrentQuestion(correctLetter);
    setOptions(tempOptions.sort(() => Math.random() - 0.5));
  }, []);

  useEffect(() => {
    generateQuestion();
  }, [generateQuestion]);

  const handleAnswer = (option) => {
    if (feedback) return;
    setClickedOption(option);

    if (option === currentQuestion.name) {
      setFeedback('correct');
      setScore((s) => s + 1);
      setRound((r) => r + 1);
      toast({ title: "Benar!", description: "Jawaban Anda benar!", className: "bg-green-500 text-white" });
      setTimeout(generateQuestion, 1500);
    } else {
      setFeedback('incorrect');
      setRound((r) => r + 1);
      toast({ title: "Salah!", description: "Coba lagi ya!", variant: "destructive" });
      setTimeout(() => setFeedback(null), 1500);
    }
  };

  const resetGame = () => {
    setScore(0);
    setRound(0);
    setFeedback(null);
    generateQuestion();
  };

  if (!currentQuestion) {
    return (
      <div className="edu-game" role="group" aria-label="Memuat permainan tebak huruf">
        <div className="edu-game__body">
          <div className="edu-loading" role="status" aria-label="Memuat permainan">
            <div className="edu-loading__spinner" aria-hidden="true" />
            <span className="edu-loading__text">Memuat permainan...</span>
          </div>
        </div>
      </div>
    );
  }

  const optionLabels = ['A', 'B', 'C', 'D'];

  return (
    <div className="edu-game" role="group" aria-label="Permainan tebak huruf hijaiyah">
      {/* Score bar */}
      <div className="edu-game__scorebar">
        <div className="edu-game__score-item">
          <Star className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Skor: <strong>{score}</strong></span>
        </div>
        <div className="edu-game__score-item">
          <span>Soal ke <strong>{round + 1}</strong></span>
        </div>
      </div>

      <div className="edu-game__body">
        <motion.div
          className="edu-game__letter"
          aria-label={`Huruf: ${currentQuestion.name}`}
          key={currentQuestion.name}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {currentQuestion.char}
        </motion.div>
        <p className="edu-game__question">Huruf apakah ini?</p>
        <div className="edu-game__options" role="radiogroup" aria-label="Pilihan jawaban">
          {options.map((option, index) => {
            let className = 'edu-game__option';
            if (feedback) {
              if (option === currentQuestion.name) {
                className += ' edu-game__option--correct';
              } else if (feedback === 'incorrect' && option === clickedOption) {
                className += ' edu-game__option--wrong';
              }
            }
            return (
              <button
                key={option}
                className={className}
                onClick={() => handleAnswer(option)}
                disabled={!!feedback}
                aria-label={`${optionLabels[index]}. ${option}`}
              >
                <span className="edu-game__option-label">{optionLabels[index]}.</span>
                {option}
              </button>
            );
          })}
        </div>
        <div className="edu-game__feedback" aria-live="polite">
          {feedback === 'correct' && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="edu-game__feedback-icon edu-game__feedback-icon--correct"
            >
              <Check className="w-6 h-6" />
            </motion.span>
          )}
          {feedback === 'incorrect' && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="edu-game__feedback-icon edu-game__feedback-icon--wrong"
            >
              <X className="w-6 h-6" />
            </motion.span>
          )}
        </div>
        <div className="edu-game__actions">
          <button className="edu-game__next-btn" onClick={generateQuestion}>
            <RefreshCw className="w-4 h-4" />
            Soal Berikutnya
          </button>
          {round > 0 && (
            <button className="edu-game__reset-btn" onClick={resetGame}>
              Mulai Ulang
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ================================================================
   Tajwid Dictionary — Card-based mini dictionary
   ================================================================ */
const TajwidDictionary = () => {
  const colorMap = {
    teal: { bg: 'var(--edu-teal-soft)', text: 'var(--edu-teal-deep)', border: 'var(--edu-teal)' },
    violet: { bg: 'var(--edu-violet-soft)', text: 'var(--edu-violet)', border: 'var(--edu-violet)' },
    amber: { bg: 'var(--edu-amber-soft)', text: 'var(--edu-amber)', border: 'var(--edu-amber)' },
    green: { bg: 'var(--edu-green-soft)', text: 'var(--edu-green)', border: 'var(--edu-green)' },
    coral: { bg: 'var(--edu-coral-soft)', text: 'var(--edu-coral)', border: 'var(--edu-coral)' },
  };

  return (
    <section className="edu-section" aria-labelledby="edu-tajwid-heading">
      <div className="edu-section__header">
        <p className="edu-section__kicker">
          <BookOpen className="w-3.5 h-3.5" />
          Referensi
        </p>
        <h2 id="edu-tajwid-heading" className="edu-section__title">Kamus Tajwid Mini</h2>
        <p className="edu-section__desc">
          Istilah-istilah penting dalam ilmu tajwid yang perlu dipahami oleh setiap pembaca Al-Qur'an.
        </p>
      </div>

      <motion.div
        className="edu-tajwid__grid"
        role="list"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-30px' }}
      >
        {tajwidTerms.map((item) => {
          const c = colorMap[item.color] || colorMap.teal;
          return (
            <motion.article
              key={item.id}
              className="edu-tajwid-card"
              role="listitem"
              variants={staggerItem}
            >
              <div
                className="edu-tajwid-card__accent"
                style={{ background: c.border }}
                aria-hidden="true"
              />
              <div className="edu-tajwid-card__body">
                <div className="edu-tajwid-card__badge" style={{ background: c.bg, color: c.text }}>
                  {item.term.charAt(0)}
                </div>
                <h3 className="edu-tajwid-card__term">{item.term}</h3>
                <p className="edu-tajwid-card__def">{item.definition}</p>
              </div>
            </motion.article>
          );
        })}
      </motion.div>
    </section>
  );
};

/* ================================================================
   Main Component
   ================================================================ */
const EduMediaPage = () => {
  const [activeModule, setActiveModule] = useState('game');
  const moduleRefs = {
    game: useRef(null),
    explore: useRef(null),
    tajwid: useRef(null),
  };

  const scrollToModule = (id) => {
    setActiveModule(id);
    moduleRefs[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* Intersection observer to update active module on scroll */
  useEffect(() => {
    const observers = [];
    const sections = Object.entries(moduleRefs);

    sections.forEach(([id, ref]) => {
      if (!ref.current) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveModule(id);
          }
        },
        { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
      );
      observer.observe(ref.current);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <>
      <Helmet>
        <title>Media Edukatif - LPQ Al-Fath Maulana</title>
        <meta name="description" content="Jelajahi media edukatif Islami, termasuk game tebak huruf hijaiyah dan kamus tajwid mini, untuk pembelajaran yang menyenangkan." />
        <meta property="og:title" content="Media Edukatif - LPQ Al-Fath Maulana" />
        <meta property="og:description" content="Media pembelajaran interaktif untuk santri dan keluarga: huruf hijaiyah, tajwid, dan lebih banyak lagi." />
        <link rel="canonical" href={`${window.location.origin}/parenting/media-edukatif`} />
      </Helmet>

      <div className="edu-page">
        {/* ---- Breadcrumb ---- */}
        <nav className="edu-breadcrumb" aria-label="Breadcrumb">
          <Link to="/parenting" className="edu-breadcrumb__link">Parenting</Link>
          <ChevronRight className="w-3 h-3 edu-breadcrumb__sep" aria-hidden="true" />
          <span className="edu-breadcrumb__current" aria-current="page">Media Edukatif</span>
        </nav>

        {/* ---- HERO ---- */}
        <section className="edu-hero" aria-labelledby="edu-hero-title">
          <div className="edu-hero__bg-pattern" aria-hidden="true">
            <div className="edu-hero__circle edu-hero__circle--1" />
            <div className="edu-hero__circle edu-hero__circle--2" />
            <div className="edu-hero__circle edu-hero__circle--3" />
          </div>
          <motion.div
            className="edu-hero__inner"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <div className="edu-hero__icon-row" aria-hidden="true">
              <div className="edu-hero__icon-item edu-hero__icon-item--teal">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="edu-hero__icon-item edu-hero__icon-item--amber">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <div className="edu-hero__icon-item edu-hero__icon-item--violet">
                <GraduationCap className="w-5 h-5" />
              </div>
            </div>
            <span className="edu-hero__badge">
              <Library className="w-3.5 h-3.5" />
              Perpustakaan Pembelajaran
            </span>
            <h1 id="edu-hero-title" className="edu-hero__title">
              Media <span className="edu-hero__title-accent">Edukatif</span>
            </h1>
            <p className="edu-hero__desc">
              Jelajahi media pembelajaran interaktif untuk santri dan keluarga — dari mengenal huruf hijaiyah hingga memahami ilmu tajwid.
            </p>

            {/* Module quick nav */}
            <div className="edu-hero__nav" role="navigation" aria-label="Modul pembelajaran">
              {learningModules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <button
                    key={mod.id}
                    className={`edu-hero__nav-btn ${activeModule === mod.id ? 'edu-hero__nav-btn--active' : ''}`}
                    onClick={() => scrollToModule(mod.id)}
                    aria-label={`Lihat ${mod.label}`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{mod.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </section>

        <div className="edu-container">
          {/* ---- Interactive Quiz (Featured) ---- */}
          <div ref={moduleRefs.game}>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              <section className="edu-section" aria-labelledby="edu-game-heading">
                <div className="edu-section__header">
                  <p className="edu-section__kicker">
                    <Puzzle className="w-3.5 h-3.5" />
                    Interaktif
                  </p>
                  <h2 id="edu-game-heading" className="edu-section__title">Game Tebak Huruf Hijaiyah</h2>
                  <p className="edu-section__desc">
                    Lihat huruf hijaiyah di bawah ini, lalu pilih nama huruf yang benar!
                  </p>
                </div>
                <HijaiyahQuiz />
              </section>
            </motion.div>
          </div>

          {/* ---- Hijaiyah Explorer ---- */}
          <div ref={moduleRefs.explore}>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              <HijaiyahExplorer />
            </motion.div>
          </div>

          {/* ---- Tajwid Dictionary ---- */}
          <div ref={moduleRefs.tajwid}>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              <TajwidDictionary />
            </motion.div>
          </div>
        </div>

        {/* ---- Footer CTA ---- */}
        <section className="edu-footer-cta" aria-label="Ajakan bertindak">
          <div className="edu-footer-cta__inner">
            <Sparkles className="w-5 h-5 edu-footer-cta__icon" aria-hidden="true" />
            <p className="edu-footer-cta__text">
              Ingin belajar lebih lanjut? Kunjungi kelas kami atau tanyakan kepada guru.
            </p>
            <Link to="/parenting" className="edu-footer-cta__btn">
              Lihat Artikel Parenting
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
};

export default EduMediaPage;