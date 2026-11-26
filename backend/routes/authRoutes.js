const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getMe,
  topUpSaldo,
} = require("../controllers/authController.js");
const { verifyToken, authorizeRole } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.get("/me", verifyToken, getMe);
router.post("/topup", verifyToken, authorizeRole("mahasiswa"), topUpSaldo);

module.exports = router;
