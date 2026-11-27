const { getConnection } = require("../config/db");
const { handleOracleError } = require("../utils/oracleError");

// POST /api/payments/:orderId
// Memanggil Stored Procedure sp_bayar_pesanan dengan transaksi manual (autoCommit: false)
async function payOrder(req, res) {
  const idPesanan = Number(req.params.orderId);

  if (!Number.isInteger(idPesanan) || idPesanan <= 0) {
    return res.status(400).json({
      success: false,
      message: "ID pesanan tidak valid.",
    });
  }

  let connection;
  try {
    connection = await getConnection();

    // 1. Panggil stored procedure pembayaran (kunci baris pesanan & saldo, cek tenggat & saldo)
    await connection.execute(
      `BEGIN
         sp_bayar_pesanan(:p_id_pembeli, :p_id_pesanan);
       END;`,
      {
        p_id_pembeli: req.user.id_pengguna,
        p_id_pesanan: idPesanan,
      },
      { autoCommit: false },
    );

    await connection.commit();

    // 2. Ambil bukti pembayaran dan sisa saldo terbaru
    const receiptResult = await connection.execute(
      `SELECT
         pb.id_pembayaran,
         pb.id_pesanan,
         pb.nominal,
         pb.dibayar_pada,
         t.status,
         u.saldo AS sisa_saldo
       FROM Pembayaran pb
       JOIN Transaksi_Pesanan t ON t.id_pesanan = pb.id_pesanan
       JOIN Pengguna u ON u.id_pengguna = t.id_pembeli
       WHERE pb.id_pesanan = :id_pesanan
         AND t.id_pembeli = :id_pembeli`,
      {
        id_pesanan: idPesanan,
        id_pembeli: req.user.id_pengguna,
      },
    );

    const row = receiptResult.rows[0];
    return res.status(200).json({
      success: true,
      message: "Pembayaran berhasil. Pesanan Anda berstatus LUNAS.",
      data: {
        id_pembayaran: row.ID_PEMBAYARAN,
        id_pesanan: row.ID_PESANAN,
        nominal: row.NOMINAL,
        dibayar_pada: row.DIBAYAR_PADA,
        status: row.STATUS,
        sisa_saldo: row.SISA_SALDO,
      },
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    return handleOracleError(res, err, "Gagal memproses pembayaran.");
  } finally {
    if (connection) await connection.close();
  }
}

// GET /api/payments/:orderId
// Mengecek status transaksi dan detail pembayaran dari satu pesanan
async function getPaymentStatus(req, res) {
  const idPesanan = Number(req.params.orderId);

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
         t.status,
         t.jumlah,
         t.harga_satuan_pesan,
         (t.jumlah * t.harga_satuan_pesan) AS total_tagihan,
         t.dibuat_pada,
         t.batas_bayar,
         pb.id_pembayaran,
         pb.nominal AS nominal_bayar,
         pb.dibayar_pada,
         lk.dicatat_pada AS kedaluwarsa_pada
       FROM Transaksi_Pesanan t
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
        message: "Transaksi pesanan tidak ditemukan untuk akun Anda.",
      });
    }

    const row = result.rows[0];
    return res.status(200).json({
      success: true,
      data: {
        id_pesanan: row.ID_PESANAN,
        status: row.STATUS,
        total_tagihan: row.TOTAL_TAGIHAN,
        dibuat_pada: row.DIBUAT_PADA,
        batas_bayar: row.BATAS_BAYAR,
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
    return handleOracleError(res, err, "Gagal mengecek status pembayaran.");
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { payOrder, getPaymentStatus };
