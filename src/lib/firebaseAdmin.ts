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

let adminDb: Firestore | null = null;

try {
  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ? process.env.FIREBASE_ADMIN_PRIVATE_KEY
        .replace(/\\n/g, "\n")
        .replace(/^"|"$/g, "")
    : undefined;

  if (projectId && clientEmail && privateKey) {
    let app: App;
    if (getApps().length === 0) {
      app = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    } else {
      app = getApps()[0];
    }
    adminDb = getFirestore(app);
  } else {
    const missing = [
      !projectId   && "FIREBASE_ADMIN_PROJECT_ID",
      !clientEmail && "FIREBASE_ADMIN_CLIENT_EMAIL",
      !privateKey  && "FIREBASE_ADMIN_PRIVATE_KEY",
    ].filter(Boolean);
    console.warn(
      `[firebaseAdmin] 以下の環境変数が未設定のためAdmin SDKを初期化しません: ${missing.join(", ")}`
    );
  }
} catch (e) {
  console.error("[firebaseAdmin] Firebase Admin SDK initialization failed:", e);
  adminDb = null;
}

// isAdminConfigured は後方互換のため残す
const isAdminConfigured = adminDb !== null;

export { adminDb, isAdminConfigured };
