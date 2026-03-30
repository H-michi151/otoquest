"use client";
import { useState } from "react";
import {
  creditCards,
  cardPlatformMatrix,
  PLATFORMS,
  getBestCardForPlatform,
  getCardRatesAllPlatforms,
  compareCardsForPlatform,
} from "@/lib/mockData";

const CARD_COLORS: Record<string, string> = {
  "楽天カード":       "#cc0000",
  "PayPayカード":     "#1a237e",
  "三井住友カード(NL)": "#003087",
  "Amazonカード":     "#FF9900",
  "イオンカード":     "#e65100",
};

const CARD_ICONS: Record<string, string> = {
  "楽天カード":       "🦅",
  "PayPayカード":     "🟡",
  "三井住友カード(NL)": "💙",
  "Amazonカード":     "🛒",
  "イオンカード":     "🟠",
};

const rateColor = (rate: number) =>
  rate >= 3.0 ? "#059669" : rate >= 2.0 ? "#d97706" : rate >= 1.0 ? "#374151" : "#94a3b8";

const rateBg = (rate: number) =>
  rate >= 3.0 ? "#dcfce7" : rate >= 2.0 ? "#fef3c7" : rate >= 1.0 ? "#f8fafc" : "#f1f5f9";

const cards = Object.keys(cardPlatformMatrix);

