import { supabase } from '@/lib/customSupabaseClient';
import { badgesForSantri, SANTRI_BADGES_KEY } from '@/lib/santriBadges';

const getCurrentMonthDateRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
        start: firstDay.toLocaleDateString('en-CA'),
        end: nextMonth.toLocaleDateString('en-CA'),
    };
};

export const getSantriMonthlyAttendanceStats = async (santriId) => {
    if (!santriId) return { present: 0, late: 0, absent: 0 };

    const { start, end } = getCurrentMonthDateRange();
    const now = new Date();
    const selectedYear = now.getFullYear();
    const selectedMonth = now.getMonth();
    const today = new Date(selectedYear, selectedMonth, now.getDate());
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const endInclusive = new Date(selectedYear, selectedMonth, lastDay).toLocaleDateString('en-CA');

    const [attendanceResult, holidayResult] = await Promise.all([
      supabase
        .from('attendance')
        .select('attendance_date, status')
        .eq('user_id', santriId)
        .gte('attendance_date', start)
        .lt('attendance_date', end),
      supabase
        .from('academic_calendar')
        .select('date')
        .eq('is_holiday', true)
        .gte('date', start)
        .lte('date', endInclusive),
    ]);

    if (attendanceResult.error || holidayResult.error) {
        return { present: 0, late: 0, absent: 0 };
    }

    const holidaySet = new Set((holidayResult.data || []).map(item => item.date));
    const activeDaysUntilToday = [];

    for (let day = 1; day <= lastDay; day++) {
        const date = new Date(selectedYear, selectedMonth, day);
        const dateStr = date.toLocaleDateString('en-CA');
        const dayOfWeek = new Date(Date.UTC(selectedYear, selectedMonth, day)).getUTCDay();
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
        const isPastOrToday = date <= today;

        if (isWeekday && isPastOrToday && !holidaySet.has(dateStr)) {
            activeDaysUntilToday.push(dateStr);
        }
    }

    const activeDaySet = new Set(activeDaysUntilToday);
    const presentDateSet = new Set();
    const lateDateSet = new Set();

    (attendanceResult.data || []).forEach(row => {
        const date = String(row.attendance_date || '').split('T')[0];
        if (!date || !activeDaySet.has(date)) return;

        if (row.status === 'Terlambat') {
            lateDateSet.add(date);
            presentDateSet.delete(date);
            return;
        }

        if (!lateDateSet.has(date) && ['Hadir', 'Tepat Waktu'].includes(row.status)) {
            presentDateSet.add(date);
        }
    });

    const present = presentDateSet.size;
    const late = lateDateSet.size;
    const attended = new Set([...presentDateSet, ...lateDateSet]).size;
    const absent = Math.max(activeDaysUntilToday.length - attended, 0);

    return { present, late, absent };
};

// Badge config is small and changes rarely, so kiosks reuse it for a minute between scans.
const BADGE_CACHE_MS = 60 * 1000;
let badgeCache = { at: 0, promise: null };

const loadSantriBadgeConfig = () => {
    if (badgeCache.promise && Date.now() - badgeCache.at < BADGE_CACHE_MS) return badgeCache.promise;
    const promise = supabase
        .from('website_content')
        .select('content')
        .eq('key', SANTRI_BADGES_KEY)
        .maybeSingle()
        .then(({ data, error }) => (error ? null : data?.content || null))
        .catch(() => null);
    badgeCache = { at: Date.now(), promise };
    return promise;
};

export const getSantriLearningHighlights = async (santriId) => {
    if (!santriId) {
        return { hafalanCount: 0, characterStrength: null, strongestHafalanCategory: null, badges: [] };
    }

    const [progressResult, strengthResult, badgeConfig] = await Promise.all([
        supabase
            .from('hafalan_progress')
            .select('category,status,score,nilai')
            .eq('santri_id', santriId),
        supabase
            .from('santri_character_strengths')
            .select('strength_key')
            .eq('santri_id', santriId)
            .order('selected_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        loadSantriBadgeConfig(),
    ]);

    const rows = progressResult.error ? [] : (progressResult.data || []);
    const scoredRows = rows.map((row) => {
        const rawScore = Number(row.score ?? row.nilai);
        const score = Number.isFinite(rawScore) && rawScore >= 1 && rawScore <= 4
            ? rawScore
            : row.status === 'lulus' ? 4 : null;
        return { ...row, score };
    });
    const hafalanCount = scoredRows.filter((row) => row.status === 'lulus' || row.score === 4).length;
    const categoryStats = new Map();

    scoredRows.forEach((row) => {
        const category = String(row.category || '').trim();
        if (!category || row.score === null) return;
        const current = categoryStats.get(category) || { category, total: 0, assessed: 0, completed: 0 };
        current.total += row.score;
        current.assessed += 1;
        if (row.status === 'lulus' || row.score === 4) current.completed += 1;
        categoryStats.set(category, current);
    });

    const strongest = [...categoryStats.values()]
        .map((item) => ({ ...item, average: item.total / item.assessed }))
        .sort((left, right) => (
            right.average - left.average
            || right.completed - left.completed
            || right.assessed - left.assessed
            || left.category.localeCompare(right.category, 'id')
        ))[0];
    const averageLabel = strongest
        ? strongest.average.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        : null;

    return {
        hafalanCount,
        characterStrength: strengthResult.error ? null : (strengthResult.data?.strength_key || null),
        strongestHafalanCategory: strongest ? `${strongest.category} · ${averageLabel}` : null,
        badges: badgesForSantri(badgeConfig, santriId).map((badge) => badge.id),
    };
};
