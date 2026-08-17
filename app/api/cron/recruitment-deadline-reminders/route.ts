import { NextResponse } from "next/server";
import { getReminderStore } from "../../../../lib/reminders/store";
import { runDeadlineReminderJob } from "../../../../lib/reminders/scheduler";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || authorization !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDeadlineReminderJob(getReminderStore().reminderJobRepository());
    return NextResponse.json({ ok: true, timezone: "Asia/Shanghai", ...result });
  } catch (error) {
    const unavailable = error instanceof Error && error.message.includes("not configured");
    return NextResponse.json({ ok: false, error: "reminder_job_unavailable", message: unavailable ? "提醒服务尚未连接。" : "提醒任务执行失败。" }, { status: unavailable ? 503 : 500 });
  }
}
