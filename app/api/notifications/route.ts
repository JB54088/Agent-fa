import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getReminderStore } from "../../../lib/reminders/store";

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  try {
    const unreadOnly = new URL(request.url).searchParams.get("unread") === "1";
    const notifications = await getReminderStore().listNotifications({ userEmail: user.email, unreadOnly });
    return NextResponse.json({ ok: true, notifications, unreadCount: notifications.filter((item) => !item.readAt).length });
  } catch (error) {
    const unavailable = error instanceof Error && error.message.includes("not configured");
    return NextResponse.json({ ok: false, error: "persistence_unavailable", message: unavailable ? "提醒服务尚未连接，请稍后再试。" : "消息暂时无法加载，请稍后再试。" }, { status: unavailable ? 503 : 500 });
  }
}
