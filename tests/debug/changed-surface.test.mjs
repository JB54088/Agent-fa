/**
 * 调试用例：未提交改动的回归守卫。
 *
 * 覆盖本轮 5 个未提交文件的契约面。仓库没有安装 React/DOM/浏览器测试工具，路由的行为验证
 * 又需要 build + 管理员会话 + 数据库，因此这里用源码级契约断言。凡属源码级断言，测试名里都
 * 注明，避免被误读成端到端验证。
 *
 * 只读：不修改任何生产文件，不打网络，不连数据库。
 */
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const readSource = (relativePath) => readFile(path.join(projectRoot, relativePath), "utf8");

/** 从 TS 源码里取出字符串数组字面量，兼容 `X = [...]` 与 `X = new Set([...])` 两种写法。 */
function extractStringArray(source, identifier) {
  const match = source.match(new RegExp(`${identifier}\\s*=\\s*(?:new\\s+Set\\s*\\()?\\[([\\s\\S]*?)\\]`));
  if (!match) return null;
  return [...match[1].matchAll(/"([^"]*)"|'([^']*)'/g)].map((item) => item[1] ?? item[2]);
}

const sorted = (values) => [...values].sort();

// ---------------------------------------------------------------------------
// app/api/admin/initial-sync/progress/route.ts —— "request is not defined" 修复
// ---------------------------------------------------------------------------

test("源码契约：initial-sync progress 的 GET 必须声明 request 参数（旧代码 GET() 会 ReferenceError）", async () => {
  const source = await readSource("app/api/admin/initial-sync/progress/route.ts");

  const handlers = [...source.matchAll(/export\s+async\s+function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g)];
  assert.ok(handlers.length > 0, "未找到导出的路由处理函数");

  for (const [whole, name, params] of handlers) {
    const bodyStart = whole.length + source.indexOf(whole);
    const rest = source.slice(bodyStart);
    const nextExport = rest.indexOf("export ");
    const body = nextExport === -1 ? rest : rest.slice(0, nextExport);
    if (/\brequest\s*\./.test(body)) {
      assert.match(params, /\brequest\b/, `${name} 的函数体读取了 request.，但签名 (${params.trim()}) 未声明该参数`);
    }
  }
});

test("源码契约：progress 路由把 ?scope=target_100 映射到 TARGET_100_OFFICIAL_AUDIT", async () => {
  const source = await readSource("app/api/admin/initial-sync/progress/route.ts");
  assert.match(source, /searchParams\.get\("scope"\)\s*===\s*"target_100"/, "scope 参数必须被解析");
  assert.match(source, /"TARGET_100_OFFICIAL_AUDIT"/, "target_100 作用域必须返回对应 mode");
  assert.match(source, /"INITIAL_SYNC"/, "默认作用域必须返回 INITIAL_SYNC");
});

// ---------------------------------------------------------------------------
// app/globals.css —— 模态框规则被删除后"下架看起来没反应"的回归
// ---------------------------------------------------------------------------

test("globals.css：modal-backdrop / small-modal / login-modal 的定位规则必须存在（历史上被删过一次）", async () => {
  const css = await readSource("app/globals.css");
  const required = [
    [".modal-backdrop { position: fixed", "缺少遮罩层定位，模态框会掉进正常文档流"],
    [".modal-close { position: absolute", "缺少关闭按钮定位"],
    [".small-modal { position: relative", "缺少下架/删除模态框卡片"],
    [".login-modal { position: relative", "缺少登录模态框卡片"],
    [".external-icon { display: grid", "缺少模态框图标样式"],
  ];
  const missing = required.filter(([fragment]) => !css.includes(fragment)).map(([fragment, why]) => `${fragment} —— ${why}`);
  assert.deepEqual(missing, [], `globals.css 缺少必要规则：\n${missing.join("\n")}`);
});

test("globals.css：发布表格操作列的吸顶规则与移动端取消规则必须成对存在", async () => {
  const css = await readSource("app/globals.css");
  assert.ok(
    css.includes(".published-table .published-admin-row > span:last-child { position: sticky"),
    "缺少操作列吸顶规则，「下架」按钮会落在可视区之外",
  );
  assert.ok(
    css.includes(".published-admin-row > span:last-child { position: static"),
    "移动端缺少吸顶取消规则（@media max-width: 680px）",
  );
  assert.ok(css.includes(".published-actions"), "存在语义类 .published-actions 可供选择器使用");
});

