// ==========================================
// オトクエスト - モックデータ
// ==========================================

// ユーザープロファイル
export const currentUser = {
  id: "user_001",
  name: "田中 みちる",
  avatar: "🧙‍♂️",
  level: 23,
  class: "魔法商人",
  totalSaved: 48320,
  monthlyBudget: 50000,
  monthlySpent: 31480,
  guildPoints: 1240,
  dailyGpToday: 85,
  dailyGpLimit: 120,
  hp: 180,
  maxHp: 200,
  mp: 95,
  maxMp: 100,
  attack: 145,
  defense: 130,
  joinedAt: "2025-10-01",
};

// ==========================================
// プラットフォーム利用頻度 × ポイント利用可能性データ
// ==========================================
// usabilityRate: 0.0〜1.0 = ポイントの実質価値係数
//   1.0 = すぐ使える（楽天、Amazon等 毎月利用）
//   0.5 = 半年に1回程度（使いきれるか不明）
//   0.1 = ほぼ利用なし（失効リスク大）
// purchasesPerYear: 年間購入回数（実績）
// pointExpiry: ポイント有効期限
// pointUsageRate: 過去1年で得したポイントのうち実際に使った割合
export const platformProfiles: Record<string, {
  usabilityRate: number;
  purchasesPerYear: number;
  pointExpiry: string;
  pointUsageRate: number;
  pointCurrency: string;
  category: "highly_used" | "moderate" | "rarely_used";
  warning?: string;
}> = {
  "Amazon": {
    usabilityRate: 1.0,
    purchasesPerYear: 28,
    pointExpiry: "1年（頻繁更新で実質無期限）",
    pointUsageRate: 0.98,
    pointCurrency: "Amazonポイント",
    category: "highly_used",
  },
  "楽天市場": {
    usabilityRate: 1.0,
    purchasesPerYear: 22,
    pointExpiry: "1年（利用で延長）",
    pointUsageRate: 0.95,
    pointCurrency: "楽天ポイント",
    category: "highly_used",
  },
  "Yahoo!ショッピング": {
    usabilityRate: 0.7,
    purchasesPerYear: 8,
    pointExpiry: "1年",
    pointUsageRate: 0.70,
    pointCurrency: "PayPayポイント",
    category: "moderate",
  },
  "ヨドバシ": {
    usabilityRate: 0.25,
    purchasesPerYear: 2,
    pointExpiry: "2年（ヨドバシポイント）",
    pointUsageRate: 0.28,
    pointCurrency: "ヨドバシポイント",
    category: "rarely_used",
    warning: "年2回程度の利用。ポイントが失効するリスクが高いため実質価値を25%で計算しています。",
  },
  "ビックカメラ": {
    usabilityRate: 0.2,
    purchasesPerYear: 1,
    pointExpiry: "2年",
    pointUsageRate: 0.20,
    pointCurrency: "ビックポイント",
    category: "rarely_used",
    warning: "年1回程度の利用。ポイント失効リスク大。",
  },
  "ヤマダ電機": {
    usabilityRate: 0.15,
    purchasesPerYear: 1,
    pointExpiry: "2年",
    pointUsageRate: 0.15,
    pointCurrency: "ヤマダポイント",
    category: "rarely_used",
    warning: "ほぼ利用なし。ポイントは計算対象から除外を推奨。",
  },
};

// ==========================================
// スマート最適化エンジン（スコアリング）
// ==========================================
// 優先順位：
//   1. 安全性（trustScore < 70 → リスクコスト加算）
//   2. 在庫安定性（残りわずか → 購入機会コスト加算）
//   3. 実質価格（価格 - ポイント実質価値）
//     ポイント実質価値 = ポイント数 × usabilityRate
// 最終スコアが低いほど「おすすめ」
export type OptimizationMode = "standard" | "bulk" | "safety_first" | "max_points";

