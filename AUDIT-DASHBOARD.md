# Audit Dashboard — Admin, Guru, Santri

Tanggal: 6 Agustus 2026
Cakupan: `src/components/dashboard/**`, `src/lib/**`, `src/contexts/**`, `src/pages/**` (halaman yang menulis data santri), `supabase/migrations/**`
Metode: penelusuran statik berbasis bukti. Setiap temuan mencantumkan `file:baris`.

> **Status pengujian:** temuan di bawah berasal dari pembacaan kode dan definisi RLS, **belum divalidasi runtime** dengan sesi login nyata. Sebelum menutup tiap item, reproduksi dulu gejalanya (langkah repro tersedia di masing-masing temuan).

---

## Akar Masalah Bersama

Sebagian besar temuan berakar pada satu perilaku yang mudah disalahpahami:

**Ketika RLS Postgres memblokir `UPDATE`/`DELETE`, PostgREST mengembalikan HTTP 200 dengan 0 baris terpengaruh dan `error === null`.**

Akibatnya pola ini **tidak aman** dan tersebar di seluruh kode:

```js
const { error } = await supabase.from('santri').update({ ... }).eq('id', id);
if (error) { /* tidak pernah tereksekusi saat RLS memblokir */ }
toast({ title: 'Berhasil' });   // notifikasi palsu
setLocalState(newValue);        // UI berubah, database tidak
```

Deteksi yang benar hanya dua:
1. Rantai `.select()` setelah `update()`, lalu pastikan ada baris yang kembali.
2. Lewatkan melalui RPC `SECURITY DEFINER` yang melakukan otorisasi eksplisit dan `RAISE EXCEPTION` saat ditolak.

**Kondisi RLS tabel `santri` saat ini** — hanya ada tiga policy:

| Policy | Operasi | Syarat |
|---|---|---|
| `santri_admin_all` | ALL | `is_admin()` |
| `santri_select_scope` | SELECT | diri sendiri / guru berwenang / pentashih / admin |
| `santri_pentashih_select` | SELECT | pentashih |

Artinya: **tidak ada satu pun policy tulis untuk guru maupun santri.** Setiap `update` langsung ke `santri` dari kode guru atau santri pasti gagal diam-diam.

---

## Prioritas Tinggi

### [x] F1 — Edit profil santri gagal diam-diam, notifikasi palsu — **SELESAI**

> **Catatan verifikasi.** Sempat dianggap keliru karena pemilik proyek berhasil mengubah alamat dan no HP. Ternyata pengujian itu dilakukan **dari dashboard Admin**, dan admin memang berwenang menulis (`santri_admin_all`). Kondisi RLS di database sudah dicek langsung lewat `pg_policies` dan **identik** dengan isi migration. Temuan ini tetap berlaku untuk santri yang mengedit profilnya sendiri.


**Berkas:** `src/components/dashboard/SantriDashboard.jsx:324-331`

```js
const { error } = await supabase.from('santri').update(allowedData).eq('id', santri.id);
if (error) toast({ title: "Gagal", ... });
else { toast({ title: "Berhasil", description: "Profil berhasil diperbarui." }); onUpdate(); }
```

Santri bukan admin, sehingga `santri_admin_all` memblokir tulisan. `error` bernilai `null`, cabang `else` jalan, toast hijau muncul, lalu `onUpdate()` mengambil ulang data lama.

**Gejala:** identik dengan bug jilid — profil "tersimpan", setelah refresh kembali semula.
**Repro:** login sebagai santri, ubah alamat/no HP, simpan, refresh.

**Solusi:** buat RPC `SECURITY DEFINER`, konsisten dengan pola `change_santri_jilid` dan `increment_santri_points` yang sudah ada:

