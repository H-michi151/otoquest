/**
 * seedWatchlist.ts
 *
 * watchlist_items コレクションに初期データ 11 件を投入するスクリプト。
 * 既にドキュメントが存在する場合（name フィールドで重複チェック）はスキップ。
 *
 * 実行方法:
 *   npm run seed:watchlist
 *   （GOOGLE_APPLICATION_CREDENTIALS はコマンドに埋め込み済み）
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { credential } from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ===== Admin SDK 初期化 =====
const app = getApps().length === 0
  ? initializeApp({ credential: credential.applicationDefault() })
  : getApps()[0];

const db = getFirestore(app);

// ===== 初期データ =====
const INITIAL_ITEMS = [
  { order: 1,  category: "GPU",  name: "9060XT 16G",         keyword: "RX 9060 XT 16GB" },
  { order: 2,  category: "GPU",  name: "9060XT 8G",          keyword: "RX 9060 XT 8GB" },
  { order: 3,  category: "GPU",  name: "9070XT 16G",         keyword: "RX 9070 XT 16GB" },
  { order: 4,  category: "GPU",  name: "RTX 5070 12G",       keyword: "RTX 5070 12GB" },
  { order: 5,  category: "GPU",  name: "RTX 5070Ti 16G",     keyword: "RTX 5070 Ti 16GB" },
  { order: 6,  category: "MB",   name: "A520M",              keyword: "A520M マザーボード" },
  { order: 7,  category: "MB",   name: "B550M",              keyword: "B550M マザーボード" },
  { order: 8,  category: "RAM",  name: "DDR4 32G（16G×2）",  keyword: "DDR4 32GB 16GB 2枚組" },
  { order: 9,  category: "RAM",  name: "DDR5 32G（16G×2）",  keyword: "DDR5 32GB 16GB 2枚組" },
  { order: 10, category: "Disk", name: "SSD M.2 Gen3 512GB", keyword: "SSD M.2 NVMe Gen3 512GB" },
  { order: 11, category: "Disk", name: "SSD M.2 Gen4 1TB",   keyword: "SSD M.2 NVMe Gen4 1TB" },
] as const;

// ===== シーディング実行 =====
async function seed(): Promise<void> {
  console.log("🌱 watchlist_items シーディング開始...\n");

  const colRef = db.collection("watchlist_items");

  // 既存ドキュメントの name 一覧を取得（重複チェック用）
  const existingSnap = await colRef.get();
  const existingNames = new Set(
    existingSnap.docs.map((d) => (d.data() as { name?: string }).name ?? "")
  );

  console.log(`既存件数: ${existingSnap.size} 件`);
  if (existingNames.size > 0) {
    console.log("既存アイテム:", [...existingNames].join(", "));
  }
  console.log();

  let added = 0;
  let skipped = 0;

  for (const item of INITIAL_ITEMS) {
    if (existingNames.has(item.name)) {
      console.log(`  ⏭  スキップ (既存): [${item.category}] ${item.name}`);
      skipped++;
      continue;
    }

    const id = `watchlist_${Date.now()}_${item.order}`;
    await colRef.doc(id).set({
      id,
      category:      item.category,
      name:          item.name,
      keyword:       item.keyword,
      currentPrice:  0,
      previousPrice: 0,
      currentShop:   "",
      alertPrice:    0,
      priceHistory:  [],
      order:         item.order,
      updatedAt:     FieldValue.serverTimestamp(),
    });

    console.log(`  ✅ 追加: [${item.category}] ${item.name}`);
    added++;

    // Firestore への連続書き込みをわずかに間隔を空ける
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\n完了: ${added} 件追加, ${skipped} 件スキップ`);
}

seed().catch((e) => {
  console.error("❌ シーディング失敗:", e);
  process.exit(1);
});
