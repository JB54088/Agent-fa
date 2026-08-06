import * as schema from "./schema";

/**
 * Database boundary for the production adapter.
 *
 * The visual demo intentionally has no database binding. When a managed
 * PostgreSQL connection is supplied, create the Drizzle client here and pass
 * `{ schema }` to it. Keeping the boundary in one file prevents credentials
 * or admin access from leaking into client components.
 */
export { schema };

type DemoQuery = {
  from: (...args: unknown[]) => DemoQuery;
  orderBy: (...args: unknown[]) => DemoQuery;
  limit: (...args: unknown[]) => Promise<unknown[]>;
  values: (...args: unknown[]) => DemoQuery;
  returning: () => Promise<unknown[]>;
};

type DemoDb = {
  select: (...args: unknown[]) => DemoQuery;
  insert: (...args: unknown[]) => DemoQuery;
};

/** Compatibility shim for the starter D1 example; production uses PostgreSQL. */
export function getDb(): DemoDb {
  throw new Error("The demo has no database binding. Configure DATABASE_URL before using the production adapter.");
}

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for the production database adapter.");
  return url;
}
