import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
