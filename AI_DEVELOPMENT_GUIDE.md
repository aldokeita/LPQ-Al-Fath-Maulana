# AI Development Guide — LPQ Al-Fath Maulana

> Pedoman operasional utama untuk Codex dan coding agent lain ketika merancang, mengembangkan, menguji, mengamankan, dan mendeploy website LPQ Al-Fath Maulana.

## 0. Status dokumen

- **Project:** LPQ Al-Fath Maulana
- **Stack utama:** React, Vite, Supabase, GitHub, Vercel
- **Bahasa komunikasi:** Bahasa Indonesia; technical terms boleh tetap dalam bahasa Inggris
- **Target default:** staging
- **Default branch stabil:** `master`
- **Production:** tidak boleh disentuh tanpa instruksi eksplisit pengguna
- **Prinsip utama:** implementasi lengkap, aman, dapat diuji, dapat di-rollback, dan hemat token
- **Independensi:** tidak boleh memakai identitas, akun, credential, URL, Project Ref, data, atau asset privat lembaga sumber
- **Gaya resmi:** LPQ Aurora Neo-Glass — frosted translucent glass, aurora teal–cyan–blue–violet, depth neumorphic lembut, kontrol tactile, spring microinteraction, light/dark mode matang, accessibility, dan performa terjaga

Dokumen ini adalah sumber aturan pengembangan lintas fitur. Instruksi pengguna pada task aktif tetap memiliki prioritas tertinggi selama tidak bertentangan dengan keamanan, integritas data, atau batas akses yang eksplisit.

---

## 1. Cara Codex menemukan dan menggunakan pedoman ini

Codex secara native menemukan instruksi repository melalui `AGENTS.md`. Karena file ini bernama `AI_DEVELOPMENT_GUIDE.md`, repository sebaiknya memiliki `AGENTS.md` ringkas yang mengarahkan Codex untuk membaca file ini pada task pengembangan.

Contoh isi `AGENTS.md` yang direkomendasikan:

```md
# Repository instructions

Sebelum melakukan perubahan produk, baca `AI_DEVELOPMENT_GUIDE.md`.
Untuk pekerjaan desain, UI/UX, fitur, atau visual QA, gunakan skill `$lpq-creative-web-expert` bila tersedia.
Baca hanya bagian panduan yang relevan dengan task agar penggunaan context tetap efisien.
```

Jangan menduplikasi seluruh isi dokumen ini ke `AGENTS.md`. `AGENTS.md` harus tetap kecil, stabil, dan hanya berisi aturan paling penting serta pointer ke panduan ini.

---

## 2. Urutan prioritas instruksi

Terapkan instruksi dalam urutan berikut:

1. Permintaan pengguna pada task aktif.
2. Batas keamanan dan perlindungan data.
3. Kontrak data, route, dan perilaku aplikasi yang sudah berjalan.
4. Migration dan schema yang sudah deployed.
5. `AGENTS.md` dan dokumen ini.
6. Skill yang sedang aktif.
7. Pola coding dan design system yang sudah ada.
8. Preferensi default Codex.

Jika dua instruksi bertentangan:

- jangan memilih diam-diam;
- jelaskan konflik secara singkat;
- ikuti intent pengguna bila aman;
- jangan menurunkan fungsi aplikasi hanya untuk menghindari pekerjaan backend.

---

## 3. Model lingkungan proyek

Gunakan model lingkungan berikut:

### 3.1 Local development

Digunakan untuk:

- edit source code;
- menjalankan Vite;
- unit test dan frontend regression test;
- Supabase lokal bila perubahan backend memerlukannya;
- validasi migration sebelum staging.

Docker hanya diperlukan saat Supabase lokal atau service container lain benar-benar digunakan.

### 3.2 Staging

Staging adalah lingkungan uji online yang menyerupai production, tetapi menggunakan project, data, akun, URL, dan konfigurasi terpisah.

Kondisi proyek saat dokumen dibuat:

- frontend staging dideploy melalui Vercel;
- backend staging memakai Supabase project terpisah;
- akun dan data dummy dipakai untuk UAT;
- fitur dapat dan harus dikembangkan penuh di staging;
- staging bukan alasan untuk menonaktifkan field atau membatasi fitur yang memang dibutuhkan.

### 3.3 Production

Production adalah website resmi dengan data nyata.

Jangan:

