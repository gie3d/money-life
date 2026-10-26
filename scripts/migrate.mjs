// Applies db/*.sql in order, once each. Runs before the web server starts.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const dir = path.join(import.meta.dirname, "..", "db");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

// The database container may still be starting even after its healthcheck passes once.
for (let attempt = 1; ; attempt++) {
  try {
    await client.connect();
    break;
  } catch (err) {
    if (attempt >= 20) throw err;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

await client.query(
  "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
);
const done = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  await client.query("BEGIN");
  try {
    await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    await client.query("COMMIT");
    console.log(`applied ${file}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}
await client.end();
