"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const HISTORY_KEY = "otoquest_purchase_history";

interface PurchaseRecord {
  id: string;
  shop: string;
  shopLabel: string;
  basePrice: number;
  realPrice: number;
  savedAmount: number;
  couponUsed: boolean;
  pointsEarned: number;
  purchasedAt: string;
}

export function loadHistory(): PurchaseRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(records: PurchaseRecord[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
}

const SHOP_LABELS: Record<string, { label: string; icon: string; couponUrl: string; color: string }> = {
  rakuten: { label: "楽天市場", icon: "🦅", couponUrl: "https://coupon.rakuten.co.jp/", color: "#cc0000" },
  yahoo:   { label: "Yahoo!ショッピング", icon: "🛍️", couponUrl: "https://coupon.yahoo.co.jp/", color: "#FF0033" },
};

type StepId = "compare" | "coupon" | "item" | "record";

interface Step {
  id: StepId;
  label: string;
  desc: string;
}

const STEPS: Step[] = [
  { id: "compare", label: "STEP 1: 価格比較完了", desc: "最安ショップを確認しました" },
  { id: "coupon",  label: "STEP 2: クーポンを取得する", desc: "クーポンページでクーポンを取得してください" },
  { id: "item",    label: "STEP 3: 商品ページへ移動", desc: "商品を購入してください" },
  { id: "record",  label: "STEP 4: 購入完了を記録", desc: "購入金額と節約額を記録してGPを獲得！" },
];

function AssistInner() {
  const router = useRouter();
  const params = useSearchParams();
  const shop     = params.get("shop") ?? "rakuten";
  const itemUrl  = params.get("url") ?? "";
  const realPrice = Number(params.get("realPrice") ?? "0");
  const basePrice = Number(params.get("basePrice") ?? "0");

  const shopInfo = SHOP_LABELS[shop] ?? SHOP_LABELS.rakuten;

  const [done, setDone] = useState<Record<StepId, boolean>>({
    compare: true,
    coupon:  false,
    item:    false,
    record:  false,
  });

  // 購入記録モーダル
  const [showModal, setShowModal] = useState(false);
  const [inputPrice, setInputPrice] = useState(String(realPrice || ""));
  const [couponUsed, setCouponUsed] = useState(false);

  const markDone = (id: StepId) => setDone((prev) => ({ ...prev, [id]: true }));

  const handleCoupon = () => {
    window.open(shopInfo.couponUrl, "_blank");
    markDone("coupon");
  };

  const handleItem = () => {
    if (itemUrl) window.open(itemUrl, "_blank");
    markDone("item");
  };

  const handleRecord = () => {
    const price = Number(inputPrice);
    if (isNaN(price) || price <= 0) return;
    const saved = basePrice > 0 ? basePrice - price : 0;

    const record: PurchaseRecord = {
      id:          `p_${Date.now()}`,
      shop,
      shopLabel:   shopInfo.label,
      basePrice,
      realPrice:   price,
      savedAmount: saved,
      couponUsed,
      pointsEarned: Math.round(price * 0.01),
      purchasedAt: new Date().toISOString(),
    };

    const history = loadHistory();
    saveHistory([record, ...history]);
    markDone("record");
    setShowModal(false);
    setTimeout(() => router.push("/history"), 600);
  };

  const completedCount = Object.values(done).filter(Boolean).length;
  const progressPct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1e40af", marginBottom: 4 }}>
          ⚡ ワンクリックアシスト
        </h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          {shopInfo.icon} {shopInfo.label} での購入をステップでサポートします
        </p>
      </div>

      {/* 進捗バー */}
      <div className="dq-card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>購入進捗</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>{completedCount} / {STEPS.length} 完了</span>
        </div>
        <div className="hp-bar">
          <div className="gp-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* ステップ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {STEPS.map((step, i) => {
          const isDone = done[step.id];
          const isActive = !isDone && i === STEPS.findIndex((s) => !done[s.id]);

          return (
            <div
              key={step.id}
              className="dq-card"
              style={{
                padding: 20,
                border: isActive ? "2px solid #1e40af" : isDone ? "2px solid #059669" : undefined,
                opacity: !isDone && !isActive ? 0.5 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: isDone ? "#059669" : isActive ? "#1e40af" : "#e2e8f0",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {isDone ? "✓" : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isDone ? "#059669" : "#1e293b" }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{step.desc}</div>
                </div>

                {/* アクションボタン */}
                {isActive && step.id === "coupon" && (
                  <button className="btn-primary" onClick={handleCoupon} style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                    クーポンページを開く →
                  </button>
                )}
                {isActive && step.id === "item" && (
                  <button className="btn-primary" onClick={handleItem} style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                    購入ページを開く →
                  </button>
                )}
                {isActive && step.id === "record" && (
                  <button className="btn-primary" onClick={() => setShowModal(true)} style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                    購入完了を記録する →
                  </button>
                )}
                {isDone && <span style={{ fontSize: 20 }}>✅</span>}
              </div>

              {/* STEP3: URLがない場合の案内 */}
              {step.id === "item" && isActive && !itemUrl && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: "#fffbeb", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
                  ⚠️ 商品URLが設定されていません。価格比較画面から遷移するとURLが自動設定されます。
                  <button
                    className="btn-secondary"
                    onClick={() => markDone("item")}
                    style={{ marginLeft: 8, fontSize: 11, padding: "4px 10px" }}
                  >
                    手動で完了にする
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 全完了メッセージ */}
      {done.record && (
        <div
          className="dq-card dq-card-gold"
          style={{ padding: 20, marginTop: 16, textAlign: "center" }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#b45309" }}>購入完了！+10GP獲得！</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>履歴ページへ移動中…</div>
        </div>
      )}

      {/* 購入記録モーダル */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="dq-card" style={{ padding: 28, width: 420, margin: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", marginBottom: 16 }}>
              📝 購入完了を記録する
            </h2>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                実際の購入金額（円）
              </label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ color: "#64748b" }}>¥</span>
                <input
                  type="number"
                  className="dq-input"
                  value={inputPrice}
                  onChange={(e) => setInputPrice(e.target.value)}
                />
              </div>
            </div>

            {basePrice > 0 && Number(inputPrice) > 0 && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "#d1fae5",
                  borderRadius: 8,
                  marginBottom: 14,
                  fontSize: 13,
                }}
              >
                💚 節約額: <strong>¥{(basePrice - Number(inputPrice)).toLocaleString()}</strong>
                （表示価格 ¥{basePrice.toLocaleString()} − 実質 ¥{Number(inputPrice).toLocaleString()}）
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <input
                type="checkbox"
                id="coupon-used"
                checked={couponUsed}
                onChange={(e) => setCouponUsed(e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              <label htmlFor="coupon-used" style={{ fontSize: 13, color: "#374151", cursor: "pointer" }}>
                クーポンを使用した
              </label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                キャンセル
              </button>
              <button className="btn-primary" onClick={handleRecord} style={{ flex: 1 }}>
                ✅ 記録する（+10GP）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssistPage() {
  return (
    <Suspense>
      <AssistInner />
    </Suspense>
  );
}
