import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl } from "../db/index.ts";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../lib/auth/password.ts";

const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const INTERNAL_EMAIL_DOMAIN = "accounts.school-recruitment-radar.invalid";

function configuredAdminPhones() {
  return [process.env.ADMIN_PHONE_1, process.env.ADMIN_PHONE_2, process.env.ADMIN_PHONE_3]
    .map((phone) => (phone ?? "").replace(/\s+/g, ""))
    .filter(Boolean);
}

async function ask(prompt: string) {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(prompt)).trim();
  } finally {
    rl.close();
  }
}

async function askSecret(prompt: string) {
  if (!input.isTTY || typeof input.setRawMode !== "function") return ask(prompt);
  output.write(prompt);
  input.setRawMode(true);
  input.resume();
  return await new Promise<string>((resolve, reject) => {
    let value = "";
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("cancelled"));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          output.write("\n");
          resolve(value);
          return;
        }
        if (character === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= " ") value += character;
      }
    };
    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode?.(false);
      input.pause();
    };
    input.on("data", onData);
  });
}

async function main() {
  const phone = (await ask("请输入管理员手机号：")).replace(/\s+/g, "");
  if (!PHONE_PATTERN.test(phone)) throw new Error("手机号格式不正确，应为中国大陆 11 位手机号。");
  const adminPhones = configuredAdminPhones();
  if (adminPhones.length === 3 && new Set(adminPhones).size === 3 && !adminPhones.includes(phone)) throw new Error("该手机号不在 ADMIN_PHONE_1..3 管理员白名单中。");
  const password = await askSecret("请输入管理员密码：");
  if (password.length < PASSWORD_MIN_LENGTH) throw new Error(`密码至少需要 ${PASSWORD_MIN_LENGTH} 位。`);
  const name = (await ask("请输入管理员姓名（可选）：")).slice(0, 80) || null;
  const sql = neon(getDatabaseUrl());
  const existing = await sql`
    SELECT u.id::text AS id, u.role, u.name, a.user_id::text AS admin_user_id
    FROM users u
    LEFT JOIN admin_users a ON a.user_id = u.id
    WHERE u.phone = ${phone}
    LIMIT 1
  `;
  const account = existing[0] as { id?: string; role?: string; name?: string | null; admin_user_id?: string | null } | undefined;
  if (account?.id && (account.role === "admin" || account.admin_user_id)) {
    console.log("该手机号已经是管理员账号，无需重复创建。");
    return;
  }
  const passwordHash = await hashPassword(password);
  if (account?.id) {
    const confirmation = await ask("该手机号已是 customer。若确认将其升级为管理员，请输入 UPGRADE：");
    if (confirmation !== "UPGRADE") {
      console.log("未执行任何升级，原 customer 账号保持不变。");
      return;
    }
    await sql.transaction([
      sql`UPDATE users SET role = 'admin', password_hash = ${passwordHash}, name = COALESCE(${name}, name), updated_at = now() WHERE id = ${account.id}`,
      sql`INSERT INTO admin_users (user_id, role, created_at, updated_at) VALUES (${account.id}, 'admin', now(), now()) ON CONFLICT (user_id) DO NOTHING`,
    ]);
  } else {
    const id = randomUUID();
    const email = `${phone}@${INTERNAL_EMAIL_DOMAIN}`;
    await sql.transaction([
      sql`INSERT INTO users (id, email, phone, password_hash, role, name, status, created_at, updated_at) VALUES (${id}, ${email}, ${phone}, ${passwordHash}, 'admin', ${name}, 'active', now(), now())`,
      sql`INSERT INTO admin_users (user_id, role, created_at, updated_at) VALUES (${id}, 'admin', now(), now())`,
    ]);
  }
  console.log(`管理员创建成功\n手机号：${phone}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "管理员创建失败");
  process.exitCode = 1;
});
