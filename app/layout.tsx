import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "校招雷达 · 不错过每一次校招机会",
  description: "面向应届毕业生的校园招聘信息聚合与提醒平台。",
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
