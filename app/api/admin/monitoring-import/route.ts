import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDatabaseUrl, getDb, schema } from "../../../../db";

type MonitoringRecord = {
  name: string;
  category: string;
  regionName: string;
  industry: string;
  priority: string;
};

function normalize(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function digestHex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function stableUuid(value: string) {
  const chars = (await digestHex(value)).slice(0, 32).split("");
  chars[12] = "4";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const normalized = chars.join("");
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

async function requireAdmin() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const db = getDb();
  const rows = await db.select({ userId: schema.users.id })
    .from(schema.users)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.userId, schema.users.id))
    .where(eq(schema.users.email, user.email))
    .limit(1);
  return rows[0]?.userId ?? null;
}

async function ensureMonitoringColumns(sql: ReturnType<typeof neon>) {
  await sql`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS monitoring_enabled boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS monitoring_source text,
      ADD COLUMN IF NOT EXISTS monitoring_category text,
      ADD COLUMN IF NOT EXISTS monitoring_region_name text
  `;
  await sql`CREATE INDEX IF NOT EXISTS organizations_monitoring_idx ON organizations (monitoring_enabled, monitoring_category)`;
}

export async function POST(request: Request) {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const payload = await request.json() as { records?: MonitoringRecord[]; sourceDocument?: string };
    const sourceDocument = normalize(payload.sourceDocument) || "全国秋招集团名单｜2027届监控版";
    const rawRecords = Array.isArray(payload.records) ? payload.records : [];
    const unique = new Map<string, MonitoringRecord>();
    for (const item of rawRecords) {
      const record = {
        name: normalize(item?.name),
        category: normalize(item?.category) || "其他重点单位",
        regionName: normalize(item?.regionName) || "全国",
        industry: normalize(item?.industry) || "未分类",
        priority: normalize(item?.priority) || "P1",
      };
      if (!record.name) continue;
      if (!unique.has(record.name)) unique.set(record.name, record);
    }
    if (!unique.size) return NextResponse.json({ ok: false, error: "监控母表没有可导入的组织记录" }, { status: 400 });

    const sql = neon(getDatabaseUrl());
    await ensureMonitoringColumns(sql);
    const regionRows = await sql`SELECT id::text AS id, name FROM regions`;
    const regionByName = new Map<string, string>();
    for (const region of regionRows) {
      const regionName = normalize(region.name);
      regionByName.set(regionName, String(region.id));
      regionByName.set(regionName.replace(/省$|市$|自治区$|特别行政区$/, ""), String(region.id));
    }
    const records = await Promise.all(Array.from(unique.values()).map(async (record) => ({
      id: await stableUuid(`monitoring-organization:${record.name}`),
      ...record,
      region_name: record.regionName,
      region_id: record.regionName === "全国" ? null : regionByName.get(record.regionName) ?? null,
      source_document: sourceDocument,
    })));
    const batchResult = await sql`
      WITH input AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(records)}::jsonb)
        AS x(id uuid, name text, category text, region_name text, industry text, priority text, region_id uuid, source_document text)
      ), upserted AS (
        INSERT INTO organizations (
          id, name, short_name, organization_type, industry, priority, status,
          region_id, monitoring_enabled, monitoring_source, monitoring_category, monitoring_region_name
        )
        SELECT id, name, name, category, industry, priority, 'active', region_id, true, source_document, category, region_name
        FROM input
        ON CONFLICT (name) DO UPDATE SET
          organization_type = EXCLUDED.organization_type,
          industry = EXCLUDED.industry,
          priority = EXCLUDED.priority,
          status = 'active',
          region_id = COALESCE(EXCLUDED.region_id, organizations.region_id),
          monitoring_enabled = true,
          monitoring_source = EXCLUDED.monitoring_source,
          monitoring_category = EXCLUDED.monitoring_category,
          monitoring_region_name = EXCLUDED.monitoring_region_name,
          updated_at = now()
        RETURNING (xmax = 0) AS inserted
      )
      SELECT count(*)::int AS processed, count(*) FILTER (WHERE inserted)::int AS inserted FROM upserted
    `;
    const inserted = Number(batchResult[0]?.inserted ?? 0);
    const categories = Object.fromEntries(Array.from(unique.values()).reduce((map, record) => map.set(record.category, (map.get(record.category) ?? 0) + 1), new Map<string, number>()));
    const regions = Object.fromEntries(Array.from(unique.values()).reduce((map, record) => map.set(record.regionName, (map.get(record.regionName) ?? 0) + 1), new Map<string, number>()));
    const totalRows = await sql`SELECT count(*)::int AS count FROM organizations WHERE monitoring_enabled = true`;
    return NextResponse.json({
      ok: true,
      sourceDocument,
      received: rawRecords.length,
      unique: unique.size,
      duplicateRows: rawRecords.length - unique.size,
      inserted,
      updated: unique.size - inserted,
      monitoredOrganizations: Number(totalRows[0]?.count ?? 0),
      categories,
      regions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "监控母表导入失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
