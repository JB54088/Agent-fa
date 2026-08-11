import * as schema from "./schema";

/** Database boundary for server-side adapters. Client components must not import this module. */
export { schema };

type QueryApi = {
  from: (...args: unknown[]) => QueryApi;
  orderBy: (...args: unknown[]) => QueryApi;
  limit: (...args: unknown[]) => Promise<unknown[]>;
  values: (...args: unknown[]) => QueryApi;
  returning: () => Promise<unknown[]>;
};

export type ProductionDb = {
  select: (...args: unknown[]) => QueryApi;
  insert: (...args: unknown[]) => QueryApi;
};

/**
 * The hosted application uses the configured server adapter. Keeping this
 * explicit prevents a request from silently falling back to browser data.
 */
export function getDb(): ProductionDb {
  throw new Error("Production database adapter is not configured. Apply the migrations and provide DATABASE_URL.");
}

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for the production database adapter.");
  return url;
}
