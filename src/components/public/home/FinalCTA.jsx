import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import StarBorder from '@/components/reactbits/StarBorder/StarBorder';
import SectionKicker from './SectionKicker';
import { imageOf, safeArray, sectionReveal } from './homeUtils';

const FinalCTA = ({ content, formData, setFormData, onSubmit, sending }) => {
  const background = content.ctaBackgroundUrl || imageOf(safeArray(content.heroSlides)[0]);

  return (
    <section className="home-final-cta" aria-labelledby="home-final-title">
      {background && <img className="home-final-cta__image" src={background} alt="" loading="lazy" />}
      <div className="home-final-cta__veil" />
      <div className="home-final-cta__inner">
        <motion.div {...sectionReveal()}>
          <SectionKicker dark>Langkah berikutnya</SectionKicker>
          <h2 id="home-final-title">Datang, bertanya, lalu mulai perjalanan belajar.</h2>
          <p>
            Wali santri dapat melihat informasi pendaftaran atau mengirim pertanyaan langsung ke LPQ.
            Kami menyiapkan jalur yang jelas agar keputusan terasa lebih mudah.
          </p>
          <div className="home-final-cta__actions">
            <StarBorder as="span"><Button asChild size="lg" className="home-primary-cta"><Link to="/pendaftaran/informasi">Informasi Pendaftaran</Link></Button></StarBorder>
            <Button asChild size="lg" variant="outline" className="home-secondary-cta"><Link to="/kontak">Kontak LPQ</Link></Button>
          </div>
        </motion.div>
        <motion.form {...sectionReveal(1)} onSubmit={onSubmit} className="home-feedback-form">
          <h3>Kirim pesan ke LPQ</h3>
          <Input placeholder="Nama lengkap" value={formData.nama} onChange={(event) => setFormData({ ...formData, nama: event.target.value })} required />
          <Input type="email" placeholder="Email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} required />
          <Input type="tel" placeholder="Nomor WhatsApp" value={formData.no_hp} onChange={(event) => setFormData({ ...formData, no_hp: event.target.value })} required />
          <Textarea placeholder="Pesan atau pertanyaan" rows={5} value={formData.pesan} onChange={(event) => setFormData({ ...formData, pesan: event.target.value })} required />
          <Button type="submit" disabled={sending} className="home-form-button">
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Kirim pesan
          </Button>
        </motion.form>
      </div>
    </section>
  );
};

export default FinalCTA;
