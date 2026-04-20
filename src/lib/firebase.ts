/**
 * Firebase 初期化
 *
 * .env.local の NEXT_PUBLIC_FIREBASE_* に値を設定することで有効になります。
 * 値が未設定の場合は db = null を返し、Firestore読み取りはスキップされます（クラッシュなし）。
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// projectId と apiKey が設定されている場合のみ初期化
const isConfigured =
  !!firebaseConfig.projectId && !!firebaseConfig.apiKey;

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

if (isConfigured) {
  app = getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];
  db = getFirestore(app);
}

export { db, isConfigured };

// ===== kakaku_prices ドキュメント型 =====
export interface KakakuPrice {
  productName:   string;
  minPrice:      number;
  shopName:      string;
  kakakuUrl:     string;
  fetchedAt:     string;
  notes:         string;
  searchKeyword: string;
  category:      string;
}

/**
 * 商品名の部分一致でkakaku_pricesコレクションを検索。
 * Firebaseが未設定の場合は null を返す。
 */
export async function getKakakuPrice(productName: string): Promise<KakakuPrice | null> {
  if (!db) return null;
  try {
    const { collection, getDocs } = await import("firebase/firestore");
    const snapshot = await getDocs(collection(db, "kakaku_prices"));
    const match = snapshot.docs.find((doc) => {
      const data = doc.data() as KakakuPrice;
      return (
        productName.includes(data.productName) ||
        data.productName.includes(productName) ||
        (data.searchKeyword && productName.toLowerCase().includes(data.searchKeyword.toLowerCase()))
      );
    });
    return match ? (match.data() as KakakuPrice) : null;
  } catch (e) {
    console.warn("[kakaku_prices] Firestore read error:", e);
    return null;
  }
}

/**
 * fetchedAt 日付文字列が7日以上前かどうかを判定
 */
export function isStalePrice(fetchedAt: string): boolean {
  try {
    const fetched = new Date(fetchedAt);
    const diff = Date.now() - fetched.getTime();
    return diff > 7 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
