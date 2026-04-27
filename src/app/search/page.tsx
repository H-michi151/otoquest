"use client";
import { useState, useEffect, useCallback } from "react";
import { getKakakuPrice, isStalePrice, loadUserCards, addUserPurchase, type KakakuPrice } from "@/lib/firebase";
import {
  enrichItem,
  enrichItemWithLocalCards,
  rankItems,
  defaultUserCardNames,
  type EnrichedItem,
} from "@/lib/realPrice";
import { useAuth } from "@/context/AuthContext";

import {
  creditCards,
  campaigns,
  frequentItems,
  sellerProfiles,
  physicalStores,
  storeEvents,
  getBestCardForPlatform,
  type OptimizationMode,
} from "@/lib/mockData";
import { Search, ShieldCheck, ShieldAlert, ShieldX, Info, Star, ChevronRight, Truck, AlertTriangle, MapPin, Store } from "lucide-react";

const platformCampaignMap: Record<string, string[]> = {
  "楽天市場":           ["楽天スーパーSALE"],
  "Amazon":             ["プライムデー先行セール"],
  "Yahoo!ショッピング": ["PayPay春のポイント祭り"],
};

// ========================================
// ① 価格.com カテゴリ別 URLマップ
// ========================================
const KAKAKU_CATEGORY_URLS: { keywords: string[]; url: string }[] = [
  {
    keywords: ["マザーボード", "motherboard", "MB", "M/B"],
    url: "https://kakaku.com/pc/motherboard/itemlist.aspx?pdf_Spec116=11&pdf_so=p1",
  },
  {
    keywords: ["SSD", "ソリッドステート"],
    url: "https://kakaku.com/pc/ssd/itemlist.aspx?pdf_so=p1",
  },
  {
    keywords: ["メモリ", "memory", "RAM", "DDR4", "DDR5"],
    url: "https://kakaku.com/pc/pc-memory/itemlist.aspx?pdf_so=p1",
  },
  {
    keywords: ["CPU", "プロセッサ", "Ryzen", "Core i", "Core Ultra"],
    url: "https://kakaku.com/pc/cpu/itemlist.aspx?pdf_so=p1",
  },
  {
    keywords: ["GPU", "グラボ", "グラフィック", "RTX", "RX ", "GeForce", "Radeon"],
    url: "https://kakaku.com/pc/videocard/itemlist.aspx?pdf_so=p1",
  },
];
const KAKAKU_FALLBACK_URL = "https://kakaku.com/pc/";

/** キーワードから価格.comカテゴリーページURLを取得 */
function getKakakuCategoryUrl(keyword: string): string {
  const lower = keyword.toLowerCase();
  for (const entry of KAKAKU_CATEGORY_URLS) {
    if (entry.keywords.some((k) => lower.includes(k.toLowerCase()))) {
      return entry.url;
    }
  }
  return KAKAKU_FALLBACK_URL;
}

// ========================================
// ② 中古品・訳あり品除外フィルター
// ========================================
const USED_KEYWORDS = [
  "中古", "訳あり", "ジャンク",
  "used", "Used", "USED",
  "再生品", "リファービッシュ", "refurbished",
];

function isUsedItem(itemName: string): boolean {
  return USED_KEYWORDS.some((kw) => itemName.includes(kw));
}

