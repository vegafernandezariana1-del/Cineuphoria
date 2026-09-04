const app = require("./app");
const pool = require("./config/db");
const { port } = require("./config/env");

const server = app.listen(port, () => {
  console.log(`Cineuphoria API listening on port ${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; closing server`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
