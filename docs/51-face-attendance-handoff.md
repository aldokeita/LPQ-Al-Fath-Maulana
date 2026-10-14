# Handoff Absensi Digital Wajah

Status per 2026-10-14 (setelah PR #15). Dokumen ini merangkum seluruh pekerjaan pilot absensi wajah: desain, kode, database, pengujian, deployment, keputusan, dan pekerjaan yang belum selesai.

## 1. Status singkat

| Bagian | Status |
|---|---|
| Absen wajah santri (kiosk, RFID lewat fungsi) | **Live di production**: merge [PR #13](https://github.com/aldokeita/LPQ-Al-Fath-Maulana/pull/13) (`8f7a895`) dan [PR #14](https://github.com/aldokeita/LPQ-Al-Fath-Maulana/pull/14) (`5cf2fa8`) |
| Absen wajah guru dan Pentashih (registrasi mandiri dan oleh admin) | **Di production**: merge [PR #15](https://github.com/aldokeita/LPQ-Al-Fath-Maulana/pull/15) (`089e2d8`). Migration dan fungsi sudah diterapkan, verifikasi semua true. Uji manual di production sedang berjalan. |
| Kalibrasi bawaan otomatis (0,40 / 0,08) | **Di production** lewat PR #15 |
| Staging Supabase | Dilewati atas keputusan pemilik repo; pengujian dilakukan di Supabase lokal |

## 2. Cara kerja

### Santri
1. Admin membuka **Manajemen Santri → Wajah**, mencentang satu persetujuan tertulis wali, lalu merekam wajah dengan 5 gerakan kepala (tengah, kiri/kanan acak, tengah, sisi lain, tengah).
2. Browser hanya mengirim 5 deskriptor (128 angka), bukan foto. Template disimpan di schema `biometric_private`.
3. Kiosk `/absensi-wajah` mengenali wajah secara pasif (5 frame frontal, rentang minimal 300 ms). Ada dua mode:
   - **Gesture:** banyak wajah sekaligus; absen dikirim setelah jempol 👍 ditahan.
   - **Otomatis:** satu wajah, langsung tercatat.
4. Pencocokan dan pencatatan terjadi di server: Edge Function `face-attendance` memanggil RPC `pilot_face_operation`, lalu `pilot_record_santri_attendance`. Satu santri tetap hanya punya satu record per hari dengan satu kali poin, termasuk saat absen lewat RFID dan wajah terjadi bersamaan.
5. Saat pilot aktif, **tap RFID santri** juga dicatat lewat fungsi yang sama (aksi `rfid`), sehingga aturan duplikat dan poin konsisten.

### Guru dan Pentashih
1. Wajah guru bisa didaftarkan dengan dua cara:
   - guru sendiri lewat **Wajah Saya** di dashboard guru atau Pentashih, dengan persetujuan sendiri;
   - admin lewat **Manajemen Guru → Wajah**, dengan admin menyatakan persetujuan guru.

   Setiap registrasi mencatat sumber persetujuan (`self`/`admin`) dan akun yang mendaftarkan.
2. Kiosk mencocokkan wajah santri dan guru dalam satu peringkat. Kalau wajah santri dan guru terlalu mirip, hasilnya `ambiguous` dan tidak ada yang dicatat.
3. Kalau yang dikenali guru, server hanya mengembalikan `guruId`. Kiosk lalu menjalankan **alur yang sama dengan tap RFID guru**: sesi, MMQ, kartu info di luar sesi, dan Pentashih. Absen dicatat dengan `source = 'face'`. Logikanya ada di `src/lib/guruAttendanceScan.js` dan dipakai bersama oleh halaman RFID dan kiosk.

### Kalibrasi
- `max_distance` adalah jarak maksimum (0,20–0,60). `min_margin` adalah selisih minimum antara kandidat pertama dan kedua (0,01–0,30).
- Kalau kalibrasi belum disimpan, dipakai nilai bawaan 0,40 / 0,08. Nilai yang disimpan admin selalu menang. Sebelum PR #15, kondisi ini menolak absen dengan `calibration_required`; status itu masih ada di frontend tapi tidak dikirim lagi oleh server.
- Jarak setiap percobaan dicatat di log fungsi sebagai `face_match` (`state`, `best_distance`, `second_distance`) dan tidak pernah dikirim ke browser.

## 3. Keamanan dan privasi
- Schema `biometric_private` tidak bisa diakses `anon` atau `authenticated`, dan semua tabelnya memakai RLS. Akses hanya lewat RPC `security definer` yang khusus untuk `service_role`. RPC memasang aktor terverifikasi lalu memakai helper role yang sudah ada (`is_admin`, `guru_has_class_access`, `pentashih_has_class_access`).
- Fungsi menolak semua permintaan kecuali secret `FACE_ATTENDANCE_PILOT=true` ada. Setiap tantangan kamera hanya bisa dipakai sekali dan kedaluwarsa 45 detik. Batasnya 40 tantangan per menit per operator.
- Frontend menolak memakai Supabase production saat pilot aktif, kecuali ada izin eksplisit `VITE_FACE_PILOT_ALLOW_PRODUCTION=true` (`src/lib/supabaseTarget.js`).
- **Batasan:** absen pasif tidak tahan foto atau video. Kiosk wajib diawasi petugas.
- Menghapus template tidak menghapus riwayat absensi. Salinan backup mengikuti masa retensi backup.

## 4. File utama

| Area | File |
|---|---|
| Migration | `supabase/migrations/20261007000100_face_attendance_pilot.sql`, `20261014000100_face_attendance_passive_kiosk.sql`, `20261015000100_face_attendance_guru.sql`, `20261015000200_face_attendance_guru_admin.sql`, `20261015000300_face_attendance_default_calibration.sql` (semua sudah di production) |
| Edge Function | `supabase/functions/face-attendance/index.ts`, `supabase/functions/_shared/faceCapture.js` (validasi tangkapan, persetujuan, kalibrasi) |
| Kiosk | `src/pages/FaceAttendancePage.jsx`, `src/components/dashboard/shared/FaceCameraCapture.jsx`, `src/lib/faceKiosk.js`, `src/lib/kioskOverlay.js`, `src/lib/gestureEngine.js`, `src/lib/faceCameraEngine.js`, `src/styles/face-attendance.css` |
| Registrasi | `src/components/dashboard/admin/FaceEnrollmentDialog.jsx` (santri), `src/components/dashboard/guru/GuruFaceEnrollmentDialog.jsx` (guru: mandiri dan admin) |
| RFID | `src/pages/DigitalAttendancePage.jsx`, `src/lib/guruAttendanceScan.js` |
| Klien | `src/lib/faceAttendanceApi.js`, `src/lib/customSupabaseClient.js`, `src/lib/supabaseTarget.js` |
| Model | `public/` (face-api 1.7.15 dan MediaPipe GestureRecognizer, disimpan lokal dengan hash SHA-256) |

## 5. Konfigurasi

| Tempat | Nama | Nilai |
|---|---|---|
| Vercel → Environments → **Production** (Type: Config) | `VITE_FACE_ATTENDANCE_PILOT` | `true` |
| Vercel → Environments → **Production** | `VITE_FACE_PILOT_ALLOW_PRODUCTION` | `true` |
| Supabase → Edge Functions → Secrets | `FACE_ATTENDANCE_PILOT` | `true` |
| Supabase → Edge Functions → Secrets | `ALLOWED_ORIGINS` | domain production **dengan dan tanpa `www`**, dipisah koma, tanpa `/` di ujung |
| Supabase → Edge Functions → Secrets | `FUNCTION_ENV` | `production` |
| Lokal `.env.local` | `VITE_FACE_ATTENDANCE_PILOT=true` + URL/anon key Supabase lokal | — |

Variabel `VITE_*` dibaca saat build. Setelah mengubahnya, Vercel perlu **Redeploy**, dan di lokal `npm run dev` perlu dijalankan ulang.

## 6. Pengujian

| Perintah | Isi |
|---|---|
| `npm test` | Unit test: validasi tangkapan, HUD/gesture, target Supabase, alur guru dengan Supabase tiruan. Test di-skip kalau backend lokal tidak ada. |
| `npm run test:face` | Butuh Supabase lokal (Docker) dan `supabase functions serve face-attendance`. Menjalankan kontrak SQL santri, kontrak SQL guru, integrasi HTTP, dan uji pembatalan pilot di dalam transaksi yang di-rollback. |
| `pwsh scripts/validate-migration-order.ps1` | Daftar migration harus cocok. Tambahkan setiap migration baru ke daftarnya. |
| `npm run build`, `npm run lint`, `git diff --check`, `pwsh scripts/validate-no-secrets.ps1` | Wajib sebelum push. |

**Catatan:**
- Test HTTP menolak berjalan kalau kalibrasi lokal sudah ada (supaya kalibrasi Anda tidak tertimpa). Jalankan `delete from biometric_private.calibration` dulu. Kiosk tetap jalan setelahnya berkat nilai bawaan.
- `santriTier` (`bundles every configured rank with a WebP asset`) sudah gagal di master karena path ala Windows. Ini tidak terkait absensi wajah.
- `deno check` untuk fungsi ini sudah melaporkan 2 error tipe di kode santri lama yang juga ada di master.
- Akun demo lokal ada di `scripts/bootstrap-dummy-auth-users.ps1`, hanya untuk Supabase lokal.

## 7. Runbook production

Semua langkah dijalankan manual oleh pemilik repo dari `C:\Project\LPQ Al-Fath Maulana`. Lakukan di luar jam pelajaran.

1. **Cek drift:** `scripts/check-production-schema-drift.ps1 -ProjectRef <ref>` (hanya membaca).
2. **Backup:** `powershell -ExecutionPolicy Bypass -File .\scripts\backup-production-database.ps1 -ProjectRef <ref>`. Script meminta URI Session pooler (port 5432) dan password tanpa menampilkannya, lalu membuat `roles.sql`, `schema.sql`, `data.sql`, dan `SHA256SUMS.txt` di `_private_reference\production-backups\` (folder ini tidak ikut ke git).
3. **Migration:** `.\scripts\apply-production-face-migrations.ps1 -ProjectRef <ref>`.
   - Script menolak berjalan tanpa backup ≤24 jam.
   - Dry-run harus berisi **tepat** migration yang ada di `$expected`. Isinya masih tiga migration guru dan kalibrasi yang sudah diterapkan; **untuk migration wajah berikutnya, ganti `$expected` dengan migration baru itu**.
   - Anda diminta mengetik Project Ref sebelum push, lalu script menjalankan dry-run ulang.
4. **Verifikasi:** tempel `scripts/verify-face-attendance-migrations.sql` ke SQL Editor production. Semua kolom harus `true`.
5. **Fungsi:** `supabase functions deploy face-attendance --project-ref <ref>`, dengan login CLI memakai akun pemilik project.
6. **Frontend:** merge PR ke `master`. Vercel lalu membangun production dengan variabel di atas.
7. **Uji:**
   - tap RFID santri dan guru (status `face-attendance` di F12 → Network harus 200);
   - registrasi wajah;
   - kiosk `/absensi-wajah`.

**Rollback:**
- **Cepat:** Vercel → Deployments → deployment sebelumnya → **Instant Rollback**. Jalur RFID langsung kembali ke jalur lama. Setelah rollback, deployment baru dari master tidak otomatis menggantikan production sampai Anda **Promote**.
- **Matikan backend pilot:** hapus secret `FACE_ATTENDANCE_PILOT`.
- **Cabut pilot sepenuhnya:** salin `scripts/face-attendance-pilot-removal.sql` menjadi migration baru, lalu `supabase db push`. Absen yang tercatat lewat wajah tetap disimpan dengan label `manual`.

## 8. Riwayat production

- Riwayat migration production diselaraskan dengan repo lewat SQL Editor: delapan migration ditandai sudah diterapkan, dan `20260805000100` yang tidak ada di repo dihapus dari riwayat.
- Prasyarat production terpenuhi: Postgres 17.6, ekstensi `vector`, helper role, dan kolom `attended_session`.
- Backup production dibuat pada 2026-10-14 (data 3,6 MB, 67 tabel).
- Migration `20261007000100` dan `20261014000100` diterapkan. Hasil verifikasi: semua kolom true.
- Fungsi di-deploy, secret dipasang, PR #13 di-merge, lalu flag Vercel dinyalakan dan production di-redeploy.
- `ALLOWED_ORIGINS` diperbaiki agar memuat domain dengan `www`, dan bug RFID guru diperbaiki lewat PR #14.
- Backup baru dibuat, lalu migration `20261015000100`, `20261015000200`, dan `20261015000300` diterapkan. Hasil verifikasi: semua kolom true.
- Fungsi `face-attendance` versi guru di-deploy (setelah login CLI ulang dengan akun pemilik karena error 403), lalu PR #15 di-merge.

## 9. Masalah yang ditemukan dan pelajarannya

| Masalah | Penyebab | Penyelesaian |
|---|---|---|
| Tap RFID santri gagal "Koneksi ke backend terputus" | `ALLOWED_ORIGINS` hanya berisi domain tanpa `www` | Isi kedua varian domain. Cek dengan `curl.exe -i -X OPTIONS ... -H "Origin: https://www.<domain>"` |
| Tap RFID guru tertahan di "memproses data" | Bug lama sejak Juli: variabel `guruClasses` dipakai sebelum dideklarasikan di blok yang sama, ditambah `try` tanpa `catch` | PR #14 (`ed4fa05`) |
| Wajah tidak dikenali setelah `test:face` | Kalibrasi kosong, sehingga `calibration_required` | Kalibrasi bawaan (`9bddef2`, PR #15) |
| Wajah "meragukan" | Orang yang sama terdaftar sebagai santri dan guru | Untuk uji, daftarkan satu orang di satu tempat saja |
| Kotak HUD tidak muncul | Kotak face-api memakai *getter*, sehingga hasil spread berisi NaN | `plainBox` |
| Validator urutan migration gagal setelah PR #13 | Daftar di validator tidak ikut diperbarui | Diperbarui di PR #15 |
| `supabase link` atau `--db-url` ke production gagal | Akun CLI kurang hak akses; koneksi langsung hanya IPv6 | Pakai akun pemilik project dan Session pooler (IPv4) |
| `supabase functions deploy` gagal 403 | Login CLI memakai akun tanpa hak akses project | `supabase logout`, lalu `supabase login` dengan akun pemilik, atau `SUPABASE_ACCESS_TOKEN` dari akun pemilik |
| Volume DB lokal Postgres 17 tidak cocok dengan config 15 | Mesin lokal memakai PG17 | `major_version = 17` hanya di lokal, **jangan di-commit** |

## 10. Keputusan produk
- Pilot mati secara default dan hanya menyala dengan flag dan secret eksplisit.
- Persetujuan wali santri cukup satu centang oleh admin, yang menyatakan formulir tertulis sudah ada.
- Absen di kiosk bersifat pasif, tanpa gerakan kepala. Registrasi tetap memakai 5 gerakan kepala.
- Mode Gesture (jempol 👍) dan mode Otomatis tersedia. Konfirmasi senyum 😊 (dan `?kalibrasi-senyum`) dihapus, dan gesture peace ✌️ dinonaktifkan, atas permintaan pemilik repo pada 2026-10-14.
- Kamera selalu aktif, pulih sendiri, memakai Wake Lock, dan dirancang untuk monitor portrait. Profile Card ditampilkan bertumpuk (3 kartu, masing-masing 12 detik).
- Data wajah disimpan di server, tidak hanya di perangkat.
- Staging dilewati; pilot diaktifkan di situs utama.
- Wajah guru diperlakukan persis seperti tap RFID guru. Guru bisa mendaftar sendiri, dan admin juga bisa mendaftarkan guru.
- Kalibrasi memakai nilai bawaan selama belum ada nilai tersimpan, dan akan disesuaikan kalau ternyata tidak cocok.

## 11. Pekerjaan berikutnya
1. **Selesaikan uji production fitur guru:**
   - tap RFID santri dan guru;
   - registrasi lewat Manajemen Guru dan Wajah Saya;
   - kiosk di dalam dan di luar jam sesi, tanpa poin ganda.

   Kalau ada yang gagal, lakukan Instant Rollback di Vercel.
2. **Kalibrasi dengan santri sungguhan.** Kumpulkan `best_distance`/`second_distance` dari log `face_match` selama beberapa hari, lalu sesuaikan 0,40 / 0,08.
3. **Kebijakan retensi data wajah:** berapa lama template disimpan untuk santri yang sudah lulus atau nonaktif.
4. **Pembersihan opsional:** fungsi `change_santri_jilid` versi lama masih ada di production (frontend memakai `v2`). Ini butuh migration pembersihan terpisah.
5. **Perbaikan terpisah:** test `santriTier` yang gagal di Windows, dan 2 error tipe lama di fungsi `face-attendance`.

## 12. Kinerja: temuan dan rencana (dikerjakan di sesi lokal)

Uji di PC absensi LPQ dan HP pribadi: pilot terasa berat saat memuat modul, saat scanning, dan saat konfirmasi. Yang akan absen ada ratusan santri. Semua perbaikan di bawah hanya di frontend dan konfigurasi Vercel, **tanpa migration dan tanpa perubahan protokol server**.

### Temuan

| Tahap | Penyebab | Lokasi |
|---|---|---|
| Memuat | Unduhan pertama ±15–25 MB: `face_recognition_model.bin` 6,2 MB, `gesture_recognizer.task` 8 MB, runtime WASM MediaPipe, face-api/TensorFlow.js ±1,3 MB (340 KB gzip), detektor + 68 titik 0,5 MB. `vercel.json` belum mengatur cache untuk file model, jadi browser bertanya ulang ke server setiap kali halaman dibuka. Hash SHA-256 juga dihitung ulang setiap pemuatan. | `vercel.json`, `src/lib/faceCameraEngine.js` (`initialize`), `src/lib/gestureEngine.js` |
| Scanning (terberat) | `engine.detect()` menjalankan deteksi (`inputSize: 416`), 68 titik, **dan** ResNet deskriptor untuk **setiap wajah di setiap frame**, padahal deskriptor baru dibutuhkan saat konfirmasi. Di mode Gesture, model tangan MediaPipe juga jalan setiap frame. | `faceCameraEngine.js` (`detect`), `FaceCameraCapture.jsx` (`runPassiveAttendance`, `runGestureAttendance`, loop `hands.detect`) |
| Konfirmasi | Dua panggilan fungsi berurutan per absen (`challenge`, lalu `recognize`), masing-masing dengan cek login dan RPC. Profile Card baru tampil setelah 5–6 query (`santri`, foto bertanda tangan, statistik bulanan, hafalan, `level_config`). | `FaceCameraCapture.jsx` (`confirm`, alur pasif), `FaceAttendancePage.jsx` (`capture`, `Promise.all`) |

Pencocokan di database **bukan** hambatan. Untuk ratusan santri (5 sampel per orang, ribuan vektor), pencarian pgvector masih di bawah sekian puluh milidetik dan tidak perlu indeks.

### Implementasi (branch `perf/face-kiosk`)

1. **Deskriptor hanya saat dibutuhkan.**
   - `faceCameraEngine.js` kini punya `detectFaces()` (deteksi + 68 titik) dan `describe()`. `describe` memotong wajah dengan `landmarks.align(null, { useDlibAlignment: true })`, sama persis dengan `withFaceDescriptors()`. **Bukan `alignedRect`** seperti rencana awal, karena `alignedRect` memakai potongan lain sehingga deskriptor tidak cocok dengan template.
   - Diuji pada gambar sampel face-api (`compareDescriptorPaths`): untuk deteksi yang sama, selisih jalur lama dan baru tepat 0.
   - Mode Otomatis: deskriptor hanya untuk frame frontal yang dikumpulkan. Saat menunggu santri bergeser, wajah dikenali dari kotak yang dilacak; deskriptor dihitung sekali hanya kalau kotaknya berganti.
   - Mode Gesture: deskriptor hanya untuk wajah yang mulai mengacungkan 👍. Kalau konfirmasi datang sebelum ada 5 frame, absen menunggu paling lama 2 detik (`CONFIRM_PENDING_MS`). HUD "siap" kini memakai 5 frame frontal terakhir (`frontalTimes`).
   - Registrasi santri dan guru tidak diubah.
2. **`inputSize` tetap 416.** Pada sampel 1280 px, skor deteksi turun di ukuran 320 (contoh: 0,86 → 0,52) di bawah ambang kiosk 0,8/0,85. Ukuran lain bisa dicoba di lokasi lewat `/absensi-wajah?debug-kinerja&ukuran-deteksi=384`. Kalau `?debug-kinerja` menunjukkan wajah tetap terdeteksi dan kesetaraan < 0,05, ubah `KIOSK_DETECTOR_SIZE`.
3. **Model tangan setiap 2 putaran** (`HAND_DETECT_EVERY`). Streak gesture hanya dihitung pada putaran yang menjalankan model tangan. Model tangan juga diunduh bersamaan dengan model wajah.
4. **Cache permanen** di `vercel.json` untuk `/face-models/`, `/gesture-models/`, dan file `js/css/wasm` di root `/assets/` (bernama hash). Gambar tier di `public/assets/tiers/` tidak bernama hash, jadi sengaja tidak ikut. Keenam file model wajah juga diunduh bersamaan; hash SHA-256 tetap dicek.
5. **Tantangan disiapkan lebih awal** untuk kedua mode (`src/lib/faceChallengeCache.js`). Tantangan dipakai maksimal 30 detik setelah diterbitkan. Setelah gagal, jeda 5 detik sebelum mencoba lagi. Waktu `evidence` mode Otomatis kini relatif terhadap frame pertama, sama seperti mode Gesture.
6. **Profile Card bertahap.** Kartu tampil setelah `recognize` + 1 query `santri`. Foto, statistik bulanan, dan hafalan menyusul. `level_config` dimuat sekali per halaman.
7. **Panel `?debug-kinerja`**: FPS, rata-rata `deteksi` / `deskriptor` / `tangan` / `tantangan` / `konfirmasi` / `recognize` / `kartu pertama` / `kartu lengkap`, waktu muat model, sumber model (`cache` / `validasi ulang` / `unduh`), dan tombol **Uji kesetaraan deskriptor** untuk frame kamera saat ini.

### Operasional
- **Untuk antrean ratusan santri, pakai mode Otomatis** (satu orang per giliran, tanpa model tangan). Mode Gesture lebih berat dan lebih cocok untuk suasana santai.
- **Kiosk sebaiknya perangkat khusus.** Di PC LPQ, `chrome://gpu` harus menunjukkan *WebGL: Hardware accelerated*. Kalau tertulis *Software only*, aktifkan akselerasi hardware di pengaturan Chrome atau perbarui driver GPU. HP pribadi hanya untuk uji.
- **Kapasitas:** perkiraan setelah perbaikan, satu kiosk melayani satu santri per 2–4 detik, atau sekitar 15–30 santri per menit. Kalau ratusan santri datang dalam waktu singkat, siapkan **2 kiosk** atau tetap buka **RFID berdampingan**.

### Selesai kalau
- Hasil `?debug-kinerja` di PC LPQ:
  - `deteksi` < 100 ms dan `deskriptor` < 150 ms;
  - mode Gesture sekitar 10 FPS. Mode Otomatis sengaja berhenti 120–160 ms setiap putaran, jadi FPS-nya memang hanya sekitar 5–7; yang diukur di sana adalah waktu deteksi;
  - `tantangan` + `kartu pertama` < 1,5 detik;
  - pembukaan kedua memuat model dari `cache`.
- Hasil uji lokal 2026-10-14 di laptop pengembang dengan webcam: `deteksi` 30 ms, `deskriptor` 39–68 ms, `tantangan` 0 ms, `recognize` 110 ms, `konfirmasi` 184–227 ms; mode Gesture 9,7 FPS. 👍 mencatat Guru Demo A.
- `npm test`, `npm run test:face`, `npm run build`, dan `npm run lint` lulus.
- Uji manual di PC LPQ: wajah santri dan guru yang **sudah terdaftar sebelum perubahan** tetap dikenali, tanpa perlu registrasi ulang.
