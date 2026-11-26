const oracledb = require("oracledb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getConnection } = require("../config/db");
const { handleOracleError } = require("../utils/oracleError");

const JAM_TUTUP_REGEX = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

// POST /api/auth/register
async function register(req, res) {
  const { nama, email, password, no_hp, role, nama_mitra, alamat, jam_tutup } =
    req.body;

  if (!nama || !email || !password || !no_hp || !role) {
    return res.status(400).json({
      success: false,
      message: "Field nama, email, password, no_hp, dan role wajib diisi.",
    });
  }

  const normalizedRole = role.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  if (!["mahasiswa", "mitra"].includes(normalizedRole)) {
    return res.status(400).json({
      success: false,
      message: "Role hanya boleh 'mahasiswa' atau 'mitra'.",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password minimal 6 karakter.",
    });
  }

  if (normalizedRole === "mitra") {
    if (!nama_mitra || !alamat || !jam_tutup) {
      return res.status(400).json({
        success: false,
        message:
          "Pendaftaran mitra wajib mengisi nama_mitra, alamat, dan jam_tutup.",
      });
    }
    if (!JAM_TUTUP_REGEX.test(jam_tutup)) {
      return res.status(400).json({
        success: false,
        message: "Format jam_tutup harus HH:MM (24 jam), contoh: 21:00.",
      });
    }
  }

  let connection;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    connection = await getConnection();

    // 1. Insert ke tabel Pengguna (autoCommit: false agar atomik jika mitra)
    const userResult = await connection.execute(
      `INSERT INTO Pengguna (nama, email, password_hash, no_hp, role)
       VALUES (:nama, :email, :password_hash, :no_hp, :role)
       RETURNING id_pengguna INTO :id_pengguna`,
      {
        nama: nama.trim(),
        email: normalizedEmail,
        password_hash: passwordHash,
        no_hp: no_hp.trim(),
        role: normalizedRole,
        id_pengguna: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: false },
    );

    const idPengguna = userResult.outBinds.id_pengguna[0];
    let mitraData = null;

    // 2. Jika role mitra, lanjut insert ke tabel Mitra_Restoran dalam transaksi yang sama
    if (normalizedRole === "mitra") {
      const mitraResult = await connection.execute(
        `INSERT INTO Mitra_Restoran (id_pengguna, nama_mitra, alamat, jam_tutup)
         VALUES (:id_pengguna, :nama_mitra, :alamat, :jam_tutup)
         RETURNING id_mitra INTO :id_mitra`,
        {
          id_pengguna: idPengguna,
          nama_mitra: nama_mitra.trim(),
          alamat: alamat.trim(),
          jam_tutup: jam_tutup.trim(),
          id_mitra: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
        { autoCommit: false },
      );

      mitraData = {
        id_mitra: mitraResult.outBinds.id_mitra[0],
        nama_mitra: nama_mitra.trim(),
        alamat: alamat.trim(),
        jam_tutup: jam_tutup.trim(),
      };
    }

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Registrasi berhasil.",
      data: {
        id_pengguna: idPengguna,
        nama: nama.trim(),
        email: normalizedEmail,
        no_hp: no_hp.trim(),
        role: normalizedRole,
        saldo: 0,
        mitra: mitraData,
      },
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    return handleOracleError(res, err, "Gagal melakukan registrasi.");
  } finally {
    if (connection) await connection.close();
  }
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email dan password wajib diisi.",
    });
  }

  let connection;
  try {
    connection = await getConnection();

    const userResult = await connection.execute(
      `SELECT id_pengguna, nama, email, password_hash, no_hp, role, saldo
       FROM Pengguna
       WHERE email = :email`,
      { email: email.trim().toLowerCase() },
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Email atau password salah.",
      });
    }

    const user = userResult.rows[0];

    // Akun seed demo menggunakan penanda DEMO_TANPA_LOGIN
    if (user.PASSWORD_HASH === "DEMO_TANPA_LOGIN") {
      return res.status(401).json({
        success: false,
        message:
          "Akun demo seed tidak dapat digunakan untuk login. Silakan registrasi akun baru.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.PASSWORD_HASH);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Email atau password salah.",
      });
    }

    let mitraData = null;
    if (user.ROLE === "mitra") {
      const mitraResult = await connection.execute(
        `SELECT id_mitra, nama_mitra, alamat, jam_tutup
         FROM Mitra_Restoran
         WHERE id_pengguna = :id_pengguna
         FETCH FIRST 1 ROWS ONLY`,
        { id_pengguna: user.ID_PENGGUNA },
      );

      if (mitraResult.rows.length > 0) {
        const m = mitraResult.rows[0];
        mitraData = {
          id_mitra: m.ID_MITRA,
          nama_mitra: m.NAMA_MITRA,
          alamat: m.ALAMAT,
          jam_tutup: m.JAM_TUTUP,
        };
      }
    }

    const payload = {
      id_pengguna: user.ID_PENGGUNA,
      email: user.EMAIL,
      role: user.ROLE,
      id_mitra: mitraData ? mitraData.id_mitra : null,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    return res.status(200).json({
      success: true,
      message: "Login berhasil.",
      token,
      user: {
        id_pengguna: user.ID_PENGGUNA,
        nama: user.NAMA,
        email: user.EMAIL,
        no_hp: user.NO_HP,
        role: user.ROLE,
        saldo: user.SALDO,
        mitra: mitraData,
      },
    });
  } catch (err) {
    return handleOracleError(res, err, "Gagal melakukan login.");
  } finally {
    if (connection) await connection.close();
  }
}

