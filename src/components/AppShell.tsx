"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import WatchlistPanel from "@/components/WatchlistPanel";

/**
 * AppShell 認証チェック優先順位:
 *   1. loading 中 → 何も表示しない
 *   2. 未ログイン → /login へリダイレクト
 *   3. ログイン済み・otoquest_onboarded なし → /onboarding へリダイレクト
 *   4. ログイン済み・onboarded あり → 通常表示
 *
 * 除外ページ（チェック対象外）: /login, /onboarding
 * SSR 非対応: useEffect 内で localStorage を参照
 */

const EXCLUDED_PATHS = ["/login", "/onboarding"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const isExcluded = EXCLUDED_PATHS.includes(pathname);

  useEffect(() => {
    // 除外ページはガードをスキップ
    if (isExcluded) return;

    // Auth がロード中は待機
    if (loading) return;

    // 未ログイン → /login
    if (!user) {
      router.replace("/login");
      return;
    }

    // ログイン済み・onboarding 未完了 → /onboarding
    const done = localStorage.getItem("otoquest_onboarded");
    if (!done) {
      router.replace("/onboarding");
    }
  }, [pathname, isExcluded, loading, user, router]);

  // /login・/onboarding: Sidebar・Header なし、フルスクリーン
  if (isExcluded) {
    return <>{children}</>;
  }

  // Auth ロード中 または リダイレクト待ち → 何も描画しない（フラッシュ防止）
  if (loading || !user) return null;

  // ログイン済みでも onboarding 未完了なら何も描画しない
  if (typeof window !== "undefined" && !localStorage.getItem("otoquest_onboarded")) {
    return null;
  }

  // 通常レイアウト
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
        <WatchlistPanel />
      </div>
    </div>
  );
}
