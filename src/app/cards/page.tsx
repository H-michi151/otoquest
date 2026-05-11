"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { loadUserCards, addUserCard, updateUserCard, deleteUserCard, type CardDoc } from "@/lib/firebase";

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

  // Firestoreから再取得
  const reloadCards = async (uid: string) => {
    setLoading(true);
    try {
      const docs = await loadUserCards(uid);
      setCards(docs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    reloadCards(user.uid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);



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
        // ① 楽観的更新（即時UI反映）
        setCards((prev) => prev.map((c) => c.id === editingId ? updated : c));
        // ② Firestoreに書き込み
        await updateUserCard(user.uid, updated);
      } else {
        const id = `card_${Date.now()}`;
        const newCard: CardDoc = { id, ...form };
        // ① 楽観的更新（即時UI反映）
        setCards((prev) => [...prev, newCard]);
        // ② Firestoreに書き込み
        await addUserCard(user.uid, newCard);
      }
      setSaveMsg("✅ 保存しました");
      setTimeout(() => setSaveMsg(""), 2000);
      // ③ 書き込み完了後にFirestoreから再取得してサーバー値で同期
      //    （書き込み直後は若干の遅延が必要な場合あり）
      setTimeout(async () => {
        if (!user) return;
        const refreshed = await loadUserCards(user.uid);
        if (refreshed.length > 0) setCards(refreshed);
      }, 800);
    } catch (e) {
      console.error("[cards] save failed:", e);
      setSaveMsg(`❌ 保存に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
      // ロールバック: Firestoreから最新を取得して整合性を回復
      const rollback = await loadUserCards(user.uid);
      setCards(rollback);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このカードを削除しますか？") || !user) return;
    setSaving(true);
    try {
      // 削除: 1件だけdeleteDoc
      await deleteUserCard(user.uid, id);
      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error("[cards] delete failed:", e);
      setSaveMsg(`❌ 削除に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
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

              {/* 操作ボタン */}
              <div style={{ display: "flex", gap: 8 }}>
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
