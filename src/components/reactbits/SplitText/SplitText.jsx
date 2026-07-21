import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import './SplitText.css';

const easingMap = {
  'power3.out': [0.22, 1, 0.36, 1],
  'power2.out': [0.16, 1, 0.3, 1],
  'expo.out': [0.19, 1, 0.22, 1],
};

const getTransitionEase = (ease) => easingMap[ease] || ease || [0.22, 1, 0.36, 1];

const splitText = (text, splitType) => {
  if (splitType === 'chars') {
    return Array.from(text).map((part, index) => ({
      id: `${part}-${index}`,
      value: part,
      className: part === ' ' ? 'rb-split-space' : 'rb-split-char',
    }));
  }

  if (splitType === 'words, chars') {
    const pieces = [];
    String(text).split(/(\s+)/).forEach((word, wordIndex) => {
      if (/^\s+$/.test(word)) {
        pieces.push({ id: `space-${wordIndex}`, value: word, className: 'rb-split-space' });
        return;
      }
      pieces.push({
        id: `word-${wordIndex}`,
        value: Array.from(word),
        className: 'rb-split-word rb-split-word--chars',
      });
    });
    return pieces;
  }

  return String(text).split(/(\s+)/).filter(Boolean).map((part, index) => ({
    id: `${part}-${index}`,
    value: part,
    className: /^\s+$/.test(part) ? 'rb-split-space' : 'rb-split-word',
  }));
};

const SplitText = ({
  text = '',
  className = '',
  delay = 50,
  duration = 1.25,
  ease = 'power3.out',
  splitType = 'words',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  textAlign = 'left',
  tag,
  as,
  onLetterAnimationComplete,
}) => {
  const reducedMotion = useReducedMotion();
  const Tag = tag || as || 'span';
  const pieces = useMemo(() => splitText(text, splitType), [text, splitType]);

  if (reducedMotion || !text) {
    return <Tag className={`split-parent ${className}`} style={{ textAlign }}>{text}</Tag>;
  }

  let animatedIndex = 0;

  return (
    <Tag className={`split-parent rb-split-text ${className}`} style={{ textAlign }} aria-label={text}>
      {pieces.map((piece) => {
        if (piece.className === 'rb-split-space') {
          return <span key={piece.id} aria-hidden="true" className="rb-split-space">&nbsp;</span>;
        }

        if (Array.isArray(piece.value)) {
          return (
            <span key={piece.id} aria-hidden="true" className={piece.className}>
              {piece.value.map((char, charIndex) => {
                const currentIndex = animatedIndex;
                animatedIndex += 1;
                return (
                  <motion.span
                    key={`${piece.id}-${char}-${charIndex}`}
                    className="rb-split-char"
                    initial={from}
                    animate={to}
                    transition={{
                      duration,
                      delay: (delay / 1000) * currentIndex,
                      ease: getTransitionEase(ease),
                    }}
                    onAnimationComplete={() => {
                      if (currentIndex === pieces.length - 1) onLetterAnimationComplete?.();
                    }}
                  >
                    {char}
                  </motion.span>
                );
              })}
            </span>
          );
        }

        const currentIndex = animatedIndex;
        animatedIndex += 1;
        return (
          <motion.span
            key={piece.id}
            aria-hidden="true"
            className={piece.className}
            initial={from}
            animate={to}
            transition={{
              duration,
              delay: (delay / 1000) * currentIndex,
              ease: getTransitionEase(ease),
            }}
            onAnimationComplete={() => {
              if (currentIndex === pieces.length - 1) onLetterAnimationComplete?.();
            }}
          >
            {piece.value}
          </motion.span>
        );
      })}
    </Tag>
  );
};

export default SplitText;
