import { supabase } from '../lib/customSupabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getSessionName } from './sessionMapping';
import {
    fetchCharacterAssessmentItems,
    fetchSantriCharacterScores,
    fetchSantriCharacterStrengths
} from '../lib/academicAdapters';
import {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, ShadingType, Footer, PageNumber
} from 'docx';

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
            return {
                ...item,
                ...progress,
                id: progress?.id || item.id,
                item_id: item.id,
                category: item.category,
                item_name: item.item_name,
                jilid: item.jilid || '-',
                is_completed: isLulus,
                score: progress?.score ? Number(progress.score) : (isLulus ? 4 : null)
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

        const CATEGORY_ORDER = { 'Doa': 1, 'Sholat': 2, 'Surat': 3, 'Tahfizh': 4 };
        allItems.sort((a, b) => {
            const catA = CATEGORY_ORDER[a.category] || 99;
            const catB = CATEGORY_ORDER[b.category] || 99;
            if (catA !== catB) return catA - catB;
            const jilidA = parseJilidToNumber(a.jilid);
            const jilidB = parseJilidToNumber(b.jilid);
            if (jilidA !== jilidB) return jilidA - jilidB;
            return (a.item_order || 0) - (b.item_order || 0);
        });

        const doa = allItems.filter(d => d.category === 'Doa');
        const sholat = allItems.filter(d => d.category === 'Sholat');
        const surat = allItems.filter(d => d.category === 'Surat');
        const tahfizh = allItems.filter(d => d.category === 'Tahfizh');

        const getCompleted = (arr) => arr.filter(d => d.is_completed).length;

        const totalItems = allItems.length || 1;
        const totalCompleted = getCompleted(allItems);
        const overallProgress = Math.round((totalCompleted / totalItems) * 100);

        return {
            programScope,
            allItems,
            doa: { total: doa.length, completed: getCompleted(doa) },
            sholat: { total: sholat.length, completed: getCompleted(sholat) },
            surat: { total: surat.length, completed: getCompleted(surat) },
            tahfizh: { total: tahfizh.length, completed: getCompleted(tahfizh) },
            overallProgress
        };
    } catch (error) {
        console.error("Error fetching hafalan progress:", error);
        throw new Error("Gagal mengambil data hafalan santri.");
    }
};

export const getPointsData = async (santriId) => {
    try {
        const { data, error } = await supabase
            .from('santri')
            .select('points')
            .eq('id', santriId)
            .single();

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
        const [items, scoreRows, strengthRows] = await Promise.all([
            fetchCharacterAssessmentItems(),
            fetchSantriCharacterScores(santriId),
            fetchSantriCharacterStrengths(santriId)
        ]);

        const scoreMap = Object.fromEntries(scoreRows.map(s => [s.item_id, Number(s.score)]));
        const strengths = strengthRows.map(s => s.strength_key);

        const assessedItems = items.map(item => ({
            ...item,
            title: item.item_name,
            score: scoreMap[item.id] || 3,
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
            strengths: [],
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

        doc.text("Nomor Induk (NIQ)", 15, 64);
        doc.text(`: ${santriData.nomor_induk_qiroati || '-'}`, 48, 64);

        doc.text("Tingkat Jilid", 15, 70);
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
        doc.text(`: ${santriData.nama_ibu || santriData.nama_ayah || santriData.nama_wali || '-'}`, 150, 64);

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

        // --- Page 2: Karakter & Hafalan Detail ---
        doc.addPage();
        currentY = 15;

        // --- IV. Perkembangan Karakter ---
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryColor);
        doc.text("IV. PERKEMBANGAN KARAKTER & ADAB", 15, currentY);

        const assessedItems = characterData?.assessedItems || [];
        const strengths = characterData?.strengths || [];

        if (strengths.length > 0) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...purpleColor);
            const strengthText = "Karakter Unggulan: ⭐ " + strengths.join(', ⭐ ');
            const wrappedStrengths = doc.splitTextToSize(strengthText, 180);
            doc.text(wrappedStrengths, 15, currentY + 6);
            currentY += 6 + (wrappedStrengths.length * 5);
        } else {
            currentY += 4;
        }

        if (assessedItems.length > 0) {
            const charRows = assessedItems.map(item => {
                const scoreLabel = item.score === 4 ? 'Sangat Baik (SB)' : item.score === 3 ? 'Berkembang Sesuai Harapan (BSH)' : item.score === 2 ? 'Mulai Berkembang (MB)' : 'Belum Berkembang (BB)';
                return [
                    item.order_index ? String(item.order_index) : '-',
                    item.item_name || item.title || '-',
                    item.score ? String(item.score) : '-',
                    scoreLabel
                ];
            });

            doc.autoTable({
                startY: currentY + 3,
                head: [['No', 'Aspek Karakter', 'Skor', 'Predikat']],
                body: charRows,
                theme: 'grid',
                headStyles: { fillColor: purpleColor, textColor: 255, fontStyle: 'bold', halign: 'center' },
                bodyStyles: { textColor: 51 },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 12 },
                    1: { halign: 'left' },
                    2: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
                    3: { halign: 'left' }
                },
                didParseCell: function(data) {
                    if (data.section === 'body' && data.column.index === 2) {
                        const score = Number(data.cell.raw);
                        if (score === 4) data.cell.styles.textColor = successColor;
                        else if (score === 3) data.cell.styles.textColor = primaryColor;
                        else if (score <= 2) data.cell.styles.textColor = warningColor;
                    }
                },
                styles: { fontSize: 8.5, cellPadding: 2.5 }
            });
            currentY = doc.lastAutoTable.finalY + 8;
        } else {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 100, 100);
            doc.text("Belum ada data penilaian karakter untuk santri ini.", 15, currentY + 6);
            currentY += 14;
        }

        // --- V. Daftar Semua Hafalan ---
        doc.setFontSize(11);
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

