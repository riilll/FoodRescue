const express = require("express");
const router = express.Router();
const {
  getMitraProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  createFlashSaleSession,
  updateFlashSaleSession,
  getMitraOrders,
} = require("../controllers/mitraController");
const { verifyToken, authorizeRole } = require("../middleware/authMiddleware");

// Semua endpoint di file ini wajib login sebagai 'mitra'
router.use(verifyToken, authorizeRole("mitra"));

router.get("/products", getMitraProducts);
router.post("/products", createProduct);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

router.post("/flash-sales", createFlashSaleSession);
router.put("/flash-sales/:id", updateFlashSaleSession);
router.get("/orders", getMitraOrders);

module.exports = router;