test("跨文件契约：吸顶规则依赖「操作列是行内最后一个带 data-label 的 span」，且该 span 带 published-actions", async () => {
  const source = await readSource("app/admin-console.tsx");

  const rowStart = source.indexOf('<div className="published-admin-row" key={item.id}>');
  assert.ok(rowStart > -1, "未找到发布表格的数据行模板");
  const rowEnd = source.indexOf("</div>; })}", rowStart);
  assert.ok(rowEnd > rowStart, "未找到数据行模板的结束位置");
  const rowMarkup = source.slice(rowStart, rowEnd);

  const labeledCells = [...rowMarkup.matchAll(/<span className="([^"]*)" data-label="([^"]*)"/g)].map((item) => ({
    className: item[1],
    label: item[2],
  }));

  assert.ok(labeledCells.length > 0, "数据行未找到带 data-label 的单元格");
  const lastCell = labeledCells.at(-1);
  assert.equal(lastCell.label, "操作", "行内最后一个带 data-label 的单元格应为「操作」列，否则 CSS 的 :last-child 吸顶会指向错误的列");
  assert.match(lastCell.className, /published-actions/, "操作列应带语义类 published-actions，CSS 却依赖 :last-child 结构选择器");
});

// ---------------------------------------------------------------------------
// 客户端原因清单 vs 服务端白名单
// ---------------------------------------------------------------------------

test("跨文件契约：下架/永久删除原因清单在客户端与服务端必须一致", async () => {
  const [consoleSource, routeSource] = await Promise.all([
    readSource("app/admin-console.tsx"),
    readSource("app/api/admin/opportunities/route.ts"),
  ]);

  const pairs = [
    ["OFFLINE_REASON_OPTIONS", "OFFLINE_REASONS", "下架原因"],
    ["PERMANENT_DELETE_REASON_OPTIONS", "PERMANENT_DELETE_REASONS", "永久删除依据"],
  ];

  for (const [clientName, serverName, label] of pairs) {
    const client = extractStringArray(consoleSource, clientName);
    const server = extractStringArray(routeSource, serverName);
    assert.ok(client, `未能在客户端解析出 ${clientName}`);
    assert.ok(server, `未能在服务端解析出 ${serverName}`);
    assert.deepEqual(sorted(client), sorted(server), `${label}清单在 app/admin-console.tsx 与 app/api/admin/opportunities/route.ts 之间已漂移`);
  }
});

test("跨文件契约：服务端已通过 API 下发权威原因清单，客户端无需硬编码副本", async () => {
  const routeSource = await readSource("app/api/admin/opportunities/route.ts");
  assert.match(routeSource, /offlineReasons:\s*OFFLINE_REASONS/, "服务端应下发 offlineReasons");
  assert.match(routeSource, /permanentDeleteReasons:\s*\[\.\.\.PERMANENT_DELETE_REASONS\]/, "服务端应下发 permanentDeleteReasons");
});

// ---------------------------------------------------------------------------
// package.json —— 测试脚本覆盖面
// ---------------------------------------------------------------------------

test("package.json：npm test 必须覆盖 tests/ 下所有 *.test.mjs 文件", async () => {
  const manifest = JSON.parse(await readSource("package.json"));
  const testScript = manifest.scripts?.test ?? "";
  // debug-* 是为本次排查单独新增的独立套件，刻意不接入 npm test（它会先跑一次完整 build），
  // 因此这里只校验常规套件的覆盖面。
  const files = (await readdir(path.join(projectRoot, "tests")))
    .filter((name) => name.endsWith(".test.mjs") && !name.startsWith("debug-"))
    .sort();

  assert.ok(files.length > 0, "tests/ 下没有测试文件");
  const omitted = files.filter((name) => !testScript.includes(`tests/${name}`));
  assert.deepEqual(omitted, [], `以下测试文件已存在但 npm test 不会执行：${omitted.join(", ")}`);
});

test("package.json：allowScripts 里钉住的版本必须与 node_modules 实际安装版本一致，否则清单已腐坏", async () => {
  const manifest = JSON.parse(await readSource("package.json"));
  const allowScripts = manifest.allowScripts ?? {};
  const packages = [...new Set(Object.keys(allowScripts).map((key) => key.split("@")[0]))];

  const stale = [];
  for (const name of packages) {
    let installed;
    try {
      installed = JSON.parse(await readFile(path.join(projectRoot, "node_modules", name, "package.json"), "utf8")).version;
    } catch {
      continue; // 传递依赖未提升到顶层时无法核对，跳过而不是误报
    }
    if (!Object.hasOwn(allowScripts, `${name}@${installed}`)) stale.push(`${name}: 已安装 ${installed}，但 allowScripts 中未列出该版本`);
  }
  assert.deepEqual(stale, [], `allowScripts 白名单已与实际依赖脱节：\n${stale.join("\n")}`);
});
