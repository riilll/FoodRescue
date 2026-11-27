const oracledb = require("oracledb");
const { getConnection } = require("../config/db");
const { handleOracleError } = require("../utils/oracleError");

// Helper untuk menghitung waktu mulai dan selesai sesi flash sale
function parseSessionDates(mulai_pada, selesai_pada, durasi_jam) {
  const mulaiDate = mulai_pada ? new Date(mulai_pada) : new Date();
  if (isNaN(mulaiDate.getTime())) {
    return {
      error: "Format mulai_pada tidak valid. Gunakan format ISO datetime.",
    };
  }

  let selesaiDate;
  if (selesai_pada) {
    selesaiDate = new Date(selesai_pada);
    if (isNaN(selesaiDate.getTime())) {
      return {
        error: "Format selesai_pada tidak valid. Gunakan format ISO datetime.",
      };
    }
  } else {
    const durasi = durasi_jam !== undefined ? Number(durasi_jam) : 2;
    if (isNaN(durasi) || durasi <= 0) {
      return { error: "durasi_jam harus berupa angka lebih dari 0." };
    }
    selesaiDate = new Date(mulaiDate.getTime() + durasi * 60 * 60 * 1000);
  }

  if (selesaiDate <= mulaiDate) {
    return { error: "Waktu selesai_pada harus lebih besar dari mulai_pada." };
  }

  return { mulaiDate, selesaiDate };
}

