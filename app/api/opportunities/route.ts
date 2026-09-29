import { NextResponse } from "next/server";
import { getAppUser } from "../../chatgpt-auth";
import { getPublishedOpportunitySummary, listPublishedProjects } from "../../../lib/opportunities";

const MAX_IDS = 100;

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ ok: false, error: "authentication_required", projects: [] }, { status: 401 });
  try {
    const params = new URL(request.url).searchParams;
    const ids = params.get("ids")?.split(",").map((id) => id.trim()).filter(Boolean).slice(0, MAX_IDS);
    const result = await listPublishedProjects({
      page: Number(params.get("page") ?? "1"),
      pageSize: Number(params.get("pageSize") ?? "20"),
      search: params.get("q") ?? params.get("search") ?? "",
      scope: params.get("scope") ?? "全部",
      status: params.get("status") ?? "全部",
      companyType: params.get("companyType") ?? "全部类型",
      region: params.get("region") ?? "全部地区",
      matchOnly: params.get("matchOnly") === "true",
      major: params.get("major") ?? "",
      ids,
    });
    const summary = params.get("summary") === "1" ? await getPublishedOpportunitySummary() : undefined;
    return NextResponse.json({ ok: true, source: "database", items: result.items, projects: result.items, page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages, ...(summary ? { summary } : {}) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "数据库读取失败";
    return NextResponse.json({ ok: false, source: "database", error: message, projects: [] }, { status: 503 });
  }
}
