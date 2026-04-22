import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "オトクエスト - スマート購買最適化プラットフォーム",
  description: "AIが最安値・ポイント還元を自動最大化。悪徳業者フィルター・注文一元管理・冒険者ギルドを搭載した次世代購買プラットフォーム。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-grid-pattern">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
