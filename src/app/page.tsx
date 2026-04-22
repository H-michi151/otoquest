"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ルートページ（/）は /login へ即リダイレクト。
 * AppShell の認証チェックより前に確実に飛ばすため、
 * useEffect ではなく即 replace する。
 */
export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}