- menjalankan migration production;
- mengubah RLS production;
- mengganti domain production;
- menghapus atau memigrasikan data asli;
- mempromosikan deployment;

kecuali pengguna memberi instruksi eksplisit dan scope sudah diverifikasi.

---

## 4. Prinsip produk

Semua keputusan harus memperkuat tujuan berikut:

- memudahkan admin mengelola lembaga;
- memudahkan guru menjalankan pembelajaran dan administrasi;
- memudahkan pentashih mengakses assignment yang relevan;
- memudahkan santri dan wali memahami progres, absensi, dan kewajiban;
- membuat website publik kredibel, hangat, modern, dan sesuai identitas LPQ;
- menjaga privasi, akurasi data, dan permission antar-role;
- membuat sistem mudah dipelihara dan dikembangkan.

Jangan mengorbankan fungsi inti demi visual, dan jangan mengorbankan kualitas UX demi implementasi tercepat.

---

## 5. Prinsip hemat token dan context

Default workflow:

```text
inspect minimal -> reproduce/understand -> implement -> test relevan -> commit/push -> report singkat
```

### 5.1 Context acquisition

Sebelum mengedit:

1. Baca task pengguna secara literal.
2. Baca bagian relevan dokumen ini, bukan seluruh dokumentasi lain.
3. Temukan route/page/component target.
4. Baca adapter/query yang langsung dipakai.
5. Baca test terdekat.
6. Baca migration/schema hanya jika task menyentuh data.
7. Perluas inspeksi hanya bila ditemukan dependency lintas modul.

### 5.2 Larangan pemborosan context

Jangan:

- melakukan audit seluruh repository untuk bug kecil;
- membaca semua file dokumentasi tanpa kebutuhan;
- membuat planning document untuk task singkat;
- membuat banyak laporan baru;
- mengulang sejarah proyek dalam setiap jawaban;
- menjalankan seluruh test suite bila perubahan hanya menyentuh satu modul;
- mengulang test remote mahal tanpa perubahan relevan;
- meminta konfirmasi untuk keputusan kecil yang sudah jelas dari konteks.

### 5.3 Pemilihan reasoning effort

- **Low:** typo, copy, spacing, warna, icon, konfigurasi sangat kecil.
- **Medium:** default untuk bug normal, form, halaman, UI/UX, adapter, fitur satu modul.
- **High:** migration kompleks, Auth, RLS, pembayaran, keamanan, refactor lintas modul, bug tanpa akar jelas, atau perubahan arsitektur.

Gunakan level serendah mungkin yang tetap aman dan akurat.

---

## 6. Klasifikasi task sebelum implementasi

### 6.1 Cosmetic change

Contoh:

- warna;
- spacing;
- font size;
- icon;
- alignment;
- satu defect responsive.

Aturan:

- jangan ubah behavior;
- jangan refactor lintas modul;
- jalankan test terdekat dan build.

### 6.2 Frontend feature atau redesign

Contoh:

- redesign homepage;
- dashboard baru;
- modal baru;
- navigasi mobile;
- visualisasi data.

Aturan:

- gunakan branch fitur untuk perubahan besar;
- pertahankan data dan route lama;
- uji desktop dan mobile;
- gunakan Vercel Preview sebelum merge bila eksperimen visual signifikan.

### 6.3 Full-stack feature

Contoh:

- field baru;
- prestasi santri;
- portal wali;
- upload dokumen;
- workflow persetujuan.

Aturan:

- definisikan data lifecycle dan permission;
- implementasikan migration, RLS, adapter, UI, validation, dan test;
- jangan menyelesaikan masalah dengan men-disable kebutuhan pengguna.

### 6.4 Backend/security change

Contoh:

- Auth;
- RLS;
- RPC;
- Storage policy;
- Edge Function;
- payment/expense logic;
- data migration.

Aturan:

- gunakan High bila scope kompleks;
- uji lokal bila memungkinkan;
- deploy ke staging setelah test;
- jalankan role matrix test;
- jangan menyentuh production.

### 6.5 Bug fix

Aturan:

1. Reproduce.
2. Identifikasi root cause.
3. Perbaiki root cause, bukan hanya symptom.
4. Tambahkan regression test bila feasible.
5. Ulangi reproduction yang sama.
6. Pastikan tidak merusak flow terkait.

---

## 7. Branching dan deployment workflow

### 7.1 Default branch

`master` harus selalu stabil dan deployable.

### 7.2 Branch naming

