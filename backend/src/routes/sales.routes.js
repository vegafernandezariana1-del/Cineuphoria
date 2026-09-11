const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const controller = require("../controllers/sales.controller");
const { createSale } = require("../controllers/create-sale.controller");

const router = express.Router();
router.use(authenticate);
router.get("/movies", controller.getMovies);
router.get("/functions", controller.getFunctions);
router.get("/functions/:funcionId/seats", controller.getSeats);
router.get("/products", controller.getProducts);
router.get("/payment-methods", controller.getPaymentMethods);
router.post("", createSale);

module.exports = router;
