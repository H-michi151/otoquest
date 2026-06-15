"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getIdToken } from "firebase/auth";
import type { PurchaseDoc, CardDoc } from "@/lib/firebase";

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
  const [filterStatus, setFilterStatus]     = useState("");
  const [showOnlyExpenseNotEntered, setShowOnlyExpenseNotEntered] = useState(false);

  // 請求書モーダル
  const [showInvoice, setShowInvoice] = useState(false);

  // 編集モーダル
  const [editTarget, setEditTarget] = useState<PurchaseDoc | null>(null); // null=新規
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userCards, setUserCards] = useState<CardDoc[]>([]);

  // フォーム状態
  const [fDate, setFDate]             = useState("");
  const [fCategory, setFCategory]     = useState("");
  const [fItemName, setFItemName]     = useState("");
  const [fQuantity, setFQuantity]     = useState("");
  const [fUnitPrice, setFUnitPrice]   = useState("");
  const [fCoupon, setFCoupon]         = useState("");
  const [fPoints, setFPoints]         = useState("");
  const [fShop, setFShop]             = useState("");
  const [fCardId, setFCardId]         = useState("");
  const [fMemo, setFMemo]             = useState("");
  const [fArrived, setFArrived]       = useState(false);
  const [fReceipt, setFReceipt]       = useState(false);
  const [fPrinted, setFPrinted]       = useState(false);
  const [fBilled, setFBilled]         = useState(false);
  const [fExpense, setFExpense]       = useState(false);
  // 請求金額
  const [fBillingAmount, setFBillingAmount]               = useState("");
  const [billingAmountManuallySet, setBillingAmountManuallySet] = useState(false);
  // 新品目追加
  const [addingCat, setAddingCat]     = useState(false);
  const [newCatName, setNewCatName]   = useState("");

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

  const loadCards = useCallback(async () => {
    if (!user) return;
    try {
      const headers = await authHeader(user);
      const res = await fetch("/api/cards", { headers });
      if (!res.ok) return;
      const data = await res.json() as { cards: CardDoc[] };
      setUserCards(data.cards ?? []);
    } catch (e) {
      console.error("[history] loadCards failed:", e);
    }
  }, [user]);

  useEffect(() => { if (!user) return; loadCategories(); }, [user, loadCategories]);
  useEffect(() => { if (!user) return; loadCards(); }, [user, loadCards]);
  useEffect(() => { if (!user) return; loadPurchases(selectedMonth); }, [user, selectedMonth, loadPurchases]);

  // ===== モーダル開閉 =====
  const openModal = (p: PurchaseDoc | null) => {
    setEditTarget(p);
    if (p) {
      const d = p.purchasedAt ? new Date(p.purchasedAt).toISOString().slice(0,10) : "";
      setFDate(d); setFCategory(p.category ?? ""); setFItemName(p.itemName ?? "");
      setFQuantity(String(p.quantity ?? 1)); setFUnitPrice(String(p.unitPrice ?? p.price ?? 0));
      setFCoupon(String(p.couponDiscount ?? 0)); setFPoints(String(p.pointsUsed ?? 0));
      setFShop(p.shop ?? ""); setFCardId(p.cardId ?? ""); setFMemo(p.memo ?? "");
      setFArrived(p.arrived ?? false); setFReceipt(p.hasReceipt ?? false);
      setFPrinted(p.printed ?? false); setFBilled(false); setFExpense(p.expenseEntered ?? false);
      // 請求金額：既存値がbillingAmountと異なる場合は手動設定済み扱い
      const existingBilling = p.billingAmount ?? p.price ?? 0;
      const existingPrice   = p.price ?? 0;
      setFBillingAmount(String(existingBilling));
      setBillingAmountManuallySet(existingBilling !== existingPrice);
    } else {
      const today = new Date().toISOString().slice(0,10);
      setFDate(today); setFCategory(""); setFItemName(""); setFQuantity("1"); setFUnitPrice("");
      setFCoupon(""); setFPoints(""); setFShop(""); setFCardId(userCards[0]?.id ?? "");
      setFMemo(""); setFArrived(false); setFReceipt(false); setFPrinted(false);
      setFBilled(false); setFExpense(false);
      setFBillingAmount(""); setBillingAmountManuallySet(false);
    }
    setAddingCat(false); setNewCatName("");
    setShowEdit(true);
  };

  // ===== 保存 =====
  const handleSave = async () => {
    if (!user || !fItemName.trim()) return;
    setSaving(true);
    try {
      const headers = await authHeader(user);
      const qty     = parseInt(fQuantity)    || 1;
      const unit    = parseInt(fUnitPrice)   || 0;
      const coupon  = parseInt(fCoupon)      || 0;
      const points  = parseInt(fPoints)      || 0;
      const subtotal = qty * unit;
      const price = Math.max(0, subtotal - coupon - points);
      const selCard = fCardId === "__points__"
        ? { id: "", name: "ポイント利用" }
        : userCards.find((c) => c.id === fCardId) ?? { id: fCardId, name: "" };
      const body = {
        itemName: fItemName.trim(), price, realPrice: price,
        savedAmount: coupon + points, cardId: selCard.id, cardName: selCard.name,
        shop: fShop.trim(), category: fCategory, quantity: qty,
        unitPrice: unit, couponDiscount: coupon, pointsUsed: points,
        memo: fMemo.trim(), hasReceipt: fReceipt, printed: fPrinted,
        arrived: fArrived, expenseEntered: fExpense,
        billingAmount: billingAmountManuallySet ? (parseInt(fBillingAmount) || 0) : price,
      };
      if (editTarget) {
        const res = await fetch(`/api/purchases/${editTarget.id}`, { method: "PUT", headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`PUT failed: ${res.status}`);
      } else {
        const res = await fetch("/api/purchases", { method: "POST", headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`POST failed: ${res.status}`);
      }
      setShowEdit(false);
      await loadPurchases(selectedMonth);
    } catch (e) {
      console.error("[history] save failed:", e);
      alert("保存に失敗しました。コンソールを確認してください。");
    } finally {
      setSaving(false);
    }
  };

  // ===== 削除 =====
  const handleDelete = async (p: PurchaseDoc) => {
    if (!user) return;
    if (!confirm(`「${p.itemName}」を削除しますか？`)) return;
    try {
      const headers = await authHeader(user);
      const res = await fetch(`/api/purchases/${p.id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error(`DELETE failed: ${res.status}`);
      await loadPurchases(selectedMonth);
    } catch (e) {
      console.error("[history] delete failed:", e);
      alert("削除に失敗しました。");
    }
  };

  // ===== 新品目追加 =====
  const commitNewCategory = async () => {
    if (!user || !newCatName.trim()) { setAddingCat(false); return; }
    const name = newCatName.trim();
    try {
      const headers = await authHeader(user);
      await fetch("/api/categories", { method: "POST", headers, body: JSON.stringify({ name }) });
      await loadCategories();
      setFCategory(name);
    } catch (e) { console.error("[history] addCategory failed:", e); }
    setAddingCat(false); setNewCatName("");
  };

  // ===== 集計（フィルター前・全件） =====
  const totalPrice        = purchases.reduce((s, p) => s + (p.billingAmount ?? p.price ?? 0), 0);
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
    if (filterStatus === "not_arrived"    && p.arrived)         return false;
    if (filterStatus === "no_receipt"     && p.hasReceipt)      return false;
    if (filterStatus === "not_printed"    && p.printed)         return false;
    if (filterStatus === "expense_needed" && p.expenseEntered)  return false;
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

        {/* ステータス */}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="">ステータス: 全て</option>
          <option value="not_arrived">未着のみ</option>
          <option value="no_receipt">領収証なしのみ</option>
          <option value="not_printed">未印刷のみ</option>
          <option value="expense_needed">経費未入力のみ</option>
        </select>

        <button
          onClick={() => openModal(null)}
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
                    ¥{(p.billingAmount ?? p.price ?? 0).toLocaleString()}
                  </div>
                </div>

                {/* 編集・削除 */}
                <div style={{ display: "flex", gap: 4, paddingTop: 1 }}>
                  <button onClick={() => openModal(p)} style={{
                    padding: "3px 8px", borderRadius: 5, border: "1px solid #bfdbfe",
                    background: "#eff6ff", color: "#1e40af", fontSize: 10, cursor: "pointer",
                    fontFamily: "inherit",
                  }}>✏️</button>
                  <button onClick={() => handleDelete(p)} style={{
                    padding: "3px 8px", borderRadius: 5, border: "1px solid #fca5a5",
                    background: "#fff1f2", color: "#dc2626", fontSize: 10, cursor: "pointer",
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
      {/* ===== 編集モーダル ===== */}
      {showEdit && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div style={{ background: "white", borderRadius: 16, padding: 24, width: 520,
            maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>

            <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", marginBottom: 18 }}>
              {editTarget ? "✏️ 購入記録を編集" : "＋ 購入記録を追加"}
            </div>

            {/* 2列グリッド */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

              {/* 日付 */}
              <div style={{ gridColumn: "1" }}>
                <label style={lbl}>日付</label>
                <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)}
                  style={inp} />
              </div>

              {/* 品目 */}
              <div style={{ gridColumn: "2" }}>
                <label style={lbl}>品目</label>
                {addingCat ? (
                  <input autoFocus placeholder="新しい品目名" value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onBlur={commitNewCategory}
                    onKeyDown={(e) => { if (e.key === "Enter") commitNewCategory(); }}
                    style={inp} />
                ) : (
                  <select value={fCategory} onChange={(e) => {
                    if (e.target.value === "__add__") { setAddingCat(true); setNewCatName(""); }
                    else setFCategory(e.target.value);
                  }} style={inp}>
                    <option value="">選択してください</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="__add__">＋ 新しい品目を追加</option>
                  </select>
                )}
              </div>

              {/* 商品名 */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>商品名</label>
                <input value={fItemName} onChange={(e) => setFItemName(e.target.value)}
                  placeholder="商品名を入力" style={inp} />
              </div>

              {/* 個数・単価 */}
              <div>
                <label style={lbl}>個数</label>
                <input type="number" min={1} value={fQuantity} placeholder="1"
                  onChange={(e) => setFQuantity(e.target.value)}
                  style={inp} />
              </div>
              <div>
                <label style={lbl}>単価（円）</label>
                <input type="number" min={0} value={fUnitPrice} placeholder="0"
                  onChange={(e) => setFUnitPrice(e.target.value)}
                  style={inp} />
              </div>

              {/* 小計 */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>小計（自動計算）</label>
                <div style={{ ...inp, background: "#f8fafc", color: "#64748b" }}>
                  ¥{((parseInt(fQuantity) || 1) * (parseInt(fUnitPrice) || 0)).toLocaleString()}
                </div>
              </div>

              {/* クーポン・ポイント */}
              <div>
                <label style={lbl}>クーポン値引き（円）</label>
                <input type="number" min={0} value={fCoupon} placeholder="0"
                  onChange={(e) => setFCoupon(e.target.value)}
                  style={inp} />
              </div>
              <div>
                <label style={lbl}>ポイント使用（円相当）</label>
                <input type="number" min={0} value={fPoints} placeholder="0"
                  onChange={(e) => setFPoints(e.target.value)}
                  style={inp} />
              </div>

              {/* 実支払いプレビュー */}
              <div style={{ gridColumn: "1 / -1", background: "#f8fafc", borderRadius: 8,
                padding: "10px 14px", fontSize: 13, border: "1px solid #e2e8f0" }}>
                {(() => {
                  const sub = (parseInt(fQuantity) || 1) * (parseInt(fUnitPrice) || 0);
                  const coupon = parseInt(fCoupon) || 0;
                  const points = parseInt(fPoints) || 0;
                  const total = Math.max(0, sub - coupon - points);
                  // 自動連動：未手動設定の場合は請求金額を実支払い合計に合わせる
                  if (!billingAmountManuallySet) {
                    const next = String(total);
                    if (fBillingAmount !== next) setFBillingAmount(next);
                  }
                  return (
                    <>
                      <div style={{ color: "#64748b" }}>小計: ¥{sub.toLocaleString()}</div>
                      {coupon > 0 && <div style={{ color: "#059669" }}>クーポン値引き: −¥{coupon.toLocaleString()}</div>}
                      {points > 0 && <div style={{ color: "#d97706" }}>ポイント使用: −¥{points.toLocaleString()}</div>}
                      <div style={{ fontWeight: 900, color: "#1e293b", marginTop: 4, fontSize: 15 }}>
                        実支払い合計: ¥{total.toLocaleString()}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* 請求金額 */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>請求金額（円）</label>
                <input
                  type="number" min={0}
                  value={fBillingAmount}
                  placeholder="実支払い合計と同じ"
                  onChange={(e) => {
                    setFBillingAmount(e.target.value);
                    setBillingAmountManuallySet(true);
                  }}
                  style={{
                    ...inp,
                    background: (() => {
                      const billing = parseInt(fBillingAmount) || 0;
                      const sub = (parseInt(fQuantity) || 1) * (parseInt(fUnitPrice) || 0);
                      const price = Math.max(0, sub - (parseInt(fCoupon) || 0) - (parseInt(fPoints) || 0));
                      return billingAmountManuallySet && billing !== price ? "#fef9c3" : "white";
                    })(),
                  }}
                />
                {billingAmountManuallySet && (() => {
                  const billing = parseInt(fBillingAmount) || 0;
                  const sub = (parseInt(fQuantity) || 1) * (parseInt(fUnitPrice) || 0);
                  const price = Math.max(0, sub - (parseInt(fCoupon) || 0) - (parseInt(fPoints) || 0));
                  return billing !== price ? (
                    <div style={{ fontSize: 11, color: "#d97706", marginTop: 3 }}>
                      ⚠️ 実支払い合計（¥{price.toLocaleString()}）と異なる請求金額です
                    </div>
                  ) : null;
                })()}
              </div>

              {/* 仕入れ先 */}
              <div>
                <label style={lbl}>仕入れ先</label>
                <input value={fShop} onChange={(e) => setFShop(e.target.value)}
                  placeholder="楽天市場 など" style={inp} />
              </div>

              {/* 支払いカード */}
              <div>
                <label style={lbl}>支払いカード</label>
                <select value={fCardId} onChange={(e) => setFCardId(e.target.value)} style={inp}>
                  <option value="">未選択</option>
                  {userCards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__points__">ポイント利用</option>
                </select>
              </div>

              {/* メモ */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>メモ</label>
                <textarea value={fMemo} onChange={(e) => setFMemo(e.target.value)}
                  placeholder="自由記入" rows={2}
                  style={{ ...inp, resize: "vertical" as const }} />
              </div>
            </div>

            {/* ステータス */}
            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
              {([
                { label: "届き済", val: fArrived, set: setFArrived },
                { label: "領収証あり", val: fReceipt, set: setFReceipt },
                { label: "印刷済", val: fPrinted, set: setFPrinted },
                { label: "請求済", val: fBilled, set: setFBilled },
              ] as { label: string; val: boolean; set: (v: boolean) => void }[]).map(({ label, val, set }) => (
                <label key={label} style={{ display: "flex", alignItems: "center", gap: 6,
                  fontSize: 12, cursor: "pointer", userSelect: "none" as const }}>
                  <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} />
                  {label}
                </label>
              ))}
              {/* 経費クラウド（青強調） */}
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12,
                cursor: "pointer", userSelect: "none" as const,
                background: fExpense ? "#dbeafe" : "#f1f5f9",
                padding: "3px 10px", borderRadius: 6, fontWeight: fExpense ? 700 : 400,
                color: fExpense ? "#1e40af" : "#64748b" }}>
                <input type="checkbox" checked={fExpense} onChange={(e) => setFExpense(e.target.checked)} />
                📊 経費クラウドサービス入力済
              </label>
            </div>

            {/* ボタン */}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={handleSave} disabled={saving || !fItemName.trim()}
                className="btn-primary" style={{ flex: 1, fontSize: 14 }}>
                {saving ? "保存中…" : "💾 保存"}
              </button>
              <button onClick={() => setShowEdit(false)}
                style={{ flex: 1, padding: "11px 0", borderRadius: 10,
                  border: "1px solid #e2e8f0", background: "white",
                  color: "#64748b", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== スタイル定数 =====
const lbl: React.CSSProperties = { fontSize: 11, color: "#64748b", display: "block", marginBottom: 3 };
const inp: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 7,
  border: "1px solid #e2e8f0", fontSize: 13,
  fontFamily: "inherit", boxSizing: "border-box" as const,
};
