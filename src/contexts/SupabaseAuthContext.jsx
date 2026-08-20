
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase, isSupabaseConfigured, supabaseConfigurationMessage } from '@/lib/customSupabaseClient';
import { enableEdgeFunctions, edgeFunctionDisabledMessage } from '@/lib/featureFlags';
import { useToast } from '@/hooks/use-toast';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  // Ref to track current user ID without stale closure issues in onAuthStateChange
  const userIdRef = useRef(null);

  const clearAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole(null);
    setProfileLoading(false);
    userIdRef.current = null;
  }, []);

  // Supabase hands back a brand-new user object every time it recovers the
  // session on tab focus, even when nothing about the account changed. Any
  // consumer with useCallback([user]) would see a fresh reference and refetch
  // its whole dashboard, which reads as an unwanted auto-refresh. Preserve the
  // previous reference whenever the signed-in identity is unchanged.
  const syncSessionPreservingIdentity = useCallback((nextSession) => {
    setSession(nextSession);
    setUser((previousUser) => {
      const nextUser = nextSession?.user ?? null;
      if (previousUser && nextUser && previousUser.id === nextUser.id) return previousUser;
      return nextUser;
    });
  }, []);

  const loadUserProfile = useCallback(async (userId) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, role, display_name, status')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Profil akun belum tersedia. Hubungi administrator.');
      if (data.status !== 'active') throw new Error('Akun belum aktif. Hubungi administrator.');

      setProfile(data);
      setRole(data.role);
      userIdRef.current = userId;
      return { profile: data, error: null };
    } catch (error) {
      setProfile(null);
      setRole(null);
      userIdRef.current = null;
      console.error('[AuthContext] Failed to load user profile:', error.message);
      return { profile: null, error };
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const handleSession = useCallback(async (currentSession) => {
    try {
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        console.log('[AuthContext] Auth session detected', { id: currentUser.id });
        return await loadUserProfile(currentUser.id);
      } else {
        console.log('[AuthContext] Auth state updated: No user session');
        setProfile(null);
        setRole(null);
        return { profile: null, error: null };
      }
    } catch (error) {
      console.error('[AuthContext] Error handling session:', error);
      setProfile(null);
      setRole(null);
      return { profile: null, error };
    } finally {
      setLoading(false);
    }
  }, [loadUserProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.warn('[AuthContext] Supabase is not configured. Auth session loading is skipped.');
      clearAuthState();
      setLoading(false);
      return undefined;
    }

    const getSession = async () => {
      try {
        console.log('[AuthContext] Initializing auth session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        await handleSession(session);
      } catch (error) {
        console.error('[AuthContext] Failed to get initial session:', error);
        setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log(`[AuthContext] Auth event triggered: ${event}`);

        // Silent session-only updates — these events fire when the user
        // switches back to the tab or Supabase auto-refreshes the token.
        // They must NOT trigger a full profile re-fetch because that sets
        // profileLoading=true, which causes ProtectedRoute to flash its
        // loading spinner and the user perceives an unwanted "reload".
        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          syncSessionPreservingIdentity(currentSession);
          return;
        }

        // SIGNED_IN also fires on tab return when Supabase recovers the
        // session. Use userIdRef (not stale closure) to compare the
        // current logged-in user with the event user.
        const incomingUserId = currentSession?.user?.id ?? null;
        if (event === 'SIGNED_IN' && userIdRef.current && userIdRef.current === incomingUserId) {
          syncSessionPreservingIdentity(currentSession);
          return;
        }

        await handleSession(currentSession);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [clearAuthState, handleSession, syncSessionPreservingIdentity]);

  const signUp = useCallback(async (email, password, options) => {
    if (!isSupabaseConfigured) {
      const error = new Error(supabaseConfigurationMessage);
      toast({
        variant: "destructive",
        title: "Supabase belum dikonfigurasi",
        description: error.message,
      });
      return { error };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign up Failed",
        description: error.message || "Something went wrong",
      });
    }

    return { error };
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) {
      const error = new Error(supabaseConfigurationMessage);
      toast({
        variant: "destructive",
        title: "Supabase belum dikonfigurasi",
        description: error.message,
      });
      return { error, user: null };
    }

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign in Failed",
        description: error.message || "Something went wrong",
      });
    }

    if (data?.session) {
      const profileResult = await handleSession(data.session);
      if (profileResult?.error) {
        return { error: profileResult.error, user: null };
      }
    }

    return { error, user: data?.user };
  }, [handleSession, toast]);

  // Handles email auth for staff and Nomor Induk Qiroati auth for santri.
  const signInWithUsername = useCallback(async (rawUsername, rawPassword) => {
    try {
      const username = rawUsername.trim();
      const password = rawPassword.trim();
      console.log('[AuthContext] Login attempt started');

      if (!isSupabaseConfigured) {
        throw new Error(supabaseConfigurationMessage);
      }

      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);

      // Step 1: Standard Auth for admin, guru, and pentashih email accounts.
      if (isEmail) {
        console.log('[AuthContext] Input is email, attempting standard auth...');
        const { data, error } = await supabase.auth.signInWithPassword({
          email: username,
          password: password,
        });

        if (error) {
          throw new Error('Email atau Password Salah');
        }

        if (data?.session && data?.user) {
          const profileResult = await handleSession(data.session);
          if (profileResult?.error) throw profileResult.error;
          return { user: data.user, error: null };
        }
      }

      if (!enableEdgeFunctions) {
        throw new Error(edgeFunctionDisabledMessage);
      }

      // Step 2: Santri login with Nomor Induk Qiroati through an Edge Function.
      console.log('[AuthContext] Attempting santri login via Edge Function...');
      const { data: functionData, error: functionError } = await supabase.functions.invoke('signin-with-nomor-induk', {
        body: {
          username,
          password,
        },
      });

      if (functionError) {
        throw new Error(functionError.message || 'Login santri belum tersedia.');
      }

      if (!functionData?.ok || !functionData?.data?.session) {
        throw new Error(functionData?.error?.message || 'Username santri atau password salah.');
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: functionData.data.session.access_token,
        refresh_token: functionData.data.session.refresh_token,
      });

      if (sessionError) {
        throw new Error('Gagal membuat session login santri.');
      }

      if (sessionData?.session && sessionData?.user) {
        const profileResult = await handleSession(sessionData.session);
        if (profileResult?.error) throw profileResult.error;
        return { user: sessionData.user, error: null };
      }

      throw new Error('Nomor Induk Qiroati atau password salah.');

    } catch (error) {
      console.error('Login Error:', error.message);
      return { user: null, error };
    }
  }, [handleSession]);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      clearAuthState();

      if (error) {
        console.warn('[AuthContext] Supabase signout note:', error.message);
      }
      console.log('[AuthContext] User signed out successfully');
    } catch (error) {
      console.error('[AuthContext] Error signing out:', error);
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: error.message || "Something went wrong",
      });
      return { error };
    }
    return { error: null };
  }, [clearAuthState, toast]);

  const value = useMemo(() => ({
    user,
    session,
    profile,
    role,
    loading,
    profileLoading,
    signUp,
    signIn,
    signInWithUsername,
    signOut,
    refreshProfile: user ? () => loadUserProfile(user.id) : async () => ({ profile: null, error: null }),
  }), [user, session, profile, role, loading, profileLoading, signUp, signIn, signInWithUsername, signOut, loadUserProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
