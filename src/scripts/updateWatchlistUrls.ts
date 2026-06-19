/**
 * updateWatchlistUrls.ts
 *
 * watchlist_items の各ドキュメントに kakakuUrl フィールドを設定するスクリプト。
 * name フィールドで対象ドキュメントを検索し、対応する URL を書き込む。
 *
 * 実行方法:
 *   npm run update:watchlist-urls
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { credential } from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ===== Admin SDK 初期化 =====
const app = getApps().length === 0
  ? initializeApp({ credential: credential.applicationDefault() })
  : getApps()[0];

const db = getFirestore(app);

// ===== 価格.com URL マッピング =====
const URL_MAP: Record<string, string> = {
  "9060XT 16G":          "https://kakaku.com/pc/videocard/itemlist.aspx?pdf_Spec112=108&pdf_Spec105=16&pdf_so=p1",
  "9060XT 8G":           "https://kakaku.com/pc/videocard/itemlist.aspx?pdf_Spec112=108&pdf_Spec105=8&pdf_so=p1",
  "9070XT 16G":          "https://kakaku.com/pc/videocard/itemlist.aspx?pdf_Spec112=106&pdf_so=p1",
  "RTX 5070 12G":        "https://kakaku.com/pc/videocard/itemlist.aspx?pdf_Spec103=502&pdf_so=p1",
  "RTX 5070Ti 16G":      "https://kakaku.com/pc/videocard/itemlist.aspx?pdf_Spec103=501&pdf_so=p1",
  "A520M":               "https://kakaku.com/pc/motherboard/itemlist.aspx?pdf_Spec116=11&pdf_so=p1",
  "B550M":               "https://kakaku.com/pc/motherboard/itemlist.aspx?pdf_Spec116=10&pdf_so=p1",
  "DDR4 32G（16G×2）":   "https://kakaku.com/pc/pc-memory/itemlist.aspx?pdf_Spec101=6&pdf_Spec301=16&pdf_Spec105=2&pdf_so=p1",
  "DDR5 32G（16G×2）":   "https://kakaku.com/pc/pc-memory/itemlist.aspx?pdf_Spec101=7&pdf_Spec301=16&pdf_Spec105=2&pdf_so=p1",
  "SSD M.2 Gen3 512GB":  "https://kakaku.com/pc/ssd/itemlist.aspx?pdf_Spec102=8&pdf_Spec101=16&pdf_Spec103=512&pdf_so=p1",
  "SSD M.2 Gen4 1TB":    "https://kakaku.com/pc/ssd/itemlist.aspx?pdf_Spec102=8&pdf_Spec101=15&pdf_Spec103=1024&pdf_so=p1",
};

// ===== 実行 =====
async function run(): Promise<void> {
  console.log("🔗 watchlist kakakuUrl 更新開始...\n");

  const snap = await db.collection("watchlist_items").get();
  console.log(`取得件数: ${snap.size} 件\n`);

  let updated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as { name?: string };
    const name = data.name ?? "";
    const url  = URL_MAP[name];

    if (!url) {
      console.log(`  ⏭  マッピングなし: ${name}`);
      skipped++;
      continue;
    }

    await doc.ref.set(
      { kakakuUrl: url, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    console.log(`  ✅ 更新: ${name}`);
    console.log(`     → ${url}`);
    updated++;

    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n完了: ${updated} 件更新, ${skipped} 件スキップ`);
}

run().catch((e) => {
  console.error("❌ 失敗:", e);
  process.exit(1);
});
