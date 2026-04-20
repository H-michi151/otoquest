"use client";
import { useState, useEffect, useMemo } from "react";
import { loadCards, type Card } from "@/app/settings/page";

// ===== 型定義 =====
interface Purchase {
  id: string;
  productName: string;
  price: number;
  shop: string;
  cardId: string;
  purchasedAt: string; // "2026-04-16"
  month: string;       // "2026-04"
}

// ===== localStorage ヘルパー =====
function loadPurchases(): Purchase[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("otoquest_purchases");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// 購入データから月一覧を抽出
function extractMonths(purchases: Purchase[]): string[] {
  const months = Array.from(new Set(purchases.map((p) => p.month)));
  return months.sort((a, b) => (b > a ? 1 : -1)); // 新しい順
}

export default function DashboardPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth());

  useEffect(() => {
    setCards(loadCards());
    setPurchases(loadPurchases());
  }, []);

  // 利用可能な月一覧
  const months = useMemo(() => {
    const list = extractMonths(purchases);
    // 当月が含まれていなければ先頭に追加
    if (!list.includes(currentMonth())) list.unshift(currentMonth());
    return list;
  }, [purchases]);

  // 選択月の購入一覧（新しい順）
  const monthlyPurchases = useMemo(
    () =>
      purchases
        .filter((p) => p.month === selectedMonth)
        .sort((a, b) => (b.purchasedAt > a.purchasedAt ? 1 : -1)),
    [purchases, selectedMonth]
  );

  // 当月の購入（カードサマリー用は常に当月）
  const currentMonthPurchases = useMemo(
    () => purchases.filter((p) => p.month === currentMonth()),
    [purchases]
  );

  // カード別当月使用額
  const cardUsage = useMemo(() => {
    const map: Record<string, number> = {};
    currentMonthPurchases.forEach((p) => {
      map[p.cardId] = (map[p.cardId] ?? 0) + p.price;
    });
    return map;
  }, [currentMonthPurchases]);

  // 月合計
  const monthlyTotal = useMemo(
    () => monthlyPurchases.reduce((sum, p) => sum + p.price, 0),
    [monthlyPurchases]
  );

  // カードIDからカード名を引く
  const cardNameMap = useMemo(
    () => Object.fromEntries(cards.map((c) => [c.id, c.name])),
    [cards]
  );

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1e40af", marginBottom: 4 }}>
          📊 月次ダッシュボード
        </h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          カード利用状況と購入履歴を確認できます。
        </p>
      </div>

      {/* ===== 1. カード別サマリー（当月） ===== */}
      <div className="dq-card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 16 }}>
          💳 カード別サマリー（{currentMonth()} 当月）
        </div>

        {cards.length === 0 ? (
          <div style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "16px 0" }}>
            カードが登録されていません。設定ページで追加してください。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {cards.map((card) => {
              const used = cardUsage[card.id] ?? 0;
              const remaining = card.limit - used;
              const usedPct = card.limit > 0 ? Math.min((used / card.limit) * 100, 100) : 0;
              const remainPct = 100 - usedPct;
              const isDanger = remainPct <= 20;

              return (
                <div key={card.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* カラーバッジ */}
                    <div style={{
                      width: 6, height: 36, borderRadius: 3,
                      background: card.color, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                          {card.name}
                        </span>
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          還元率 <strong style={{ color: "#059669" }}>{card.pointRate}%</strong>
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 16, marginTop: 2, fontSize: 12, color: "#64748b" }}>
                        <span>
                          使用額: <strong style={{ color: "#1e293b" }}>¥{used.toLocaleString()}</strong>
                          {" "}/ ¥{card.limit.toLocaleString()}
                        </span>
                        <span style={{ color: isDanger ? "#dc2626" : "#059669", fontWeight: 700 }}>
                          残枠: ¥{remaining.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* プログレスバー */}
                  <div style={{
                    height: 8, borderRadius: 4, background: "#f1f5f9",
                    overflow: "hidden", marginLeft: 16,
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${usedPct}%`,
                      borderRadius: 4,
                      background: isDanger
                        ? "linear-gradient(90deg, #dc2626, #ef4444)"
                        : `linear-gradient(90deg, ${card.color}, ${card.color}cc)`,
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                  {isDanger && (
                    <div style={{
                      marginLeft: 16, fontSize: 11, color: "#dc2626",
                      fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
                    }}>
                      ⚠️ 残枠20%以下です
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== 2 & 3. 月間購入履歴 + 合計 ===== */}
      <div className="dq-card" style={{ padding: 24 }}>
        {/* ヘッダー行：月選択 + 合計 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12, marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>
              🗒️ 購入履歴
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* 月合計 */}
            <div style={{
              padding: "8px 16px", borderRadius: 10,
              background: "#eff6ff", border: "1px solid #bfdbfe",
            }}>
              <span style={{ fontSize: 12, color: "#3b82f6" }}>月合計　</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: "#1e40af" }}>
                ¥{monthlyTotal.toLocaleString()}
              </span>
            </div>
            {/* 月選択 */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: "8px 12px", borderRadius: 8,
                border: "1px solid #e2e8f0", fontSize: 14,
                fontFamily: "inherit", background: "white", cursor: "pointer",
              }}
            >
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* テーブル */}
        {monthlyPurchases.length === 0 ? (
          <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "32px 0" }}>
            {selectedMonth} の購入記録はありません
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                  {["日付", "商品名", "金額", "ショップ", "使用カード"].map((h) => (
                    <th key={h} style={{
                      padding: "10px 12px", textAlign: "left",
                      fontSize: 11, fontWeight: 700,
                      color: "#64748b", letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyPurchases.map((p) => {
                  const cardName = cardNameMap[p.cardId] ?? p.cardId;
                  return (
                    <tr
                      key={p.id}
                      style={{ borderBottom: "1px solid #f8fafc" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#f8fafc")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td style={{ padding: "11px 12px", color: "#64748b", whiteSpace: "nowrap" }}>
                        {p.purchasedAt}
                      </td>
                      <td style={{ padding: "11px 12px", color: "#1e293b", fontWeight: 600 }}>
                        {p.productName}
                      </td>
                      <td style={{ padding: "11px 12px", color: "#1e40af", fontWeight: 700, whiteSpace: "nowrap" }}>
                        ¥{p.price.toLocaleString()}
                      </td>
                      <td style={{ padding: "11px 12px", color: "#374151" }}>
                        {p.shop}
                      </td>
                      <td style={{ padding: "11px 12px" }}>
                        {cardName ? (
                          <span style={{
                            display: "inline-block",
                            padding: "3px 8px", borderRadius: 6,
                            background: "#f1f5f9", color: "#374151",
                            fontSize: 11, fontWeight: 600,
                          }}>
                            {cardName}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: 11 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
