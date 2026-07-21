import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  Clock,
  Send,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { submitPublicFeedback, getPublicContentErrorMessage } from '@/lib/publicContentAdapters';
import { OFFICIAL_CONTACT } from '@/lib/institutionContent';
import '@/styles/public-contact.css';

/* ---------- Animation Variants ---------- */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/* ======================================== */
/*            MAIN COMPONENT                */
/* ======================================== */

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await submitPublicFeedback(formData);
      toast({
        title: 'Pesan Terkirim!',
        description: 'Terima kasih atas masukan Anda. Kami akan segera merespons.',
      });
      setFormData({ name: '', email: '', phone: '', message: '' });
    } catch (error) {
      toast({
        title: 'Gagal Mengirim',
        description: getPublicContentErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Helmet>
        <title>Kontak - LPQ Al-Fath Maulana</title>
        <meta
          name="description"
          content="Alamat, WhatsApp, telepon, email, dan lokasi resmi LPQ Al-Fath Maulana di Baturaja."
        />
        <link rel="canonical" href={`${OFFICIAL_CONTACT.website}/kontak`} />
      </Helmet>

      <div className="cp-page">
        {/* ── HERO ──────────────────────────────────────────── */}
        <section className="cp-hero" aria-labelledby="cp-hero-title">
          <motion.div
            className="cp-hero__inner"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <span className="cp-hero__badge">
              <MessageCircle className="w-3.5 h-3.5" />
              Hubungi Kami
            </span>
            <h1 id="cp-hero-title" className="cp-hero__title">
              Kami Siap{' '}
              <span className="cp-hero__title-accent">Membantu Anda</span>
            </h1>
            <p className="cp-hero__desc">
              Punya pertanyaan tentang pendaftaran, jadwal mengaji, atau informasi lainnya?
              Pilih cara yang paling nyaman untuk menghubungi kami.
            </p>
          </motion.div>
        </section>

        <div className="cp-container">
          {/* ── QUICK CHANNELS ─────────────────────────────── */}
          <section className="cp-channels" aria-label="Kontak cepat">
            <motion.div
              className="cp-channels__grid"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
            >
              <motion.a
                className="cp-channel-card"
                variants={staggerItem}
                aria-label={`Hubungi WhatsApp ${OFFICIAL_CONTACT.phone}`}
                href={OFFICIAL_CONTACT.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="cp-channel-card__icon cp-channel-card__icon--emerald" aria-hidden="true">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="cp-channel-card__label">WhatsApp</p>
                  <p className="cp-channel-card__value">{OFFICIAL_CONTACT.phone}</p>
                </div>
              </motion.a>

              <motion.a
                className="cp-channel-card"
                variants={staggerItem}
                aria-label={`Telepon ${OFFICIAL_CONTACT.phone}`}
                href={OFFICIAL_CONTACT.phoneHref}
              >
                <div className="cp-channel-card__icon cp-channel-card__icon--cyan" aria-hidden="true">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="cp-channel-card__label">Telepon</p>
                  <p className="cp-channel-card__value">{OFFICIAL_CONTACT.phone}</p>
                </div>
              </motion.a>

              <motion.a
                className="cp-channel-card"
                variants={staggerItem}
                aria-label={`Kirim email ke ${OFFICIAL_CONTACT.email}`}
                href={OFFICIAL_CONTACT.emailHref}
              >
                <div className="cp-channel-card__icon cp-channel-card__icon--amber" aria-hidden="true">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="cp-channel-card__label">Email</p>
                  <p className="cp-channel-card__value">{OFFICIAL_CONTACT.email}</p>
                </div>
              </motion.a>
            </motion.div>
          </section>

          <hr className="cp-divider" />

          {/* ── SPLIT: Info + Form ─────────────────────────── */}
          <section className="cp-split" aria-labelledby="cp-split-title">
            <motion.div
              className="cp-section-header"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <p className="cp-section-header__kicker">
                Informasi & Pesan
              </p>
              <h2 id="cp-split-title" className="cp-section-header__title">
                Kunjungi atau Kirim Pesan
              </h2>
              <p className="cp-section-header__desc">
                Kunjungi kami langsung atau kirim pesan melalui formulir di bawah ini.
              </p>
            </motion.div>

            <motion.div
              className="cp-split__grid"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={staggerContainer}
            >
              {/* Info Panel */}
              <motion.div className="cp-info-panel" variants={staggerItem}>
                <h3 className="cp-info-panel__title">Informasi Kontak</h3>

                <div className="cp-info-item">
                  <div className="cp-info-item__icon" aria-hidden="true">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="cp-info-item__label">Alamat</p>
                    <p className="cp-info-item__value">
                      {OFFICIAL_CONTACT.address}
                    </p>
                  </div>
                </div>

                <div className="cp-info-item">
                  <div className="cp-info-item__icon" aria-hidden="true">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="cp-info-item__label">Telepon</p>
                    <p className="cp-info-item__value">
                      <a href={OFFICIAL_CONTACT.phoneHref}>{OFFICIAL_CONTACT.phone}</a>
                    </p>
                  </div>
                </div>

                <div className="cp-info-item">
                  <div className="cp-info-item__icon" aria-hidden="true">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="cp-info-item__label">Email</p>
                    <p className="cp-info-item__value">
                      <a href={OFFICIAL_CONTACT.emailHref}>{OFFICIAL_CONTACT.email}</a>
                    </p>
                  </div>
                </div>

                <div className="cp-info-item">
                  <div className="cp-info-item__icon" aria-hidden="true">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="cp-info-item__label">Jadwal TPQ</p>
                    <p className="cp-info-item__value">
                      Senin–Jumat, sesi pagi, siang, dan sore
                    </p>
                  </div>
                </div>

              </motion.div>

              {/* Form Panel */}
              <motion.div className="cp-form-panel" variants={staggerItem}>
                <h3 className="cp-form-panel__title">Kirim Pesan</h3>
                <p className="cp-form-panel__desc">
                  Isi formulir berikut dan kami akan membalas secepatnya.
                </p>
                <form onSubmit={handleSubmit} noValidate>
                  <div className="cp-form-field">
                    <label htmlFor="cp-name">Nama Lengkap</label>
                    <Input
                      id="cp-name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>
                  <div className="cp-form-field">
                    <label htmlFor="cp-email">Email</label>
                    <Input
                      id="cp-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="cp-form-field">
                    <label htmlFor="cp-phone">No. Telepon / WhatsApp</label>
                    <Input
                      id="cp-phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      required
                      autoComplete="tel"
                    />
                  </div>
                  <div className="cp-form-field">
                    <label htmlFor="cp-message">Pesan</label>
                    <Textarea
                      id="cp-message"
                      value={formData.message}
                      onChange={(e) => updateField('message', e.target.value)}
                      rows={5}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="cp-submit-btn"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      'Mengirim...'
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Kirim Pesan
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          </section>

          <hr className="cp-divider" />

          {/* ── MAP ──────────────────────────────────────────── */}
          <section className="cp-map" aria-labelledby="cp-map-title">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              <div className="cp-map__card">
                <div className="cp-map__header">
                  <h2 id="cp-map-title" className="cp-map__title">
                    <MapPin className="w-4 h-4" aria-hidden="true" />
                    Lokasi Kami
                  </h2>
                  <a className="cp-map__open-link" href={OFFICIAL_CONTACT.mapUrl} target="_blank" rel="noopener noreferrer">Buka di Google Maps</a>
                </div>
                <div className="cp-map__iframe-wrap">
                  <a className="flex min-h-64 items-center justify-center px-6 text-center text-slate-600" href={OFFICIAL_CONTACT.mapUrl} target="_blank" rel="noopener noreferrer">
                    <span><MapPin className="mx-auto mb-3 h-8 w-8" />{OFFICIAL_CONTACT.address}</span>
                  </a>
                </div>
              </div>
            </motion.div>
          </section>

          {/* ── CTA ─────────────────────────────────────────── */}
          <section className="cp-cta" aria-labelledby="cp-cta-title">
            <motion.div
              className="cp-cta__card"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
            >
              <h2 id="cp-cta-title" className="cp-cta__title">
                Lebih Nyaman Chat Langsung?
              </h2>
              <p className="cp-cta__desc">
                Kirim pesan WhatsApp kami untuk respons yang lebih cepat mengenai
                pendaftaran, jadwal, atau pertanyaan lainnya.
              </p>
              <div className="cp-cta__actions">
                <a className="cp-cta__btn cp-cta__btn--primary" href={OFFICIAL_CONTACT.whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-4 h-4" />
                  Chat WhatsApp
                </a>
                <a className="cp-cta__btn cp-cta__btn--secondary" href={OFFICIAL_CONTACT.mapUrl} target="_blank" rel="noopener noreferrer">
                  <MapPin className="w-4 h-4" />
                  Lihat Lokasi
                </a>
              </div>
            </motion.div>
          </section>
        </div>
      </div>
    </>
  );
};

export default ContactPage;
