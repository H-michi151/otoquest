/**
 * GET  /api/purchases?cardId=xxx&month=YYYY-MM → 指定カード・月の購入合計取得
 * POST /api/purchases → 購入記録追加
 *
 * 認証: Authorization: Bearer {Firebase IDトークン}
 * GET  params: cardId, month（例: "2026-06"）
 * POST body: { itemName, price, realPrice, savedAmount, cardName, cardId, shop }
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

// JST オフセット（+9時間をミリ秒で）
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Firestore Timestamp または null を JST の "YYYY-MM" 文字列に変換 */
function toJstYearMonth(ts: Timestamp | null | undefined): string {
  if (!ts) return "";
  const utcMs = ts.toMillis();
  const jstDate = new Date(utcMs + JST_OFFSET_MS);
  const y = jstDate.getUTCFullYear();
  const m = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ===== 共通: IDトークンからuidを取得 =====
async function verifyToken(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const idToken = auth.slice(7);
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}

// ===== GET: 指定カード・月の購入合計取得 =====
export async function GET(req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ error: "Admin SDK未設定" }, { status: 503 });
  }

  const uid = await verifyToken(req);
  if (!uid) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cardId = searchParams.get("cardId");
  const month  = searchParams.get("month");   // "YYYY-MM"

  if (!cardId || !month) {
    return NextResponse.json({ error: "cardId と month は必須です" }, { status: 400 });
  }

  try {
    const snap = await adminDb
      .collection("users")
      .doc(uid)
      .collection("purchases")
      .get();

    let total = 0;
    snap.docs.forEach((d) => {
      const data = d.data();
      const jstMonth = toJstYearMonth(data.purchasedAt as Timestamp | null);
      if (data.cardId === cardId && jstMonth === month) {
        total += (data.price as number) ?? 0;
      }
    });

    console.log(`[GET /api/purchases] uid=${uid} cardId=${cardId} month=${month} total=${total}`);
    return NextResponse.json({ total });
  } catch (e) {
    console.error("[GET /api/purchases]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ===== POST: 購入記録追加 =====
export async function POST(req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ error: "Admin SDK未設定" }, { status: 503 });
  }

  const uid = await verifyToken(req);
  if (!uid) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  try {
    const body = await req.json() as {
      itemName: string;
      price: number;
      realPrice: number;
      savedAmount: number;
      cardName: string;
      cardId: string;
      shop: string;
      // 拡張フィールド（任意）
      category?: string;
      quantity?: number;
      unitPrice?: number;
      couponDiscount?: number;
      pointsUsed?: number;
      memo?: string;
      hasReceipt?: boolean;
      printed?: boolean;
      arrived?: boolean;
      expenseEntered?: boolean;
    };

    if (!body.itemName || body.price == null) {
      return NextResponse.json({ error: "itemName と price は必須です" }, { status: 400 });
    }

    const id = `purchase_${Date.now()}`;

    // billingMonth: リクエスト時刻をJST変換して生成
    const now = new Date();
    const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
    const billingMonth = `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, "0")}`;

    await adminDb
      .collection("users")
      .doc(uid)
      .collection("purchases")
      .doc(id)
      .set({
        id,
        itemName:       body.itemName,
        price:          body.price,
        realPrice:      body.realPrice      ?? body.price,
        savedAmount:    body.savedAmount    ?? 0,
        cardName:       body.cardName       ?? "—",
        cardId:         body.cardId         ?? "",
        shop:           body.shop           ?? "",
        purchasedAt:    FieldValue.serverTimestamp(),
        // 拡張フィールド
        category:       body.category       ?? "",
        quantity:       body.quantity       ?? 1,
        unitPrice:      body.unitPrice      ?? body.price,
        couponDiscount: body.couponDiscount ?? 0,
        pointsUsed:     body.pointsUsed     ?? 0,
        billingMonth,
        memo:           body.memo           ?? "",
        hasReceipt:     body.hasReceipt     ?? false,
        printed:        body.printed        ?? false,
        arrived:        body.arrived        ?? false,
        expenseEntered: body.expenseEntered ?? false,
      });

    console.log("[POST /api/purchases] 書き込み成功:", { uid, id, itemName: body.itemName, billingMonth });
    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error("[POST /api/purchases]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