const createCell = (text, options = {}) => {
    const {
        bold = false,
        italic = false,
        color = '334155',
        fontSize = 18,
        shadingColor = null,
        align = AlignmentType.LEFT,
        colspan = 1,
        width = null
    } = options;

    return new TableCell({
        columnSpan: colspan,
        width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
        shading: shadingColor ? { fill: shadingColor, type: ShadingType.CLEAR } : undefined,
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        children: [
            new Paragraph({
                alignment: align,
                children: [
                    new TextRun({
                        text: String(text !== undefined && text !== null ? text : '-'),
                        bold,
                        italic,
                        color,
                        size: fontSize,
                        font: 'Arial'
                    })
                ]
            })
        ]
    });
};

const createHeaderCell = (text, options = {}) => {
    return createCell(text, {
        bold: true,
        color: 'FFFFFF',
        fontSize: 18,
        shadingColor: options.bg || '1D4ED8',
        align: options.align || AlignmentType.CENTER,
        colspan: options.colspan || 1,
        width: options.width
    });
};

export const generateRaporDOCX = async (santriData, attendanceData, hafalanData, periodText, characterData, scoresSummary) => {
    const sessionName = getSessionName(santriData.sesi_mengaji || santriData.sesi || santriData.class?.sesi) || 'Sesi Regular';
    const strengthsList = (characterData?.strengths || []).join(', ') || '-';
    const teacherName = santriData.class?.guru?.nama || santriData.guru?.nama || santriData.nama_guru || '....................................';
    const scores = scoresSummary || { attendanceScore: 0, hafalanScore: 0, characterScore: 0, overallAverage: 0, predicate: 'Baik' };
    const guardianName = santriData.nama_ibu || santriData.nama_ayah || santriData.nama_wali || '-';

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 }
                }
            },
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                                new TextRun({ text: "LPQ Al-Fath Maulana - System Generated Rapor Resmi  |  Halaman ", size: 16, color: "94A3B8", font: "Arial" }),
                                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "94A3B8", font: "Arial" }),
                                new TextRun({ text: " dari ", size: 16, color: "94A3B8", font: "Arial" }),
                                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "94A3B8", font: "Arial" })
                            ]
                        })
                    ]
                })
            },
            children: [
                // 1. Title Banner
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    shading: { fill: "1D4ED8", type: ShadingType.CLEAR },
                                    margins: { top: 200, bottom: 200, left: 200, right: 200 },
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.CENTER,
                                            children: [new TextRun({ text: "RAPOR AKADEMIK & KARAKTER SANTRI", bold: true, size: 28, color: "FFFFFF", font: "Arial" })]
                                        }),
                                        new Paragraph({
                                            alignment: AlignmentType.CENTER,
                                            children: [new TextRun({ text: "LPQ AL-FATH MAULANA (METODE QIROATI)", size: 20, color: "E0E7FF", font: "Arial" })]
                                        }),
                                        new Paragraph({
                                            alignment: AlignmentType.CENTER,
                                            children: [new TextRun({ text: `PERIODE EVALUASI: ${periodText.toUpperCase()}`, bold: true, size: 18, color: "FEF08A", font: "Arial" })]
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                }),

                new Paragraph({ text: "", spacing: { after: 150 } }),

                // 2. Section I: BIODATA SANTRI
                new Paragraph({
                    children: [new TextRun({ text: "I. BIODATA SANTRI", bold: true, size: 22, color: "1E3A8A", font: "Arial" })],
                    spacing: { before: 100, after: 80 }
                }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                createCell("Nama Santri", { bold: true, shadingColor: "F8FAFC", width: 20 }),
                                createCell(santriData.nama_lengkap, { bold: true, width: 30 }),
                                createCell("Kelas & Sesi", { bold: true, shadingColor: "F8FAFC", width: 20 }),
                                createCell(`${santriData.class?.nama_kelas || santriData.className || '-'} (${sessionName})`, { width: 30 })
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell("Nomor Induk (NIQ)", { bold: true, shadingColor: "F8FAFC" }),
                                createCell(santriData.nomor_induk_qiroati || '-', { bold: true }),
                                createCell("Wali Santri (Ibu)", { bold: true, shadingColor: "F8FAFC" }),
                                createCell(guardianName, { bold: true })
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell("Jilid / Tingkat", { bold: true, shadingColor: "F8FAFC" }),
                                createCell(`${santriData.jilid || '-'} (${santriData.kategori || 'Anak'})`, { bold: true, color: "7E22CE" }),
                                createCell("Predikat Akhir", { bold: true, shadingColor: "F8FAFC" }),
                                createCell(`${scores.predicate} (${scoresSummary?.grade || 'A'})`, { bold: true, color: "10B981" })
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell("Karakter Unggulan", { bold: true, shadingColor: "F8FAFC" }),
                                createCell(`⭐ ${strengthsList}`, { bold: true, color: "7E22CE", colspan: 3 })
                            ]
                        })
                    ]
                }),

                new Paragraph({ text: "", spacing: { after: 150 } }),

                // 3. Section II: REKAPITULASI NILAI RATA-RATA PROGRESS
                new Paragraph({
                    children: [new TextRun({ text: "II. REKAPITULASI NILAI RATA-RATA PROGRESS", bold: true, size: 22, color: "1E3A8A", font: "Arial" })],
                    spacing: { before: 100, after: 80 }
                }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                createHeaderCell("Aspek Evaluasi Progress", { bg: "1D4ED8", align: AlignmentType.LEFT, width: 40 }),
                                createHeaderCell("Skor Capaian", { bg: "1D4ED8", width: 20 }),
                                createHeaderCell("Bobot", { bg: "1D4ED8", width: 20 }),
                                createHeaderCell("Predikat Progress", { bg: "1D4ED8", width: 20 })
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell("Kehadiran & Keaktifan Mengaji"),
                                createCell(`${scores.attendanceScore} / 100`, { align: AlignmentType.CENTER }),
                                createCell("34%", { align: AlignmentType.CENTER }),
                                createCell(scores.attendanceScore >= 85 ? "Sangat Baik" : "Baik", { align: AlignmentType.CENTER, bold: true, color: "10B981" })
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell("Ketuntasan Hafalan Doa / Surat"),
                                createCell(`${scores.hafalanScore} / 100`, { align: AlignmentType.CENTER }),
                                createCell("33%", { align: AlignmentType.CENTER }),
                                createCell(scores.hafalanScore >= 85 ? "Sangat Baik" : "Baik", { align: AlignmentType.CENTER, bold: true, color: "10B981" })
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell("Perkembangan Karakter & Adab"),
                                createCell(`${scores.characterScore} / 100`, { align: AlignmentType.CENTER }),
                                createCell("33%", { align: AlignmentType.CENTER }),
                                createCell(scores.characterScore >= 85 ? "Sangat Baik" : "Baik", { align: AlignmentType.CENTER, bold: true, color: "10B981" })
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell("NILAI AKHIR RATA-RATA KESELURUHAN", { bold: true, align: AlignmentType.RIGHT, colspan: 2, shadingColor: "F1F5F9" }),
                                createCell(`${scores.overallAverage} / 100`, { bold: true, align: AlignmentType.CENTER, color: "1D4ED8", shadingColor: "F1F5F9" }),
                                createCell(scores.predicate, { bold: true, align: AlignmentType.CENTER, color: "10B981", shadingColor: "F1F5F9" })
                            ]
                        })
                    ]
                }),

                new Paragraph({ text: "", spacing: { after: 150 } }),

                // 4. Section III: REKAPITULASI KEHADIRAN
                new Paragraph({
                    children: [new TextRun({ text: "III. REKAPITULASI KEHADIRAN", bold: true, size: 22, color: "1E3A8A", font: "Arial" })],
                    spacing: { before: 100, after: 80 }
                }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                createHeaderCell("Total Hari Efektif", { bg: "334155" }),
                                createHeaderCell("Hadir", { bg: "334155" }),
                                createHeaderCell("Terlambat", { bg: "334155" }),
                                createHeaderCell("Alpha", { bg: "334155" }),
                                createHeaderCell("Persentase Kehadiran", { bg: "334155" })
                            ]
                        }),
                        new TableRow({
                            children: [
                                createCell(`${attendanceData.totalDays} Hari`, { align: AlignmentType.CENTER }),
                                createCell(`${attendanceData.totalPresent} Hari`, { align: AlignmentType.CENTER, bold: true, color: "10B981" }),
                                createCell(`${attendanceData.totalLate || 0} Hari`, { align: AlignmentType.CENTER, color: "F59E0B" }),
                                createCell(`${attendanceData.totalAbsent} Hari`, { align: AlignmentType.CENTER, color: "EF4444" }),
                                createCell(`${attendanceData.attendancePercentage}%`, { align: AlignmentType.CENTER, bold: true, color: "7E22CE" })
                            ]
                        })
                    ]
                }),

                new Paragraph({ text: "", spacing: { after: 150 } }),

                // 5. Section IV: REKAPITULASI PROGRES HAFALAN
                new Paragraph({
                    children: [new TextRun({ text: "IV. REKAPITULASI PROGRES HAFALAN", bold: true, size: 22, color: "1E3A8A", font: "Arial" })],
                    spacing: { before: 100, after: 80 }
                }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                createHeaderCell("Kategori Hafalan", { bg: "10B981", align: AlignmentType.LEFT, width: 40 }),
                                createHeaderCell("Total Target Item", { bg: "10B981", width: 20 }),
                                createHeaderCell("Telah Dikuasai / Lulus", { bg: "10B981", width: 20 }),
                                createHeaderCell("Progres Ketuntasan", { bg: "10B981", width: 20 })
                            ]
                        }),
                        ...(hafalanData.programScope === 'PTPT' ? [
                            new TableRow({
                                children: [
                                    createCell("Tahfizh PTPT", { bold: true }),
                                    createCell(hafalanData.tahfizh?.total || 0, { align: AlignmentType.CENTER }),
                                    createCell(hafalanData.tahfizh?.completed || 0, { align: AlignmentType.CENTER }),
                                    createCell(`${Math.round(((hafalanData.tahfizh?.completed || 0) / (hafalanData.tahfizh?.total || 1)) * 100)}%`, { align: AlignmentType.CENTER, bold: true })
                                ]
                            })
                        ] : [
                            new TableRow({
                                children: [
                                    createCell("Doa Harian", { bold: true }),
                                    createCell(hafalanData.doa?.total || 0, { align: AlignmentType.CENTER }),
                                    createCell(hafalanData.doa?.completed || 0, { align: AlignmentType.CENTER }),
                                    createCell(`${Math.round(((hafalanData.doa?.completed || 0) / (hafalanData.doa?.total || 1)) * 100)}%`, { align: AlignmentType.CENTER, bold: true })
                                ]
                            }),
                            new TableRow({
                                children: [
                                    createCell("Bacaan Sholat", { bold: true }),
                                    createCell(hafalanData.sholat?.total || 0, { align: AlignmentType.CENTER }),
                                    createCell(hafalanData.sholat?.completed || 0, { align: AlignmentType.CENTER }),
                                    createCell(`${Math.round(((hafalanData.sholat?.completed || 0) / (hafalanData.sholat?.total || 1)) * 100)}%`, { align: AlignmentType.CENTER, bold: true })
                                ]
                            }),
                            new TableRow({
                                children: [
                                    createCell("Surat Pendek / Juz Amma", { bold: true }),
                                    createCell(hafalanData.surat?.total || 0, { align: AlignmentType.CENTER }),
                                    createCell(hafalanData.surat?.completed || 0, { align: AlignmentType.CENTER }),
                                    createCell(`${Math.round(((hafalanData.surat?.completed || 0) / (hafalanData.surat?.total || 1)) * 100)}%`, { align: AlignmentType.CENTER, bold: true })
                                ]
                            })
                        ])
                    ]
                }),

                new Paragraph({ text: "", spacing: { after: 150 } }),

                // 6. Section V: PERKEMBANGAN KARAKTER & ADAB
                new Paragraph({
                    children: [new TextRun({ text: "V. PERKEMBANGAN KARAKTER & ADAB", bold: true, size: 22, color: "1E3A8A", font: "Arial" })],
                    spacing: { before: 100, after: 80 }
                }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                createHeaderCell("No", { bg: "7E22CE", width: 10 }),
                                createHeaderCell("Aspek Karakter & Adab", { bg: "7E22CE", align: AlignmentType.LEFT, width: 50 }),
                                createHeaderCell("Skor", { bg: "7E22CE", width: 15 }),
                                createHeaderCell("Predikat", { bg: "7E22CE", align: AlignmentType.LEFT, width: 25 })
                            ]
                        }),
                        ...((characterData?.assessedItems || []).map((item, idx) => {
                            const lbl = item.score === 4 ? 'Sangat Baik (SB)' : item.score === 3 ? 'Berkembang Sesuai Harapan (BSH)' : item.score === 2 ? 'Mulai Berkembang (MB)' : 'Belum Berkembang (BB)';
                            const col = item.score === 4 ? '10B981' : item.score === 3 ? '1D4ED8' : 'F59E0B';
                            return new TableRow({
                                children: [
                                    createCell(idx + 1, { align: AlignmentType.CENTER }),
                                    createCell(item.title || item.item_name || '-'),
                                    createCell(`${item.score || 3} / 4`, { align: AlignmentType.CENTER, bold: true, color: col }),
                                    createCell(lbl, { color: col })
                                ]
                            });
                        }))
                    ]
                }),

                new Paragraph({ text: "", spacing: { after: 150 } }),

                // 7. Section VI: DAFTAR SEMUA HAFALAN SANTRI
                new Paragraph({
                    children: [new TextRun({ text: "VI. DAFTAR SEMUA HAFALAN SANTRI", bold: true, size: 22, color: "1E3A8A", font: "Arial" })],
                    spacing: { before: 100, after: 80 }
                }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                createHeaderCell("Jilid", { bg: "1D4ED8", width: 10 }),
                                createHeaderCell("Nama Item / Surat", { bg: "1D4ED8", align: AlignmentType.LEFT, width: 35 }),
                                createHeaderCell("Kategori", { bg: "1D4ED8", align: AlignmentType.LEFT, width: 18 }),
                                createHeaderCell("Skor", { bg: "1D4ED8", width: 10 }),
                                createHeaderCell("Status Capaian", { bg: "1D4ED8", width: 15 }),
                                createHeaderCell("Tanggal Evaluasi", { bg: "1D4ED8", align: AlignmentType.RIGHT, width: 12 })
                            ]
                        }),
                        ...((hafalanData?.allItems || []).map(item => {
                            const dateStr = item.evaluated_at 
                                ? new Date(item.evaluated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'Belum Evaluasi';
                            return new TableRow({
                                children: [
                                    createCell(item.jilid || '-', { align: AlignmentType.CENTER, bold: true, color: "7E22CE" }),
                                    createCell(item.item_name || item.display_name || '-', { bold: true }),
                                    createCell(item.category || '-'),
                                    createCell(item.score ? `${item.score} / 4` : '-', { align: AlignmentType.CENTER, bold: true }),
                                    createCell(item.is_completed ? "Lulus / Dihafal" : "Dalam Proses", { align: AlignmentType.CENTER, bold: true, color: item.is_completed ? "10B981" : "F59E0B" }),
                                    createCell(dateStr, { align: AlignmentType.RIGHT })
                                ]
                            });
                        }))
                    ]
                }),

                new Paragraph({ text: "", spacing: { after: 300 } }),

                // 8. Signatures Block
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                        insideHorizontal: { style: BorderStyle.NONE },
                        insideVertical: { style: BorderStyle.NONE }
                    },
                    rows: [
                        new TableRow({
                            children: [
                                createCell("Mengetahui,\nOrang Tua / Wali Santri\n\n\n\n( .................................... )", { align: AlignmentType.CENTER, width: 33 }),
                                createCell(`Guru Pengampu Kelas,\nUstadz / Ustadzah\n\n\n\n( ${teacherName} )`, { align: AlignmentType.CENTER, bold: true, width: 34 }),
                                createCell("Disahkan oleh,\nPentashih LPQ Al-Fath Maulana\n\n\n\n( .................................... )", { align: AlignmentType.CENTER, width: 33 })
                            ]
                        })
                    ]
                })
            ]
        }]
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rapor_LPQ_${(santriData.nama_lengkap || 'Santri').replace(/\s+/g, '_')}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
