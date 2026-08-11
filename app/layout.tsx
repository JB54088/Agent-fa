import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 数据治理智能诊断中心",
  description: "基于元数据与数据血缘的智能数据质量诊断与根因分析",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
