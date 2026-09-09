type AdminIdentity = {
  id?: string | null;
  role?: string | null;
};

/**
 * The caller must already have been resolved by getAppUser, which validates
 * the signed app session and active database account. This helper keeps the
 * role boundary identical across admin pages and moderation APIs.
 */
export function hasAdminRole(user: AdminIdentity | null | undefined): user is AdminIdentity & { id: string; role: "admin" } {
  return typeof user?.id === "string" && user.id.length > 0 && user.role === "admin";
}
