/**
 * GET  /api/categories → 品目カテゴリー一覧取得
 * POST /api/categories → 品目カテゴリー追加
 *
 * 認証: Authorization: Bearer {Firebase IDトークン}
 * Firestore: users/{uid}/itemCategories
 *
 * GET: ドキュメントが空の場合はデフォルト値を返す（Firestore書き込み不要）
 * POST body: { name: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

// ===== デフォルトカテゴリー =====
const DEFAULT_CATEGORIES = [
  "GPU", "CPU", "MB", "RAM", "Disk", "Case",
  "ATX", "CaseFan", "CPUCooler", "AIO",
  "AddParts", "Software", "SF", "その他",
];

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

// ===== GET: カテゴリー一覧取得 =====
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
      .collection("itemCategories")
      .orderBy("order", "asc")
      .get();

    // ドキュメントが空の場合はデフォルト値を返す
    if (snap.empty) {
      return NextResponse.json({ categories: DEFAULT_CATEGORIES });
    }

    const categories = snap.docs.map((d) => (d.data() as { name: string }).name);
    return NextResponse.json({ categories });
  } catch (e) {
    console.error("[GET /api/categories]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ===== POST: カテゴリー追加 =====
export async function POST(req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ error: "Admin SDK未設定" }, { status: 503 });
  }

  const uid = await verifyToken(req);
  if (!uid) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  try {
    const body = await req.json() as { name?: string };

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "name は必須です" }, { status: 400 });
    }

    const name = body.name.trim();

    // 現在の件数を取得して order を決定
    const colRef = adminDb
      .collection("users")
      .doc(uid)
      .collection("itemCategories");

    const countSnap = await colRef.get();
    const order = countSnap.size + 1;

    // name をドキュメントIDとして使用（重複防止）
    await colRef.doc(name).set({
      name,
      order,
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log("[POST /api/categories] 追加成功:", { uid, name, order });
    return NextResponse.json({ success: true, category: { name, order } });
  } catch (e) {
    console.error("[POST /api/categories]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