export function calcOptimizedScore(
  price: number,
  points: number,
  trustScore: number,
  stock: string,
  platform: string,
  mode: OptimizationMode = "standard",
): {
  score: number;
  pointRealValue: number;
  usabilityRate: number;
  safetyPenalty: number;
  stockPenalty: number;
  adjustedEffectivePrice: number;
  verdict: "recommended" | "caution" | "avoid";
  verdictReason: string;
} {
  const profile = platformProfiles[platform];
  const usabilityRate = profile?.usabilityRate ?? 0.8;

  // ポイント実質価値（利用頻度で割引）
  const pointRealValue = Math.floor(points * usabilityRate);

  // 安全性ペナルティ（信頼スコアが低いほど高い）
  let safetyPenalty = 0;
  if (trustScore < 70)      safetyPenalty = Math.floor(price * 0.05); // 低信頼：5%相当のリスクコスト
  else if (trustScore < 85) safetyPenalty = Math.floor(price * 0.01); // 要注意：1%

  // 在庫ペナルティ（bulkモードではより重視）
  let stockPenalty = 0;
  if (stock === "残りわずか") {
    stockPenalty = mode === "bulk"
      ? Math.floor(price * 0.05)   // 大量購入なら在庫切れリスク大
      : Math.floor(price * 0.01);
  }
  if (stock === "在庫なし") stockPenalty = price; // 実質購入不可

  // 調整後実質価格
  const adjustedEffectivePrice = price - pointRealValue;

  // 最終スコア（低いほど良い）
  let score = adjustedEffectivePrice + safetyPenalty + stockPenalty;

  // モード別調整
  if (mode === "safety_first") {
    // 安全性重視：ペナルティを2倍
    score = adjustedEffectivePrice + safetyPenalty * 2 + stockPenalty;
  } else if (mode === "max_points") {
    // ポイント最大化：ポイント実質価値を1.5倍評価
    score = price - Math.floor(points * usabilityRate * 1.5) + safetyPenalty + stockPenalty;
  } else if (mode === "bulk") {
    // 大量購入：在庫を最重視、安全性も重視
    score = adjustedEffectivePrice + safetyPenalty + stockPenalty * 3;
  }

  // 評価判定
  let verdict: "recommended" | "caution" | "avoid" = "recommended";
  let verdictReason = "";
  if (trustScore < 70 || stock === "在庫なし") {
    verdict = "avoid";
    verdictReason = trustScore < 70 ? "出品者の信頼性が低い" : "在庫なし";
  } else if (trustScore < 85 || stock === "残りわずか" || (profile?.category === "rarely_used")) {
    verdict = "caution";
    verdictReason = trustScore < 85 ? "信頼スコア要注意" :
                   stock === "残りわずか" ? "在庫わずか" :
                   `${platform}の利用頻度低（ポイント失効リスク）`;
  }

  return { score, pointRealValue, usabilityRate, safetyPenalty, stockPenalty, adjustedEffectivePrice, verdict, verdictReason };
}


// クレジットカード
export const creditCards = [
  {
    id: "card_001",
    name: "楽天カード",
    brand: "VISA",
    color: "#cc0000",
    pointRate: 1.0,
    bonusRate: 3.0,
    annualFee: 0,
    campaignDeadline: null,
    campaignBonus: null,
    monthlySpend: 18500,
    accumulatedPoints: 3420,
    status: "active" as const,
    bestFor: ["楽天市場", "楽天ペイ"],
    recommendation: "maintain",
  },
  {
    id: "card_002",
    name: "三井住友カード(NL)",
    brand: "Visa",
    color: "#003087",
    pointRate: 0.5,
    bonusRate: 5.0,
    annualFee: 0,
    campaignDeadline: "2026-04-30",
    campaignBonus: 8000,
    monthlySpend: 8200,
    accumulatedPoints: 1850,
    status: "campaign" as const,
    bestFor: ["セブンイレブン", "ローソン", "スターバックス"],
    recommendation: "maintain",
  },
  {
    id: "card_003",
    name: "PayPayカード",
    brand: "JCB",
    color: "#1a237e",
    pointRate: 1.0,
    bonusRate: 2.0,
    annualFee: 0,
    campaignDeadline: "2026-03-31",
    campaignBonus: 3000,
    monthlySpend: 2100,
    accumulatedPoints: 620,
    status: "campaign" as const,
    bestFor: ["Yahoo!ショッピング", "PayPay加盟店"],
    recommendation: "maintain",
  },
  {
    id: "card_004",
    name: "イオンカード",
    brand: "Mastercard",
    color: "#e65100",
    pointRate: 0.5,
    bonusRate: 0.5,
    annualFee: 0,
    campaignDeadline: null,
    campaignBonus: null,
    monthlySpend: 1200,
    accumulatedPoints: 240,
    status: "review" as const,
    bestFor: ["イオン系列"],
    recommendation: "cancel",
    cancelReason: "月利用額が少なく、他カードで代替可能。イオン系列以外のメリットなし。",
  },
  {
    id: "card_005",
    name: "Amazonカード",
    brand: "Mastercard",
    color: "#FF9900",
    pointRate: 1.0,
    bonusRate: 3.0,
    annualFee: 0,
    campaignDeadline: null,
    campaignBonus: null,
    monthlySpend: 0,
    accumulatedPoints: 0,
    status: "review" as const,
    bestFor: ["Amazon"],
    recommendation: "consider",
    cancelReason: "Amazon以外では1%のみ。Amazonヘビーユーザーなら有効。",
  },
];

// ==========================================
// カード × 購入先 還元率マトリクス（全28パターン）
// ==========================================
// 行: カード名  列: 購入先サイト
// 数値: 基本還元率（%）— 2025年時点、キャンペーン・期間限定除く
// ==========================================
export const PLATFORMS = [
  "Amazon",
  "楽天市場",
  "Yahoo!ショッピング",
  "ヨドバシ",
  "ビックカメラ",
  "ヤマダ電機",
  "価格.com経由",
] as const;

export type PlatformName = (typeof PLATFORMS)[number];

