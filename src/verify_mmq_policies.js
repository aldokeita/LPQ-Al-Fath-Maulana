import { supabase } from './lib/customSupabaseClient';

/**
 * Utility to verify RLS policies for MMQ tables
 * Run this function in the browser console or attach it to a temporary UI button
 *
 * Usage in console:
 * import { runMmqPolicyVerification } from './verify_mmq_policies.js';
 * runMmqPolicyVerification();
 */
export const runMmqPolicyVerification = async () => {
    console.log("==========================================");
    console.log("STARTING MMQ RLS POLICY VERIFICATION");
    console.log("==========================================");

    try {
        // Get current user session to determine context
        const { data: { session } } = await supabase.auth.getSession();

        let currentUserRole = 'anon';
        if (session) {
            // Failsafe admin check based on email (similar to get_user_role RPC)
            if (session.user.email === 'admin-demo@example.invalid') {
                currentUserRole = 'admin';
            } else {
                currentUserRole = session.user.user_metadata?.role || 'authenticated (guru/santri)';
            }
        }

        console.log(`Current Auth Context: ${currentUserRole}`);
        console.log(`User ID: ${session?.user?.id || 'None'}`);
        console.log("------------------------------------------");

        // Test 1: SELECT access for public users (should work for anyone)
        console.log("Test 1: SELECT access for mmq_schedule");
        const { data: schedData, error: schError } = await supabase.from('mmq_schedule').select('*').limit(1);
        if (schError) {
            console.error("❌ FAILED - Could not read mmq_schedule:", schError.message);
        } else {
            console.log(`✅ PASSED - Read mmq_schedule successfully. Rows found: ${schedData.length}`);
        }

        // Dummy data for write tests
        const dummySchedule = {
            day_of_week: 1, // Monday
            start_time: '08:00:00',
            location: 'Test Location',
            is_active: false
        };

        // Test 2 & 3: INSERT access for mmq_schedule
        console.log("\nTest 2 & 3: INSERT access for mmq_schedule");
        const { data: insData, error: insError } = await supabase.from('mmq_schedule').insert(dummySchedule).select().maybeSingle();

        if (currentUserRole === 'admin') {
            if (insError) console.error("❌ FAILED (Admin) - Should be able to insert, but got error:", insError.message);
            else console.log("✅ PASSED (Admin) - Successfully inserted record. ID:", insData.id);
        } else {
            if (insError) console.log("✅ PASSED (Non-Admin) - Correctly blocked from inserting:", insError.message);
            else console.error("❌ FAILED (Non-Admin) - Security breach! Non-admin was able to insert.");
        }

        // Test 4 & 5: UPDATE access for mmq_schedule
        if (insData && insData.id) {
            console.log("\nTest 4 & 5: UPDATE access for mmq_schedule");
            const { error: updError } = await supabase.from('mmq_schedule').update({ location: 'Updated Location' }).eq('id', insData.id);

            if (currentUserRole === 'admin') {
                if (updError) console.error("❌ FAILED (Admin) - Should be able to update, but got error:", updError.message);
                else console.log("✅ PASSED (Admin) - Successfully updated record.");
            } else {
                if (updError) console.log("✅ PASSED (Non-Admin) - Correctly blocked from updating:", updError.message);
                else console.error("❌ FAILED (Non-Admin) - Security breach! Non-admin was able to update.");
            }

            // Test 6 & 7: DELETE access for mmq_schedule
            console.log("\nTest 6 & 7: DELETE access for mmq_schedule");
            const { error: delError } = await supabase.from('mmq_schedule').delete().eq('id', insData.id);

            if (currentUserRole === 'admin') {
                if (delError) console.error("❌ FAILED (Admin) - Should be able to delete, but got error:", delError.message);
                else console.log("✅ PASSED (Admin) - Successfully deleted cleanup record.");
            } else {
                if (delError) console.log("✅ PASSED (Non-Admin) - Correctly blocked from deleting:", delError.message);
                else console.error("❌ FAILED (Non-Admin) - Security breach! Non-admin was able to delete.");
            }
        } else if (currentUserRole === 'admin') {
            console.log("\n⚠️ Skipping Update/Delete tests because Insert failed.");
        }

        console.log("==========================================");
        console.log("VERIFICATION COMPLETE");
        console.log("==========================================");

    } catch (error) {
        console.error("Critical error during verification:", error);
    }
};
