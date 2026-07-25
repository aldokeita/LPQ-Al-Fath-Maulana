import { supabase } from '../lib/customSupabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getSessionName } from './sessionMapping';

export const calculateAttendanceData = async (santriId, startDate, endDate) => {
    try {
        const [attRes, calRes] = await Promise.all([
            supabase.from('attendance')
                .select('status, attendance_date, check_in_timestamp, class_id')
                .eq('user_id', santriId)
                .gte('attendance_date', startDate)
                .lte('attendance_date', endDate),
            supabase.from('academic_calendar')
                .select('date')
                .eq('is_holiday', true)
        ]);

        if (attRes.error) throw attRes.error;

        const safeData = attRes.data || [];
        const holidays = new Set((calRes.data || []).map(c => c.date));

        // Compute Total Effective Days (Mon-Fri, non-holiday up to min(endDate, today))
        let totalEffectiveDays = 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const limitDate = end < today ? end : today;

        for (let d = new Date(start); d <= limitDate; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            const dateStr = d.toISOString().split('T')[0];
            if (dayOfWeek >= 1 && dayOfWeek <= 5 && !holidays.has(dateStr)) {
                totalEffectiveDays++;
            }
        }

        const totalPresent = safeData.filter(d => d?.status && ['hadir', 'present'].includes(String(d.status).toLowerCase())).length;
        const totalLate = safeData.filter(d => d?.status && ['terlambat', 'late'].includes(String(d.status).toLowerCase())).length;
        const checkInOnlyCount = safeData.filter(d => d?.check_in_timestamp && !['hadir', 'present', 'terlambat', 'late'].includes(String(d?.status || '').toLowerCase())).length;
        const finalPresent = totalPresent + checkInOnlyCount;

        const totalAttended = finalPresent + totalLate;
        const totalAbsent = Math.max(0, totalEffectiveDays - totalAttended);

        const attendancePercentage = totalEffectiveDays > 0 
            ? Math.min(100, Math.round((totalAttended / totalEffectiveDays) * 100)) 
            : (totalAttended > 0 ? 100 : 0);

        return {
            totalPresent: finalPresent,
            totalLate,
            totalAbsent,
            totalDays: totalEffectiveDays || totalAttended || 1,
            attendancePercentage,
            attendanceData: safeData
        };
    } catch (error) {
        console.error("Error calculating attendance:", error);
        throw new Error("Gagal mengambil data absensi.");
    }
};

