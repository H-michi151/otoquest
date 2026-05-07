"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  // ログイン済みなら /dashboard（マイページ）へ
  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) return null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #06b6d4 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
    }}>
      <div style={{
        width: "100%", maxWidth: 420,
        background: "white", borderRadius: 24,
        padding: "48px 40px",
        boxShadow: "0 30px 80px rgba(0,0,0,0.2)",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🗡️</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#1e293b", marginBottom: 8 }}>
          オトクエスト
        </h1>
        <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, marginBottom: 36 }}>
          スマート購買最適化プラットフォーム<br />
          ログインして最安値・最大ポイントを手に入れよう
        </p>

        <button
          id="google-login-btn"
          onClick={signInWithGoogle}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 12,
            border: "1px solid #e2e8f0", background: "white",
            color: "#374151", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            transition: "box-shadow 0.15s, transform 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.14)";
            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
            (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Googleでログイン
        </button>

        <p style={{ marginTop: 24, fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
          ログインすることで、利用規約およびプライバシーポリシーに同意したものとみなされます。
        </p>
      </div>
    </div>
  );
}