```sql
create or replace function public.update_santri_self_profile(p_profile jsonb)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_id uuid := auth.uid();
begin
  if v_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501'; end if;

  update public.santri set
    alamat        = coalesce(nullif(btrim(p_profile->>'alamat'), ''), alamat),
    no_hp_ortu    = coalesce(nullif(btrim(p_profile->>'no_hp_ortu'), ''), no_hp_ortu),
    tempat_lahir  = coalesce(nullif(btrim(p_profile->>'tempat_lahir'), ''), tempat_lahir),
    -- daftar putih eksplisit; jangan pernah menerima jilid/points/nomor_induk_qiroati
    updated_by = v_id, updated_at = now()
  where id = v_id and deleted_at is null;

  if not found then raise exception 'SANTRI_NOT_FOUND' using errcode='P0002'; end if;
  return v_id;
end; $$;

revoke all on function public.update_santri_self_profile(jsonb) from public, anon;
grant execute on function public.update_santri_self_profile(jsonb) to authenticated;
```

Daftar putih ditegakkan di server, bukan di klien (lihat F10).

---

### [x] F2 — [SELESAI]  Fallback poin menembus otorisasi lalu gagal diam-diam

**Berkas:** `src/pages/GatchaGamePage.jsx:148-160`, `src/pages/QuizHafalanPage.jsx:304-321`

```js
const { error: rpcError } = await supabase.rpc('increment_santri_points', { ... });
if (rpcError) {
  await supabase.from('santri').update({ points: nextPoints }).eq('id', currentPlayer.id);  // Gatcha:154
}
setCurrentPlayer(prev => ({ ...prev, points: nextPoints }));   // dijalankan apa pun hasilnya
```

Tiga cacat menumpuk:

1. **Fallback justru berjalan saat RPC menolak otorisasi.** RPC sudah benar menolak; fallback mencoba menembusnya secara langsung — dan tetap gagal diam-diam karena RLS.
2. **Menulis nilai absolut hasil hitungan klien** (`nextPoints`), bukan increment. Dua penambahan bersamaan saling menimpa (*lost update*) — persis yang dicegah RPC.
3. `GatchaGamePage.jsx:154` **tidak memeriksa apa pun**; state lokal (157-160) tetap dinaikkan.

**Gejala:** poin bertambah di layar, hilang setelah refresh.

**Solusi:** hapus seluruh blok fallback. RPC `increment_santri_points` sudah mengembalikan nilai poin terbaru — pakai nilai itu untuk state lokal:

```js
const { data: newPoints, error } = await supabase.rpc('increment_santri_points', {
  p_santri_id: currentPlayer.id, p_amount: amount
});
if (error) {
  toast({ title: 'Gagal menambah poin', description: error.message, variant: 'destructive' });
  return;
}
setCurrentPlayer(prev => ({ ...prev, points: newPoints }));
```

---

### [x] F3 — [SELESAI]  Absensi dari TopScorePage tidak terlihat oleh guru

**Berkas:** `src/pages/TopScorePage.jsx:70-71` dan `:111`

```js
const { data } = await supabase.from('santri').select('*');   // baris 70-71
...
class_id: student.id_kelas                                    // baris 111
```

Query mengambil kolom mentah, sehingga baris berisi `current_class_id` — **bukan** `id_kelas`. Tidak ada pemanggilan `mapSantriForLegacyUi`. Maka `student.id_kelas` bernilai `undefined` dan `class_id` tersimpan **NULL**.

Padahal kedua policy absensi mensyaratkan `class_id` tidak null untuk cabang guru:

```sql
-- attendance_select_scope & attendance_insert_update_guru_scope
or (class_id is not null and public.guru_has_class_access(class_id))
```

**Dampak lintas dashboard:** absensi yang dibuat lewat TopScorePage **tidak muncul di dashboard guru** dan tidak bisa dikoreksi guru. Hanya admin dan santri bersangkutan yang melihatnya. Rekap kehadiran guru jadi kurang tanpa jejak error.

**Solusi:**
1. Perbaiki sumbernya: `class_id: student.current_class_id ?? student.id_kelas ?? null`, atau lewatkan hasil query melalui `mapSantriForLegacyUi`.
2. Backfill baris lama:
   ```sql
   update public.attendance a
   set class_id = s.current_class_id
   from public.santri s
   where a.user_id = s.id and a.class_id is null and s.current_class_id is not null;
   ```
