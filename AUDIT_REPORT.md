# Audit Bun & Fleur Kids

Audit 24 November 2026 WIB. Basis pengembangan adalah `main` pada `2b847826395fd0fde83e08fb827276eca9f92efa`, repositori `fadhildjajadikarta27-design/bun-fleur-kids`. Semua perubahan ada di `development-audit`. Bukti berasal dari checkout kode, build lokal, dan PostgreSQL lokal berisi fixture sintetis. Konfigurasi proyek Netlify di dashboard, data produksi, mutasi merchant, dan metrik operasi Netlify berada di luar pengukuran.

## Temuan dan perbaikan

| Tingkat | Temuan pada basis | Perubahan |
| --- | --- | --- |
| Critical | Audit ini tidak mengonfirmasi kebocoran aktif atau akses lintas akun di production. PostgreSQL production dan environment variables yang tersimpan pada penyedia layanan tidak diakses. | Pemeriksaan akses dan RLS dijalankan dengan fixture lokal. |
| High | Adapter lokal melewati pemeriksaan admin dan pengenal pengunjung yang digunakan Netlify. Adapter Vercel dan Netlify menangani origin, cookie, JSON, dan pembatasan ukuran secara berbeda. | Satu transport untuk ketiga jalur. Dispatch juga memeriksa akses admin, membatasi request JSON hingga 2 MiB, menolak origin lain, membatasi action dikenal, dan mencegah cache publik pada respons API. |
| High | Login admin tidak memiliki pembatas persisten. Hitungan percobaan PIN affiliate terpisah dari transaksi sehingga percobaan paralel dapat saling menimpa. | Pembatas percobaan di PostgreSQL dan row lock selama verifikasi PIN. Admin menggunakan cookie berumur delapan jam. Sign-up, login, reset PIN, tracking, checkout, dan konfirmasi juga diberi batas per sumber. |
| High | Bearer token sesi affiliate tersimpan langsung di database dan browser. Token undangan dan reset juga tersimpan langsung. | Cookie Secure, HttpOnly, SameSite untuk sesi, SHA-256 untuk pencarian token acak, AES-GCM untuk salinan sementara tautan yang harus dibagikan admin. Migrasi memensiunkan token lama. PIN tetap berupa hash PBKDF2 dengan salt. |
| High | Penyimpanan pesanan, pemilihan total unik, perubahan ongkir dan komisi, serta saldo payout dapat terpisah ketika permintaan paralel atau gagal sebagian. | Checkout memakai kunci idempotensi, alokasi QRIS dan ledger pesanan berjalan dalam transaksi, dan payout mengunci baris affiliate serta mencatat pelunasan parsial komisi. Indeks mendukung pencarian nominal aktif dan operasi dashboard. |
| High | Status lunas dapat diubah dari formulir pesanan umum. Belum ada batas unik untuk referensi transaksi QRIS. | Pembayaran dicatat lewat tindakan verifikasi admin terpisah yang memerlukan referensi mutasi unik. Konfirmasi dan bukti pelanggan memindahkan pesanan ke antrean verifikasi. |
| High | Dependensi `zod@4.4.3` terdaftar pada GHSA-mrhx-c7xc-m3w5. | Upgrade ke `4.6.6` dan jalankan ulang audit dependensi. [GitHub Advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) |
| High | Autosave dapat menimpa perubahan yang lebih baru atau membuat draf kedua ketika pembuatan draf masih berjalan. Tombol checkout pernah melanjutkan sesudah penyimpanan gagal. | Antrekan tulis per draf, jaga perubahan lokal ketika respons lama tiba, dan minta penyimpanan berhasil sebelum masuk alur pesanan. |
| Medium | Kuantitas, Puzzle, Alas Makan, dan unggahan bukti pelanggan belum tersedia di checkout. Papercraft, Celengan, Aksesori Premium, Poster, Figurine, dan Kaos sudah ada. | Tambahkan kuantitas 1–20, Puzzle Rp59.000 dan Alas Makan Rp69.000. Aksesori Rp29.000 pada basis merupakan Celengan Custom. Pertahankan semua SKU lama, harga dasar, QRIS, dan komisi existing. |
| Medium | Hasil checkout dapat kembali ke nama draf ketika orang tua sengaja mengosongkan nama. Halaman pelacakan mengirim alamat, email, dan catatan pesanan walau UI tidak menggunakannya. | Nama kosong disimpan sesuai pilihan. Tracking mengembalikan status, karya, dan data pembayaran yang digunakan UI. Detail kontak lengkap tetap untuk checkout dan pengelolaan admin. |
| Medium | Studio dapat mencatat pointer yang belum ditekan, toleransi terlalu seragam, dan teks bantuan dapat menggeser posisi gulir. Atribut viewport membatasi zoom di seluruh situs. | Tangani pointer aktif dan hilangnya capture, bedakan lima kelompok usia, batasi panjang jejak sementara, dan sediakan ruang untuk status sebelum mulai menggosok. Isolasi gesture pada kanvas dan izinkan zoom halaman di luar kanvas. |
| Medium | ID klip SVG berulang pada beberapa pratinjau satu templat, dan estimasi teks nama terlalu optimistis pada bidang sempit. | ID per instance, ukuran nama dan pesan disesuaikan dengan lebar bidang. Ekspor admin memakai snapshot asli pesanan. |
| Medium | Daftar admin hanya memuat pesanan terbaru tanpa ringkasan semua penjualan, dan harga hanya dapat diubah di kode. | Paginasi pesanan, ringkasan hasil SQL seluruh pesanan, serta pengaturan harga katalog dengan audit log dan perlindungan perubahan harga selama checkout. |
| Medium | Pemindaian untuk koin QRIS sebelumnya mengambil semua pesanan terbuka, dan dasbor affiliate mengambil payload artwork pesanan yang tidak dipakai. | Batasi pencarian pada rentang nominal relevan. Ambil hanya ID, kode, dan tipe dari 50 pesanan yang ditampilkan di affiliate. |
| Medium | Homepage memuat semua fitur checkout, affiliate, PDF, dan gambar logo base64 dalam JS awal. | Pisahkan chunk fitur, tunda pratinjau di bawah fold, pisahkan logo sebagai WebP cacheable, dan hapus dependensi `recharts` yang tidak digunakan. |
| Low | Bun yang ditentukan repo tidak dapat membaca versi format lockfile. Teks putih pada tombol oranye dan beberapa warna teks memperlemah kontras. | Pin Bun 1.4.5, perbaiki warna teks/control focus, sediakan jalur lompat ke konten dan hormati preferensi reduced motion. |
| Low | Draf dengan templat lama otomatis dihapus dari browser setelah daftar diperoleh. | Hentikan penghapusan otomatis. Draf tetap tersimpan dan daftar menyaring templat yang tidak tersedia. |

