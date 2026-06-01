"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadSettings, type UserSettings, defaultSettings } from "@/app/settings/page";
import { type Card } from "@/app/settings/page";
import { getKakakuPrice, addUserPurchase } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";

// ===== 価格.com URL生成 =====
const SP = '\u3000'; // 全角スペース

function detectCategory(keyword: string): string {
  const k = keyword.toUpperCase();
  if (/\bSSD\b|M\.2|NVME|SATA/i.test(k)) return 'ssd';
  if (/DDR[45]|DIMM|SODIMM|\bRAM\b|\bMEMORY\b|メモリ/i.test(k)) return 'memory';
  if (/RTX|RX\s*\d{4}|RADEON|GEFORCE|GPU|グラボ/i.test(k)) return 'gpu';
  if (/CORE\s*I[3579]|RYZEN|XEON|CPU|プロセッサ/i.test(k)) return 'cpu';
  return 'other';
}

function buildKakakuUrl(keyword: string): string {
  const category = detectCategory(keyword);
  let query = '';
  switch (category) {
    case 'ssd': {
      // keyword例: "Samsung 1TB NVMe"
      query = `SSD${SP}${keyword.replace(/\s+/g, SP)}${SP}M.2${SP}内蔵`;
      break;
    }
    case 'memory': {
      // DDR5/DDR4 + 容量をそのまま活用
      query = `${keyword.replace(/\s+/g, SP)}${SP}DIMM${SP}2枚組`;
      break;
    }
    case 'gpu': {
      query = `GPU${SP}${keyword.replace(/\s+/g, SP)}`;
      break;
    }
    case 'cpu': {
      query = keyword;
      break;
    }
    default:
      query = keyword;
  }
  return `https://search.kakaku.com/${encodeURIComponent(query)}/?act=Input`;
}

interface ShopResult {
  shop: "rakuten" | "yahoo" | "kakaku";
  label: string;
  icon: string;
  basePrice: number;
  pointRate: number;
  coupon: number;
  pointValue: number;
  realPrice: number;
}

const calcRealPrice = (basePrice: number, pointRate: number, coupon: number) =>
  Math.round(basePrice * (1 - pointRate / 100) - coupon);

const calcPointValue = (basePrice: number, pointRate: number) =>
  Math.round(basePrice * pointRate / 100);

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Firestoreのkakaku_pricesを検索し、マッチしたkakakuUrlを返す。
 * マッチしない・未設定の場合はフォールバックURLを返す。
 */
async function openKakakuUrl(keyword: string): Promise<void> {
  const fallback = `https://search.kakaku.com/${encodeURIComponent(keyword)}/?act=Input`;
  try {
    const match = await getKakakuPrice(keyword);
    const url = match?.kakakuUrl || fallback;
    window.open(url, '_blank');
  } catch {
    window.open(fallback, '_blank');
  }
}

