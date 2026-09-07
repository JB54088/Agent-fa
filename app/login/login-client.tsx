"use client";

import { useState, type FormEvent } from "react";

type Mode = "login" | "register";

const errorMessages: Record<string, string> = {
  invalid_mainland_phone: "请输入正确的中国大陆手机号",
  password_too_short: "密码至少需要 8 位",
  password_confirmation_mismatch: "两次密码不一致",
  phone_already_registered: "该手机号已经注册，请直接登录",
  invalid_credentials: "手机号或密码错误",
  role_must_not_be_submitted: "注册请求不允许提交角色",
};

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function LoginPageClient({ initialMode = "login" }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "register" ? { phone, password, confirmPassword, name } : { phone, password }),
      });
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? (mode === "register" ? "注册失败" : "登录失败"));
      const destination = safeReturnTo(new URLSearchParams(window.location.search).get("returnTo"));
      window.location.assign(destination);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "操作失败，请稍后重试";
      setError(errorMessages[message] ?? message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-page-card" aria-labelledby="login-page-title">
        <div className="login-page-brand">
          <div className="brand-mark"><span>⌁</span></div>
          <div><strong>校招雷达</strong><small>校园招聘信息雷达</small></div>
        </div>
        <div className="login-page-heading">
          <span className="eyebrow"><i />安全登录</span>
          <h1 id="login-page-title">{mode === "login" ? "欢迎回到校招雷达" : "注册校招雷达"}</h1>
          <p>{mode === "login" ? "登录后查看招聘机会、收藏项目并接收截止提醒。" : "注册后默认成为普通求职者账号，管理员权限由后台统一管理。"}</p>
        </div>
        <div className="login-tabs" role="tablist" aria-label="账号操作">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>手机号登录</button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>注册账号</button>
        </div>
        <form onSubmit={submit} className="login-page-form">
          <label className="login-field"><span>手机号</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="请输入中国大陆手机号" inputMode="tel" autoComplete="tel" required /></label>
          {mode === "register" && <label className="login-field"><span>姓名/昵称（可选）</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="请输入姓名或昵称" autoComplete="name" /></label>}
          <label className="login-field"><span>密码</span><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>
          {mode === "register" && <label className="login-field"><span>确认密码</span><input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="请再次输入密码" type="password" autoComplete="new-password" required /> </label>}
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? "处理中…" : mode === "login" ? "登录并继续" : "注册并登录"} <span>→</span></button>
        </form>
        <p className="login-page-footnote">招聘内容、搜索和平台业务数据仅对已登录账号开放。</p>
      </section>
    </main>
  );
}
