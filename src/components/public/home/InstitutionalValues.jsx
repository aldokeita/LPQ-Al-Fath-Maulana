import React from 'react';
import { BookOpen, CheckCircle2, HeartHandshake, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import BorderGlow from '@/components/reactbits/BorderGlow/BorderGlow';
import SectionKicker from './SectionKicker';
import { imageOf, safeArray, sectionReveal } from './homeUtils';

const values = [
  {
    icon: BookOpen,
    color: 'emerald',
    title: 'Bacaan yang tartil',
    text: 'Santri dibimbing bertahap agar bacaan benar, jelas, dan konsisten.',
  },
  {
    icon: ShieldCheck,
    color: 'amber',
    title: 'Adab yang dijaga',
    text: 'Kebiasaan baik dibentuk lewat rutinitas kelas yang hangat dan disiplin.',
  },
  {
    icon: HeartHandshake,
    color: 'cyan',
    title: 'Guru mendampingi',
    text: 'Proses belajar terasa dekat karena guru mengenal perjalanan santri.',
  },
  {
    icon: CheckCircle2,
    color: 'emerald',
    title: 'Perkembangan terpantau',
    text: 'Informasi kelas, absensi, dan kegiatan tersusun agar wali lebih tenang.',
  },
];

const InstitutionalValues = ({ content }) => {
  const storyImage = imageOf(safeArray(content.facilities)[0]) || imageOf(safeArray(content.heroSlides)[0]);

  return (
    <section className="home-values" aria-labelledby="home-values-title">
      <div className="home-section-grid">
        <motion.div {...sectionReveal(0)} className="home-values__intro">
          <SectionKicker>Identitas LPQ</SectionKicker>
          <h2 id="home-values-title">Belajar Al-Qur’an sebagai perjalanan keluarga.</h2>
          <p>
            LPQ Al-Fath Maulana menyatukan pembinaan bacaan, adab, dan komunikasi lembaga
            agar wali santri memahami proses belajar dengan lebih tenang.
          </p>
          <div className="home-values__image">
            {storyImage ? <img src={storyImage} alt="Suasana kegiatan LPQ Al-Fath Maulana" loading="lazy" /> : <span>Foto kegiatan akan tampil saat tersedia.</span>}
          </div>
        </motion.div>
        <div className="home-values__cards">
          {values.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div key={item.title} {...sectionReveal(index + 1, index % 2 ? 'x' : 'y')}>
                <BorderGlow
                  color={item.color}
                  className="home-value-card"
                  edgeSensitivity={46}
                  glowRadius={22}
                  glowIntensity={0.32}
                  fillOpacity={0.12}
                  coneSpread={16}
                  animated
                  backgroundColor="var(--home-card-bg)"
                >
                  <Icon className="h-6 w-6" />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </BorderGlow>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default InstitutionalValues;
