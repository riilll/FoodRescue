const ERROR_STATUS_MAP = {
  20001: 400, // Jumlah tidak valid
  20002: 404, // Akun pembeli tidak ditemukan
  20003: 403, // Pemesanan hanya untuk mahasiswa
  20004: 404, // Sesi flash sale tidak ditemukan
  20005: 400, // Sesi flash sale tidak aktif
  20006: 409, // Stok yang tersisa tidak mencukupi
  20011: 404, // Pesanan tidak ditemukan untuk akun ini
  20012: 409, // Pesanan sudah lunas atau kedaluwarsa
  20013: 409, // Batas waktu pembayaran sudah lewat
  20014: 400, // Saldo tidak mencukupi
};

function handleOracleError(
  res,
  err,
  defaultMessage = "Terjadi kesalahan pada server.",
) {
  console.error("[Oracle Error]", err);

  // Error bisnis dari Stored Procedure (ORA-20001 s/d ORA-20014)
  if (err.errorNum && ERROR_STATUS_MAP[err.errorNum]) {
    const firstLine = err.message.split("\n")[0];
    const cleanMessage = firstLine.replace(/^ORA-\d+:\s*/, "").trim();
    return res.status(ERROR_STATUS_MAP[err.errorNum]).json({
      success: false,
      code: `ORA-${err.errorNum}`,
      message: cleanMessage,
    });
  }

  // Unique constraint violated (misal email sudah terdaftar)
  if (err.errorNum === 1) {
    return res.status(409).json({
      success: false,
      message:
        "Data sudah terdaftar (duplikat). Periksa kembali email atau input Anda.",
    });
  }

  // Check constraint violated (misal format jam_tutup salah atau nilai <= 0)
  if (err.errorNum === 2290) {
    return res.status(400).json({
      success: false,
      message: "Format atau nilai data tidak memenuhi aturan database.",
    });
  }

  // Foreign key child record found (gagal hapus data yang masih dipakai)
  if (err.errorNum === 2292) {
    return res.status(409).json({
      success: false,
      message:
        "Data tidak dapat dihapus karena masih terhubung dengan transaksi atau sesi lain.",
    });
  }

  return res.status(500).json({
    success: false,
    message: defaultMessage,
  });
}

module.exports = { handleOracleError };
