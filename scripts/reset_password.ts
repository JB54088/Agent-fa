import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl } from "../db/index.ts";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../lib/auth/password.ts";

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

async function ask(prompt: string) {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(prompt)).trim();
  } finally {
    rl.close();
  }
}

async function main() {
  const phone = (await ask("请输入手机号：")).replace(/\s+/g, "");
  if (!PHONE_PATTERN.test(phone)) throw new Error("手机号格式不正确，应为中国大陆 11 位手机号。");
  const password = await ask("请输入新密码：");
  if (password.length < PASSWORD_MIN_LENGTH) throw new Error(`密码至少需要 ${PASSWORD_MIN_LENGTH} 位。`);
  const confirmation = await ask("请再次输入新密码：");
  if (password !== confirmation) throw new Error("两次密码不一致。");
  const sql = neon(getDatabaseUrl());
  const passwordHash = await hashPassword(password);
  const updated = await sql`UPDATE users SET password_hash = ${passwordHash}, updated_at = now() WHERE phone = ${phone} RETURNING id`;
  if (!updated.length) throw new Error("未找到该手机号对应的账号。");
  console.log(`密码重置成功\n手机号：${phone}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "密码重置失败");
  process.exitCode = 1;
});