export const cardPlatformMatrix: Record<string, Record<string, number>> = {
  "楽天カード": {
    "Amazon":             1.0, // 楽天カード基本還元率
    "楽天市場":            3.0, // 楽天市場でカード利用特典 +2%
    "Yahoo!ショッピング":  1.0,
    "ヨドバシ":            1.0,
    "ビックカメラ":        1.0,
    "ヤマダ電機":          1.0,
    "価格.com経由":        1.0,
  },
  "PayPayカード": {
    "Amazon":             1.0,
    "楽天市場":            1.0,
    "Yahoo!ショッピング":  2.0, // PayPayカード+PayPay残高払いで2%
    "ヨドバシ":            1.0,
    "ビックカメラ":        1.0,
    "ヤマダ電機":          1.0,
    "価格.com経由":        1.0,
  },
  "三井住友カード(NL)": {
    "Amazon":             0.5, // 基本還元率0.5%（コンビニ3社除くEC全般）
    "楽天市場":            0.5,
    "Yahoo!ショッピング":  0.5,
    "ヨドバシ":            0.5,
    "ビックカメラ":        0.5,
    "ヤマダ電機":          0.5,
    "価格.com経由":        0.5,
  },
  "Amazonカード": {
    "Amazon":             3.0, // Amazon.co.jp での購入は3%
    "楽天市場":            1.0, // Amazon以外は1%
    "Yahoo!ショッピング":  1.0,
    "ヨドバシ":            1.0,
    "ビックカメラ":        1.0,
    "ヤマダ電機":          1.0,
    "価格.com経由":        1.0,
  },
  // イオンカードは家電量販系ECで利用頻度低のため参考列のみ
  "イオンカード": {
    "Amazon":             0.5,
    "楽天市場":            0.5,
    "Yahoo!ショッピング":  0.5,
    "ヨドバシ":            0.5,
    "ビックカメラ":        0.5,
    "ヤマダ電機":          0.5,
    "価格.com経由":        0.5,
  },
};

/**
 * 指定した購入先に対して最も還元率が高いカードを返す
 * @param platform 購入先サイト名
 * @param userCardNames ユーザーが保有するカード名リスト
 */
export function getBestCardForPlatform(
  platform: string,
  userCardNames: string[]
): { cardName: string; rate: number } | null {
  let best: { cardName: string; rate: number } | null = null;
  for (const name of userCardNames) {
    const rate = cardPlatformMatrix[name]?.[platform] ?? 0;
    if (!best || rate > best.rate) {
      best = { cardName: name, rate };
    }
  }
  return best;
}

/**
 * 全カードの還元率を指定サイトで比較し、降順で返す
 */
export function compareCardsForPlatform(platform: string) {
  return Object.entries(cardPlatformMatrix)
    .map(([cardName, platforms]) => ({ cardName, rate: platforms[platform] ?? 0 }))
    .sort((a, b) => b.rate - a.rate);
}

/**
 * 指定カードの全サイト還元率を返す（降順）
 */
export function getCardRatesAllPlatforms(cardName: string) {
  const rates = cardPlatformMatrix[cardName];
  if (!rates) return [];
  return Object.entries(rates)
    .map(([platform, rate]) => ({ platform, rate }))
    .sort((a, b) => b.rate - a.rate);
}

// 注文・発送情報
export const orders = [
  {
    id: "ord_001",
    platform: "Amazon",
    platformIcon: "🛒",
    platformColor: "#FF9900",
    productName: "ASUS ROG Strix G16 ゲーミングノートPC",
    price: 189800,
    pointsEarned: 1898,
    status: "shipped" as const,
    orderDate: "2026-03-22",
    estimatedDelivery: "2026-03-25",
    trackingNumber: "1Z999AA10123456784",
    carrier: "ヤマト運輸",
    timeline: [
      { date: "2026-03-22 14:30", event: "注文確定", done: true },
      { date: "2026-03-23 09:15", event: "発送準備中", done: true },
      { date: "2026-03-24 11:00", event: "配送センター出発", done: true },
      { date: "2026-03-25 配達予定", event: "お届け予定", done: false },
    ],
  },
  {
    id: "ord_002",
    platform: "楽天市場",
    platformIcon: "🦅",
    platformColor: "#cc0000",
    productName: "Logicool MX Master 3S マウス",
    price: 13800,
    pointsEarned: 696,
    status: "delivered" as const,
    orderDate: "2026-03-18",
    estimatedDelivery: "2026-03-21",
    trackingNumber: "RS123456789JP",
    carrier: "ゆうパック",
    timeline: [
      { date: "2026-03-18 16:00", event: "注文確定", done: true },
      { date: "2026-03-19 10:00", event: "発送", done: true },
      { date: "2026-03-20 14:30", event: "配達完了", done: true },
    ],
  },
  {
    id: "ord_003",
    platform: "ヨドバシ.com",
    platformIcon: "🏪",
    platformColor: "#e60012",
    productName: "Sony WH-1000XM5 ノイズキャンセリングヘッドホン",
    price: 39600,
    pointsEarned: 3960,
    status: "preparing" as const,
    orderDate: "2026-03-24",
    estimatedDelivery: "2026-03-26",
    trackingNumber: "YB20260324001",
    carrier: "ヨドバシ即配",
    timeline: [
      { date: "2026-03-24 20:15", event: "注文確定", done: true },
      { date: "2026-03-25 準備中", event: "商品準備中", done: false },
      { date: "2026-03-26 お届け予定", event: "配達予定", done: false },
    ],
  },
  {
    id: "ord_004",
    platform: "Yahoo!ショッピング",
    platformIcon: "🛍️",
    platformColor: "#FF0033",
    productName: "ANKERモバイルバッテリー PowerCore 20000",
    price: 4980,
    pointsEarned: 498,
    status: "delivered" as const,
    orderDate: "2026-03-15",
    estimatedDelivery: "2026-03-17",
    trackingNumber: "YH776543219",
    carrier: "佐川急便",
    timeline: [
      { date: "2026-03-15 12:00", event: "注文確定", done: true },
      { date: "2026-03-16 08:00", event: "発送", done: true },
      { date: "2026-03-17 13:45", event: "配達完了", done: true },
    ],
  },
];

