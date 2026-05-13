"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getIdToken } from "firebase/auth";
import type { CardDoc } from "@/lib/firebase";

// ===== APIヘルパー =====
type AuthUser = NonNullable<ReturnType<typeof import("@/context/AuthContext").useAuth>["user"]>;
async function cardAuthHeader(user: AuthUser) {
  const token = await getIdToken(user);
  return { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
}
async function apiFetchCards(user: AuthUser): Promise<CardDoc[]> {
  const headers = await cardAuthHeader(user);
  const res = await fetch("/api/cards", { headers });
  if (!res.ok) throw new Error(`GET /api/cards: ${res.status}`);
  return ((await res.json()) as { cards: CardDoc[] }).cards;
}
async function apiAddCard(user: AuthUser, card: CardDoc): Promise<void> {
  const headers = await cardAuthHeader(user);
  const res = await fetch("/api/cards", { method: "POST", headers, body: JSON.stringify(card) });
  if (!res.ok) throw new Error(`POST /api/cards: ${res.status}`);
}
async function apiUpdateCard(user: AuthUser, card: CardDoc): Promise<void> {
  const headers = await cardAuthHeader(user);
  const res = await fetch(`/api/cards/${card.id}`, { method: "PUT", headers, body: JSON.stringify(card) });
  if (!res.ok) throw new Error(`PUT /api/cards/${card.id}: ${res.status}`);
}
async function apiDeleteCard(user: AuthUser, id: string): Promise<void> {
  const headers = await cardAuthHeader(user);
  const res = await fetch(`/api/cards/${id}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error(`DELETE /api/cards/${id}: ${res.status}`);
}


const STORAGE_KEY = "otoquest_user_settings";

export interface UserSettings {
  budget: number;
  rakutenRate: number;
  yahooRate: number;
  rakutenCoupon: number;
  yahooCoupon: number;
  kakakuEnabled: boolean;
}

export interface Card {
  id: string;
  name: string;
  limit: number;
  pointRate: number;
  color: string;
}

export const defaultSettings: UserSettings = {
  budget: 30000,
  rakutenRate: 1,
  yahooRate: 1,
  rakutenCoupon: 0,
  yahooCoupon: 0,
  kakakuEnabled: false,
};

export function loadSettings(): UserSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: UserSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const BLANK_CARD: Omit<Card, "id"> = { name: "", limit: 0, pointRate: 1, color: "#1e40af" };

/** カード名に応じた還元率確認リンク */
function getCardConfirmLink(name: string): { label: string; url: string; note: string } | null {
  if (name.includes("楽天")) {
    return {
      label: "楽天SPU現在倍率を確認",
      url: "https://member.rakuten.co.jp/rakuten/spu/",
      note: "ログイン後、現在の倍率を確認して入力してください",
    };
  }
  if (name.includes("PayPay") || name.includes("Yahoo")) {
    return {
      label: "PayPayポイント還元率を確認",
      url: "https://shopping.yahoo.co.jp/promotion/campaign/",
      note: "ログイン後、現在の還元率を確認して入力してください",
    };
  }
  return null;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [saved, setSaved] = useState(false);

  // カード管理 state
  const [cards, setCards] = useState<Card[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Omit<Card, "id">>(BLANK_CARD);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<Omit<Card, "id">>(BLANK_CARD);

  useEffect(() => {
    setSettings(loadSettings());
    if (user) {
      apiFetchCards(user)
        .then((docs) => setCards(docs as Card[]))
        .catch((e) => console.error("[settings] loadCards failed:", e));
    }
  }, [user]);

  const set = <K extends keyof UserSettings>(k: K, v: UserSettings[K]) =>
    setSettings((prev) => ({ ...prev, [k]: v }));

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => {
      router.push("/compare");
    }, 800);
  };

  // ===== カード操作（APIルート経由）=====
  const handleDeleteCard = async (id: string) => {
    if (!user) return;
    try {
      await apiDeleteCard(user, id);
      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error("[settings] deleteCard failed:", e);
    }
  };

  const handleStartEdit = (card: Card) => {
    setEditingId(card.id);
    setEditForm({ name: card.name, limit: card.limit, pointRate: card.pointRate, color: card.color });
    setShowAdd(false);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !user) return;
    const updated: Card = { id: editingId, ...editForm };
    try {
      await apiUpdateCard(user, updated as CardDoc);
      setCards((prev) => prev.map((c) => c.id === editingId ? updated : c));
      setEditingId(null);
    } catch (e) {
      console.error("[settings] updateCard failed:", e);
    }
  };

  const handleAddCard = async () => {
    if (!addForm.name.trim() || !user) return;
    const newCard: Card = { id: `card_${Date.now()}`, ...addForm };
    try {
      await apiAddCard(user, newCard as CardDoc);
      setCards((prev) => [...prev, newCard]);
      setAddForm(BLANK_CARD);
      setShowAdd(false);
    } catch (e) {
      console.error("[settings] addCard failed:", e);
    }
  };

  // インライン入力スタイル共通
  const inputStyle: React.CSSProperties = { fontSize: 13 };
  const colorInputStyle: React.CSSProperties = {
    width: "100%", height: 38, borderRadius: 8,
    border: "1px solid #e2e8f0", cursor: "pointer",
  };
  const cancelBtnStyle: React.CSSProperties = {
    padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0",
    background: "white", color: "#64748b", fontSize: 13,
    cursor: "pointer", fontFamily: "inherit",
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1e40af", marginBottom: 4 }}>
          ⚙️ ユーザー設定
        </h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          還元率・クーポン・購入価格ラインを設定してください。設定後は自動的に価格比較画面へ移動します。
        </p>
      </div>

      {/* 購入価格ライン */}
      <div className="dq-card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="section-header">
          <span>💴</span>
          <h2>購入価格ライン</h2>
        </div>
        <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 6 }}>
          この金額以下なら「購入推奨」と判定します
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16, color: "#64748b" }}>¥</span>
          <input
            type="number"
            className="dq-input"
            value={settings.budget}
            onChange={(e) => set("budget", Number(e.target.value))}
            style={{ width: 160 }}
          />
        </div>
      </div>

      {/* 楽天設定 */}
      <div className="dq-card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="section-header">
          <span>🦅</span>
          <h2>楽天市場</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 6, fontWeight: 600 }}>
              ポイント還元率（%）
            </label>
            <input
              type="number" className="dq-input"
              value={settings.rakutenRate} step="0.5" min="0" max="30"
              onChange={(e) => set("rakutenRate", Number(e.target.value))}
            />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>楽天カード利用時は通常3〜5%</div>
          </div>
          <div>
            <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 6, fontWeight: 600 }}>
              クーポン割引額（円）
            </label>
            <input
              type="number" className="dq-input"
              value={settings.rakutenCoupon} step="100" min="0"
              onChange={(e) => set("rakutenCoupon", Number(e.target.value))}
            />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>利用予定のクーポン金額</div>
          </div>
        </div>
      </div>

      {/* Yahoo!設定 */}
      <div className="dq-card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="section-header">
          <span>🛍️</span>
          <h2>Yahoo!ショッピング</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 6, fontWeight: 600 }}>
              ポイント還元率（%）
            </label>
            <input
              type="number" className="dq-input"
              value={settings.yahooRate} step="0.5" min="0" max="20"
              onChange={(e) => set("yahooRate", Number(e.target.value))}
            />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>PayPayカード利用時は通常2〜3%</div>
          </div>
          <div>
            <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 6, fontWeight: 600 }}>
              クーポン割引額（円）
            </label>
            <input
              type="number" className="dq-input"
              value={settings.yahooCoupon} step="100" min="0"
              onChange={(e) => set("yahooCoupon", Number(e.target.value))}
            />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>利用予定のクーポン金額</div>
          </div>
        </div>
      </div>

      {/* 価格.com */}
      <div className="dq-card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>📋 価格.com 比較を有効にする</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>価格.comの最安値を手動入力して3社比較できます</div>
          </div>
          <div
            onClick={() => set("kakakuEnabled", !settings.kakakuEnabled)}
            style={{
              width: 48, height: 26, borderRadius: 13,
              background: settings.kakakuEnabled ? "#1e40af" : "#e2e8f0",
              cursor: "pointer", position: "relative", transition: "all 0.2s", flexShrink: 0,
            }}
          >
            <div style={{
              position: "absolute", top: 3,
              left: settings.kakakuEnabled ? 26 : 3,
              width: 20, height: 20, borderRadius: "50%",
              background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              transition: "left 0.2s",
            }} />
          </div>
        </div>
      </div>

      {/* ===== カード管理 ===== */}
      <div className="dq-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>💳 カード管理</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>保有クレジットカードの限度額・還元率</div>
          </div>
          <button
            id="add-card-btn"
            onClick={() => { setShowAdd(true); setEditingId(null); }}
            style={{
              padding: "7px 14px", borderRadius: 8, border: "1px solid #1e40af",
              background: "#eff6ff", color: "#1e40af", fontWeight: 700,
              fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            ＋ 追加
          </button>
        </div>

        {/* 追加フォーム */}
        {showAdd && (
          <div style={{
            padding: 16, borderRadius: 10, background: "#f0fdf4",
            border: "1px solid #86efac", marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46", marginBottom: 12 }}>新規カード追加</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "#374151", display: "block", marginBottom: 4 }}>カード名</label>
                <input
                  id="add-card-name"
                  className="dq-input"
                  value={addForm.name}
                  onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="例: 楽天カードゴールド"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#374151", display: "block", marginBottom: 4 }}>カラー</label>
                <input
                  type="color" value={addForm.color}
                  onChange={(e) => setAddForm((p) => ({ ...p, color: e.target.value }))}
                  style={colorInputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#374151", display: "block", marginBottom: 4 }}>限度額（円）</label>
                <input
                  type="number" className="dq-input"
                  value={addForm.limit} min={0} step={10000}
                  onChange={(e) => setAddForm((p) => ({ ...p, limit: Number(e.target.value) }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#374151", display: "block", marginBottom: 4 }}>還元率（%）</label>
                <input
                  type="number" className="dq-input"
                  value={addForm.pointRate} min={0} max={30} step={0.5}
                  onChange={(e) => setAddForm((p) => ({ ...p, pointRate: Number(e.target.value) }))}
                  style={inputStyle}
                />
                {(() => {
                  const link = getCardConfirmLink(addForm.name);
                  if (!link) return null;
                  return (
                    <div style={{ marginTop: 5 }}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: "#1e40af", textDecoration: "underline" }}>
                        🔗 {link.label}
                      </a>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{link.note}</div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button id="save-add-card-btn" onClick={handleAddCard} className="btn-primary" style={{ fontSize: 13, padding: "8px 18px" }}>保存</button>
              <button onClick={() => setShowAdd(false)} style={cancelBtnStyle}>キャンセル</button>
            </div>
          </div>
        )}

        {/* カード一覧 */}
        {cards.length === 0 ? (
          <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "20px 0" }}>
            カードが登録されていません
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cards.map((card) => (
              <div key={card.id}>
                {editingId === card.id ? (
                  <div style={{
                    padding: 16, borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 12 }}>編集中</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "#374151", display: "block", marginBottom: 4 }}>カード名</label>
                        <input
                          className="dq-input" value={editForm.name}
                          onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#374151", display: "block", marginBottom: 4 }}>カラー</label>
                        <input
                          type="color" value={editForm.color}
                          onChange={(e) => setEditForm((p) => ({ ...p, color: e.target.value }))}
                          style={colorInputStyle}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#374151", display: "block", marginBottom: 4 }}>限度額（円）</label>
                        <input
                          type="number" className="dq-input"
                          value={editForm.limit} min={0} step={10000}
                          onChange={(e) => setEditForm((p) => ({ ...p, limit: Number(e.target.value) }))}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#374151", display: "block", marginBottom: 4 }}>還元率（%）</label>
                        <input
                          type="number" className="dq-input"
                          value={editForm.pointRate} min={0} max={30} step={0.5}
                          onChange={(e) => setEditForm((p) => ({ ...p, pointRate: Number(e.target.value) }))}
                          style={inputStyle}
                        />
                        {(() => {
                          const link = getCardConfirmLink(editForm.name);
                          if (!link) return null;
                          return (
                            <div style={{ marginTop: 5 }}>
                              <a href={link.url} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 11, color: "#1e40af", textDecoration: "underline" }}>
                                🔗 {link.label}
                              </a>
                              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{link.note}</div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleSaveEdit} className="btn-primary" style={{ fontSize: 13, padding: "8px 18px" }}>保存</button>
                      <button onClick={() => setEditingId(null)} style={cancelBtnStyle}>キャンセル</button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: 10,
                    border: "1px solid #e2e8f0", background: "#fafafa",
                  }}>
                    <div style={{ width: 6, height: 44, borderRadius: 3, background: card.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{card.name}</div>
                      <div style={{ display: "flex", gap: 14, marginTop: 3 }}>
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          限度額: <strong style={{ color: "#374151" }}>¥{card.limit.toLocaleString()}</strong>
                        </span>
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          還元率: <strong style={{ color: "#059669" }}>{card.pointRate}%</strong>
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => handleStartEdit(card)}
                        style={{
                          padding: "5px 12px", borderRadius: 7, border: "1px solid #e2e8f0",
                          background: "white", color: "#374151", fontSize: 12,
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        style={{
                          padding: "5px 12px", borderRadius: 7, border: "1px solid #fca5a5",
                          background: "#fff5f5", color: "#dc2626", fontSize: 12,
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 保存ボタン */}
      {saved ? (
        <div style={{
          padding: "14px 20px", borderRadius: 10,
          background: "#d1fae5", border: "1px solid #6ee7b7",
          color: "#065f46", fontWeight: 700, fontSize: 14, textAlign: "center",
        }}>
          ✅ 保存完了！価格比較ページへ移動中… +5GP獲得！
        </div>
      ) : (
        <button className="btn-primary" onClick={handleSave} style={{ width: "100%", fontSize: 15 }}>
          💾 保存して価格比較へ →
        </button>
      )}

      {/* ④ データリセット */}
      <div className="dq-card" style={{ padding: 20, marginTop: 24, border: "1px solid #fca5a5", background: "#fff5f5" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>
          ⚠️ 危険ゾーン
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
          アプリのすべてのデータ（カード設定・購入履歴・オンボーディング状態）を削除して初期状態に戻します。この操作は取り消せません。
        </div>
        <button
          id="reset-app-data-btn"
          onClick={() => {
            const ok = window.confirm(
              "すべてのデータを削除してオンボーディングからやり直します。よろしいですか？"
            );
            if (!ok) return;
            // otoquest_ プレフィックスのキーをすべて削除
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith("otoquest_")) keysToRemove.push(key);
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));
            router.push("/onboarding");
          }}
          style={{
            padding: "10px 20px", borderRadius: 8,
            border: "1px solid #dc2626", background: "white",
            color: "#dc2626", fontWeight: 700, fontSize: 13,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          🗑️ アプリデータをリセット
        </button>
      </div>
    </div>
  );
}
