import Link from "next/link";
import ForgotPasswordClient from "./forgot-password-client";
import { isPasswordResetEnabled } from "../../lib/auth/password-reset";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  if (!isPasswordResetEnabled()) {
    return <main className="login-page">
      <section className="login-page-card" aria-labelledby="forgot-password-title">
        <div className="login-page-card-topline"><span>校招雷达</span><span className="login-page-secure-pill"><i />账户安全</span></div>
        <div className="login-page-brand"><div className="brand-mark"><span>⌁</span></div><div><strong>校招雷达</strong><small>校园招聘信息雷达</small></div></div>
        <div className="login-page-heading">
          <span className="eyebrow"><i />密码找回</span>
          <h1 id="forgot-password-title">忘记密码</h1>
          <p>短信验证服务正在准备中，开通后即可通过注册手机号重置密码。</p>
        </div>
        <p className="login-mode-switch"><Link href="/login">返回登录</Link></p>
      </section>
    </main>;
  }

  return <ForgotPasswordClient />;
}
