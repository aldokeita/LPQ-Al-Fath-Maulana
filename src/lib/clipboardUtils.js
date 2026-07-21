export const copyTextToClipboard = async (value) => {
  const text = String(value ?? '');
  if (!text) throw new Error('EMPTY_CLIPBOARD_VALUE');

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some browsers reject the Clipboard API despite a direct user gesture.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand('copy')) throw new Error('CLIPBOARD_COPY_FAILED');
  } finally {
    textarea.remove();
  }
};
