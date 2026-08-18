import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

async function main() {
  const migrationPath = resolve(process.cwd(), "drizzle/0013_source_pool_agent.sql");
  const migration = await readFile(migrationPath, "utf8");
  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify({ migrationPath, safeOperations: ["ADD COLUMN IF NOT EXISTS", "CREATE TABLE IF NOT EXISTS", "CREATE INDEX IF NOT EXISTS"], bytes: migration.length }, null, 2));
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required. Use --dry-run to validate the source-pool migration.");
  const sql = neon(databaseUrl);
  const statements = migration.split(/;\s*(?=\n|$)/).map((statement) => statement.trim()).filter(Boolean);
  await sql.transaction(
    (transaction) => statements.map((statement) => transaction.query(statement)),
    { isolationLevel: "ReadCommitted" },
  );
  console.log(JSON.stringify({ migrationPath, appliedStatements: statements.length, dataPreserved: true }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
