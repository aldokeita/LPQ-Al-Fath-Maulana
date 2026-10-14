import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSupabaseTarget } from '../src/lib/supabaseTarget.js';

const main = { VITE_SUPABASE_URL: 'https://main.supabase.co', VITE_SUPABASE_ANON_KEY: 'main-key' };
const pilot = { ...main, VITE_FACE_ATTENDANCE_PILOT: 'true' };

test('without the pilot the main backend is used', () => {
  assert.deepEqual([resolveSupabaseTarget(main).url, resolveSupabaseTarget(main).anonKey], ['https://main.supabase.co', 'main-key']);
});

test('the pilot never inherits the main backend without an explicit opt-in', () => {
  assert.equal(resolveSupabaseTarget(pilot).url, '');
  assert.equal(resolveSupabaseTarget({ ...pilot, VITE_FACE_PILOT_SUPABASE_URL: main.VITE_SUPABASE_URL, VITE_FACE_PILOT_SUPABASE_ANON_KEY: 'main-key' }).url, '', 'copying the main URL is not an opt-in');
  assert.equal(resolveSupabaseTarget({ ...pilot, VITE_FACE_PILOT_ALLOW_PRODUCTION: 'yes' }).url, '', 'only the exact value true opts in');
});

test('the pilot uses a separate test backend when one is configured', () => {
  const target = resolveSupabaseTarget({ ...pilot, VITE_FACE_PILOT_SUPABASE_URL: 'https://test.supabase.co', VITE_FACE_PILOT_SUPABASE_ANON_KEY: 'test-key' });
  assert.deepEqual([target.url, target.anonKey], ['https://test.supabase.co', 'test-key']);
  assert.equal(resolveSupabaseTarget({ ...pilot, VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_FACE_PILOT_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_FACE_PILOT_SUPABASE_ANON_KEY: 'local' }).url, 'http://127.0.0.1:54321');
});

test('the pilot uses the main backend only with VITE_FACE_PILOT_ALLOW_PRODUCTION=true', () => {
  const target = resolveSupabaseTarget({ ...pilot, VITE_FACE_PILOT_ALLOW_PRODUCTION: 'true' });
  assert.deepEqual([target.url, target.anonKey], ['https://main.supabase.co', 'main-key']);
  const conflict = resolveSupabaseTarget({ ...pilot, VITE_FACE_PILOT_ALLOW_PRODUCTION: 'true', VITE_FACE_PILOT_SUPABASE_URL: 'https://test.supabase.co' });
  assert.equal(conflict.url, '');
  assert.match(conflict.message, /bertentangan/);
});
