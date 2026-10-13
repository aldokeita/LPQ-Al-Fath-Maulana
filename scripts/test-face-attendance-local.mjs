import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const container='supabase_db_lpq-al-fath-maulana-local';
const config=readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8');
if (!config.includes('project_id = "lpq-al-fath-maulana-local"') || !config.includes('port = 55322')) throw new Error('Local project identity changed.');
const sql=readFileSync(new URL('./test-face-attendance-local.sql',import.meta.url),'utf8');
const output=execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'});
console.log(output.trim());
