import { getDb, schema } from "../../db";

export async function recordMembershipAdminAction(actorId: string, action: string, entityId: string | null, afterData: Record<string, unknown>) {
  try {
    await getDb().insert(schema.adminAuditLogs).values({
      actorId,
      action,
      entityType: "membership_activation_code",
      entityId,
      afterData,
    });
  } catch {
    // Membership transactions remain authoritative; an unavailable optional admin
    // audit table must not undo an already committed code operation.
    console.warn("[membership] admin audit log unavailable");
  }
}