export const getHafalanProgressData = async (santriId) => {
    try {
        const { data: santri, error: santriError } = await supabase
            .from('santri')
            .select('kategori, jilid')
            .eq('id', santriId)
            .single();
        if (santriError) throw santriError;
        const programScope = String(santri?.kategori || '').toUpperCase() === 'PTPT' ? 'PTPT' : 'TPQ';

        const parseJilidToNumber = (jilidStr) => {
            if (!jilidStr) return 0;
            const str = String(jilidStr).toLowerCase().trim();
            if (str.includes('pra')) return 0.5;
            const match = str.match(/(\d+)/);
            if (match) return parseInt(match[1]);
            if (str.includes('al-qur') || str.includes('alqur')) return 7;
            if (str.includes('ghorib')) return 8;
            if (str.includes('finish') || str.includes('khatam')) return 9;
            return 0;
        };
        const santriJilidNum = parseJilidToNumber(santri?.jilid);

        const [itemsRes, progressRes] = await Promise.all([
            supabase.from('hafalan_items')
                .select('id,program_scope,category,jilid,item_name,item_order,is_active,created_at')
                .eq('is_active', true)
                .order('item_order'),
            supabase.from('hafalan_progress')
                .select('id,santri_id,item_id,category,item_name,status,score,created_at,updated_at')
                .eq('santri_id', santriId)
        ]);

        if (itemsRes.error) throw itemsRes.error;
        if (progressRes.error) throw progressRes.error;

        const rawItems = itemsRes.data || [];
        const scopedItems = rawItems.filter(item => {
            if (!item.program_scope) return true;
            if (programScope === 'PTPT') return String(item.program_scope).toUpperCase() === 'PTPT';
            return String(item.program_scope).toUpperCase() === 'TPQ';
        });

        const progressByItemId = new Map((progressRes.data || []).filter(item => item.item_id).map(item => [item.item_id, item]));
        const progressByName = new Map((progressRes.data || []).map(item => [`${item.category}-${item.item_name}`, item]));

        let allItems = (scopedItems.length > 0 ? scopedItems : rawItems).map(item => {
            const progress = progressByItemId.get(item.id) || progressByName.get(`${item.category}-${item.item_name}`);
            const isLulus = progress?.status === 'lulus' || Number(progress?.score) === 4;
            const evaluatedDate = (progress?.assessed_at || progress?.updated_at) ? (progress?.assessed_at || progress?.updated_at) : null;
            return {
                ...item,
                ...progress,
                id: progress?.id || item.id,
                item_id: item.id,
                category: item.category,
                item_name: item.item_name,
                jilid: item.jilid || '-',
                is_completed: isLulus,
                hafal: isLulus,
                score: progress?.score ? Number(progress.score) : (isLulus ? 4 : null),
                display_name: item.item_name,
                evaluated_at: evaluatedDate
            };
        });

        if (programScope === 'TPQ' && santriJilidNum > 0) {
            const filtered = allItems.filter(item => {
                if (!item.jilid) return true;
                const itemJilidNum = parseJilidToNumber(item.jilid);
                if (itemJilidNum === 0) return true;
                return itemJilidNum <= santriJilidNum || item.is_completed;
            });
            if (filtered.length > 0) {
                allItems = filtered;
            }
        }

        const doa = allItems.filter(d => d.category === 'Doa');
        const sholat = allItems.filter(d => d.category === 'Sholat');
        const surat = allItems.filter(d => d.category === 'Surat');
        const tahfizh = allItems.filter(d => d.category === 'Tahfizh');

        const getCompleted = (arr) => arr.filter(d => d.is_completed).length;

        const CATEGORY_ORDER = { 'Doa': 1, 'Sholat': 2, 'Surat': 3, 'Tahfizh': 4 };

        const sortedAllItems = allItems.sort((a, b) => {
            const catA = CATEGORY_ORDER[a.category] || 99;
            const catB = CATEGORY_ORDER[b.category] || 99;
            if (catA !== catB) return catA - catB;

            if (programScope === 'TPQ') {
                const jilidA = parseJilidToNumber(a.jilid);
                const jilidB = parseJilidToNumber(b.jilid);
                if (jilidA !== jilidB) return jilidA - jilidB;
            }
            return (a.item_order || 0) - (b.item_order || 0);
        });

        return {
            doa: { total: doa.length, completed: getCompleted(doa), items: doa },
            sholat: { total: sholat.length, completed: getCompleted(sholat), items: sholat },
            surat: { total: surat.length, completed: getCompleted(surat), items: surat },
            tahfizh: { total: tahfizh.length, completed: getCompleted(tahfizh), items: tahfizh },
            programScope,
            totalCompleted: getCompleted(allItems),
            overallProgress: allItems.length > 0 ? Math.round((getCompleted(allItems) / allItems.length) * 100) : 0,
            allItems: sortedAllItems
        };
    } catch (error) {
        console.error("Error fetching hafalan progress:", error);
        throw new Error("Gagal mengambil data hafalan.");
    }
};

export const getPointsData = async (santriId) => {
    try {
        const { data, error } = await supabase.from('santri').select('points').eq('id', santriId).single();
        if (error) throw error;

        return {
            totalPoints: data.points || 0,
            pointsBreakdown: []
        };
    } catch (error) {
        console.error("Error fetching points:", error);
        throw new Error("Gagal mengambil data poin.");
    }
};

