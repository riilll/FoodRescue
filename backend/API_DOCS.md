# Dokumentasi REST API — FoodRescue Backend

**Base URL (Lokal):** `http://localhost:5000`  
**Format Request & Response:** `application/json`

## Catatan Integrasi Frontend

1. **Autentikasi (JWT):**
   - Endpoint bertanda **Auth: Bearer** wajib mengirim header:
     ```http
     Authorization: Bearer <token_dari_login>
     ```
   - Masa berlaku token adalah **24 jam** (`1d`). Simpan `token` dan `user.role` di `localStorage` setelah login.
   - Arahkan halaman berdasarkan `user.role`: `'mahasiswa'` ke katalog flash sale, `'mitra'` ke dashboard mitra.
2. **Skema Harga:**
   - Sesuai skema Oracle (`Sesi_FlashSale`), harga yang tersedia hanya **`harga_flash`** (tidak ada kolom `harga_normal`). Tampilkan `harga_flash` sebagai harga flash sale, `stok_tersedia` sebagai sisa stok, dan `selesai_pada` untuk countdown.
3. **Akun Demo Seed:**
   - Akun bawaan `02_seed_demo.sql` memakai penanda `DEMO_TANPA_LOGIN` dan tidak bisa dipakai login JWT. Untuk mencoba alur login, buat akun baru lewat `POST /api/auth/register`.

---

## 1. Health Check

### `GET /api/health`

- **Akses:** Publik
- **Fungsi:** Mengecek server Express dan koneksi ke Oracle Database XE.
- **Response `200 OK`:**
  ```json
  {
    "status": "OK",
    "message": "Backend FoodRescue terhubung ke Oracle Database XE",
    "dbCheck": { "STATUS": 1 }
  }
  ```

---

## 2. Autentikasi & Profil Pengguna

### `POST /api/auth/register`

- **Akses:** Publik
- **Fungsi:** Mendaftarkan akun baru (`mahasiswa` atau `mitra`). Saldo awal otomatis `0`.
- **Request Body (Mahasiswa):**
  ```json
  {
    "nama": "Naja Mahasiswa",
    "email": "naja.mhs@test.com",
    "password": "password123",
    "no_hp": "081234567890",
    "role": "mahasiswa"
  }
  ```
- **Request Body (Mitra Restoran):** _(wajib tambahan `nama_mitra`, `alamat`, dan `jam_tutup` format `HH:MM` 24 jam)_
  ```json
  {
    "nama": "Pemilik Warung",
    "email": "warung.mitra@test.com",
    "password": "password123",
    "no_hp": "081299998888",
    "role": "mitra",
    "nama_mitra": "Warung Senja Kopi",
    "alamat": "Jl. Teuku Nyak Arief",
    "jam_tutup": "21:30"
  }
  ```
- **Response `201 Created`:** Mengembalikan data akun baru (beserta objek `mitra` jika role `'mitra'`).

### `POST /api/auth/login`

- **Akses:** Publik (1 jalur login untuk mahasiswa & mitra)
- **Request Body:**
  ```json
  {
    "email": "naja.mhs@test.com",
    "password": "password123"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Login berhasil.",
    "token": "<jwt_token>",
    "user": {
      "id_pengguna": 10,
      "nama": "Naja Mahasiswa",
      "email": "naja.mhs@test.com",
      "no_hp": "081234567890",
      "role": "mahasiswa",
      "saldo": 50000,
      "mitra": null
    }
  }
  ```

### `GET /api/auth/me`

- **Akses:** Bearer (`mahasiswa` / `mitra`)
- **Fungsi:** Mengambil profil dan saldo terbaru pengguna yang sedang login.
- **Response `200 OK`:** `{ "success": true, "data": { ...profil user & saldo... } }`

### `POST /api/auth/topup`

- **Akses:** Bearer (`mahasiswa`)
- **Fungsi:** Menambah saldo akun mahasiswa untuk pembayaran pesanan.
- **Request Body:**
  ```json
  { "nominal": 50000 }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Top-up saldo berhasil.",
    "data": { "saldo_baru": 50000 }
  }
  ```

---

## 3. Katalog Flash Sale (Publik / Mahasiswa)

### `GET /api/flash-sales`

