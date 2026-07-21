const JAKARTA_TIME_ZONE = 'Asia/Jakarta';

const parseDateOnly = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

export const getJakartaDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read('year'), month: read('month'), day: read('day') };
};

export const getBirthdayToday = (students = [], date = new Date()) => {
  const today = getJakartaDateParts(date);
  return students
    .map((student) => ({ student, birthDate: parseDateOnly(student.tanggal_lahir) }))
    .filter(({ birthDate }) => birthDate?.month === today.month && birthDate?.day === today.day)
    .map(({ student, birthDate }) => ({
      ...student,
      age: Math.max(0, today.year - birthDate.year),
    }));
};

export const getBirthdaysThisMonth = (people = [], date = new Date()) => {
  const today = getJakartaDateParts(date);
  return people
    .map((person) => ({ person, birthDate: parseDateOnly(person.tanggal_lahir) }))
    .filter(({ birthDate }) => birthDate?.month === today.month)
    .map(({ person, birthDate }) => ({
      ...person,
      age: Math.max(0, today.year - birthDate.year),
      birthdayDay: birthDate.day,
      isBirthdayToday: birthDate.day === today.day,
    }))
    .sort((a, b) => {
      const aUpcoming = a.birthdayDay >= today.day;
      const bUpcoming = b.birthdayDay >= today.day;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      return a.birthdayDay - b.birthdayDay;
    });
};

export const normalizeIndonesianPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
};

export const buildBirthdayWhatsappUrl = (person, audience = 'santri') => {
  const phone = normalizeIndonesianPhone(person?.no_hp_ortu || person?.no_hp);
  if (!phone) return '';
  const name = String(person?.nama_lengkap || person?.nama || 'Ananda').trim();
  const ageText = Number.isFinite(Number(person?.age)) ? ` yang hari ini berusia ${person.age} tahun` : '';
  const message = audience === 'guru'
    ? `Assalamu'alaikum ${name}. Barakallah fii umrik${ageText}. Semoga Allah memberi kesehatan, keberkahan usia, dan kemudahan dalam mendampingi para santri belajar Al-Qur'an. Aamiin.`
    : `Assalamu'alaikum Bapak/Ibu wali ${name}. Barakallah fii umrik untuk ${name}${ageText}. Semoga Allah memberi kesehatan, keberkahan usia, serta memudahkan dan mengistiqamahkan Ananda dalam belajar Al-Qur'an. Aamiin.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};
