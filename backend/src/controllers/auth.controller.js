const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { jwtSecret, jwtExpiresIn } = require("../config/env");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 12;

function validateCredentials(email, password) {
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
    return "A valid email is required";
  }
  if (typeof password !== "string" || password.length < 8) {
    return "Password must contain at least 8 characters";
  }
  return null;
}

function makeToken(userId) {
  if (!jwtSecret) {
    const error = new Error("JWT_SECRET is not configured");
    error.statusCode = 500;
    throw error;
  }
  return jwt.sign({ sub: userId }, jwtSecret, { expiresIn: jwtExpiresIn });
}

async function register(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const validationError = validateCredentials(email, password);
    if (validationError) return res.status(400).json({ error: validationError });

    const normalizedEmail = email.trim().toLowerCase();
    const [existing] = await pool.execute(
      "SELECT id FROM Usuario WHERE email = ? LIMIT 1", [normalizedEmail]
    );
    if (existing.length > 0) return res.status(409).json({ error: "Email is already registered" });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await pool.execute(
      "INSERT INTO Usuario (email, password_hash) VALUES (?, ?)", [normalizedEmail, passwordHash]
    );
    const [users] = await pool.execute(
      "SELECT id, email, created_at FROM Usuario WHERE id = ?", [result.insertId]
    );
    return res.status(201).json({ user: users[0] });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email is already registered" });
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const validationError = validateCredentials(email, password);
    if (validationError) return res.status(400).json({ error: validationError });

    const [users] = await pool.execute(
      "SELECT id, email, password_hash FROM Usuario WHERE email = ? LIMIT 1",
      [email.trim().toLowerCase()]
    );
    const user = users[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    return res.status(200).json({
      token: makeToken(user.id),
      tokenType: "Bearer",
      expiresIn: jwtExpiresIn
    });
  } catch (error) {
    return next(error);
  }
}

async function me(req, res, next) {
  try {
    const [users] = await pool.execute(
      "SELECT id, email, created_at FROM Usuario WHERE id = ? LIMIT 1", [req.user.id]
    );
    if (!users[0]) return res.status(404).json({ error: "User not found" });
    return res.status(200).json({ user: users[0] });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, me };
