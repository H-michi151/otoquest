"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", icon: "🏠", label: "マイページ", sub: "ダッシュボード" },
  { href: "/compare", icon: "💰", label: "価格比較", sub: "実質価格・最安判定" },
  { href: "/search",    icon: "⚔️", label: "商品検索",       sub: "最安値・最適購入" },
  { href: "/cards", icon: "💳", label: "カード管理", sub: "クレカ最適化" },
  { href: "/matrix", icon: "📊", label: "還元率マトリクス", sub: "28パターン比較" },
  { href: "/orders", icon: "📦", label: "注文管理", sub: "発送追跡" },
  { href: "/history", icon: "💚", label: "購入履歴・節約額", sub: "節約実績" },
  { href: "/campaigns", icon: "🎯", label: "キャンペーン", sub: "自動エントリー" },
  { href: "/settings", icon: "⚙️", label: "設定", sub: "還元率・予算ライン" },
  { href: "/trust", icon: "🛡️", label: "信頼フィルター", sub: "悪徳業者判定" },
  { href: "/api-test", icon: "🔗", label: "API接続テスト", sub: "楽天リアルデータ" },
  { href: "/guild", icon: "🏚️", label: "モンスターハウス", sub: "モンスター・バトル" },
];


export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        background: "#ffffff",
        borderRight: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        boxShadow: "1px 0 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* ロゴ */}
      <div
        style={{
          padding: "20px 16px 16px",
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>🗡️</span>
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 900,
                color: "#1e40af",
                letterSpacing: "0.04em",
              }}
            >
              オトクエスト
            </div>
            <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: "0.1em", marginTop: 1 }}>
              SMART PURCHASE OPTIMIZER
            </div>
          </div>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav style={{ flex: 1, padding: "10px 8px" }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 8,
                marginBottom: 2,
                textDecoration: "none",
                background: isActive ? "#eff6ff" : "transparent",
                borderLeft: isActive ? "3px solid #1e40af" : "3px solid transparent",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "#f8fafc";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }
              }}
            >
              <span style={{ fontSize: 16, minWidth: 22, textAlign: "center" }}>
                {item.icon}
              </span>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#1e40af" : "#374151",
                  }}
                >
                  {item.label}
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>{item.sub}</div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* フッター */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #f1f5f9",
          background: "#fafafa",
        }}
      >
        <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center" }}>
          Phase 1 - 社内利用版 v1.0（デモ）
        </div>
      </div>
    </aside>
  );
}
