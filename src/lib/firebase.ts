/**
 * Firebase 初期化
 *
 * .env.local の NEXT_PUBLIC_FIREBASE_* に値を設定することで有効になります。
 * 値が未設定の場合は db = null を返し、Firestore読み取りはスキップされます（クラッシュなし）。
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { initializeFirestore, getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

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
let auth: Auth | null = null;

if (isConfigured) {
  app = getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];
  // experimentalAutoDetectLongPolling: Vercel環境でのWebSocket接続ハングを回避
  // 既存のFirestoreインスタンスがあればそれを使用する
  try {
    db = initializeFirestore(app, { experimentalForceLongPolling: true });
  } catch {
    // 既に初期化済みの場合は getFirestore で取得
    db = getFirestore(app);
  }
  auth = getAuth(app);
}

export const googleProvider = new GoogleAuthProvider();
export { db, auth, isConfigured };

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

// ===== ユーザーカード（Firestore）=====
export type CardDoc = {
  id: string; name: string; limit: number; pointRate: number; color: string;
};




// ===== 購入履歴（Firestore）=====
export type PurchaseDoc = {
  id: string;
  itemName: string;
  /** 実支払い合計（= unitPrice × quantity - couponDiscount - pointsUsed） */
  price: number;
  realPrice: number;
  savedAmount: number;
  cardName: string;
  cardId: string;
  shop: string;
  purchasedAt: string;
  // ----- 拡張フィールド（Step1追加） -----
  category: string;        // 品目（GPU/CPU/MB等）
  quantity: number;        // 個数
  unitPrice: number;       // 単価（クーポン・ポイント控除前）
  couponDiscount: number;  // クーポン値引き額（円）
  pointsUsed: number;      // ポイント使用数
  billingMonth: string;    // 請求月（YYYY-MM、purchasedAtをJST変換して自動生成）
  memo: string;            // フリー入力メモ
  hasReceipt: boolean;     // 領収証あり
  printed: boolean;        // 印刷済み
  arrived: boolean;        // 届き済み
  expenseEntered: boolean; // 経費クラウドサービス入力済み
  billingAmount?: number;  // 請求金額（手動上書き可、未設定時はpriceと同値として扱う）
};

export async function loadUserPurchases(uid: string): Promise<PurchaseDoc[]> {
  if (!db) return [];
  try {
    const { collection, getDocs, orderBy, query } = await import("firebase/firestore");
    const q = query(collection(db, `users/${uid}/purchases`), orderBy("purchasedAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      const purchasedAt = typeof data.purchasedAt?.toDate === "function"
        ? data.purchasedAt.toDate().toISOString()
        : String(data.purchasedAt ?? "");
      return { ...data, purchasedAt } as PurchaseDoc;
    });
  } catch (e) { console.warn("[purchases] read error:", e); return []; }
}

/** addUserPurchase に渡す購入データ型（拡張フィールドは任意） */
export type PurchaseInput =
  Omit<PurchaseDoc, "id" | "purchasedAt" | "category" | "quantity" | "unitPrice" | "couponDiscount" | "pointsUsed" | "billingMonth" | "memo" | "hasReceipt" | "printed" | "arrived" | "expenseEntered">
  & Partial<Pick<PurchaseDoc, "category" | "quantity" | "unitPrice" | "couponDiscount" | "pointsUsed" | "billingMonth" | "memo" | "hasReceipt" | "printed" | "arrived" | "expenseEntered">>;

export async function addUserPurchase(
  uid: string,
  purchase: PurchaseInput
): Promise<void> {
  // クライアントSDK直接書き込みはVercelでハングするため /api/purchases 経由で Admin SDK を使用
  if (!auth) throw new Error("[purchases] auth未初期化");
  const { getIdToken } = await import("firebase/auth");
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("[purchases] 未ログイン");
  const idToken = await getIdToken(currentUser);

  const res = await fetch("/api/purchases", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify(purchase),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`[purchases] API error ${res.status}: ${err.error ?? res.statusText}`);
  }
}

/** 当月（YYYY-MM）のpurchasesをcardId単位で合計して返す */
export async function loadMonthlyPurchasesByCard(
  uid: string,
  cardId: string,
  month: string // YYYY-MM
): Promise<number> {
  // クライアントSDK読み取りはVercelでハングするため /api/purchases 経由で Admin SDK を使用
  if (!auth) return 0;
  try {
    const { getIdToken } = await import("firebase/auth");
    const currentUser = auth.currentUser;
    if (!currentUser) return 0;
    const idToken = await getIdToken(currentUser);

    const params = new URLSearchParams({ cardId, month });
    const res = await fetch(`/api/purchases?${params}`, {
      headers: { "Authorization": `Bearer ${idToken}` },
    });
    if (!res.ok) {
      console.warn("[purchases] GET API error:", res.status, await res.text().catch(() => ""));
      return 0;
    }
    const data = await res.json() as { total: number };
    return data.total ?? 0;
  } catch (e) {
    console.warn("[purchases] monthlyByCard error:", e);
    return 0;
  }
}

// ===== ウォッチリスト（Firestore: users/{uid}/watchlist/{id}）=====
export type WatchlistDoc = {
  id: string;
  productName: string;     // 商品名・検索キーワード
  registeredPrice: number; // 登録時の最安値
  currentPrice: number;    // 現在の最安値（更新時に上書き）
  platform: string;        // 楽天 or Yahoo!ショッピング
  registeredAt: string;    // ISO文字列
  updatedAt: string;       // ISO文字列
};

export async function loadUserWatchlist(uid: string): Promise<WatchlistDoc[]> {
  if (!db) return [];
  try {
    const { collection, getDocs, orderBy, query } = await import("firebase/firestore");
    const q = query(
      collection(db, `users/${uid}/watchlist`),
      orderBy("registeredAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      const toIso = (v: unknown) =>
        v && typeof (v as { toDate?: () => Date }).toDate === "function"
          ? (v as { toDate: () => Date }).toDate().toISOString()
          : String(v ?? "");
      return {
        ...data,
        registeredAt: toIso(data.registeredAt),
        updatedAt: toIso(data.updatedAt),
      } as WatchlistDoc;
    });
  } catch (e) { console.warn("[watchlist] read error:", e); return []; }
}

export async function addUserWatchlistItem(
  uid: string,
  item: Omit<WatchlistDoc, "id" | "registeredAt" | "updatedAt">
): Promise<void> {
  if (!db) return;
  try {
    const { collection, doc, setDoc, Timestamp } = await import("firebase/firestore");
    const id = `watch_${Date.now()}`;
    await setDoc(doc(collection(db, `users/${uid}/watchlist`), id), {
      ...item,
      id,
      registeredAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } catch (e) { console.warn("[watchlist] write error:", e); }
}

export async function removeUserWatchlistItem(uid: string, id: string): Promise<void> {
  if (!db) return;
  try {
    const { collection, doc, deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(collection(db, `users/${uid}/watchlist`), id));
  } catch (e) { console.warn("[watchlist] delete error:", e); }
}

export async function updateWatchlistCurrentPrice(
  uid: string,
  id: string,
  currentPrice: number
): Promise<void> {
  if (!db) return;
  try {
    const { collection, doc, updateDoc, Timestamp } = await import("firebase/firestore");
    await updateDoc(doc(collection(db, `users/${uid}/watchlist`), id), {
      currentPrice,
      updatedAt: Timestamp.now(),
    });
  } catch (e) { console.warn("[watchlist] update error:", e); }
}

