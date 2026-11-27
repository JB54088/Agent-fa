import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl } from "../db/index.ts";
import { hashPassword } from "../lib/auth/password.ts";

const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const INTERNAL_EMAIL_DOMAIN = "accounts.school-recruitment-radar.invalid";

/**
 * One-time production initializer. It deliberately accepts credentials only
 * from the process environment and stores the password as a PBKDF2 hash.
 * Remove ADMIN_INITIAL_PASSWORD_1 after the initializer has completed.
 */
async function main() {
  const phone = (process.env.ADMIN_PHONE_1 ?? "").replace(/\s+/g, "");
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD_1 ?? "";
  const name = (process.env.ADMIN_NAME_1 ?? "校招雷达管理员").trim().slice(0, 80) || "校招雷达管理员";

  if (!PHONE_PATTERN.test(phone)) throw new Error("ADMIN_PHONE_1 必须是中国大陆 11 位手机号。");
  if (!initialPassword) throw new Error("ADMIN_INITIAL_PASSWORD_1 未配置。");

  const sql = neon(getDatabaseUrl());
  const existing = await sql`
    SELECT id::text AS id
    FROM users
    WHERE phone = ${phone}
    LIMIT 1
  `;
  const account = existing[0] as { id?: string } | undefined;
  const passwordHash = await hashPassword(initialPassword);

  if (account?.id) {
    await sql.transaction([
      sql`UPDATE users
          SET role = 'admin', password_hash = ${passwordHash}, name = ${name}, status = 'active', updated_at = now()
          WHERE id = ${account.id}`,
      sql`INSERT INTO admin_users (user_id, role, created_at, updated_at)
          VALUES (${account.id}, 'admin', now(), now())
          ON CONFLICT (user_id) DO UPDATE SET role = 'admin', updated_at = now()`,
    ]);
    console.log("管理员账号已幂等升级，密码仅保存为哈希。");
    return;
  }

  const id = randomUUID();
  await sql.transaction([
    sql`INSERT INTO users (id, email, phone, password_hash, role, name, status, created_at, updated_at)
        VALUES (${id}, ${`${phone}@${INTERNAL_EMAIL_DOMAIN}`}, ${phone}, ${passwordHash}, 'admin', ${name}, 'active', now(), now())`,
    sql`INSERT INTO admin_users (user_id, role, created_at, updated_at)
        VALUES (${id}, 'admin', now(), now())`,
  ]);
  console.log("管理员账号已创建，密码仅保存为哈希。");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "管理员初始化失败");
  process.exitCode = 1;
});
