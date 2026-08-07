import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ChevronRight,
  User,
  Clock,
  BrainCircuit,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import '@/styles/public-parenting.css';

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

/* ---------- Quiz Data ---------- */
const quizQuestions = [
  { question: "Apa hukum bacaan nun sukun (نْ) atau tanwin bertemu huruf ba (ب)?", options: ["Idgham", "Ikhfa", "Iqlab", "Idzhar"], answer: "Iqlab" },
  { question: "Huruf-huruf Qalqalah terkumpul dalam lafaz...", options: ["يَرْمَلُوْنَ", "قُطْبُ جَدٍّ", "أَنْعَمْتَ", "يَنْصُرُكُمْ"], answer: "قُطْبُ جَدٍّ" },
  { question: "Bacaan Mad Thabi'i dibaca sepanjang...", options: ["1 harakat", "2 harakat", "4 harakat", "6 harakat"], answer: "2 harakat" },
  { question: "Ketika ada mim sukun (مْ) bertemu dengan huruf mim (م), hukum bacaannya adalah...", options: ["Ikhfa Syafawi", "Idgham Mitslain", "Idzhar Syafawi", "Qalqalah"], answer: "Idgham Mitslain" },
  { question: "Manakah di antara berikut yang termasuk huruf Idzhar Halqi?", options: ["ق", "ب", "ي", "ء"], answer: "ء" },
  { question: "Bacaan 'Alif Lam' yang dibaca jelas disebut...", options: ["Alif Lam Syamsiyah", "Alif Lam Qamariyah", "Mad Lazim", "Mad Wajib"], answer: "Alif Lam Qamariyah" },
  { question: "Berapa jumlah huruf Idgham Bighunnah?", options: ["2", "4", "6", "8"], answer: "4" },
  { question: "Tanda waqaf (لا) berarti...", options: ["Harus berhenti", "Boleh berhenti, boleh lanjut", "Lebih baik lanjut", "Dilarang berhenti"], answer: "Dilarang berhenti" },
  { question: "Ghunnah artinya adalah...", options: ["Memantul", "Dengung", "Jelas", "Samar-samar"], answer: "Dengung" },
  { question: "Huruf 'Ra' (ر) yang dibaca tebal (tafkhim) adalah ketika berharakat...", options: ["Kasrah", "Fathah atau Dhammah", "Sukun", "Kasratain"], answer: "Fathah atau Dhammah" },
];