const MODE_LABELS: Record<OptimizationMode, { label: string; icon: string; desc: string }> = {
  standard:     { label: "スタンダード",   icon: "⚖️", desc: "安全性・価格・ポイントをバランスよく評価" },
  safety_first: { label: "安全重視",       icon: "🛡️", desc: "信頼スコア優先。信頼性の低い業者のリスクを強く評価" },
  bulk:         { label: "大量購入",       icon: "📦", desc: "在庫安定性を最重視。まとめ買い・法人向け" },
  max_points:   { label: "ポイント最大化", icon: "🎯", desc: "利用可能ポイントを最大化（失効リスク加味）" },
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [mode, setMode] = useState<OptimizationMode>("standard");
  const [campaignOn, setCampaignOn] = useState(false);
  const [showModeInfo, setShowModeInfo] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set(["Sony WH-1000XM5", "Logicool MX Keys S"]));
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");

  // ========================================
  // 価格.com参考価格（Firestore kakaku_prices）
  // ========================================
  const [kakakuPriceMap, setKakakuPriceMap] = useState<Record<string, KakakuPrice | null>>({});

  const fetchKakakuPrice = useCallback(async (productName: string) => {
    if (kakakuPriceMap[productName] !== undefined) return; // キャッシュ済み
    setKakakuPriceMap((prev) => ({ ...prev, [productName]: null })); // loading placeholder
    const result = await getKakakuPrice(productName);
    setKakakuPriceMap((prev) => ({ ...prev, [productName]: result }));
  }, [kakakuPriceMap]);

  // ========================================
  // カード個別化（localStorageのユーザーカードを使用）
  // ========================================
  const CARD_PRESETS: Record<string, string[]> = {
    "全カード（デフォルト）": defaultUserCardNames,
    "楽天カードのみ（パターンA）": ["楽天カード"],
    "PayPayカードのみ（パターンB）": ["PayPayカード"],
    "カードなし": [],
  };
  const [cardPresetKey, setCardPresetKey] = useState("全カード（デフォルト）");

  // Firestoreからカード情報をロード
  const { user } = useAuth();
  const [userCardNamesFromStorage, setUserCardNamesFromStorage] = useState<string[]>(defaultUserCardNames);
  const [allUserCardObjects, setAllUserCardObjects] = useState<{ name: string; pointRate: number }[]>([]);
  useEffect(() => {
    if (!user) return;
    loadUserCards(user.uid).then((docs) => {
      if (docs.length > 0) {
        setUserCardNamesFromStorage(docs.map((c) => c.name));
        setAllUserCardObjects(docs.map((c) => ({ name: c.name, pointRate: c.pointRate })));
      }
    });
  }, [user]);

  const userCards = cardPresetKey === "全カード（デフォルト）" ? userCardNamesFromStorage : (CARD_PRESETS[cardPresetKey] ?? userCardNamesFromStorage);
  // enrichItemWithLocalCards用: プリセットに応じたカードオブジェクト
  const activeCardObjects = cardPresetKey === "カードなし"
    ? []
    : cardPresetKey === "全カード（デフォルト）"
      ? allUserCardObjects
      : allUserCardObjects.filter((c) => userCards.includes(c.name));

  // ========================================
  // リアルAPI（楽天＋Yahoo 並列）
  // ========================================
  const [compareResults, setCompareResults] = useState<EnrichedItem[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [liveAppId, setLiveAppId] = useState("");
  const [rakutenTotal, setRakutenTotal] = useState(0);
  const [yahooTotal, setYahooTotal] = useState(0);


  // userCards / activeCardObjects 変更時にリランク
  useEffect(() => {
    if (compareResults.length === 0) return;
    setCompareResults((prev) =>
      rankItems(prev.map((item) => enrichItemWithLocalCards(item, item.source, activeCardObjects, item.couponDiscount)))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardPresetKey]);

  // 楽天・Yahoo並列フェッチ
  const searchBothApis = async (keyword: string, appId?: string) => {
    if (!keyword.trim()) return;
    setLiveLoading(true);
    setLiveError("");
    setCompareResults([]);
    setRakutenTotal(0);
    setYahooTotal(0);

    try {
      const rakutenParams = new URLSearchParams({ keyword, hits: "10" });
      const resolvedAppId = appId ?? liveAppId;
      if (resolvedAppId.trim()) rakutenParams.set("applicationId", resolvedAppId.trim());

      const [rakutenRes, yahooRes] = await Promise.all([
        fetch(`/api/rakuten/search?${rakutenParams}`),
        fetch(`/api/yahoo/search?${new URLSearchParams({ keyword, hits: "10" })}`),
      ]);

      const [rakutenData, yahooData] = await Promise.all([
        rakutenRes.json(),
        yahooRes.json(),
      ]);

      const errors: string[] = [];
      const allEnriched: EnrichedItem[] = [];

      if (rakutenData.error) {
        errors.push(`楽天: ${rakutenData.hint ?? rakutenData.error}`);
      } else {
        const rawItems = (rakutenData.results ?? []) as EnrichedItem[];
        // ② 中古品除外
        const newItems = rawItems.filter((item) => !isUsedItem(item.itemName));
        setRakutenTotal(rakutenData.total ?? newItems.length);
        newItems.forEach((item) => {
          allEnriched.push(enrichItemWithLocalCards(item, "楽天市場", activeCardObjects));
        });
      }

      if (yahooData.error) {
        errors.push(`Yahoo!: ${yahooData.error}`);
      } else {
        const rawItems = (yahooData.results ?? []) as EnrichedItem[];
        // ② 中古品除外
        const newItems = rawItems.filter((item) => !isUsedItem(item.itemName));
        setYahooTotal(yahooData.total ?? newItems.length);
        newItems.forEach((item) => {
          allEnriched.push(enrichItemWithLocalCards(item, "Yahoo!ショッピング", activeCardObjects));
        });
      }

      if (errors.length === 2) {
        setLiveError(errors.join(" / "));
      } else {
        if (errors.length === 1) setLiveError(errors[0]);
        setCompareResults(rankItems(allEnriched));
      }
    } catch (e) {
      setLiveError(String(e));
    } finally {
      setLiveLoading(false);
    }
  };

  // アプリIDをsessionStorageから復元 + URLパラメータ自動検索
  useEffect(() => {
    const saved = sessionStorage.getItem("rakuten_app_id");
    if (saved) setLiveAppId(saved);

    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) {
      setQuery(q);
      setSearched(true);
      searchBothApis(q, saved ?? "");
      fetchKakakuPrice(q);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 検索実行（リアルAPIのみ）
  const handleSearch = () => {
    setSearched(true);
    searchBothApis(query);
    // B-2: 価格.comデータをフェッチ
    if (query.trim()) fetchKakakuPrice(query.trim());
  };
  // 価格フィルター適用関数
  const inPriceRange = (price: number) => {
    const min = priceMin !== "" ? Number(priceMin) : null;
    const max = priceMax !== "" ? Number(priceMax) : null;
    if (min !== null && price < min) return false;
    if (max !== null && price > max) return false;
    return true;
  };

  // プリセット適用
  const applyPreset = (min: string, max: string) => {
    setPriceMin(min);
    setPriceMax(max);
  };

  const pricePresets = [
    { label: "全て",         min: "",      max: "" },
    { label: "〜¥10,000",   min: "",      max: "10000" },
    { label: "〜¥30,000",   min: "",      max: "30000" },
    { label: "〜¥50,000",   min: "",      max: "50000" },
    { label: "¥50,000〜",   min: "50000", max: "" },
  ];

  const activePriceFilter = priceMin !== "" || priceMax !== "";

  // ========================================
  // キャンペーン上限チェック
  // isCapped = true のキャンペーンは計算から自動除外
  // ========================================
  const activeCampaigns = campaigns.filter(
    (c) => c.status === "entered" && !c.isCapped
  );
  const cappedCampaigns = campaigns.filter((c) => c.isCapped);
  const nearCapCampaigns = campaigns.filter(
    (c) => c.status === "entered" && !c.isCapped && c.pointCap !== null
      && (c.pointsEarned / (c.pointCap ?? 1)) >= 0.90
  );

  const getApplicableCampaigns = (platform: string) =>
    activeCampaigns.filter((c) => (platformCampaignMap[platform] ?? []).includes(c.name));

  // マトリクスを使って最適カードを選択（28パターン対応）
  const getBestCard = (platform: string) => {
    const result = getBestCardForPlatform(platform, userCards);
    if (!result) return null;
    const card = creditCards.find((c) => c.name === result.cardName);
    return card ? { ...card, matrixRate: result.rate } : null;
  };

  const getCampaignPoints = (platform: string, price: number) => {
    if (!campaignOn) return 0;
    const appCampaigns = getApplicableCampaigns(platform);
    const campaignRate = appCampaigns.reduce((s, c) => s + c.bonusRate, 0);
    const card = getBestCard(platform);
    // matrixRateが存在する場合はそちらを使用（より正確）
    const cardRate = card ? ((card as typeof card & { matrixRate?: number }).matrixRate ?? card.bonusRate) : 0;
    return Math.floor((price * campaignRate) / 100) + Math.floor((price * cardRate) / 100);
  };

  const toggleCategory = (cat: string) =>
    setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const launchSearch = (name: string) => {
    setQuery(name);
    setSearched(true);
  };

  const toggleFavorite = (name: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1e40af", marginBottom: 4 }}>
          ⚔️ 商品検索 — スマート最適化エンジン
        </h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          安全性・在庫・ポイント実質価値を総合評価。キャンペーン上限到達分は自動除外します。
        </p>
      </div>

      {/* キャンペーン上限アラート */}
      {(cappedCampaigns.length > 0 || nearCapCampaigns.length > 0) && (
        <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {cappedCampaigns.map((c) => (
            <div
              key={c.id}
              style={{
                padding: "8px 14px",
                background: "#fff1f2",
                border: "1px solid #fca5a5",
                borderRadius: 8,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#9f1239",
              }}
            >
              <span style={{ fontWeight: 700 }}>🔴 上限達成・計算除外済：</span>
              <span>{c.platform} 「{c.name}」</span>
              <span style={{ color: "#dc2626" }}>{c.capNote}</span>
            </div>
          ))}
          {nearCapCampaigns.map((c) => (
            <div
              key={c.id}
              style={{
                padding: "8px 14px",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 8,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#92400e",
              }}
            >
              <span style={{ fontWeight: 700 }}>🟡 上限まもなく：</span>
              <span>{c.platform} 「{c.name}」— {c.capNote}</span>
              {c.pointCap && (
                <div style={{ flex: 1, maxWidth: 100, height: 5, background: "#fef3c7", borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, (c.pointsEarned / c.pointCap) * 100)}%`,
                      height: "100%",
                      background: "#d97706",
                      borderRadius: 3,
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16 }}>
        {/* ========== 左側：よく買うアイテムフィルター ========== */}
        <div>
          <div className="dq-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: 13, color: "#1e40af", display: "flex", alignItems: "center", gap: 6 }}>
              <Star size={14} fill="#d97706" color="#d97706" />
              よく買うアイテム
            </div>

            {/* お気に入りショートカット */}
            {favorites.size > 0 && (
              <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", background: "#fffbeb" }}>
                <div style={{ fontSize: 10, color: "#92400e", fontWeight: 700, marginBottom: 5 }}>⭐ お気に入り</div>
                {Array.from(favorites).map((name) => (
                  <button
                    key={name}
                    onClick={() => launchSearch(name)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "4px 6px",
                      borderRadius: 5,
                      border: "none",
                      background: query === name && searched ? "#dbeafe" : "transparent",
                      cursor: "pointer",
                      fontSize: 11,
                      color: "#374151",
                      marginBottom: 2,
                      fontFamily: "inherit",
                    }}
                  >
                    ★ {name}
                  </button>
                ))}
              </div>
            )}

            {/* カテゴリー一覧 */}
            <div style={{ overflowY: "auto", maxHeight: 480 }}>
              {frequentItems.map((cat) => (
                <div key={cat.category}>
                  <button
                    onClick={() => toggleCategory(cat.category)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      width: "100%",
                      padding: "9px 12px",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{cat.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", flex: 1, textAlign: "left" }}>
                      {cat.category}
                    </span>
                    <ChevronRight
                      size={12}
                      color="#94a3b8"
                      style={{ transform: openCategories[cat.category] ? "rotate(90deg)" : "none", transition: "0.15s" }}
                    />
                  </button>

                  {openCategories[cat.category] && (
                    <div style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                      {cat.items.map((item) => {
                        const isFav = favorites.has(item.name);
                        const isActive = query === item.name && searched;
                        return (
                          <div
                            key={item.name}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "6px 12px 6px 28px",
                              background: isActive ? "#dbeafe" : "transparent",
                            }}
                          >
                            <button
                              onClick={() => launchSearch(item.name)}
                              style={{
                                flex: 1,
                                textAlign: "left",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 11,
                                color: isActive ? "#1e40af" : "#374151",
                                fontWeight: isActive ? 700 : 400,
                                fontFamily: "inherit",
                                padding: 0,
                              }}
                            >
                              {item.name}
                              {item.monthlyFreq > 0 && (
                                <span style={{ marginLeft: 4, fontSize: 9, color: "#059669", fontWeight: 700 }}>
                                  月{item.monthlyFreq}回
                                </span>
                              )}
                            </button>
                            <button
                              onClick={() => toggleFavorite(item.name)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 11,
                                color: isFav ? "#d97706" : "#cbd5e1",
                                padding: 0,
                              }}
                              title={isFav ? "お気に入り解除" : "お気に入り追加"}
                            >
                              ★
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* アクティブキャンペーン状況サマリー */}
          <div className="dq-card" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 8 }}>📊 キャンペーン状況</div>
            {campaigns.filter(c => c.status === "entered").map((c) => {
              const pct = c.pointCap ? Math.min(100, (c.pointsEarned / c.pointCap) * 100) : 0;
              return (
                <div key={c.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b" }}>
                    <span style={{ color: c.isCapped ? "#dc2626" : "#374151" }}>
                      {c.isCapped && "🔴 "}{c.name}
                    </span>
                    {c.pointCap && (
                      <span>{c.pointsEarned.toLocaleString()} / {c.pointCap.toLocaleString()}pt</span>
                    )}
                  </div>
                  {c.pointCap && (
                    <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2, marginTop: 3 }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: c.isCapped ? "#dc2626" : pct >= 90 ? "#d97706" : "#1e40af",
                          borderRadius: 2,
                          transition: "width 0.5s",
                        }}
                      />
                    </div>
                  )}
                  {c.isCapped && (
                    <div style={{ fontSize: 9, color: "#dc2626", marginTop: 1 }}>計算から除外中</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ========== 右側：検索エリア ========== */}
        <div>
          {/* 最適化モード選択 */}
          <div className="dq-card" style={{ padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>🎛️ 最適化モード</span>
              <button onClick={() => setShowModeInfo(!showModeInfo)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                <Info size={13} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(Object.keys(MODE_LABELS) as OptimizationMode[]).map((m) => {
                const { label, icon } = MODE_LABELS[m];
                const active = mode === m;
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      padding: "6px 12px", borderRadius: 7,
                      border: active ? "2px solid #1e40af" : "1px solid #e2e8f0",
                      background: active ? "#1e40af" : "white",
                      color: active ? "white" : "#374151",
                      fontWeight: active ? 700 : 400,
                      fontSize: 12, cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {icon} {label}
                  </button>
                );
              })}
            </div>
            {showModeInfo && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, color: "#475569" }}>
                {MODE_LABELS[mode].desc}<br />
                <span style={{ fontSize: 11, color: "#94a3b8" }}>スコア = 実質価格 + 安全性ペナルティ + 在庫ペナルティ。値が低いほど推奨。</span>
              </div>
            )}
          </div>

          {/* 検索バー */}
          <div className="dq-card" style={{ padding: 14, marginBottom: 0, display: "flex", gap: 10, alignItems: "center" }}>
            <Search size={16} color="#1e40af" />
            <input
              className="dq-input"
              placeholder="商品名を入力（左のパネルからも選択できます）"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              style={{ flex: 1, fontSize: 13 }}
            />
            <button className="btn-primary" onClick={handleSearch} style={{ whiteSpace: "nowrap", fontSize: 13 }}>
              🔍 検索
            </button>
            <button
              onClick={() => setCampaignOn(!campaignOn)}
              style={{
                padding: "10px 12px", borderRadius: 8,
                border: campaignOn ? "2px solid #dc2626" : "1px solid #e2e8f0",
                background: campaignOn ? "#fff1f2" : "white",
                color: campaignOn ? "#dc2626" : "#64748b",
                fontWeight: campaignOn ? 700 : 400,
                fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
              }}
            >
              🎯 {campaignOn ? "キャンペーンON" : "キャンペーン込み"}
            </button>
          </div>

          {/* 価格フィルター */}
          <div
            className="dq-card"
            style={{
              padding: "10px 14px",
              marginBottom: 12,
              background: activePriceFilter ? "#eff6ff" : "#fafafa",
              borderColor: activePriceFilter ? "#93c5fd" : "#e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {/* アイコン+ラベル */}
            <span style={{ fontSize: 12, fontWeight: 700, color: activePriceFilter ? "#1e40af" : "#64748b", whiteSpace: "nowrap" }}>
              💴 価格フィルター
            </span>
            {activePriceFilter && (
              <span style={{ fontSize: 11, padding: "2px 8px", background: "#1e40af", color: "white", borderRadius: 10, fontWeight: 700 }}>
                適用中: {priceMin ? `¥${Number(priceMin).toLocaleString()}` : "¥0"} 〜 {priceMax ? `¥${Number(priceMax).toLocaleString()}` : "上限なし"}
              </span>
            )}

            {/* プリセットボタン */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {pricePresets.map((p) => {
                const isActive = priceMin === p.min && priceMax === p.max;
                return (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p.min, p.max)}
                    style={{
                      padding: "4px 10px", borderRadius: 6,
                      border: isActive ? "2px solid #1e40af" : "1px solid #e2e8f0",
                      background: isActive ? "#1e40af" : "white",
                      color: isActive ? "white" : "#374151",
                      fontSize: 11, fontWeight: isActive ? 700 : 400,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* 区切り */}
            <span style={{ color: "#e2e8f0", fontSize: 16 }}>|</span>

            {/* カスタム入力 */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number"
                placeholder="最低価格"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                style={{
                  width: 90, padding: "5px 8px", borderRadius: 6,
                  border: "1px solid #e2e8f0", fontSize: 12,
                  fontFamily: "inherit", outline: "none",
                }}
              />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>〜</span>
              <input
                type="number"
                placeholder="最高価格"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                style={{
                  width: 90, padding: "5px 8px", borderRadius: 6,
                  border: "1px solid #e2e8f0", fontSize: 12,
                  fontFamily: "inherit", outline: "none",
                }}
              />
            </div>

            {/* リセット */}
            {activePriceFilter && (
              <button
                onClick={() => applyPreset("", "")}
                style={{
                  padding: "4px 10px", borderRadius: 6,
                  border: "none", background: "#fee2e2",
                  color: "#dc2626", fontSize: 11, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                ✕ リセット
              </button>
            )}
          </div>

          {/* 検索結果 */}
          {!searched && (
            <div className="dq-card" style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14 }}>左のパネルからアイテムを選ぶか、商品名を入力してください</div>
            </div>
          )}

          {/* ========== リアルAPI 楽天+Yahoo 実質価格比較パネル ========== */}
          {searched && (
            <div style={{ marginTop: 16 }}>
              {/* ヘッダー */}
              <div style={{
                padding: "12px 16px", borderRadius: "10px 10px 0 0",
                background: "linear-gradient(135deg,#1e40af 0%,#7c3aed 100%)",
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>⚡ 楽天市場 vs Yahoo!ショッピング — 実質価格比較</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                  {liveLoading ? "並列取得中..." :
                   compareResults.length > 0
                    ? `楽天${rakutenTotal.toLocaleString()}件 / Yahoo${yahooTotal.toLocaleString()}件 → 上位${compareResults.length}件を実質価格でランキング`
                    : liveError ? "" : "検索を実行してください"}
                </span>
                {/* カード切替セレクター */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap" }}>💳 保有カード:</span>
                  <select
                    value={cardPresetKey}
                    onChange={(e) => setCardPresetKey(e.target.value)}
                    style={{
                      padding: "4px 8px", borderRadius: 6, border: "none",
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                      background: "rgba(255,255,255,0.95)", color: "#1e40af",
                      fontFamily: "inherit",
                    }}
                  >
                    {Object.keys(CARD_PRESETS).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="dq-card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: 0, overflow: "hidden" }}>
                {/* ローディング */}
                {liveLoading && (
                  <div style={{ textAlign: "center", padding: 32, color: "#6d28d9" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>楽天市場・Yahoo!ショッピングからリアルタイム取得中...</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>並列フェッチで高速化しています</div>
                  </div>
                )}

                {/* 部分エラー通知 */}
                {!liveLoading && liveError && (
                  <div style={{ padding: "8px 14px", background: "#fffbeb", borderBottom: "1px solid #fde68a", fontSize: 11, color: "#92400e", display: "flex", gap: 8 }}>
                    <span>⚠️</span><span>{liveError}</span>
                  </div>
                )}

                {/* 比較テーブル */}
                {!liveLoading && compareResults.length > 0 && (() => {
                  const ranked = compareResults;
                  const top = ranked[0];
                  const topReal = top.realPrice;
                  // 1位との差額でグルーピング
                  const rakutenBest = ranked.filter(r => r.source === "楽天市場").sort((a,b)=>a.realPrice-b.realPrice)[0];
                  const yahooBest  = ranked.filter(r => r.source === "Yahoo!ショッピング").sort((a,b)=>a.realPrice-b.realPrice)[0];

                  // 推奨先サマリー
                  const winner = top.source;
                  const diff = rakutenBest && yahooBest
                    ? Math.abs(rakutenBest.realPrice - yahooBest.realPrice)
                    : null;
                  const isDraw = diff !== null && diff <= 100;

                  return (
                    <div>
                      {/* サマリーバナー */}
                      <div style={{
                        padding: "12px 16px",
                        background: isDraw ? "#fffbeb" : "#f0fdf4",
                        borderBottom: `2px solid ${isDraw ? "#fde68a" : "#86efac"}`,
                        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                      }}>
                        <div>
                          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>🏆 推奨購入先</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: isDraw ? "#92400e" : "#065f46" }}>
                            {isDraw
                              ? `${winner}（差額±${diff}円以内 → カード還元優先）`
                              : winner}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", marginLeft: "auto" }}>
                          <div style={{ fontSize: 11, color: "#64748b" }}>実質最安値</div>
                          <div style={{ fontSize: 24, fontWeight: 900, color: "#059669" }}>¥{topReal.toLocaleString()}</div>
                          <div style={{ fontSize: 10, color: "#94a3b8" }}>({top.cardName} {top.cardRate > 0 ? `+${top.cardRate}%` : "カードなし"})</div>
                        </div>
                        {rakutenBest && yahooBest && !isDraw && (
                          <div style={{ padding: "8px 12px", background: "rgba(5,150,105,0.08)", borderRadius: 8, border: "1px solid #86efac", fontSize: 12, color: "#065f46" }}>
                            💡 {winner}の方が <strong>¥{diff?.toLocaleString()}</strong> お得（カード還元込み）
                          </div>
                        )}
                      </div>

                      {/* カード設定インジケーター */}
                      <div style={{ padding: "8px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 16, fontSize: 11 }}>
                        <span style={{ color: "#64748b" }}>適用カード設定:</span>
                        <span style={{ fontWeight: 700, color: "#cc0000" }}>楽天市場: {userCards.length > 0 ? (userCards.find(c => (c === "楽天カード" || c === "三井住友カード(NL)" || c === "Amazonカード" || c === "イオンカード" || c === "PayPayカード"))) ?? "最適選択" : "なし（実質価格のみ）"} → {ranked.find(r=>r.source==="楽天市場")?.cardRate ?? 0}%追加</span>
                        <span style={{ fontWeight: 700, color: "#1a237e" }}>Yahoo!: {ranked.find(r=>r.source==="Yahoo!ショッピング")?.cardName ?? "なし"} → {ranked.find(r=>r.source==="Yahoo!ショッピング")?.cardRate ?? 0}%追加</span>
                      </div>

                      {/* ランキングテーブル */}
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                              {["順位","購入先","商品名","表示価格","クーポン","ポイント還元","カード追加","ポイント価値","実質価格"].map(h => (
                                <th key={h} style={{ padding: "8px 10px", textAlign: h === "実質価格" ? "right" : "left", fontWeight: 700, color: "#374151", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {ranked.map((item, i) => {
                              const isTop = i === 0;
                              const gapFromTop = item.realPrice - topReal;
                              const srcColor = item.source === "楽天市場" ? "#cc0000" : "#1a237e";
                              const srcBg    = item.source === "楽天市場" ? "#fff5f5" : "#f0f4ff";
                              return (
                                <tr key={i} style={{
                                  background: isTop ? "#f0fdf4" : i % 2 === 0 ? "#fafafa" : "white",
                                  border: isTop ? "2px solid #86efac" : "none",
                                  borderBottom: "1px solid #f1f5f9",
                                }}>
                                  {/* 順位 */}
                                  <td style={{ padding: "10px 10px", textAlign: "center" }}>
                                    {isTop
                                      ? <span style={{ fontSize: 18 }}>🏆</span>
                                      : <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>{i + 1}位</span>}
                                    {isTop && (
                                      <div style={{ fontSize: 9, fontWeight: 700, color: "#059669", marginTop: 1 }}>最安</div>
                                    )}
                                    {!isTop && gapFromTop <= 500 && (
                                      <div style={{ fontSize: 9, color: "#94a3b8" }}>+¥{gapFromTop.toLocaleString()}</div>
                                    )}
                                  </td>
                                  {/* 購入先 */}
                                  <td style={{ padding: "10px 8px" }}>
                                    <span style={{
                                      padding: "3px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                                      color: srcColor, background: srcBg, whiteSpace: "nowrap",
                                    }}>
                                      {item.source === "楽天市場" ? "🦅 楽天" : "🛍️ Yahoo!"}
                                    </span>
                                  </td>
                                  {/* 商品名 */}
                                  <td style={{ padding: "10px 8px", maxWidth: 280 }}>
                                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                                      style={{ color: "#1e40af", textDecoration: "none", fontSize: 11, lineHeight: 1.4, display: "block" }}
                                    >
                                      {item.itemName.length > 45 ? item.itemName.slice(0, 45) + "..." : item.itemName}
                                    </a>
                                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{item.shop}</div>
                                  </td>
                                  {/* 表示価格 */}
                                  <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>¥{item.price.toLocaleString()}</span>
                                  </td>
                                  {/* クーポン */}
                                  <td style={{ padding: "10px 8px", textAlign: "center" }}>
                                    {item.couponDiscount > 0
                                      ? <span style={{ fontSize: 11, fontWeight: 700, color: "#9333ea" }}>-¥{item.couponDiscount.toLocaleString()}</span>
                                      : <span style={{ fontSize: 11, color: "#cbd5e1" }}>—</span>}
                                  </td>
                                  {/* ポイント還元 */}
                                  <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                                    <span style={{ fontSize: 11, color: item.source === "楽天市場" ? "#cc0000" : "#1a237e", fontWeight: 600 }}>
                                      {item.point_rate}%
                                    </span>
                                    <div style={{ fontSize: 10, color: "#94a3b8" }}>利用頻度 {Math.round(item.usabilityRate * 100)}%</div>
                                  </td>
                                  {/* カード追加 */}
                                  <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                                    {item.cardRate > 0
                                      ? <>
                                          <span style={{ fontSize: 11, fontWeight: 700, color: "#0ea5e9" }}>+{item.cardRate}%</span>
                                          <div style={{ fontSize: 10, color: "#64748b" }}>{item.cardName}</div>
                                        </>
                                      : <span style={{ fontSize: 11, color: "#cbd5e1" }}>—</span>}
                                  </td>
                                  {/* ポイント価値（円換算） */}
                                  <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: "#059669" }}>-¥{item.pointValue.toLocaleString()}</span>
                                    <div style={{ fontSize: 10, color: "#94a3b8" }}>合計{item.totalRate}%還元</div>
                                  </td>
                                  {/* 実質価格 */}
                                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                    {/* 実質価格 */}
                                    <div style={{ fontSize: 16, fontWeight: 900, color: isTop ? "#059669" : "#374151" }}>
                                      ¥{item.realPrice.toLocaleString()}
                                    </div>
                                    {/* 節約額 */}
                                    {item.price > item.realPrice && (
                                      <div style={{ fontSize: 10, color: "#059669", fontWeight: 600 }}>
                                        節約 ¥{(item.price - item.realPrice).toLocaleString()} お得
                                      </div>
                                    )}
                                    {isTop && (
                                      <div style={{ fontSize: 9, color: "#059669", fontWeight: 700 }}>✅ 最安</div>
                                    )}
                                    {/* B-2: 価格.com差額バッジ */}
                                    {(() => {
                                      const kp = kakakuPriceMap[query.trim()];
                                      if (!kp) return null;
                                      const diff = item.realPrice - kp.minPrice;
                                      if (diff < 0) {
                                        return (
                                          <div style={{
                                            marginTop: 4, padding: "2px 6px", borderRadius: 4,
                                            background: "#d1fae5", border: "1px solid #6ee7b7",
                                            fontSize: 9, fontWeight: 700, color: "#065f46",
                                          }}>
                                            価格.com最安より¥{Math.abs(diff).toLocaleString()} 安い！
                                          </div>
                                        );
                                      } else if (diff > 0) {
                                        return (
                                          <div style={{
                                            marginTop: 4, padding: "2px 6px", borderRadius: 4,
                                            background: "#fef3c7", border: "1px solid #fde68a",
                                            fontSize: 9, color: "#92400e",
                                          }}>
                                            価格.com最安より¥{diff.toLocaleString()} 割高
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                                      style={{
                                        display: "inline-block", marginTop: 4,
                                        padding: "3px 10px", borderRadius: 5,
                                        background: isTop ? "#059669" : srcColor,
                                        color: "white", fontSize: 10, fontWeight: 700,
                                        textDecoration: "none",
                                      }}
                                    >
                                      {item.source === "楽天市場" ? "楽天で見る" : "Yahoo!で見る"}
                                    </a>
                                    {/* 購入記録ボタン */}
                                    {user && (
                                      <button
                                        onClick={() => {
                                          addUserPurchase(user.uid, {
                                            itemName: item.itemName,
                                            price: item.price,
                                            realPrice: item.realPrice,
                                            savedAmount: item.price - item.realPrice,
                                            cardName: item.cardName ?? "—",
                                            shop: item.source,
                                          }).then(() => alert(`📝 購入記録に追加しました\n${item.itemName}`));
                                        }}
                                        style={{
                                          display: "block", marginTop: 4,
                                          padding: "3px 10px", borderRadius: 5,
                                          border: "1px solid #e2e8f0",
                                          background: "white", color: "#374151",
                                          fontSize: 10, fontWeight: 600,
                                          cursor: "pointer", fontFamily: "inherit",
                                        }}
                                      >
                                        📝 購入記録
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* 計算式の説明 */}
                      <div style={{ padding: "8px 16px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", fontSize: 10, color: "#94a3b8", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <span>💡 実質価格 = 表示価格 − floor(価格 × 合計還元率 × ポイント利用頻度)　※ 合計還元率 = プラットフォーム還元 + カード還元率（SPU込み）　🚫 中古・訳あり・ジャンク品は自動除外</span>
                        {kakakuPriceMap[query.trim()] && (
                          <span style={{ color: "#b45309" }}>
                            📋 価格.com参考最安値: ¥{kakakuPriceMap[query.trim()]!.minPrice.toLocaleString()}（{kakakuPriceMap[query.trim()]!.shopName}）
                            {isStalePrice(kakakuPriceMap[query.trim()]!.fetchedAt) && "　⚠️ 古い情報の可能性あり"}
                          </span>
                        )}
                        {/* ① 価格.comカテゴリ別最安一覧リンク */}
                        <a
                          href={getKakakuCategoryUrl(query.trim())}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "2px 8px", borderRadius: 4,
                            background: "#fef3c7", border: "1px solid #fde68a",
                            color: "#92400e", fontSize: 10, fontWeight: 700,
                            textDecoration: "none", whiteSpace: "nowrap",
                          }}
                        >
                          📋 価格.com最安順で見る →
                        </a>
                      </div>
                    </div>
                  );
                })()}

                {/* 未実行 */}
                {!liveLoading && !liveError && compareResults.length === 0 && (
                  <div style={{ textAlign: "center", padding: 24, color: "#94a3b8", fontSize: 13 }}>
                    検索すると楽天・Yahooのリアルデータで実質価格比較を行います
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========== 実店舗パネル ========== */}
          {searched && (() => {
            // クエリに関連する実店舗情報を検索
            const qLower = query.toLowerCase();
            const matchingStores = physicalStores.map((store) => {
              const matchedProducts = store.products.filter((p) =>
                p.productKeywords.some((kw) =>
                  qLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(qLower)
                )
              );
              return { ...store, matchedProducts };
            }).filter((s) => s.matchedProducts.length > 0);

            // 関連イベント
            const matchingEvents = storeEvents.filter((e) =>
              e.targetProducts.some((tp) =>
                qLower.includes(tp.toLowerCase().split(" ")[1] ?? "") ||
                tp.toLowerCase().includes(qLower)
              )
            );

            if (matchingStores.length === 0 && matchingEvents.length === 0) return null;

            const sourceLabel: Record<string, { label: string; color: string; bg: string }> = {
              flyer:    { label: "📰 チラシ特価", color: "#9333ea", bg: "#faf5ff" },
              event:    { label: "🎪 イベント特価", color: "#d97706", bg: "#fffbeb" },
              timesale: { label: "🏷️ タイムセール", color: "#dc2626", bg: "#fff1f2" },
              lineup:   { label: "🏬 通常在庫", color: "#374151", bg: "#f8fafc" },
            };

            return (
              <div style={{ marginTop: 8 }}>
                {/* セクションヘッダー */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 10px" }}>
                  <Store size={16} color="#1e40af" />
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1e40af" }}>
                    実店舗情報（チラシ・イベント込み）
                  </span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    ※ シュフー/各社チラシAPIより取得（Phase 1はモック）
                  </span>
                </div>

                {/* 関連イベントバナー */}
                {matchingEvents.length > 0 && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                    {matchingEvents.map((evt) => (
                      <div
                        key={evt.id}
                        style={{
                          flex: "1 1 280px",
                          padding: "10px 14px",
                          background: "#fffbeb",
                          border: "1px solid #fde68a",
                          borderRadius: 10,
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                        }}
                      >
                        <span style={{ fontSize: 22 }}>{evt.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>{evt.eventName}</div>
                          <div style={{ fontSize: 11, color: "#374151", margin: "2px 0" }}>{evt.storeName} — {evt.date} {evt.time}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{evt.description}</div>
                          {evt.coupon && (
                            <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: "#9333ea" }}>
                              🎫 {evt.coupon}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 店舗ごとの価格カード */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {matchingStores.map((store) => (
                    <div
                      key={store.storeId}
                      className="dq-card"
                      style={{ padding: 14 }}
                    >
                      {/* 店舗ヘッダー */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 22 }}>{store.chainIcon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{store.storeName}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                            <MapPin size={10} color="#64748b" />
                            <span style={{ fontSize: 10, color: "#64748b" }}>
                              {store.distanceKm}km — {store.openHours}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 商品リスト */}
                      {store.matchedProducts.filter((p) => inPriceRange(p.effectivePrice)).map((p, pi) => {
                        const src = sourceLabel[p.dataSource];
                        return (
                          <div
                            key={pi}
                            style={{
                              padding: "8px 10px",
                              background: src.bg,
                              borderRadius: 8,
                              marginBottom: 6,
                              border: `1px solid ${p.dataSource === "event" ? "#fde68a" : p.dataSource === "timesale" ? "#fca5a5" : p.dataSource === "flyer" ? "#e9d5ff" : "#e2e8f0"}`,
                            }}
                          >
                            {/* ソースバッジ */}
                            <div style={{ marginBottom: 5 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: src.color }}>{src.label}</span>
                              {p.flyerExpiry && (
                                <span style={{ fontSize: 9, color: "#64748b", marginLeft: 6 }}>期限: {p.flyerExpiry}</span>
                              )}
                            </div>

                            {/* 価格 */}
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 18, fontWeight: 900, color: "#059669" }}>
                                ¥{p.effectivePrice.toLocaleString()}
                              </span>
                              <span style={{ fontSize: 11, color: "#64748b", textDecoration: "line-through" }}>
                                ¥{p.price.toLocaleString()}
                              </span>
                              {p.inStorePointRate > 0 && (
                                <span style={{ fontSize: 10, color: "#d97706", fontWeight: 600 }}>
                                  +{p.inStorePointRate}%pt
                                </span>
                              )}
                            </div>

                            {/* 在庫 */}
                            <div style={{ fontSize: 10, color: p.stock === "在庫あり" ? "#059669" : p.stock === "残りわずか" ? "#d97706" : "#dc2626", fontWeight: 600, marginBottom: 4 }}>
                              {p.stock}
                            </div>

                            {/* ノート */}
                            {p.note && (
                              <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>{p.note}</div>
                            )}

                            {/* イベント詳細 */}
                            {p.eventNote && (
                              <div style={{ fontSize: 10, color: "#92400e", padding: "4px 6px", background: "rgba(255,251,235,0.8)", borderRadius: 4 }}>
                                {p.eventNote}
                              </div>
                            )}

                            {/* 店頭のポイントは利用頻度による実質価値警告 */}
                            {(store.chain === "ヤマダ電機" || store.chain === "ビックカメラ") && p.inStorePointRate > 0 && (
                              <div style={{ marginTop: 4, fontSize: 9, color: "#dc2626" }}>
                                ⚠️ {store.chain}ポイントは利用頻度低の場合失効リスクあり
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* MAP/電話ボタン */}
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <button
                          style={{
                            flex: 1, padding: "6px 0", borderRadius: 6,
                            border: "1px solid #e2e8f0", background: "white",
                            fontSize: 11, color: "#374151", cursor: "pointer", fontFamily: "inherit",
                          }}
                        >
                          📍 地図で見る
                        </button>
                        <button
                          style={{
                            flex: 1, padding: "6px 0", borderRadius: 6,
                            border: "1px solid #e2e8f0", background: "white",
                            fontSize: 11, color: "#374151", cursor: "pointer", fontFamily: "inherit",
                          }}
                        >
                          📞 {store.phone}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* データソース説明 */}
                <div style={{ marginTop: 10, padding: "8px 12px", background: "#f8fafc", borderRadius: 8, fontSize: 10, color: "#94a3b8", border: "1px solid #e2e8f0" }}>
                  📡 実店舗データは <strong>シュフー（Shufoo!）API</strong>・各店舗公式チラシ・イベントページより自動取得。
                  チラシ期限・価格は変動する場合があります。Phase 2でリアルタイム更新予定。
                </div>
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
