# AGENTS.md — LPQ Al-Fath Maulana

## 1. Prinsip utama

Kerjakan hanya ruang lingkup yang diminta pengguna.

Repository ini adalah aplikasi independen LPQ Al-Fath Maulana. Jangan menghubungkan, menyalin ulang, atau memakai credential, akun, data operasional, Project Ref, URL, domain, maupun asset identitas lembaga sumber. Semua layanan online baru memerlukan persetujuan eksplisit pengguna.

Gunakan alur:

`inspect minimal → implement → test relevan → commit/push`

Jangan melakukan audit seluruh repository, refactor tidak terkait, atau membuat dokumen tambahan tanpa kebutuhan nyata.

`master` harus selalu stabil. Production tidak boleh disentuh tanpa instruksi eksplisit pengguna.

## 2. Penggunaan referensi proyek

`AI_DEVELOPMENT_GUIDE.md` adalah handbook referensi, bukan bacaan wajib penuh pada setiap tugas.

Sebelum membacanya:

1. Tentukan jenis tugas.
2. Cari heading atau kata kunci yang relevan.
3. Baca hanya bagian yang diperlukan.
4. Jangan membaca seluruh file kecuali tugas benar-benar kompleks dan lintas sistem.

Panduan pemilihan bagian:

- UI/UX → UI/UX, accessibility, performance, testing, Git.
- Form atau field → end-to-end implementation, partial update, validation, database, testing.
- Schema atau database → migration, RLS, role matrix, testing, deployment.
- Auth atau role → Auth, RLS, security, integration test.
- Storage atau upload → Storage, upload contract, persistence, error handling.
- Bug kecil → tidak perlu membaca handbook panjang bila penyebab sudah jelas.
- Commit/push → gunakan aturan Git di file ini saja.

## 3. Penggunaan skill kreatif

Aktifkan `$lpq-creative-web-expert` hanya untuk:

- redesign;
- UI/UX;
- visual direction;
- halaman atau komponen baru;
- creative feature design;
- animation dan microinteraction;
- responsive polish;
- visual QA;
- peningkatan identitas visual produk.

Jangan aktifkan skill tersebut untuk:

- typo;
- perubahan label;
- commit/push;
- dokumentasi sederhana;
- perubahan konfigurasi kecil;
- bug satu baris dengan penyebab jelas;
- pekerjaan backend murni tanpa aspek produk atau visual.

Saat skill digunakan, baca hanya bagian yang relevan dengan tugas. Jangan memuat ulang seluruh skill berulang kali dalam satu sesi.

## 4. Branch dan deployment

Untuk perubahan besar atau eksperimen, jangan bekerja langsung di `master`.

Gunakan:

- `feat/<nama-fitur>`
- `fix/<nama-bug>`
- `chore/<nama-pekerjaan>`

Push branch agar Vercel membuat Preview Deployment.

Jangan merge ke `master` tanpa persetujuan pengguna.

Perubahan kecil yang eksplisit boleh dilakukan di `master` hanya jika:

- worktree sebelumnya bersih;
- risiko rendah;
- test lulus;
- pengguna memang meminta penerapan langsung.

Jangan force-push atau mengubah history bersama.

Gunakan `git revert` untuk membatalkan commit yang sudah dipush.

## 5. Implementasi field dan fitur

Jangan menyegel, menyembunyikan, menonaktifkan, atau memberi label “belum tersedia” pada field yang dibutuhkan hanya karena schema belum mendukungnya.

Implementasikan kebutuhan secara end-to-end:

`migration/schema → RLS/policy → adapter/query → validation → UI → test`

Field atau fitur dianggap selesai hanya jika:

- dapat dibuat;
- dapat disimpan;
- dapat diedit;
- tetap tersedia setelah refresh atau login ulang;
- tidak menimpa field lain;
- memiliki loading, success, error, dan empty state yang tepat.

Gunakan partial update untuk form edit. Jangan mengirim payload penuh bila hanya beberapa field berubah.

Jangan hardcode data yang sebelumnya berasal dari Supabase.

Jangan mengganti data dinamis dengan dummy content.

