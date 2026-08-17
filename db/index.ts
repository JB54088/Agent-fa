import * as schema from "./schema.ts";
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

/** Database boundary for server-side adapters. Client components must not import this module. */
export { schema };

export type ProductionDb = NeonHttpDatabase<typeof schema>;

let cachedDb: ProductionDb | undefined;
let runtimeDatabaseUrl: string | undefined;

/** Allows the Cloudflare Worker adapter to pass its secret binding explicitly. */
export function configureDatabase(url: string | undefined) {
  if (url && url !== runtimeDatabaseUrl) {
    runtimeDatabaseUrl = url;
    cachedDb = undefined;
  }
}

/**
 * The hosted application uses the configured server adapter. Keeping this
 * explicit prevents a request from silently falling back to browser data.
 */
export function getDb(): ProductionDb {
  const url = getDatabaseUrl();
  if (!cachedDb) {
    cachedDb = drizzle(neon(url), { schema });
  }
  return cachedDb;
}

export function getDatabaseUrl() {
  const url = runtimeDatabaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for the production database adapter.");
  return url;
}
