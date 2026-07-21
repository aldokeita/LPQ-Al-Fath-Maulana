import React from 'react';
import { ArrowRight, Quote } from 'lucide-react';
import { motion } from 'framer-motion';
import EmptyState from './EmptyState';
import SectionKicker from './SectionKicker';
import { safeArray, sectionReveal } from './homeUtils';

const TestimonialsFaq = ({ testimonials, faqs }) => (
  <section className="home-trust" aria-labelledby="home-trust-title">
    <div className="home-section-grid">
      <motion.div {...sectionReveal()} className="home-trust__panel">
        <SectionKicker>Kepercayaan wali</SectionKicker>
        <h2 id="home-trust-title">Suara keluarga dan pertanyaan yang sering muncul.</h2>
        <div className="home-testimonials">
          {safeArray(testimonials).length > 0 ? safeArray(testimonials).slice(0, 3).map((item, index) => (
            <blockquote key={item.id || index}>
              <Quote className="h-5 w-5" />
              <p>“{item.text}”</p>
              <footer>{item.name} {item.role ? `· ${item.role}` : ''}</footer>
            </blockquote>
          )) : (
            <EmptyState title="Testimoni belum tersedia" description="Testimoni akan muncul ketika admin mengisinya." />
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
