
import { supabase } from '../lib/customSupabaseClient';

/**
 * Verifies Santri Data Sources, Structure, and Authentication Integrity.
 * Executes queries to check data completeness, constraints, and relationships.
 *
 * @returns {Promise<Object>} Comprehensive verification report
 */
export async function verifySantriDataSources() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      schemaAnalysis: null,
      dataVerification: {
        totalRecords: 0,
        completeness: {},
        duplicates: { nama_panggilan: [], nomor_induk_qiroati: [] },
        samples: []
      },
      relationshipAnalysis: null,
      issuesFound: [],
      recommendations: []
    };

    // 1. Data Verification: Fetch all santri data to perform analysis locally
    // (Using a single large query since typical santri counts are manageable, else paginate)
    const { data: allSantri, error: fetchError } = await supabase
      .from('santri')
      .select('*, class:classes!santri_current_class_id_fkey(nama_kelas, sesi)');

    if (fetchError) {
      throw new Error(`Failed to fetch santri data: ${fetchError.message}`);
    }

    report.dataVerification.totalRecords = allSantri.length;

    // 2. Schema Inference (Inferring from fetched data keys, as information_schema is often restricted on client REST)
    if (allSantri.length > 0) {
      const sampleRow = allSantri[0];
      report.schemaAnalysis = {
        tableName: 'santri',
        columnsDetected: Object.keys(sampleRow).filter(k => k !== 'class'),
        inferredTypes: Object.keys(sampleRow).reduce((acc, key) => {
          acc[key] = typeof sampleRow[key];
          return acc;
        }, {})
      };
    }

    // 3. Completeness & Duplicate Analysis
    let nullNamaPanggilan = 0;
    let nullNoInduk = 0;
    let nullKategori = 0;
    const nameMap = {};
    const noIndukMap = {};

    allSantri.forEach(santri => {
      // Completeness Checks
      if (!santri.nama_panggilan) nullNamaPanggilan++;
      if (!santri.nomor_induk_qiroati) nullNoInduk++;
      if (!santri.kategori) nullKategori++;

      // Duplicates Check - Nama Panggilan
      if (santri.nama_panggilan) {
        const nameLower = santri.nama_panggilan.toLowerCase();
        if (nameMap[nameLower]) {
          nameMap[nameLower].push(santri.id);
        } else {
          nameMap[nameLower] = [santri.id];
        }
      }

      // Duplicates Check - Nomor Induk
      if (santri.nomor_induk_qiroati) {
        if (noIndukMap[santri.nomor_induk_qiroati]) {
          noIndukMap[santri.nomor_induk_qiroati].push(santri.id);
        } else {
          noIndukMap[santri.nomor_induk_qiroati] = [santri.id];
        }
      }
    });

    report.dataVerification.completeness = {
      missingNamaPanggilan: nullNamaPanggilan,
      missingNomorIndukQiroati: nullNoInduk,
      missingKategori: nullKategori,
      validLoginCredentialsCount: allSantri.length - Math.max(nullNamaPanggilan, nullNoInduk)
    };

    // Filter out unique values to find actual duplicates
    report.dataVerification.duplicates.nama_panggilan = Object.entries(nameMap)
      .filter(([_, ids]) => ids.length > 1)
      .map(([name, ids]) => ({ name, count: ids.length, ids }));

    report.dataVerification.duplicates.nomor_induk_qiroati = Object.entries(noIndukMap)
      .filter(([_, ids]) => ids.length > 1)
      .map(([noInduk, ids]) => ({ noInduk, count: ids.length, ids }));

    // 4. Sample Generation (10 items)
    report.dataVerification.samples = allSantri.slice(0, 10).map(s => ({
      id: s.id,
      nama_lengkap: s.nama_lengkap,
      nama_panggilan: s.nama_panggilan,
      nomor_induk_qiroati: s.nomor_induk_qiroati,
      kategori: s.kategori,
      current_class_id: s.current_class_id,
      class_info: s.class
    }));

    // 5. Relationship Analysis
    const santriWithClass = allSantri.filter(s => s.current_class_id !== null);
    const validClassLinks = santriWithClass.filter(s => s.class !== null).length;
    const brokenClassLinks = santriWithClass.length - validClassLinks;

    report.relationshipAnalysis = {
      foreignKeys: [
        {
          column: 'current_class_id',
          references: 'classes(id)',
          totalLinked: santriWithClass.length,
          validLinks: validClassLinks,
          brokenLinks: brokenClassLinks
        }
      ],
      authLink: "Santri login uses the signin-with-nomor-induk Edge Function and returns an official Supabase Auth session."
    };

    // 6. Identify Issues
    if (nullNamaPanggilan > 0) {
      report.issuesFound.push(`${nullNamaPanggilan} santri records are missing 'nama_panggilan'. They cannot log in using the TPQ logic.`);
    }
    if (nullNoInduk > 0) {
      report.issuesFound.push(`${nullNoInduk} santri records are missing 'nomor_induk_qiroati'. They cannot log in using the TPQ logic.`);
    }
    if (brokenClassLinks > 0) {
      report.issuesFound.push(`Found ${brokenClassLinks} santri records with a 'current_class_id' that does not exist in the 'classes' table.`);
    }

    // 7. Recommendations
    report.recommendations = [
      "Ensure all active santri have a unique 'nomor_induk_qiroati'; duplicate display names are allowed.",
      "Clean up broken foreign key references in 'current_class_id'.",
      "Regularly audit NULL values in credential columns if the santri status is 'Aktif'."
    ];

    console.log("Verification Report Generated:", report);
    return report;

  } catch (error) {
    console.error("Verification failed:", error);
    return {
      error: true,
      message: error.message
    };
  }
}
