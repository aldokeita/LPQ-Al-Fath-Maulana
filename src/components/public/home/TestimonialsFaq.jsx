import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import EmptyState from './EmptyState';
import SectionKicker from './SectionKicker';
import { safeArray, sectionReveal } from './homeUtils';

const TestimonialsFaq = ({ proofPoints, faqs }) => (
  <section className="home-trust" aria-labelledby="home-trust-title">
    <div className="home-section-grid">
      <motion.div {...sectionReveal()} className="home-trust__panel">
        <SectionKicker>Bukti pendampingan</SectionKicker>
        <h2 id="home-trust-title">Alasan keluarga memilih LPQ Al-Fath Maulana.</h2>
        <div className="home-testimonials">
          {safeArray(proofPoints).length > 0 ? safeArray(proofPoints).slice(0, 3).map((item, index) => (
            <article className="home-proof-card" key={item.id || index}>
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          )) : (
            <EmptyState title="Informasi keunggulan belum tersedia" description="Informasi akan diperbarui setelah diverifikasi lembaga." />
          )}
        </div>
      </motion.div>
      <motion.div {...sectionReveal(1)} className="home-faq">
        {safeArray(faqs).length > 0 ? safeArray(faqs).slice(0, 5).map((faq, index) => (
          <details key={faq.id || index}>
            <summary>{faq.question}<ArrowRight className="h-4 w-4" /></summary>
            <p>{faq.answer}</p>
          </details>
        )) : (
          <EmptyState title="FAQ belum tersedia" description="Pertanyaan umum akan tampil setelah dikelola admin." />
        )}
      </motion.div>
    </div>
  </section>
);

export default TestimonialsFaq;