// キャンペーン情報
// pointCap: このキャンペーンで獲得できる上限ポイント（nullは無制限）
// pointsEarned: これまでに獲得済みのポイント
// isCapped: true = 上限到達 → 最適化計算から自動除外
export const campaigns: {
  id: string;
  platform: string;
  platformColor: string;
  name: string;
  description: string;
  bonusRate: number;
  status: "entered" | "not_entered";
  deadline: string;
  potentialPoints: number;
  category: string;
  pointCap: number | null;
  pointsEarned: number;
  isCapped: boolean;
  capNote: string;
}[] = [];

// よく買うアイテム（クイックフィルター用）
export const frequentItems: {
  category: string;
  icon: string;
  items: { name: string; tags: string[]; monthlyFreq: number }[];
}[] = [];


// 商品検索結果（モック）
// ==========================================
// 出品者プロファイル（配送・返品実績）
// ==========================================
// platformTrustScore: プラットフォーム自体の信頼性（変わらない）
// sellerTrustScore:   この出品者個別の信頼性（本ENGINE核心）
// deliveryScore:      配送遅延率の逆数（高いほど良い）
// returnRate:         返品・クレーム率(%) 低いほど良い
// missingRate:        不着・紛失率(%)
// accountAge:         出品者アカウント年齢（ヶ月）
// reviewCount:        レビュー数
// fakeReviewRisk:     サクラレビューリスク (0〜1)
// sellerType:         "official"=公式/メーカー, "retail"=大手量販, "marketplace"=個人・中小業者
export const sellerProfiles: Record<string, {
  name: string;
  platform: string;
  sellerTrustScore: number;
  sellerType: "official" | "retail" | "marketplace";
  deliveryScore: number;
  avgDeliveryDays: number;
  deliveryDelayRate: number;
  returnRate: number;
  missingRate: number;
  accountAgeMonths: number;
  reviewCount: number;
  reviewRating: number;
  fakeReviewRisk: number;
  flags: string[];
  verdict: "safe" | "caution" | "danger";
}> = {
  "amazon_direct": {
    name: "Amazon.co.jp",
    platform: "Amazon",
    sellerTrustScore: 99,
    sellerType: "official",
    deliveryScore: 98,
    avgDeliveryDays: 1,
    deliveryDelayRate: 0.5,
    returnRate: 1.2,
    missingRate: 0.1,
    accountAgeMonths: 300,
    reviewCount: 999999,
    reviewRating: 4.8,
    fakeReviewRisk: 0.02,
    flags: [],
    verdict: "safe",
  },
  "amazon_marketplace_cheap": {
    name: "格安PCショップXYZ（Amazon出品）",
    platform: "Amazon",
    sellerTrustScore: 58,
    sellerType: "marketplace",
    deliveryScore: 52,
    avgDeliveryDays: 7,
    deliveryDelayRate: 28.4,
    returnRate: 12.3,
    missingRate: 3.8,
    accountAgeMonths: 8,
    reviewCount: 143,
    reviewRating: 3.2,
    fakeReviewRisk: 0.65,
    flags: [
      "配送遅延率28% — 平均7日以上かかることが多い",
      "不着・紛失率3.8% — 100件に4件届かない実績",
      "返品率12% — 商品説明と異なるケースが多数",
      "アカウント開設8ヶ月 — 新規業者",
      "サクラレビュー検出（65%確率）",
    ],
    verdict: "danger",
  },
  "sony_rakuten_official": {
    name: "ソニーストア楽天市場店",
    platform: "楽天市場",
    sellerTrustScore: 98,
    sellerType: "official",
    deliveryScore: 96,
    avgDeliveryDays: 2,
    deliveryDelayRate: 1.2,
    returnRate: 1.5,
    missingRate: 0.05,
    accountAgeMonths: 180,
    reviewCount: 45820,
    reviewRating: 4.7,
    fakeReviewRisk: 0.03,
    flags: [],
    verdict: "safe",
  },
  "rakuten_marketplace_gadget": {
    name: "ガジェット格安本舗（楽天出品）",
    platform: "楽天市場",
    sellerTrustScore: 61,
    sellerType: "marketplace",
    deliveryScore: 60,
    avgDeliveryDays: 5,
    deliveryDelayRate: 22.1,
    returnRate: 9.8,
    missingRate: 2.1,
    accountAgeMonths: 14,
    reviewCount: 312,
    reviewRating: 3.6,
    fakeReviewRisk: 0.48,
    flags: [
      "配送遅延率22% — 週末注文は1週間超えることあり",
      "返品率9.8% — 商品状態への苦情が散見",
      "サクラレビューの疑い（48%確率）",
    ],
    verdict: "caution",
  },
  "yodobashi_direct": {
    name: "ヨドバシ.com",
    platform: "ヨドバシ",
    sellerTrustScore: 99,
    sellerType: "retail",
    deliveryScore: 99,
    avgDeliveryDays: 1,
    deliveryDelayRate: 0.3,
    returnRate: 0.8,
    missingRate: 0.02,
    accountAgeMonths: 240,
    reviewCount: 500000,
    reviewRating: 4.9,
    fakeReviewRisk: 0.01,
    flags: [],
    verdict: "safe",
  },
  "yahoo_gadget_cheap": {
    name: "ガジェット激安Shop（Yahoo!出品）",
    platform: "Yahoo!ショッピング",
    sellerTrustScore: 54,
    sellerType: "marketplace",
    deliveryScore: 48,
    avgDeliveryDays: 8,
    deliveryDelayRate: 35.2,
    returnRate: 14.1,
    missingRate: 5.2,
    accountAgeMonths: 6,
    reviewCount: 87,
    reviewRating: 2.9,
    fakeReviewRisk: 0.72,
    flags: [
      "⚠️ 配送遅延率35% — 3件に1件が遅延",
      "⚠️ 不着・紛失率5.2% — 20件に1件不着",
      "⚠️ 返品率14% — 商品説明詐称の苦情多数",
      "⚠️ アカウント開設6ヶ月 — 短命業者リスク",
      "🤖 サクラレビュー高確率（72%）検出",
      "💰 価格が市場相場の62% — 偽物・B品リスク",
    ],
    verdict: "danger",
  },
  "logicool_rakuten_official": {
    name: "ロジクール公式楽天市場店",
    platform: "楽天市場",
    sellerTrustScore: 99,
    sellerType: "official",
    deliveryScore: 97,
    avgDeliveryDays: 2,
    deliveryDelayRate: 0.8,
    returnRate: 1.0,
    missingRate: 0.03,
    accountAgeMonths: 96,
    reviewCount: 28400,
    reviewRating: 4.8,
    fakeReviewRisk: 0.02,
    flags: [],
    verdict: "safe",
  },
};

