import React from 'react';
import { Sparkles } from 'lucide-react';

const SectionKicker = ({ children, dark = false }) => (
  <div className={`home-kicker ${dark ? 'is-dark' : ''}`}>
    <Sparkles className="h-4 w-4" />
    {children}
  </div>
);

export default SectionKicker;