Gunakan:

- `feat/<nama-fitur>`
- `fix/<nama-bug>`
- `chore/<nama-pekerjaan>`
- `docs/<nama-dokumentasi>`
- `test/<nama-validasi>`

Gunakan nama singkat, lowercase, dan hyphen-separated.

### 7.3 Kapan branch wajib

Gunakan branch terpisah untuk:

- redesign besar;
- fitur baru;
- perubahan backend;
- eksperimen visual;
- perubahan lintas banyak file;
- pekerjaan yang mungkin ditolak pengguna.

Perubahan dokumentasi kecil atau hotfix sangat kecil boleh langsung ke `master` bila pengguna memintanya dan worktree bersih.

### 7.4 Vercel Preview

Untuk branch non-production:

- push branch;
- gunakan Preview Deployment;
- uji visual dan fungsi;
- jangan merge otomatis;
- tunggu persetujuan pengguna.

### 7.5 Merge

Sebelum merge:

- build lulus;
- test relevan lulus;
- diff bersih;
- tidak ada credential;
- Preview sudah diperiksa bila diperlukan;
- tidak ada migration yang belum deployed ke staging.

### 7.6 Rollback

Frontend:

- gunakan Vercel rollback/promote deployment lama untuk pemulihan cepat;
- gunakan `git revert <commit>` untuk pembatalan permanen yang menjaga history.

Jangan menggunakan `git reset --hard` atau force-push pada branch bersama.

Database:

- rollback harus dirancang sebagai migration baru;
- jangan mengedit migration lama yang sudah deployed;
- prefer forward-fix untuk schema production/staging yang sudah digunakan.

---

## 8. Aturan implementasi end-to-end

Suatu fitur belum selesai hanya karena UI sudah terlihat.

Definition of end-to-end untuk field atau fitur data:

1. Schema mendukung data.
2. Constraint benar.
3. Migration tercatat.
4. RLS dan grants sesuai role.
5. Adapter/query menggunakan nama kolom aktual.
6. Form memvalidasi input.
7. Save mengembalikan row atau status yang dapat diverifikasi.
8. Data dapat dibaca kembali setelah refresh.
9. Edit tidak menimpa field yang tidak berubah.
10. Loading, success, error, dan empty state tersedia.
11. Test membuktikan behavior utama.

### 8.1 Aturan field yang belum ada di schema

Dilarang menyelesaikan kebutuhan pengguna dengan:

- men-disable field;
- menyembunyikan field;
- menghapus field;
- memberi label “belum tersedia”;
- menyimpan hanya di state lokal;

kecuali pengguna secara eksplisit menyetujui fitur ditunda.

Jika field dibutuhkan, tambahkan dukungan end-to-end.

### 8.2 Partial update

Untuk edit record:

- kirim hanya field yang benar-benar berubah bila memungkinkan;
- jangan mengubah `undefined` menjadi `null` tanpa intent;
- jangan mengosongkan field lama karena form tidak memuat seluruh data;
- minta query update mengembalikan row;
- verifikasi row hasil update.

### 8.3 Upsert

Sebelum memakai upsert:

- pastikan conflict key benar;
- sertakan semua kolom `NOT NULL` yang diperlukan saat insert;
- jangan mengasumsikan record sudah ada;
- bedakan create dan update bila behavior berbeda;
- jangan menghapus properti JSON lain saat mengubah satu key.

---

## 9. Database dan migration

### 9.1 Migration-first

Semua perubahan schema harus menjadi file migration yang versioned.

Jangan:

- mengubah schema staging hanya melalui Dashboard tanpa migration;
- mengedit migration lama yang sudah deployed;
- mengandalkan state database yang tidak dapat direproduksi.

### 9.2 Migration design

Prefer:

- additive changes;
- nullable column sebelum backfill bila data lama belum lengkap;
- explicit defaults;
- explicit constraints;
- index untuk query penting;
- deterministic backfill;
- idempotent helper hanya bila memang diperlukan.

Hindari:

- destructive drop tanpa backup/transition plan;
- rename kolom tanpa compatibility plan;
- lock berat pada tabel besar;
- perubahan tipe yang berisiko tanpa data audit.

### 9.3 Testing migration

Untuk perubahan berisiko:

1. Jalankan Supabase lokal.
2. Reset/apply seluruh migration.
3. Jalankan seed/test data.
4. Jalankan database test.
5. Verifikasi schema diff.
6. Deploy staging.
7. Jalankan staging E2E relevan.

