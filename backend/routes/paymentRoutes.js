const express = require("express");
const router = express.Router();
const {
  payOrder,
  getPaymentStatus,
} = require("../controllers/paymentController");
const { verifyToken, authorizeRole } = require("../middleware/authMiddleware");

router.use(verifyToken, authorizeRole("mahasiswa"));

router.post("/:orderId", payOrder);
router.get("/:orderId", getPaymentStatus);

module.exports = router;