export const productSearchResults = (query: string) => {
  const products = [
    {
      id: "prod_001",
      name: "Sony WF-1000XM5 完全ワイヤレスイヤホン",
      image: "🎧",
      platforms: [
        {
          platform: "Amazon",
          price: 38500,
          pointRate: 1.0,
          points: 385,
          effectivePrice: 38115,
          trustScore: 98,
          stock: "在庫あり",
          delivery: "明日着",
          seller: "Amazon.co.jp",
          sellerKey: "amazon_direct",
          url: "https://amazon.co.jp/...",
        },
        {
          platform: "楽天市場",
          price: 37800,
          pointRate: 4.0,
          points: 1512,
          effectivePrice: 36288,
          trustScore: 95,
          stock: "在庫あり",
          delivery: "2-3日",
          seller: "ソニーストア楽天",
          sellerKey: "sony_rakuten_official",
          url: "https://rakuten.co.jp/...",
        },
        {
          platform: "ヨドバシ",
          price: 39600,
          pointRate: 10.0,
          points: 3960,
          effectivePrice: 35640,
          trustScore: 99,
          stock: "在庫あり",
          delivery: "翌日お届け",
          seller: "ヨドバシ.com",
          sellerKey: "yodobashi_direct",
          url: "https://yodobashi.com/...",
        },
        {
          platform: "Yahoo!ショッピング",
          price: 36500,
          pointRate: 5.0,
          points: 1825,
          effectivePrice: 34675,
          trustScore: 72,
          stock: "残りわずか",
          delivery: "3-5日",
          seller: "ガジェット激安Shop",
          sellerKey: "yahoo_gadget_cheap",
          url: "https://shopping.yahoo.co.jp/...",
        },
      ],
    },
    {
      id: "prod_002",
      name: "Logicool MX Keys S キーボード",
      image: "⌨️",
      platforms: [
        {
          platform: "Amazon",
          price: 16980,
          pointRate: 1.0,
          points: 170,
          effectivePrice: 16810,
          trustScore: 98,
          stock: "在庫あり",
          delivery: "翌日",
          seller: "Amazon.co.jp",
          sellerKey: "amazon_direct",
          url: "https://amazon.co.jp/...",
        },
        {
          platform: "楽天市場",
          price: 15980,
          pointRate: 2.0,
          points: 320,
          effectivePrice: 15660,
          trustScore: 96,
          stock: "在庫あり",
          delivery: "2日",
          seller: "ロジクール公式",
          sellerKey: "logicool_rakuten_official",
          url: "https://rakuten.co.jp/...",
        },
        {
          platform: "ヨドバシ",
          price: 16280,
          pointRate: 10.0,
          points: 1628,
          effectivePrice: 14652,

          trustScore: 99,
          stock: "在庫あり",
          delivery: "即日",
          seller: "ヨドバシ.com",
          url: "https://yodobashi.com/...",
        },
      ],
    },
  ];

  // クエリが空の場合もデモ用に返す
  return products;
};

