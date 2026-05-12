/**
 * Firebase Admin SDK 初期化（サーバーサイド専用）
 *
 * 使用場所: src/app/api/ 以下の APIルートのみ
 * クライアントコンポーネント（"use client"）からは絶対にimportしないこと。
 *
 * 必要な環境変数（Vercel: Settings → Environment Variables）:
 *   FIREBASE_ADMIN_PROJECT_ID   - Firebaseプロジェクト ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL - サービスアカウントのメールアドレス
 *   FIREBASE_ADMIN_PRIVATE_KEY  - サービスアカウントの秘密鍵（改行は \n）
 *
 * 取得方法:
 *   Firebase Console → プロジェクトの設定 → サービスアカウント
 *   → 「新しい秘密鍵を生成」→ JSONをダウンロード
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let adminApp: App | null = null;
let adminDb: Firestore | null = null;

const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

const isAdminConfigured = !!projectId && !!clientEmail && !!privateKey;

if (isAdminConfigured) {
  // 重複初期化を防ぐ（Next.jsのホットリロード対策）
  if (getApps().length === 0) {
    adminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    adminApp = getApps()[0];
  }
  adminDb = getFirestore(adminApp);
} else {
  console.warn(
    "[firebaseAdmin] 環境変数が未設定のためAdmin SDKを初期化しません。\n" +
    "  必要な変数: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY"
  );
}

export { adminDb, isAdminConfigured };
