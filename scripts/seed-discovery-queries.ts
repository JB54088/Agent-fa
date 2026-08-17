import { neon } from "@neondatabase/serverless";
import { discoveryStrategies } from "../lib/source-discovery/strategies.ts";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to seed discovery queries.");
  const sql = neon(databaseUrl);
  const queries = discoveryStrategies.map((strategy) => sql`
    INSERT INTO discovery_queries (query, category, province, strategy, priority)
    VALUES (${strategy.query}, ${strategy.category}, ${strategy.province || ""}, ${strategy.name}, ${strategy.priority})
    ON CONFLICT (query, category, province)
    DO UPDATE SET strategy = EXCLUDED.strategy, priority = EXCLUDED.priority, updated_at = now()
  `);
  await sql.transaction(queries, { isolationLevel: "ReadCommitted" });
  console.log(JSON.stringify({ seeded: discoveryStrategies.length, preservedRunHistory: true }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
