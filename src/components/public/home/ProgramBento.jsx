import React from 'react';
import { motion } from 'framer-motion';
import MagicBento from '@/components/reactbits/MagicBento/MagicBento';
import SectionKicker from './SectionKicker';
import { getHomepagePrograms, sectionReveal } from './homeUtils';

const ProgramBento = ({ schedules, quotas }) => {
  const programs = getHomepagePrograms({ schedules, quotas });

  return (
    <section className="home-programs" aria-labelledby="home-programs-title">
      <div className="home-container">
        <motion.div {...sectionReveal()} className="home-programs__heading">
          <SectionKicker dark>Program dan ritme belajar</SectionKicker>
          <h2 id="home-programs-title">Informasi penting tersusun seperti peta belajar.</h2>
          <p>
            Wali santri dapat memahami metode, jadwal, kuota, dan alur pendampingan tanpa perlu menebak bagian mana yang harus dibaca lebih dulu.
          </p>
        </motion.div>
        <motion.div {...sectionReveal(1)}>
          <MagicBento
            items={programs}
            textAutoHide={false}
            enableStars
            enableSpotlight
            enableBorderGlow
            enableTilt
            enableMagnetism
            clickEffect
            spotlightRadius={430}
            particleCount={12}
            glowColor="0, 235, 157"
          />
        </motion.div>
      </div>
    </section>
  );
};

export default ProgramBento;
