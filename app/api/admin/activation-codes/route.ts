import { and, desc, eq, ilike } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAppUser } from "../../../chatgpt-auth";
import { getDb, schema } from "../../../../db";
import { decryptActivationCode, encryptActivationCode, generateActivationCode, hashActivationCode } from "../../../../lib/membership/activation-code";
import { isMembershipPlanKey, MEMBERSHIP_PLANS } from "../../../../lib/membership/plans";
import { recordMembershipAdminAction } from "../../../../lib/membership/audit";

async function requireAdmin() {
  const user = await getAppUser();
  return user?.role === "admin" && user.id ? user : null;
}

export async function GET(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
  try {
    const params = new URL(request.url).searchParams;
    const status = params.get("status") ?? "all";
    const packageKey = params.get("package") ?? "all";
    const search = params.get("q")?.trim() ?? "";
    const conditions = [];
    if (["unused", "used", "disabled"].includes(status)) conditions.push(eq(schema.activationCodes.status, status));
    if (isMembershipPlanKey(packageKey)) conditions.push(eq(schema.activationCodes.plan, packageKey));
    if (search) conditions.push(ilike(schema.activationCodes.note, `%${search.slice(0, 80)}%`));
    const db = getDb();
    const query = db.select({
      id: schema.activationCodes.id,
      codeCiphertext: schema.activationCodes.codeCiphertext,
      plan: schema.activationCodes.plan,
      durationDays: schema.activationCodes.durationDays,
      status: schema.activationCodes.status,
      createdAt: schema.activationCodes.createdAt,
      activatedAt: schema.activationCodes.activatedAt,
      activatedByPhone: schema.users.phone,
      note: schema.activationCodes.note,
    }).from(schema.activationCodes)
      .leftJoin(schema.users, eq(schema.activationCodes.activatedByUserId, schema.users.id))
      .orderBy(desc(schema.activationCodes.createdAt))
      .limit(200);
    const rows = await query.where(conditions.length ? and(...conditions) : undefined);
    const items = rows.map(({ codeCiphertext, plan, ...row }) => ({
      ...row,
      packageKey: plan,
      priceCents: isMembershipPlanKey(plan) ? MEMBERSHIP_PLANS[plan].priceCents : 0,
      code: decryptActivationCode(codeCiphertext),
    }));
    const counts = await db.select({ status: schema.activationCodes.status }).from(schema.activationCodes);
    return NextResponse.json({ ok: true, items, stats: { unused: counts.filter((item) => item.status === "unused").length, used: counts.filter((item) => item.status === "used").length, disabled: counts.filter((item) => item.status === "disabled").length } });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("activation_code_encryption_key") ? error.message : "activation_code_service_unavailable";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { packageKey?: unknown; count?: unknown; note?: unknown };
  if (!isMembershipPlanKey(body.packageKey)) return NextResponse.json({ ok: false, error: "membership_package_invalid" }, { status: 400 });
  const count = Number(body.count ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > 100) return NextResponse.json({ ok: false, error: "activation_code_count_invalid" }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : "";
  const plan = MEMBERSHIP_PLANS[body.packageKey];

  try {
    // Validate the key before any database write. The ciphertext lets staff retrieve
    // an unused code later; the hash is the only value used for redemption lookup.
    encryptActivationCode("KEY-CHECK");
    const db = getDb();
    const created: { id: string; codeHash: string; code: string }[] = [];
    for (let attempt = 0; attempt < 8 && created.length < count; attempt += 1) {
      const candidateMap = new Map<string, string>();
      const remaining = count - created.length;
      const candidates = Array.from({ length: Math.min(remaining, 100) }, () => {
        const code = generateActivationCode(body.packageKey as keyof typeof MEMBERSHIP_PLANS);
        const codeHash = hashActivationCode(code);
        candidateMap.set(codeHash, code);
        return { codeHash, codeCiphertext: encryptActivationCode(code), plan: plan.key, durationDays: plan.durationDays, status: "unused", createdBy: user.id!, note: note || null };
      });
      const inserted = await db.insert(schema.activationCodes).values(candidates)
        .onConflictDoNothing({ target: schema.activationCodes.codeHash })
        .returning({ id: schema.activationCodes.id, codeHash: schema.activationCodes.codeHash });
      created.push(...inserted.map((item) => ({ ...item, code: candidateMap.get(item.codeHash)! })));
    }
    if (created.length !== count) return NextResponse.json({ ok: false, error: "activation_code_generation_incomplete" }, { status: 503 });
    await recordMembershipAdminAction(user.id!, "membership_activation_codes_generated", null, { packageKey: plan.key, count: created.length, codeIds: created.map((item) => item.id) });
    return NextResponse.json({ ok: true, items: created.map(({ id, code }) => ({ id, code, packageKey: plan.key, priceCents: plan.priceCents, durationDays: plan.durationDays, status: "unused", note: note || null })) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("activation_code_encryption_key") ? error.message : "activation_code_generation_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
