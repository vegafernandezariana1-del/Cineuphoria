const express = require("express");
const cors = require("cors");
const { corsOrigin } = require("./config/env");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const salesRoutes = require("./routes/sales.routes");
const { notFound, errorHandler } = require("./middleware/error.middleware");

const app = express();
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "100kb" }));
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sales", salesRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