- **Akses:** Publik
- **Fungsi:** Menampilkan daftar flash sale yang sedang aktif dan stok > 0 (membaca langsung dari Oracle View `v_katalog_flashsale_aktif`).
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "id_sesi": 3,
        "nama_produk": "Croissant Butter Malam",
        "nama_mitra": "Warung Senja Kopi",
        "alamat": "Jl. Teuku Nyak Arief",
        "harga_flash": 8000,
        "stok_tersedia": 5,
        "selesai_pada": "2026-11-27T15:00:00.000Z"
      }
    ]
  }
  ```

### `GET /api/flash-sales/:id`

- **Akses:** Publik
- **Fungsi:** Menampilkan detail 1 sesi flash sale (termasuk `deskripsi`, `jam_tutup`, `mulai_pada`, `selesai_pada`, `stok_awal`, dan `stok_tersedia`).
- **Response `200 OK`:** `{ "success": true, "data": { ...detail sesi... } }`

---

## 4. Dashboard Mitra Restoran

_Seluruh endpoint di bagian ini membutuhkan header `Authorization: Bearer <token>` dengan role `'mitra'`._

### `GET /api/mitra/products`

- **Fungsi:** Menampilkan seluruh produk beserta daftar sesi flash sale milik restoran yang login.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "id_produk": 2,
        "nama_produk": "Croissant Butter Malam",
        "deskripsi": "Sisa display sore, masih renyah",
        "sesi_flashsale": [
          {
            "id_sesi": 3,
            "mulai_pada": "2026-11-27T12:00:00.000Z",
            "selesai_pada": "2026-11-27T15:00:00.000Z",
            "harga_flash": 8000,
            "stok_awal": 5,
            "stok_tersedia": 4
          }
        ]
      }
    ]
  }
  ```

### `POST /api/mitra/products`

- **Fungsi:** Menambah produk baru. Jika `harga_flash` dan `stok_awal` ikut dikirim, otomatis membuat sesi flash sale pertama dalam 1 transaksi.
- **Request Body:** _(isi `durasi_jam` saja, atau `mulai_pada` & `selesai_pada` format ISO)_
  ```json
  {
    "nama_produk": "Croissant Butter Malam",
    "deskripsi": "Sisa display sore, masih renyah dan layak konsumsi",
    "harga_flash": 8000,
    "stok_awal": 5,
    "durasi_jam": 3
  }
  ```
- **Response `201 Created`:** Mengembalikan `id_produk` dan `sesi_flashsale` (jika dibuat).

### `PUT /api/mitra/products/:id`

- **Fungsi:** Mengubah `nama_produk` dan `deskripsi` produk milik sendiri.
- **Request Body:**
  ```json
  {
    "nama_produk": "Croissant Butter Spesial",
    "deskripsi": "Deskripsi terbaru"
  }
  ```
- **Response `200 OK`**

### `DELETE /api/mitra/products/:id`

- **Fungsi:** Menghapus produk milik sendiri (ditolak `409 Conflict` jika sesi produk sudah memiliki transaksi pesanan).
- **Response `200 OK`**

### `POST /api/mitra/flash-sales`

- **Fungsi:** Membuka sesi flash sale baru untuk produk yang sudah ada.
- **Request Body:**
  ```json
  {
    "id_produk": 2,
    "harga_flash": 7000,
    "stok_awal": 3,
    "durasi_jam": 2
  }
  ```
- **Response `201 Created`**

### `PUT /api/mitra/flash-sales/:id`

- **Fungsi:** Mengubah `harga_flash`, `stok_awal`, `stok_tersedia`, atau `selesai_pada` sesi milik sendiri (semua field opsional, kirim yang ingin diubah saja).
- **Request Body:**
  ```json
  {
    "harga_flash": 6500,
    "stok_tersedia": 3
  }
  ```
- **Response `200 OK`**

### `GET /api/mitra/orders`

