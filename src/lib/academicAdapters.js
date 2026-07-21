import { supabase } from '@/lib/customSupabaseClient';

export const progressStatusToComplete = (status) => status === 'lulus';

export const completeToProgressStatus = (complete) => (complete ? 'lulus' : 'proses');

export const DEVELOPMENT_SCORE_OPTIONS = [
    { score: 1, code: 'BB', label: 'Belum Berkembang', tone: 'slate' },
    { score: 2, code: 'MB', label: 'Mulai Berkembang', tone: 'amber' },
    { score: 3, code: 'BSH', label: 'Berkembang Sesuai Harapan', tone: 'sky' },
    { score: 4, code: 'SB', label: 'Sangat Berkembang', tone: 'emerald' }
];

export const CHARACTER_STRENGTH_OPTIONS = [
    'Disiplin',
    'Jujur',
    'Mandiri',
    'Percaya Diri',
    'Bertanggung Jawab',
    'Sopan Santun',
    'Peduli',
    'Rajin Beribadah',
    'Semangat Belajar',
    "Gemar Membaca Al-Qur'an"
];

export const VIOLATION_LEVELS = {
    Ringan: {
        examples: 'Terlambat, lupa membawa buku, tidak memakai ID Card, atau bercanda saat belajar',
        followUp: 'Nasihat dan pengingat dari guru'
    },
    Sedang: {
        examples: 'Mengganggu teman berulang kali, tidak sopan kepada guru, atau tidak mengerjakan hafalan berulang',
        followUp: 'Pembinaan, pencatatan, dan pemberitahuan kepada orang tua'
    },
    Berat: {
        examples: 'Berkelahi, merusak fasilitas, membawa barang berbahaya, atau tindakan yang membahayakan',
        followUp: 'Pertemuan dengan orang tua, pembinaan intensif, dan keputusan kepala LPQ'
    }
};

export const getDevelopmentScoreMeta = (score) => (
    DEVELOPMENT_SCORE_OPTIONS.find((item) => item.score === Number(score))
    || DEVELOPMENT_SCORE_OPTIONS[0]
);

export const groupHafalanItemsByJilid = (items = []) => {
    const groups = Object.fromEntries([1, 2, 3, 4, 5, 6].map((jilid) => [jilid, []]));

    items.forEach((item) => {
        const normalizedJilid = String(item?.jilid || '1')
            .replace(/^jilid\s*/i, '')
            .trim();
        if (groups[normalizedJilid]) groups[normalizedJilid].push(item);
    });

    return groups;
};

export const PTPT_TAHFIZH_TARGETS = ['Juz 1', 'Juz 2', 'Juz 28', 'Juz 29', 'Juz 30'];

export const getHafalanProgramScope = (santriOrCategory) => {
    const category = typeof santriOrCategory === 'string'
        ? santriOrCategory
        : santriOrCategory?.kategori;
    return String(category || '').toUpperCase() === 'PTPT' ? 'PTPT' : 'TPQ';
};

export const groupHafalanItemsByTarget = (items = [], targets = PTPT_TAHFIZH_TARGETS) => (
    Object.fromEntries(targets.map((target) => [
        target,
        items.filter((item) => String(item?.jilid || '').trim() === target)
    ]))
);

export const getAcademicErrorMessage = (error) => {
    const message = String(error?.message || error || '');
    if (message.includes('row-level security') || error?.code === '42501') {
        return 'Anda tidak memiliki akses untuk data akademik ini.';
    }
    if (message.includes('academic_calendar_title_not_blank')) {
        return 'Judul kalender wajib diisi.';
    }
    if (message.includes('hafalan_items_name_not_blank')) {
        return 'Nama item hafalan wajib diisi.';
    }
    if (message.includes('hafalan_progress_status_check')) {
        return 'Status hafalan tidak valid.';
    }
    if (message.includes('score_check')) {
        return 'Skor perkembangan harus berada pada nilai 1 sampai 4.';
    }
    if (message.includes('santri_behavior_records_level_check')) {
        return 'Tingkat pelanggaran tidak valid.';
    }
    if (message.includes('murojaah_submissions_status_check')) {
        return 'Status murojaah tidak valid.';
    }
    return message || 'Operasi akademik gagal.';
};

