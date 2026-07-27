import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'a', 'blockquote', 'br', 'em', 'h1', 'h2', 'h3', 'h4', 'img',
  'li', 'ol', 'p', 's', 'strong', 'u', 'ul',
];

const ALLOWED_ATTRIBUTES = ['alt', 'href', 'rel', 'src', 'target'];
const SAFE_URL_PATTERN = /^(?:(?:https?|mailto|tel):|\/|#)/i;

export const sanitizeRichText = (html, windowObject = globalThis.window) => {
  const input = typeof html === 'string' ? html : '';
  if (!windowObject?.document) return '';

  const purifier = DOMPurify(windowObject);
  if (!purifier.isSupported) return '';
  purifier.addHook('uponSanitizeAttribute', (_node, data) => {
    if ((data.attrName === 'href' || data.attrName === 'src') && !SAFE_URL_PATTERN.test(data.attrValue || '')) {
      data.keepAttr = false;
    }
  });

  const sanitized = purifier.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRIBUTES,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    FORBID_TAGS: ['form', 'iframe', 'math', 'object', 'script', 'style', 'svg', 'template'],
    FORBID_ATTR: ['srcdoc', 'style'],
    ALLOWED_URI_REGEXP: SAFE_URL_PATTERN,
  });
  purifier.removeAllHooks();
  return sanitized;
};