3. Cek apakah ada penulis absensi lain dengan ketidakcocokan nama kolom yang sama.

---

## Prioritas Menengah

### [x] F4 — [SELESAI]  Perubahan absensi dilaporkan berhasil tanpa verifikasi

**Berkas:** `src/components/dashboard/shared/AttendanceDetailsModal.jsx:62-68`, `:99-111`

`if (error) throw error` tidak menangkap blokir RLS. Bila guru menyunting absensi kelas yang bukan miliknya — atau baris ber-`class_id` NULL akibat F3 — nol baris berubah namun toast "Berhasil" tetap muncul.

Tambahan, penanganan error tidak konsisten: baris 89 membuang `error.message` dan menampilkan teks statis `"Gagal memperbarui waktu kehadiran"`, sedangkan baris 115 sudah benar memakai `error.message`.

**Solusi:** rantai `.select()` dan pastikan ada baris kembali; seragamkan pesan error.

```js
const { data, error } = await supabase.from('attendance')
  .update({ ... }).eq('id', id).select('id');
if (error) throw error;
if (!data?.length) throw new Error('Tidak ada data absensi yang berubah. Periksa akses Anda ke kelas ini.');
```

---

### [x] F5 — [SELESAI]  Urutan hasil drag tidak tersimpan saat gagal

**Berkas:** `src/components/dashboard/admin/AdultClassManagement.jsx:489-492` (ada padanannya di `ClassManagement.jsx`)

```js
setSantriList([...otherSantri, ...updatedSantriInClass]);                       // optimistik
const updates = updatedSantriInClass.map(s => supabase.from('santri').update({ order_in_class: s.order_in_class }).eq('id', s.id));
await Promise.all(updates);                                                    // hasil tidak diperiksa
```

Layar ini khusus admin sehingga RLS tidak memblokir, namun kegagalan jaringan atau constraint tetap menyisakan tampilan urutan yang tak pernah tersimpan. Selain itu N baris ditulis non-atomik — sebagian bisa berhasil, sebagian gagal.

**Solusi:** periksa setiap hasil, lalu refetch/rollback saat ada yang gagal. Lebih baik lagi, satu RPC yang menulis seluruh urutan dalam satu transaksi.

---

### [x] F6 — [SELESAI]  Hasil `increment_santri_points` diabaikan di kiosk absensi

**Berkas:** `src/pages/DigitalAttendancePage.jsx:747-748`

```js
await supabase.rpc('increment_santri_points', { p_santri_id: user.id, p_amount: 1 });
newPoints += 1;
```

Tanpa pemeriksaan error. Poin dan badge level yang ditampilkan ke santri dihitung dari asumsi keberhasilan.

**Solusi:** pakai nilai kembalian RPC; bila error, tampilkan poin lama apa adanya dan catat ke log.

---

### [x] F7 — [SELESAI]  Admin tidak bisa menyunting profil perkembangan santri

**Berkas:** `src/components/dashboard/shared/SantriDetailModal.jsx:325-326`

```jsx
editable={role === 'guru'}
showBehavior={role === 'guru'}
```

Admin dan pentashih mendapat mode baca-saja, padahal policy `santri_character_scores_update_scope` mengizinkan admin menulis. Kemampuan yang ada di database tidak terekspos di UI.

**Solusi:** setelah matriks peran dipastikan, ubah menjadi `editable={role === 'guru' || role === 'admin'}`. Konfirmasikan dulu apakah pentashih memang seharusnya bisa menyunting.

---

### [x] F8 — [SELESAI]  Ketidakcocokan model peran: guru berperan admin/pentashih

**Berkas:** `supabase/migrations/20260624001500_rls_helper_functions.sql` (definisi `is_guru`), `20260723000200_enable_guru_admin_roles.sql`

`is_guru()` didefinisikan ketat: `current_user_role() = 'guru'`. Sementara migration 20260723000200 memungkinkan akun pengajar memegang role `admin` atau `pentashih`.

