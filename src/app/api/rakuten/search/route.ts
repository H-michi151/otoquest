import { NextRequest, NextResponse } from "next/server";

/**
 * 楽天市場 商品検索API プロキシ
 *
 * 動作確認済みリクエスト形式（2022年6月以降の新APIゲートウェイ）:
 *   GET https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601
 *     ?format=json
 *     &keyword=...
 *     &hits=10
 *     &accessKey=pk_xxx        ← 必須（アクセスキー）
 *     &applicationId=UUID      ← 必須（UUID形式のアプリID）
 *   Headers:
 *     Referer: https://otoquest-uiov.vercel.app/  ← 許可されたWebサイトと一致
 *     Origin:  https://otoquest-uiov.vercel.app   ← 必須（Refererと同じドメイン）
 */

const RAKUTEN_API =
  "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // キーワード正規化: ①「｜」以降を削除 ②30文字に切り詰め ③trim
  // 例:「ASRock｜アスロック ASRock A520M-HVS / Micro-ATX対応 マザーボード」→「ASRock」
  const rawKeyword    = searchParams.get("keyword") || "";
  const keyword       = rawKeyword.split("｜")[0].slice(0, 30).trim();
  const hits          = Math.min(Number(searchParams.get("hits") || "10"), 100);
  const accessKey     = searchParams.get("accessKey") || process.env.RAKUTEN_ACCESS_KEY || "";
  const applicationId = searchParams.get("appId") || searchParams.get("applicationId") || process.env.RAKUTEN_APP_ID || "";

  if (!accessKey) {
    return NextResponse.json(
      { error: "RAKUTEN_ACCESS_KEY が設定されていません。" },
      { status: 400 }
    );
  }
  if (!applicationId) {
    return NextResponse.json(
      { error: "RAKUTEN_APP_ID (applicationId) が設定されていません。" },
      { status: 400 }
    );
  }
  if (!keyword.trim()) {
    return NextResponse.json({ error: "keyword が必要です。" }, { status: 400 });
  }

  // Referer: 楽天Developers「許可されたWebサイト」と一致させる（必須）
  const referer = process.env.RAKUTEN_REFERER || "https://otoquest-uiov.vercel.app/";
  const origin  = new URL(referer).origin;

  // ※ 新APIゲートウェイは sort パラメータ非対応のため除外
  const params = new URLSearchParams({
    format:        "json",
    keyword,
    hits:          String(hits),
    accessKey,
    applicationId, // UUID形式（2022年6月以降のアプリに発行されるID）
  });

  const url = `${RAKUTEN_API}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (OtoQuest/1.0)",
        "Referer":    referer, // 許可されたWebサイトと完全一致が必要
        "Origin":     origin,  // Refererと同じドメインのOriginも必須
      },
      signal: AbortSignal.timeout(12000),
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
            ? `楽天Developers → アプリ編集 → 許可されたWebサイト に '${new URL(referer).hostname}' を登録してください。`
            : undefined,
        },
        { status: res.status }
      );
    }

    const raw = JSON.parse(text);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = raw.Items ?? [];

    // 新APIゲートウェイのレスポンス構造に対応（Item ネストあり / なし）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalize = (entry: any) => entry?.Item ?? entry;

    return NextResponse.json({
      source:     "楽天市場",
      fetched_at: new Date().toISOString(),
      keyword,
      total:      raw.count ?? items.length,
      page:       raw.page  ?? 1,
      results: items.map((entry) => {
        const item = normalize(entry);
        return {
          itemName:       item.itemName        ?? "",
          shop:           item.shopName        ?? "",
          price:          item.itemPrice       ?? 0,
          point_rate:     item.pointRate       ?? 1,
          review_average: item.reviewAverage   ?? 0,
          review_count:   item.reviewCount     ?? 0,
          url:            item.itemUrl         ?? "",
          imageUrl:       item.mediumImageUrls?.[0]?.imageUrl ?? null,
        };
      }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "楽天APIへの接続に失敗しました。", detail: String(err) },
      { status: 500 }
    );
  }
}
