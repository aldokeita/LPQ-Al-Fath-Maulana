import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase, isSupabaseConfigured } from '@/lib/customSupabaseClient';
import GlassSurface from '@/components/reactbits/GlassSurface/GlassSurface';
import '@/styles/navbar.css';

const navGroups = [
  { label: 'Beranda', to: '/' },
  {
    label: 'Berita',
    items: [
      { label: 'Berita Lembaga', to: '/berita' },
      { label: 'Pengumuman', to: '/pengumuman' },
    ],
  },
  {
    label: 'Pendaftaran',
    items: [
      { label: 'Informasi', to: '/pendaftaran/informasi' },
      { label: 'Brosur', to: '/pendaftaran/brosur' },
      { label: 'Sistem Mengaji', to: '/pendaftaran/sistem' },
    ],
  },
  {
    label: 'Parenting',
    items: [
      { label: 'Artikel Parenting', to: '/parenting' },
      { label: 'Media Edukatif', to: '/parenting/media-edukatif' },
      { label: 'Diskusi Wali Santri', to: '/parenting/diskusi-wali' },
    ],
  },
  {
    label: 'Profil',
    items: [
      { label: 'Tentang Kami', to: '/profil' },
      { label: 'Galeri', to: '/profil/galeri' },
      { label: 'Metode Qiroati', to: '/metode-qiroati' },
      { label: 'Fasilitas', to: '/fasilitas' },
    ],
  },
  { label: 'Kontak', to: '/kontak' },
];

const isActivePath = (pathname, target) => target === '/' ? pathname === '/' : pathname.startsWith(target);

const NavbarLogo = ({ logoUrl, logoFailed, setLogoFailed }) => (
  <Link to="/" className="navbar-logo" aria-label="LPQ Al-Fath Maulana beranda">
    {logoFailed ? (
      <span className="navbar-logo__fallback">LPQ</span>
    ) : (
      <img src={logoUrl} alt="Logo LPQ Al-Fath Maulana" onError={() => setLogoFailed(true)} />
    )}
    <span className="font-cinzel">
      LPQ Al-Fath Maulana
      <small>Metode Qiroati</small>
    </span>
  </Link>
);

const DesktopNav = ({ pathname }) => (
  <div className="navbar-desktop-nav" aria-label="Navigasi utama">
    {navGroups.map((group) => group.to ? (
      <Link key={group.label} to={group.to} className={isActivePath(pathname, group.to) ? 'is-active' : ''}>
        {group.label}
      </Link>
    ) : (
      <div key={group.label} className="navbar-dropdown">
        <button type="button" aria-haspopup="true" className="lpq-shiny-button">
          {group.label}
          <ChevronDown className="h-4 w-4" />
        </button>
        <div className="navbar-dropdown__panel">
          {group.items.map((item) => (
            <Link key={item.to} to={item.to} className={isActivePath(pathname, item.to) ? 'is-active' : ''}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mobileDropdown, setMobileDropdown] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [logoUrl, setLogoUrl] = useState('/logo-lpq-al-fath-maulana.webp');
  const [logoFailed, setLogoFailed] = useState(false);
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let mounted = true;
    const fetchLogo = async () => {
      const { data } = await supabase.from('website_content').select('content').eq('key', 'logoUrl').maybeSingle();
      if (mounted && data?.content) {
        setLogoFailed(false);
        setLogoUrl(data.content);
      }
    };
    fetchLogo();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    setIsOpen(false);
    setMobileDropdown('');
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <nav className={`navbar-shell ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="navbar-shell__inner">
        <GlassSurface
          width="100%"
          height={72}
          borderRadius={24}
          borderWidth={0.06}
          brightness={55}
          opacity={scrolled ? 0.94 : 0.88}
          blur={scrolled ? 14 : 10}
          displace={1}
          backgroundOpacity={scrolled ? 0.16 : 0.08}
          saturation={1.25}
          distortionScale={-110}
          redOffset={2}
          greenOffset={7}
          blueOffset={12}
          mixBlendMode="screen"
          className="navbar-glass"
        >
          <div className="navbar-content">
            <NavbarLogo logoUrl={logoUrl} logoFailed={logoFailed} setLogoFailed={setLogoFailed} />
            <DesktopNav pathname={location.pathname} />
            <div className="navbar-actions">
              {user ? (
                <>
                  <Button asChild variant="ghost" size="icon" className="navbar-icon-button"><Link to="/dashboard" aria-label="Dashboard"><LayoutDashboard className="h-5 w-5" /></Link></Button>
                  <Button onClick={handleLogout} variant="ghost" size="icon" className="navbar-icon-button is-danger" aria-label="Logout"><LogOut className="h-5 w-5" /></Button>
                </>
              ) : (
                <Button asChild className="navbar-login"><Link to="/login">Login</Link></Button>
              )}
              <Button onClick={toggleTheme} variant="ghost" size="icon" className="navbar-icon-button" aria-label="Ubah tema">
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </div>
            <div className="navbar-mobile-actions">
              <Button onClick={toggleTheme} variant="ghost" size="icon" className="navbar-icon-button" aria-label="Ubah tema">
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <Button onClick={() => setIsOpen((value) => !value)} variant="ghost" size="icon" className="navbar-icon-button" aria-label="Buka menu" aria-expanded={isOpen}>
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </GlassSurface>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="navbar-mobile-drawer"
          >
            <div className="navbar-mobile-drawer__panel">
              {navGroups.map((group) => group.to ? (
                <Link key={group.label} to={group.to} className={isActivePath(location.pathname, group.to) ? 'is-active' : ''}>{group.label}</Link>
              ) : (
                <div key={group.label} className="navbar-mobile-group">
                  <button type="button" onClick={() => setMobileDropdown(mobileDropdown === group.label ? '' : group.label)} className="lpq-shiny-button">
                    {group.label}
                    <ChevronDown className={`h-4 w-4 ${mobileDropdown === group.label ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileDropdown === group.label && (
                    <div>
                      {group.items.map((item) => <Link key={item.to} to={item.to}>{item.label}</Link>)}
                    </div>
                  )}
                </div>
              ))}
              <div className="navbar-mobile-session">
                {user ? (
                  <>
                    <Button asChild className="w-full"><Link to="/dashboard">Dashboard</Link></Button>
                    <Button onClick={handleLogout} variant="outline" className="w-full border-red-200 text-red-700">Logout</Button>
                  </>
                ) : (
                  <Button asChild className="w-full"><Link to="/login">Login</Link></Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
