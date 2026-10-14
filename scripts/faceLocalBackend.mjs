import test from 'node:test';
import { execFileSync } from 'node:child_process';

export const FACE_DB_CONTAINER = 'supabase_db_lpq-al-fath-maulana-local';

// `npm test` must stay green without Docker; `npm run test:face` passes --require-backend to fail loudly instead.
export function skipWithoutLocalBackend(name) {
  if (process.argv.includes('--require-backend')) return false;
  try {
    execFileSync('docker', ['exec', FACE_DB_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-c', 'select 1'], { stdio: 'ignore' });
    return false;
  } catch {
    test(name, { skip: 'Supabase lokal (Docker) tidak aktif; jalankan npm run test:face setelah supabase start.' }, () => {});
    return true;
  }
}
