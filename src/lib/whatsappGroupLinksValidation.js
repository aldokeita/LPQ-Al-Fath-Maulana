const WHATSAPP_GROUP_HOST = 'chat.whatsapp.com';
const WHATSAPP_INVITE_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

export const normalizeWhatsAppGroupLink = (link) => {
  const rawLink = String(link || '').trim();
  if (!rawLink) return '';

  try {
    const parsed = new URL(rawLink);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const inviteCode = pathParts[0] || '';

    if (
      parsed.protocol !== 'https:'
      || parsed.hostname.toLowerCase() !== WHATSAPP_GROUP_HOST
      || pathParts.length !== 1
      || !WHATSAPP_INVITE_CODE_PATTERN.test(inviteCode)
    ) {
      return '';
    }

    return `https://${WHATSAPP_GROUP_HOST}/${inviteCode}`;
  } catch {
    return '';
  }
};

export const isValidWhatsAppGroupLink = (link) => Boolean(normalizeWhatsAppGroupLink(link));

export const normalizeWhatsAppGroupLinkEntries = (links = {}) => Object.entries(links).map(
  ([jilid, rawLink]) => [jilid, normalizeWhatsAppGroupLink(rawLink)],
);

export const validateWhatsAppGroupLinks = (links = {}) => {
  for (const [jilid, rawLink] of Object.entries(links)) {
    const link = String(rawLink || '').trim();
    if (link && !isValidWhatsAppGroupLink(link)) {
      throw new Error(`Link grup ${jilid} harus menggunakan format https://chat.whatsapp.com/...`);
    }
  }
};
