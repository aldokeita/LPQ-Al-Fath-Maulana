import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/contexts/SupabaseAuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ProfilePage from '@/pages/ProfilePage';
import RegistrationInfoPage from '@/pages/RegistrationInfoPage';
import BrochurePage from '@/pages/BrochurePage';
import ContactPage from '@/pages/ContactPage';
import PaymentStatusPage from '@/pages/PaymentStatusPage';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import NewsPage from '@/pages/NewsPage';
import NewsDetailPage from '@/pages/NewsDetailPage';
import AnnouncementPage from '@/pages/AnnouncementPage';
import AnnouncementDetailPage from '@/pages/AnnouncementDetailPage';
import QiroatiMethodPage from '@/pages/QiroatiMethodPage';
import FacilitiesPage from '@/pages/FacilitiesPage';
import ParentingPage from '@/pages/ParentingPage';
import ParentingArticlePage from '@/pages/ParentingArticlePage';
import ForumPage from '@/pages/ForumPage';
import ForumTopicPage from '@/pages/ForumTopicPage';
import EduMediaPage from '@/pages/EduMediaPage';
import SystemPage from '@/pages/SystemPage';
import WaliDiscussionPage from '@/pages/WaliDiscussionPage';
import DigitalAttendancePage from '@/pages/DigitalAttendancePage';
import TvDisplayPage from '@/pages/TvDisplayPage';
import QuizHafalanPage from '@/pages/QuizHafalanPage';
import GatchaGamePage from '@/pages/GatchaGamePage';
import GalleryPage from '@/pages/GalleryPage';
import RandomNamePage from '@/pages/RandomNamePage';
import TopScorePage from '@/pages/TopScorePage';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { verifyDatabaseSchema } from '@/utils/verifyDatabaseSchema';
import { AlertTriangle, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/customSupabaseClient';
import { enableDeferredFeatures, enableGameFeatures } from '@/lib/featureFlags';

const RouteLogger = () => {
  const location = useLocation();
  useEffect(() => {
    console.log(`App Routing to: ${location.pathname}${location.search}`);
  }, [location]);
  return null;
};

/* ------------------------------------------------------------------ */
/* Dynamic logo crossfade helper                                      */
/* Shows the official local logo first, then crossfades to a Supabase logo. */
/* ------------------------------------------------------------------ */
const DynamicLogo = ({ className = '', width = 48, height = 48 }) => {
  const [dynamicUrl, setDynamicUrl] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let cancelled = false;

    const fetchLogo = async () => {
      try {
        const { data } = await supabase
          .from('website_content')
          .select('content')
          .eq('key', 'logoUrl')
          .maybeSingle();
        if (!cancelled && data?.content && data.content !== '/logo-lpq-al-fath-maulana.webp') {
          // Preload the dynamic logo in background before crossfading
          const img = new Image();
          img.onload = () => {
            if (!cancelled) {
              setDynamicUrl(data.content);
              setReady(true);
            }
          };
          img.onerror = () => {
            // Keep local logo on failure — never show empty
          };
          img.src = data.content;
        }
      } catch {
        // Supabase offline or error — keep local logo
      }
    };

    fetchLogo();
    return () => { cancelled = true; };
  }, []);

  return (
    <span className={`relative inline-block ${className}`} style={{ width, height }}>
      {/* Local logo — always present */}
      <img
        src="/logo-lpq-al-fath-maulana.webp"
        alt="Logo LPQ Al-Fath Maulana"
        width={width}
        height={height}
        className="absolute inset-0 w-full h-full object-contain"
        style={{ opacity: ready ? 0 : 1, transition: 'opacity 0.5s ease' }}
      />
      {/* Dynamic logo — crossfades in when loaded */}
      {dynamicUrl && (
        <img
          src={dynamicUrl}
          alt="Logo LPQ Al-Fath Maulana"
          width={width}
          height={height}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.5s ease' }}
        />
      )}
    </span>
  );
};