export default function MatrixPage() {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [testMode, setTestMode] = useState<"card" | "platform">("card");

  // テスト1: 楽天カードで全7サイト
  const test1 = getCardRatesAllPlatforms("楽天カード");
  // テスト2: AmazonカードでAmazonとYahoo比較
  const test2 = ["Amazon", "Yahoo!ショッピング"].map((p) => ({
    platform: p,
    amazon: cardPlatformMatrix["Amazonカード"]?.[p] ?? 0,
    rakuten: cardPlatformMatrix["楽天カード"]?.[p] ?? 0,
  }));

  const userCardNames = creditCards
    .filter((c) => c.status === "active" || c.status === "campaign")
    .map((c) => c.name);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
          💳 カード×購入先 還元率マトリクス
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          {cards.length}カード × {PLATFORMS.length}サイト = 全{cards.length * PLATFORMS.length}パターンの基本還元率（2025年時点、キャンペーン除く）
        </p>
      </div>

      {/* ===== メインマトリクステーブル ===== */}
      <div className="dq-card" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "12px 16px", background: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "white" }}>📊 還元率マトリクス（全{cards.length * PLATFORMS.length}パターン）</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>単位: %（基本還元率）</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "#64748b", fontWeight: 700, borderBottom: "1px solid #e2e8f0", minWidth: 130 }}>
                  カード ╲ 購入先
                </th>
                {PLATFORMS.map((p) => (
                  <th
                    key={p}
                    style={{
                      padding: "10px 8px", fontSize: 11, fontWeight: 700,
                      color: selectedPlatform === p ? "#1e40af" : "#64748b",
                      borderBottom: "1px solid #e2e8f0",
                      cursor: "pointer",
                      background: selectedPlatform === p ? "#eff6ff" : "#f8fafc",
                      transition: "all 0.15s",
                      whiteSpace: "nowrap",
                    }}
                    onClick={() => setSelectedPlatform(selectedPlatform === p ? null : p)}
                  >
                    {p}
                    {selectedPlatform === p && <div style={{ fontSize: 9, color: "#1e40af" }}>▼ 選択中</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cards.map((cardName, ri) => (
                <tr
                  key={cardName}
                  style={{
                    background: selectedCard === cardName ? "#eff6ff" :
                                ri % 2 === 0 ? "white" : "#fafafa",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                  onClick={() => setSelectedCard(selectedCard === cardName ? null : cardName)}
                >
                  {/* カード名セル */}
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: CARD_COLORS[cardName] ?? "#94a3b8",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 12, fontWeight: selectedCard === cardName ? 700 : 500, color: selectedCard === cardName ? "#1e40af" : "#1e293b" }}>
                        {CARD_ICONS[cardName] ?? "💳"} {cardName}
                      </span>
                    </div>
                    {!userCardNames.includes(cardName) && (
                      <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2, marginLeft: 14 }}>未保有</div>
                    )}
                    {userCardNames.includes(cardName) && (
                      <div style={{ fontSize: 9, color: "#059669", marginTop: 2, marginLeft: 14 }}>✓ 保有中</div>
                    )}
                  </td>
                  {/* 還元率セル */}
                  {PLATFORMS.map((platform) => {
                    const rate = cardPlatformMatrix[cardName]?.[platform] ?? 0;
                    const isHighlightCol = selectedPlatform === platform;
                    const isHighlightRow = selectedCard === cardName;
                    const isBest = compareCardsForPlatform(platform)[0]?.cardName === cardName;
                    return (
                      <td
                        key={platform}
                        style={{
                          padding: "10px 8px",
                          textAlign: "center",
                          borderBottom: "1px solid #f1f5f9",
                          background: (isHighlightRow || isHighlightCol) ? rateBg(rate) : undefined,
                          transition: "background 0.15s",
                        }}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14, fontWeight: rate >= 2.0 ? 800 : 500,
                              color: rateColor(rate),
                            }}
                          >
                            {rate.toFixed(1)}%
                          </span>
                          {isBest && <span style={{ fontSize: 8, background: "#d1fae5", color: "#065f46", padding: "1px 4px", borderRadius: 3, fontWeight: 700 }}>最高</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "8px 14px", background: "#f8fafc", fontSize: 10, color: "#94a3b8", borderTop: "1px solid #e2e8f0" }}>
          💡 セルまたは行/列ヘッダーをクリックするとハイライト表示されます。
          <span style={{ marginLeft: 12 }}>
            {selectedCard && `🔵 選択中カード: ${selectedCard}`}
            {selectedPlatform && ` / 🟦 選択中サイト: ${selectedPlatform}`}
          </span>
        </div>
      </div>

      {/* ===== 凡例 ===== */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "3.0%以上（最高）", color: "#059669", bg: "#dcfce7" },
          { label: "2.0%（高い）", color: "#d97706", bg: "#fef3c7" },
          { label: "1.0%（標準）", color: "#374151", bg: "#f8fafc" },
          { label: "0.5%以下（低い）", color: "#94a3b8", bg: "#f1f5f9" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: l.color, background: l.bg, padding: "3px 10px", borderRadius: 6, border: `1px solid ${l.bg}` }}>
            <span style={{ fontWeight: 700 }}>■</span> {l.label}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#065f46", background: "#d1fae5", padding: "3px 10px", borderRadius: 6 }}>
          最高 = そのサイトで最も還元率が高いカード
        </div>
      </div>

      {/* ===== テスト1: 楽天カードで全7サイト ===== */}
      <div className="dq-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 16 }}>🧪</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>テスト1: 楽天カードで全7サイトの還元率一覧</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {test1.map((row, i) => (
            <div
              key={row.platform}
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: rateBg(row.rate),
                border: `1px solid ${row.rate >= 3 ? "#86efac" : row.rate >= 2 ? "#fde68a" : "#e2e8f0"}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>
                  {i === 0 ? "🏆 " : i === 1 ? "🥈 " : ""}{row.platform}
                </div>
                {row.rate === 3.0 && (
                  <div style={{ fontSize: 10, color: "#059669" }}>楽天市場特典 +2%</div>
                )}
                {row.rate !== 3.0 && (
                  <div style={{ fontSize: 10, color: "#64748b" }}>基本還元のみ</div>
                )}
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: rateColor(row.rate) }}>
                {row.rate.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, padding: "8px 12px", background: "#fef3c7", borderRadius: 6, fontSize: 11, color: "#92400e" }}>
          ✅ 結果: 楽天市場のみ3.0%還元。他6サイトは基本還元率1.0%のみ。楽天市場以外で使う場合のメリットは薄い。
        </div>
      </div>

      {/* ===== テスト2: AmazonカードとYahooの比較 ===== */}
      <div className="dq-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 16 }}>🧪</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>テスト2: AmazonカードでAmazonとYahooの還元率比較</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", color: "#64748b", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>購入先</th>
                <th style={{ padding: "8px 12px", textAlign: "center", color: "#FF9900", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>🛒 Amazonカード</th>
                <th style={{ padding: "8px 12px", textAlign: "center", color: "#cc0000", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>🦅 楽天カード（参考）</th>
                <th style={{ padding: "8px 12px", textAlign: "center", color: "#1a237e", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>🟡 PayPayカード（参考）</th>
                <th style={{ padding: "8px 12px", textAlign: "left", color: "#374151", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>判定</th>
              </tr>
            </thead>
            <tbody>
              {test2.map((row) => {
                const paypayRate = cardPlatformMatrix["PayPayカード"]?.[row.platform] ?? 0;
                const maxRate = Math.max(row.amazon, row.rakuten, paypayRate);
                return (
                  <tr key={row.platform} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#1e293b" }}>{row.platform}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span style={{
                        fontSize: 16, fontWeight: 800,
                        color: rateColor(row.amazon),
                        background: row.amazon === maxRate ? "#fef3c7" : undefined,
                        padding: row.amazon === maxRate ? "2px 8px" : undefined,
                        borderRadius: row.amazon === maxRate ? 6 : undefined,
                      }}>
                        {row.amazon.toFixed(1)}%{row.amazon === maxRate ? " 🏆" : ""}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span style={{ fontSize: 14, color: rateColor(row.rakuten), fontWeight: row.rakuten === maxRate ? 800 : 400 }}>
                        {row.rakuten.toFixed(1)}%{row.rakuten === maxRate ? " 🏆" : ""}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span style={{ fontSize: 14, color: rateColor(paypayRate), fontWeight: paypayRate === maxRate ? 800 : 400 }}>
                        {paypayRate.toFixed(1)}%{paypayRate === maxRate ? " 🏆" : ""}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>
                      {row.platform === "Amazon" && (
                        <span style={{ color: "#059669", fontWeight: 600 }}>🛒 Amazonカード が最適（3.0%）</span>
                      )}
                      {row.platform === "Yahoo!ショッピング" && (
                        <span style={{ color: "#d97706", fontWeight: 600 }}>🟡 PayPayカード が最適（2.0%）<br/>
                          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 400 }}>AmazonカードはYahooで1.0%のみ</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10, padding: "8px 12px", background: "#fff1f2", borderRadius: 6, fontSize: 11, color: "#9f1239" }}>
          ⚠️ 結論: Amazonカードは<strong>Amazon専用</strong>と割り切るべき。Yahoo!ショッピングではPayPayカード(2.0%)の方が有利。複数サイトを使う場合は楽天カード(楽天市場3.0%) + PayPayカード(Yahoo2.0%) の組み合わせが最適。
        </div>
      </div>

      {/* ===== サイト別ベストカード一覧 ===== */}
      <div className="dq-card" style={{ padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
          🏆 購入先別 ベストカード（マトリクス自動計算）
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {PLATFORMS.map((platform) => {
            const best = getBestCardForPlatform(platform, userCardNames);
            const allForPlatform = compareCardsForPlatform(platform).slice(0, 3);
            return (
              <div key={platform} style={{ padding: "12px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{platform}</div>
                {best ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: CARD_COLORS[best.cardName] ?? "#94a3b8" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{best.cardName}</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: rateColor(best.rate), marginBottom: 6 }}>
                      {best.rate.toFixed(1)}%
                    </div>
                    {/* 2位・3位 */}
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>
                      {allForPlatform.slice(1).map((c, i) => (
                        <div key={c.cardName}>{i + 2}位 {c.cardName}: {c.rate.toFixed(1)}%</div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>保有カードなし</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
