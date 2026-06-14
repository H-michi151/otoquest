/**
 * PUT    /api/purchases/[id] → 購入記録の更新
 * DELETE /api/purchases/[id] → 購入記録の削除
 *
 * 認証: Authorization: Bearer {Firebase IDトークン}
 * PUT body: 更新したいフィールドのみ（部分更新）
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

// ===== PUT: 購入記録の更新 =====
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!adminDb) {
    return NextResponse.json({ error: "Admin SDK未設定" }, { status: 503 });
  }

  const uid = await verifyToken(req);
  if (!uid) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json() as Partial<{
      itemName: string;
      price: number;
      realPrice: number;
      savedAmount: number;
      cardName: string;
      cardId: string;
      shop: string;
      category: string;
      quantity: number;
      unitPrice: number;
      couponDiscount: number;
      pointsUsed: number;
      billingMonth: string;
      memo: string;
      hasReceipt: boolean;
      printed: boolean;
      arrived: boolean;
      expenseEntered: boolean;
    }>;

    await adminDb
      .collection("users")
      .doc(uid)
      .collection("purchases")
      .doc(id)
      .set(
        { ...body, id, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

    console.log("[PUT /api/purchases/:id] 更新成功:", { uid, id });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[PUT /api/purchases/:id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ===== DELETE: 購入記録の削除 =====
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!adminDb) {
    return NextResponse.json({ error: "Admin SDK未設定" }, { status: 503 });
  }

  const uid = await verifyToken(req);
  if (!uid) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await adminDb
      .collection("users")
      .doc(uid)
      .collection("purchases")
      .doc(id)
      .delete();

    console.log("[DELETE /api/purchases/:id] 削除成功:", { uid, id });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[DELETE /api/purchases/:id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