/* ---------- Islamic Quiz Sub-component ---------- */
const IslamicQuiz = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);

  const handleAnswerOptionClick = (option) => {
    setSelectedAnswer(option);
    const correct = option === quizQuestions[currentQuestion].answer;
    setIsCorrect(correct);
    if (correct) setScore(score + 1);
    setTimeout(() => {
      const nextQuestion = currentQuestion + 1;
      if (nextQuestion < quizQuestions.length) {
        setCurrentQuestion(nextQuestion);
        setSelectedAnswer(null);
        setIsCorrect(null);
      } else {
        setShowScore(true);
      }
    }, 1500);
  };

  const restartQuiz = () => {
    setCurrentQuestion(0);
    setScore(0);
    setShowScore(false);
    setSelectedAnswer(null);
    setIsCorrect(null);
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={fadeUp}
      className="par-quiz"
    >
      <div className="par-quiz__header">
        <h2 className="par-quiz__title">
          <BrainCircuit className="w-6 h-6" />
          Tes Pengetahuan Islami
        </h2>
      </div>
      <div className="par-quiz__body">
        {showScore ? (
          <div className="par-quiz__result">
            <p className="par-quiz__result-score">
              Anda menjawab {score} dari {quizQuestions.length} pertanyaan dengan benar!
            </p>
            <button className="par-quiz__restart" onClick={restartQuiz}>
              <RefreshCw className="w-4 h-4" />
              Coba Lagi
            </button>
          </div>
        ) : (
          <div>
            <p className="par-quiz__progress">
              Pertanyaan {currentQuestion + 1}/{quizQuestions.length}
            </p>
            <h3 className="par-quiz__question">{quizQuestions[currentQuestion].question}</h3>
            <div className="par-quiz__options" role="radiogroup" aria-label="Pilihan jawaban">
              {quizQuestions[currentQuestion].options.map((option, index) => {
                const isSelected = selectedAnswer === option;
                let className = 'par-quiz__option';
                if (isSelected) className += isCorrect ? ' par-quiz__option--correct' : ' par-quiz__option--wrong';
                return (
                  <button
                    key={index}
                    className={className}
                    onClick={() => handleAnswerOptionClick(option)}
                    disabled={selectedAnswer !== null}
                    aria-label={option}
                  >
                    {isSelected && (
                      <span className="par-quiz__option-icon">
                        {isCorrect ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" /> : <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
                      </span>
                    )}
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/* ---------- Loading State ---------- */
const LoadingState = () => (
  <div className="par-loading" role="status" aria-label="Memuat artikel">
    <div className="par-loading__spinner" aria-hidden="true" />
    <span style={{ fontSize: '0.9rem', color: 'var(--par-muted)' }}>Memuat artikel...</span>
  </div>
);

/* ---------- Empty State ---------- */
const EmptyState = () => (
  <div className="par-empty">
    <BookOpen className="par-empty__icon" />
    <h2 className="par-empty__title">Belum Ada Artikel</h2>
    <p className="par-empty__text">Artikel parenting akan tampil di sini setelah tersedia.</p>
  </div>
);

/* ---------- Error State ---------- */
const ErrorState = ({ message, onRetry }) => (
  <div className="par-error">
    <AlertCircle className="par-error__icon" />
    <h2 className="par-error__title">Gagal Memuat</h2>
    <p className="par-error__text">{message || 'Terjadi kesalahan saat memuat artikel.'}</p>
    {onRetry && (
      <button className="par-retry-btn" onClick={onRetry}>
        <RefreshCw className="w-4 h-4" />
        Coba Lagi
      </button>
    )}
  </div>
);

/* ---------- Main Component ---------- */
const ParentingPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('website_content')
        .select('content')
        .eq('key', 'parentingArticles')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        setError('Gagal memuat artikel parenting. Silakan coba lagi.');
        console.error('Error fetching parenting articles:', fetchError);
      } else if (data) {
        setArticles(data.content || []);
      }
    } catch (err) {
      setError('Terjadi kesalahan tak terduga.');
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const publishedArticles = articles.filter((a) => a.status !== 'archived');
  const featured = publishedArticles[0];
  const rest = publishedArticles.slice(1);

  return (
    <>
      <Helmet>
        <title>Parenting Islami - LPQ Al-Fath Maulana</title>
        <meta name="description" content="Artikel dan tips parenting Islami untuk orang tua Muslim. Dukung peran Anda sebagai pendidik utama di rumah bersama LPQ Al-Fath Maulana." />
        <meta property="og:title" content="Parenting Islami - LPQ Al-Fath Maulana" />
        <meta property="og:description" content="Kumpulan artikel parenting Islami untuk keluarga Muslim yang reflektif dan terpercaya." />
        <link rel="canonical" href={`${window.location.origin}/parenting`} />
      </Helmet>

      <div className="par-page">
        {/* ---- HERO ---- */}
        <section className="par-hero" aria-labelledby="par-hero-title">
          <motion.div
            className="par-hero__inner"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <span className="par-hero__badge">
              <BookOpen className="w-3.5 h-3.5" />
              Pojok Parenting
            </span>
            <h1 id="par-hero-title" className="par-hero__title">
              Parenting <span className="par-hero__title-accent">Islami</span>
            </h1>
            <p className="par-hero__desc">
              Kumpulan artikel dan tips untuk mendukung peran orang tua sebagai pendidik utama di rumah, dengan perspektif keluarga Muslim yang reflektif.
            </p>
          </motion.div>
        </section>

        <div className="par-container">
          {/* ---- Loading ---- */}
          {loading && <LoadingState />}

          {/* ---- Error ---- */}
          {!loading && error && <ErrorState message={error} onRetry={fetchArticles} />}

          {/* ---- Empty ---- */}
          {!loading && !error && publishedArticles.length === 0 && <EmptyState />}

          {/* ---- Featured + Grid ---- */}
          {!loading && !error && publishedArticles.length > 0 && (
            <>
              {/* Featured Article */}
              {featured && (
                <motion.div
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-40px' }}
                  variants={fadeUp}
                >
                  <Link to={`/parenting/${featured.id}`} className="par-featured" aria-label={`Baca artikel: ${featured.title}`}>
                    <div className="par-featured__image-wrap">
                      <img
                        src={featured.image_url}
                        alt={featured.title}
                        className="par-featured__image"
                        loading="eager"
                      />
                      <span className="par-featured__tag">Unggulan</span>
                    </div>
                    <div className="par-featured__body">
                      <div className="par-featured__meta">
                        <span className="par-featured__meta-item">
                          <User className="w-3.5 h-3.5" />
                          {featured.author}
                        </span>
                        <span className="par-featured__meta-item">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(featured.date)}
                        </span>
                      </div>
                      <h2 className="par-featured__title">{featured.title}</h2>
                      <p className="par-featured__excerpt">{featured.summary}</p>
                      <span className="par-featured__cta">
                        Baca Selengkapnya
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              )}

              {/* Article Grid */}
              {rest.length > 0 && (
                <motion.div
                  className="par-grid"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-40px' }}
                  variants={staggerContainer}
                >
                  {rest.map((article) => (
                    <motion.article key={article.id} className="par-card" variants={staggerItem}>
                      <Link to={`/parenting/${article.id}`} className="par-card__image-wrap" aria-label={`Baca artikel: ${article.title}`}>
                        <img
                          src={article.image_url}
                          alt={article.title}
                          className="par-card__image"
                          loading="lazy"
                        />
                      </Link>
                      <div className="par-card__body">
                        <div className="par-card__meta">
                          <span className="par-card__meta-item">
                            <User className="w-3 h-3" />
                            {article.author}
                          </span>
                          <span className="par-card__meta-item">
                            <Clock className="w-3 h-3" />
                            {formatDate(article.date)}
                          </span>
                        </div>
                        <h3 className="par-card__title">{article.title}</h3>
                        <p className="par-card__excerpt">{article.summary}</p>
                        <Link to={`/parenting/${article.id}`} className="par-card__link">
                          Baca Selengkapnya
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </motion.article>
                  ))}
                </motion.div>
              )}
            </>
          )}

          {/* ---- Islamic Quiz ---- */}
          {!loading && !error && <IslamicQuiz />}
        </div>
      </div>
    </>
  );
};

export default ParentingPage;