import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAppUser } from "../../../../chatgpt-auth";
import { getDb, schema } from "../../../../../db";
import { recordMembershipAdminAction } from "../../../../../lib/membership/audit";

export async function PATCH(_request: Request, context: { params: Promise<{ codeId: string }> }) {
  const user = await getAppUser();
  if (!user?.id || user.role !== "admin") return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
  const { codeId } = await context.params;
  try {
    const updated = await getDb().update(schema.activationCodes)
      .set({ status: "disabled", disabledAt: new Date(), disabledBy: user.id })
      .where(and(eq(schema.activationCodes.id, codeId), eq(schema.activationCodes.status, "unused")))
      .returning({ id: schema.activationCodes.id });
    if (!updated[0]) return NextResponse.json({ ok: false, error: "activation_code_not_unused" }, { status: 409 });
    await recordMembershipAdminAction(user.id, "membership_activation_code_disabled", updated[0].id, { status: "disabled" });
    return NextResponse.json({ ok: true, id: updated[0].id, status: "disabled" });
  } catch {
    return NextResponse.json({ ok: false, error: "activation_code_service_unavailable" }, { status: 503 });
  }
}
