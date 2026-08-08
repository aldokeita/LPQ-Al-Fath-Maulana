import { supabase } from '@/lib/customSupabaseClient';
import {
  normalizeWhatsAppGroupLinkEntries,
  validateWhatsAppGroupLinks,
} from '@/lib/whatsappGroupLinksValidation';

export {
  isValidWhatsAppGroupLink,
  validateWhatsAppGroupLinks,
} from '@/lib/whatsappGroupLinksValidation';

export const WHATSAPP_JILID_OPTIONS = Object.freeze([
  'Pra TK A', 'Pra TK B', 'Pra TK C',
  'Jilid 1A', 'Jilid 1B', 'Jilid 1C',
  'Jilid 2A', 'Jilid 2B',
  'Jilid 3A', 'Jilid 3B',
  'Jilid 4A', 'Jilid 4B',
  'Jilid 5A', 'Jilid 5B',
  'Jilid Juz 27',
  'Jilid 6A', 'Jilid 6B',
  "Al-Qur'an", 'Ghorib Tajwid', 'Finishing',
]);

export const normalizeWhatsAppGroupLinks = (rows = []) => Object.fromEntries(
  rows
    .filter((row) => row?.jilid && row?.is_active !== false)
    .map((row) => [row.jilid, row.whatsapp_link || '']),
);

export const fetchWhatsAppGroupLinks = async () => {
  const { data, error } = await supabase
    .from('whatsapp_group_links')
    .select('id, jilid, group_name, whatsapp_link, is_active')
    .order('jilid', { ascending: true });

  if (error) throw error;
  return normalizeWhatsAppGroupLinks(data);
};

export const fetchWhatsAppGroupLink = async (jilid) => {
  if (!jilid) return '';

  const { data, error } = await supabase
    .from('whatsapp_group_links')
    .select('whatsapp_link')
    .eq('jilid', jilid)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data?.whatsapp_link || '';
};

export const saveWhatsAppGroupLinks = async (links = {}) => {
  validateWhatsAppGroupLinks(links);

  const { data: { user } } = await supabase.auth.getUser();
  const normalizedEntries = normalizeWhatsAppGroupLinkEntries(links);
  const activeRows = normalizedEntries
    .filter(([, link]) => Boolean(link))
    .map(([jilid, whatsappLink]) => ({
      jilid,
      group_name: `Grup ${jilid}`,
      whatsapp_link: whatsappLink,
      is_active: true,
      updated_by: user?.id || null,
    }));
  const inactiveJilid = normalizedEntries.filter(([, link]) => !link).map(([jilid]) => jilid);

  if (activeRows.length) {
    const { error } = await supabase
      .from('whatsapp_group_links')
      .upsert(activeRows, { onConflict: 'jilid' });
    if (error) throw error;
  }

  if (inactiveJilid.length) {
    const { error } = await supabase
      .from('whatsapp_group_links')
      .update({ is_active: false, updated_by: user?.id || null })
      .in('jilid', inactiveJilid);
    if (error) throw error;
  }

  return fetchWhatsAppGroupLinks();
};
