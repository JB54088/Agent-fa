import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { getAppUser } from "../../../chatgpt-auth";
import { hasAdminRole } from "../../../../lib/auth/admin";
import { AliyunSmsError, sendVerificationCode } from "../../../../lib/sms/aliyun-sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAINLAND_PHONE_PATTERN = /^1[3-9]\d{9}$/;

async function isAuthorizedForSmsTest() {
  const developmentTestMode = process.env.NODE_ENV !== "production" && process.env.SMS_TEST_MODE === "true";
  if (developmentTestMode) return true;

  const user = await getAppUser();
  return hasAdminRole(user);
}

export async function POST(request: Request) {
  if (!(await isAuthorizedForSmsTest())) {
    return NextResponse.json({ success: false, error: "admin_authentication_required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { phone?: unknown } | null;
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  if (!MAINLAND_PHONE_PATTERN.test(phone)) {
    return NextResponse.json({ success: false, error: "invalid_mainland_phone" }, { status: 400 });
  }
  const authorizedTestPhone = process.env.ALIYUN_SMS_TEST_PHONE?.trim();
  if (!authorizedTestPhone) {
    return NextResponse.json({ success: false, error: "sms_test_phone_not_configured" }, { status: 503 });
  }
  if (phone !== authorizedTestPhone) {
    return NextResponse.json({ success: false, error: "sms_test_phone_not_allowed" }, { status: 403 });
  }

  const code = String(randomInt(100000, 1000000));
  try {
    const result = await sendVerificationCode(phone, code);
    console.info("[sms-test] Aliyun SMS sent", { requestId: result.requestId });
    return NextResponse.json({ success: true });
  } catch (error) {
    const smsError = error instanceof AliyunSmsError ? error : new AliyunSmsError("ALIYUN_SDK_ERROR", null);
    console.error("[sms-test] Aliyun SMS failed", {
      requestId: smsError.requestId,
      errorCode: smsError.errorCode,
    });
    const status = smsError.errorCode === "SMS_CONFIGURATION_MISSING" ? 503 : 502;
    return NextResponse.json({ success: false, error: "sms_send_failed" }, { status });
  }
}
