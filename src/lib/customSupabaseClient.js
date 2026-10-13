import { createClient } from '@supabase/supabase-js';

const facePilot = import.meta.env.VITE_FACE_ATTENDANCE_PILOT === 'true';
const normalUrl = import.meta.env.VITE_SUPABASE_URL || '';
const pilotUrl = import.meta.env.VITE_FACE_PILOT_SUPABASE_URL || '';
// A Preview branch must never silently inherit the existing production backend.
const isolatedPilot = pilotUrl && (pilotUrl !== normalUrl || /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(pilotUrl));
export const supabaseUrl = facePilot ? (isolatedPilot ? pilotUrl : '') : normalUrl;
export const supabaseAnonKey = facePilot
  ? (isolatedPilot ? import.meta.env.VITE_FACE_PILOT_SUPABASE_ANON_KEY || '' : '')
  : import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigurationMessage =
  facePilot
    ? 'Mode pilot membutuhkan Supabase uji terpisah. Isi VITE_FACE_PILOT_SUPABASE_URL dan VITE_FACE_PILOT_SUPABASE_ANON_KEY.'
    : 'Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di .env.local.';

const notConfiguredError = {
  message: supabaseConfigurationMessage,
  code: 'SUPABASE_NOT_CONFIGURED',
};

const notConfiguredResult = { data: null, error: notConfiguredError };

const createQueryProxy = () => {
  let proxy;
  const handler = {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve, reject) => Promise.resolve(notConfiguredResult).then(resolve, reject);
      }
      if (prop === 'catch') {
        return (reject) => Promise.resolve(notConfiguredResult).catch(reject);
      }
      if (prop === 'finally') {
        return (callback) => Promise.resolve(notConfiguredResult).finally(callback);
      }
      return () => proxy;
    },
  };
  proxy = new Proxy({}, handler);
  return proxy;
};

const createChannelStub = () => {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: () => {},
  };
  return channel;
};

const createStorageBucketStub = () => ({
  upload: async () => notConfiguredResult,
  uploadToSignedUrl: async () => notConfiguredResult,
  remove: async () => notConfiguredResult,
  list: async () => ({ data: [], error: notConfiguredError }),
  getPublicUrl: () => ({ data: { publicUrl: '' } }),
  createSignedUrl: async () => notConfiguredResult,
});

const createUnconfiguredClient = () => ({
  from: () => createQueryProxy(),
  rpc: async () => notConfiguredResult,
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signUp: async () => notConfiguredResult,
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: notConfiguredError }),
    setSession: async () => ({ data: { user: null, session: null }, error: notConfiguredError }),
    signOut: async () => ({ error: null }),
    getUser: async () => ({ data: { user: null }, error: notConfiguredError }),
  },
  storage: {
    from: () => createStorageBucketStub(),
  },
  functions: {
    invoke: async () => notConfiguredResult,
  },
  channel: () => createChannelStub(),
  removeChannel: () => {},
});

const customSupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createUnconfiguredClient();

export default customSupabaseClient;

export {
    customSupabaseClient,
    customSupabaseClient as supabase,
};
