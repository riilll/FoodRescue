require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initDB, getConnection, closeDB } = require("./config/db");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const flashSaleRoutes = require("./routes/flashSaleRoutes");
const mitraRoutes = require("./routes/mitraRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/flash-sales", flashSaleRoutes);
app.use("/api/mitra", mitraRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

// Endpoint Health Check
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
