const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");

function authenticate(req, res, next) {
  const [scheme, token] = (req.get("authorization") || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authentication token is required" });
  }
  if (!jwtSecret) {
    return res.status(500).json({ error: "Server authentication is not configured" });
  }
  try {
    const payload = jwt.verify(token, jwtSecret);
    if (!payload.sub) return res.status(401).json({ error: "Invalid authentication token" });
    req.user = { id: payload.sub };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired authentication token" });
  }
}

module.exports = { authenticate };
