
import { supabase } from '../lib/customSupabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const calculateAttendanceData = async (santriId, startDate, endDate) => {
    try {
        let query = supabase.from('attendance').select('status, attendance_date, check_in_timestamp, class_id').eq('user_id', santriId);

        if (startDate) query = query.gte('attendance_date', startDate);
        if (endDate) query = query.lte('attendance_date', endDate);

        const { data, error } = await query;
        if (error) throw error;

        const totalPresent = data.filter(d => d.status.toLowerCase() === 'hadir').length;
        const totalLate = data.filter(d => d.status.toLowerCase() === 'terlambat').length;
        const totalAbsent = data.filter(d => d.status.toLowerCase() === 'alpha' || d.status.toLowerCase() === 'tidak hadir').length;
        const totalPermit = data.filter(d => ['izin', 'sakit'].includes(d.status.toLowerCase())).length;

        // Total valid attendance days
        const validPresence = totalPresent + totalLate;
        const totalDays = validPresence + totalAbsent + totalPermit;

        const attendancePercentage = totalDays > 0 ? Math.round((validPresence / totalDays) * 100) : 0;

        return {
            totalPresent,
            totalLate,
            totalAbsent,
            totalPermit,
            totalDays,
            attendancePercentage,
            attendanceData: data
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
            .select('kategori')
            .eq('id', santriId)
            .single();
        if (santriError) throw santriError;
        const programScope = String(santri?.kategori || '').toUpperCase() === 'PTPT' ? 'PTPT' : 'TPQ';

        const [itemsRes, progressRes] = await Promise.all([
            supabase.from('hafalan_items').select('id,program_scope,category,jilid,item_name,item_order,is_active,created_at').eq('program_scope', programScope).eq('is_active', true).order('item_order'),
            supabase.from('hafalan_progress').select('id,santri_id,item_id,category,item_name,status,score,created_at,updated_at').eq('santri_id', santriId)
        ]);

        if (itemsRes.error) throw itemsRes.error;
        if (progressRes.error) throw progressRes.error;

        const progressByItemId = new Map((progressRes.data || []).filter(item => item.item_id).map(item => [item.item_id, item]));
        const progressByName = new Map((progressRes.data || []).map(item => [`${item.category}-${item.item_name}`, item]));
        const allItems = (itemsRes.data || []).map(item => {
            const progress = progressByItemId.get(item.id) || progressByName.get(`${item.category}-${item.item_name}`);
            return {
                ...item,
                ...progress,
                id: progress?.id || item.id,
                item_id: item.id,
                category: item.category,
                item_name: item.item_name,
                is_completed: progress?.status === 'lulus',
                hafal: progress?.status === 'lulus',
                display_name: item.item_name,
                created_at: progress?.updated_at || progress?.created_at || item.created_at
            };
        });

        const doa = allItems.filter(d => d.category === 'Doa');
        const sholat = allItems.filter(d => d.category === 'Sholat');
        const surat = allItems.filter(d => d.category === 'Surat');
        const tahfizh = allItems.filter(d => d.category === 'Tahfizh');

        const getCompleted = (arr) => arr.filter(d => d.is_completed).length;

        return {
            doa: { total: doa.length, completed: getCompleted(doa), items: doa },
            sholat: { total: sholat.length, completed: getCompleted(sholat), items: sholat },
            surat: { total: surat.length, completed: getCompleted(surat), items: surat },
            tahfizh: { total: tahfizh.length, completed: getCompleted(tahfizh), items: tahfizh },
            programScope,
            totalCompleted: getCompleted(allItems),
            overallProgress: allItems.length > 0 ? Math.round((getCompleted(allItems) / allItems.length) * 100) : 0,
            allItems: allItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        };
    } catch (error) {
        console.error("Error fetching hafalan progress:", error);
        throw new Error("Gagal mengambil data hafalan.");
    }
};

