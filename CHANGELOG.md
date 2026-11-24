# Changelog development-audit

## 24 November 2026 WIB

- Menyatukan transport API lokal, Netlify, dan Vercel. Menambahkan batas ukuran JSON, pemeriksaan origin, pembatas request persisten, dan pemeriksaan admin pada dispatch.
- Menyimpan kredensial sesi affiliate dalam cookie HttpOnly. Mencerna token sesi dan mengenkripsi tautan yang perlu dibagikan admin. Menjaga komisi 30% sebagai bawaan akun baru dan konfigurasi akun yang sudah ada.
- Menghitung harga, diskon, kuantitas, dan nominal QRIS di server. Menambahkan idempotensi checkout, bukti transfer privat, referensi QRIS unik, dan rekonsiliasi payout parsial.
- Menambahkan Puzzle dan Alas Makan. Mempertahankan SKU, harga dasar, dan QRIS resmi yang sudah ada. Membuka pengaturan harga untuk admin pada pesanan berikutnya.
- Menambahkan ringkasan penjualan/faktur berhalaman dan memperkecil payload afiliasi.
- Menjaga penyimpanan draf saat navigasi dan saat perubahan baru masuk selama save. Memperbaiki kanvas sentuh, lima profil usia, ID klip SVG, dan teks personalisasi.
- Memperbaiki kontras dan navigasi keyboard. Mengonversi logo yang sudah ada ke WebP, memisahkan fitur besar, menghapus dependensi yang tidak dipakai, memperbarui Zod, dan mematok Bun yang sesuai format lockfile.
- Menonaktifkan deployment otomatis untuk branch audit di konfigurasi Netlify dan Vercel.
- Menambahkan migrasi `0011_request_limits_and_checkout.sql`, `0012_private_affiliate_tokens.sql` dan `0013_catalog_prices.sql`, serta suite regresi PostgreSQL sintetis.

Perubahan operasional token berlaku saat migrasi kelak dijalankan. Mitra dengan sesi lama perlu login ulang. Tautan undangan dan reset PIN lama perlu dibuat ulang.
