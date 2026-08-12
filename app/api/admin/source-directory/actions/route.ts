import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDatabaseUrl, getDb, schema } from "../../../../../db";
import { syncVerifiedSourcesToOpportunities } from "../../../../../lib/source-opportunity-feed";

async function requireAdmin() {
  const user = await getChatGPTUser();
  if (!user) return false;
  const db = getDb();
  const rows = await db.select({ id: schema.users.id })
    .from(schema.users)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.userId, schema.users.id))
    .where(eq(schema.users.email, user.email))
    .limit(1);
  return Boolean(rows[0]);
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const body = await request.json() as { sourceId?: string; action?: string; recruitmentLinkStatus?: string; sourceUrl?: string };
    if (body.action === "sync_all") {
      const summary = await syncVerifiedSourcesToOpportunities();
      return NextResponse.json({ ok: true, action: body.action, summary });
    }
    if (!body.sourceId || !body.action) return NextResponse.json({ ok: false, error: "source_id_and_action_required" }, { status: 400 });
    const sql = neon(getDatabaseUrl());
    await sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS recruitment_link_status text NOT NULL DEFAULT 'NEEDS_REVIEW'`;
    const source = await sql`SELECT id::text AS id, discovery_status, status FROM data_sources WHERE id = ${body.sourceId} LIMIT 1`;
    if (!source[0]) return NextResponse.json({ ok: false, error: "source_not_found" }, { status: 404 });

    if (body.action === "set_url") {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(body.sourceUrl ?? "");
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error("invalid_protocol");
      } catch {
        return NextResponse.json({ ok: false, error: "official_source_url_must_be_http_or_https" }, { status: 400 });
      }
      await sql`UPDATE data_sources SET source_url = ${parsedUrl.toString()}, source_domain = ${parsedUrl.hostname}, discovery_status = 'NEEDS_REVIEW', requires_manual_review = true, automation_allowed = false, updated_at = now() WHERE id = ${body.sourceId}`;
      return NextResponse.json({ ok: true, sourceId: body.sourceId, action: body.action, sourceUrl: parsedUrl.toString() });
    }

    switch (body.action) {
      case "verify":
        {
          const linkStatus = ["OFFICIAL_ENTRY_ONLY", "HAS_ACTIVE_RECRUITMENT", "UPCOMING_RECRUITMENT", "NO_CURRENT_RECRUITMENT"].includes(body.recruitmentLinkStatus ?? "") ? body.recruitmentLinkStatus : "OFFICIAL_ENTRY_ONLY";
          await sql`UPDATE data_sources SET discovery_status = 'VERIFIED', status = 'active', automation_allowed = false, requires_manual_review = true, source_last_verified_at = now(), recruitment_link_status = ${linkStatus}, updated_at = now() WHERE id = ${body.sourceId}`;
        }
        break;
      case "request_review":
        await sql`UPDATE data_sources SET discovery_status = 'NEEDS_REVIEW', status = 'active', automation_allowed = false, incremental_sync_enabled = false, requires_manual_review = true, recruitment_link_status = 'NEEDS_REVIEW', admin_note = concat(coalesce(admin_note, ''), ' [manual-review-requested:', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'), ']'), updated_at = now() WHERE id = ${body.sourceId}`;
        break;
      case "verify_and_publish":
        {
          const linkStatus = ["OFFICIAL_ENTRY_ONLY", "HAS_ACTIVE_RECRUITMENT", "UPCOMING_RECRUITMENT", "NO_CURRENT_RECRUITMENT"].includes(body.recruitmentLinkStatus ?? "") ? body.recruitmentLinkStatus : "OFFICIAL_ENTRY_ONLY";
          await sql`UPDATE data_sources SET discovery_status = 'VERIFIED', status = 'active', automation_allowed = false, requires_manual_review = true, source_last_verified_at = now(), recruitment_link_status = ${linkStatus}, admin_note = concat(coalesce(admin_note, ''), ' [manual-review-confirmed:', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'), ']'), updated_at = now() WHERE id = ${body.sourceId}`;
          const summary = await syncVerifiedSourcesToOpportunities(body.sourceId);
          return NextResponse.json({ ok: true, sourceId: body.sourceId, action: body.action, summary });
        }
      case "unverify":
        await sql`UPDATE data_sources SET discovery_status = 'NEEDS_REVIEW', automation_allowed = false, incremental_sync_enabled = false, recruitment_link_status = 'NEEDS_REVIEW', updated_at = now() WHERE id = ${body.sourceId}`;
        break;
      case "auto":
        if (!["VERIFIED", "AUTO_ALLOWED"].includes(source[0].discovery_status)) return NextResponse.json({ ok: false, error: "source_must_be_verified_before_auto_collection" }, { status: 409 });
        await sql`UPDATE data_sources SET discovery_status = 'AUTO_ALLOWED', automation_allowed = true, incremental_sync_enabled = true, requires_manual_review = true, updated_at = now() WHERE id = ${body.sourceId}`;
        break;
      case "manual":
        await sql`UPDATE data_sources SET discovery_status = 'MANUAL_ONLY', automation_allowed = false, incremental_sync_enabled = false, requires_manual_review = true, updated_at = now() WHERE id = ${body.sourceId}`;
        break;
      case "scan":
        await sql`UPDATE data_sources SET next_check_at = now(), admin_note = concat(coalesce(admin_note, ''), ' [manual-scan-requested:', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'), ']'), updated_at = now() WHERE id = ${body.sourceId}`;
        break;
      case "disable":
        await sql`UPDATE data_sources SET status = 'invalid', discovery_status = 'INACTIVE', automation_allowed = false, incremental_sync_enabled = false, updated_at = now() WHERE id = ${body.sourceId}`;
        break;
      case "enable":
        await sql`UPDATE data_sources SET status = 'active', discovery_status = CASE WHEN discovery_status = 'INACTIVE' THEN 'NEEDS_REVIEW' ELSE discovery_status END, updated_at = now() WHERE id = ${body.sourceId}`;
        break;
      default:
        return NextResponse.json({ ok: false, error: "unsupported_source_action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, sourceId: body.sourceId, action: body.action });
  } catch (error) {
    const message = error instanceof Error ? error.message : "来源操作失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
