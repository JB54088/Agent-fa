import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getReminderStore } from "../../../lib/reminders/store";

function persistenceError(error: unknown) {
  const configured = !(error instanceof Error) || !error.message.includes("not configured");
  return NextResponse.json({ ok: false, error: "persistence_unavailable", message: configured ? "提醒设置暂时无法保存，请稍后再试。" : "提醒服务尚未连接，请稍后再试。" }, { status: configured ? 500 : 503 });
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  const opportunityId = new URL(request.url).searchParams.get("opportunityId");
  if (!opportunityId) return NextResponse.json({ ok: false, error: "opportunity_id_required" }, { status: 400 });
  try {
    const settings = await getReminderStore().getReminderSettings({ userEmail: user.email, opportunityId });
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return persistenceError(error);
  }
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  try {
    const body = await request.json() as { opportunityId?: string; patch?: Record<string, unknown> };
    if (!body.opportunityId || !body.patch) return NextResponse.json({ ok: false, error: "opportunity_id_and_patch_required" }, { status: 400 });
    const allowed = ["remind7Days", "remind3Days", "remind1Day", "remindSameDay", "changeNotificationEnabled", "enabled"];
    const patch = Object.fromEntries(Object.entries(body.patch).filter(([key, value]) => allowed.includes(key) && typeof value === "boolean"));
    const settings = await getReminderStore().updateReminderSettings({ userEmail: user.email, opportunityId: body.opportunityId, patch });
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return persistenceError(error);
  }
}
