import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { FACE_DB_CONTAINER, skipWithoutLocalBackend } from './faceLocalBackend.mjs';

if (!skipWithoutLocalBackend('face attendance local SQL contract')) {
  const config=readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8');
  if (!config.includes('project_id = "lpq-al-fath-maulana-local"') || !config.includes('port = 55322')) throw new Error('Local project identity changed.');
  const sql=readFileSync(new URL('./test-face-attendance-local.sql',import.meta.url),'utf8');
  const output=execFileSync('docker',['exec','-i',FACE_DB_CONTAINER,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'});
  console.log(output.trim());
}