export const fetchCalendarEvents = async ({ startDate, endDate }) => {
    const { data, error } = await supabase
        .from('academic_calendar')
        .select('id,date,title,description,is_holiday,is_public,event_type')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
};

export const saveCalendarEvent = async ({ existingId, selectedDate, description, isHoliday, userId }) => {
    const cleanDescription = String(description || '').trim();
    const title = cleanDescription || (isHoliday ? 'Hari Libur' : 'Hari Masuk');
    const payload = {
        date: selectedDate,
        title,
        description: cleanDescription || null,
        is_holiday: Boolean(isHoliday),
        is_public: true,
        event_type: isHoliday ? 'holiday' : 'school_day',
        updated_by: userId || null
    };

    const query = existingId
        ? supabase.from('academic_calendar').update(payload).eq('id', existingId)
        : supabase.from('academic_calendar').insert({ ...payload, created_by: userId || null });

    const { error } = await query;
    if (error) throw error;
};

export const deleteCalendarEvent = async (id) => {
    const { error } = await supabase.from('academic_calendar').delete().eq('id', id);
    if (error) throw error;
};

export const fetchHafalanItems = async (category = null, programScope = null) => {
    let query = supabase
        .from('hafalan_items')
        .select('id,program_scope,category,jilid,item_name,item_order,is_active')
        .eq('is_active', true)
        .order('item_order', { ascending: true })
        .order('item_name', { ascending: true });

    if (category) query = query.eq('category', category);
    if (programScope) query = query.eq('program_scope', programScope);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const createHafalanItem = async ({ category, itemName, jilid, itemOrder, programScope = 'TPQ' }) => {
    const { error } = await supabase.from('hafalan_items').insert({
        program_scope: programScope,
        category,
        item_name: String(itemName || '').trim(),
        jilid: String(jilid || ''),
        item_order: itemOrder,
        is_active: true
    });
    if (error) throw error;
};

export const updateHafalanItem = async (id, updates) => {
    const { error } = await supabase
        .from('hafalan_items')
        .update({
            ...updates,
            jilid: updates.jilid === undefined ? undefined : String(updates.jilid)
        })
        .eq('id', id);
    if (error) throw error;
};

export const deactivateHafalanItem = async (id) => {
    const { error } = await supabase.from('hafalan_items').update({ is_active: false }).eq('id', id);
    if (error) throw error;
};

export const fetchClassesWithActiveSantriForTeacher = async (guruId) => {
    const { data: classes, error: classError } = await supabase
        .from('classes')
        .select('id,nama_kelas,id_guru,sesi,kategori,sort_order')
        .eq('id_guru', guruId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

    if (classError) throw classError;
    if (!classes?.length) return [];

    const classIds = classes.map((item) => item.id);
    const { data: memberships, error: membershipError } = await supabase
        .from('class_memberships')
        .select('class_id,order_in_class,santri:santri_id(id,nama_lengkap,nomor_induk_qiroati,kategori,jilid,status,current_class_id,sesi_mengaji,foto_url,avatar_path,tanggal_lahir,no_hp_ortu,created_at)')
        .in('class_id', classIds)
        .eq('status', 'active')
        .order('order_in_class', { ascending: true });

    if (membershipError) throw membershipError;

    return classes.map((kelas) => ({
        ...kelas,
        santri: (memberships || [])
            .filter((membership) => membership.class_id === kelas.id && membership.santri)
            .map((membership) => ({
                ...membership.santri,
                id_kelas: kelas.id,
                class: kelas,
                order_in_class: membership.order_in_class
            }))
    }));
};

export const fetchHafalanProgress = async (santriIds = null) => {
    let query = supabase
        .from('hafalan_progress')
        .select('id,santri_id,item_id,category,item_name,status,score,nilai,catatan,assessed_by,assessed_at,created_at,updated_at');

    if (Array.isArray(santriIds) && santriIds.length > 0) {
        query = query.in('santri_id', santriIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const buildProgressMap = (progressRows) => {
    const map = {};
    (progressRows || []).forEach((row) => {
        const key = row.item_id
            ? `${row.santri_id}-${row.item_id}`
            : `${row.santri_id}-${row.category}-${row.item_name}`;
        map[key] = progressStatusToComplete(row.status);
    });
    return map;
};

export const buildHafalanScoreMap = (progressRows) => {
    const map = {};
    (progressRows || []).forEach((row) => {
        const key = row.item_id
            ? `${row.santri_id}-${row.item_id}`
            : `${row.santri_id}-${row.category}-${row.item_name}`;
        map[key] = Number(row.score || (row.status === 'lulus' ? 4 : 1));
    });
    return map;
};

export const upsertHafalanProgress = async ({ santriId, item, score, userId }) => {
    const itemId = item?.id || null;
    const normalizedScore = Number(score);
    if (!Number.isInteger(normalizedScore) || normalizedScore < 1 || normalizedScore > 4) {
        throw new Error('Skor hafalan harus berupa angka 1 sampai 4.');
    }
    let query = supabase
        .from('hafalan_progress')
        .select('id')
        .eq('santri_id', santriId);

    if (itemId) {
        query = query.eq('item_id', itemId);
    } else {
        query = query.eq('category', item.category).eq('item_name', item.item_name);
    }

    const { data: existing, error: existingError } = await query.maybeSingle();
    if (existingError) throw existingError;

    const payload = {
        santri_id: santriId,
        item_id: itemId,
        category: item.category,
        item_name: item.item_name,
        score: normalizedScore,
        status: normalizedScore === 4 ? 'lulus' : 'proses',
        assessed_by: userId || null,
        assessed_at: new Date().toISOString(),
        updated_by: userId || null
    };

    const result = existing?.id
        ? await supabase.from('hafalan_progress').update(payload).eq('id', existing.id)
        : await supabase.from('hafalan_progress').insert({ ...payload, created_by: userId || null });

    if (result.error) throw result.error;
};

export const fetchCharacterAssessmentItems = async () => {
    const { data, error } = await supabase
        .from('character_assessment_items')
        .select('id,item_order,item_name,is_active')
        .eq('is_active', true)
        .order('item_order', { ascending: true });
    if (error) throw error;
    return data || [];
};

export const fetchSantriCharacterScores = async (santriId) => {
    const { data, error } = await supabase
        .from('santri_character_scores')
        .select('id,santri_id,item_id,score,assessed_by,assessed_at,updated_at')
        .eq('santri_id', santriId);
    if (error) throw error;
    return data || [];
};

export const upsertSantriCharacterScore = async ({ santriId, itemId, score, userId }) => {
    const normalizedScore = Number(score);
    if (!Number.isInteger(normalizedScore) || normalizedScore < 1 || normalizedScore > 4) {
        throw new Error('Skor karakter harus berupa angka 1 sampai 4.');
    }
    const { data: existing, error: existingError } = await supabase
        .from('santri_character_scores')
        .select('id')
        .eq('santri_id', santriId)
        .eq('item_id', itemId)
        .maybeSingle();
    if (existingError) throw existingError;

    const payload = {
            santri_id: santriId,
            item_id: itemId,
            score: normalizedScore,
            assessed_by: userId || null,
            assessed_at: new Date().toISOString(),
            updated_by: userId || null
    };
    const result = existing?.id
        ? await supabase.from('santri_character_scores').update(payload).eq('id', existing.id)
        : await supabase.from('santri_character_scores').insert({ ...payload, created_by: userId || null });
    if (result.error) throw result.error;
};

export const fetchSantriCharacterStrengths = async (santriId) => {
    const { data, error } = await supabase
        .from('santri_character_strengths')
        .select('santri_id,strength_key,selected_by,selected_at')
        .eq('santri_id', santriId)
        .order('selected_at', { ascending: true });
    if (error) throw error;
    return data || [];
};

export const setSantriCharacterStrength = async ({ santriId, strengthKey, selected, userId }) => {
    const query = selected
        ? supabase.from('santri_character_strengths').upsert({
            santri_id: santriId,
            strength_key: strengthKey,
            selected_by: userId || null,
            selected_at: new Date().toISOString()
        }, { onConflict: 'santri_id,strength_key' })
        : supabase.from('santri_character_strengths')
            .delete()
            .eq('santri_id', santriId)
            .eq('strength_key', strengthKey);
    const { error } = await query;
    if (error) throw error;
};

export const fetchSantriBehaviorRecords = async (santriId) => {
    const { data, error } = await supabase
        .from('santri_behavior_records')
        .select('id,santri_id,guru_id,incident_date,level,behavior,follow_up,teacher_note,created_at,updated_at,guru:guru_id(nama)')
        .eq('santri_id', santriId)
        .order('incident_date', { ascending: false })
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const saveSantriBehaviorRecord = async ({ recordId, santriId, incidentDate, level, behavior, followUp, teacherNote, userId }) => {
    const payload = {
        incident_date: incidentDate,
        level,
        behavior: String(behavior || '').trim(),
        follow_up: String(followUp || '').trim(),
        teacher_note: String(teacherNote || '').trim() || null,
        updated_by: userId || null
    };
    if (!payload.behavior || !payload.follow_up) {
        throw new Error('Bentuk perilaku dan tindak lanjut wajib diisi.');
    }

    const result = recordId
        ? await supabase.from('santri_behavior_records').update(payload).eq('id', recordId)
        : await supabase.from('santri_behavior_records').insert({
            ...payload,
            santri_id: santriId,
            guru_id: userId || null,
            created_by: userId || null
        });
    if (result.error) throw result.error;
};

export const fetchMurojaahSubmissions = async () => {
    const { data, error } = await supabase
        .from('murojaah_submissions')
        .select('id,santri_id,target_guru_id,type,content,recording_path,status,feedback,submitted_at,reviewed_at,created_at,santri:santri_id(nama_lengkap,current_class_id)')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const createMurojaahSubmission = async ({ santriId, type, content, userId }) => {
    const { error } = await supabase.from('murojaah_submissions').insert({
        santri_id: santriId,
        type,
        content,
        recording_path: null,
        status: 'menunggu',
        created_by: userId || null
    });
    if (error) throw error;
};

export const updateMurojaahReview = async ({ id, status = 'diterima', feedback, userId }) => {
    const { error } = await supabase
        .from('murojaah_submissions')
        .update({
            status,
            feedback: String(feedback || '').trim() || null,
            target_guru_id: userId || null,
            reviewed_at: new Date().toISOString(),
            updated_by: userId || null
        })
        .eq('id', id);
    if (error) throw error;
};

export const fetchSantriNotes = async (santriId) => {
    const { data, error } = await supabase
        .from('santri_notes')
        .select('id,santri_id,guru_id,note,visibility,created_at,updated_at,guru:guru_id(nama)')
        .eq('santri_id', santriId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const saveSantriNote = async ({ noteId, santriId, note, userId }) => {
    const payload = {
        note: String(note || '').trim(),
        visibility: 'internal',
        updated_by: userId || null
    };

    const result = noteId
        ? await supabase.from('santri_notes').update(payload).eq('id', noteId)
        : await supabase.from('santri_notes').insert({
            ...payload,
            santri_id: santriId,
            guru_id: userId || null,
            created_by: userId || null
        });

    if (result.error) throw result.error;
};