Untuk penambahan kolom sederhana, test dapat dipersempit tetapi tetap harus memastikan migration dapat diterapkan dari kondisi bersih.

### 9.4 Data nyata

Jangan menggunakan data santri nyata untuk test otomatis.

Gunakan:

- fixture;
- seed;
- akun dummy;
- prefix unik test;
- cleanup yang hanya menyentuh data test.

---

## 10. RLS, Auth, dan permission

### 10.1 Secure by default

Semua tabel yang diakses dari browser harus dianggap tidak aman tanpa RLS yang benar.

- aktifkan RLS;
- definisikan policy berdasarkan role dan ownership;
- uji allow dan deny;
- jangan mengandalkan UI untuk keamanan;
- jangan menggunakan service-role key di frontend.

### 10.2 Role matrix

Minimal role yang perlu dipertimbangkan:

- anon;
- authenticated tanpa profil valid;
- admin;
- guru;
- pentashih;
- santri;
- wali bila fitur tersebut ditambahkan.

Untuk setiap operasi, tentukan:

- siapa boleh `select`;
- siapa boleh `insert`;
- siapa boleh `update`;
- siapa boleh `delete` atau soft-delete;
- field/row apa yang boleh terlihat.

### 10.3 Auth session

Untuk request Edge Function yang mewakili pengguna:

- kirim bearer token session user;
- sertakan publishable key sesuai kebutuhan client;
- jangan mengganti session user dengan service role hanya agar request berhasil;
- tangani session expired dan refresh dengan jelas.

### 10.4 Error handling RLS

Jangan memberi pesan umum “database error” untuk semua kasus.

Bedakan:

- unauthenticated;
- forbidden/RLS denied;
- validation;
- record not found;
- conflict;
- network failure;
- server failure.

Tetap jangan membocorkan detail sensitif kepada pengguna akhir.

---

## 11. Storage dan file upload

### 11.1 Bucket dan path

- gunakan bucket sesuai tujuan;
- gunakan path namespaced berdasarkan entity/user bila diperlukan;
- sanitasi filename;
- gunakan UUID untuk menghindari collision;
- simpan path stabil, bukan signed URL sementara, bila file private.

### 11.2 MIME dan size

- validasi MIME client dan server;
- jangan mengandalkan extension saja;
- hormati allowlist bucket;
- batasi ukuran file;
- berikan error yang jelas.

### 11.3 Public vs private

- public asset boleh menggunakan public URL;
- data personal harus memakai private bucket dan signed URL;
- signed URL harus memiliki expiry yang wajar;
- jangan menyimpan signed URL sebagai sumber permanen.

### 11.4 Upload transaction

Urutan ideal:

1. Validasi file.
2. Upload.
3. Verifikasi hasil upload.
4. Simpan path/metadata ke database.
5. Perbarui UI setelah database sukses.
6. Bersihkan orphan object bila database gagal, bila aman dilakukan.

Notifikasi sukses hanya boleh muncul setelah seluruh transaction yang diperlukan selesai.

---

## 12. Edge Functions dan server-side logic

Gunakan Edge Function saat:

- operasi memerlukan credential server;
- perlu validasi privilege tambahan;
- perlu integrasi layanan eksternal;
- perlu signed upload workflow;
- perlu user administration;
- logika tidak aman dijalankan di browser.

Aturan:

- validasi auth dan role di server;
- validasi input dengan schema yang jelas;
- return status code yang tepat;
- jangan log token, password, atau payload sensitif;
- buat contract request/response stabil;
- tambahkan test success dan denial;
- deploy hanya function yang berubah.

---

## 13. Frontend architecture

### 13.1 Separation of concerns

Pisahkan:

- presentational component;
- feature/component state;
- adapter/data access;
- validation;
- domain helper;
- route guard;
- formatting.

Jangan meletakkan seluruh query, business logic, dan UI dalam satu component besar.

### 13.2 Adapters

Adapter harus:

- memakai schema aktual;
- memetakan legacy field secara eksplisit bila masih diperlukan;
- tidak menyembunyikan error;
- mengembalikan bentuk data yang konsisten;
- mendukung abort/cancellation bila query dapat race;
- menghindari duplicate fetching tanpa kebutuhan.

### 13.3 State

