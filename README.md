# 校招雷达

面向应届毕业生的招聘信息聚合与提醒平台第一版。当前版本以“演示数据”运行，已覆盖招聘总览、筛选、专业规则匹配、详情、收藏、报名状态、日历、消息中心、求职资料和管理员看板等核心体验。

## Prerequisites

- Node.js `>=22.13.0`

## 快速启动

```bash
npm install
npm run dev
npm run build
# 可选：检查演示数据映射
npm run db:seed
```

当前页面使用可配置的 `siteConfig.name`，后续接入 `system_configs` 后可以在管理员后台修改产品名称、重点毕业年份和即将截止阈值。

## 已包含

- `app/data.ts`：20 条虚构演示招聘项目、匹配规则、站点配置和消息
- `app/page.tsx`：响应式前台与演示管理员后台
- `app/globals.css`：移动端优先的卡片式视觉系统
- `db/schema.ts`：PostgreSQL + Drizzle 数据表、枚举与索引
- `drizzle/0000_initial_school_radar.sql`：首个迁移文件
- `docs/product-design.md`：产品信息架构、ER、字段、API 和任务拆分
- `.env.example`：数据库、认证和通知服务配置示例

## 第一版测试流程

1. 打开首页，点击“查看近期招聘”。
2. 搜索“计算机”，勾选筛选中的“只看与我匹配”。
3. 打开任意项目，查看“明确匹配 / 专业大类匹配 / 不限专业”等结果。
4. 收藏项目，在“我的招聘”中更新报名状态并添加备注。
5. 打开“招聘日历”，点击“报名截止”或“开始报名”事件。
6. 打开“求职资料”，修改专业或地区，返回总览观察匹配数量变化。
7. 打开“管理员后台”，查看来源健康度和系统配置演示。

当前演示账号为前端本地状态，不代表真实认证。真实账号、权限和持久化能力按照 `docs/product-design.md` 的 API 和数据库设计接入。

## 管理员测试账号创建方式

生产环境创建管理员时，应先创建 `users` 记录，再在事务中写入 `admin_users(user_id, role)`；禁止在前端暴露管理员密钥。建议首个管理员通过一次性 CLI 或受保护的部署脚本创建：

```sql
INSERT INTO admin_users (user_id, role) VALUES ('<已验证用户 UUID>', 'owner');
```

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
