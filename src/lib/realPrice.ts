/**
 * 実質価格計算ユーティリティ
 *
 * 計算式:
 *   実質価格 = 表示価格
 *            - クーポン割引額
 *            - floor(表示価格 × 合計還元率(%) / 100 × ポイント利用頻度)
 *
 *   合計還元率 = APIのpoint_rate + カード追加還元率
 */

import {
  cardPlatformMatrix,
  platformProfiles,
  creditCards,
} from "@/lib/mockData";

// ----------------------------------------
// 型定義
// ----------------------------------------

/** API から取得した生の商品データ */
export interface ApiItem {
  itemName: string;
  shop: string;
  price: number;
  point_rate: number;   // APIが返すポイント還元率（%）
  review_average: number;
  review_count: number;
  url: string;
  imageUrl?: string | null;
}

/** 実質価格計算後の拡張データ */
export interface EnrichedItem extends ApiItem {
  source: "楽天市場" | "Yahoo!ショッピング";
  couponDiscount: number;    // クーポン割引額（円）※現時点では0
  cardName: string;          // 適用カード名
  cardRate: number;          // カード追加還元率（%）
  totalRate: number;         // 合計還元率 = point_rate + cardRate
  usabilityRate: number;     // ポイント利用頻度（0〜1）
  pointValue: number;        // 実質的なポイント価値（円）
  realPrice: number;         // 実質価格（円）
}

/** カードプロファイル（ユーザー設定） */
export interface UserCardProfile {
  name: string;   // "楽天カード" | "PayPayカード" | etc.
}

// ----------------------------------------
// ユーティリティ関数
// ----------------------------------------

/**
 * ユーザー保有カードの中から、指定プラットフォームで最高還元率のカードを選ぶ
 */
export function getBestCardForSource(
  source: "楽天市場" | "Yahoo!ショッピング",
  userCards: string[]
): { name: string; rate: number } {
  let best = { name: "（カードなし）", rate: 0 };
  for (const cardName of userCards) {
    const rate = cardPlatformMatrix[cardName]?.[source] ?? 0;
    if (rate > best.rate) best = { name: cardName, rate };
  }
  return best;
}

/**
 * 実質価格を計算して EnrichedItem を返す
 */
export function enrichItem(
  item: ApiItem,
  source: "楽天市場" | "Yahoo!ショッピング",
  userCards: string[],
  couponDiscount = 0
): EnrichedItem {
  const bestCard = getBestCardForSource(source, userCards);
  const profile = platformProfiles[source];
  const usabilityRate = profile?.usabilityRate ?? 0.8;

  const pointRatePct =
    source === "Yahoo!ショッピング"
      ? (item.point_rate - 1) * 100   // 倍率 → %（例: 2倍 → 1%）
      : item.point_rate;               // 楽天はそのまま %
  const totalRate = pointRatePct + bestCard.rate;
  const pointValue = Math.floor(item.price * totalRate / 100 * usabilityRate);
  const realPrice = item.price - couponDiscount - pointValue;

  return {
    ...item,
    source,
    couponDiscount,
    cardName: bestCard.name,
    cardRate: bestCard.rate,
    totalRate,
    usabilityRate,
    pointValue,
    realPrice,
  };
}

/**
 * localStorageのCard（pointRate = SPU込み実効還元率）を使った実質価格計算
 *
 * B-1対応: cardPlatformMatrix を参照せず、登録カードのpointRateを
 * そのまま実効還元率として使用する。
 *   楽天: pointRate = 基本還元率 × SPU倍率の合計（ユーザーが入力）
 *   Yahoo: pointRate = 基本還元率のみ（SPU適用なし）
 */
export function enrichItemWithLocalCards(
  item: ApiItem,
  source: "楽天市場" | "Yahoo!ショッピング",
  userCardObjects: { name: string; pointRate: number }[],
  couponDiscount = 0
): EnrichedItem {
  // pointRate最大のカードを選択
  let bestCard = { name: "（カードなし）", rate: 0 };
  for (const card of userCardObjects) {
    if (card.pointRate > bestCard.rate) {
      bestCard = { name: card.name, rate: card.pointRate };
    }
  }

  const profile = platformProfiles[source];
  const usabilityRate = profile?.usabilityRate ?? 0.8;

  // APIから得たプラットフォーム還元率（%換算）
  const platformRatePct =
    source === "Yahoo!ショッピング"
      ? (item.point_rate - 1) * 100   // 倍率 → %（例: 2倍 → 1%）
      : item.point_rate;               // 楽天はそのまま %

  // カードのpointRateは実効還元率なのでそのまま加算
  const totalRate = platformRatePct + bestCard.rate;
  const pointValue = Math.floor(item.price * totalRate / 100 * usabilityRate);
  const realPrice = item.price - couponDiscount - pointValue;

  return {
    ...item,
    source,
    couponDiscount,
    cardName: bestCard.name,
    cardRate: bestCard.rate,
    totalRate,
    usabilityRate,
    pointValue,
    realPrice,
  };
}

/**
 * EnrichedItem のリストをソートして順位をつける
 *
 * 優先順位（③ 厳密化済み）:
 *   1位：実質価格が安い順（絶対条件・1円でも差があれば安い方が上位）
 *   同額（±0円）の場合のみ：実効還元率が高い方を優先
 */
export function rankItems(items: EnrichedItem[]): EnrichedItem[] {
  return [...items].sort((a, b) => {
    const diff = a.realPrice - b.realPrice;
    if (diff === 0) {
      // 完全同額のみ実効還元率（cardRate）で決定
      return b.cardRate - a.cardRate;
    }
    return diff;
  });
}

/**
 * デフォルトのユーザー保有カード名リスト（active / campaign のみ）
 */
export const defaultUserCardNames: string[] = creditCards
  .filter((c) => c.status === "active" || c.status === "campaign")
  .map((c) => c.name);

/**
 * 指定カードのみを保有するユーザー設定を生成（テスト用）
 */
export function makeUserWithCard(cardName: string): string[] {
  return [cardName];
}
