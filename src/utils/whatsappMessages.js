
/**
 * Utility functions for generating WhatsApp messages for Jilid promotions/demotions
 */

// Mapping of Jilid names to WhatsApp group links
export const WHATSAPP_GROUP_LINKS = {
  'Pra TK': '[Link Grup Belum Tersedia]',
  'Jilid 1': '[Link Grup Belum Tersedia]',
  'Jilid 2': '[Link Grup Belum Tersedia]',
  'Jilid 3': '[Link Grup Belum Tersedia]',
  'Jilid 4': '[Link Grup Belum Tersedia]',
  'Jilid 5': '[Link Grup Belum Tersedia]',
  'Jilid 6': '[Link Grup Belum Tersedia]',
  'Al-Qur\'an': '[Link Grup Belum Tersedia]',
  'Gharib': '[Link Grup Belum Tersedia]',
  'Tajwid': '[Link Grup Belum Tersedia]',
};

/**
 * Helper to get link from mapping, falling back to provided link or default message
 */
export const resolveWhatsAppGroupLink = (jilidName, providedLink) => {
  if (providedLink && providedLink !== '[Link Grup Belum Tersedia]') return providedLink;

  // Normalize key lookup
  const key = Object.keys(WHATSAPP_GROUP_LINKS).find(k => jilidName?.includes(k));
  return key ? WHATSAPP_GROUP_LINKS[key] : '[Link Grup Belum Tersedia]';
};

/**
 * Generates a formatted WhatsApp link
 * @param {string} phoneNumber - The phone number (will be sanitized)
 * @param {string} message - The text message
 * @returns {string} - Full WhatsApp URL
 */
export const generateWhatsAppLink = (phoneNumber, message) => {
  if (!phoneNumber) return '#';

  // Sanitize phone number: remove non-digits, ensure starts with 62 or appropriate code if needed.
  let cleanNumber = phoneNumber.replace(/\D/g, '');
  if (cleanNumber.startsWith('0')) {
    cleanNumber = '62' + cleanNumber.slice(1);
  }

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
};

/**
 * Generates a message for Jilid promotion
 * @param {string} santriName
 * @param {string} newJilidName
 * @param {string} newJilidLink
 * @returns {string}
 */
export const generateJilidPromotionMessage = (santriName, newJilidName, newJilidLink) => {
  const finalLink = resolveWhatsAppGroupLink(newJilidName, newJilidLink);

  return `Assalamualaikum Warahmatullahi Wabarakatuh,

Alhamdulillah, Barakallahu fikum Ayah/Bunda.

Kami sampaikan kabar baik bahwa berdasarkan hasil evaluasi pembelajaran, ananda *${santriName}* dinyatakan **LULUS** dan berhak melanjutkan pembelajaran ke *${newJilidName}*.

Untuk mengikuti informasi dan materi pembelajaran sesuai jenjang terbaru, silakan Ayah/Bunda bergabung ke Grup WhatsApp berikut:
${finalLink}

_Catatan: Ayah/Bunda dipersilakan keluar dari grup jilid sebelumnya setelah berhasil bergabung di grup yang baru. Atau bertahan di grup jilid sebelumnya jika masih ada Saudara/i nya._

Semoga Allah ﷻ senantiasa memberkahi langkah ananda dalam belajar Al-Qur'an, menjadikannya anak yang sholeh/sholehah, serta istiqomah dalam menuntut ilmu.

Wassalamualaikum Warahmatullahi Wabarakatuh,
*Admin LPQ Al-Fath Maulana*`;
};

/**
 * Generates a message for Jilid demotion (repetition)
 * @param {string} santriName
 * @param {string} jilidName
 * @param {string} jilidLink
 * @returns {string}
 */
export const generateJilidDemotionMessage = (santriName, jilidName, jilidLink) => {
  const finalLink = resolveWhatsAppGroupLink(jilidName, jilidLink);

  return `Assalamualaikum Warahmatullahi Wabarakatuh,

Ayah/Bunda yang kami hormati,

Berdasarkan hasil evaluasi pembelajaran terakhir, ananda *${santriName}* perlu **mengulang kembali pembelajaran di *${jilidName}***.

Keputusan ini diambil sebagai bentuk ikhtiar bersama agar bacaan ananda semakin lancar, tepat makhraj, dan lebih mutqin sebelum melanjutkan ke jenjang berikutnya.

Untuk kelancaran komunikasi dan pendampingan belajar, silakan Ayah/Bunda bergabung ke Grup WhatsApp Jilid terkait melalui tautan berikut:
${finalLink}

Kami mohon dukungan Ayah/Bunda untuk terus memotivasi ananda. Insya Allah, dengan kesabaran dan ketekunan, hasil terbaik akan Allah ﷻ berikan pada waktunya.

Semoga ananda tumbuh menjadi generasi Qur'ani yang sholeh/sholehah dan berakhlak mulia.

Wassalamualaikum Warahmatullahi Wabarakatuh,
*Admin LPQ Al-Fath Maulana*`;
};
