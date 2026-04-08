"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadSettings, type UserSettings, defaultSettings } from "@/app/settings/page";

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

export default function ComparePage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  // 各ショップの表示価格（API取得 or 手動入力）
  const [rakutenPrice, setRakutenPrice] = useState<number | null>(null);
  const [rakutenUrl, setRakutenUrl] = useState("");
  const [yahooPrice, setYahooPrice] = useState<number | null>(null);
  const [yahooUrl, setYahooUrl] = useState("");
  const [kakakuPrice, setKakakuPrice] = useState<string>("");

  const [results, setResults] = useState<ShopResult[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

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

                    {shopKey && (
                      <button
                        className="btn-primary"
                        onClick={() => {
                          router.push(`/assist?shop=${shopKey}&url=${encodeURIComponent(shopUrl ?? "")}&realPrice=${r.realPrice}&basePrice=${r.basePrice}`);
                        }}
                        style={{ whiteSpace: "nowrap", fontSize: 13 }}
                      >
                        このショップで買う →
                      </button>
                    )}
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
    </div>
  );
}