const DatabaseHealthCheck = () => {
  const { role } = useAuth();
  const [dbErrors, setDbErrors] = useState([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const checkDb = async () => {
      if (role === 'admin' && isSupabaseConfigured) {
        const report = await verifyDatabaseSchema();
        console.log('Database Health Report:', report);
        if (report.status === 'error') {
          setDbErrors(report.errors);
        }
      }
    };
    checkDb();
  }, [role]);

  if (!isVisible || dbErrors.length === 0 || role !== 'admin') return null;

  return (
    <div className="bg-red-500 text-white p-4 fixed top-0 left-0 w-full z-[999] flex justify-between items-start shadow-md">
      <div>
        <div className="flex items-center gap-2 font-bold mb-1">
          <AlertTriangle className="w-5 h-5" />
          Database Schema / RLS Issues Detected
        </div>
        <ul className="list-disc list-inside text-sm ml-6">
          {dbErrors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      </div>
      <button onClick={() => setIsVisible(false)} className="p-1 hover:bg-red-600 rounded">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

const DeferredFeaturePage = () => (
  <div className="min-h-screen flex items-center justify-center bg-background px-4">
    <div className="max-w-md text-center space-y-3">
      <h1 className="text-2xl font-bold text-foreground">Fitur sedang dipersiapkan</h1>
      <p className="text-muted-foreground">
        Forum diskusi wali santri sedang kami siapkan. Sementara ini, silakan hubungi kami melalui halaman Kontak.
      </p>
    </div>
  </div>
);

const allDashboardRoles = ['admin', 'guru', 'santri', 'pentashih'];
const operationalDisplayRoles = ['admin', 'guru', 'pentashih'];

function App() {
  /* ----------------------------------------------------------------
   * Dismiss the inline loading shell that lives in index.html.
   * The shell is pure HTML+CSS and appears instantly before React.
   * We remove it on mount so there is zero additional delay.
   * ---------------------------------------------------------------- */
  useEffect(() => {
    const shell = document.getElementById('lpq-loading');
    if (shell) {
      shell.classList.add('lpq-loading-hide');
      // Remove from DOM after transition completes
      const onEnd = () => shell.remove();
      shell.addEventListener('transitionend', onEnd, { once: true });
      // Fallback removal if transitionend doesn't fire
      setTimeout(() => shell.remove(), 600);
    }
    try {
      sessionStorage.setItem('lpq_initial_load_done', 'true');
    } catch {
      // sessionStorage can be unavailable in restricted browser modes.
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <DndProvider backend={HTML5Backend}>
          <Router>
            <DatabaseHealthCheck />
            <RouteLogger />
            <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
              <Routes>
                <Route path="/absensi-digital" element={<ProtectedRoute allowedRoles={operationalDisplayRoles}><DigitalAttendancePage /></ProtectedRoute>} />
                <Route path="/tv-display-mode" element={<ProtectedRoute allowedRoles={operationalDisplayRoles}><TvDisplayPage /></ProtectedRoute>} />
                {enableGameFeatures ? (
                  <>
                    <Route path="/quiz-hafalan" element={<ProtectedRoute><QuizHafalanPage /></ProtectedRoute>} />
                    <Route path="/gatcha-game" element={<ProtectedRoute><GatchaGamePage /></ProtectedRoute>} />
                    <Route path="/random-name" element={<ProtectedRoute><RandomNamePage /></ProtectedRoute>} />
                    <Route path="/top-score" element={<ProtectedRoute><TopScorePage /></ProtectedRoute>} />
                  </>
                ) : (
                  <>
                    <Route path="/quiz-hafalan" element={<ProtectedRoute><DeferredFeaturePage /></ProtectedRoute>} />
                    <Route path="/gatcha-game" element={<ProtectedRoute><DeferredFeaturePage /></ProtectedRoute>} />
                    <Route path="/random-name" element={<ProtectedRoute><DeferredFeaturePage /></ProtectedRoute>} />
                    <Route path="/top-score" element={<ProtectedRoute><DeferredFeaturePage /></ProtectedRoute>} />
                  </>
                )}

                <Route path="*" element={
                  <>
                    <Navbar />
                    <main className="flex-grow">
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/profil" element={<ProfilePage />} />
                        <Route path="/profil/galeri" element={<GalleryPage />} />
                        <Route path="/pendaftaran/informasi" element={<RegistrationInfoPage />} />
                        <Route path="/pendaftaran/brosur" element={<BrochurePage />} />
                        <Route path="/pendaftaran/sistem" element={<SystemPage />} />
                        <Route path="/parenting" element={<ParentingPage />} />
                        <Route path="/parenting/:articleId" element={<ParentingArticlePage />} />
                        <Route path="/parenting/media-edukatif" element={<EduMediaPage />} />
                        <Route path="/parenting/diskusi-wali" element={<WaliDiscussionPage />} />
                        {enableDeferredFeatures ? (
                          <>
                            <Route path="/forum" element={<ForumPage />} />
                            <Route path="/forum/:topicId" element={<ForumTopicPage />} />
                          </>
                        ) : (
                          <>
                            <Route path="/forum" element={<DeferredFeaturePage />} />
                            <Route path="/forum/:topicId" element={<DeferredFeaturePage />} />
                          </>
                        )}
                        <Route path="/kontak" element={<ContactPage />} />
                        <Route path="/status-pembayaran/:paymentId" element={<PaymentStatusPage />} />
                        <Route path="/berita" element={<NewsPage />} />
                        <Route path="/berita/:id" element={<NewsDetailPage />} />
                        <Route path="/pengumuman" element={<AnnouncementPage />} />
                        <Route path="/pengumuman/:id" element={<AnnouncementDetailPage />} />
                        <Route path="/metode-qiroati" element={<QiroatiMethodPage />} />
                        <Route path="/fasilitas" element={<FacilitiesPage />} />
                        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={allDashboardRoles}><DashboardPage /></ProtectedRoute>} />
                      </Routes>
                    </main>
                    <Footer />
                  </>
                } />
              </Routes>
              <Toaster />
              <ScrollToTopButton />
            </div>
          </Router>
        </DndProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
