require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initDB, getConnection, closeDB } = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Supaya React (Vite) Bg Habib tidak kena blokir CORS
app.use(express.json());

// Endpoint Health Check (verifikasi koneksi Express <-> Oracle XE)
app.get("/api/health", async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute("SELECT 1 AS STATUS FROM DUAL");
    res.status(200).json({
      status: "OK",
      message: "Backend FoodRescue terhubung ke Oracle Database XE",
      dbCheck: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      message: "Gagal terhubung ke database",
      error: err.message,
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

// Start server setelah Oracle Pool siap
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server FoodRescue berjalan di port ${PORT}`);
  });
});

// Menutup pool dengan rapi saat server dimatikan
process.on("SIGINT", async () => {
  await closeDB();
  process.exit(0);
});
