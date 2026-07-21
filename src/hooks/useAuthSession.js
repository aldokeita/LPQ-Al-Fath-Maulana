import { supabase } from '@/lib/customSupabaseClient';

/**
 * Validates the current session and refreshes it if it's expired or about to expire.
 * @returns {Promise<Object|null>} The valid session object or null if invalid/refresh failed.
 */
export const validateAndRefreshSession = async () => {
  try {
    console.log('[AuthSession] Checking current session status...');
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('[AuthSession] Error getting session:', error);
      return null;
    }

    if (!session) {
      console.warn('[AuthSession] No active session found.');
      return null;
    }

    // Check if token is expired or expires in less than 60 seconds (buffer)
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at; // Unix timestamp in seconds
    const timeUntilExpiry = expiresAt - now;

    console.log(`[AuthSession] Token expires in ${timeUntilExpiry} seconds.`);

    if (timeUntilExpiry < 60) {
      console.log('[AuthSession] Token expiring soon or expired. Attempting refresh...');
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        console.error('[AuthSession] Session refresh failed:', refreshError);
        return null;
      }

      if (!newSession) {
        console.error('[AuthSession] Session refresh returned no session.');
        return null;
      }

      console.log('[AuthSession] Session successfully refreshed.');
      return newSession;
    }

    console.log('[AuthSession] Session is valid.');
    return session;

  } catch (err) {
    console.error('[AuthSession] Unexpected error during session validation:', err);
    return null;
  }
};

/**
 * Hook to provide session management utilities
 */
export const useAuthSession = () => {
  return { validateAndRefreshSession };
};
