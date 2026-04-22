"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { loadUserPurchases, type PurchaseDoc } from "@/lib/firebase";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function extractMonths(purchases: PurchaseDoc[]): string[] {
  const months = Array.from(new Set(purchases.map((p) => p.purchasedAt.slice(0, 7))));
  return months.sort((a, b) => (b > a ? 1 : -1));
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseDoc[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth());

  useEffect(() => {
    if (!user) return;
    loadUserPurchases(user.uid).then(setPurchases);
  }, [user]);

  const months = useMemo(() => {
    const list = extractMonths(purchases);
    if (!list.includes(currentMonth())) list.unshift(currentMonth());
    return list;
  }, [purchases]);

  const monthlyPurchases = useMemo(
    () => purchases.filter((p) => p.purchasedAt.startsWith(selectedMonth))
      .sort((a, b) => (b.purchasedAt > a.purchasedAt ? 1 : -1)),
    [purchases, selectedMonth]
  );

  const monthlyTotal = useMemo(
    () => monthlyPurchases.reduce((sum, p) => sum + p.price, 0),
    [monthlyPurchases]
  );

  const totalSaved = useMemo(
    () => purchases.reduce((sum, p) => sum + (p.savedAmount ?? 0), 0),
    [purchases]
  );

  // 購入記録なし → 誘導UI
  if (purchases.length === 0) {
    return (
      <div style={{ maxWidth: 520, margin: "80px auto 0", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🛒</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1e293b", marginBottom: 10 }}>
          まだ購入記録がありません
        </h1>
        <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.8, marginBottom: 32 }}>
          商品を検索して購入記録を登録すると、<br />
          カード別・月別の支出状況がここに表示されます。
        </p>
        <a href="/search" style={{
          display: "inline-block", padding: "14px 40px", borderRadius: 12,
          background: "linear-gradient(90deg, #1e40af, #3b82f6)",
          color: "white", fontWeight: 700, fontSize: 15, textDecoration: "none",
          boxShadow: "0 4px 16px rgba(30,64,175,0.35)",
        }}>
          🔍 商品を検索する
        </a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1e40af", marginBottom: 4 }}>
          📊 月次ダッシュボード
        </h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>カード利用状況と購入履歴を確認できます。</p>
      </div>

      {/* 総節約額バナー */}
      <div className="dq-card" style={{ padding: 20, marginBottom: 20, background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1px solid #86efac" }}>
        <div style={{ fontSize: 13, color: "#065f46", marginBottom: 4 }}>🎉 累計節約額（実質価格 vs 通常価格）</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#059669" }}>¥{totalSaved.toLocaleString()}</div>
      </div>

      {/* 購入履歴テーブル */}
      <div className="dq-card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>🗒️ 購入履歴</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ padding: "8px 16px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
              <span style={{ fontSize: 12, color: "#3b82f6" }}>月合計　</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: "#1e40af" }}>¥{monthlyTotal.toLocaleString()}</span>
            </div>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", background: "white", cursor: "pointer" }}>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {monthlyPurchases.length === 0 ? (
          <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "32px 0" }}>
            {selectedMonth} の購入記録はありません
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                  {["日付", "商品名", "通常価格", "実質価格", "節約額", "ショップ", "使用カード"].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyPurchases.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f8fafc" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "11px 12px", color: "#64748b", whiteSpace: "nowrap" }}>{p.purchasedAt.slice(0, 10)}</td>
                    <td style={{ padding: "11px 12px", color: "#1e293b", fontWeight: 600 }}>{p.itemName}</td>
                    <td style={{ padding: "11px 12px", color: "#374151", whiteSpace: "nowrap" }}>¥{p.price.toLocaleString()}</td>
                    <td style={{ padding: "11px 12px", color: "#1e40af", fontWeight: 700, whiteSpace: "nowrap" }}>¥{p.realPrice.toLocaleString()}</td>
                    <td style={{ padding: "11px 12px", color: "#059669", fontWeight: 700, whiteSpace: "nowrap" }}>¥{(p.savedAmount ?? 0).toLocaleString()}</td>
                    <td style={{ padding: "11px 12px", color: "#374151" }}>{p.shop}</td>
                    <td style={{ padding: "11px 12px" }}>
                      <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 6, background: "#f1f5f9", color: "#374151", fontSize: 11, fontWeight: 600 }}>
                        {p.cardName || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
