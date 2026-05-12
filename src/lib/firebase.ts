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
    db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
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

export async function loadUserCards(uid: string): Promise<CardDoc[]> {
  if (!db) return [];

  const fetchOnce = (): Promise<CardDoc[] | null> => {
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn("[cards] loadUserCards: 1試行タイムアウト (4s)");
        resolve(null); // null = タイムアウト扱い
      }, 4000)
    );
    const fetch = (async (): Promise<CardDoc[] | null> => {
      try {
        const { collection, getDocs, orderBy, query } = await import("firebase/firestore");
        const q = query(collection(db!, `users/${uid}/cards`), orderBy("createdAt", "asc"));
        const snap = await getDocs(q);
        return snap.docs.map((d) => {
          const { createdAt: _c, ...rest } = d.data();
          return rest as CardDoc;
        });
      } catch (e) {
        console.warn("[cards] loadUserCards fetch error:", e);
        return null; // null = エラー扱い（リトライ対象）
      }
    })();
    return Promise.race([fetch, timeout]);
  };

  // 最大3回リトライ（1秒間隔）
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await fetchOnce();
    if (result !== null) {
      return result;
    }
    if (attempt < 3) {
      console.warn(`[cards] loadUserCards: ${attempt}回目失敗 → 1秒後にリトライ`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  console.warn("[cards] loadUserCards: 3回試みても取得できず空配列を返す");
  return [];
}


/** 書き込み共通タイムアウト（8秒）*/
function withWriteTimeout<T>(promise: Promise<T>): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Firestore書き込みタイムアウト（8s）")), 8000)
  );
  return Promise.race([promise, timeout]);
}

/** カード1件を追加する */
export async function addUserCard(uid: string, card: CardDoc): Promise<void> {
  if (!db) { console.warn("[cards] db is null"); return; }
  try {
    const { collection, doc, setDoc, Timestamp } = await import("firebase/firestore");
    await withWriteTimeout(
      setDoc(
        doc(collection(db, `users/${uid}/cards`), card.id),
        { ...card, createdAt: Timestamp.now() }
      )
    );
  } catch (e) {
    console.error("[addUserCard] 失敗:", e);
    throw e;
  }
}

/** カード1件を更新する */
export async function updateUserCard(uid: string, card: CardDoc): Promise<void> {
  if (!db) { console.warn("[cards] db is null"); return; }
  try {
    const { collection, doc, setDoc, Timestamp } = await import("firebase/firestore");
    await withWriteTimeout(
      setDoc(
        doc(collection(db, `users/${uid}/cards`), card.id),
        { ...card, createdAt: Timestamp.now() },
        { merge: true }
      )
    );
  } catch (e) {
    console.error("[updateUserCard] 失敗:", e);
    throw e;
  }
}

/** カード1件を削除する */
export async function deleteUserCard(uid: string, cardId: string): Promise<void> {
  if (!db) { console.warn("[cards] db is null"); return; }
  try {
    const { collection, doc, deleteDoc } = await import("firebase/firestore");
    await withWriteTimeout(
      deleteDoc(doc(collection(db, `users/${uid}/cards`), cardId))
    );
  } catch (e) {
    console.error("[deleteUserCard] 失敗:", e);
    throw e;
  }
}

// ===== 購入履歴（Firestore）=====
export type PurchaseDoc = {
  id: string; itemName: string; price: number; realPrice: number;
  savedAmount: number; cardName: string; shop: string; purchasedAt: string;
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

export async function addUserPurchase(
  uid: string,
  purchase: Omit<PurchaseDoc, "id" | "purchasedAt">
): Promise<void> {
  if (!db) return;
  try {
    const { collection, doc, setDoc, Timestamp } = await import("firebase/firestore");
    const id = `purchase_${Date.now()}`;
    await setDoc(doc(collection(db, `users/${uid}/purchases`), id), {
      ...purchase, id, purchasedAt: Timestamp.now(),
    });
  } catch (e) { console.warn("[purchases] write error:", e); }
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