// 信頼フィルター判定ロジック
export const trustFilterAnalysis = (url: string) => {
  const isKnownSafe = [
    "amazon.co.jp",
    "rakuten.co.jp",
    "yodobashi.com",
    "kakaku.com",
    "bic.com",
    "biccamera.com",
  ].some((safe) => url.includes(safe));

  const isKnownRisky = [
    "free-shop",
    "cheap-pc",
    "best-gadget-jp",
    "sale99",
  ].some((risky) => url.includes(risky));

  if (isKnownSafe) {
    return {
      overallScore: 96,
      risk: "low" as const,
      layers: [
        { name: "ECプラットフォーム信頼性", score: 100, icon: "🏪", detail: "大手ECサイト（ホワイトリスト登録済み）" },
        { name: "出品者信頼性", score: 98, icon: "👤", detail: "公式メーカー出品または直営" },
        { name: "価格妥当性", score: 95, icon: "💰", detail: "市場相場範囲内（-3%〜+5%）" },
        { name: "レビュー真正性", score: 94, icon: "⭐", detail: "サクラレビュー検出なし" },
        { name: "商品情報整合性", score: 96, icon: "📋", detail: "公式スペックと一致" },
      ],
    };
  } else if (isKnownRisky) {
    return {
      overallScore: 32,
      risk: "high" as const,
      layers: [
        { name: "ECプラットフォーム信頼性", score: 40, icon: "🏪", detail: "登録日が直近、類似ドメイン検出" },
        { name: "出品者信頼性", score: 25, icon: "👤", detail: "評価件数少（12件）、アカウント歴<3ヶ月" },
        { name: "価格妥当性", score: 28, icon: "💰", detail: "⚠️ 市場相場の52% - 危険なほど安い" },
        { name: "レビュー真正性", score: 35, icon: "⭐", detail: "⚠️ 投稿日集中・同一文体パターン検出" },
        { name: "商品情報整合性", score: 30, icon: "📋", detail: "⚠️ 商品画像に不審な点・日本語不自然" },
      ],
    };
  } else {
    return {
      overallScore: 71,
      risk: "medium" as const,
      layers: [
        { name: "ECプラットフォーム信頼性", score: 78, icon: "🏪", detail: "中小ECサイト。実績あり要確認" },
        { name: "出品者信頼性", score: 72, icon: "👤", detail: "評価3.8/5、1,240件" },
        { name: "価格妥当性", score: 75, icon: "💰", detail: "市場相場比-12%（やや安め）" },
        { name: "レビュー真正性", score: 68, icon: "⭐", detail: "一部疑わしいレビューパターンを検出" },
        { name: "商品情報整合性", score: 70, icon: "📋", detail: "スペック表記に軽微な不一致" },
      ],
    };
  }
};

// ゲームデータ
export const gameData = {
  player: {
    name: "田中 みちる",
    savemon: {
      name: "クアッドン",
      emoji: "🐉",
      level: 23,
      hp: 180,
      maxHp: 200,
      mp: 95,
      maxMp: 100,
      attack: 145,
      defense: 130,
      speed: 112,
      evolution: "チップン → クアッドン → オクタロード",
    },
    class: "賢者",
    classEmoji: "🧙‍♂️",
    skills: [
      { name: "メラゾーマ", emoji: "🔥", mp: 22, description: "業火を放ち、相手に強烈な炎のダメージを与える", element: "fire" },
      { name: "ヒャダルコ", emoji: "❄️", mp: 18, description: "極寒の氷弾を一斉に放つ中級氷呪文", element: "ice" },
      { name: "ギガスラッシュ", emoji: "⚡", mp: 36, description: "全身から電光のオーラを放ち敵全体を薙ぎ払う", element: "lightning" },
      { name: "ベホマ", emoji: "💚", mp: 24, description: "HPを完全に回復する最上位の回復呪文", element: "heal" },
    ],
    equipment: {
      weapon: { name: "はぐれメタルの剣", emoji: "⚔️", bonus: "+15 ATK, 会心率+10%" },
      armor:  { name: "ドラゴンメイル",   emoji: "🛡️", bonus: "+20 DEF, 炎耐性" },
      accessory: { name: "命のリング",      emoji: "💍", bonus: "最大HP+30" },
    },
    gp: 1240,
    dailyGp: 85,
    dailyGpLimit: 120,
    league: "ゴールドリーグ",
    rank: 12,
    winRate: 68,
    totalBattles: 156,
  },
  leaderboard: [
    { rank: 1, name: "佐藤 健一",  class: "大魔道士",   emoji: "🧙",  level: 87, totalGp: 45200, league: "レジェンドリーグ" },
    { rank: 2, name: "鈴木 花子",  class: "武闘家",     emoji: "👊",  level: 72, totalGp: 38900, league: "プラチナリーグ" },
    { rank: 3, name: "山田 太郎",  class: "勇者",       emoji: "⚔️",  level: 65, totalGp: 31400, league: "プラチナリーグ" },
    { rank: 4, name: "田中 みちる",class: "賢者",       emoji: "🧙‍♂️", level: 23, totalGp: 1240,  league: "ゴールドリーグ", isMe: true },
    { rank: 5, name: "伊藤 直樹",  class: "盗賊",       emoji: "🗡️",  level: 19, totalGp: 980,   league: "シルバーリーグ" },
  ],
  battleHistory: [
    { opponent: "バブルスライム",     result: "win",  gpGained: 45, date: "2026-03-25", icon: "🫧" },
    { opponent: "メタルスライム",     result: "win",  gpGained: 38, date: "2026-03-24", icon: "🪨" },
    { opponent: "キラータイガー",     result: "loss", gpGained: 0,  date: "2026-03-23", icon: "🐯" },
    { opponent: "ドラキー",          result: "win",  gpGained: 52, date: "2026-03-22", icon: "🦇" },
  ],
  monsters: [
    { name: "スライム",       emoji: "💧", level: 1,  hp: 8,   xp: 1,  gp: 3,  abilities: ["たいあたり"] },
    { name: "バブルスライム", emoji: "🫧", level: 4,  hp: 20,  xp: 5,  gp: 10, abilities: ["あまいいき", "たいあたり"] },
    { name: "メタルスライム", emoji: "🪨", level: 12, hp: 4,   xp: 115, gp: 48, abilities: ["にげる"] },
    { name: "ドラキー",      emoji: "🦇", level: 5,  hp: 16,  xp: 8,  gp: 15, abilities: ["ルカニ"] },
    { name: "キラータイガー",emoji: "🐯", level: 20, hp: 98,  xp: 80, gp: 100, abilities: ["はやぶさ斬り"] },
  ],
};