- server data bukan source of truth permanen di local state;
- refresh data setelah mutation penting;
- gunakan optimistic update hanya bila rollback jelas;
- hindari stale state untuk bukti pembayaran, permission, atau data sensitif;
- reset state saat user/role berubah.

### 13.4 Routes

- pertahankan route publik dan dashboard yang sudah ada;
- direct-open dan refresh harus bekerja di Vercel;
- route guard harus memeriksa auth dan role;
- jangan hanya menyembunyikan menu bila route tetap dapat dibuka tanpa izin.

---

## 14. UI/UX dan design system

Gunakan skill `$lpq-creative-web-expert` untuk pekerjaan desain besar bila tersedia.

Prinsip umum:

- modern Islamic educational premium;
- jelas, hangat, profesional, dan child-friendly;
- tidak terasa seperti template AI generik;
- satu visual thesis yang konsisten;
- kreativitas harus meningkatkan fungsi.

### 14.1 Design tokens

Gunakan token bersama untuk:

- semantic colors;
- typography;
- spacing;
- radius;
- shadow;
- border;
- motion;
- focus ring;
- breakpoint;
- container width.

Jangan membuat nilai acak per halaman jika token yang sesuai sudah ada.

### 14.2 Responsive behavior

Minimal uji:

- 360–390 px;
- 430 px;
- 768 px;
- 1280 px;
- 1440 px.

Periksa:

- overflow;
- hierarchy;
- touch target;
- drawer/navigation;
- table/form adaptation;
- modal height;
- sticky element;
- keyboard viewport pada mobile bila relevan.

### 14.3 Forms

Setiap form harus memiliki:

- label jelas;
- required/optional state;
- validation message dekat field;
- disabled state yang benar;
- loading state;
- duplicate submit protection;
- success/error feedback;
- data tetap terisi bila save gagal.

Field hanya boleh disabled karena alasan nyata, bukan karena implementasi backend belum selesai.

### 14.4 Accessibility

Target minimum: praktik WCAG 2.2 Level AA yang relevan.

Pastikan:

- semantic HTML;
- keyboard navigation;
- visible focus;
- contrast memadai;
- alt text;
- form association;
- error identification;
- target size yang nyaman;
- reduced motion;
- status message dapat dipahami assistive technology.

### 14.5 Visual identity dan animasi

Bangun karakter visual halaman melalui pendekatan berikut, bukan melalui dekorasi berlebihan:

- **typography editorial yang kuat** — gunakan font display yang menarik untuk heading;
- **`GradientText`** — penekanan kata atau frasa penting secara selektif;
- **`SplitText`** — hero heading atau heading section utama;
- **`BlurText`** — entrance lembut untuk heading pendek;
- **`ScrollReveal`** — statement naratif atau paragraf pendek;
- **accent line, numbering, border, surface, dan whitespace** — struktur visual tanpa ornament;
- **icon SVG yang konsisten** — hanya saat ikon membantu pemahaman, bukan sebagai hiasan.

Referensi efek teks: `https://reactbits.dev/text-animations/`

#### Emoji

Emoji hanya boleh dipakai jika memiliki fungsi komunikasi yang jelas dan sesuai konteks. Jangan menggunakan emoji sebagai dekorasi default pada card, heading, atau section.

#### Penggunaan efek React Bits

Sebelum menggunakan efek dari React Bits:

1. Periksa apakah komponen tersebut sudah tersedia di project.
2. Reuse implementasi yang sudah ada bila ada.
3. Gunakan maksimal satu efek teks dominan per section.
4. Jangan menambahkan beberapa animasi berbeda hanya demi variasi.
5. Jangan menganimasikan seluruh paragraf panjang per karakter.
6. Hindari efek glitch, scramble, rotating, atau typewriter pada halaman yang membutuhkan kesan tenang dan berwibawa, kecuali benar-benar sesuai konteks.
7. Pastikan heading tetap terbaca sebelum JavaScript selesai dimuat (tidak bergantung pada JS untuk konten utama).
8. Hindari hydration mismatch dan layout shift.
9. Hormati `prefers-reduced-motion`.
10. Jangan mengorbankan accessibility, SEO, performa, atau keterbacaan.

#### Pemilihan animasi berdasarkan fungsi

| Komponen | Fungsi |
|---|---|
| `GradientText` | Penekanan kata atau frasa penting |
| `SplitText` | Hero heading atau heading section utama |
| `BlurText` | Entrance lembut untuk heading pendek |
| `ScrollReveal` | Statement naratif atau paragraf pendek |
| Efek lain | Hanya jika selaras dengan identitas halaman, bukan demo teknologi |

