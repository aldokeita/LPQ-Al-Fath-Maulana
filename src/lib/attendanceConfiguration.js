import { supabase } from '@/lib/customSupabaseClient';
import {
  ATTENDANCE_CONFIGURATION_KEY,
  normalizeAttendanceConfiguration,
  validateAttendanceConfiguration,
} from '../../supabase/functions/_shared/attendanceConfiguration.js';

export * from '../../supabase/functions/_shared/attendanceConfiguration.js';

export const fetchAttendanceConfiguration = async () => {
  const { data, error } = await supabase.from('website_content').select('content')
    .eq('key', ATTENDANCE_CONFIGURATION_KEY).maybeSingle();
  if (error) throw error;
  return normalizeAttendanceConfiguration(data?.content);
};

export const saveAttendanceConfiguration = async (value) => {
  const configuration = validateAttendanceConfiguration(value);
  const { data, error } = await supabase.from('website_content')
    .upsert({ key: ATTENDANCE_CONFIGURATION_KEY, content: configuration, is_public: true }, { onConflict: 'key' })
    .select('content').single();
  if (error) throw error;
  return normalizeAttendanceConfiguration(data.content);
};
