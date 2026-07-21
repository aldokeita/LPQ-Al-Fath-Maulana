import React from 'react';
import './StarBorder.css';

const StarBorder = ({ children, className = '', as: Component = 'div' }) => (
  <Component className={`rb-star-border ${className}`}>
    <span className="rb-star-border__spark spark-a" />
    <span className="rb-star-border__spark spark-b" />
    <span className="rb-star-border__content">{children}</span>
  </Component>
);

export default StarBorder;
