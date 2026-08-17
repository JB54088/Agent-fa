import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getReminderStore } from "../../../../lib/reminders/store";

type RouteContext = { params: Promise<{ opportunityId: string }> };

async function currentUser() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  return user;
}

function persistenceError(error: unknown) {
  const message = error instanceof Error ? error.message : "persistence_unavailable";
  const status = message.includes("not configured") ? 503 : 500;
  return NextResponse.json({ ok: false, error: "persistence_unavailable", message: status === 503 ? "提醒服务尚未连接，请稍后再试。" : "收藏操作暂时失败，请稍后再试。" }, { status });
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await currentUser();
  if (user instanceof NextResponse) return user;
  const { opportunityId } = await context.params;
  try {
    const result = await getReminderStore().favoriteOpportunity({ userEmail: user.email, opportunityId });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return persistenceError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await currentUser();
  if (user instanceof NextResponse) return user;
  const { opportunityId } = await context.params;
  try {
    const result = await getReminderStore().unfavoriteOpportunity({ userEmail: user.email, opportunityId });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return persistenceError(error);
  }
}
