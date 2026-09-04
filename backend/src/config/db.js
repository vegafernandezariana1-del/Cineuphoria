const mysql = require("mysql2/promise");
const { db } = require("./env");

const pool = mysql.createPool(db);

module.exports = pool;