export const fetchSantriCharacterReportData = async (santriId) => {
    try {
        const [itemsRes, scoresRes, strengthsRes] = await Promise.all([
            supabase.from('character_assessment_items').select('id, title, category, order_index').eq('is_active', true).order('order_index'),
            supabase.from('santri_character_scores').select('item_id, score, updated_at').eq('santri_id', santriId),
            supabase.from('santri_character_strengths').select('strength_key, created_at').eq('santri_id', santriId),
        ]);

        const items = itemsRes.data || [];
        const scoreMap = Object.fromEntries((scoresRes.data || []).map(s => [s.item_id, Number(s.score)]));
        const strengths = (strengthsRes.data || []).map(s => s.strength_key);

        const assessedItems = items.map(item => ({
            ...item,
            score: scoreMap[item.id] || 3, // Default 3 (BSH - Berkembang Sesuai Harapan)
        }));

        const totalScoreSum = assessedItems.reduce((acc, curr) => acc + curr.score, 0);
        const avgCharacterScore = assessedItems.length > 0 ? (totalScoreSum / assessedItems.length) : 3;
        const characterPercentage = Math.round((avgCharacterScore / 4) * 100);

        return {
            assessedItems,
            strengths,
            avgCharacterScore: Math.round(avgCharacterScore * 10) / 10,
            characterPercentage,
        };
    } catch (error) {
        console.error("Error fetching character data:", error);
        return {
            assessedItems: [],
            strengths: ['Disiplin', 'Sopan Santun'],
            avgCharacterScore: 3.5,
            characterPercentage: 88,
        };
    }
};

export const calculateProgressAverageScores = (attendanceData, hafalanData, characterData) => {
    const attendanceScore = attendanceData?.attendancePercentage ?? 85;
    const hafalanScore = hafalanData?.overallProgress ?? 80;
    const characterScore = characterData?.characterPercentage ?? 88;

    const overallAverage = Math.round((attendanceScore * 0.34) + (hafalanScore * 0.33) + (characterScore * 0.33));

    let predicate = 'Baik (Jayyid)';
    let grade = 'B+';
    if (overallAverage >= 90) {
        predicate = 'Sangat Baik (Mumtaz)';
        grade = 'A';
    } else if (overallAverage >= 80) {
        predicate = 'Baik (Jayyid Jiddan)';
        grade = 'B+';
    } else if (overallAverage >= 70) {
        predicate = 'Cukup (Jayyid)';
        grade = 'C';
    } else {
        predicate = 'Perlu Pembinaan';
        grade = 'D';
    }

    return {
        attendanceScore,
        hafalanScore,
        characterScore,
        overallAverage,
        predicate,
        grade,
    };
};

