const { getConnection } = require("../config/db");
const { handleOracleError } = require("../utils/oracleError");

// GET /api/flash-sales
// Membaca langsung dari View v_katalog_flashsale_aktif buatan Fahril
async function getActiveFlashSales(req, res) {
  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT id_sesi, nama_produk, nama_mitra, alamat, harga_flash, stok_tersedia, selesai_pada
       FROM v_katalog_flashsale_aktif
       ORDER BY selesai_pada ASC, id_sesi ASC`,
    );

    const data = result.rows.map((row) => ({
      id_sesi: row.ID_SESI,
      nama_produk: row.NAMA_PRODUK,
      nama_mitra: row.NAMA_MITRA,
      alamat: row.ALAMAT,
      harga_flash: row.HARGA_FLASH,
      stok_tersedia: row.STOK_TERSEDIA,
      selesai_pada: row.SELESAI_PADA,
    }));

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    return handleOracleError(res, err, "Gagal mengambil katalog flash sale.");
  } finally {
    if (connection) await connection.close();
  }
}

// GET /api/flash-sales/:id
// Detail lengkap 1 sesi flash sale untuk halaman detail produk
async function getFlashSaleById(req, res) {
  const idSesi = Number(req.params.id);

  if (!Number.isInteger(idSesi) || idSesi <= 0) {
    return res.status(400).json({
      success: false,
      message: "ID sesi tidak valid.",
    });
  }

  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         s.id_sesi,
         s.id_produk,
         p.nama_produk,
         p.deskripsi,
         m.id_mitra,
         m.nama_mitra,
         m.alamat,
         m.jam_tutup,
         s.mulai_pada,
         s.selesai_pada,
         s.harga_flash,
         s.stok_awal,
         s.stok_tersedia
       FROM Sesi_FlashSale s
       JOIN Produk_Makanan p ON p.id_produk = s.id_produk
       JOIN Mitra_Restoran m ON m.id_mitra = p.id_mitra
       WHERE s.id_sesi = :id_sesi`,
      { id_sesi: idSesi },
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Sesi flash sale tidak ditemukan.",
      });
    }

    const row = result.rows[0];
    return res.status(200).json({
      success: true,
      data: {
        id_sesi: row.ID_SESI,
        id_produk: row.ID_PRODUK,
        nama_produk: row.NAMA_PRODUK,
        deskripsi: row.DESKRIPSI,
        id_mitra: row.ID_MITRA,
        nama_mitra: row.NAMA_MITRA,
        alamat: row.ALAMAT,
        jam_tutup: row.JAM_TUTUP,
        mulai_pada: row.MULAI_PADA,
        selesai_pada: row.SELESAI_PADA,
        harga_flash: row.HARGA_FLASH,
        stok_awal: row.STOK_AWAL,
        stok_tersedia: row.STOK_TERSEDIA,
      },
    });
  } catch (err) {
    return handleOracleError(
      res,
      err,
      "Gagal mengambil detail sesi flash sale.",
    );
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { getActiveFlashSales, getFlashSaleById };
