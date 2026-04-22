"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * onboarding未完了ユーザーを /onboarding へリダイレクト。
 * /onboarding ページ自体はリダイレクト対象外。
 * SSR非対応のため useEffect 内でのみ localStorage を参照。
 */
export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // /onboarding 自体はスキップ
    if (pathname === "/onboarding") return;
    const done = localStorage.getItem("otoquest_onboarded");
    if (!done) {
      router.replace("/onboarding");
    }
  }, [pathname, router]);

  return <>{children}</>;
}