// ==========================================
// 実店舗情報（チラシ・タイムセール・イベント）
// ==========================================
// dataSource: "flyer"=チラシ, "event"=店頭イベント, "timesale"=タイムセール, "lineup"=通常在庫
// flyerExpiry: チラシ有効期限（null=常時）
// distanceKm: ユーザー登録拠点からの距離
// inStorePointRate: 店頭でのポイント還元率（カード非使用時）
export const physicalStores: Array<{
  storeId: string;
  storeName: string;
  chain: string;
  chainIcon: string;
  address: string;
  distanceKm: number;
  openHours: string;
  phone: string;
  products: Array<{
    productName: string;
    productKeywords: string[];
    price: number;
    inStorePointRate: number;
    inStorePoints: number;
    effectivePrice: number;
    stock: "在庫あり" | "残りわずか" | "在庫なし" | "取り寄せ可";
    dataSource: "flyer" | "event" | "timesale" | "lineup";
    flyerTitle?: string;
    flyerExpiry?: string;
    eventName?: string;
    eventNote?: string;
    note?: string;
  }>;
}> = [
  {
    storeId: "store_001",
    storeName: "ヨドバシカメラ マルチメディアAkiba",
    chain: "ヨドバシ",
    chainIcon: "🏬",
    address: "東京都千代田区外神田1-1-1",
    distanceKm: 1.2,
    openHours: "9:30〜22:00",
    phone: "03-5209-1010",
    products: [
      {
        productName: "Sony WF-1000XM5 完全ワイヤレスイヤホン",
        productKeywords: ["Sony", "WF-1000XM5", "イヤホン", "ソニー"],
        price: 38500,
        inStorePointRate: 10.0,
        inStorePoints: 3850,
        effectivePrice: 34650,
        stock: "在庫あり",
        dataSource: "lineup",
        note: "展示機あり・試聴可能",
      },
      {
        productName: "Sony WH-1000XM5 ヘッドホン",
        productKeywords: ["Sony", "WH-1000XM5", "ヘッドホン", "ソニー"],
        price: 39600,
        inStorePointRate: 10.0,
        inStorePoints: 3960,
        effectivePrice: 35640,
        stock: "在庫あり",
        dataSource: "timesale",
        flyerTitle: "春の大感謝祭セール",
        flyerExpiry: "2026-03-31",
        note: "🏷️ タイムセール対象品（3/31まで）展示機試聴可",
      },
      {
        productName: "Logicool MX Keys S キーボード",
        productKeywords: ["Logicool", "MX Keys S", "キーボード", "ロジクール"],
        price: 15800,
        inStorePointRate: 10.0,
        inStorePoints: 1580,
        effectivePrice: 14220,
        stock: "在庫あり",
        dataSource: "flyer",
        flyerTitle: "ヨドバシ週末チラシ",
        flyerExpiry: "2026-03-30",
        note: "📰 チラシ特価（3/30まで）",
      },
    ],
  },
  {
    storeId: "store_002",
    storeName: "ビックカメラ 有楽町店",
    chain: "ビックカメラ",
    chainIcon: "🏪",
    address: "東京都千代田区有楽町2-10-1",
    distanceKm: 2.5,
    openHours: "10:00〜21:00",
    phone: "03-5221-1111",
    products: [
      {
        productName: "Sony WF-1000XM5 完全ワイヤレスイヤホン",
        productKeywords: ["Sony", "WF-1000XM5", "イヤホン", "ソニー"],
        price: 39800,
        inStorePointRate: 10.0,
        inStorePoints: 3980,
        effectivePrice: 35820,
        stock: "残りわずか",
        dataSource: "flyer",
        flyerTitle: "春のオーディオフェア",
        flyerExpiry: "2026-03-28",
        eventName: "ソニー試聴イベント",
        eventNote: "ソニー担当者による製品説明会 3/28(土) 13:00〜17:00",
        note: "📰 チラシ価格 + 🎪 試聴イベント",
      },
      {
        productName: "Logicool MX Keys S キーボード",
        productKeywords: ["Logicool", "MX Keys S", "キーボード", "ロジクール"],
        price: 16280,
        inStorePointRate: 10.0,
        inStorePoints: 1628,
        effectivePrice: 14652,
        stock: "在庫あり",
        dataSource: "lineup",
        note: "展示機あり",
      },
    ],
  },
  {
    storeId: "store_003",
    storeName: "ヤマダデンキ LABI秋葉原",
    chain: "ヤマダ電機",
    chainIcon: "🔌",
    address: "東京都千代田区外神田4-1-2",
    distanceKm: 1.8,
    openHours: "10:00〜22:00",
    phone: "03-5297-3899",
    products: [
      {
        productName: "Sony WF-1000XM5 完全ワイヤレスイヤホン",
        productKeywords: ["Sony", "WF-1000XM5", "イヤホン", "ソニー"],
        price: 36800,
        inStorePointRate: 10.0,
        inStorePoints: 3680,
        effectivePrice: 33120,
        stock: "在庫あり",
        dataSource: "event",
        eventName: "ヤマダ春のオーディオフェスタ",
        eventNote: "🎪 3/26(木)〜3/31(月) 期間限定特価。他店対抗値引き交渉可。",
        flyerExpiry: "2026-03-31",
        note: "🎉 イベント特価（値引き交渉可）",
      },
    ],
  },
  {
    storeId: "store_004",
    storeName: "コストコ 幕張倉庫店",
    chain: "コストコ",
    chainIcon: "📦",
    address: "千葉県千葉市美浜区豊砂2-1",
    distanceKm: 32.0,
    openHours: "10:00〜20:00（会員限定）",
    phone: "043-272-6300",
    products: [
      {
        productName: "Sony WF-1000XM5 完全ワイヤレスイヤホン",
        productKeywords: ["Sony", "WF-1000XM5", "イヤホン", "ソニー"],
        price: 34980,
        inStorePointRate: 0,
        inStorePoints: 0,
        effectivePrice: 34980,
        stock: "在庫あり",
        dataSource: "timesale",
        flyerExpiry: "2026-04-15",
        note: "📦 まとめ買い向け・大量在庫あり。会員カード必要。",
      },
    ],
  },
];

