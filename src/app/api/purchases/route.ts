/**
 * POST /api/purchases → 購入記録追加
 *
 * 認証: Authorization: Bearer {Firebase IDトークン}
 * body: { uid, itemName, price, realPrice, savedAmount, cardName, cardId, shop }
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

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
    };

    if (!body.itemName || body.price == null) {
      return NextResponse.json({ error: "itemName と price は必須です" }, { status: 400 });
    }

    const id = `purchase_${Date.now()}`;

    await adminDb
      .collection("users")
      .doc(uid)
      .collection("purchases")
      .doc(id)
      .set({
        id,
        itemName:    body.itemName,
        price:       body.price,
        realPrice:   body.realPrice   ?? body.price,
        savedAmount: body.savedAmount ?? 0,
        cardName:    body.cardName    ?? "—",
        cardId:      body.cardId      ?? "",
        shop:        body.shop        ?? "",
        purchasedAt: FieldValue.serverTimestamp(),
      });

    console.log("[POST /api/purchases] 書き込み成功:", { uid, id, itemName: body.itemName });
    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error("[POST /api/purchases]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
