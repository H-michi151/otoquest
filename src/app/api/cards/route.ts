/**
 * GET  /api/cards   → カード一覧取得
 * POST /api/cards   → カード追加
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

// ===== GET: カード一覧取得 =====
export async function GET(req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ error: "Admin SDK未設定" }, { status: 503 });
  }

  const uid = await verifyToken(req);
  if (!uid) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  try {
    const snap = await adminDb
      .collection("users")
      .doc(uid)
      .collection("cards")
      .orderBy("createdAt", "asc")
      .get();

    const cards = snap.docs.map((d) => {
      const { createdAt: _c, ...rest } = d.data();
      return rest as { id: string; name: string; limit: number; pointRate: number; color: string };
    });

    return NextResponse.json({ cards });
  } catch (e) {
    console.error("[GET /api/cards]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ===== POST: カード追加 =====
export async function POST(req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ error: "Admin SDK未設定" }, { status: 503 });
  }

  const uid = await verifyToken(req);
  if (!uid) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  try {
    const body = await req.json() as { id: string; name: string; limit: number; pointRate: number; color: string };
    if (!body.id || !body.name) {
      return NextResponse.json({ error: "id と name は必須です" }, { status: 400 });
    }

    await adminDb
      .collection("users")
      .doc(uid)
      .collection("cards")
      .doc(body.id)
      .set({ ...body, createdAt: FieldValue.serverTimestamp() });

    return NextResponse.json({ ok: true, id: body.id });
  } catch (e) {
    console.error("[POST /api/cards]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