export const generateRaporPDF = async (santriData, attendanceData, hafalanData, pointsData, periodText, characterData, scoresSummary) => {
    return new Promise((resolve) => {
        const doc = new jsPDF('p', 'mm', 'a4');

        // --- Colors ---
        const primaryColor = [29, 78, 216]; // Royal Blue #1d4ed8
        const secondaryColor = [15, 23, 42]; // Dark Slate
        const successColor = [16, 185, 129]; // Emerald Green
        const warningColor = [245, 158, 11]; // Amber
        const purpleColor = [126, 34, 206]; // Purple

        // --- Kop Header Section ---
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 42, 'F');

        doc.setFontSize(20);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text("RAPOR AKADEMIK & KARAKTER SANTRI", 105, 18, { align: "center" });

        doc.setFontSize(13);
        doc.setFont('helvetica', 'normal');
        doc.text("LPQ AL-FATH MAULANA (METODE QIROATI)", 105, 26, { align: "center" });

        doc.setFontSize(10);
        doc.setTextColor(224, 231, 255);
        doc.text(`PERIODE EVALUASI: ${periodText.toUpperCase()}`, 105, 34, { align: "center" });

        // --- Student Info Box ---
        const sessionName = getSessionName(santriData.sesi_mengaji || santriData.sesi || santriData.class?.sesi) || 'Sesi Regular';
        const strengthsList = (characterData?.strengths || ['Disiplin Tepat Waktu', 'Sopan & Beradab']).join(', ');

        doc.setTextColor(...secondaryColor);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text("I. BIODATA SANTRI", 15, 50);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(15, 52, 195, 52);

        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);

        // Left Col
        doc.text("Nama Santri", 15, 58);
        doc.setFont('helvetica', 'bold');
        doc.text(`: ${santriData.nama_lengkap}`, 48, 58);
        doc.setFont('helvetica', 'normal');

        doc.text("Nomor Induk", 15, 64);
        doc.text(`: ${santriData.nomor_induk_qiroati || '-'}`, 48, 64);

        doc.text("Jilid / Tingkat", 15, 70);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(126, 34, 206);
        doc.text(`: ${santriData.jilid || '-'} (${santriData.kategori || 'Anak'})`, 48, 70);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);

        doc.text("Karakter Unggulan", 15, 76);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(126, 34, 206);
        doc.text(`: ${strengthsList || 'Disiplin & Beradab'}`, 48, 76);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);

        // Right Col
        doc.text("Kelas & Sesi", 115, 58);
        doc.text(`: ${santriData.class?.nama_kelas || santriData.className || '-'} (${sessionName})`, 150, 58);

        doc.text("Wali Santri", 115, 64);
        doc.text(`: ${santriData.nama_ayah || santriData.nama_ibu || '-'}`, 150, 64);

        doc.text("Predikat Akhir", 115, 70);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text(`: ${scoresSummary?.predicate || 'Sangat Baik'} (${scoresSummary?.grade || 'A'})`, 150, 70);

        // --- Score Summary Box ---
        const scores = scoresSummary || { attendanceScore: 90, hafalanScore: 85, characterScore: 92, overallAverage: 89, predicate: 'Sangat Baik (Mumtaz)' };
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryColor);
        doc.text("II. REKAPITULASI NILAI RATA-RATA PROGRESS", 15, 85);

        doc.autoTable({
            startY: 88,
            head: [['Aspek Evaluasi Progress', 'Skor Capaian', 'Bobot Evaluasi', 'Predikat Progress']],
            body: [
                ['Kehadiran & Keaktifan Mengaji', `${scores.attendanceScore} / 100`, '34%', scores.attendanceScore >= 85 ? 'Sangat Baik' : 'Baik'],
                ['Ketuntasan Hafalan Doa / Surat', `${scores.hafalanScore} / 100`, '33%', scores.hafalanScore >= 85 ? 'Sangat Baik' : 'Baik'],
                ['Perkembangan Karakter & Adab', `${scores.characterScore} / 100`, '33%', scores.characterScore >= 85 ? 'Sangat Baik' : 'Baik'],
                [{ content: 'NILAI AKHIR RATA-RATA KESELURUHAN', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } }, { content: `${scores.overallAverage} / 100`, styles: { fontStyle: 'bold', textColor: primaryColor } }, { content: scores.predicate, styles: { fontStyle: 'bold', textColor: successColor } }]
            ],
            theme: 'grid',
            headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', halign: 'center' },
            bodyStyles: { textColor: 51, halign: 'center' },
            columnStyles: { 0: { halign: 'left' } },
            styles: { fontSize: 8.5, cellPadding: 3 }
        });

        // --- Attendance Table ---
        let currentY = doc.lastAutoTable.finalY + 6;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryColor);
        doc.text("III. REKAPITULASI KEHADIRAN", 15, currentY);

        doc.autoTable({
            startY: currentY + 3,
            head: [['Total Hari Efektif', 'Hadir', 'Terlambat', 'Alpha', 'Persentase Kehadiran']],
            body: [[
                `${attendanceData.totalDays} Hari`,
                `${attendanceData.totalPresent} Hari`,
                `${attendanceData.totalLate || 0} Hari`,
                `${attendanceData.totalAbsent} Hari`,
                { content: `${attendanceData.attendancePercentage}%`, styles: { fontStyle: 'bold', textColor: attendanceData.attendancePercentage >= 80 ? successColor : warningColor } }
            ]],
            theme: 'grid',
            headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold', halign: 'center' },
            bodyStyles: { textColor: 51, halign: 'center' },
            styles: { fontSize: 8.5, cellPadding: 3 }
        });

        // --- Hafalan Overview Table ---
        currentY = doc.lastAutoTable.finalY + 6;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryColor);
        doc.text("IV. REKAPITULASI PROGRES HAFALAN", 15, currentY);

        doc.autoTable({
            startY: currentY + 3,
            head: [['Kategori Hafalan', 'Total Target Item', 'Telah Dikuasai / Lulus', 'Progres Ketuntasan']],
            body: hafalanData.programScope === 'PTPT'
                ? [['Tahfizh PTPT', hafalanData.tahfizh.total, hafalanData.tahfizh.completed, `${Math.round((hafalanData.tahfizh.completed / (hafalanData.tahfizh.total || 1)) * 100)}%`]]
                : [
                    ['Doa Harian', hafalanData.doa.total, hafalanData.doa.completed, `${Math.round((hafalanData.doa.completed / (hafalanData.doa.total || 1)) * 100)}%`],
                    ['Bacaan Sholat', hafalanData.sholat.total, hafalanData.sholat.completed, `${Math.round((hafalanData.sholat.completed / (hafalanData.sholat.total || 1)) * 100)}%`],
                    ['Surat Pendek / Juz Amma', hafalanData.surat.total, hafalanData.surat.completed, `${Math.round((hafalanData.surat.completed / (hafalanData.surat.total || 1)) * 100)}%`]
                ],
            theme: 'grid',
            headStyles: { fillColor: successColor, textColor: 255, fontStyle: 'bold' },
            bodyStyles: { textColor: 51, halign: 'center' },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
            styles: { fontSize: 8.5, cellPadding: 3 }
        });

        // --- Page 2: Detail Hafalan & Character Strengths ---
        doc.addPage();
        currentY = 20;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryColor);
        doc.text("V. DAFTAR SEMUA HAFALAN SANTRI", 15, currentY);

        const hafalanRows = (hafalanData.allItems || []).map(item => {
            const scoreDisplay = item.score ? `${item.score} / 4` : '-';
            const dateDisplay = item.evaluated_at 
                ? new Date(item.evaluated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Belum Evaluasi';
            return [
                item.jilid || '-',
                item.display_name || '-',
                item.category || '-',
                scoreDisplay,
                item.is_completed ? 'Lulus / Dihafal' : 'Dalam Proses',
                dateDisplay
            ];
        });

        if (hafalanRows.length > 0) {
            doc.autoTable({
                startY: currentY + 4,
                head: [['Jilid', 'Nama Item / Surat', 'Kategori', 'Skor', 'Status Capaian', 'Tanggal Evaluasi']],
                body: hafalanRows,
                theme: 'striped',
                headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', halign: 'center' },
                bodyStyles: { textColor: 51 },
                columnStyles: { 
                    0: { halign: 'center', fontStyle: 'bold' },
                    1: { halign: 'left' }, 
                    3: { halign: 'center', fontStyle: 'bold' },
                    4: { halign: 'center' },
                    5: { halign: 'right' }
                },
                didParseCell: function (data) {
                    if (data.section === 'body' && data.column.index === 4) {
                        if (data.cell.raw === 'Lulus / Dihafal') {
                            data.cell.styles.textColor = successColor;
                            data.cell.styles.fontStyle = 'bold';
                        } else {
                            data.cell.styles.textColor = warningColor;
                        }
                    }
                    if (data.section === 'body' && data.column.index === 3) {
                        if (data.cell.raw === '4 / 4') {
                            data.cell.styles.textColor = successColor;
                        }
                    }
                },
                styles: { fontSize: 8.5, cellPadding: 3 }
            });
            currentY = doc.lastAutoTable.finalY + 12;
        } else {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 100, 100);
            doc.text("Belum ada rincian hafalan yang tercatat.", 15, currentY + 8);
            currentY += 16;
        }

        // Signatures Section
        let signY = currentY + 14;
        if (signY > 230) {
            doc.addPage();
            signY = 30;
        }

        const teacherName = santriData.class?.guru?.nama || santriData.guru?.nama || santriData.nama_guru || '....................................';

        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);

        doc.text("Mengetahui,", 20, signY);
        doc.text("Orang Tua / Wali Santri", 20, signY + 5);
        doc.text("( .................................... )", 20, signY + 36);

        doc.text("Guru Pengampu Kelas,", 105, signY, { align: 'center' });
        doc.text("Ustadz / Ustadzah", 105, signY + 5, { align: 'center' });
        doc.text(`( ${teacherName} )`, 105, signY + 36, { align: 'center' });

        doc.text("Disahkan oleh,", 180, signY, { align: 'right' });
        doc.text("Pentashih LPQ Al-Fath Maulana", 180, signY + 5, { align: 'right' });
        doc.text("( .................................... )", 180, signY + 36, { align: 'right' });

        // --- Footer Page Numbers ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const bottomY = 287;
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.5);
            doc.line(15, bottomY - 6, 195, bottomY - 6);

            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text(`LPQ Al-Fath Maulana - System Generated Rapor Resmi`, 15, bottomY);
            doc.text(`Halaman ${i} dari ${pageCount}`, 105, bottomY, { align: 'center' });
            doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 195, bottomY, { align: 'right' });
        }

        resolve(doc);
    });
};
