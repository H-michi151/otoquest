import { NextRequest, NextResponse } from "next/server";

/**
 * Yahoo!ショッピング 商品検索API v3 プロキシ
 *
 * 動作確認済みリクエスト形式:
 *   GET https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch
 *     ?appid=<YAHOO_APP_ID>   ← Client ID（Yahoo! デベロッパーネットワークで取得）
 *     &query=<keyword>
 *     &results=10             ← 件数（最大100）
 *     &sort=-score            ← 関連度順
 *     &condition=new          ← 新品のみ（省略で全品）
 *   ※ Yahoo! ID連携不要（appidのみで利用可能）
 *
 * レスポンス形式: 楽天APIと同じ形式で正規化して返す
 */

const YAHOO_API =
  "https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const keyword = searchParams.get("keyword") || "";
  const hits    = Math.min(Number(searchParams.get("hits") || "10"), 50);
  const appId   = searchParams.get("appId") || process.env.YAHOO_APP_ID || "";

  if (!appId) {
    return NextResponse.json(
      { error: "YAHOO_APP_ID が設定されていません。Yahoo! デベロッパーネットワークでClient IDを取得してください。" },
      { status: 400 }
    );
  }
  if (!keyword.trim()) {
    return NextResponse.json({ error: "keyword が必要です。" }, { status: 400 });
  }

  const params = new URLSearchParams({
    appid:   appId,
    query:   keyword,
    results: String(hits),
    sort:    "-score",          // 関連度順
    image_size: "300",          // サムネイル画像サイズ
  });

  const url = `${YAHOO_API}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (OtoQuest/1.0)",
      },
      signal: AbortSignal.timeout(12000),
    });

    const text = await res.text();

    if (!res.ok) {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = text; }

      return NextResponse.json(
        {
          error:  `Yahoo! Shopping API エラー ${res.status}`,
          detail: typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : text,
        },
        { status: res.status }
      );
    }

    const raw = JSON.parse(text);

    // Yahoo! v3 レスポンス構造:
    // { hits: [ { name, seller: { name }, price, point: { amount, premiumAmount },
    //             url, image: { medium } }, ... ], totalResultsReturned, totalResultsAvailable }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = raw.hits ?? [];

    return NextResponse.json({
      source:     "Yahoo!ショッピング",
      fetched_at: new Date().toISOString(),
      keyword,
      total:      raw.totalResultsAvailable ?? items.length,
      page:       1,
      results: items.map((item) => ({
        itemName:       item.name          ?? "",
        shop:           item.seller?.name  ?? "",
        price:          item.price         ?? 0,
        // Yahoo! のpoint.amountは付与ポイント数（整数）。倍率に変換するには price で割るが
        // ここでは素直にポイント数を返す（楽天のpoint_rateと単位が異なるため注意）
        point_rate:     item.point?.premiumMultiplier ?? item.point?.multiplier ?? 1,
        point_amount:   item.point?.amount ?? 0,
        review_average: item.review?.rate  ?? 0,
        review_count:   item.review?.count ?? 0,
        url:            item.url           ?? "",
        imageUrl:       item.image?.medium ?? null,
        // Yahoo! 固有フィールド
        jan_code:       item.janCode       ?? null,
        is_premium:     item.isPremium     ?? false,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Yahoo! Shopping APIへの接続に失敗しました。", detail: String(err) },
      { status: 500 }
    );
  }
}
