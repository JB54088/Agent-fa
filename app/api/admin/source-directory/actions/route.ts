import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDatabaseUrl, getDb, schema } from "../../../../../db";
import { syncVerifiedSourcesToOpportunities } from "../../../../../lib/source-opportunity-feed";
import { ensureOfficialUrlLifecycle } from "../../../../../lib/official-url-lifecycle";

async function requireAdmin() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const db = getDb();
  const rows = await db.select({ id: schema.users.id })
    .from(schema.users)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.userId, schema.users.id))
    .where(eq(schema.users.email, user.email))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function POST(request: Request) {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const body = await request.json() as { sourceId?: string; action?: string; recruitmentLinkStatus?: string; sourceUrl?: string };
    if (body.action === "sync_all") {
      const summary = await syncVerifiedSourcesToOpportunities();
      return NextResponse.json({ ok: true, action: body.action, summary });
    }
    if (!body.sourceId || !body.action) return NextResponse.json({ ok: false, error: "source_id_and_action_required" }, { status: 400 });
    const sql = neon(getDatabaseUrl());
    await ensureOfficialUrlLifecycle(sql);
    await sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS recruitment_link_status text NOT NULL DEFAULT 'NEEDS_REVIEW'`;
    const source = await sql`SELECT id::text AS id, organization_id::text AS organization_id, source_url, official_url_status, discovery_status, status FROM data_sources WHERE id = ${body.sourceId} LIMIT 1`;
    if (!source[0]) return NextResponse.json({ ok: false, error: "source_not_found" }, { status: 404 });

    if (body.action === "set_url") {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(body.sourceUrl ?? "");
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error("invalid_protocol");
      } catch {
        return NextResponse.json({ ok: false, error: "official_source_url_must_be_http_or_https" }, { status: 400 });
      }
      const normalizedUrl = parsedUrl.toString();
      const conflict = await sql`
        SELECT id::text AS id FROM data_sources
        WHERE id <> ${body.sourceId}
          AND organization_id = ${source[0].organization_id}
          AND status = 'active'
          AND (source_url = ${normalizedUrl} OR list_page_url = ${normalizedUrl})
        LIMIT 1
      `;
      if (conflict[0]) return NextResponse.json({ ok: false, error: "official_url_conflict_for_organization" }, { status: 409 });
      const alreadyPublished = source[0].official_url_status === "PUBLISHED" && source[0].source_url === normalizedUrl;
      if (alreadyPublished) return NextResponse.json({ ok: true, sourceId: body.sourceId, action: body.action, sourceUrl: normalizedUrl, officialUrlStatus: "PUBLISHED" });
      await sql`
        UPDATE data_sources SET
          source_url = ${normalizedUrl}, source_domain = ${parsedUrl.hostname},
          official_url_status = 'REGISTERED', official_url_registered_at = now(), official_url_registered_by = ${adminId},
          official_url_published_at = NULL, official_url_published_by = NULL,
          discovery_status = 'NEEDS_REVIEW', recruitment_link_status = 'NEEDS_REVIEW',
          requires_manual_review = true, automation_allowed = false, incremental_sync_enabled = false,
          updated_at = now()
        WHERE id = ${body.sourceId}
      `;
      return NextResponse.json({ ok: true, sourceId: body.sourceId, action: body.action, sourceUrl: normalizedUrl, officialUrlStatus: "REGISTERED" });
    }

    switch (body.action) {
      case "verify":
        {
          if (source[0].official_url_status !== "REGISTERED" && source[0].official_url_status !== "PUBLISHED") return NextResponse.json({ ok: false, error: "official_url_must_be_registered_before_verification" }, { status: 409 });
          const linkStatus = ["OFFICIAL_ENTRY_ONLY", "HAS_ACTIVE_RECRUITMENT", "UPCOMING_RECRUITMENT", "NO_CURRENT_RECRUITMENT"].includes(body.recruitmentLinkStatus ?? "") ? body.recruitmentLinkStatus : "OFFICIAL_ENTRY_ONLY";
          await sql`UPDATE data_sources SET discovery_status = 'VERIFIED', status = 'active', automation_allowed = false, requires_manual_review = true, source_last_verified_at = now(), recruitment_link_status = ${linkStatus}, updated_at = now() WHERE id = ${body.sourceId}`;
        }
        break;
      case "request_review":
        if (source[0].official_url_status !== "REGISTERED" && source[0].official_url_status !== "PUBLISHED") return NextResponse.json({ ok: false, error: "official_url_must_be_registered_before_review" }, { status: 409 });
        await sql`UPDATE data_sources SET discovery_status = 'NEEDS_REVIEW', status = 'active', automation_allowed = false, incremental_sync_enabled = false, requires_manual_review = true, recruitment_link_status = 'NEEDS_REVIEW', admin_note = concat(coalesce(admin_note, ''), ' [manual-review-requested:', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'), ']'), updated_at = now() WHERE id = ${body.sourceId}`;
        break;
      case "verify_and_publish":
        {
          const registeredSource = await sql`SELECT source_url, official_url_status FROM data_sources WHERE id = ${body.sourceId} LIMIT 1`;
          if (!registeredSource[0] || registeredSource[0].official_url_status !== "REGISTERED" || !registeredSource[0].source_url) return NextResponse.json({ ok: false, error: "official_url_must_be_registered_before_publishing" }, { status: 409 });
          const linkStatus = ["OFFICIAL_ENTRY_ONLY", "HAS_ACTIVE_RECRUITMENT", "UPCOMING_RECRUITMENT", "NO_CURRENT_RECRUITMENT"].includes(body.recruitmentLinkStatus ?? "") ? body.recruitmentLinkStatus : "OFFICIAL_ENTRY_ONLY";
          await sql`UPDATE data_sources SET discovery_status = 'VERIFIED', status = 'active', official_url_status = 'PUBLISHED', official_url_published_at = now(), official_url_published_by = ${adminId}, automation_allowed = false, requires_manual_review = true, source_last_verified_at = now(), recruitment_link_status = ${linkStatus}, admin_note = concat(coalesce(admin_note, ''), ' [manual-review-confirmed:', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'), ']'), updated_at = now() WHERE id = ${body.sourceId}`;
          const summary = await syncVerifiedSourcesToOpportunities(body.sourceId);
          return NextResponse.json({ ok: true, sourceId: body.sourceId, action: body.action, summary });
        }
      case "unverify":
        await sql`UPDATE data_sources SET discovery_status = 'NEEDS_REVIEW', official_url_status = CASE WHEN source_url IS NULL THEN 'UNREGISTERED' ELSE 'REGISTERED' END, official_url_published_at = NULL, official_url_published_by = NULL, automation_allowed = false, incremental_sync_enabled = false, recruitment_link_status = 'NEEDS_REVIEW', updated_at = now() WHERE id = ${body.sourceId}`;
        break;
      case "auto":
        if (source[0].official_url_status !== "PUBLISHED") return NextResponse.json({ ok: false, error: "official_entry_must_be_published_before_auto_collection" }, { status: 409 });
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
