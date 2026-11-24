# Pengujian Bun & Fleur Kids

Tanggal 24 November 2026 WIB. Basis `main` commit `2b84782`. Build dari checkout lokal Bun 1.4.5, Vite 7, dan Node 24. Database QA adalah PostgreSQL loopback yang dibuat ulang dengan peran fixture `anon` dan `authenticated`.

## Pemeriksaan otomatis

| Pengujian | Hasil |
| --- | --- |
| `bun install --frozen-lockfile` | Lulus |
| `bun run typecheck` | Lulus untuk frontend, backend, dan adapter yang masuk konfigurasi TypeScript |
| `bun test` | 33 lulus, 0 gagal |
| `bun run build` | Lulus, Vite memperingatkan ukuran satu chunk awal |
| `bun audit` | 0 advisori setelah pembaruan Zod |
| `git diff --check` | Lulus, repo tidak menyediakan script lint |
| `bun run test:integration` | Lulus: migrasi/RLS, otorisasi admin, proyek pengunjung terpisah, normalisasi HP, PIN/token dan lockout paralel, kupon, snapshot produk, kuantitas, idempotensi, nominal QRIS, bukti pembayaran, referensi unik, status, ledger komisi, payout parsial, paginasi dan perubahan harga |
| Layanan produksi | Tidak dipakai. Fixture menggunakan data sintetis |

## Chromium lokal

| Cakupan | Hasil |
| --- | --- |
| Desktop Chrome emulasi 1440 × 900 | Homepage dan Studio tanpa overflow horizontal. Akses admin melalui URL awal mengharuskan login dan API menolak sesi tamu. |
| Android Pixel emulasi | Sentuhan CDP mewarnai fixture untuk usia 9–18 bulan, 18–24 bulan, 2–3 tahun, 3–4 tahun, dan 4–5 tahun. Urungkan dan ulangi mengembalikan keadaan warna tiap usia. |
| Gesture dan penyimpanan | Pinch memperbesar kanvas tanpa menggeser halaman atau menambah warna. Reset, undo reset, simpan, dan resume lewat Kreasiku diverifikasi. |
| iPhone viewport dan Android landscape | Homepage dan Studio tanpa overflow horizontal, menggunakan Chromium dan profil viewport/sentuh Playwright. |
| Tablet portrait dan landscape | Homepage dan Studio tanpa overflow horizontal pada profil viewport tablet. |
| Checkout | Personalisasi Puzzle, kuantitas dua, data fiktif, order confirmation, dan aset QRIS asli. Konfirmasi pembayaran tertahan saat ongkos kirim belum dicatat. |
| Affiliate | Pendaftaran lewat UI, validasi kupon, login +62/PIN, dan sesi HttpOnly. |
| Aksesibilitas otomatis homepage | Axe-core melaporkan satu jenis temuan kontras pada 41 elemen selama pengujian. Setelah perbaikan, pemindaian ulang desktop melaporkan 0 temuan pada aturan WCAG A/AA yang dijalankan. Font eksternal dinonaktifkan untuk pengujian lokal. |

Bukti tangkapan layar berasal dari checkout basis dan build lokal audit, memakai data sintetis.

- [Homepage mobile sebelum](qa/screenshots/home-mobile-before.webp)
- [Homepage mobile sesudah](qa/screenshots/home-mobile-after.webp)
- [Studio Android sesudah](qa/screenshots/studio-android-after.webp)

## Cara mengulangi secara lokal

1. Siapkan PostgreSQL disposable di loopback, database bernama `bfk_test` atau `bfk_audit`, dengan role `anon` dan `authenticated` untuk menjalankan migrasi yang menyasar Supabase. Jangan arahkan tes ke database produksi.
2. Jalankan `bun install --frozen-lockfile`, lalu `bun run build`. Untuk integrasi, set `BFK_TEST_DATABASE_URL` ke database fixture dan jalankan `bun run test:integration`.
3. Untuk UI, set `DATABASE_URL` ke fixture tersebut, `ADMIN_SESSION_SECRET` dengan nilai lokal minimal 32 karakter, dan `ADMIN_PASSWORD_HASH` dengan format `salt:hex-scrypt`. Jalankan `bun run dev:api` dan `bun x vite preview --host localhost` di terminal terpisah. Vite meneruskan API ke port 8787. Gunakan `http://localhost:4173` di Chromium.
4. Di Studio, pilih kelompok usia, coba sentuhan pendek dan urungkan/ulangi, cubit/gulir di kanvas, matikan suara, lalu simpan dan buka kembali lewat Kreasiku. Di checkout, pilih produk, kuantitas dan kupon sintetis. Di dasbor admin, isi ongkir fixture, kirim bukti uji dari pelacakan, lalu cocokkan referensi fixture di admin.

## Batas verifikasi

Uji lokal tidak mengirim pembayaran, menghubungi merchant, menggunakan database production, atau menjalankan Netlify build. Kompatibilitas deployment dinilai dari build lokal serta pengujian adapter Netlify. Uji model 3D secara visual pada perangkat fisik, pengukuran perangkat Android kelas bawah, uji cetak produksi, dan audit aksesibilitas menyeluruh masih terbuka.
