import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRef = process.env.LPQ_PRODUCTION_PROJECT_REF || '';
const expectedUrl = `https://${projectRef}.supabase.co`;
const root = path.resolve(import.meta.dirname, '..');
const privateRoot = path.join(root, '_private_reference');
const preparedPath = path.join(privateRoot, 'migration-work', 'prepared-production-data', 'prepared-data.json');
const credentialPath = path.join(privateRoot, 'migration-work', 'production-initial-login-credentials.json');
const supabaseUrl = process.env.SUPABASE_URL || '';
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const adminPassword = process.env.PRODUCTION_ADMIN_INITIAL_PASSWORD || '';
const guruPassword = process.env.PRODUCTION_GURU_INITIAL_PASSWORD || '';
const confirmation = process.env.PRODUCTION_LOGIN_POLICY_CONFIRMATION || '';

const assertInputs = () => {
  if (!/^[a-z0-9]{15,32}$/.test(projectRef)) throw new Error('Project Ref production baru wajib diisi.');
  if (supabaseUrl !== expectedUrl) throw new Error('Rotasi kredensial menolak target selain project LPQ yang disetujui.');
  const isSecret = secretKey.startsWith('sb_secret_');
  const isLegacyJwt = /^eyJ[^.]+\.[^.]+\.[^.]+$/.test(secretKey);
  if (!isSecret && !isLegacyJwt) throw new Error('Format secret/service-role key tidak dikenali.');
  if (adminPassword.length < 8 || adminPassword.length > 72) throw new Error('Password awal admin tidak memenuhi panjang aman.');
  if (guruPassword.length < 8 || guruPassword.length > 72) throw new Error('Password awal guru tidak memenuhi panjang aman.');
  if (confirmation !== `APPLY-LOGIN-POLICY-${projectRef}`) throw new Error('Konfirmasi kebijakan login tidak cocok.');
  for (const file of [preparedPath, credentialPath]) {
    const relative = path.relative(privateRoot, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(file)) {
      throw new Error('Paket kredensial privat tidak lengkap.');
    }
  }
};

const headers = () => {
  const value = {
    apikey: secretKey,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'LPQ-Production-Login-Policy/1.0',
  };
  if (!secretKey.startsWith('sb_secret_')) value.Authorization = `Bearer ${secretKey}`;
  return value;
};

const safeError = async (response, step) => {
  let message = `HTTP ${response.status}`;
  try {
    const body = await response.json();
    message = [body.code, body.message, body.details, body.hint].filter(Boolean).join(' | ') || message;
  } catch {
    // Keep status-only diagnostics.
  }
  throw new Error(`${step} failed: ${message}`);
};

const updatePassword = async (id, password) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ password }),
    });
    if (response.ok) return;
    if (response.status !== 429 && response.status < 500) await safeError(response, 'update Auth password');
    if (attempt === 3) await safeError(response, 'update Auth password');
    await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }
};

const verifyPassword = async (email, password, label) => {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) await safeError(response, `verify ${label} login`);
  const body = await response.json();
  if (!body.access_token || !body.user?.id) throw new Error(`verify ${label} login returned no session`);
};

const main = async () => {
  assertInputs();
  const prepared = JSON.parse(fs.readFileSync(preparedPath, 'utf8'));
  const credentialDocument = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
  if (credentialDocument.project_ref !== projectRef) throw new Error('File kredensial bukan milik target yang disetujui.');

  const specs = new Map(prepared.auth_user_specs.map((spec) => [spec.id, spec]));
  const santri = new Map((prepared.tables?.santri || []).map((row) => [row.id, row]));
  const transformed = structuredClone(credentialDocument);
  const totalCredentialUpdates = transformed.accounts.filter((account) => ['admin', 'guru', 'santri'].includes(account.role)).length;
  let changed = 0;
  let adminCount = 0;
  let guruCount = 0;
  let santriCount = 0;

  for (const account of transformed.accounts) {
    const spec = specs.get(account.id);
    if (!spec || spec.role !== account.role) throw new Error('Mapping akun privat tidak konsisten dengan paket migrasi.');
    if (account.role === 'admin') {
      account.login = account.auth_email;
      account.initial_password = adminPassword;
      adminCount += 1;
    } else if (account.role === 'guru') {
      account.login = account.auth_email;
      account.initial_password = guruPassword;
      guruCount += 1;
    } else if (account.role === 'santri') {
      const row = santri.get(account.id);
      const nickname = String(row?.nama_panggilan || '').trim();
      const nomorInduk = String(row?.nomor_induk_qiroati || '').trim();
      if (!nickname) throw new Error('Nama panggilan santri tidak lengkap.');
      if (nomorInduk.length < 6 || nomorInduk.length > 72 || /\s/.test(nomorInduk)) {
        throw new Error('Nomor Induk tidak valid sebagai password awal.');
      }
      account.login = nickname;
      account.initial_password = nomorInduk;
      santriCount += 1;
    } else continue;

    await updatePassword(account.id, account.initial_password);
    changed += 1;
    if (changed % 50 === 0 || changed === totalCredentialUpdates) {
      console.log(`Credential progress: ${changed}/${totalCredentialUpdates}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 35));
  }

  const adminSample = transformed.accounts.find((account) => account.role === 'admin');
  const guruSample = transformed.accounts.find((account) => account.role === 'guru');
  const santriSample = transformed.accounts.find((account) => account.role === 'santri');
  if (!adminSample || !guruSample || !santriSample) throw new Error('Sampel verifikasi akun tidak tersedia.');
  await verifyPassword(adminSample.auth_email, adminSample.initial_password, 'admin');
  await verifyPassword(guruSample.auth_email, guruSample.initial_password, 'guru');
  await verifyPassword(santriSample.auth_email, santriSample.initial_password, 'santri');

  transformed.login_policy_updated_at = new Date().toISOString();
  transformed.login_policy = {
    admin: 'email and administrator-defined initial password',
    guru: 'email and shared initial password',
    santri: 'nickname and Nomor Induk Qiroati as initial password',
  };
  fs.copyFileSync(credentialPath, `${credentialPath}.before-login-policy`);
  fs.writeFileSync(credentialPath, `${JSON.stringify(transformed, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });

  console.log('Production login policy applied and verified.');
  console.log(`Admin credentials updated: ${adminCount}`);
  console.log(`Guru credentials updated: ${guruCount}`);
  console.log(`Santri credentials updated: ${santriCount}`);
  console.log(`Private credential file updated: ${path.relative(root, credentialPath)}`);
};

main().catch((error) => {
  console.error(`Production login policy failed: ${error.message}`);
  process.exitCode = 1;
});
