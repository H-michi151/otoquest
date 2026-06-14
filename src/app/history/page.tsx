"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getIdToken } from "firebase/auth";
import type { PurchaseDoc } from "@/lib/firebase";

// ===== ユーティリティ =====
type AuthUser = NonNullable<ReturnType<typeof useAuth>["user"]>;

async function authHeader(user: AuthUser) {
  const token = await getIdToken(user);
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function jstYearMonth(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentJstYearMonth(): string {
  return jstYearMonth(new Date());
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// バッジ共通スタイル
function badge(color: string, bg: string, label: string) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 10,
      fontSize: 10, fontWeight: 700, color, background: bg, whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

// ===== メインページ =====
export default function HistoryPage() {
  const { user } = useAuth();

  const [purchases, setPurchases]   = useState<PurchaseDoc[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading]       = useState(true);

  // フィルター状態
  const [selectedMonth, setSelectedMonth]   = useState(currentJstYearMonth());
  const [filterCategory, setFilterCategory] = useState("");
  const [filterShop, setFilterShop]         = useState("");
  const [filterCard, setFilterCard]         = useState("");
  const [showOnlyExpenseNotEntered, setShowOnlyExpenseNotEntered] = useState(false);

  // 請求書モーダル
  const [showInvoice, setShowInvoice] = useState(false);

  // ===== データ取得 =====
  const loadPurchases = useCallback(async (month: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const headers = await authHeader(user);
      const res = await fetch(`/api/purchases?month=${month}`, { headers });
      if (!res.ok) throw new Error(`GET /api/purchases: ${res.status}`);
      const data = await res.json() as { purchases: PurchaseDoc[] };
      setPurchases(data.purchases ?? []);
    } catch (e) {
      console.error("[history] loadPurchases failed:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadCategories = useCallback(async () => {
    if (!user) return;
    try {
      const headers = await authHeader(user);
      const res = await fetch("/api/categories", { headers });
      if (!res.ok) return;
      const data = await res.json() as { categories: string[] };
      setCategories(data.categories ?? []);
    } catch (e) {
      console.error("[history] loadCategories failed:", e);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadCategories();
  }, [user, loadCategories]);

  useEffect(() => {
    if (!user) return;
    loadPurchases(selectedMonth);
  }, [user, selectedMonth, loadPurchases]);

  // ===== 集計（フィルター前・全件） =====
  const totalPrice        = purchases.reduce((s, p) => s + (p.price ?? 0), 0);
  const totalDiscount     = purchases.reduce((s, p) => s + (p.couponDiscount ?? 0) + (p.pointsUsed ?? 0), 0);
  const expenseEnteredCnt = purchases.filter((p) => p.expenseEntered).length;
  const totalCnt          = purchases.length;
  const notArrivedCnt     = purchases.filter((p) => !p.arrived).length;
  const noReceiptCnt      = purchases.filter((p) => !p.hasReceipt).length;
  const expenseNotEntCnt  = purchases.filter((p) => !p.expenseEntered).length;

  // ユニーク値（フィルター選択肢）
  const shopOptions     = [...new Set(purchases.map((p) => p.shop).filter(Boolean))];
  const cardOptions     = [...new Set(purchases.map((p) => p.cardName).filter(Boolean))];

  // ===== フィルター適用 =====
  const filtered = purchases.filter((p) => {
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterShop     && p.shop !== filterShop)         return false;
    if (filterCard     && p.cardName !== filterCard)     return false;
    if (showOnlyExpenseNotEntered && p.expenseEntered)   return false;
    return true;
  });

  const selectStyle: React.CSSProperties = {
    padding: "6px 10px", borderRadius: 7, border: "1px solid #e2e8f0",
    fontSize: 12, fontFamily: "inherit", background: "white", cursor: "pointer",
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: 48, color: "#64748b" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
      <div>購入記録を読み込み中...</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>

      {/* ページヘッダー */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#059669", marginBottom: 4 }}>
          🧾 購入管理
        </h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          月別購入記録・経費入力状況・ステータス管理
        </p>
      </div>

      {/* ===== 月次請求サマリーボックス ===== */}
      <div className="dq-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>仕入れ合計</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#1e293b" }}>
              ¥{totalPrice.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>クーポン・値引き合計</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#059669" }}>
              −¥{totalDiscount.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>経費クラウド入力済</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1e40af" }}>
              {expenseEnteredCnt} / {totalCnt} 件
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              disabled
              style={{
                padding: "8px 14px", borderRadius: 8,
                border: "1px solid #e2e8f0", background: "#f8fafc",
                color: "#94a3b8", fontSize: 12, cursor: "not-allowed", fontFamily: "inherit",
              }}
            >
              📥 CSVエクスポート
            </button>
            <button
              onClick={() => setShowOnlyExpenseNotEntered((v) => !v)}
              style={{
                padding: "8px 14px", borderRadius: 8,
                border: showOnlyExpenseNotEntered ? "2px solid #dc2626" : "1px solid #e2e8f0",
                background: showOnlyExpenseNotEntered ? "#fff1f2" : "white",
                color: showOnlyExpenseNotEntered ? "#dc2626" : "#374151",
                fontSize: 12, cursor: "pointer", fontWeight: showOnlyExpenseNotEntered ? 700 : 400,
                fontFamily: "inherit",
              }}
            >
              {showOnlyExpenseNotEntered ? "🔴 未入力のみ表示中" : "📋 未入力のみ表示"}
            </button>
            <button
              onClick={() => setShowInvoice(true)}
              style={{
                padding: "8px 14px", borderRadius: 8,
                border: "1px solid #7c3aed", background: "#f5f3ff",
                color: "#7c3aed", fontSize: 12, cursor: "pointer", fontWeight: 700,
                fontFamily: "inherit",
              }}
            >
              🧾 請求書を出力
            </button>
          </div>
        </div>
      </div>

      {/* ===== サマリーカード（4枠） ===== */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "件数", value: `${totalCnt}件`, color: "#1e40af", icon: "📦" },
          { label: "未着あり", value: `${notArrivedCnt}件`, color: notArrivedCnt > 0 ? "#d97706" : "#059669", icon: "🚚" },
          { label: "領収証未取得", value: `${noReceiptCnt}件`, color: noReceiptCnt > 0 ? "#d97706" : "#059669", icon: "🧾" },
          { label: "経費未入力", value: `${expenseNotEntCnt}件`, color: expenseNotEntCnt > 0 ? "#dc2626" : "#059669", icon: "📝" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="dq-card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{icon} {label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ===== フィルターUI ===== */}
      <div className="dq-card" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {/* 月送りナビ */}
        <button
          onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
          style={{ ...selectStyle, padding: "6px 12px", fontWeight: 700 }}
        >◀</button>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", minWidth: 80, textAlign: "center" }}>
          {selectedMonth}
        </span>
        <button
          onClick={() => setSelectedMonth((m) => addMonths(m, +1))}
          style={{ ...selectStyle, padding: "6px 12px", fontWeight: 700 }}
        >▶</button>

        <span style={{ color: "#e2e8f0" }}>|</span>

        {/* 品目 */}
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={selectStyle}>
          <option value="">品目: 全て</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* 仕入れ先 */}
        <select value={filterShop} onChange={(e) => setFilterShop(e.target.value)} style={selectStyle}>
          <option value="">仕入れ先: 全て</option>
          {shopOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* カード */}
        <select value={filterCard} onChange={(e) => setFilterCard(e.target.value)} style={selectStyle}>
          <option value="">カード: 全て</option>
          {cardOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <button
          onClick={() => alert("Step4で編集モーダルを実装予定です")}
          style={{
            marginLeft: "auto", padding: "6px 14px", borderRadius: 7,
            border: "none", background: "linear-gradient(90deg,#1e40af,#3b82f6)",
            color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          ＋ 手動で追加
        </button>
      </div>

      {/* ===== 明細カード一覧 ===== */}
      {filtered.length === 0 ? (
        <div className="dq-card" style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          <div>{selectedMonth} の購入記録はありません</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((p) => (
            <div key={p.id} className="dq-card" style={{ padding: "14px 16px" }}>
              {/* 上段 */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                {/* 日付 */}
                <div style={{
                  minWidth: 36, textAlign: "center",
                  fontSize: 13, fontWeight: 700, color: "#64748b",
                  paddingTop: 2,
                }}>
                  {formatDate(p.purchasedAt)}
                </div>

                {/* 品目バッジ */}
                {p.category && badge("#065f46", "#d1fae5", p.category)}

                {/* 商品名 + ショップ */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: "#1e293b",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {p.itemName}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                    {p.shop}
                    {p.quantity && p.quantity > 1 && (
                      <span style={{ marginLeft: 6 }}>× {p.quantity}</span>
                    )}
                  </div>
                  {(p.couponDiscount ?? 0) > 0 && (
                    <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginTop: 2 }}>
                      クーポン −¥{(p.couponDiscount ?? 0).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* 金額 */}
                <div style={{ textAlign: "right", minWidth: 80 }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: "#1e293b" }}>
                    ¥{(p.price ?? 0).toLocaleString()}
                  </div>
                </div>

                {/* 編集・削除（Step4） */}
                <div style={{ display: "flex", gap: 4, paddingTop: 1 }}>
                  <button disabled style={{
                    padding: "3px 8px", borderRadius: 5, border: "1px solid #e2e8f0",
                    background: "#f8fafc", color: "#94a3b8", fontSize: 10, cursor: "not-allowed",
                    fontFamily: "inherit",
                  }}>✏️</button>
                  <button disabled style={{
                    padding: "3px 8px", borderRadius: 5, border: "1px solid #fca5a5",
                    background: "#fff1f2", color: "#fca5a5", fontSize: 10, cursor: "not-allowed",
                    fontFamily: "inherit",
                  }}>🗑️</button>
                </div>
              </div>

              {/* 下段：バッジ行 */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {/* カード名 */}
                {p.cardName && p.cardName !== "—" &&
                  badge("#7c3aed", "#f5f3ff", `💳 ${p.cardName}`)}

                {/* 届き済 */}
                {p.arrived
                  ? badge("#065f46", "#d1fae5", "✅ 届き済")
                  : badge("#92400e", "#fef3c7", "🚚 未着")}

                {/* 領収証 */}
                {p.hasReceipt
                  ? badge("#065f46", "#d1fae5", "🧾 領収証あり")
                  : badge("#92400e", "#fef3c7", "🧾 領収証なし")}

                {/* 印刷 */}
                {p.printed
                  ? badge("#065f46", "#d1fae5", "🖨️ 印刷済")
                  : badge("#92400e", "#fef3c7", "🖨️ 未印刷")}

                {/* 経費クラウド */}
                {p.expenseEntered
                  ? badge("#1e40af", "#dbeafe", "📊 経費入力済")
                  : badge("#64748b", "#f1f5f9", "📊 経費未入力")}

                {/* メモ */}
                {p.memo && (
                  <span style={{
                    marginLeft: "auto", fontSize: 11, color: "#64748b",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: 200,
                  }}>
                    💬 {p.memo}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== 請求書モーダル ===== */}
      {showInvoice && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowInvoice(false); }}
        >
          <div style={{
            background: "white", borderRadius: 16, padding: 28,
            width: 400, maxWidth: "90vw",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#1e293b", marginBottom: 20 }}>
              🧾 {selectedMonth} 月次請求サマリー
            </div>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["件数",                 `${totalCnt}件`],
                  ["仕入れ合計",          `¥${totalPrice.toLocaleString()}`],
                  ["クーポン・値引き合計",  `−¥${totalDiscount.toLocaleString()}`],
                  ["実支払い合計",         `¥${(totalPrice - totalDiscount).toLocaleString()}`],
                  ["経費クラウド入力済",   `${expenseEnteredCnt} / ${totalCnt}件`],
                ].map(([label, val]) => (
                  <tr key={label} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 4px", color: "#64748b" }}>{label}</td>
                    <td style={{ padding: "8px 4px", fontWeight: 700, textAlign: "right", color: "#1e293b" }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => setShowInvoice(false)}
              style={{
                marginTop: 20, width: "100%", padding: "10px 0", borderRadius: 8,
                border: "1px solid #e2e8f0", background: "white", color: "#64748b",
                fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}
            >閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
