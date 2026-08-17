import { neon } from "@neondatabase/serverless";

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to query the persistent Source Pool.");
  const category = argValue("--category");
  const province = argValue("--province");
  const name = argValue("--name");
  const limit = Math.min(500, Math.max(1, Number(argValue("--limit") || 100)));
  const sql = neon(databaseUrl);
  let rows;
  if (category) {
    rows = await sql`SELECT o.name AS organization_name, ds.pool_category AS category, ds.pool_source_type AS source_type, ds.pool_official_status AS official_status, COALESCE(ds.pool_url, ds.source_url) AS url, ds.pool_last_verified_at AS last_verified_at FROM data_sources ds JOIN organizations o ON o.id = ds.organization_id WHERE ds.pool_source_fingerprint IS NOT NULL AND ds.pool_category = ${category} ORDER BY o.name, ds.pool_url LIMIT ${limit}`;
  } else if (province) {
    rows = await sql`SELECT o.name AS organization_name, ds.pool_category AS category, ds.pool_source_type AS source_type, ds.pool_official_status AS official_status, COALESCE(ds.pool_url, ds.source_url) AS url, r.name AS province, ds.pool_last_verified_at AS last_verified_at FROM data_sources ds JOIN organizations o ON o.id = ds.organization_id LEFT JOIN regions r ON r.id = o.region_id WHERE ds.pool_source_fingerprint IS NOT NULL AND r.name LIKE ${`%${province}%`} ORDER BY o.name, ds.pool_url LIMIT ${limit}`;
  } else if (name) {
    rows = await sql`SELECT o.name AS organization_name, ds.pool_category AS category, ds.pool_source_type AS source_type, ds.pool_official_status AS official_status, COALESCE(ds.pool_url, ds.source_url) AS url, ds.pool_last_verified_at AS last_verified_at FROM data_sources ds JOIN organizations o ON o.id = ds.organization_id WHERE ds.pool_source_fingerprint IS NOT NULL AND o.name ILIKE ${`%${name}%`} ORDER BY o.name, ds.pool_url LIMIT ${limit}`;
  } else {
    rows = await sql`SELECT o.name AS organization_name, ds.pool_category AS category, ds.pool_source_type AS source_type, ds.pool_official_status AS official_status, COALESCE(ds.pool_url, ds.source_url) AS url, ds.pool_last_verified_at AS last_verified_at FROM data_sources ds JOIN organizations o ON o.id = ds.organization_id WHERE ds.pool_source_fingerprint IS NOT NULL ORDER BY ds.pool_category, o.name LIMIT ${limit}`;
  }
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