Jangan menghapus atau menurunkan fungsi aplikasi hanya agar error hilang.

## 6. Backend dan Supabase

Semua perubahan schema harus melalui migration baru.

Jangan mengubah migration lama yang sudah deployed.

Untuk perubahan database, RLS, Auth, Storage, pembayaran, absensi, atau role:

- evaluasi risiko terlebih dahulu;
- gunakan local Supabase/Docker bila pengujian lokal memang diperlukan;
- deploy ke Supabase staging setelah test lulus;
- jangan menyentuh production atau database lama.

Jangan membuat tabel atau kolom baru hanya untuk menyembunyikan bug frontend tanpa kebutuhan produk yang jelas.

## 7. UI/UX

Pertahankan:

- konteks isi;
- data lama;
- route;
- kontrak API;
- kemampuan admin mengelola konten.

Gaya resmi adalah **LPQ Aurora Neo-Glass**: frosted translucent glass, pencahayaan aurora teal–cyan–blue–violet, depth neumorphic lembut, kontrol tactile, spring microinteraction, light/dark mode yang matang, serta accessibility dan performa yang terjaga.

UI harus:

- responsif pada mobile, tablet, dan desktop;
- konsisten dengan design system;
- memiliki semantic HTML;
- memiliki focus state dan contrast yang baik;
- memiliki loading, empty, success, dan error state;
- tidak terasa seperti template AI generik;
- tidak menambahkan dependency besar tanpa kebutuhan kuat.

## 8. Pengujian proporsional

Pilih test berdasarkan risiko:

- perubahan kosmetik kecil → test komponen terkait atau build;
- fitur frontend normal → regression test terkait + build;
- schema/RLS/Auth/Storage → integration test terkait dan E2E bila diperlukan;
- refactor lintas modul → regression suite pada area terdampak.

Selalu jalankan minimal:

- test yang relevan;
- `npm run build`;
- `git diff --check`;
- no-secret scan.

Jangan menjalankan seluruh test suite berulang kali bila perubahan tidak berkaitan.

Jangan menjalankan bootstrap, migration, atau reset database tanpa kebutuhan.

## 9. Efisiensi context dan token

Medium adalah default.

Gunakan:

- Low untuk perubahan kosmetik sangat kecil;
- Medium untuk sebagian besar bug fix, UI, form, dan fitur normal;
- High hanya untuk arsitektur, migration kompleks, RLS/Auth, bug lintas banyak modul, atau investigasi yang benar-benar sulit.

Baca hanya file yang secara langsung relevan.

Gunakan pencarian simbol atau teks sebelum membuka file besar.

Jangan:

- membaca seluruh repository tanpa alasan;
- membaca seluruh handbook untuk tugas kecil;
- membuat planning document bila implementasi dapat langsung dilakukan;
- mengulang penjelasan yang sudah tersedia;
- menghasilkan laporan panjang;
- mengulang test mahal tanpa perubahan yang relevan.

## 10. Git dan commit

Commit harus kecil, terfokus, dan menggunakan Conventional Commits:

- `feat:`
- `fix:`
- `chore:`
- `test:`
- `docs:`

Jangan mencampurkan perubahan tidak terkait dalam satu commit.

Sebelum push pastikan:

- worktree sesuai ruang lingkup;
- test dan build lulus;
- tidak ada secret;
- tidak ada `.env*` atau `dist/` yang ikut ter-commit.

## 11. Format laporan akhir

Setelah selesai, laporkan secara ringkas:

- akar masalah atau tujuan perubahan;
- file utama yang berubah;
- hasil test dan build;
- commit hash;
- status push/deployment;
- langkah retest singkat.

Jangan menulis laporan panjang atau membuat file dokumentasi baru kecuali diminta.

## 12. Stop conditions

Berhenti dan laporkan sebelum melanjutkan jika:

- worktree memiliki perubahan asing;
- remote atau branch meragukan;
- tindakan dapat menyentuh production;
- migration berpotensi destruktif;
- requirement penting ambigu;
- credential atau login manual diperlukan;
- perubahan membutuhkan penghapusan data;
- scope berkembang jauh di luar permintaan awal.
