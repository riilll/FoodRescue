const oracledb = require("oracledb");

// Mengembalikan hasil query sebagai JSON object { KOLOM: nilai }, bukan array
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function initDB() {
try {
    await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: 2,
      poolMax: 20, // Disiapkan untuk uji concurrency/rebutan flash sale
    poolIncrement: 2,
    });
    console.log("Oracle Database Connection Pool berhasil dibuat.");
} catch (err) {
    console.error("Gagal menginisialisasi Oracle Pool:", err.message);
    process.exit(1);
}
}

async function getConnection() {
return await oracledb.getConnection();
}

async function closeDB() {
await oracledb.getPool().close(10);
}

module.exports = { initDB, getConnection, closeDB };
