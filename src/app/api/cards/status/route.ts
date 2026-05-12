/**
 * GET /api/cards/status
 * Admin SDKの初期化状態と環境変数の設定状況を確認する診断エンドポイント。
 * 動作確認後は削除すること。
 */
import { NextResponse } from "next/server";
import { isAdminConfigured } from "@/lib/firebaseAdmin";

export async function GET() {
  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  return NextResponse.json({
    isAdminConfigured,
    env: {
      FIREBASE_ADMIN_PROJECT_ID:   projectId   ? "✅ 設定済み" : "❌ 未設定",
      FIREBASE_ADMIN_CLIENT_EMAIL: clientEmail ? "✅ 設定済み" : "❌ 未設定",
      FIREBASE_ADMIN_PRIVATE_KEY:  privateKey  ? `✅ 設定済み (${privateKey.length}文字)` : "❌ 未設定",
      // 改行変換後の確認
      privateKeyStartsWith: privateKey
        ? privateKey.replace(/\\n/g, "\n").slice(0, 40) + "..."
        : null,
    },
  });
}