export const getPointsData = async (santriId, startDate, endDate) => {
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

export const generateRaporPDF = async (santriData, attendanceData, hafalanData, pointsData, periodText) => {
    return new Promise((resolve) => {
        const doc = new jsPDF('p', 'mm', 'a4');

        // --- Colors ---
        const primaryColor = [63, 114, 175]; // Blue
        const secondaryColor = [44, 62, 80]; // Dark Navy
        const successColor = [39, 174, 96]; // Green
        const warningColor = [243, 156, 18]; // Yellow/Orange
        const dangerColor = [231, 76, 60]; // Red

        // --- Header Section ---
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 45, 'F');

        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text("RAPOR RINGKAS SANTRI", 105, 20, { align: "center" });

        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text("LPQ Al-Fath Maulana", 105, 28, { align: "center" });

        doc.setFontSize(11);
        doc.setTextColor(230, 240, 250);
        doc.text(`Periode: ${periodText}`, 105, 36, { align: "center" });

        // --- Student Info Section ---
        doc.setTextColor(...secondaryColor);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("Informasi Santri", 20, 60);

        doc.setDrawColor(189, 195, 199);
        doc.setLineWidth(0.5);
        doc.line(20, 62, 190, 62);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(52, 73, 94);

        // Left Column
        doc.text(`Nama Lengkap`, 20, 70);
        doc.text(`: ${santriData.nama_lengkap}`, 55, 70);
        doc.text(`Jilid Saat Ini`, 20, 77);
        doc.text(`: ${santriData.jilid || '-'}`, 55, 77);
        doc.text(`Kelas / Sesi`, 20, 84);
        doc.text(`: ${santriData.class?.nama_kelas || '-'} / ${santriData.sesi_mengaji || '-'}`, 55, 84);

        // Right Column
        doc.text(`Jenis Kelamin`, 110, 70);
        doc.text(`: ${santriData.jenis_kelamin || '-'}`, 140, 70);
        doc.text(`Wali Santri`, 110, 77);
        doc.text(`: ${santriData.nama_ayah || santriData.nama_ibu || '-'}`, 140, 77);
        doc.text(`No. HP`, 110, 84);
        doc.text(`: ${santriData.no_hp_ortu || '-'}`, 140, 84);

        // --- Attendance Section ---
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryColor);
        doc.text("Ringkasan Absensi", 20, 100);

        // Determine attendance color
        let attColor = successColor;
        if (attendanceData.attendancePercentage < 70) attColor = dangerColor;
        else if (attendanceData.attendancePercentage < 85) attColor = warningColor;

        doc.autoTable({
            startY: 105,
            head: [['Hadir', 'Terlambat', 'Izin / Sakit', 'Alpha', 'Persentase Kehadiran']],
            body: [[
                `${attendanceData.totalPresent} Hari`,
                `${attendanceData.totalLate} Hari`,
                `${attendanceData.totalPermit} Hari`,
                `${attendanceData.totalAbsent} Hari`,
                { content: `${attendanceData.attendancePercentage}%`, styles: { textColor: attColor, fontStyle: 'bold' } }
            ]],
            theme: 'grid',
            headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', halign: 'center' },
            bodyStyles: { textColor: 50, halign: 'center' },
            styles: { fontSize: 11, cellPadding: 6 }
        });

        // --- Hafalan Overview Section ---
        const finalY = doc.lastAutoTable.finalY || 135;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryColor);
        doc.text("Progres Hafalan Keseluruhan", 20, finalY + 15);

        doc.autoTable({
            startY: finalY + 20,
            head: [['Kategori Hafalan', 'Total Item', 'Telah Dihafal', 'Sisa Item']],
            body: hafalanData.programScope === 'PTPT'
                ? [['Tahfizh PTPT', hafalanData.tahfizh.total, hafalanData.tahfizh.completed, hafalanData.tahfizh.total - hafalanData.tahfizh.completed]]
                : [
                    ['Doa Harian', hafalanData.doa.total, hafalanData.doa.completed, hafalanData.doa.total - hafalanData.doa.completed],
                    ['Bacaan Sholat', hafalanData.sholat.total, hafalanData.sholat.completed, hafalanData.sholat.total - hafalanData.sholat.completed],
                    ['Surat Pendek', hafalanData.surat.total, hafalanData.surat.completed, hafalanData.surat.total - hafalanData.surat.completed]
                ],
            theme: 'grid',
            headStyles: { fillColor: successColor, textColor: 255, fontStyle: 'bold' },
            bodyStyles: { textColor: 50, halign: 'center' },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
            styles: { fontSize: 11, cellPadding: 6 }
        });

        // --- Hafalan Detail Section ---
        let detailY = doc.lastAutoTable.finalY || 180;

        if (detailY > 220) {
            doc.addPage();
            detailY = 20;
        } else {
            detailY += 15;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryColor);
        doc.text("Detail Hafalan (Semua Kategori)", 20, detailY);

        const allRows = hafalanData.allItems.map(item => [
            item.display_name || '-',
            item.category || '-',
            item.is_completed ? 'Lulus / Selesai' : 'Belum Lulus',
            new Date(item.created_at).toLocaleDateString('id-ID')
        ]);

        if (allRows.length > 0) {
            doc.autoTable({
                startY: detailY + 5,
                head: [['Nama Item', 'Kategori', 'Status Hafalan', 'Tanggal Update']],
                body: allRows,
                theme: 'striped',
                headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' },
                bodyStyles: { textColor: 50 },
                didParseCell: function (data) {
                    if (data.section === 'body' && data.column.index === 2) {
                        if (data.cell.raw === 'Lulus / Selesai') {
                            data.cell.styles.textColor = successColor;
                            data.cell.styles.fontStyle = 'bold';
                        } else {
                            data.cell.styles.textColor = dangerColor;
                        }
                    }
                },
                styles: { fontSize: 10, cellPadding: 4 }
            });
            detailY = doc.lastAutoTable.finalY + 10;
        } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 100, 100);
            doc.text("Belum ada data hafalan yang tercatat.", 20, detailY + 10);
            detailY += 15;
        }

        // --- Points & Rewards ---
        if (detailY > 240) {
            doc.addPage();
            detailY = 20;
        } else {
            detailY += 10;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryColor);
        doc.text("Pencapaian & Poin", 20, detailY);

        doc.setFillColor(241, 196, 15);
        doc.rect(20, detailY + 5, 170, 15, 'F');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Total Poin Santri: ${pointsData.totalPoints} Poin Bintang`, 25, detailY + 14);

        // --- Footer ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const bottomY = 285;
            doc.setDrawColor(189, 195, 199);
            doc.setLineWidth(0.5);
            doc.line(20, bottomY - 10, 190, bottomY - 10);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(127, 140, 141);
            doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 20, bottomY);
            doc.text(`Halaman ${i} dari ${pageCount}`, 105, bottomY, { align: 'center' });
            doc.text(`Oleh: Sistem Akademik LPQ Al-Fath Maulana`, 190, bottomY, { align: 'right' });
        }

        resolve(doc);
    });
};