// GET /api/mitra/products
// Mengambil seluruh produk beserta daftar sesi flash sale milik mitra yang login
async function getMitraProducts(req, res) {
  if (!req.user.id_mitra) {
    return res.status(403).json({
      success: false,
      message: "Profil mitra restoran tidak ditemukan untuk akun ini.",
    });
  }

  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         p.id_produk,
         p.nama_produk,
         p.deskripsi,
         s.id_sesi,
         s.mulai_pada,
         s.selesai_pada,
         s.harga_flash,
         s.stok_awal,
         s.stok_tersedia
       FROM Produk_Makanan p
       LEFT JOIN Sesi_FlashSale s ON s.id_produk = p.id_produk
       WHERE p.id_mitra = :id_mitra
       ORDER BY p.id_produk DESC, s.id_sesi DESC`,
      { id_mitra: req.user.id_mitra },
    );

    // Kelompokkan sesi flash sale ke dalam masing-masing produk
    const productMap = new Map();
    for (const row of result.rows) {
      if (!productMap.has(row.ID_PRODUK)) {
        productMap.set(row.ID_PRODUK, {
          id_produk: row.ID_PRODUK,
          nama_produk: row.NAMA_PRODUK,
          deskripsi: row.DESKRIPSI,
          sesi_flashsale: [],
        });
      }

      if (row.ID_SESI !== null) {
        productMap.get(row.ID_PRODUK).sesi_flashsale.push({
          id_sesi: row.ID_SESI,
          mulai_pada: row.MULAI_PADA,
          selesai_pada: row.SELESAI_PADA,
          harga_flash: row.HARGA_FLASH,
          stok_awal: row.STOK_AWAL,
          stok_tersedia: row.STOK_TERSEDIA,
        });
      }
    }

    const data = Array.from(productMap.values());
    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    return handleOracleError(res, err, "Gagal mengambil daftar produk mitra.");
  } finally {
    if (connection) await connection.close();
  }
}

// POST /api/mitra/products
// Menambah produk makanan baru; jika harga_flash & stok_awal ikut dikirim,
// otomatis membuat sesi flash sale pertama dalam 1 transaksi atomik.
async function createProduct(req, res) {
  if (!req.user.id_mitra) {
    return res.status(403).json({
      success: false,
      message: "Profil mitra restoran tidak ditemukan untuk akun ini.",
    });
  }

  const {
    nama_produk,
    deskripsi,
    harga_flash,
    stok_awal,
    mulai_pada,
    selesai_pada,
    durasi_jam,
  } = req.body;

  if (!nama_produk || !nama_produk.trim()) {
    return res.status(400).json({
      success: false,
      message: "nama_produk wajib diisi.",
    });
  }

  const createWithSession =
    harga_flash !== undefined || stok_awal !== undefined;
  let parsedHarga, parsedStok, sessionDates;

  if (createWithSession) {
    parsedHarga = Number(harga_flash);
    parsedStok = Number(stok_awal);

    if (!Number.isInteger(parsedHarga) || parsedHarga <= 0) {
      return res.status(400).json({
        success: false,
        message: "harga_flash harus berupa bilangan bulat positif.",
      });
    }
    if (!Number.isInteger(parsedStok) || parsedStok <= 0) {
      return res.status(400).json({
        success: false,
        message: "stok_awal harus berupa bilangan bulat positif.",
      });
    }

    sessionDates = parseSessionDates(mulai_pada, selesai_pada, durasi_jam);
    if (sessionDates.error) {
      return res
        .status(400)
        .json({ success: false, message: sessionDates.error });
    }
  }

  let connection;
  try {
    connection = await getConnection();

    // 1. Insert ke Produk_Makanan
    const prodResult = await connection.execute(
      `INSERT INTO Produk_Makanan (id_mitra, nama_produk, deskripsi)
       VALUES (:id_mitra, :nama_produk, :deskripsi)
       RETURNING id_produk INTO :id_produk`,
      {
        id_mitra: req.user.id_mitra,
        nama_produk: nama_produk.trim(),
        deskripsi: deskripsi ? deskripsi.trim() : null,
        id_produk: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: false },
    );

    const idProduk = prodResult.outBinds.id_produk[0];
    let sesiData = null;

    // 2. Opsional: langsung buka Sesi_FlashSale pertama
    if (createWithSession) {
      const sesiResult = await connection.execute(
        `INSERT INTO Sesi_FlashSale (
           id_produk, mulai_pada, selesai_pada, harga_flash, stok_awal, stok_tersedia
         )
         VALUES (
           :id_produk, :mulai_pada, :selesai_pada, :harga_flash, :stok_awal, :stok_tersedia
         )
         RETURNING id_sesi INTO :id_sesi`,
        {
          id_produk: idProduk,
          mulai_pada: sessionDates.mulaiDate,
          selesai_pada: sessionDates.selesaiDate,
          harga_flash: parsedHarga,
          stok_awal: parsedStok,
          stok_tersedia: parsedStok,
          id_sesi: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
        { autoCommit: false },
      );

      sesiData = {
        id_sesi: sesiResult.outBinds.id_sesi[0],
        mulai_pada: sessionDates.mulaiDate,
        selesai_pada: sessionDates.selesaiDate,
        harga_flash: parsedHarga,
        stok_awal: parsedStok,
        stok_tersedia: parsedStok,
      };
    }

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: createWithSession
        ? "Produk dan sesi flash sale berhasil dibuat."
        : "Produk berhasil dibuat.",
      data: {
        id_produk: idProduk,
        id_mitra: req.user.id_mitra,
        nama_produk: nama_produk.trim(),
        deskripsi: deskripsi ? deskripsi.trim() : null,
        sesi_flashsale: sesiData,
      },
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    return handleOracleError(res, err, "Gagal menambahkan produk.");
  } finally {
    if (connection) await connection.close();
  }
}

// PUT /api/mitra/products/:id
// Mengubah nama_produk dan deskripsi produk milik mitra
async function updateProduct(req, res) {
  const idProduk = Number(req.params.id);
  const { nama_produk, deskripsi } = req.body;

  if (!Number.isInteger(idProduk) || idProduk <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "ID produk tidak valid." });
  }
  if (!nama_produk || !nama_produk.trim()) {
    return res
      .status(400)
      .json({ success: false, message: "nama_produk wajib diisi." });
  }

  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `UPDATE Produk_Makanan
       SET nama_produk = :nama_produk,
           deskripsi = :deskripsi
       WHERE id_produk = :id_produk
         AND id_mitra = :id_mitra`,
      {
        nama_produk: nama_produk.trim(),
        deskripsi:
          deskripsi !== undefined
            ? deskripsi
              ? deskripsi.trim()
              : null
            : null,
        id_produk: idProduk,
        id_mitra: req.user.id_mitra,
      },
      { autoCommit: true },
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({
        success: false,
        message: "Produk tidak ditemukan atau bukan milik mitra Anda.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Produk berhasil diperbarui.",
      data: {
        id_produk: idProduk,
        nama_produk: nama_produk.trim(),
        deskripsi: deskripsi ? deskripsi.trim() : null,
      },
    });
  } catch (err) {
    return handleOracleError(res, err, "Gagal memperbarui produk.");
  } finally {
    if (connection) await connection.close();
  }
}

// DELETE /api/mitra/products/:id
// Menghapus produk beserta sesi yang belum pernah punya transaksi pesanan
async function deleteProduct(req, res) {
  const idProduk = Number(req.params.id);

  if (!Number.isInteger(idProduk) || idProduk <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "ID produk tidak valid." });
  }

  let connection;
  try {
    connection = await getConnection();

    // Pastikan produk memang milik mitra yang login
    const check = await connection.execute(
      `SELECT id_produk
       FROM Produk_Makanan
       WHERE id_produk = :id_produk
         AND id_mitra = :id_mitra`,
      { id_produk: idProduk, id_mitra: req.user.id_mitra },
    );

    if (check.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Produk tidak ditemukan atau bukan milik mitra Anda.",
      });
    }

    // Hapus sesi terkait dulu (jika sudah ada Transaksi_Pesanan, Oracle otomatis lempar ORA-02292)
    await connection.execute(
      `DELETE FROM Sesi_FlashSale WHERE id_produk = :id_produk`,
      { id_produk: idProduk },
      { autoCommit: false },
    );

    await connection.execute(
      `DELETE FROM Produk_Makanan
       WHERE id_produk = :id_produk
         AND id_mitra = :id_mitra`,
      { id_produk: idProduk, id_mitra: req.user.id_mitra },
      { autoCommit: false },
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Produk berhasil dihapus.",
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    return handleOracleError(res, err, "Gagal menghapus produk.");
  } finally {
    if (connection) await connection.close();
  }
}

// POST /api/mitra/flash-sales
// Membuka sesi flash sale baru untuk produk yang sudah ada
async function createFlashSaleSession(req, res) {
  const {
    id_produk,
    harga_flash,
    stok_awal,
    mulai_pada,
    selesai_pada,
    durasi_jam,
  } = req.body;

  const parsedProduk = Number(id_produk);
  const parsedHarga = Number(harga_flash);
  const parsedStok = Number(stok_awal);

  if (!Number.isInteger(parsedProduk) || parsedProduk <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "id_produk tidak valid." });
  }
  if (!Number.isInteger(parsedHarga) || parsedHarga <= 0) {
    return res.status(400).json({
      success: false,
      message: "harga_flash harus bilangan bulat positif.",
    });
  }
  if (!Number.isInteger(parsedStok) || parsedStok <= 0) {
    return res.status(400).json({
      success: false,
      message: "stok_awal harus bilangan bulat positif.",
    });
  }

  const sessionDates = parseSessionDates(mulai_pada, selesai_pada, durasi_jam);
  if (sessionDates.error) {
    return res
      .status(400)
      .json({ success: false, message: sessionDates.error });
  }

  let connection;
  try {
    connection = await getConnection();

    const check = await connection.execute(
      `SELECT id_produk
       FROM Produk_Makanan
       WHERE id_produk = :id_produk
         AND id_mitra = :id_mitra`,
      { id_produk: parsedProduk, id_mitra: req.user.id_mitra },
    );

    if (check.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Produk tidak ditemukan atau bukan milik mitra Anda.",
      });
    }

    const result = await connection.execute(
      `INSERT INTO Sesi_FlashSale (
         id_produk, mulai_pada, selesai_pada, harga_flash, stok_awal, stok_tersedia
       )
       VALUES (
         :id_produk, :mulai_pada, :selesai_pada, :harga_flash, :stok_awal, :stok_tersedia
       )
       RETURNING id_sesi INTO :id_sesi`,
      {
        id_produk: parsedProduk,
        mulai_pada: sessionDates.mulaiDate,
        selesai_pada: sessionDates.selesaiDate,
        harga_flash: parsedHarga,
        stok_awal: parsedStok,
        stok_tersedia: parsedStok,
        id_sesi: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true },
    );

    return res.status(201).json({
      success: true,
      message: "Sesi flash sale berhasil dibuat.",
      data: {
        id_sesi: result.outBinds.id_sesi[0],
        id_produk: parsedProduk,
        mulai_pada: sessionDates.mulaiDate,
        selesai_pada: sessionDates.selesaiDate,
        harga_flash: parsedHarga,
        stok_awal: parsedStok,
        stok_tersedia: parsedStok,
      },
    });
  } catch (err) {
    return handleOracleError(res, err, "Gagal membuat sesi flash sale.");
  } finally {
    if (connection) await connection.close();
  }
}

// PUT /api/mitra/flash-sales/:id
// Mengubah harga, stok, atau waktu selesai sesi flash sale milik mitra
async function updateFlashSaleSession(req, res) {
  const idSesi = Number(req.params.id);
  const { harga_flash, stok_awal, stok_tersedia, selesai_pada } = req.body;

  if (!Number.isInteger(idSesi) || idSesi <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "ID sesi tidak valid." });
  }

  let connection;
  try {
    connection = await getConnection();

    const existing = await connection.execute(
      `SELECT s.id_sesi, s.mulai_pada, s.selesai_pada, s.harga_flash, s.stok_awal, s.stok_tersedia
       FROM Sesi_FlashSale s
       JOIN Produk_Makanan p ON p.id_produk = s.id_produk
       WHERE s.id_sesi = :id_sesi
         AND p.id_mitra = :id_mitra`,
      { id_sesi: idSesi, id_mitra: req.user.id_mitra },
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Sesi flash sale tidak ditemukan atau bukan milik mitra Anda.",
      });
    }

    const curr = existing.rows[0];
    const nextHarga =
      harga_flash !== undefined ? Number(harga_flash) : curr.HARGA_FLASH;
    const nextStokAwal =
      stok_awal !== undefined ? Number(stok_awal) : curr.STOK_AWAL;
    const nextStokTersedia =
      stok_tersedia !== undefined ? Number(stok_tersedia) : curr.STOK_TERSEDIA;
    const nextSelesai = selesai_pada
      ? new Date(selesai_pada)
      : curr.SELESAI_PADA;

    if (!Number.isInteger(nextHarga) || nextHarga <= 0) {
      return res.status(400).json({
        success: false,
        message: "harga_flash harus bilangan bulat positif.",
      });
    }
    if (!Number.isInteger(nextStokAwal) || nextStokAwal <= 0) {
      return res.status(400).json({
        success: false,
        message: "stok_awal harus bilangan bulat positif.",
      });
    }
    if (
      !Number.isInteger(nextStokTersedia) ||
      nextStokTersedia < 0 ||
      nextStokTersedia > nextStokAwal
    ) {
      return res.status(400).json({
        success: false,
        message: "stok_tersedia harus berada di antara 0 dan stok_awal.",
      });
    }
    if (isNaN(nextSelesai.getTime()) || nextSelesai <= curr.MULAI_PADA) {
      return res.status(400).json({
        success: false,
        message: "selesai_pada tidak valid atau lebih kecil dari mulai_pada.",
      });
    }

    await connection.execute(
      `UPDATE Sesi_FlashSale
       SET harga_flash = :harga_flash,
           stok_awal = :stok_awal,
           stok_tersedia = :stok_tersedia,
           selesai_pada = :selesai_pada
       WHERE id_sesi = :id_sesi`,
      {
        harga_flash: nextHarga,
        stok_awal: nextStokAwal,
        stok_tersedia: nextStokTersedia,
        selesai_pada: nextSelesai,
        id_sesi: idSesi,
      },
      { autoCommit: true },
    );

    return res.status(200).json({
      success: true,
      message: "Sesi flash sale berhasil diperbarui.",
      data: {
        id_sesi: idSesi,
        harga_flash: nextHarga,
        stok_awal: nextStokAwal,
        stok_tersedia: nextStokTersedia,
        selesai_pada: nextSelesai,
      },
    });
  } catch (err) {
    return handleOracleError(res, err, "Gagal memperbarui sesi flash sale.");
  } finally {
    if (connection) await connection.close();
  }
}

// GET /api/mitra/orders
// Menampilkan daftar pesanan yang masuk untuk produk milik mitra yang sedang login
async function getMitraOrders(req, res) {
  if (!req.user.id_mitra) {
    return res.status(403).json({
      success: false,
      message: 'Profil mitra restoran tidak ditemukan untuk akun ini.',
    });
  }

  const allowedStatus = ['MENUNGGU_BAYAR', 'LUNAS', 'KEDALUWARSA'];
  const statusFilter = req.query.status ? req.query.status.trim().toUpperCase() : null;

  if (statusFilter && !allowedStatus.includes(statusFilter)) {
    return res.status(400).json({
      success: false,
      message: "Filter status hanya boleh 'MENUNGGU_BAYAR', 'LUNAS', atau 'KEDALUWARSA'.",
    });
  }

  let connection;
  try {
    connection = await getConnection();

    const binds = { id_mitra: req.user.id_mitra };
    let statusCondition = '';
    if (statusFilter) {
      statusCondition = 'AND t.status = :status';
      binds.status = statusFilter;
    }

    const result = await connection.execute(
      `SELECT
         t.id_pesanan,
         t.id_sesi,
         p.nama_produk,
         u.nama AS nama_pembeli,
         u.no_hp AS no_hp_pembeli,
         t.jumlah,
         t.harga_satuan_pesan,
         (t.jumlah * t.harga_satuan_pesan) AS total_harga,
         t.dibuat_pada,
         t.batas_bayar,
         t.status,
         pb.dibayar_pada
       FROM Transaksi_Pesanan t
       JOIN Sesi_FlashSale s ON s.id_sesi = t.id_sesi
       JOIN Produk_Makanan p ON p.id_produk = s.id_produk
       JOIN Pengguna u ON u.id_pengguna = t.id_pembeli
       LEFT JOIN Pembayaran pb ON pb.id_pesanan = t.id_pesanan
       WHERE p.id_mitra = :id_mitra
         ${statusCondition}
       ORDER BY t.dibuat_pada DESC, t.id_pesanan DESC`,
      binds
    );

    const data = result.rows.map((row) => ({
      id_pesanan: row.ID_PESANAN,
      id_sesi: row.ID_SESI,
      nama_produk: row.NAMA_PRODUK,
      pembeli: {
        nama: row.NAMA_PEMBELI,
        no_hp: row.NO_HP_PEMBELI,
      },
      jumlah: row.JUMLAH,
      harga_satuan_pesan: row.HARGA_SATUAN_PESAN,
      total_harga: row.TOTAL_HARGA,
      dibuat_pada: row.DIBUAT_PADA,
      batas_bayar: row.BATAS_BAYAR,
      status: row.STATUS,
      dibayar_pada: row.DIBAYAR_PADA || null,
    }));

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    return handleOracleError(res, err, 'Gagal mengambil daftar pesanan masuk mitra.');
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = {
  getMitraProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  createFlashSaleSession,
  updateFlashSaleSession,
  getMitraOrders,
};