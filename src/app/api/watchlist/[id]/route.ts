/**
 * PUT    /api/watchlist/[id] → アイテム更新（管理者のみ）
 * DELETE /api/watchlist/[id] → アイテム削除（管理者のみ）
 *
 * PUT 種別:
 *   A) 価格更新: body に { currentPrice, currentShop } が含まれる場合
 *      - previousPrice ← 現在の currentPrice
 *      - currentPrice・currentShop 更新
 *      - priceHistory 先頭に { date, price, shop } を追加（最大50件）
 *   B) アラート更新: body に { alertPrice } が含まれる場合
 *      - alertPrice のみ更新
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID ?? "";

// JST オフセット（+9時間をミリ秒で）
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toJstDateStr(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

// ===== 共通: 管理者確認 =====
async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const uid = await verifyToken(req);
  return !!uid && uid === ADMIN_UID;
}

// ===== PUT: アイテム更新（管理者のみ） =====
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!adminDb) {
    return NextResponse.json({ error: "Admin SDK未設定" }, { status: 503 });
  }

  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const { id } = await params;
  const docRef = adminDb.collection("watchlist_items").doc(id);

  try {
    const body = await req.json() as {
      currentPrice?: number;
      currentShop?: string;
      alertPrice?: number;
      category?: string;
      name?: string;
      keyword?: string;
      order?: number;
    };

    // ===== A) 価格更新 =====
    if (body.currentPrice !== undefined) {
      // 現在のドキュメントを取得して previousPrice を設定
      const snap = await docRef.get();
      const existing = snap.data() ?? {};
      const prevPrice = (existing.currentPrice as number) ?? 0;

      // 既存の priceHistory を取得（最大50件に制限）
      const existingHistory = (existing.priceHistory as Array<{ date: string; price: number; shop: string }>) ?? [];
      const newEntry = {
        date:  toJstDateStr(new Date()),
        price: body.currentPrice,
        shop:  body.currentShop ?? "",
      };
      const priceHistory = [newEntry, ...existingHistory].slice(0, 50);

      await docRef.set(
        {
          previousPrice: prevPrice,
          currentPrice:  body.currentPrice,
          currentShop:   body.currentShop ?? "",
          priceHistory,
          updatedAt:     FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log("[PUT /api/watchlist/:id] 価格更新成功:", { id, currentPrice: body.currentPrice });
      return NextResponse.json({ ok: true, id, type: "price" });
    }

    // ===== B) アラート更新 =====
    if (body.alertPrice !== undefined) {
      await docRef.set(
        { alertPrice: body.alertPrice, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      console.log("[PUT /api/watchlist/:id] アラート更新成功:", { id, alertPrice: body.alertPrice });
      return NextResponse.json({ ok: true, id, type: "alert" });
    }

    // ===== C) その他フィールド更新（category / name / keyword / order） =====
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (body.category !== undefined) updates.category = body.category;
    if (body.name     !== undefined) updates.name     = body.name;
    if (body.keyword  !== undefined) updates.keyword  = body.keyword;
    if (body.order    !== undefined) updates.order    = body.order;

    await docRef.set(updates, { merge: true });
    console.log("[PUT /api/watchlist/:id] フィールド更新成功:", { id });
    return NextResponse.json({ ok: true, id, type: "fields" });

  } catch (e) {
    console.error("[PUT /api/watchlist/:id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ===== DELETE: アイテム削除（管理者のみ） =====
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!adminDb) {
    return NextResponse.json({ error: "Admin SDK未設定" }, { status: 503 });
  }

  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await adminDb.collection("watchlist_items").doc(id).delete();
    console.log("[DELETE /api/watchlist/:id] 削除成功:", { id });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[DELETE /api/watchlist/:id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Timestamp 型を使用するため lint 用に
export type { Timestamp };
