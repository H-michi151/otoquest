/**
 * POST /api/repayments  → 返済記録を追加
 * GET  /api/repayments?cardId=xxx&month=YYYY-MM → 指定カード・月の返済一覧
 *
 * 認証: Authorization: Bearer {Firebase IDトークン}
 * Firestore: users/{uid}/cards/{cardId}/repayments/{repaymentId}
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
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

// ===== POST: 返済記録を追加 =====
export async function POST(req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ error: "Admin SDK未設定" }, { status: 503 });
  }

  const uid = await verifyToken(req);
  if (!uid) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  try {
    const body = await req.json() as { cardId: string; amount: number; note?: string };
    if (!body.cardId || typeof body.amount !== "number" || body.amount <= 0) {
      return NextResponse.json({ error: "cardId と amount（正の数）は必須です" }, { status: 400 });
    }

    const ref = adminDb
      .collection("users")
      .doc(uid)
      .collection("cards")
      .doc(body.cardId)
      .collection("repayments")
      .doc();

    const now = FieldValue.serverTimestamp();
    await ref.set({
      amount: body.amount,
      date: now,
      ...(body.note ? { note: body.note } : {}),
    });

    return NextResponse.json({
      id: ref.id,
      cardId: body.cardId,
      amount: body.amount,
      date: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[POST /api/repayments]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ===== GET: 指定カード・月の返済一覧を取得 =====
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
  const month = searchParams.get("month"); // YYYY-MM

  if (!cardId || !month) {
    return NextResponse.json({ error: "cardId と month は必須です" }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  if (!year || !mon) {
    return NextResponse.json({ error: "month の形式は YYYY-MM です" }, { status: 400 });
  }

  const start = Timestamp.fromDate(new Date(year, mon - 1, 1, 0, 0, 0, 0));
  const end   = Timestamp.fromDate(new Date(year, mon,     1, 0, 0, 0, 0));

  try {
    const snap = await adminDb
      .collection("users")
      .doc(uid)
      .collection("cards")
      .doc(cardId)
      .collection("repayments")
      .where("date", ">=", start)
      .where("date", "<",  end)
      .orderBy("date", "asc")
      .get();

    const repayments = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        amount: data.amount as number,
        date: (data.date as Timestamp).toDate().toISOString(),
        note: (data.note as string | undefined) ?? null,
      };
    });

    return NextResponse.json({ repayments });
  } catch (e) {
    console.error("[GET /api/repayments]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
