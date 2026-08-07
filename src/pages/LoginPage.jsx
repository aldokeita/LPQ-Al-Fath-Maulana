import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase, isSupabaseConfigured } from '@/lib/customSupabaseClient';
import TextType from '@/components/reactbits/TextType/TextType';
import { useTheme } from '@/contexts/ThemeContext';
import '@/styles/public-login.css';
import { LOGIN_SECURITY_CONSENT_KEY, recordLoginAttempt } from '@/lib/loginSecurityAdapters';

/* Lazy load DarkVeil to avoid blocking initial render */
const DarkVeil = lazy(() => import('@/components/reactbits/DarkVeil/DarkVeil'));

/* ---------- Animation Variants ---------- */
const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

const brandVariants = {
  hidden: { opacity: 0, y: -12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 },
  },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.2 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

/* ---------- Error Mapping ---------- */
const mapErrorMessage = (error) => {
  if (!error) return null;
  const msg = error.message?.toLowerCase() || '';

  if (msg.includes('supabase belum dikonfigurasi')) {
    return error.message;
  }
  if (msg.includes('fetch') || msg.includes('network')) {
    return 'Koneksi ke server gagal. Periksa koneksi internet Anda.';
  }
  if (
    msg.includes('invalid') ||
    msg.includes('salah') ||
    msg.includes('format') ||
    msg.includes('credentials')
  ) {
    return 'Email/Username atau Password salah.';
  }
  if (msg.includes('not found') || msg.includes('tidak ditemukan')) {
    return 'Akun tidak ditemukan. Periksa kembali kredensial Anda.';
  }
  return 'Terjadi kesalahan, silakan coba lagi.';
};

const getDeviceCategory = () => {
  if (typeof navigator === 'undefined') return 'Unknown';
  const userAgent = navigator.userAgent || '';
  if (/tablet|ipad/i.test(userAgent)) return 'Tablet';
  if (/mobile|iphone|android/i.test(userAgent)) return 'Mobile';
  return 'Desktop';
};

const recordLoginResult = ({ username, status }) => recordLoginAttempt({
  username,
  status,
  device: getDeviceCategory(),
});

