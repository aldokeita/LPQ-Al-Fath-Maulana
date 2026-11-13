// Format ringan untuk teks jawaban AI: **tebal** jadi segmen tebal; tanda markdown lain dibuang.
export const parseAiInline = (text) => String(text || '')
  .split(/(\*\*[^*\n]+\*\*)/g)
  .filter((part) => part !== '')
  .map((part) => (/^\*\*[^*\n]+\*\*$/.test(part)
    ? { bold: true, text: part.slice(2, -2) }
    : { bold: false, text: part.replace(/`/g, '').replace(/(^|\s)\*(\S[^*\n]*?)\*(?=\s|[.,!?]|$)/g, '$1$2') }));

export const cleanAiLine = (line) => String(line || '').replace(/^#{1,6}\s+/, '').replace(/^\s*[*•]\s+/, '• ');
