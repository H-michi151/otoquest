"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getIdToken } from "firebase/auth";
import type { CardDoc } from "@/lib/firebase";
import { loadMonthlyPurchasesByCard } from "@/lib/firebase";

// ===== APIヘルパー =====
type AuthUser = NonNullable<ReturnType<typeof useAuth>["user"]>;

async function authHeader(user: AuthUser) {
  const token = await getIdToken(user);
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function apiFetchCards(user: AuthUser): Promise<CardDoc[]> {
  const headers = await authHeader(user);
  const res = await fetch("/api/cards", { headers });
  if (!res.ok) throw new Error(`GET /api/cards: ${res.status}`);
  const data = await res.json() as { cards: CardDoc[] };
  return data.cards;
}

async function apiAddCard(user: AuthUser, card: CardDoc): Promise<void> {
  const headers = await authHeader(user);
  const res = await fetch("/api/cards", {
    method: "POST",
    headers,
    body: JSON.stringify(card),
  });
  if (!res.ok) throw new Error(`POST /api/cards: ${res.status}`);
}

async function apiUpdateCard(user: AuthUser, card: CardDoc): Promise<void> {
  const headers = await authHeader(user);
  const res = await fetch(`/api/cards/${card.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(card),
  });
  if (!res.ok) throw new Error(`PUT /api/cards/${card.id}: ${res.status}`);
}

async function apiDeleteCard(user: AuthUser, id: string): Promise<void> {
  const headers = await authHeader(user);
  const res = await fetch(`/api/cards/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(`DELETE /api/cards/${id}: ${res.status}`);
}

// ===== 返済API =====
interface RepaymentRecord { id: string; amount: number; date: string; note: string | null; }

async function apiFetchRepayments(user: AuthUser, cardId: string, month: string): Promise<RepaymentRecord[]> {
  const headers = await authHeader(user);
  const res = await fetch(`/api/repayments?cardId=${encodeURIComponent(cardId)}&month=${month}`, { headers });
  if (!res.ok) throw new Error(`GET /api/repayments: ${res.status}`);
  return ((await res.json()) as { repayments: RepaymentRecord[] }).repayments;
}

async function apiPostRepayment(user: AuthUser, cardId: string, amount: number): Promise<void> {
  const headers = await authHeader(user);
  const res = await fetch("/api/repayments", { method: "POST", headers, body: JSON.stringify({ cardId, amount }) });
  if (!res.ok) throw new Error(`POST /api/repayments: ${res.status}`);
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const COLORS = ["#cc0000", "#1a237e", "#1b5e20", "#4a148c", "#e65100", "#006064", "#37474f"];
const COLOR_LABELS: Record<string, string> = {
  "#cc0000": "赤",
  "#1a237e": "紺",
  "#1b5e20": "緑",
  "#4a148c": "紫",
  "#e65100": "橙",
  "#006064": "青緑",
  "#37474f": "グレー",
};

const EMPTY_FORM: Omit<CardDoc, "id"> = {
  name: "",
  limit: 0,
  pointRate: 1,
  color: "#cc0000",
};

export default function CardsPage() {
  const { user } = useAuth();
  const [cards, setCards] = useState<CardDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<CardDoc, "id">>(EMPTY_FORM);
  const [saveMsg, setSaveMsg] = useState("");

  // 体力パネル state
  const [repaymentMap, setRepaymentMap] = useState<Record<string, RepaymentRecord[]>>({});
  const [purchasesMap, setPurchasesMap] = useState<Record<string, number>>({});
  const [recoverModal, setRecoverModal] = useState<{ cardId: string; cardName: string } | null>(null);
  const [repayAmount, setRepayAmount] = useState("");
  const [repayLoading, setRepayLoading] = useState(false);

  // 返済・購入データ取得
  const loadRepayments = useCallback(async (cardList: CardDoc[]) => {
    if (!user) return;
    const month = currentYearMonth();
    const [repEntries, purEntries] = await Promise.all([
      Promise.all(
        cardList.map(async (c) => {
          try {
            const list = await apiFetchRepayments(user, c.id, month);
            return [c.id, list] as [string, RepaymentRecord[]];
          } catch {
            return [c.id, []] as [string, RepaymentRecord[]];
          }
        })
      ),
      Promise.all(
        cardList.map(async (c) => {
          try {
            const total = await loadMonthlyPurchasesByCard(user.uid, c.id, month);
            return [c.id, total] as [string, number];
          } catch {
            return [c.id, 0] as [string, number];
          }
        })
      ),
    ]);
    setRepaymentMap(Object.fromEntries(repEntries));
    setPurchasesMap(Object.fromEntries(purEntries));
  }, [user]);

  // API経由でカード再取得
  const reloadCards = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const docs = await apiFetchCards(user);
      setCards(docs);
      await loadRepayments(docs);
    } catch (e) {
      console.error("[cards] reloadCards failed:", e);
    } finally {
      setLoading(false);
    }
  }, [user, loadRepayments]);

  useEffect(() => {
    if (!user) return;
    reloadCards();
  }, [user, reloadCards]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (card: CardDoc) => {
    setEditingId(card.id);
    setForm({ name: card.name, limit: card.limit, pointRate: card.pointRate, color: card.color });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !user) return;
    setSaving(true);
    setShowForm(false);
    try {
      if (editingId) {
        const updated: CardDoc = { id: editingId, ...form };
        setCards((prev) => prev.map((c) => c.id === editingId ? updated : c));
        await apiUpdateCard(user, updated);
      } else {
        const id = `card_${Date.now()}`;
        const newCard: CardDoc = { id, ...form };
        setCards((prev) => [...prev, newCard]);
        await apiAddCard(user, newCard);
      }
      setSaveMsg("✅ 保存しました");
      setTimeout(() => setSaveMsg(""), 2000);
      setTimeout(() => reloadCards(), 800);
    } catch (e) {
      console.error("[cards] save failed:", e);
      setSaveMsg(`❌ 保存に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
      reloadCards();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このカードを削除しますか？") || !user) return;
    setSaving(true);
    try {
      setCards((prev) => prev.filter((c) => c.id !== id));
      await apiDeleteCard(user, id);
    } catch (e) {
      console.error("[cards] delete failed:", e);
      setSaveMsg(`❌ 削除に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
      reloadCards();
    } finally {
      setSaving(false);
    }
  };

  // 回復モーダル処理
  const openRecoverModal = (card: CardDoc) => {
    setRecoverModal({ cardId: card.id, cardName: card.name });
    setRepayAmount("");
  };
  const closeRecoverModal = () => { setRecoverModal(null); setRepayAmount(""); };

  const handleRepay = async (amount: number) => {
    if (!user || !recoverModal || amount <= 0) return;
    setRepayLoading(true);
    try {
      await apiPostRepayment(user, recoverModal.cardId, amount);
      const month = currentYearMonth();
      const updated = await apiFetchRepayments(user, recoverModal.cardId, month);
      setRepaymentMap((prev) => ({ ...prev, [recoverModal.cardId]: updated }));
      closeRecoverModal();
    } catch (e) {
      console.error("[repay]", e);
    } finally {
      setRepayLoading(false);
    }
  };

  // 体力パネルレンダラー
  const renderHealthPanel = (card: CardDoc) => {
    const limit = card.limit ?? 0;
    if (!limit) return null;
    const repayments = repaymentMap[card.id] ?? [];
    const totalRepaid = repayments.reduce((s, r) => s + r.amount, 0);
    const purchases = purchasesMap[card.id] ?? 0;
    const usedAmount = Math.max(0, purchases - totalRepaid);
    const remaining = limit - usedAmount;
    const usageRate = purchases / limit * 100;
    const barColor = usageRate >= 95 ? "#dc2626" : usageRate >= 80 ? "#f97316" : "#16a34a";
    const textColor = usageRate >= 95 ? "#dc2626" : usageRate >= 80 ? "#f97316" : "#16a34a";
    return (
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #e2e8f0" }}>
        <div style={{ height: 8, borderRadius: 4, background: "#e2e8f0", overflow: "hidden", marginBottom: 6 }}>
          <div style={{
            height: "100%", width: `${Math.min(usageRate, 100)}%`,
            background: barColor, borderRadius: 4, transition: "width 0.4s",
          }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: textColor, fontWeight: 700 }}>
            残枠 {remaining.toLocaleString()}円 / {limit.toLocaleString()}円
          </span>
          <button
            onClick={() => openRecoverModal(card)}
            style={{
              padding: "3px 10px", borderRadius: 6, border: "1px solid #7c3aed",
              background: "#f5f3ff", color: "#7c3aed", fontSize: 11,
              cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
            }}
          >
            💊 回復する
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48, color: "#64748b" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
        <div>カード情報を読み込み中...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* ページヘッダー */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1e40af", marginBottom: 4 }}>
            💳 カード管理
          </h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>
            保有カードを登録すると、商品検索の還元率計算に反映されます。
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{
            padding: "10px 20px", borderRadius: 8,
            background: "linear-gradient(90deg,#1e40af,#3b82f6)",
            color: "white", fontSize: 13, fontWeight: 700,
            border: "none", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          ＋ カードを追加
        </button>
      </div>

      {/* 保存メッセージ */}
      {saveMsg && (
        <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 8, background: saveMsg.startsWith("✅") ? "#f0fdf4" : "#fff1f2", border: `1px solid ${saveMsg.startsWith("✅") ? "#86efac" : "#fca5a5"}`, fontSize: 13, color: saveMsg.startsWith("✅") ? "#065f46" : "#9f1239" }}>
          {saveMsg}
        </div>
      )}

      {/* カード一覧 */}
      {cards.length === 0 ? (
        <div className="dq-card" style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💳</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: "#64748b" }}>まだカードが登録されていません</div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>「＋ カードを追加」からクレジットカードを登録してください。</div>
          <button
            onClick={openAdd}
            style={{ padding: "10px 24px", borderRadius: 8, background: "#1e40af", color: "white", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            ＋ カードを追加
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {cards.map((card) => (
            <div key={card.id} className="dq-card" style={{ padding: 20 }}>
              {/* カードビジュアル */}
              <div style={{
                height: 80, borderRadius: 10, marginBottom: 14,
                background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}99 100%)`,
                display: "flex", alignItems: "flex-end", padding: "12px 14px",
                boxShadow: `0 4px 14px ${card.color}44`,
              }}>
                <div style={{ color: "white", fontWeight: 900, fontSize: 15, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
                  {card.name}
                </div>
              </div>

              {/* 数値情報 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 10, color: "#64748b" }}>ポイント還元率</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#1e40af" }}>{card.pointRate}%</div>
                </div>
                <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 10, color: "#64748b" }}>利用限度額</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#374151" }}>
                    {card.limit > 0 ? `¥${card.limit.toLocaleString()}` : "—"}
                  </div>
                </div>
              </div>

              {/* 体力パネル */}
              {renderHealthPanel(card)}

              {/* 操作ボタン */}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => openEdit(card)}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 6,
                    border: "1px solid #e2e8f0", background: "white",
                    color: "#374151", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  ✏️ 編集
                </button>
                <button
                  onClick={() => handleDelete(card.id)}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 6,
                    border: "1px solid #fca5a5", background: "#fff1f2",
                    color: "#dc2626", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  🗑️ 削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 回復モーダル */}
      {recoverModal && (() => {
        const card = cards.find((c) => c.id === recoverModal.cardId);
        const repayments = repaymentMap[recoverModal.cardId] ?? [];
        const totalRepaid = repayments.reduce((s, r) => s + r.amount, 0);
        const purchases = purchasesMap[recoverModal.cardId] ?? 0;
        const usedAmount = Math.max(0, purchases - totalRepaid);
        return (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }} onClick={closeRecoverModal}>
            <div style={{
              background: "white", borderRadius: 16, padding: 28, width: 340, maxWidth: "90vw",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#7c3aed", marginBottom: 4 }}>💊 回復する</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>{card?.name}</div>
              <div style={{
                padding: "10px 14px", borderRadius: 8, background: "#f5f3ff",
                fontSize: 13, color: "#374151", marginBottom: 16,
              }}>
                現在の使用額: <strong style={{ color: "#7c3aed" }}>{usedAmount.toLocaleString()}円</strong>
              </div>
              <input
                type="number"
                placeholder="金額を入力（円）"
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8,
                  border: "1px solid #c4b5fd", fontSize: 14, marginBottom: 12,
                  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  disabled={repayLoading || usedAmount <= 0}
                  onClick={() => handleRepay(usedAmount)}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 8,
                    border: "2px solid #7c3aed", background: "#7c3aed",
                    color: "white", fontWeight: 900, fontSize: 13,
                    cursor: repayLoading || usedAmount <= 0 ? "not-allowed" : "pointer",
                    fontFamily: "inherit", opacity: usedAmount <= 0 ? 0.5 : 1,
                  }}
                >✨ ベホマ</button>
                <button
                  disabled={repayLoading || !repayAmount || Number(repayAmount) <= 0}
                  onClick={() => handleRepay(Number(repayAmount))}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 8,
                    border: "2px solid #16a34a", background: "#16a34a",
                    color: "white", fontWeight: 700, fontSize: 13,
                    cursor: repayLoading || !repayAmount ? "not-allowed" : "pointer",
                    fontFamily: "inherit", opacity: !repayAmount || Number(repayAmount) <= 0 ? 0.5 : 1,
                  }}
                >💊 回復する</button>
              </div>
              <button
                onClick={closeRecoverModal}
                style={{
                  marginTop: 10, width: "100%", padding: "8px 0", borderRadius: 8,
                  border: "1px solid #e2e8f0", background: "white", color: "#64748b",
                  fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                }}
              >キャンセル</button>
            </div>
          </div>
        );
      })()}

      {/* 追加・編集フォーム（モーダル風） */}
      {showForm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div style={{
            background: "white", borderRadius: 16, padding: 28,
            width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1e40af", marginBottom: 20 }}>
              {editingId ? "✏️ カードを編集" : "＋ カードを追加"}
            </h2>

            {/* カード名 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#374151", fontWeight: 600, display: "block", marginBottom: 5 }}>
                カード名 <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例：楽天カード、PayPayカード"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* ポイント還元率 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#374151", fontWeight: 600, display: "block", marginBottom: 5 }}>
                ポイント還元率（%）
              </label>
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={form.pointRate}
                onChange={(e) => setForm({ ...form, pointRate: Number(e.target.value) })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* 限度額 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#374151", fontWeight: 600, display: "block", marginBottom: 5 }}>
                利用限度額（円、未設定は0）
              </label>
              <input
                type="number"
                min={0}
                step={10000}
                value={form.limit}
                onChange={(e) => setForm({ ...form, limit: Number(e.target.value) })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* カラー */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 12, color: "#374151", fontWeight: 600, display: "block", marginBottom: 8 }}>カード色</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    title={COLOR_LABELS[c]}
                    style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: c, border: form.color === c ? "3px solid #1e40af" : "2px solid transparent",
                      cursor: "pointer", outline: form.color === c ? "2px solid #bfdbfe" : "none",
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* プレビュー */}
            {form.name && (
              <div style={{
                height: 60, borderRadius: 10, marginBottom: 18,
                background: `linear-gradient(135deg, ${form.color} 0%, ${form.color}99 100%)`,
                display: "flex", alignItems: "flex-end", padding: "10px 14px",
              }}>
                <div style={{ color: "white", fontWeight: 900, fontSize: 14, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
                  {form.name}
                </div>
              </div>
            )}

            {/* ボタン */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowForm(false)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #e2e8f0", background: "white", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.name.trim() || saving}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  background: form.name.trim() ? "linear-gradient(90deg,#1e40af,#3b82f6)" : "#e2e8f0",
                  color: form.name.trim() ? "white" : "#94a3b8",
                  fontSize: 13, fontWeight: 700, border: "none",
                  cursor: form.name.trim() ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                }}
              >
                {saving ? "保存中..." : editingId ? "更新する" : "追加する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 注意書き */}
      <div style={{ marginTop: 24, padding: "10px 14px", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 12, color: "#1e40af" }}>
        💡 登録したカードのポイント還元率は商品検索画面の「実質価格」計算に自動反映されます。
      </div>
    </div>
  );
}
