/**
 * updateRx9060xtUrls.ts
 *
 * watchlist_items コレクションの RX 9060 XT 8G / 16G ドキュメントに
 * kakakuUrl フィールドを追加するスクリプト。
 *
 * 実行方法:
 *   npm run update:rx9060xt-urls
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { credential } from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// ===== Admin SDK 初期化 =====
const app =
  getApps().length === 0
    ? initializeApp({ credential: credential.applicationDefault() })
    : getApps()[0];

const db = getFirestore(app);

// name フィールド → 更新データのマッピング
const UPDATES: Record<string, { kakakuUrl: string }> = {
  "9060XT 8G": {
    kakakuUrl:
      "https://kakaku.com/pc/videocard/itemlist.aspx?pdf_Spec112=108&pdf_kw=8GB&pdf_so=p1",
  },
  "9060XT 16G": {
    kakakuUrl:
      "https://kakaku.com/pc/videocard/itemlist.aspx?pdf_Spec112=108&pdf_kw=16GB&pdf_so=p1",
  },
};

async function run(): Promise<void> {
  console.log("🔗 RX 9060 XT kakakuUrl 更新開始...\n");

  const snap = await db.collection("watchlist_items").get();
  let updated = 0;

  for (const doc of snap.docs) {
    const name = (doc.data() as { name?: string }).name ?? "";
    const patch = UPDATES[name];
    if (!patch) continue;

    await doc.ref.set(patch, { merge: true });
    console.log(`  ✅ 更新: ${name}`);
    console.log(`     → ${patch.kakakuUrl}`);
    updated++;
  }

  if (updated === 0) {
    console.log("  ⚠️  対象ドキュメントが見つかりませんでした。");
  }
  console.log(`\n完了: ${updated} 件更新`);
}

run().catch((e) => {
  console.error("❌ 失敗:", e);
  process.exit(1);
});
