/**
 * POST /api/ingest/ping
 * かすみん（Tanka AI）からのデータ受信テスト用エンドポイント。
 * 認証: Authorization: Bearer <INGEST_TEST_TOKEN>
 * 受け取ったJSONと受信日時を Firestore の ingest_test に保存する。
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function verifyToken(req: NextRequest): boolean {
  const expected = (process.env.INGEST_TEST_TOKEN ?? "").trim();
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const given = Buffer.from(auth.slice(7).trim());
  const exp = Buffer.from(expected);
  return given.length === exp.length && timingSafeEqual(given, exp);
}

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!adminDb) return NextResponse.json({ error: "Admin SDK未設定" }, { status: 503 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await adminDb.collection("ingest_test").add({
    payload: body,
    receivedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, received: body });
}
