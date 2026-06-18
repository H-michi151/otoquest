/**
 * GET  /api/watchlist → ウォッチリスト全件取得（認証不要）
 * POST /api/watchlist → アイテム追加（管理者のみ）
 *
 * 管理者判定: IDトークンのuidがNEXT_PUBLIC_ADMIN_UIDと一致するか確認
 * Firestore: watchlist_items（全ユーザー共通・公開コレクション）
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID ?? "";

// JST オフセット（+9時間をミリ秒で）
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Date を JST の "YYYY-MM-DD" 文字列に変換 */
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

// ===== GET: ウォッチリスト全件取得（認証不要） =====
export async function GET() {
  if (!adminDb) {
    return NextResponse.json({ error: "Admin SDK未設定" }, { status: 503 });
  }

  try {
    const snap = await adminDb
      .collection("watchlist_items")
      .orderBy("order", "asc")
      .get();

    const items = snap.docs.map((d) => {
      const data = d.data();
      // updatedAt を ISO 文字列に変換
      const updatedAt = data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate().toISOString()
        : data.updatedAt ?? null;
      return { ...data, id: d.id, updatedAt };
    });

    return NextResponse.json({ items });
  } catch (e) {
    console.error("[GET /api/watchlist]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ===== POST: アイテム追加（管理者のみ） =====
export async function POST(req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ error: "Admin SDK未設定" }, { status: 503 });
  }

  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      category?: string;
      name?: string;
      keyword?: string;
      alertPrice?: number;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name は必須です" }, { status: 400 });
    }

    // 現在の件数を取得して order を決定
    const colRef = adminDb.collection("watchlist_items");
    const countSnap = await colRef.get();
    const order = countSnap.size + 1;

    const id = `watchlist_${Date.now()}`;

    await colRef.doc(id).set({
      id,
      category:      body.category   ?? "",
      name:          body.name.trim(),
      keyword:       body.keyword    ?? body.name.trim(),
      currentPrice:  0,
      previousPrice: 0,
      currentShop:   "",
      alertPrice:    body.alertPrice ?? 0,
      priceHistory:  [],
      order,
      updatedAt:     FieldValue.serverTimestamp(),
    });

    console.log("[POST /api/watchlist] 追加成功:", { id, name: body.name });
    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error("[POST /api/watchlist]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// toJstDateStr を [id]/route.ts でも使えるようエクスポート
export { toJstDateStr };
