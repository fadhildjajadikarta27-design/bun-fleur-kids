# Checklist deployment dan rollback

Status 24 November 2026 WIB. Branch GitHub `development-audit` adalah branch review. Release, merge, dan penerapan migrasi production menunggu instruksi eksplisit.

## Periksa sebelum rilis yang telah disetujui

1. Tinjau diff branch terhadap `main` dan hasil dalam [TEST_REPORT.md](TEST_REPORT.md). Tentukan commit rilis persisnya.
2. Konfirmasi di dashboard Netlify bahwa repo produksi dan production branch menunjuk ke repo serta branch yang disetujui. Periksa pengaturan Branch Deploys, Deploy Previews, dan pemicu luar repo. Repo pada basis audit tidak melacak `.github/workflows`. Semua commit audit memuat `[skip netlify]` dan `[skip ci]` untuk push langsung. Konfigurasi Netlify mengabaikan build branch `development-audit`. Konfigurasi Vercel menonaktifkan deployment Git branch itu karena histori GitHub masih memuat status Vercel. [Panduan Netlify](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/) · [Panduan GitHub](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs) · [Panduan Vercel](https://vercel.com/docs/project-configuration/git-configuration)
3. Lakukan uji fixture pada Postgres disposable, kemudian verifikasi branch staging menggunakan lingkungan yang telah diotorisasi. Build memakai Bun 1.4.5. Pada Netlify, `bun run build` menghasilkan `dist` dan `POST /api/actions` dipetakan ke Node function. `DATABASE_URL`, `ADMIN_SESSION_SECRET`, `ADMIN_PASSWORD_HASH` dan, jika fitur AI sudah diaktifkan, `OPENAI_API_KEY` adalah env server.
4. Backup skema/data yang diizinkan dan catat deployment sehat sebelumnya. Periksa log migrasi `__port_migrations`, terutama `0010_affiliate_unique_phone.sql` serta potensi duplikat nomor warisan. Periksa saldo payout lama dan pembayaran menunggu secara terpisah.
5. Migrasi perlu dijalankan secara eksplisit oleh operator database dalam jendela perubahan. Jalankan SQL yang masih belum tercatat, sesuai urutan numerik. Terapkan dalam transaksi dan catat nama file serta `applied_at` dalam epoch milidetik pada `public.__port_migrations`. Runtime Netlify/Vercel tidak menjalankan migrasi. Periksa RLS dan grant setelah migrasi.
6. Migrasi memensiunkan sesi affiliate dan tautan undangan/reset lama. Jadwalkan login ulang dan penerbitan ulang tautan saat dibutuhkan. QRIS resmi tetap memakai aset merchant existing, dengan referensi transaksi tersendiri untuk setiap verifikasi baru.
7. Deploy hanya commit rilis yang disetujui melalui jalur rilis yang disepakati. Jalankan smoke test produksi dengan akun uji yang telah diterima operator, cek verifikasi QRIS tanpa menciptakan transaksi nyata kecuali diotorisasi secara terpisah, dan periksa biaya serta error function.

## Rollback

1. Jika ada gangguan setelah rilis, hentikan proses perubahan dan pilih deployment sehat terakhir dari histori penyedia. Utamakan perbaikan maju untuk gangguan sesi/checkout bila versi lama membuka kembali celah yang sudah ditutup.
2. Rollback aplikasi tidak perlu menghapus tabel dan kolom baru. Pertahankan snapshot pesanan, referensi pembayaran, dan ledger yang ditulis oleh versi baru. Revisi mundur database hanya dari backup terverifikasi dengan rencana rekonsiliasi transaksi baru.
3. Versi lama tidak mengenali dua SKU baru dan tidak memakai token terenkripsi. Sebelum rollback penuh, batasi sementara workflow yang terdampak dan rekonsiliasi pesanan Puzzle/Alas Makan, harga override, serta payout yang sedang berjalan. Pemulihan token plaintext lama bukan bagian dari rollback.
4. Setelah rollback, verifikasi status pesanan dan ledger serta cocokkan mutasi merchant. Catat perubahan runtime dan database aktual bersama operator.

## Rilis 26 November — fitur baru

- Jalankan CI audit-only pada commit kandidat. Jangan merge atau deploy bila satu langkah gagal.
- Sebelum deployment production, operator wajib membackup dan memeriksa migration journal, kemudian menjalankan migrasi belum diterapkan 0023, 0024, 0025 (juga migrasi sebelumnya bila belum tercatat) dalam satu transaksi dengan advisory lock. Jangan jalankan ulang migration yang tercatat.
- Review daftar order lama yang cocok dengan nomor affiliate, komisi belum cair, payout requested/approved, serta payout paid. Payout lama tidak dihapus; permintaan yang melebihi saldo setelah reversal wajib ditinjau admin sebelum dibayar.
- Uji bahwa laporan checkout Shopee tidak otomatis lunas, username wajib, admin tidak membutuhkan nomor pesanan Shopee, dan QRIS masih memerlukan referensi unik.
- UI bahasa Inggris merupakan terjemahan bertahap; nama/deskripsi karakter dan halaman admin/affiliate yang belum diterjemahkan memakai bahasa Indonesia sebagai fallback.