Semua RPC bergerbang `is_admin() OR (is_guru() AND guru_has_santri_access(...))` — termasuk `change_santri_jilid` dan `increment_santri_points`. Seorang pengajar ber-role `pentashih` **gagal di kedua cabang**, sehingga tombol naik/turun jilid tampil di UI namun ditolak server.

**Solusi:** tambahkan predikat khusus dan pakai di seluruh RPC terkait:

```sql
create or replace function public.is_teaching_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select public.current_user_role() in ('guru'::public.app_role, 'pentashih'::public.app_role); $$;
```

Lalu sesuaikan gerbangnya menjadi `is_admin() OR (is_teaching_staff() AND guru_has_santri_access(...))` — **setelah** dipastikan pentashih memang berhak mengubah jilid.

---

## Prioritas Rendah

### [x] F9 — [SELESAI]  Dashboard admin masih auto-refresh saat tab difokuskan

**Berkas:** `src/components/dashboard/admin/AdultClassManagement.jsx:417-426`

```js
window.addEventListener('focus', refresh);
```

Keluhan UX yang sama seperti pada dashboard guru/santri (sudah diperbaiki di `SupabaseAuthContext`), tetapi listener eksplisit ini masih aktif di admin.

**Solusi:** hapus listener `focus`, pertahankan `lpq:santri-data-changed` agar refresh tetap terjadi saat data memang berubah.

---

### [x] F10 — [SELESAI lewat F1]  Penyaringan field hanya di sisi klien

**Berkas:** `src/components/dashboard/SantriDashboard.jsx:326`

```js
const { nama_panggilan, password, points, jilid, sesi_mengaji, nomor_induk_qiroati, ...allowedData } = formData;
```

Saat ini tidak berbahaya karena RLS memblokir seluruh tulisan santri. Namun ia menjadi lubang eskalasi hak begitu policy self-update ditambahkan — yaitu tepat ketika F1 dikerjakan.

**Solusi:** tegakkan daftar putih di dalam RPC pada F1. Jangan menambahkan policy `UPDATE ... USING (id = auth.uid())` polos tanpa pembatasan kolom, karena RLS tidak mengenal batasan per kolom.

---

## Yang Sudah Benar

Agar tidak diubah tanpa perlu:

- `src/lib/customSupabaseClient.js` — menangani konfigurasi kosong dengan benar: mengembalikan objek error eksplisit (`SUPABASE_NOT_CONFIGURED`), bukan data kosong yang menyesatkan.
- `supabase/migrations/20260716000400_jilid_history.sql` — RLS ketat dan tepat: append-only untuk non-admin, `changed_by = auth.uid()` dipaksakan.
- Pola RPC `SECURITY DEFINER` (`increment_santri_points`, `move_santri_to_class`) — otorisasi eksplisit, `search_path` dikunci, hak `anon` dicabut. Jadikan ini acuan untuk RPC baru.
- Tidak ditemukan `service_role` key atau kredensial yang ter-commit.
- Tidak ditemukan blok `catch {}` kosong di kode aplikasi (satu-satunya ada di `src/components/reactbits/SideRays/SideRays.jsx:219`, komponen visual pihak ketiga).

---

## Urutan Pengerjaan yang Disarankan

Diurutkan agar tiap langkah tidak membatalkan langkah berikutnya:

| No | Item | Alasan urutan |
|---|---|---|
| 1 | **F1** | Fitur inti rusak total; menyiapkan pola RPC untuk F10 |
| 2 | **F2** | Hapus-kode saja, tanpa migration, risiko rendah |
| 3 | **F3** | Perbaiki sumber dulu, backfill setelahnya |
| 4 | **F4** | Bergantung pada F3 (baris `class_id` NULL) |
| 5 | **F8** | Migration; berdampak ke semua RPC, kerjakan sebelum menambah RPC lain |
| 6 | **F6**, **F5** | Perbaikan terisolasi |
| 7 | **F7**, **F9** | UX/kapabilitas, butuh keputusan produk |
| 8 | **F10** | Otomatis selesai bila F1 dikerjakan dengan benar |

