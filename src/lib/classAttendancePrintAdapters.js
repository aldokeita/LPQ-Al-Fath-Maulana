import { fetchWebsiteContentMap, saveWebsiteContentItem } from '@/lib/publicContentAdapters';
import {
  CLASS_ATTENDANCE_PRINT_CONFIG_KEY,
  CLASS_ATTENDANCE_QIROATI_LOGO_KEY,
  normalizeClassAttendancePrintConfig,
} from '@/lib/classAttendancePrintConfig';

export const fetchClassAttendanceAppearance = async () => {
  const content = await fetchWebsiteContentMap({
    keys: [CLASS_ATTENDANCE_PRINT_CONFIG_KEY, CLASS_ATTENDANCE_QIROATI_LOGO_KEY, 'logoUrl'],
    publicOnly: true,
  });

  return {
    config: normalizeClassAttendancePrintConfig(content[CLASS_ATTENDANCE_PRINT_CONFIG_KEY]),
    lpqLogoUrl: typeof content.logoUrl === 'string' && content.logoUrl.trim()
      ? content.logoUrl.trim()
      : '/logo-lpq-al-fath-maulana.webp',
    qiroatiLogoUrl: typeof content[CLASS_ATTENDANCE_QIROATI_LOGO_KEY] === 'string'
      ? content[CLASS_ATTENDANCE_QIROATI_LOGO_KEY].trim()
      : '',
  };
};

export const saveClassAttendancePrintConfig = async (value) => {
  const config = normalizeClassAttendancePrintConfig(value);
  const saved = await saveWebsiteContentItem({
    key: CLASS_ATTENDANCE_PRINT_CONFIG_KEY,
    content: config,
    isPublic: true,
  });
  return normalizeClassAttendancePrintConfig(saved.content);
};