Website harus terasa premium dan khas — bukan etalase seluruh efek React Bits.

---

## 15. Performance

Prioritaskan pengalaman nyata, bukan sekadar skor.

### 15.1 Frontend

- lazy-load route/komponen berat;
- lazy-load gambar below the fold;
- stabilkan ukuran gambar untuk mencegah CLS;
- hindari dependency besar untuk fungsi kecil;
- jangan fetch data yang tidak terlihat;
- gunakan pagination untuk dataset besar;
- debounce pencarian;
- hindari re-render tidak perlu.

### 15.2 Database

- pilih kolom yang diperlukan;
- hindari N+1 query;
- index filter/join penting;
- cek query plan untuk query berat;
- jangan menggunakan view/function privileged tanpa memahami security mode;
- ukur dampak policy RLS pada query penting.

### 15.3 Build

Perhatikan warning bundle besar. Jangan melakukan refactor bundling besar hanya karena warning tanpa mengukur dampaknya, tetapi dokumentasikan dan prioritaskan bila route awal menjadi lambat.

---

## 16. Security

Gunakan prinsip secure by default dan least privilege.

### 16.1 Credential

Dilarang commit:

- database password;
- service-role key;
- Supabase secret key;
- GitHub token;
- Vercel token;
- session token;
- private key;
- `.env*` yang berisi credential.

Publishable browser key boleh berada dalam environment frontend sesuai desain Supabase, tetapi tetap jangan menyalin nilainya ke dokumentasi atau log tanpa kebutuhan.

### 16.2 Input dan output

- validasi input di boundary;
- encode output sesuai context;
- jangan membangun raw SQL dari input;
- sanitasi URL dan filename;
- cegah open redirect;
- jangan render HTML tidak tepercaya;
- batasi upload;
- tangani rate abuse pada endpoint publik.

### 16.3 Dependency

- jangan menambah package tanpa alasan;
- cek maintenance dan license;
- prefer API platform/native;
- tangani vulnerability yang relevan dengan usage aktual;
- jangan melakukan upgrade major massal dalam task fitur kecil.

---

## 17. Testing strategy

Testing harus proporsional terhadap risiko.

### 17.1 Test pyramid proyek

1. Pure helper/unit test.
2. Adapter/component integration test.
3. Database/RLS test.
4. API/Edge Function test.
5. Browser smoke/E2E.
6. Manual UAT staging.

Tidak semua task memerlukan semua layer.

### 17.2 Minimum test berdasarkan perubahan

#### Cosmetic

- test terkait bila ada;
- build;
- visual check target viewport.

#### Form/data adapter

- validation test;
- mutation payload test;
- refresh/read-back test;
- build.

#### Backend/RLS

- migration apply/reset;
- allow/deny role test;
- integrity constraint test;
- API smoke;
- build frontend bila contract berubah.

#### Auth/payment/attendance

- regression suite terkait;
- role test;
- duplicate/conflict test;
- timezone/boundary test;
- browser smoke;
- manual staging verification.

### 17.3 Stable test data

- gunakan identifier unik;
- cleanup berdasarkan prefix test yang spesifik;
- cleanup di `finally` bila script mendukung;
- jangan menghapus data di luar namespace test;
- test harus idempotent bila dijalankan ulang.

### 17.4 Mandatory checks sebelum commit

Minimal:

- test relevan;
- `npm run build`;
- `git diff --check`;
- no-secret scan.

Tambahkan lint/typecheck bila tersedia di repository.

---

## 18. Observability dan error handling

Setiap workflow penting harus mudah didiagnosis.

### 18.1 User-facing errors

Pesan harus:

- menjelaskan tindakan yang gagal;
- tidak hanya menampilkan `[object Object]` atau `null`;
- memberi langkah retry bila aman;
- tidak membocorkan detail internal.

### 18.2 Developer diagnostics

Boleh mencatat:

- operation name;
- safe entity ID;
- HTTP status;
- Postgres/Supabase error code;
- sanitized message;
- step yang gagal.

Jangan mencatat:

- password;
- access token;
- authorization header;
- full secret;
- data pribadi yang tidak diperlukan.

### 18.3 Silent failure

Dilarang:

