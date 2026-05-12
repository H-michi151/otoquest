/**
 * PUT    /api/cards/[id] → カード更新
 * DELETE /api/cards/[id] → カード削除
 *
 * 認証: Authorization: Bearer {Firebase IDトークン}
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

// ===== PUT: カード更新 =====
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
    const body = await req.json() as { name?: string; limit?: number; pointRate?: number; color?: string };

    await adminDb
      .collection("users")
      .doc(uid)
      .collection("cards")
      .doc(id)
      .set(
        { ...body, id, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[PUT /api/cards/:id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ===== DELETE: カード削除 =====
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
      .collection("cards")
      .doc(id)
      .delete();

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[DELETE /api/cards/:id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