## Arsitektur dan privasi

- React/Vite menyediakan SPA. Navigasi hash publik dan admin menuju UI yang sesuai. API `POST /api/actions` melayani jalur Netlify/Vercel melalui transport yang sama dengan server lokal.
- PostgreSQL menyimpan proyek (pengenal pengunjung anonim), pesanan (snapshot karya immutable ketika dicatat), akun affiliate, undangan, sesi, komisi, dan payout. Bukti transfer ada pada relasi satu-ke-satu dengan pesanan dan hanya dapat diminta oleh admin. Katalog harga menyimpan override untuk transaksi mendatang.
- Kebijakan yang ada mengaktifkan RLS tanpa policy publik dan mencabut akses Data API anonim pada tabel bisnis. Migrasi baru menerapkan pola ini pada tabel tambahan. Akses aplikasi diputuskan server untuk pengunjung, affiliate, dan admin. Template QC dan informasi katalog adalah data publik yang disengaja.
- Pemeriksaan konfigurasi meliputi pola kunci privat/token pada file yang terlacak, `git diff --check`, referensi env, dan advisori dependensi. Operator tetap perlu memeriksa penyimpanan rahasia dan akses database aktual sebelum rilis.
- Nama pada karya opsional. Foto bukti dibatasi pada PNG/JPG dengan batas ukuran dan dimensi. Ekspor artwork tersedia bagi admin. Kode pesanan baru dibuat dengan sumber acak kriptografis, dan pelacakan memerlukan kode serta nomor pemesan.

## Pengukuran performa

| Aset saat membuka homepage | `main` | `development-audit` |
| --- | ---: | ---: |
| JS awal, gzip | 394,13 kB | 216,16 kB |
| JS awal, minified | 1.073,88 kB | 739,10 kB |
| Logo | 112,18 kB PNG tertanam dalam JS | 21,20 kB WebP yang dapat di-cache |
| Fitur berat | Satu bundle | Chunk Shop, Affiliate, Affiliate Registration, dan PDF dimuat sesuai kebutuhan |

JS awal gzip turun sekitar 45%. Ukuran akhir diperoleh dari output Vite, bukan dari simulasi pembayaran atau pengukuran kredit. Aset logo terpisah masih ikut transfer pada kunjungan pertama. Build masih memberi peringatan satu chunk di atas 500 kB karena katalog vektor, mesin studio dan UI utama tetap di jalur awal. Tidak ada pemantauan kredit, bandwidth, atau compute Netlify production dalam audit ini.

## Masih perlu dituntaskan sebelum rilis

- Uji perangkat Android kelas bawah dan iPhone/Safari fisik, QA aksesibilitas manual dengan pembaca layar, dan uji warna/cocok ukuran pada sampel produk fisik.
- Foto yang disetujui dan render bentuk fisik untuk Puzzle, Alas Makan, serta Aksesori Premium. UI sekarang menampilkan desain yang akan digunakan pada produksi, dengan contoh dilabeli sesuai konteks.
- Dashboard sudah mencakup operasional pesanan, harga, QC templat, dan affiliate. CRUD templat/kelompok usia, konfigurasi izin admin per individu, dan keranjang multi-SKU membutuhkan pengembangan lanjutan. Checkout mendukung satu SKU dengan kuantitas per pesanan.
- Cocokkan payout dan referensi transaksi historis yang sudah terlanjur diverifikasi sebelum migrasi. Refund setelah komisi terbayar perlu rekonsiliasi manual. QRIS statis tetap mengandalkan mutasi merchant yang diperiksa manusia.
- Tetapkan jangka retensi untuk bukti transfer dan karya, serta ukur kinerja cold start dan pemakaian Netlify setelah rilis disetujui. Ringkasan admin menghitung seluruh tabel pada permintaan, dan affiliate masih mengagregasi riwayat komisinya.