- **Fungsi:** Melihat daftar pesanan masuk untuk produk restoran mitra. Mendukung query filter opsional `?status=MENUNGGU_BAYAR`, `?status=LUNAS`, atau `?status=KEDALUWARSA`.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "id_pesanan": 1001,
        "id_sesi": 3,
        "nama_produk": "Croissant Butter Malam",
        "pembeli": {
          "nama": "Naja Mahasiswa",
          "no_hp": "081234567890"
        },
        "jumlah": 1,
        "harga_satuan_pesan": 8000,
        "total_harga": 8000,
        "dibuat_pada": "2026-11-27T12:10:00.000Z",
        "batas_bayar": "2026-11-27T12:20:00.000Z",
        "status": "LUNAS",
        "dibayar_pada": "2026-11-27T12:11:00.000Z"
      }
    ]
  }
  ```

---

## 5. Pemesanan & Pembayaran (Mahasiswa)

_Seluruh endpoint di bagian ini membutuhkan header `Authorization: Bearer <token>` dengan role `'mahasiswa'`._

### `POST /api/orders`

- **Fungsi:** Memesan makanan flash sale lewat Stored Procedure `sp_buat_pesanan` (`SELECT ... FOR UPDATE`, batas bayar 10 menit).
- **Request Body:**
  ```json
  {
    "id_sesi": 3,
    "jumlah": 1
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "message": "Pesanan berhasil dibuat. Selesaikan pembayaran dalam 10 menit.",
    "data": {
      "id_pesanan": 1001,
      "id_sesi": 3,
      "nama_produk": "Croissant Butter Malam",
      "nama_mitra": "Warung Senja Kopi",
      "jumlah": 1,
      "harga_satuan_pesan": 8000,
      "total_harga": 8000,
      "dibuat_pada": "2026-11-27T12:10:00.000Z",
      "batas_bayar": "2026-11-27T12:20:00.000Z",
      "status": "MENUNGGU_BAYAR"
    }
  }
  ```

### `GET /api/orders/me`

- **Fungsi:** Menampilkan riwayat pesanan terbaru milik mahasiswa (opsional `?limit=20`, maks `100`, memanfaatkan index `idx_pesanan_riwayat`).
- **Response `200 OK`:** Array pesanan lengkap dengan objek `pembayaran` (jika `LUNAS`) atau `kedaluwarsa_pada` (jika `KEDALUWARSA`).

### `GET /api/orders/:id`

- **Fungsi:** Menampilkan detail 1 pesanan milik mahasiswa.
- **Response `200 OK`**

### `POST /api/payments/:orderId`

- **Fungsi:** Membayar pesanan lewat Stored Procedure `sp_bayar_pesanan` (potong saldo, simpan `Pembayaran`, ubah status jadi `LUNAS`). Tidak perlu mengirim request body.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Pembayaran berhasil. Pesanan Anda berstatus LUNAS.",
    "data": {
      "id_pembayaran": 1001,
      "id_pesanan": 1001,
      "nominal": 8000,
      "dibayar_pada": "2026-11-27T12:11:00.000Z",
      "status": "LUNAS",
      "sisa_saldo": 42000
    }
  }
  ```

### `GET /api/payments/:orderId`

- **Fungsi:** Mengecek status transaksi (`MENUNGGU_BAYAR`, `LUNAS`, atau `KEDALUWARSA`) dan detail pembayaran dari 1 pesanan.
- **Response `200 OK`**

---

## 6. Format & Kode Error (Untuk Notifikasi Frontend)

Semua response gagal menggunakan format seragam:

```json
{
  "success": false,
  "code": "ORA-20006",
  "message": "Stok yang tersisa tidak mencukupi."
}
```

| HTTP Status | Kode / Kondisi                          | Arti Pesan                                                                                          |
| :---------- | :-------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| `400`       | `ORA-20001` / `ORA-20005` / `ORA-20014` | Input tidak valid, sesi tidak aktif, atau **saldo tidak mencukupi**.                                |
| `401`       | Unauthorized                            | Token kosong, salah, atau kedaluwarsa.                                                              |
| `403`       | `ORA-20003` / Forbidden                 | Role akun tidak diizinkan mengakses endpoint.                                                       |
| `404`       | `ORA-20002` / `ORA-20004` / `ORA-20011` | Data, sesi, atau pesanan tidak ditemukan.                                                           |
| `409`       | `ORA-20006` / `ORA-20012` / `ORA-20013` | **Stok habis/tidak cukup**, pesanan sudah lunas/kedaluwarsa, atau batas bayar 10 menit sudah lewat. |
