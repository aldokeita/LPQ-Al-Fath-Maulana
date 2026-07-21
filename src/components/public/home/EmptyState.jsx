import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

const EmptyState = ({ title, description, dark = false }) => (
  <div className={`home-empty-state ${dark ? 'is-dark' : ''}`}>
    <ImageIcon className="mx-auto mb-4 h-10 w-10" />
    <p>{title}</p>
    <span>{description}</span>
  </div>
);

export default EmptyState;
