const express = require("express");
const router = express.Router();
const {
  getActiveFlashSales,
  getFlashSaleById,
} = require("../controllers/flashSaleController");

router.get("/", getActiveFlashSales);
router.get("/:id", getFlashSaleById);

module.exports = router;