export default function ComparePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const [rakutenPrice, setRakutenPrice] = useState<number | null>(null);
  const [rakutenUrl, setRakutenUrl] = useState("");
  const [yahooPrice, setYahooPrice] = useState<number | null>(null);
  const [yahooUrl, setYahooUrl] = useState("");
  const [kakakuPrice, setKakakuPrice] = useState<string>("");

  const [results, setResults] = useState<ShopResult[]>([]);
  const [searched, setSearched] = useState(false);

  const [popup, setPopup] = useState<{
    open: boolean;
    productName: string;
    price: number;
    shop: string;
    shopUrl: string;
  } | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [popupPrice, setPopupPrice] = useState<number>(0);

  useEffect(() => {
    setSettings(loadSettings());
    if (user) {
      getIdToken(user).then((token) =>
        fetch("/api/cards", { headers: { Authorization: `Bearer ${token}` } })
          .then((res) => res.json())
          .then((data: { cards: Card[] }) => {
            if (data.cards) {
              setCards(data.cards);
              if (data.cards.length > 0) setSelectedCardId(data.cards[0].id);
            }
          })
          .catch((e) => console.error("[compare] loadCards failed:", e))
      );
    }
  }, [user]);

  // API検索
  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setSearching(true);
    setError("");
    setRakutenPrice(null);
    setYahooPrice(null);
    setRakutenUrl("");
    setYahooUrl("");
    setResults([]);
    setSearched(false);

    try {
      const [rakRes, yahRes] = await Promise.all([
        fetch(`/api/rakuten/search?keyword=${encodeURIComponent(keyword)}&hits=1`),
        fetch(`/api/yahoo/search?keyword=${encodeURIComponent(keyword)}&hits=1`),
      ]);
      const [rakData, yahData] = await Promise.all([rakRes.json(), yahRes.json()]);

      if (!rakData.error && rakData.results?.[0]) {
        setRakutenPrice(rakData.results[0].price);
        setRakutenUrl(rakData.results[0].url ?? "");
      }
      if (!yahData.error && yahData.results?.[0]) {
        setYahooPrice(yahData.results[0].price);
        setYahooUrl(yahData.results[0].url ?? "");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSearching(false);
    }
  };

  // 比較実行
  const handleCompare = () => {
    const list: ShopResult[] = [];

    if (rakutenPrice !== null) {
      const rv = calcPointValue(rakutenPrice, settings.rakutenRate);
      list.push({
        shop: "rakuten",
        label: "楽天市場",
        icon: "🦅",
        basePrice: rakutenPrice,
        pointRate: settings.rakutenRate,
        coupon: settings.rakutenCoupon,
        pointValue: rv,
        realPrice: calcRealPrice(rakutenPrice, settings.rakutenRate, settings.rakutenCoupon),
      });
    }

    if (yahooPrice !== null) {
      const yv = calcPointValue(yahooPrice, settings.yahooRate);
      list.push({
        shop: "yahoo",
        label: "Yahoo!ショッピング",
        icon: "🛍️",
        basePrice: yahooPrice,
        pointRate: settings.yahooRate,
        coupon: settings.yahooCoupon,
        pointValue: yv,
        realPrice: calcRealPrice(yahooPrice, settings.yahooRate, settings.yahooCoupon),
      });
    }

    if (settings.kakakuEnabled && kakakuPrice !== "") {
      const kp = Number(kakakuPrice);
      if (!isNaN(kp) && kp > 0) {
        list.push({
          shop: "kakaku",
          label: "価格.com最安値",
          icon: "📋",
          basePrice: kp,
          pointRate: 0,
          coupon: 0,
          pointValue: 0,
          realPrice: kp,
        });
      }
    }

    list.sort((a, b) => a.realPrice - b.realPrice);
    setResults(list);
    setSearched(true);
  };

  const best = results[0] ?? null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1e40af", marginBottom: 4 }}>
            💰 価格比較 — 実質価格で最安判定
          </h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>
            楽天・Yahoo・価格.comの実質価格を一括比較
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => router.push("/settings")}
          style={{ fontSize: 12, padding: "8px 14px" }}
        >
          ⚙️ 設定変更
        </button>
      </div>

      {/* 設定サマリー */}
      <div className="dq-card dq-card-blue" style={{ padding: 14, marginBottom: 16, display: "flex", gap: 24, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#374151" }}>
          💴 購入ライン: <strong>¥{settings.budget.toLocaleString()}</strong>
        </span>
        <span style={{ fontSize: 12, color: "#374151" }}>
          🦅 楽天還元率: <strong>{settings.rakutenRate}%</strong>
          {settings.rakutenCoupon > 0 && ` / クーポン¥${settings.rakutenCoupon.toLocaleString()}`}
        </span>
        <span style={{ fontSize: 12, color: "#374151" }}>
          🛍️ Yahoo還元率: <strong>{settings.yahooRate}%</strong>
          {settings.yahooCoupon > 0 && ` / クーポン¥${settings.yahooCoupon.toLocaleString()}`}
        </span>
        {settings.kakakuEnabled && (
          <span style={{ fontSize: 12, color: "#374151" }}>📋 価格.com比較: <strong>ON</strong></span>
        )}
      </div>

      {/* 検索フォーム */}
      <div className="dq-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: settings.kakakuEnabled ? 12 : 0 }}>
          <input
            className="dq-input"
            placeholder="商品名を入力（例: Sony WH-1000XM5）"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            style={{ flex: 1 }}
          />
          <button
            className="btn-primary"
            onClick={handleSearch}
            disabled={searching || !keyword.trim()}
            style={{ whiteSpace: "nowrap" }}
          >
            {searching ? "検索中…" : "🔍 API検索"}
          </button>
        </div>

        {/* APIで取得した価格の表示・手動調整 */}
        {(rakutenPrice !== null || yahooPrice !== null) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: settings.kakakuEnabled ? 12 : 0 }}>
            <div>
              <label style={{ fontSize: 12, color: "#374151", fontWeight: 600, display: "block", marginBottom: 4 }}>
                🦅 楽天 表示価格（自動取得・変更可）
              </label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ color: "#64748b" }}>¥</span>
                <input
                  type="number"
                  className="dq-input"
                  value={rakutenPrice ?? ""}
                  onChange={(e) => setRakutenPrice(Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#374151", fontWeight: 600, display: "block", marginBottom: 4 }}>
                🛍️ Yahoo 表示価格（自動取得・変更可）
              </label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ color: "#64748b" }}>¥</span>
                <input
                  type="number"
                  className="dq-input"
                  value={yahooPrice ?? ""}
                  onChange={(e) => setYahooPrice(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}

        {/* 価格.com手動入力 */}
        {settings.kakakuEnabled && (
          <div>
            <label style={{ fontSize: 12, color: "#374151", fontWeight: 600, display: "block", marginBottom: 4 }}>
              📋 価格.com 最安値（手動入力）
            </label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ color: "#64748b" }}>¥</span>
              <input
                type="number"
                className="dq-input"
                placeholder="価格.comの最安値を入力"
                value={kakakuPrice}
                onChange={(e) => setKakakuPrice(e.target.value)}
                style={{ maxWidth: 240 }}
              />
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "#fee2e2", borderRadius: 8, fontSize: 12, color: "#9f1239" }}>
            ⚠️ API エラー: {error}（価格を手動で入力してください）
          </div>
        )}

        {(rakutenPrice !== null || yahooPrice !== null) && (
          <button
            className="btn-primary"
            onClick={handleCompare}
            style={{ marginTop: 12, width: "100%" }}
          >
            ⚖️ 実質価格で比較する
          </button>
        )}
      </div>

      {/* 比較結果 */}
      {searched && results.length > 0 && (
        <>
          {/* 購入推奨バナー */}
          {best && best.realPrice <= settings.budget ? (
            <div
              style={{
                padding: "14px 20px",
                borderRadius: 10,
                background: "#d1fae5",
                border: "1px solid #6ee7b7",
                color: "#065f46",
                fontWeight: 700,
                fontSize: 15,
                marginBottom: 16,
              }}
            >
              ✅ 購入ライン（¥{settings.budget.toLocaleString()}）以下です！{best.label} ¥{best.realPrice.toLocaleString()} が最安
            </div>
          ) : (
            <div
              style={{
                padding: "14px 20px",
                borderRadius: 10,
                background: "#fee2e2",
                border: "1px solid #fca5a5",
                color: "#9f1239",
                fontWeight: 700,
                fontSize: 15,
                marginBottom: 16,
              }}
            >
              ⚠️ 購入ラインを超えています（最安: ¥{best?.realPrice.toLocaleString()} / ライン: ¥{settings.budget.toLocaleString()}）
            </div>
          )}

          {/* ショップカード */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {results.map((r, i) => {
              const isBest = i === 0;
              const shopKey = r.shop === "rakuten" ? "rakuten" : r.shop === "yahoo" ? "yahoo" : null;
              const shopUrl = shopKey === "rakuten" ? rakutenUrl : shopKey === "yahoo" ? yahooUrl : null;

              return (
                <div
                  key={r.shop}
                  className="dq-card"
                  style={{
                    padding: 20,
                    border: isBest ? "2px solid #059669" : undefined,
                    position: "relative",
                  }}
                >
                  {isBest && (
                    <div
                      style={{
                        position: "absolute",
                        top: -14,
                        left: 20,
                        background: "#059669",
                        color: "white",
                        padding: "3px 12px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      🏆 最安・購入推奨
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 28 }}>{r.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{r.label}</div>
                      <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 10, color: "#94a3b8" }}>表示価格</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>
                            ¥{r.basePrice.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "#94a3b8" }}>ポイント還元（{r.pointRate}%）</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: "#d97706" }}>
                            − ¥{r.pointValue.toLocaleString()}
                          </div>
                        </div>
                        {r.coupon > 0 && (
                          <div>
                            <div style={{ fontSize: 10, color: "#94a3b8" }}>クーポン</div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: "#7c3aed" }}>
                              − ¥{r.coupon.toLocaleString()}
                            </div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 10, color: "#94a3b8" }}>実質価格</div>
                          <div
                            style={{
                              fontSize: 22,
                              fontWeight: 900,
                              color: isBest ? "#059669" : "#1e293b",
                            }}
                          >
                            ¥{r.realPrice.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
                      {shopKey && (
                        <button
                          className="btn-primary"
                          onClick={() => {
                            setPopup({
                              open: true,
                              productName: keyword || r.label,
                              price: r.realPrice,
                              shop: r.label,
                              shopUrl: shopUrl ?? "",
                            });
                            setPopupPrice(r.realPrice);
                          }}
                          style={{ whiteSpace: "nowrap", fontSize: 13 }}
                        >
                          このショップで買う →
                        </button>
                      )}
                      <button
                        onClick={() => openKakakuUrl(keyword)}
                        style={{
                          whiteSpace: "nowrap",
                          fontSize: 11,
                          padding: "6px 10px",
                          borderRadius: 7,
                          border: "1px solid #f59e0b",
                          background: "#fffbeb",
                          color: "#92400e",
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#fef3c7")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fffbeb")}
                      >
                        価格.comで確認 ↗
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {searched && results.length === 0 && (
        <div className="dq-card" style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
          比較できるデータがありません。価格を入力してください。
        </div>
      )}

      {/* ===== 購入記録ポップアップ ===== */}
      {popup?.open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setPopup(null); }}
        >
          <div
            style={{
              background: "white", borderRadius: 16, padding: 28,
              width: 420, maxWidth: "90vw",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 900, color: "#1e293b", marginBottom: 20 }}>
              🗒️ 購入を記録しますか？
            </div>

            {/* 商品名 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>商品名</label>
              <div style={{
                padding: "9px 12px", borderRadius: 8,
                background: "#f8fafc", border: "1px solid #e2e8f0",
                fontSize: 14, color: "#374151",
              }}>{popup.productName}</div>
            </div>

            {/* 購入価格 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>購入価格（円）</label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#64748b" }}>¥</span>
                <input
                  type="number"
                  className="dq-input"
                  value={popupPrice}
                  min={0}
                  onChange={(e) => setPopupPrice(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            {/* ショップ名 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>ショップ</label>
              <div style={{
                padding: "9px 12px", borderRadius: 8,
                background: "#f8fafc", border: "1px solid #e2e8f0",
                fontSize: 14, color: "#374151",
              }}>{popup.shop}</div>
            </div>

            {/* カード選択 */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>使用カード</label>
              {cards.length === 0 ? (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>カードが登録されていません（設定ページで追加できます）</div>
              ) : (
                <select
                  value={selectedCardId}
                  onChange={(e) => setSelectedCardId(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 8,
                    border: "1px solid #e2e8f0", fontSize: 14,
                    fontFamily: "inherit", background: "white", cursor: "pointer",
                  }}
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* ボタン群 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                className="btn-primary"
                style={{ fontSize: 14 }}
                onClick={() => {
                  const cardName = cards.find((c) => c.id === selectedCardId)?.name ?? "—";
                  if (user) {
                    addUserPurchase(user.uid, {
                      itemName: popup.productName,
                      price: popup.price,
                      realPrice: popupPrice,
                      savedAmount: popup.price - popupPrice,
                      cardName,
                      cardId: selectedCardId,
                      shop: popup.shop,
                    });
                  }
                  setPopup(null);
                  window.open(popup.shopUrl, "_blank");
                }}
              >
                🗒️ 記録して購入ページへ
              </button>
              <button
                onClick={() => {
                  setPopup(null);
                  window.open(popup.shopUrl, "_blank");
                }}
                style={{
                  padding: "11px 0", borderRadius: 10,
                  border: "1px solid #e2e8f0", background: "white",
                  color: "#64748b", fontSize: 14, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                記録せずに購入ページへ
              </button>
              <button
                onClick={() => setPopup(null)}
                style={{
                  padding: "8px 0", borderRadius: 10,
                  border: "none", background: "transparent",
                  color: "#94a3b8", fontSize: 13, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
