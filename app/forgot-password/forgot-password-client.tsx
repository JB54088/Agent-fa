"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import styles from "../login/login.module.css";

const errors: Record<string, string> = {
  password_reset_not_enabled: "短信验证服务尚未开通，请稍后再试。",
  invalid_mainland_phone: "请输入正确的中国大陆手机号。",
  sms_service_unavailable: "短信服务暂不可用，请稍后再试。",
  password_reset_unavailable: "暂时无法完成操作，请稍后重试。",
  verification_code_invalid_or_expired: "验证码错误、已过期或已使用，请重新获取。",
  password_too_short: "新密码至少需要 8 位。",
  password_confirmation_mismatch: "两次输入的新密码不一致。",
};

export default function ForgotPasswordClient() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeStep, setCodeStep] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    setError("");
    setNotice("");
    setSending(true);
    try {
      const response = await fetch("/api/auth/password-reset/send-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "password_reset_unavailable");
      setCodeStep(true);
      setCooldown(60);
      setNotice(payload.message ?? "如果该手机号已注册，验证码已发送；请在5分钟内完成验证。");
    } catch (cause) {
      const key = cause instanceof Error ? cause.message : "password_reset_unavailable";
      setError(errors[key] ?? "暂时无法发送验证码，请稍后重试。");
    } finally {
      setSending(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!/^\d{6}$/.test(code.trim())) {
      setError("请输入短信中的6位数字验证码。");
      return;
    }
    if (newPassword.length < 8) {
      setError(errors.password_too_short);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(errors.password_confirmation_mismatch);
      return;
    }

    setResetting(true);
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code: code.trim(), newPassword, confirmPassword }),
      });
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "password_reset_unavailable");
      setNotice("密码重置成功，正在跳转登录页…");
      window.setTimeout(() => window.location.assign("/login"), 900);
    } catch (cause) {
      const key = cause instanceof Error ? cause.message : "password_reset_unavailable";
      setError(errors[key] ?? "暂时无法重置密码，请稍后重试。");
    } finally {
      setResetting(false);
    }
  }

  return <main className="login-page">
    <div className="login-page-orb login-page-orb-one" aria-hidden="true" />
    <div className="login-page-orb login-page-orb-two" aria-hidden="true" />
    <section className="login-page-card" aria-labelledby="forgot-password-title">
      <div className="login-page-card-topline"><span>校招雷达</span><span className="login-page-secure-pill"><i />账户安全</span></div>
      <div className="login-page-brand"><div className="brand-mark"><span>⌁</span></div><div><strong>校招雷达</strong><small>校园招聘信息雷达</small></div></div>
      <div className="login-page-heading">
        <span className="eyebrow"><i />密码找回</span>
        <h1 id="forgot-password-title">重置登录密码</h1>
        <p>验证注册手机号后，即可设置新密码。</p>
      </div>
      <form className="login-page-form forgot-password-form" onSubmit={resetPassword}>
        <div className="login-field">
          <div className="login-field-label"><label htmlFor="reset-phone">手机号</label><span>中国大陆</span></div>
          <div className="login-input-wrap"><span className="login-input-prefix">+86</span><input id="reset-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="请输入注册手机号" inputMode="tel" autoComplete="tel" required /></div>
        </div>
        {!codeStep ? <button className={`primary-button login-submit ${styles.resetSendButton}`} type="button" onClick={() => void sendCode()} disabled={sending || !phone.trim()}>{sending ? "正在发送…" : "获取验证码"}</button> : <>
          <div className="login-field">
            <div className="login-field-label"><label htmlFor="reset-code">短信验证码</label><button className={styles.resetResend} type="button" onClick={() => void sendCode()} disabled={sending || cooldown > 0}>{sending ? "正在发送…" : cooldown > 0 ? `${cooldown}秒后重新获取` : "重新获取验证码"}</button></div>
            <input id="reset-code" className={styles.resetCode} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="请输入6位验证码" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
          </div>
          <div className="login-field">
            <div className="login-field-label"><label htmlFor="reset-new-password">新密码</label><span>至少8位</span></div>
            <input id="reset-new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="请输入新密码" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div className="login-field">
            <div className="login-field-label"><label htmlFor="reset-confirm-password">确认新密码</label><span>再次输入</span></div>
            <input id="reset-confirm-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="请再次输入新密码" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <button className="primary-button login-submit" type="submit" disabled={resetting} aria-busy={resetting}>{resetting ? "正在重置…" : "重置密码"} <span>→</span></button>
        </>}
        {error && <p className="login-error" role="alert">{error}</p>}
        {notice && <p className={styles.resetNotice} role="status">{notice}</p>}
      </form>
      <p className="login-mode-switch"><span>想起密码了？</span><Link href="/login">返回登录</Link></p>
      <p className="login-page-footnote">验证码5分钟内有效；每个手机号每小时最多获取5次。</p>
    </section>
  </main>;
}
