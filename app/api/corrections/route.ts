import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDatabaseUrl } from "../../../db";

const CORRECTION_TYPES = ["时间错误", "官方链接失效", "招聘已截止", "专业要求错误", "招聘信息重复", "其他问题"] as const;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function normalize(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function ensureCorrectionTable(sql: ReturnType<typeof neon>) {
  await sql`
    CREATE TABLE IF NOT EXISTS "user_correction_reports" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id"),
      "user_id" uuid REFERENCES "users"("id"),
      "reporter_email" text,
      "type" text NOT NULL,
      "content" text NOT NULL,
      "status" text NOT NULL DEFAULT 'pending',
      "reviewed_by" uuid REFERENCES "users"("id"),
      "reviewed_at" timestamptz,
      "admin_note" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "user_correction_reports_status_idx" ON "user_correction_reports" ("status", "created_at")`;
  await sql`CREATE INDEX IF NOT EXISTS "user_correction_reports_opportunity_idx" ON "user_correction_reports" ("opportunity_id", "created_at")`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { opportunityId?: string; type?: string; content?: string };
    const opportunityId = normalize(body.opportunityId);
    const type = normalize(body.type);
    const content = normalize(body.content);
    if (!isUuid(opportunityId)) return NextResponse.json({ ok: false, error: "opportunity_id_required" }, { status: 400 });
    if (!CORRECTION_TYPES.includes(type as (typeof CORRECTION_TYPES)[number])) return NextResponse.json({ ok: false, error: "correction_type_required" }, { status: 400 });
    if (!content) return NextResponse.json({ ok: false, error: "correction_content_required" }, { status: 400 });
    if (content.length > 2000) return NextResponse.json({ ok: false, error: "correction_content_too_long" }, { status: 400 });

    const sql = neon(getDatabaseUrl());
    await ensureCorrectionTable(sql);
    const opportunity = await sql`SELECT id::text AS id FROM opportunities WHERE id = ${opportunityId} AND is_demo = false LIMIT 1`;
    if (!opportunity.length) return NextResponse.json({ ok: false, error: "opportunity_not_found" }, { status: 404 });

    const user = await getChatGPTUser();
    const reporterEmail = user?.email ? normalize(user.email) : null;
    const inserted = await sql`
      INSERT INTO user_correction_reports (opportunity_id, reporter_email, type, content)
      VALUES (${opportunityId}, ${reporterEmail}, ${type}, ${content})
      RETURNING id::text AS id, created_at
    `;
    return NextResponse.json({ ok: true, reportId: inserted[0]?.id ?? null, status: "pending" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "纠错提交失败" }, { status: 503 });
  }
}