---

## Saran dan Kritik terhadap Audit Ini

**Batasan yang perlu Anda ketahui:**

1. **Audit ini statik, bukan runtime.** Tidak satu pun temuan diverifikasi dengan sesi login nyata. Yang paling perlu dibuktikan lebih dulu: F1 dan F3. Reproduksi manual sebelum mulai memperbaiki, agar tidak menambal masalah yang tidak ada.

2. **Asumsi bahwa database mengikuti file migration.** Anda baru membuat project Supabase baru (`vdaoqhuhceojwgsmlyta`), dan migration `change_santri_jilid` dijalankan manual lewat SQL Editor, bukan `supabase db push`. **Kondisi database nyata belum tentu sama dengan isi `supabase/migrations/`.** Ini risiko terbesar terhadap validitas audit. Verifikasi dulu:
   ```sql
   select policyname, cmd, qual from pg_policies where tablename = 'santri';
   select proname from pg_proc where pronamespace = 'public'::regnamespace and proname like '%santri%';
   ```
   Bila hasilnya berbeda dari migration, prioritas nomor satu adalah menyelaraskan keduanya — bukan daftar di atas.

3. **Cakupan sengaja dipersempit.** Fokus pada integritas data dan alur peran. **Belum** ditelusuri: modul pembayaran, MMQ, storage/upload, edge functions, aksesibilitas, dan performa. Modul pembayaran menyimpan uang dan layak diaudit tersendiri.

4. **Empat agen penelusuran paralel gagal dijalankan** karena masalah konfigurasi model, sehingga audit dikerjakan berurutan. Cakupan per berkas karena itu tidak merata — komponen admin dengan jumlah operasi tulis terbanyak (`AdultClassManagement`, `ClassManagement`) hanya diperiksa pada pola yang sudah dikenali, belum baris demi baris.

**Kritik terhadap arsitektur, bukan terhadap Anda:**

1. **Pola berbahaya ini akan terus lahir kembali.** Selama `supabase.from('santri').update()` masih boleh dipanggil bebas dari komponen, cacat yang sama akan muncul di fitur berikutnya. Pertimbangkan pembungkus terpusat, misalnya `src/lib/safeMutations.js`, yang selalu merantai `.select()` dan melempar error saat nol baris — lalu larang pemanggilan `.update()` langsung lewat aturan lint.

2. **Tidak ada tes yang menutupi jalur ini.** Codegraph melaporkan "no covering tests found" untuk hampir setiap simbol yang disentuh audit ini. Tiga bug jilid berturut-turut lolos ke produksi karena tidak ada satu pun tes integrasi yang menjalankan mutasi sebagai peran guru. Satu tes integrasi per peran — guru mengubah jilid, santri menyunting profil — akan menangkap F1 dan seluruh keluarga bug jilid sekaligus.

3. **Duplikasi `confirmJilidChange` di empat berkas** adalah alasan mengapa perbaikan pertama saya tidak lengkap. Logika mutasi yang sama disalin ke `ClassManagement`, `AdultClassManagement`, `GuruDashboard`. Satu hook bersama, misalnya `useJilidChange()`, akan membuat perbaikan cukup sekali.

4. **Ketidakcocokan `id_kelas` dan `current_class_id`** (akar F3) berpotensi muncul di tempat lain. `mapSantriForLegacyUi` ada untuk menjembatani keduanya, tetapi tidak dipakai konsisten. Layak dilakukan penyisiran khusus untuk seluruh pembacaan `.id_kelas` pada data yang berasal dari `select('*')`.

---

## Temuan Baru dari Verifikasi Langsung (6 Agustus 2026)

Ditemukan saat menjalankan aplikasi dengan akun Administrator sungguhan di server lokal — bukan dari analisis statik.

### [x] F11 — Manajemen Kelas TPQ gagal memuat total — **SELESAI, TERVERIFIKASI**

**Berkas:** `src/components/dashboard/admin/ClassManagement.jsx:413`, `src/components/dashboard/shared/SantriDetailModal.jsx:77`

