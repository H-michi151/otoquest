"use client";
import { useState, useEffect } from "react";
import { orders, savingsStats } from "@/lib/mockData";
import { loadHistory } from "@/app/assist/page";

const statusLabel: Record<string, { label: string; color: string; bg: string }> = {
  preparing: { label: "準備中",   color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  shipped:   { label: "配送中",   color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  delivered: { label: "配達完了", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
};

export default function HistoryPage() {
  const [localHistory, setLocalHistory] = useState<ReturnType<typeof loadHistory>>([]);

  useEffect(() => {
    setLocalHistory(loadHistory());
  }, []);

  const totalSaved = localHistory.reduce((s, r) => s + r.savedAmount, 0);
  const thisMonthRecords = localHistory.filter((r) => {
    const d = new Date(r.purchasedAt);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const thisMonthSaved = thisMonthRecords.reduce((s, r) => s + r.savedAmount, 0);

  const active    = orders.filter((o) => o.status !== "delivered");
  const delivered = orders.filter((o) => o.status === "delivered");

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#059669", marginBottom: 4 }}>
          💚 購入履歴・節約額
        </h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          実質価格での購入記録と節約実績を確認できます
        </p>
      </div>

      {/* 月次サマリー */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        <div className="dq-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>今月の節約額</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#059669" }}>
            ¥{thisMonthSaved.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            今月 {thisMonthRecords.length} 件の購入記録
          </div>
        </div>
        <div className="dq-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>今月の購入件数</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#1e40af" }}>
            {thisMonthRecords.length + delivered.length} 件
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            アシスト記録 + 注文管理
          </div>
        </div>
        <div className="dq-card dq-card-gold" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>累計節約額（アシスト）</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#b45309" }}>
            ¥{totalSaved.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            全期間 {localHistory.length} 件の記録
          </div>
        </div>
      </div>

      {/* 節約グラフ（6ヶ月） */}
      <div className="dq-card" style={{ padding: 20, marginBottom: 24 }}>
        <div className="section-header">
          <span>📈</span>
          <h2>節約実績グラフ（6ヶ月）</h2>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
          {savingsStats.history.map((item, i) => {
            const max = Math.max(...savingsStats.history.map((h) => h.saved));
            const h = Math.round((item.saved / max) * 90);
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 10, color: "#059669" }}>¥{(item.saved / 1000).toFixed(0)}k</div>
                <div
                  style={{
                    width: "100%",
                    height: h,
                    background: i === 5
                      ? "linear-gradient(180deg,#059669,#34d399)"
                      : "linear-gradient(180deg,#1e40af,#3b82f6)",
                    borderRadius: "4px 4px 0 0",
                  }}
                />
                <div style={{ fontSize: 10, color: "#64748b" }}>{item.month}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* アシスト購入記録 */}
      {localHistory.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="section-header">
            <span>⚡</span>
            <h2>アシスト購入記録</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {localHistory.map((record) => (
              <div key={record.id} className="dq-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                      {record.shopLabel}
                      {record.couponUsed && (
                        <span className="badge-purple" style={{ marginLeft: 8 }}>クーポン使用</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {new Date(record.purchasedAt).toLocaleString("ja-JP")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>実質購入価格</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#1e293b" }}>
                      ¥{record.realPrice.toLocaleString()}
                    </div>
                    {record.savedAmount > 0 && (
                      <div style={{ fontSize: 12, color: "#059669", fontWeight: 700 }}>
                        💚 節約 ¥{record.savedAmount.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 既存注文管理（節約額カラム追加） */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-header">
          <span>🚚</span>
          <h2>進行中の注文</h2>
        </div>
        {active.map((order) => (
          <div key={order.id} className="dq-card" style={{ padding: 16, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22 }}>{order.platformIcon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{order.productName}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  {order.platform} · {order.orderDate} · ¥{order.price.toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: statusLabel[order.status].bg,
                    color: statusLabel[order.status].color,
                    fontSize: 11,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  {statusLabel[order.status].label}
                </div>
                <div style={{ fontSize: 11, color: "#d97706" }}>
                  +{order.pointsEarned.toLocaleString()}pt 予定
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="section-header">
          <span>✅</span>
          <h2>配達完了</h2>
        </div>
        {delivered.map((order) => {
          // 節約額は pointsEarned を節約相当として表示
          const savedAmount = order.pointsEarned;
          return (
            <div key={order.id} className="dq-card" style={{ padding: 16, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>{order.platformIcon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{order.productName}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {order.platform} · {order.orderDate}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                    ¥{order.price.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>
                    💚 節約（ポイント相当） ¥{savedAmount.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
