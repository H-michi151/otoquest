"use client";
import { creditCards } from "@/lib/mockData";
import { useState } from "react";

export default function CardsPage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#f5c842", marginBottom: 4 }}>
          💳 クレジットカード管理 — ライフサイクル最適化
        </h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          保有カードの還元率・キャンペーン期限・解約推奨をAIが自動管理
        </p>
      </div>

      {/* サマリー */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "保有カード数", value: `${creditCards.length}枚`, color: "#e2e8f0" },
          { label: "今月の還元合計", value: "¥3,240", color: "#34d399" },
          { label: "キャンペーン中", value: `${creditCards.filter(c => c.status === "campaign").length}枚`, color: "#f5c842" },
          { label: "解約推奨", value: `${creditCards.filter(c => c.recommendation === "cancel").length}枚`, color: "#ef4444" },
        ].map((s) => (
          <div key={s.label} className="dq-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: "#64748b" }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* カード一覧 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {creditCards.map((card) => (
          <div
            key={card.id}
            className={card.recommendation === "cancel" ? "dq-card dq-card-danger" : "dq-card"}
            style={{ padding: 20, cursor: "pointer", position: "relative" }}
            onClick={() => setSelected(selected === card.id ? null : card.id)}
          >
            {/* カードヘッダー */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 36,
                  background: `linear-gradient(135deg, ${card.color}, ${card.color}aa)`,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "white",
                  fontWeight: 700,
                }}
              >
                {card.brand}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
                  {card.name}
                </div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                  年会費: {card.annualFee === 0 ? "無料" : `¥${card.annualFee.toLocaleString()}`}
                </div>
              </div>
              <span
                className={
                  card.status === "campaign"
                    ? "badge-yellow"
                    : card.status === "review"
                    ? "badge-red"
                    : "badge-green"
                }
              >
                {card.status === "campaign"
                  ? "🎯 キャンペーン中"
                  : card.status === "review"
                  ? "⚠️ 要見直し"
                  : "✓ 維持"}
              </span>
            </div>

            {/* 数値情報 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#64748b" }}>通常還元率</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#f5c842" }}>
                  {card.pointRate}%
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#64748b" }}>ベスト還元率</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#34d399" }}>
                  {card.bonusRate}%
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#64748b" }}>月間利用額</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>
                  ¥{(card.monthlySpend / 1000).toFixed(1)}k
                </div>
              </div>
            </div>

            {/* キャンペーン情報 */}
            {card.campaignDeadline && (
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 12px",
                  background: "rgba(245,200,66,0.1)",
                  borderRadius: 6,
                  border: "1px solid rgba(245,200,66,0.2)",
                }}
              >
                <div style={{ fontSize: 11, color: "#f5c842" }}>
                  🎁 キャンペーン期限: {card.campaignDeadline}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  達成で +{card.campaignBonus?.toLocaleString()}pt
                </div>
              </div>
            )}

            {/* 解約推奨の理由 */}
            {card.recommendation === "cancel" && (
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 12px",
                  background: "rgba(239,68,68,0.1)",
                  borderRadius: 6,
                }}
              >
                <div style={{ fontSize: 11, color: "#fca5a5", fontWeight: 700 }}>
                  🚨 解約推奨
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  {card.cancelReason}
                </div>
                <button className="btn-danger" style={{ marginTop: 8 }}>
                  解約手続きガイドを見る
                </button>
              </div>
            )}

            {/* ベストな用途 */}
            {selected === card.id && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                  💡 このカードが最もお得な場所
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {card.bestFor.map((b) => (
                    <span key={b} className="badge-blue">
                      {b}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
                  累計ポイント: <span style={{ color: "#f5c842", fontWeight: 700 }}>
                    {card.accumulatedPoints.toLocaleString()}pt
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 新規カード提案 */}
      <div className="dq-card dq-card-purple" style={{ padding: 24, marginTop: 24 }}>
        <div className="section-header">
          <span>✨</span>
          <h2 style={{ color: "#c4b5fd" }}>AI推奨 — 新規取得候補カード</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {[
            {
              name: "三井住友カードゴールド(NL)",
              reason: "年100万円修行で永年無料化。SBI証券積立で最大5%還元。長期保有価値が非常に高い。",
              bonus: "11,000",
              rate: "0.5〜10%",
            },
            {
              name: "JCBカードS",
              reason: "Amazon・セブン等で高還元。JCBプロパーカードでステータス性も高く、海外旅行保険完備。",
              bonus: "5,000",
              rate: "0.5〜3%",
            },
          ].map((rec) => (
            <div
              key={rec.name}
              style={{
                padding: 16,
                background: "rgba(15,23,42,0.5)",
                borderRadius: 8,
                border: "1px solid rgba(147,51,234,0.2)",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 6 }}>
                {rec.name}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>{rec.reason}</div>
              <div style={{ display: "flex", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>入会特典</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>
                    +{rec.bonus}pt
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>最大還元率</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f5c842" }}>{rec.rate}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
