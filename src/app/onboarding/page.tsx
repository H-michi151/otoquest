"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getIdToken } from "firebase/auth";
import { type Card } from "@/app/settings/page";

// ===== 型 =====
interface CardDraft {
  name: string;
  limit: string;
  pointRate: string;
  color: string;
}

const BLANK_DRAFT: CardDraft = { name: "", limit: "", pointRate: "1", color: "#1e40af" };

const COLOR_PRESETS = [
  { label: "楽天レッド",  color: "#bf0000" },
  { label: "PayPayレッド", color: "#ff0033" },
  { label: "ブルー",      color: "#1e40af" },
  { label: "グリーン",    color: "#059669" },
  { label: "ゴールド",    color: "#d97706" },
  { label: "パープル",    color: "#7c3aed" },
];

/** カード名に応じた還元率確認リンク */
function getCardConfirmLink(name: string): { label: string; url: string } | null {
  if (name.includes("楽天")) {
    return { label: "楽天SPU現在倍率を確認", url: "https://member.rakuten.co.jp/rakuten/spu/" };
  }
  if (name.includes("PayPay") || name.includes("Yahoo")) {
    return { label: "PayPayポイント還元率を確認", url: "https://shopping.yahoo.co.jp/promotion/campaign/" };
  }
  return null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cards, setCards] = useState<CardDraft[]>([{ ...BLANK_DRAFT }]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // ===== Step2: カード操作 =====
  const updateCard = (idx: number, field: keyof CardDraft, value: string) => {
    setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const addCard = () => setCards((prev) => [...prev, { ...BLANK_DRAFT }]);
  const removeCard = (idx: number) => setCards((prev) => prev.filter((_, i) => i !== idx));

  const validateAndNext = async () => {
    if (saving) return;
    const errs: string[] = [];
    cards.forEach((c, i) => {
      if (!c.name.trim()) errs.push(`カード${i + 1}: 名前を入力してください`);
      if (!c.limit || Number(c.limit) <= 0) errs.push(`カード${i + 1}: 限度額は1以上を入力してください`);
      if (c.pointRate === "" || Number(c.pointRate) < 0) errs.push(`カード${i + 1}: 還元率を入力してください`);
    });
    if (cards.length === 0) errs.push("カードを1枚以上登録してください");
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setSaving(true);
    try {
      const saved: Card[] = cards.map((c, i) => ({
        id: `card_${Date.now()}_${i}`,
        name: c.name.trim(),
        limit: Number(c.limit),
        pointRate: Number(c.pointRate),
        color: c.color,
      }));
      if (user) {
        const token = await getIdToken(user);
        await Promise.all(
          saved.map((c) =>
            fetch("/api/cards", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(c),
            }).then((res) => {
              if (!res.ok) throw new Error(`POST /api/cards: ${res.status}`);
            })
          )
        );
      } else {
        console.warn("[Onboarding] userがnullのためFirestore保存をスキップ");
      }
    } catch (e) {
      console.error("[Onboarding] カード保存エラー:", e);
    } finally {
      setSaving(false);
      setStep(3);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("otoquest_onboarded", "true");
    router.push("/search");
  };

  // ===== 共通スタイル =====
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: "1px solid #e2e8f0", fontSize: 14,
    fontFamily: "inherit", background: "white",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #06b6d4 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
    }}>
      <div style={{
        width: "100%", maxWidth: 520,
        background: "white", borderRadius: 24,
        padding: "40px 36px",
        boxShadow: "0 30px 80px rgba(0,0,0,0.2)",
      }}>

        {/* ステップインジケーター */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 36 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 13,
                background: step >= s ? "#1e40af" : "#f1f5f9",
                color: step >= s ? "white" : "#94a3b8",
                transition: "all 0.3s",
              }}>{s}</div>
              {s < 3 && (
                <div style={{
                  width: 40, height: 2,
                  background: step > s ? "#1e40af" : "#e2e8f0",
                  transition: "background 0.3s",
                }} />
              )}
            </div>
          ))}
        </div>

        {/* ===== STEP 1: ようこそ ===== */}
        {step === 1 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🗡️</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "#1e293b", marginBottom: 10 }}>
              オトクエストへようこそ！
            </h1>
            <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.7, marginBottom: 32 }}>
              スマート購買最適化プラットフォームへ。<br />
              カードを登録するだけで、最安値・最大ポイント還元を<br />
              自動で見つけます。まずはカードを登録しましょう！
            </p>
            <div style={{
              display: "flex", flexDirection: "column", gap: 12,
              marginBottom: 28, textAlign: "left",
            }}>
              {[
                ["💰", "実質価格で最安値を自動判定"],
                ["💳", "カード還元率を加味した賢い比較"],
                ["📊", "月次ダッシュボードで支出を管理"],
              ].map(([icon, text]) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <span style={{ fontSize: 14, color: "#374151" }}>{text}</span>
                </div>
              ))}
            </div>
            <button
              id="onboarding-start-btn"
              onClick={() => setStep(2)}
              style={{
                width: "100%", padding: "15px 0", borderRadius: 12,
                border: "none", background: "linear-gradient(90deg, #1e40af, #3b82f6)",
                color: "white", fontSize: 16, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 16px rgba(30,64,175,0.35)",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(30,64,175,0.4)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(30,64,175,0.35)";
              }}
            >
              始める →
            </button>
          </div>
        )}

        {/* ===== STEP 2: カード登録 ===== */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 21, fontWeight: 900, color: "#1e293b", marginBottom: 6 }}>
              💳 カードを登録
            </h2>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
              保有するクレジットカードを1枚以上登録してください。
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 20 }}>
              {cards.map((card, idx) => (
                <div key={idx} style={{
                  padding: 18, borderRadius: 14,
                  border: "1px solid #e2e8f0", background: "#fafafa",
                  position: "relative",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 700, color: "#64748b",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <div style={{ width: 5, height: 18, borderRadius: 3, background: card.color }} />
                      カード {idx + 1}
                    </div>
                    {cards.length > 1 && (
                      <button
                        onClick={() => removeCard(idx)}
                        style={{
                          padding: "4px 10px", borderRadius: 6,
                          border: "1px solid #fca5a5", background: "#fff5f5",
                          color: "#dc2626", fontSize: 11, cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >削除</button>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4, fontWeight: 600 }}>
                        カード名 *
                      </label>
                      <input
                        style={inputStyle}
                        placeholder="例: 楽天カードゴールド"
                        value={card.name}
                        onChange={(e) => updateCard(idx, "name", e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4, fontWeight: 600 }}>
                        限度額（円）*
                      </label>
                      <input
                        type="number"
                        style={inputStyle}
                        placeholder="500000"
                        value={card.limit}
                        min={0}
                        step={10000}
                        onChange={(e) => updateCard(idx, "limit", e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4, fontWeight: 600 }}>
                        還元率（%）*
                      </label>
                      <input
                        type="number"
                        style={inputStyle}
                        placeholder="1"
                        value={card.pointRate}
                        min={0}
                        max={30}
                        step={0.5}
                        onChange={(e) => updateCard(idx, "pointRate", e.target.value)}
                      />
                      {/* 還元率確認リンク（動的表示） */}
                      {(() => {
                        const link = getCardConfirmLink(card.name);
                        if (!link) return null;
                        return (
                          <a href={link.url} target="_blank" rel="noopener noreferrer"
                            style={{ display: "block", marginTop: 6, fontSize: 11, color: "#1e40af", textDecoration: "underline" }}>
                            🔗 {link.label}
                          </a>
                        );
                      })()}
                    </div>
                  </div>

                  {/* カラープリセット */}
                  <div>
                    <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 6, fontWeight: 600 }}>
                      カラー
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {COLOR_PRESETS.map((p) => (
                        <button
                          key={p.color}
                          title={p.label}
                          onClick={() => updateCard(idx, "color", p.color)}
                          style={{
                            width: 28, height: 28, borderRadius: "50%",
                            background: p.color, border: "none", cursor: "pointer",
                            outline: card.color === p.color ? `3px solid ${p.color}` : "none",
                            outlineOffset: 2,
                            boxShadow: card.color === p.color ? "0 0 0 2px white" : "none",
                            transition: "all 0.15s",
                          }}
                        />
                      ))}
                      <input
                        type="color"
                        value={card.color}
                        onChange={(e) => updateCard(idx, "color", e.target.value)}
                        style={{
                          width: 28, height: 28, borderRadius: "50%",
                          border: "1px solid #e2e8f0", cursor: "pointer", padding: 1,
                        }}
                        title="カスタムカラー"
                      />
                    </div>
                  </div>
                  {/* 入力ガイド */}
                  <div style={{
                    marginTop: 10, padding: "8px 10px", borderRadius: 8,
                    background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 11, color: "#1e40af",
                  }}>
                    💡 還元率はログイン後の現在値を入力してください。後から設定画面でいつでも変更できます。
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addCard}
              style={{
                width: "100%", padding: "11px 0", borderRadius: 10,
                border: "2px dashed #cbd5e1", background: "transparent",
                color: "#64748b", fontSize: 14, cursor: "pointer",
                fontFamily: "inherit", marginBottom: 20,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1e40af"; (e.currentTarget as HTMLElement).style.color = "#1e40af"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#cbd5e1"; (e.currentTarget as HTMLElement).style.color = "#64748b"; }}
            >
              ＋ カードを追加
            </button>

            {/* エラー表示 */}
            {errors.length > 0 && (
              <div style={{
                padding: 14, borderRadius: 10, marginBottom: 16,
                background: "#fff5f5", border: "1px solid #fca5a5",
              }}>
                {errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#dc2626", marginBottom: i < errors.length - 1 ? 4 : 0 }}>
                    ⚠️ {e}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  padding: "13px 20px", borderRadius: 10,
                  border: "1px solid #e2e8f0", background: "white",
                  color: "#64748b", fontSize: 14, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >← 戻る</button>
              <button
                id="onboarding-next-btn"
                onClick={validateAndNext}
                disabled={saving}
                style={{
                  flex: 1, padding: "13px 0", borderRadius: 10,
                  border: "none",
                  background: saving
                    ? "#94a3b8"
                    : "linear-gradient(90deg, #1e40af, #3b82f6)",
                  color: "white", fontSize: 15, fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  boxShadow: saving ? "none" : "0 4px 12px rgba(30,64,175,0.3)",
                }}
              >
                {saving ? "保存中…" : "次へ →"}
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 3: 完了 ===== */}
        {step === 3 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: "#1e293b", marginBottom: 10 }}>
              セットアップ完了！
            </h2>
            <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.8, marginBottom: 8 }}>
              カードの登録が完了しました。<br />
              商品を検索して最安値・最大ポイントを見つけましょう！
            </p>

            {/* 登録カードのプレビュー */}
            <div style={{ margin: "20px 0", textAlign: "left" }}>
              {cards.map((c, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 10,
                  border: "1px solid #e2e8f0", background: "#fafafa",
                  marginBottom: 8,
                }}>
                  <div style={{ width: 5, height: 32, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      限度額: ¥{Number(c.limit).toLocaleString()} ／ 還元率: {c.pointRate}%
                    </div>
                  </div>
                  <span style={{ fontSize: 18 }}>✅</span>
                </div>
              ))}
            </div>

            <button
              id="onboarding-complete-btn"
              onClick={handleComplete}
              style={{
                width: "100%", padding: "16px 0", borderRadius: 12,
                border: "none", background: "linear-gradient(90deg, #059669, #10b981)",
                color: "white", fontSize: 16, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 16px rgba(5,150,105,0.35)",
                transition: "transform 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.transform = "translateY(0)"}
            >
              ⚔️ 検索を始める →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
