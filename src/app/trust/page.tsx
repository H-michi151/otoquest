"use client";
import { useState } from "react";
import { trustFilterAnalysis } from "@/lib/mockData";
import { ShieldCheck, ShieldAlert, ShieldX, Search } from "lucide-react";

export default function TrustPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ReturnType<typeof trustFilterAnalysis> | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async (target?: string) => {
    const u = target ?? url;
    if (!u) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setResult(trustFilterAnalysis(u));
    if (target) setUrl(u);
    setLoading(false);
  };

  const getRiskIcon = (risk: string) => {
    if (risk === "low") return <ShieldCheck size={28} color="#10b981" />;
    if (risk === "medium") return <ShieldAlert size={28} color="#fbbf24" />;
    return <ShieldX size={28} color="#ef4444" />;
  };

  const getRiskColor = (risk: string) => {
    if (risk === "low") return "#34d399";
    if (risk === "medium") return "#fbbf24";
    return "#ef4444";
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#f5c842", marginBottom: 4 }}>
          🔮 信頼性フィルター — 悪徳業者判定エンジン
        </h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          購入前にURLを貼り付けると5層の分析で安全性を即座に判定します
        </p>
      </div>

      {/* 5層分析の説明 */}
      <div className="dq-card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>📊 5層スコアリング方式</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            "🏪 ECプラットフォーム信頼性",
            "👤 出品者信頼性",
            "💰 価格妥当性",
            "⭐ レビュー真正性",
            "📋 商品情報整合性",
          ].map((l) => (
            <span key={l} className="badge-blue">{l}</span>
          ))}
        </div>
      </div>

      {/* URL入力 */}
      <div className="dq-card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Search size={20} color="#f5c842" />
          <input
            className="dq-input"
            placeholder="https://... 購入予定のURLを貼り付け"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            style={{ flex: 1 }}
          />
          <button
            className="btn-primary"
            onClick={() => analyze()}
            disabled={loading}
            style={{ whiteSpace: "nowrap" }}
          >
            {loading ? "解析中..." : "🔮 信頼性チェック"}
          </button>
        </div>

        {/* デモサンプル */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>💡 サンプルで試す：</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "✅ Amazon（安全）", url: "https://amazon.co.jp/dp/B09X7N7GY6" },
              { label: "⚠️ 中小EC（注意）", url: "https://gadget-shop-online.jp/item/1234" },
              { label: "🚨 危険サイト", url: "https://free-shop-cheap-pc.xyz/sale" },
            ].map((s) => (
              <button
                key={s.url}
                className="btn-secondary"
                onClick={() => analyze(s.url)}
                style={{ fontSize: 11 }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ローディング */}
      {loading && (
        <div className="dq-card" style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔮</div>
          <div style={{ fontSize: 14, color: "#94a3b8" }}>5層スコアリング解析中...</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
            EC信頼度・出品者履歴・価格妥当性・レビュー・商品情報を確認しています
          </div>
        </div>
      )}

      {/* 結果表示 */}
      {result && !loading && (
        <div className="animate-slide-up">
          {/* 総合スコア */}
          <div
            className="dq-card"
            style={{
              padding: 28,
              marginBottom: 16,
              background:
                result.risk === "low"
                  ? "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(15,23,42,0.95))"
                  : result.risk === "medium"
                  ? "linear-gradient(135deg, rgba(251,191,36,0.1), rgba(15,23,42,0.95))"
                  : "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(15,23,42,0.95))",
              border:
                result.risk === "low"
                  ? "1px solid rgba(16,185,129,0.3)"
                  : result.risk === "medium"
                  ? "1px solid rgba(251,191,36,0.3)"
                  : "1px solid rgba(239,68,68,0.4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {getRiskIcon(result.risk)}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>
                  総合信頼スコア
                </div>
                <div
                  style={{
                    fontSize: 52,
                    fontWeight: 900,
                    color: getRiskColor(result.risk),
                    lineHeight: 1,
                  }}
                >
                  {result.overallScore}
                  <span style={{ fontSize: 20, color: "#64748b" }}>/100</span>
                </div>
              </div>
              <div
                style={{
                  padding: "10px 20px",
                  borderRadius: 30,
                  background:
                    result.risk === "low"
                      ? "rgba(16,185,129,0.2)"
                      : result.risk === "medium"
                      ? "rgba(251,191,36,0.15)"
                      : "rgba(239,68,68,0.2)",
                  border: `1px solid ${getRiskColor(result.risk)}44`,
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    color: getRiskColor(result.risk),
                  }}
                >
                  {result.risk === "low"
                    ? "✅ 安全"
                    : result.risk === "medium"
                    ? "⚠️ 要注意"
                    : "🚨 危険"}
                </div>
              </div>
            </div>

            {result.risk === "high" && (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 16px",
                  background: "rgba(239,68,68,0.1)",
                  borderRadius: 8,
                  border: "1px solid rgba(239,68,68,0.3)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fca5a5" }}>
                  🚨 この購入を強くお勧めしません
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  詐欺・偽造品・フィッシングサイトの可能性が高いため、別の信頼できる販売元で購入してください。
                </div>
              </div>
            )}
          </div>

          {/* 5層詳細 */}
          <div className="dq-card" style={{ padding: 20 }}>
            <div className="section-header">
              <span>📊</span>
              <h2>5層詳細スコア</h2>
            </div>
            {result.layers.map((layer, i) => {
              const pct = layer.score;
              const color =
                layer.score >= 80
                  ? "#34d399"
                  : layer.score >= 60
                  ? "#fbbf24"
                  : "#ef4444";
              return (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 16 }}>{layer.icon}</span>
                      <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>
                        {layer.name}
                      </span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color }}>{layer.score}</span>
                  </div>
                  <div className="hp-bar">
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${color}99, ${color})`,
                        borderRadius: 4,
                        transition: "width 0.8s ease",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    {layer.detail}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
