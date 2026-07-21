import { supabase } from '@/lib/customSupabaseClient';

/**
 * STEP 1 & 2 - USER CONTEXT & SCHEMA VERIFICATION
 */
export const getSantriDiagnosticData = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;

        if (!uid) {
            return { error: 'No authenticated user found' };
        }

        const { data: santri, error: santriErr } = await supabase.from('santri').select('*').eq('id', uid).single();

        let classData = null;
        let guruData = null;

        if (santri?.current_class_id) {
            const { data: c } = await supabase.from('classes').select('*').eq('id', santri.current_class_id).single();
            classData = c;

            if (c?.id_guru) {
                const { data: g } = await supabase.from('guru').select('*').eq('id', c.id_guru).single();
                guruData = g;
            }
        }

        const { data: attendance } = await supabase.from('attendance').select('*').eq('user_id', uid);
        const { data: payments } = await supabase.from('payments').select('*').eq('santri_id', uid);
        const { data: policies } = await supabase.rpc('get_diagnostic_rls_policies');

        return {
            uid,
            santri,
            classData,
            guruData,
            attendanceRecords: attendance || [],
            paymentsRecords: payments || [],
            policies: policies || [],
            errors: { santri: santriErr }
        };
    } catch (err) {
        console.error("Error in getSantriDiagnosticData:", err);
        return { error: err.message };
    }
};

/**
 * STEP 5 - IDENTIFY EXACT PROBLEMS (DataAccess)
 */
export const verifyDataAccess = async (uid) => {
    const access = {
        santri: false,
        classes: false,
        attendance: false,
        payments: false
    };

    if (!uid) return access;

    const [s, c, a, p] = await Promise.all([
        supabase.from('santri').select('id').eq('id', uid).limit(1),
        supabase.from('classes').select('id').limit(1),
        supabase.from('attendance').select('id').eq('user_id', uid).limit(1),
        supabase.from('payments').select('id').eq('santri_id', uid).limit(1)
    ]);

    access.santri = !s.error;
    access.classes = !c.error;
    access.attendance = !a.error;
    access.payments = !p.error;

    return access;
};

/**
 * STEP 4 - COMPONENT QUERY ANALYSIS
 */
export const verifyComponentQueries = async (uid) => {
    const results = {
        absensiRecap: { valid: false, dataCount: 0, error: null },
        paymentHistory: { valid: false, dataCount: 0, error: null }
    };

    if (!uid) return results;

    // Simulate SantriAbsensiRecap query
    const { data: attData, error: attErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', uid)
        .order('attendance_date', { ascending: false });

    if (attErr) {
        results.absensiRecap.error = attErr.message;
    } else {
        results.absensiRecap.valid = true;
        results.absensiRecap.dataCount = attData.length;
    }

    // Simulate SantriPaymentHistory query
    const { data: payData, error: payErr } = await supabase
        .from('payments')
        .select('*')
        .eq('santri_id', uid)
        .order('tanggal_pembayaran', { ascending: false });

    if (payErr) {
        results.paymentHistory.error = payErr.message;
    } else {
        results.paymentHistory.valid = true;
        results.paymentHistory.dataCount = payData.length;
    }

    return results;
};

/**
 * STEP 6 - DATA FLOW DIAGRAM
 */
export const getCompleteDataFlowDiagram = () => {
    return `
=== DATA FLOW DIAGRAM ===
[1] ATTENDANCE: public.attendance -> RLS (user_id = auth.uid()) -> supabase.from('attendance').select('*').eq('user_id', uid) -> <SantriAbsensiRecap />
[2] PAYMENTS: public.payments -> RLS (santri_id = auth.uid()) -> supabase.from('payments').select('*').eq('santri_id', uid) -> <SantriPaymentHistory />
[3] CLASSES: public.classes -> RLS -> santri.current_class_id -> <SantriDashboard />
[4] SANTRI: public.santri -> RLS (auth.uid() = id) -> supabase.from('santri').select('*, class(...)').eq('id', uid) -> <SantriDashboard />
=========================
    `;
};

/**
 * STEP 5 - IDENTIFY ALL PROBLEMS
 */
export const identifyAllProblems = async (uid) => {
    const problems = [];
    if (!uid) {
        problems.push("CRITICAL: User ID (auth.uid()) is missing or session is invalid.");
        return problems;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (token === 'mock-token-manual-login') {
        problems.push("WARNING: User is using a MOCK TOKEN from legacy login. RLS will evaluate auth.uid() as NULL and block data access.");
    }

    const dataAccess = await verifyDataAccess(uid);
    if (!dataAccess.attendance) problems.push("ERROR: Cannot access attendance table. Possible RLS issue.");
    if (!dataAccess.payments) problems.push("ERROR: Cannot access payments table. Possible RLS issue.");

    const queries = await verifyComponentQueries(uid);
    if (queries.absensiRecap.error) problems.push(`ERROR in Absensi Query: ${queries.absensiRecap.error}`);
    if (queries.paymentHistory.error) problems.push(`ERROR in Payments Query: ${queries.paymentHistory.error}`);

    if (problems.length === 0) {
        problems.push("SUCCESS: No data flow problems detected. Queries execute successfully.");
    }

    return problems;
};

export const runFullDiagnostic = async () => {
    const rawData = await getSantriDiagnosticData();
    if (rawData.error) return { error: rawData.error };

    const access = await verifyDataAccess(rawData.uid);
    const queries = await verifyComponentQueries(rawData.uid);
    const problems = await identifyAllProblems(rawData.uid);
    const diagram = getCompleteDataFlowDiagram();

    return {
        rawData,
        access,
        queries,
        problems,
        diagram
    };
};