Query santri menyertakan kolom `nama_wali`, padahal kolom itu **tidak pernah dibuat di migration mana pun**. PostgREST menolak seluruh query:

```
400  {"code":"42703","message":"column santri.nama_wali does not exist"}
```

Di `ClassManagement.jsx:420-422`, kegagalan itu memicu `return` lebih awal, sehingga `setSantriList` tidak pernah dipanggil — **seluruh layar Manajemen Kelas TPQ kosong**. Dashboard Pentashih ikut terdampak karena merender komponen yang sama.

Pada `SantriDetailModal.jsx:75`, error tidak di-destructure sama sekali (`const { data } = ...`), sehingga kegagalan yang sama tertelan diam-diam dan nama wali jatuh ke `-`.

**Bukti sebelum:** HTTP 400, toast "Gagal memuat data", layar kosong.
**Bukti sesudah:** HTTP 200, tanpa error console, data termuat.

**Perbaikan:** `nama_wali` dihapus dari kedua SELECT, dan error kini diperiksa di SantriDetailModal. Pembacaan `santriData.nama_wali` di `reportUtils.js` dibiarkan — itu akses properti biasa yang aman jatuh ke nilai berikutnya.

---

### [ ] F12 — Pencatatan keamanan login mati di domain produksi

**Berkas:** `supabase/functions/_shared/cors.ts:4-14`, `src/lib/loginSecurityAdapters.js:38`

Edge function `record-login-attempt` menolak permintaan dari domain produksi:

```
CORS policy: 'Access-Control-Allow-Origin' bernilai 'https://lpq-al-fath-maulana.vercel.app'
yang tidak sama dengan origin yang diminta
```

Variabel `ALLOWED_ORIGINS` di Supabase memuat URL Vercel lama, **bukan** `https://www.lpqalfathmaulana.id`. Karena origin tidak cocok dan bukan domain `*.vercel.app`, fungsi mengembalikan `allowed[0]` dan browser menolaknya.

Dampaknya tidak terlihat karena `loginSecurityAdapters.js:38` menelan error (`catch { return false; }`). Login tetap berhasil, tetapi **catatan percobaan login tidak pernah tersimpan** — termasuk percobaan yang gagal.

**Bagian kode — SELESAI.** `loginSecurityAdapters.js` kini mencatat kegagalan ke console (status server + isi respons pada non-OK, dan pesan error pada kegagalan jaringan) alih-alih menelannya. Branch `fix/login-security-recording`, commit `f38d09c` — belum di-merge ke master.

**Bagian konfigurasi — SELESAI & TERVERIFIKASI.** `ALLOWED_ORIGINS` diubah lewat dashboard dan diverifikasi langsung: origin `https://www.lpqalfathmaulana.id`, `https://lpqalfathmaulana.id`, dan `http://localhost:3000` kini diterima; origin asing tetap ditolak browser karena header tidak cocok. Nilai yang diterapkan:
```
https://www.lpqalfathmaulana.id,https://lpqalfathmaulana.id,https://lpq-al-fath-maulana.vercel.app,http://localhost:5173,http://localhost:3000
```

---

## Status Verifikasi Langsung

| Diuji | Hasil |
|---|---|
| Login sebagai Administrator | Berhasil, peran terbaca `admin` |
| Manajemen Kelas memuat santri | **Terbukti** — 400 menjadi 200 |
| Pindah tab tidak memicu refresh | **Belum konklusif** — lihat catatan |
| Santri edit profil sendiri (F1) | Belum diuji — butuh akun santri |
| Guru ubah jilid | Belum diuji — butuh akun guru |

**Catatan soal pindah tab.** Pengujian mencatat nol permintaan data setelah kembali ke tab. Namun log menunjukkan **tidak ada event autentikasi yang terpicu** selama perpindahan tab singkat itu, karena token masih baru. Artinya pengujian ini belum membuktikan apa pun — kode lama pun akan lolos. Pembuktian sesungguhnya memerlukan jeda yang cukup lama hingga Supabase memulihkan sesi.
