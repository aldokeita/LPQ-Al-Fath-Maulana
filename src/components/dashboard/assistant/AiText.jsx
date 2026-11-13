import React from 'react';
import { cleanAiLine, parseAiInline } from '@/lib/aiText';

// Teks jawaban AI dengan **tebal** sebagai <strong>; tanpa HTML mentah sehingga aman dari isi apa pun.
const AiText = ({ text }) => (
  <>
    {String(text || '').split('\n').map((line, index, lines) => (
      <React.Fragment key={index}>
        {parseAiInline(cleanAiLine(line)).map((seg, i) => (seg.bold
          ? <strong key={i} className="font-semibold">{seg.text}</strong>
          : <React.Fragment key={i}>{seg.text}</React.Fragment>))}
        {index < lines.length - 1 && '\n'}
      </React.Fragment>
    ))}
  </>
);

export default AiText;
