import fs from "node:fs";

const targets = [
  "app/data.ts",
  "app/page.tsx",
  "app/admin-console.tsx",
  "db/seed.ts",
  "app/api/health/route.ts",
  "README.md",
];

const suspiciousPatterns = [
  /example\.com/gi,
  /演示数据/g,
  /模拟后台/g,
  /demoOnly\s*:\s*true/g,
  /mode:\s*["']demo["']/g,
];

const findings = [];
for (const file of targets) {
  const content = fs.readFileSync(file, "utf8");
  for (const pattern of suspiciousPatterns) {
    const matches = content.match(pattern);
    if (matches?.length) findings.push({ file, pattern: pattern.source, count: matches.length });
  }
}

console.table(findings);
if (process.argv.includes("--confirm")) {
  if (findings.length) {
    throw new Error("发现生产路径中的模拟数据引用；请先人工确认具体目标，再执行定向清理。此脚本不会对业务表做盲删。");
  }
  console.log("生产路径未发现模拟数据引用，无需清理。");
} else {
  console.log("dry-run：未修改任何文件。使用 --confirm 只会在审计通过后确认无残留，不执行广泛删除。");
}
