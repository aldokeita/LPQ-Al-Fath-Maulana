import assert from 'node:assert/strict';
import {
  isValidWhatsAppGroupLink,
  normalizeWhatsAppGroupLink,
  normalizeWhatsAppGroupLinkEntries,
  validateWhatsAppGroupLinks,
} from '../src/lib/whatsappGroupLinksValidation.js';

const sharedInvite = 'https://chat.whatsapp.com/AbC_123-xyz';
const copiedInvite = `${sharedInvite}?mode=ems_copy_t#share`;

assert.equal(normalizeWhatsAppGroupLink(copiedInvite), sharedInvite);
assert.equal(normalizeWhatsAppGroupLink(`${sharedInvite}/`), sharedInvite);
assert.equal(isValidWhatsAppGroupLink(copiedInvite), true);
assert.equal(isValidWhatsAppGroupLink(''), false);

assert.doesNotThrow(() => validateWhatsAppGroupLinks({
  'Pra TK A': copiedInvite,
  'Pra TK B': copiedInvite,
  'Pra TK C': copiedInvite,
  'Jilid 1A': sharedInvite,
  'Jilid 1B': sharedInvite,
  'Jilid 1C': sharedInvite,
}));

const repeatedEntries = normalizeWhatsAppGroupLinkEntries({
  'Pra TK A': copiedInvite,
  'Pra TK B': copiedInvite,
  'Pra TK C': copiedInvite,
});
assert.equal(repeatedEntries.length, 3);
assert.deepEqual(repeatedEntries.map(([, link]) => link), [sharedInvite, sharedInvite, sharedInvite]);

assert.throws(
  () => validateWhatsAppGroupLinks({ 'Pra TK A': 'https://wa.me/628123456789' }),
  /Pra TK A/,
);
assert.throws(
  () => validateWhatsAppGroupLinks({ 'Pra TK A': `${sharedInvite}/extra` }),
  /Pra TK A/,
);

console.log('WhatsApp group link validation tests passed.');