// GET /api/auth/me
async function getMe(req, res) {
  let connection;
  try {
    connection = await getConnection();

    const userResult = await connection.execute(
      `SELECT id_pengguna, nama, email, no_hp, role, saldo
       FROM Pengguna
       WHERE id_pengguna = :id_pengguna`,
      { id_pengguna: req.user.id_pengguna },
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Akun tidak ditemukan.",
      });
    }

    const user = userResult.rows[0];
    let mitraData = null;

    if (user.ROLE === "mitra") {
      const mitraResult = await connection.execute(
        `SELECT id_mitra, nama_mitra, alamat, jam_tutup
         FROM Mitra_Restoran
         WHERE id_pengguna = :id_pengguna
         FETCH FIRST 1 ROWS ONLY`,
        { id_pengguna: user.ID_PENGGUNA },
      );
      if (mitraResult.rows.length > 0) {
        const m = mitraResult.rows[0];
        mitraData = {
          id_mitra: m.ID_MITRA,
          nama_mitra: m.NAMA_MITRA,
          alamat: m.ALAMAT,
          jam_tutup: m.JAM_TUTUP,
        };
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        id_pengguna: user.ID_PENGGUNA,
        nama: user.NAMA,
        email: user.EMAIL,
        no_hp: user.NO_HP,
        role: user.ROLE,
        saldo: user.SALDO,
        mitra: mitraData,
      },
    });
  } catch (err) {
    return handleOracleError(res, err, "Gagal mengambil profil pengguna.");
  } finally {
    if (connection) await connection.close();
  }
}

// POST /api/auth/topup (khusus mahasiswa untuk menambah saldo)
async function topUpSaldo(req, res) {
  const nominal = Number(req.body.nominal);

  if (!Number.isInteger(nominal) || nominal <= 0) {
    return res.status(400).json({
      success: false,
      message: "Nominal top-up harus berupa bilangan bulat positif.",
    });
  }

  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `UPDATE Pengguna
       SET saldo = saldo + :nominal
       WHERE id_pengguna = :id_pengguna
       RETURNING saldo INTO :saldo_baru`,
      {
        nominal,
        id_pengguna: req.user.id_pengguna,
        saldo_baru: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true },
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({
        success: false,
        message: "Akun tidak ditemukan.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Top-up saldo berhasil.",
      data: {
        saldo_baru: result.outBinds.saldo_baru[0],
      },
    });
  } catch (err) {
    return handleOracleError(res, err, "Gagal melakukan top-up saldo.");
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { register, login, getMe, topUpSaldo };
