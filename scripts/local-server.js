import { env } from "../src/config/env.js";
import { app } from "../src/app.js";
import { pool } from "../src/db/pool.js";

const server = app.listen(env.PORT, () => console.log(`Nazoft CRM running at http://localhost:${env.PORT}`));
async function shutdown() {
  server.close();
  await pool.end();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
