import { supabase } from '@/lib/customSupabaseClient';

export const transferSantriClass = ({ santriId, toClassId, reason }) => {
  if (toClassId == null) {
    return supabase.rpc('remove_santri_from_class', {
      p_santri_id: santriId,
      p_reason: reason,
    });
  }
  return supabase.rpc('move_santri_to_class', {
    p_santri_id: santriId,
    p_to_class_id: toClassId,
    p_reason: reason,
  });
};
