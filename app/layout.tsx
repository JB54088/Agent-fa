import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "./data";

export const metadata: Metadata = {
  title: `${siteConfig.name} · ${siteConfig.homeTitle}`,
  description: siteConfig.marketingCopy,
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