// 店頭イベント（商品に紐付かないもの）
export const storeEvents = [
  {
    id: "evt_001",
    storeName: "ビックカメラ 有楽町店",
    chain: "ビックカメラ",
    eventName: "ソニー特別試聴＆展示会",
    date: "2026-03-28",
    time: "13:00〜17:00",
    description: "ソニー担当者によるWF/WH-1000XM5の詳細説明・比較試聴。購入すると会場限定クーポン（500円OFF）配布。",
    targetProducts: ["Sony WF-1000XM5", "Sony WH-1000XM5"],
    coupon: "会場限定500円OFFクーポン",
    icon: "🎧",
  },
  {
    id: "evt_002",
    storeName: "ヤマダデンキ LABI秋葉原",
    chain: "ヤマダ電機",
    eventName: "春のオーディオフェスタ",
    date: "2026-03-26〜31",
    time: "10:00〜22:00",
    description: "対象商品が最大20%OFF。他店より高い場合は値下げ交渉に応じる。",
    targetProducts: ["Sony WF-1000XM5", "Logicool MX Keys S"],
    coupon: null,
    icon: "🎉",
  },
  {
    id: "evt_003",
    storeName: "ヨドバシカメラ マルチメディアAkiba",
    chain: "ヨドバシ",
    eventName: "春の大感謝祭",
    date: "2026-03-25〜31",
    time: "9:30〜22:00",
    description: "対象品タイムセール。ゴールドポイントカードで購入時ポイント10〜15%還元。店頭受取で送料無料。",
    targetProducts: ["Sony WH-1000XM5", "Logicool MX Keys S"],
    coupon: "LINE登録で追加1%ポイント",
    icon: "🛍️",
  },
];

// 節約統計
export const savingsStats = {

  thisMonth: {
    totalSaved: 12480,
    pointsEarned: 8920,
    campaignsUsed: 4,
    couponsApplied: 7,
    avgDiscount: 18.4,
  },
  lastMonth: {
    totalSaved: 9830,
    pointsEarned: 7210,
    campaignsUsed: 3,
    couponsApplied: 5,
    avgDiscount: 14.2,
  },
  history: [
    { month: "10月", saved: 6200, points: 4100 },
    { month: "11月", saved: 8400, points: 5800 },
    { month: "12月", saved: 15200, points: 10400 },
    { month: "1月", saved: 7800, points: 5200 },
    { month: "2月", saved: 9830, points: 7210 },
    { month: "3月", saved: 12480, points: 8920 },
  ],
};
