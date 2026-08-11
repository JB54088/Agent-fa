import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getReminderStore } from "../../../../lib/reminders/store";

export async function PATCH(_request: Request, context: { params: Promise<{ notificationId: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  const { notificationId } = await context.params;
  try {
    await getReminderStore().markNotificationRead({ userEmail: user.email, notificationId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const unavailable = error instanceof Error && error.message.includes("not configured");
    return NextResponse.json({ ok: false, error: "persistence_unavailable", message: unavailable ? "提醒服务尚未连接，请稍后再试。" : "消息状态暂时无法保存，请稍后再试。" }, { status: unavailable ? 503 : 500 });
  }
}
