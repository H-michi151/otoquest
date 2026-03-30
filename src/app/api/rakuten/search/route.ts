import { NextRequest, NextResponse } from "next/server";

/**
 * 楽天市場 商品検索API プロキシ（旧API 2017年版）
 *
 * エンドポイント:
 *   GET https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706
 *
 * 認証: applicationId（UUID）をクエリパラメータで渡すだけ
 */

const RAKUTEN_API =
  "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const keyword = searchParams.get("keyword") || "";
  const hits    = Math.min(Number(searchParams.get("hits") || "10"), 30);
  const sort    = searchParams.get("sort") || "+itemPrice";

  const applicationId =
    searchParams.get("applicationId") ||
    process.env.RAKUTEN_APP_ID ||
    "";

  if (!applicationId) {
    return NextResponse.json(
      { error: "applicationId が設定されていません。.env.local の RAKUTEN_APP_ID を確認してください。" },
      { status: 400 }
    );
  }

  if (!keyword.trim()) {
    return NextResponse.json(
      { error: "keyword パラメータが必要です。" },
      { status: 400 }
    );
  }

  const params = new URLSearchParams({
    applicationId,
    keyword,
    hits:          String(hits),
    sort,
    formatVersion: "2",
  });

  const url = `${RAKUTEN_API}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "OtoQuest/1.0" },
      next: { revalidate: 300 },
    });

    const text = await res.text();

    if (!res.ok) {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      return NextResponse.json(
        {
          error:  `楽天API エラー ${res.status}`,
          detail: typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : text,
        },
        { status: res.status }
      );
    }

    const raw = JSON.parse(text);
    // formatVersion=2 の場合: Items は直接配列
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = raw.Items ?? [];

    const results = items.map((item) => ({
      itemName:       item.itemName        ?? "",
      shop:           item.shopName        ?? "",
      price:          item.itemPrice       ?? 0,
      point_rate:     item.pointRate       ?? 1,
      review_average: item.reviewAverage   ?? 0,
      review_count:   item.reviewCount     ?? 0,
      url:            item.itemUrl         ?? "",
      imageUrl:       item.mediumImageUrls?.[0]?.imageUrl ?? null,
    }));

    return NextResponse.json({
      source:     "楽天市場",
      fetched_at: new Date().toISOString(),
      keyword,
      total:      raw.count ?? results.length,
      page:       raw.page  ?? 1,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "楽天APIへの接続に失敗しました。", detail: String(err) },
      { status: 500 }
    );
  }
}
