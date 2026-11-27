const express = require("express");
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrderById,
} = require("../controllers/orderController");
const { verifyToken, authorizeRole } = require("../middleware/authMiddleware");

// Semua endpoint pemesanan khusus role 'mahasiswa'
router.use(verifyToken, authorizeRole("mahasiswa"));

router.post("/", createOrder);
router.get("/me", getMyOrders); // Wajib diletakkan sebelum /:id
router.get("/:id", getOrderById);

module.exports = router;