/* ======================================== */
/*            MAIN COMPONENT                */
/* ======================================== */

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [logoUrl, setLogoUrl] = useState('/logo-lpq-al-fath-maulana.webp');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [securityNoticeAccepted, setSecurityNoticeAccepted] = useState(() => (
    typeof window !== 'undefined' && window.localStorage.getItem(LOGIN_SECURITY_CONSENT_KEY) === 'accepted'
  ));

  const { signInWithUsername, user, role, loading, profileLoading } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  /* --- Redirect if already authenticated --- */
  useEffect(() => {
    if (user && role && !loading && !profileLoading) {
      navigate('/dashboard');
    }
  }, [user, role, loading, profileLoading, navigate]);

  /* --- Fetch dynamic logo --- */
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    const fetchLogo = async () => {
      const { data } = await supabase
        .from('website_content')
        .select('content')
        .eq('key', 'logoUrl')
        .maybeSingle();
      if (data?.content) setLogoUrl(data.content);
    };
    fetchLogo();

    const channel = supabase
      .channel('website_content_login_logo')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'website_content', filter: 'key=eq.logoUrl' },
        (payload) => setLogoUrl(payload.new?.content || '/logo-lpq-al-fath-maulana.webp'),
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  /* --- Form Validation --- */
  const validate = useCallback(() => {
    const errors = {};
    if (!username.trim()) {
      errors.username = 'Masukkan email atau username Anda.';
    }
    if (!password.trim()) {
      errors.password = 'Masukkan password Anda.';
    }
    return errors;
  }, [username, password]);

  /* --- Submit Handler --- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.username) {
        usernameRef.current?.focus();
      } else if (errors.password) {
        passwordRef.current?.focus();
      }
      return;
    }

    setIsSubmitting(true);

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    try {
      const { user: loggedInUser, error } = await signInWithUsername(
        trimmedUsername,
        trimmedPassword,
      );

      if (error) {
        await recordLoginResult({ username: trimmedUsername, status: 'failed' });
        const errorMsg = mapErrorMessage(error);
        setFormError(errorMsg);
        setPassword('');
        setTimeout(() => passwordRef.current?.focus(), 100);
      } else if (loggedInUser) {
        await recordLoginResult({ username: trimmedUsername, status: 'success' });
        toast({
          title: 'Login berhasil!',
          description: 'Mengalihkan ke dashboard...',
          className: 'bg-green-600 text-white border-none',
        });
        navigate('/dashboard');
      }
    } catch (err) {
      await recordLoginResult({ username: trimmedUsername, status: 'failed' });
      setFormError('Terjadi kesalahan, silakan coba lagi.');
      setPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const acceptSecurityNotice = () => {
    window.localStorage.setItem(LOGIN_SECURITY_CONSENT_KEY, 'accepted');
    setSecurityNoticeAccepted(true);
    window.setTimeout(() => usernameRef.current?.focus(), 100);
  };

  /* --- Loading / Redirect state --- */
  if (loading) {
    return (
      <div className="login-page">
        <Helmet>
          <title>Login - LPQ Al-Fath Maulana</title>
        </Helmet>
        <div className="login-bg">
          <Suspense fallback={null}>
            <DarkVeil hueShift={58} speed={0.5} scanlineIntensity={0} invert={isDark ? 0 : 0.85} resolutionScale={0.5} />
          </Suspense>
        </div>
        <div className="login-content">
          <div className="login-spinner" style={{ width: 32, height: 32 }} aria-label="Memuat..." />
        </div>
      </div>
    );
  }

  /* --- Render --- */
  return (
    <>
      <Helmet>
        <title>Login - LPQ Al-Fath Maulana</title>
        <meta
          name="description"
          content="Login ke sistem LPQ Al-Fath Maulana untuk mengakses dashboard"
        />
      </Helmet>

      <div className="login-page">
        {/* ===== DarkVeil Background ===== */}
        <div className="login-bg" aria-hidden="true">
          <Suspense fallback={null}>
            <DarkVeil
              hueShift={58}
              noiseIntensity={0.08}
              scanlineIntensity={0}
              speed={0.6}
              scanlineFrequency={0}
              warpAmount={0.15}
              invert={isDark ? 0 : 0.85}
            />
          </Suspense>
        </div>

        {/* ===== Content Layer ===== */}
        <div className="login-content">
          {/* Brand */}
          <motion.div
            className="login-brand"
            variants={brandVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="login-brand-logo">
              <img src={logoUrl} alt="Logo LPQ Al-Fath Maulana" />
            </div>
            <h1 className="login-brand-name font-cinzel">LPQ Al-Fath Maulana</h1>
            <p className="login-brand-sub font-montserrat">Metode Qiroati</p>
          </motion.div>

          {/* Glass Card */}
          <motion.div
            className="login-card"
            variants={prefersReducedMotion ? undefined : cardVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Header with TextType */}
            <motion.div
              className="login-card-header"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={staggerItem} className="login-card-greeting">
                <TextType
                  text={['Selamat Datang']}
                  typingSpeed={75}
                  initialDelay={300}
                  pauseDuration={4000}
                  loop={false}
                  showCursor={true}
                  cursorCharacter="|"
                  cursorClassName="login-text-cursor"
                  as="span"
                  textColors={['rgba(78, 190, 120, 0.9)']}
                />
              </motion.div>
              <motion.p variants={staggerItem} className="login-card-description">
                Masukkan kredensial Anda untuk mengakses dashboard.
              </motion.p>
            </motion.div>

            {/* Inline Error Alert */}
            {formError && (
              <div
                className="login-alert"
                role="alert"
                aria-live="assertive"
              >
                <AlertCircle className="login-alert-icon" aria-hidden="true" />
                <div className="login-alert-content">
                  <p className="login-alert-title">Login Gagal</p>
                  <p className="login-alert-message">{formError}</p>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              {/* Username Field */}
              <div className="login-field-group">
                <label htmlFor="login-username" className="login-field-label">
                  Email atau Nama Panggilan Santri
                </label>
                <div className="login-input-wrapper">
                  <User className="login-input-icon" aria-hidden="true" />
                  <input
                    ref={usernameRef}
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    placeholder="Email pengajar atau Nama Panggilan Santri"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (fieldErrors.username) {
                        setFieldErrors((prev) => ({ ...prev, username: null }));
                      }
                    }}
                    disabled={isSubmitting}
                    className={`login-input${fieldErrors.username ? ' login-input--error' : ''}`}
                    aria-describedby={fieldErrors.username ? 'login-username-error' : undefined}
                    aria-invalid={!!fieldErrors.username}
                    required
                  />
                </div>
                <div
                  id="login-username-error"
                  className="login-field-error"
                  role="status"
                  aria-live="polite"
                >
                  {fieldErrors.username && (
                    <>
                      <AlertCircle aria-hidden="true" />
                      {fieldErrors.username}
                    </>
                  )}
                </div>
              </div>

              {/* Password Field */}
              <div className="login-field-group">
                <label htmlFor="login-password" className="login-field-label">
                  Password
                </label>
                <div className="login-input-wrapper">
                  <Lock className="login-input-icon" aria-hidden="true" />
                  <input
                    ref={passwordRef}
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: null }));
                      }
                    }}
                    disabled={isSubmitting}
                    className={`login-input login-input--password${fieldErrors.password ? ' login-input--error' : ''}`}
                    aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                    aria-invalid={!!fieldErrors.password}
                    required
                  />
                  <button
                    type="button"
                    className="login-password-toggle lpq-shiny-button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    tabIndex={0}
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" />
                    ) : (
                      <Eye aria-hidden="true" />
                    )}
                  </button>
                </div>
                <div
                  id="login-password-error"
                  className="login-field-error"
                  role="status"
                  aria-live="polite"
                >
                  {fieldErrors.password && (
                    <>
                      <AlertCircle aria-hidden="true" />
                      {fieldErrors.password}
                    </>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="login-submit-btn lpq-shiny-button"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="login-spinner" aria-hidden="true" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  'Masuk'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="login-footer" aria-hidden="true">
              <p>&copy; {new Date().getFullYear()} LPQ Al-Fath Maulana</p>
              <p>Metode Qiroati</p>
            </div>
          </motion.div>
        </div>

        {!securityNoticeAccepted && (
          <div className="login-privacy-overlay" role="presentation">
            <section className="login-privacy-dialog" role="dialog" aria-modal="true" aria-labelledby="login-privacy-title" aria-describedby="login-privacy-description">
              <div className="login-privacy-icon"><Lock aria-hidden="true" /></div>
              <div>
                <p className="login-privacy-kicker">Keamanan akun</p>
                <h2 id="login-privacy-title">Privasi dan keamanan login</h2>
                <p id="login-privacy-description">
                  Untuk melindungi akun, sistem mencatat waktu login, jenis perangkat, alamat IP, dan perkiraan lokasi jaringan. Penyimpanan lokal digunakan untuk mempertahankan sesi serta pilihan ini.
                </p>
                <p className="login-privacy-note">Kami tidak merekam password, isi sesi, GPS, atau lokasi presisi perangkat.</p>
              </div>
              <button type="button" onClick={acceptSecurityNotice} className="login-privacy-action">
                Izinkan &amp; lanjutkan
              </button>
            </section>
          </div>
        )}
      </div>
    </>
  );
};

export default LoginPage;