- menelan error dan menampilkan sukses;
- menyimpan sebagian data tanpa memberi tahu pengguna;
- fallback ke dummy data seolah-olah data asli;
- menyembunyikan permission error sebagai empty state biasa.

---

## 19. Deferred features

Fitur deferred hanya boleh nonaktif bila memang ditetapkan demikian.

Saat `VITE_ENABLE_DEFERRED_FEATURES=false`:

- component deferred tidak dimount;
- hook deferred tidak query;
- diagnostic checker tidak memeriksa schema deferred;
- tidak ada request network ke tabel/function deferred;
- route/menu deferred tidak menyesatkan pengguna.

Jangan membuat tabel dummy hanya untuk menghilangkan error fitur yang sengaja nonaktif.

Saat pengguna ingin mengaktifkan fitur deferred:

- audit contract lama;
- implementasikan backend dan frontend yang benar;
- uji end-to-end;
- baru aktifkan feature flag.

---

## 20. Dokumentasi

Dokumentasi harus berguna, bukan ritual.

Buat file baru hanya jika:

- ada keputusan arsitektur jangka panjang;
- ada prosedur operasional yang akan digunakan ulang;
- pengguna memintanya;
- perubahan cukup besar untuk membutuhkan runbook.

Untuk task biasa:

- update dokumen yang sudah ada;
- jangan membuat nomor laporan baru setiap kali;
- jangan menyimpan secret;
- catat keputusan dan hasil, bukan seluruh transcript kerja.

Dokumentasi perubahan minimal mencakup:

- tujuan;
- perubahan penting;
- migration/configuration bila ada;
- langkah test;
- rollback/recovery bila berisiko.

---

## 21. Commit, push, dan laporan akhir

### 21.1 Commit

Gunakan Conventional Commits:

- `feat:` fitur baru;
- `fix:` bug fix;
- `refactor:` perubahan struktur tanpa behavior baru;
- `test:` test;
- `docs:` dokumentasi;
- `chore:` maintenance/config.

Commit harus:

- fokus pada satu perubahan logis;
- tidak memuat file tidak terkait;
- tidak memuat build artifact atau `.env`;
- memiliki pesan spesifik.

### 21.2 Push

Sebelum push:

- pastikan branch benar;
- pastikan remote benar;
- jangan force-push;
- jangan push ke `master` bila task harus dievaluasi di Preview;
- jangan merge tanpa persetujuan pengguna untuk eksperimen besar.

### 21.3 Laporan akhir hemat token

Laporkan hanya:

1. Akar masalah atau tujuan yang diselesaikan.
2. File utama yang berubah.
3. Hasil test/build.
4. Commit hash.
5. Branch dan status push/deployment.
6. Langkah retest manual singkat.
7. Blocker yang benar-benar masih ada.

Jangan mengulang prompt pengguna atau menulis laporan panjang bila tidak diminta.

---

## 22. Definition of Done

### 22.1 UI/UX change

Selesai bila:

- visual sesuai intent;
- desktop dan mobile diperiksa;
- route dan CTA bekerja;
- loading/error/empty state tetap benar;
- tidak ada regression data;
- build lulus;
- Preview tersedia bila perlu.

### 22.2 Field/form change

Selesai bila:

- field dapat diisi;
- validation benar;
- save berhasil;
- refresh mempertahankan data;
- edit tidak merusak field lain;
- permission sesuai role;
- test tersedia.

### 22.3 Backend feature

Selesai bila:

- migration versioned;
- schema dapat direproduksi;
- RLS/grants benar;
- API/adapter menggunakan contract baru;
- allow dan deny diuji;
- staging deployment lulus;
- frontend flow lulus.

### 22.4 Bug fix

Selesai bila:

- bug dapat direproduksi sebelum fix;
- root cause diketahui;
- regression test atau bukti validasi tersedia;
- reproduction setelah fix lulus;
- tidak ada workaround yang menurunkan fungsi.

---

## 23. Stop conditions

Berhenti dan minta input pengguna bila:

- target production tidak jelas;
- ada risiko kehilangan data;
- remote/branch tidak sesuai;
- credential/login interaktif diperlukan;
- requirement bisnis memiliki dua interpretasi yang menghasilkan data model berbeda;
- destructive migration diperlukan;
- perubahan akan menghapus fitur atau data lama;
- biaya/layanan eksternal baru perlu disetujui.

Jangan berhenti hanya karena:

