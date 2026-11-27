const oracledb = require("oracledb");
const { getConnection } = require("../config/db");
const { handleOracleError } = require("../utils/oracleError");

// POST /api/orders
// Memanggil Stored Procedure sp_buat_pesanan dengan transaksi manual (autoCommit: false)
async function createOrder(req, res) {
  const idSesi = Number(req.body.id_sesi);
  const jumlah = Number(req.body.jumlah);

  if (!Number.isInteger(idSesi) || idSesi <= 0) {
    return res.status(400).json({
      success: false,
      message: "id_sesi harus berupa bilangan bulat positif.",
    });
  }

  if (!Number.isInteger(jumlah) || jumlah <= 0) {
    return res.status(400).json({
      success: false,
      message: "jumlah harus berupa bilangan bulat positif.",
    });
  }

  let connection;
  try {
    connection = await getConnection();

    // 1. Panggil stored procedure reservasi stok (SELECT ... FOR UPDATE di dalam Oracle)
    const spResult = await connection.execute(
      `BEGIN
         sp_buat_pesanan(:p_id_pembeli, :p_id_sesi, :p_jumlah, :p_id_pesanan);
       END;`,
      {
        p_id_pembeli: req.user.id_pengguna,
        p_id_sesi: idSesi,
        p_jumlah: jumlah,
        p_id_pesanan: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: false },
    );

    await connection.commit();

    // Untuk blok PL/SQL, outBinds mengembalikan nilai langsung (bukan array)
    const idPesanan = spResult.outBinds.p_id_pesanan;

    // 2. Ambil detail pesanan yang baru dibuat agar frontend mendapat batas_bayar & total_harga
    const detailResult = await connection.execute(
      `SELECT
         t.id_pesanan,
         t.id_sesi,
         p.nama_produk,
         m.nama_mitra,
         t.jumlah,
         t.harga_satuan_pesan,
         (t.jumlah * t.harga_satuan_pesan) AS total_harga,
         t.dibuat_pada,
         t.batas_bayar,
         t.status
       FROM Transaksi_Pesanan t
       JOIN Sesi_FlashSale s ON s.id_sesi = t.id_sesi
       JOIN Produk_Makanan p ON p.id_produk = s.id_produk
       JOIN Mitra_Restoran m ON m.id_mitra = p.id_mitra
       WHERE t.id_pesanan = :id_pesanan`,
      { id_pesanan: idPesanan },
    );

    const row = detailResult.rows[0];
    return res.status(201).json({
      success: true,
      message: "Pesanan berhasil dibuat. Selesaikan pembayaran dalam 10 menit.",
      data: {
        id_pesanan: row.ID_PESANAN,
        id_sesi: row.ID_SESI,
        nama_produk: row.NAMA_PRODUK,
        nama_mitra: row.NAMA_MITRA,
        jumlah: row.JUMLAH,
        harga_satuan_pesan: row.HARGA_SATUAN_PESAN,
        total_harga: row.TOTAL_HARGA,
        dibuat_pada: row.DIBUAT_PADA,
        batas_bayar: row.BATAS_BAYAR,
        status: row.STATUS,
      },
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    return handleOracleError(res, err, "Gagal membuat pesanan.");
  } finally {
    if (connection) await connection.close();
  }
}

// GET /api/orders/me
// Menampilkan riwayat pesanan mahasiswa terbaru (selaras dengan idx_pesanan_riwayat)
async function getMyOrders(req, res) {
  const parsedLimit = req.query.limit ? Number(req.query.limit) : 20;
  const limitRows =
    Number.isInteger(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100
      ? parsedLimit
      : 20;

  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         t.id_pesanan,
         t.id_sesi,
         p.nama_produk,
         m.nama_mitra,
         t.jumlah,
         t.harga_satuan_pesan,
         (t.jumlah * t.harga_satuan_pesan) AS total_harga,
         t.dibuat_pada,
         t.batas_bayar,
         t.status,
         pb.id_pembayaran,
         pb.nominal AS nominal_bayar,
         pb.dibayar_pada,
         lk.dicatat_pada AS kedaluwarsa_pada
       FROM Transaksi_Pesanan t
       JOIN Sesi_FlashSale s ON s.id_sesi = t.id_sesi
       JOIN Produk_Makanan p ON p.id_produk = s.id_produk
       JOIN Mitra_Restoran m ON m.id_mitra = p.id_mitra
       LEFT JOIN Pembayaran pb ON pb.id_pesanan = t.id_pesanan
       LEFT JOIN Log_Kedaluwarsa lk ON lk.id_pesanan = t.id_pesanan
       WHERE t.id_pembeli = :id_pembeli
       ORDER BY t.dibuat_pada DESC, t.id_pesanan DESC
       FETCH FIRST :limit_rows ROWS ONLY`,
      {
        id_pembeli: req.user.id_pengguna,
        limit_rows: limitRows,
      },
    );

    const data = result.rows.map((row) => ({
      id_pesanan: row.ID_PESANAN,
      id_sesi: row.ID_SESI,
      nama_produk: row.NAMA_PRODUK,
      nama_mitra: row.NAMA_MITRA,
      jumlah: row.JUMLAH,
      harga_satuan_pesan: row.HARGA_SATUAN_PESAN,
      total_harga: row.TOTAL_HARGA,
      dibuat_pada: row.DIBUAT_PADA,
      batas_bayar: row.BATAS_BAYAR,
      status: row.STATUS,
      pembayaran: row.ID_PEMBAYARAN
        ? {
            id_pembayaran: row.ID_PEMBAYARAN,
            nominal: row.NOMINAL_BAYAR,
            dibayar_pada: row.DIBAYAR_PADA,
          }
        : null,
      kedaluwarsa_pada: row.KEDALUWARSA_PADA || null,
    }));

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    return handleOracleError(res, err, "Gagal mengambil riwayat pesanan.");
  } finally {
    if (connection) await connection.close();
  }
}

// GET /api/orders/:id
// Detail 1 pesanan milik mahasiswa yang sedang login
async function getOrderById(req, res) {
  const idPesanan = Number(req.params.id);

  if (!Number.isInteger(idPesanan) || idPesanan <= 0) {
    return res.status(400).json({
      success: false,
      message: "ID pesanan tidak valid.",
    });
  }

  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         t.id_pesanan,
         t.id_sesi,
         p.nama_produk,
         m.nama_mitra,
         m.alamat,
         t.jumlah,
         t.harga_satuan_pesan,
         (t.jumlah * t.harga_satuan_pesan) AS total_harga,
         t.dibuat_pada,
         t.batas_bayar,
         t.status,
         pb.id_pembayaran,
         pb.nominal AS nominal_bayar,
         pb.dibayar_pada,
         lk.dicatat_pada AS kedaluwarsa_pada
       FROM Transaksi_Pesanan t
       JOIN Sesi_FlashSale s ON s.id_sesi = t.id_sesi
       JOIN Produk_Makanan p ON p.id_produk = s.id_produk
       JOIN Mitra_Restoran m ON m.id_mitra = p.id_mitra
       LEFT JOIN Pembayaran pb ON pb.id_pesanan = t.id_pesanan
       LEFT JOIN Log_Kedaluwarsa lk ON lk.id_pesanan = t.id_pesanan
       WHERE t.id_pesanan = :id_pesanan
         AND t.id_pembeli = :id_pembeli`,
      {
        id_pesanan: idPesanan,
        id_pembeli: req.user.id_pengguna,
      },
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pesanan tidak ditemukan untuk akun Anda.",
      });
    }

    const row = result.rows[0];
    return res.status(200).json({
      success: true,
      data: {
        id_pesanan: row.ID_PESANAN,
        id_sesi: row.ID_SESI,
        nama_produk: row.NAMA_PRODUK,
        nama_mitra: row.NAMA_MITRA,
        alamat: row.ALAMAT,
        jumlah: row.JUMLAH,
        harga_satuan_pesan: row.HARGA_SATUAN_PESAN,
        total_harga: row.TOTAL_HARGA,
        dibuat_pada: row.DIBUAT_PADA,
        batas_bayar: row.BATAS_BAYAR,
        status: row.STATUS,
        pembayaran: row.ID_PEMBAYARAN
          ? {
              id_pembayaran: row.ID_PEMBAYARAN,
              nominal: row.NOMINAL_BAYAR,
              dibayar_pada: row.DIBAYAR_PADA,
            }
          : null,
        kedaluwarsa_pada: row.KEDALUWARSA_PADA || null,
      },
    });
  } catch (err) {
    return handleOracleError(res, err, "Gagal mengambil detail pesanan.");
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { createOrder, getMyOrders, getOrderById };
