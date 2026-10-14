// Test-only resolver: maps the app's "@/" alias to src/ and swaps the Supabase client and avatar
// storage for in-memory fakes, so attendance modules run under node:test without a backend.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const src = new URL('../../src/', import.meta.url);
const fakes = {
  '@/lib/customSupabaseClient': new URL('./fakeSupabase.mjs', import.meta.url).href,
  '@/lib/storageAdapters': new URL('./fakeStorage.mjs', import.meta.url).href,
};

export async function resolve(specifier, context, next) {
  if (fakes[specifier]) return { url: fakes[specifier], shortCircuit: true };
  if (specifier.startsWith('@/')) {
    const base = fileURLToPath(new URL(specifier.slice(2), src));
    const file = [base, `${base}.js`, `${base}.jsx`].find(candidate => existsSync(candidate) && !candidate.endsWith('/'));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return next(specifier, context);
}
