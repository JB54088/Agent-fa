import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { writeSourcePoolXlsx } from "../lib/source-pool/xlsx.ts";

const headers = ["organization_name", "category", "subcategory", "source_type", "official_status", "website_name", "url", "normalized_url", "province", "city", "parent_organization", "first_discovered_at", "last_verified_at", "discovery_method", "discovered_from_url", "status"];

function rowValues(row: Record<string, unknown>) {
  return headers.map((key) => String(row[key] ?? ""));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to export the persistent Source Pool.");
  const sql = neon(databaseUrl);
  const rows = await sql`
    SELECT o.name AS organization_name, ds.pool_category AS category, ds.pool_subcategory AS subcategory,
      ds.pool_source_type AS source_type, ds.pool_official_status AS official_status,
      ds.pool_website_name AS website_name, COALESCE(ds.pool_url, ds.source_url) AS url,
      ds.pool_normalized_url AS normalized_url, r.name AS province, NULL::text AS city,
      parent.name AS parent_organization, ds.pool_first_discovered_at AS first_discovered_at,
      ds.pool_last_verified_at AS last_verified_at, ds.pool_discovery_method AS discovery_method,
      ds.pool_discovered_from_url AS discovered_from_url, ds.pool_status AS status
    FROM data_sources ds
    JOIN organizations o ON o.id = ds.organization_id
    LEFT JOIN regions r ON r.id = o.region_id
    LEFT JOIN organizations parent ON parent.id = o.parent_id
    WHERE ds.pool_source_fingerprint IS NOT NULL
    ORDER BY ds.pool_category, o.name, ds.pool_url
  `;
  const exportDir = resolve(process.cwd(), "exports");
  await mkdir(exportDir, { recursive: true });
  const values = rows.map((row) => rowValues(row as Record<string, unknown>));
  const csvEscape = (value: string) => /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  const csv = [headers.join(","), ...values.map((row) => row.map(csvEscape).join(",")), ""].join("\n");
  await writeFile(resolve(exportDir, "source_pool.csv"), csv, "utf8");
  await writeFile(resolve(exportDir, "source_pool.json"), JSON.stringify({ exportedAt: new Date().toISOString(), count: rows.length, rows }, null, 2), "utf8");
  await writeSourcePoolXlsx(resolve(exportDir, "source_pool.xlsx"), headers, values);
  console.log(JSON.stringify({ count: rows.length, files: ["exports/source_pool.csv", "exports/source_pool.json", "exports/source_pool.xlsx"] }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