- field belum ada;
- migration perlu dibuat;
- UI lama rumit;
- test perlu ditambah;
- perubahan melibatkan frontend dan backend.

Untuk kasus tersebut, implementasikan solusi end-to-end sesuai scope.

---

## 24. Prohibited behaviors

Dilarang:

- menonaktifkan kebutuhan pengguna agar error hilang;
- hardcode data dinamis sebagai pengganti database;
- menampilkan sukses sebelum persistence selesai;
- menggunakan service-role key di browser;
- mengubah migration lama yang sudah deployed;
- force-push branch utama;
- menyentuh production tanpa instruksi;
- menghapus data staging tanpa scope cleanup yang aman;
- membuat refactor besar yang tidak terkait;
- menambah dependency besar tanpa alasan;
- mengabaikan mobile dan accessibility;
- menyembunyikan error permission sebagai data kosong;
- mencetak credential pada log atau dokumentasi;
- membuat banyak dokumen untuk satu task kecil;
- menjalankan test remote berulang tanpa perubahan relevan.

---

## 25. Quick execution checklist

### Sebelum coding

- [ ] Pahami intent pengguna.
- [ ] Tentukan apakah task frontend, full-stack, atau backend/security.
- [ ] Pastikan branch dan worktree benar.
- [ ] Baca file target, adapter, test, dan schema yang relevan saja.
- [ ] Tentukan test minimum berdasarkan risiko.

### Saat coding

- [ ] Perbaiki root cause.
- [ ] Pertahankan contract dan data lama.
- [ ] Implementasikan end-to-end bila schema berubah.
- [ ] Tangani loading, success, error, dan empty state.
- [ ] Jaga responsive, accessibility, dan permission.

### Sebelum commit

- [ ] Test relevan lulus.
- [ ] Build lulus.
- [ ] `git diff --check` lulus.
- [ ] No-secret scan lulus.
- [ ] Tidak ada file tidak terkait.
- [ ] Migration lama tidak diubah.

### Sebelum push/merge

- [ ] Branch tujuan benar.
- [ ] Preview digunakan untuk eksperimen besar.
- [ ] Staging backend sudah kompatibel.
- [ ] Rollback diketahui.
- [ ] Production tidak disentuh.

---

## 26. Format instruksi task yang ideal

Prompt task yang hemat token sebaiknya berisi:

```text
Tujuan:
<hasil yang diinginkan>

Scope:
<halaman/fitur/file utama>

Pertahankan:
<data, route, behavior, atau UI tertentu>

Wajib:
<requirement fungsional dan teknis>

Jangan:
<batas perubahan>

Validasi:
<test/build/retest yang diperlukan>

Git:
<branch, commit, push, atau Preview>
```

Hindari prompt yang mengulang seluruh arsitektur proyek. Referensikan dokumen ini untuk aturan umum.

---

## 27. Sumber praktik yang mendasari dokumen

Panduan ini disusun dengan mengadaptasi dokumentasi resmi dan standar berikut:

### OpenAI Codex

- [Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
- [Codex best practices](https://developers.openai.com/codex/learn/best-practices)
- [Codex Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide)
- [Agent Skills](https://developers.openai.com/codex/skills)
- [Using PLANS.md for multi-hour problem solving](https://developers.openai.com/cookbook/articles/codex_exec_plans)

### GitHub

- [GitHub Flow](https://docs.github.com/get-started/quickstart/github-flow)
- [About pull requests](https://docs.github.com/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests)
- [About protected branches](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Best practices for repositories](https://docs.github.com/repositories/creating-and-managing-repositories/best-practices-for-repositories)

### Vercel

- [Deploying Git repositories](https://vercel.com/docs/git)
- [Deployment environments](https://vercel.com/docs/deployments/environments)
- [Promoting a Preview Deployment](https://vercel.com/docs/deployments/promote-preview-to-production)

### Supabase

- [Local development with schema migrations](https://supabase.com/docs/guides/local-development/overview)
- [Database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Testing overview](https://supabase.com/docs/guides/local-development/testing/overview)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Managing environments](https://supabase.com/docs/guides/deployment/managing-environments)
- [Production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)

### Web standards and security

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
- [OWASP Secure by Default](https://devguide.owasp.org/en/04-design/02-web-app-checklist/01-secure-by-default/)

Dokumen ini harus diperbarui bila stack, workflow branch, environment, atau kebijakan deployment proyek berubah secara material.
