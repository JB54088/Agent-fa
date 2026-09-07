import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html", ...(init.headers ?? {}) }, ...init }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("anonymous visitors are redirected to the login entry", async () => {
  const response = await render();
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location") ?? "", "http://localhost").pathname, "/login");
  assert.equal(new URL(response.headers.get("location") ?? "", "http://localhost").searchParams.get("returnTo"), "/");
});

test("the public login entry contains no recruitment data", async () => {
  const response = await render("/login");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /校招雷达/);
  assert.match(html, /手机号登录/);
  assert.doesNotMatch(html, /招聘信息来源于公开渠道|招聘标题|官方报名/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
});

test("anonymous business APIs require the app session", async () => {
  for (const pathname of ["/api/opportunities", "/api/major-directory?q=计算机", "/api/admin/bootstrap"]) {
    const response = await render(pathname);
    assert.equal(response.status, 401, pathname);
    const payload = await response.json();
    assert.equal(payload.error, "authentication_required", pathname);
  }
});

test("anonymous direct business routes redirect before rendering", async () => {
  for (const pathname of ["/jobs", "/opportunities", "/calendar", "/admin", "/profile"]) {
    const response = await render(pathname);
    assert.equal(response.status, 307, pathname);
    assert.equal(new URL(response.headers.get("location") ?? "", "http://localhost").pathname, "/login", pathname);
  }
});

test("starter preview surface is removed", async () => {
  await assert.rejects(access(new URL("../app/_sites-preview/", import.meta.url)));
});
