# FoodRescue

**Struktur Folder Secara Umum**
```
foodrescue/                  <-- folder repo GitHub kalian
├── frontend/                <-- bagian Bg Habib
├── backend/                 <-- bagian Naja
├── database/                <-- bagian Fahril (ERD & skrip SQL)
└── README.md                <-- dikerjakan bareng
```

**Struktur Folder yang backend**
```
backend/
├── config/
│   └── db.js               # Konfigurasi connection pool Oracle (oracledb Thin Mode)
├── middleware/
│   ├── authMiddleware.js   # Verifikasi JWT & cek role (mahasiswa / mitra)
│   └── errorHandler.js     # Penanganan error transaksi, stok habis, & Oracle error
├── routes/
│   ├── authRoutes.js
│   ├── productRoutes.js
│   ├── orderRoutes.js
│   └── paymentRoutes.js
├── controllers/
│   ├── authController.js
│   ├── productController.js
│   ├── orderController.js
│   └── paymentController.js
├── .env                    # JANGAN DI-COMMIT (masuk .gitignore)
├── .env.example            # Template variabel tanpa nilai asli (WAJIB ada di repo)
├── .gitignore
├── package.json
└── server.js
```

## Database — Fahril

FoodRescue menggunakan Oracle Database XE. Setiap sesi flash sale menyimpan harga, waktu penjualan, dan stok yang bisa dipesan. Saat dua mahasiswa memesan produk yang sama, prosedur reservasi mengunci baris sesi dengan `SELECT ... FOR UPDATE`, lalu memeriksa waktu dan stok setelah mendapat kunci.

[ERD FoodRescue (draw.io)](docs/ERD.png)

### Menyiapkan database di DBeaver

Gunakan schema proyek yang kosong untuk instalasi pertama. Buka skrip di folder `database/` sesuai urutan berikut. Untuk prosedur, trigger, dan blok anonim PL/SQL, pilih seluruh blok sampai `END;` atau `END nama_prosedur;`, lalu tekan **Ctrl + Enter**. Jalankan query pemeriksaan setelah blok selesai.

| Skrip | Fungsi |
|---|---|
| `01_schema.sql` | Membuat tujuh tabel beserta primary key, foreign key, dan constraint. Akun mahasiswa dan mitra tersimpan di `Pengguna`. Detail restoran tersimpan di `Mitra_Restoran`. |
| `02_seed_demo.sql` | Menyiapkan Kafe Roti Kampus, dua mahasiswa, dan sesi Roti Cokelat dengan stok 2 porsi. Sesi aktif selama dua jam sejak skrip dijalankan. |
| `03_view_katalog.sql` | Membuat `v_katalog_flashsale_aktif` untuk menampilkan penawaran dalam periode penjualan yang masih memiliki stok. |
| `04_sp_buat_pesanan.sql` | Mereservasi stok, menyimpan harga saat pemesanan, dan menetapkan batas bayar 10 menit. |
| `05_sp_bayar_pesanan.sql` | Memeriksa pemilik pesanan, tenggat, status, dan saldo. Pembayaran berhasil memotong saldo, mencatat pembayaran, dan mengubah status menjadi `LUNAS` dalam satu transaksi. |
| `06_trigger_log_kedaluwarsa.sql` | Mencatat satu log ketika status pesanan berubah dari `MENUNGGU_BAYAR` menjadi `KEDALUWARSA`. |
| `07_sp_proses_kedaluwarsa.sql` | Memproses reservasi lewat tenggat dan mengembalikan jumlah porsi ke sesi asal. |
| `08_scheduler_kedaluwarsa.sql` | Membuat job yang memanggil prosedur kedaluwarsa setiap menit. Schema proyek memerlukan privilege `CREATE JOB` dari admin. |
| `09_seed_1000_pesanan.sql` | Menyiapkan data uji index pada sesi tersendiri, dengan 980 pesanan lunas untuk akun A dan 20 untuk akun B. |
| `10_index_riwayat_pesanan.sql` | Membandingkan `EXPLAIN PLAN` untuk pencarian 10 pesanan terbaru sebelum dan sesudah membuat `idx_pesanan_riwayat`. |

Jalankan masing-masing seed sekali per schema. Akun seed memakai penanda `DEMO_TANPA_LOGIN`. Untuk menguji login JWT, buat akun melalui endpoint registrasi. Sebelum menjalankan skrip 10, lihat ID untuk `riwayat.b@example.com` pada hasil skrip 09. Gunakan ID itu di kedua query pembanding. Nilai `22` pada skrip berasal dari database pengujian.

### Integrasi dengan backend

| Aksi | Objek Oracle dan parameter |
|---|---|
| Tampilkan katalog | Baca `v_katalog_flashsale_aktif`. Gunakan `id_sesi` dari penawaran yang dipilih. |
| Pesan makanan | Panggil `sp_buat_pesanan(p_id_pembeli IN, p_id_sesi IN, p_jumlah IN, p_id_pesanan OUT)`. ID keluaran dipakai untuk pembayaran. |
| Bayar pesanan | Panggil `sp_bayar_pesanan(p_id_pembeli IN, p_id_pesanan IN)`. Oracle menghitung tagihan dari jumlah porsi dan harga saat reservasi. |

Ambil ID pembeli dari JWT yang sudah diverifikasi. Kirim parameter melalui bind variable. Untuk reservasi dan pembayaran, gunakan satu koneksi dengan `autoCommit: false`, lakukan `commit()` setelah berhasil atau `rollback()` saat terjadi error, lalu kembalikan koneksi ke pool.
