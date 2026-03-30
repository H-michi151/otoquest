import { NextRequest, NextResponse } from "next/server";

/**
 * 楽天市場 商品検索API プロキシ
 *
 * 動作確認済みリクエスト形式:
 *   GET https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601
 *     ?format=json
 *     &keyword=...
 *     &accessKey=pk_xxx
 *     &applicationId=UUID
 *   Header: Referer: <許可されたWebサイト>
 */

const RAKUTEN_API =
  "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const keyword     = searchParams.get("keyword") || "";
  const hits        = Math.min(Number(searchParams.get("hits") || "10"), 30);
  const sort        = searchParams.get("sort") || "+itemPrice";
  const accessKey   = searchParams.get("accessKey")   || process.env.RAKUTEN_ACCESS_KEY || "";
  const applicationId = searchParams.get("appId") || searchParams.get("applicationId") || process.env.RAKUTEN_APP_ID || "";

  if (!accessKey) {
    return NextResponse.json(
      { error: "RAKUTEN_ACCESS_KEY が設定されていません。" },
      { status: 400 }
    );
  }
  if (!keyword.trim()) {
    return NextResponse.json({ error: "keyword が必要です。" }, { status: 400 });
  }

  // Referer: 楽天Developers「許可されたWebサイト」と一致させる
  const referer = process.env.RAKUTEN_REFERER || "https://otoquest-uiov.vercel.app/";

  const params = new URLSearchParams({
    format: "json",
    keyword,
    hits:     String(hits),
    sort,
    accessKey,
  });
  if (applicationId) params.set("applicationId", applicationId);

  const url = `${RAKUTEN_API}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (OtoQuest/1.0)",
        "Referer":    referer,
        "Origin":     new URL(referer).origin,
      },
      signal: AbortSignal.timeout(12000), // 12秒タイムアウト
    });

    const text = await res.text();

    if (!res.ok) {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = text; }

      const e = (typeof parsed === "object" && parsed !== null)
        ? parsed as Record<string, unknown>
        : {};
      const errObj = e.errors as Record<string, unknown> | undefined;
      const msg = errObj?.errorMessage
        ? String(errObj.errorMessage)
        : (e.error_description ? String(e.error_description) : "");

      return NextResponse.json(
        {
          error:  `楽天API エラー ${res.status}` + (msg ? `: ${msg}` : ""),
          detail: typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : text,
          hint: msg === "REQUEST_CONTEXT_BODY_HTTP_REFERRER_MISSING"
            ? `楽天Developers → アプリ編集 → 許可されたWebサイト に '${new URL(referer).hostname}' を設定してください。`
            : undefined,
        },
        { status: res.status }
      );
    }

    const raw = JSON.parse(text);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = raw.Items ?? [];

    return NextResponse.json({
      source:     "楽天市場",
      fetched_at: new Date().toISOString(),
      keyword,
      total:      raw.count  ?? items.length,
      page:       raw.page   ?? 1,
      results: items.map((item) => ({
        itemName:       item.itemName        ?? "",
        shop:           item.shopName        ?? "",
        price:          item.itemPrice       ?? 0,
        point_rate:     item.pointRate       ?? 1,
        review_average: item.reviewAverage   ?? 0,
        review_count:   item.reviewCount     ?? 0,
        url:            item.itemUrl         ?? "",
        imageUrl:       item.mediumImageUrls?.[0]?.imageUrl ?? null,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "楽天APIへの接続に失敗しました。", detail: String(err) },
      { status: 500 }
    );
  }
}
