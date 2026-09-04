const pool = require("../config/db");

async function health(req, res, next) {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok", db: "connected" });
  } catch (error) {
    error.statusCode = 503;
    error.publicMessage = "Database unavailable";
    next(error);
  }
}

module.exports = { health };
