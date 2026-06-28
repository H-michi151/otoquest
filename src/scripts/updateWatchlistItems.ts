/**
 * updateWatchlistItems.ts
 *
 * watchlist_items コレクションの各ドキュメントに
 * searchKeyword / excludeKeywords / kakakuUrl フィールドを追加し、
 * RTX 5060 Ti 8GB / 16GB・SSD 2TB Gen4 を新規追加するスクリプト。
 *
 * 実行方法:
 *   npm run update:watchlist-items
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { credential } from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ===== Admin SDK 初期化 =====
const app =
  getApps().length === 0
    ? initializeApp({ credential: credential.applicationDefault() })
    : getApps()[0];

const db = getFirestore(app);

// ===== 更新・追加データ =====
// docId に既存ドキュメントの id フィールドを指定すると merge 更新。
// 存在しない docId は新規追加される。
const updates: {
  docId: string;
  data: Record<string, unknown>;
}[] = [
  // ── GPU ──────────────────────────────────────────
  {
    // 新規追加: RTX 5060 Ti 8GB
    docId: "rtx-5060ti-8gb",
    data: {
      id: "rtx-5060ti-8gb",
      name: "RTX 5060 Ti 8GB",
      category: "GPU",
      kakakuUrl:
        "https://kakaku.com/pc/videocard/itemlist.aspx?pdf_Spec103=503&pdf_kw=8GB&pdf_so=p1",
      searchKeyword: "RTX 5060 Ti 8GB",
      excludeKeywords: ["16GB"],
      currentPrice: 0,
      previousPrice: 0,
      currentShop: "",
      alertPrice: 0,
      priceHistory: [],
      order: 12,
      updatedAt: FieldValue.serverTimestamp(),
    },
  },
  {
    // 新規追加: RTX 5060 Ti 16GB
    docId: "rtx-5060ti-16gb",
    data: {
      id: "rtx-5060ti-16gb",
      name: "RTX 5060 Ti 16GB",
      category: "GPU",
      kakakuUrl:
        "https://kakaku.com/pc/videocard/itemlist.aspx?pdf_Spec103=503&pdf_kw=16GB&pdf_so=p1",
      searchKeyword: "RTX 5060 Ti 16GB",
      excludeKeywords: ["8GB"],
      currentPrice: 0,
      previousPrice: 0,
      currentShop: "",
      alertPrice: 0,
      priceHistory: [],
      order: 13,
      updatedAt: FieldValue.serverTimestamp(),
    },
  },
  {
    // 更新: RX 9060 XT 8GB (docId は seedWatchlist で生成されたIDを name で検索して解決)
    // ここでは name フィールドが "9060XT 8G" のドキュメントを対象とするため
    // run() 内で動的に docId を解決する。
    docId: "__resolve:9060XT 8G",
    data: {
      searchKeyword: "RX 9060 XT 8GB",
      excludeKeywords: ["16GB", "White", "ホワイト"],
    },
  },
  {
    // 更新: RX 9060 XT 16GB
    docId: "__resolve:9060XT 16G",
    data: {
      searchKeyword: "RX 9060 XT 16GB",
      excludeKeywords: ["8GB", "White", "ホワイト"],
    },
  },
  // ── SSD ──────────────────────────────────────────
  {
    // 更新: SSD M.2 Gen3 512GB
    docId: "__resolve:SSD M.2 Gen3 512GB",
    data: {
      kakakuUrl:
        "https://kakaku.com/pc/ssd/itemlist.aspx?pdf_Spec102=8&pdf_Spec301=512&pdf_Spec101=16&pdf_Spec001=1&pdf_Spec104=1&pdf_so=p1",
      searchKeyword: "SSD NVMe Gen3 M.2 2280 512GB",
      excludeKeywords: ["SATA", "2230", "2242", "ポータブル"],
    },
  },
  {
    // 更新: SSD M.2 Gen4 1TB
    docId: "__resolve:SSD M.2 Gen4 1TB",
    data: {
      kakakuUrl:
        "https://kakaku.com/pc/ssd/itemlist.aspx?pdf_Spec102=8&pdf_Spec301=1000&pdf_Spec101=15&pdf_Spec001=1&pdf_Spec104=1&pdf_so=p1",
      searchKeyword: "SSD NVMe Gen4 M.2 2280 1TB",
      excludeKeywords: ["SATA", "2230", "2242", "ポータブル"],
    },
  },
  {
    // 新規追加: SSD 2TB Gen4
    docId: "ssd-2tb-gen4",
    data: {
      id: "ssd-2tb-gen4",
      name: "SSD M.2 Gen4 2TB",
      category: "Disk",
      kakakuUrl:
        "https://kakaku.com/pc/ssd/itemlist.aspx?pdf_Spec102=8&pdf_Spec301=2000&pdf_Spec101=15&pdf_Spec001=1&pdf_Spec104=1&pdf_so=p1",
      searchKeyword: "SSD NVMe Gen4 M.2 2280 2TB",
      excludeKeywords: ["SATA", "2230", "2242", "ポータブル"],
      currentPrice: 0,
      previousPrice: 0,
      currentShop: "",
      alertPrice: 0,
      priceHistory: [],
      order: 14,
      updatedAt: FieldValue.serverTimestamp(),
    },
  },
  // ── メモリ ────────────────────────────────────────
  {
    // 更新: DDR5 32G（16G×2）
    docId: "__resolve:DDR5 32G（16G×2）",
    data: {
      searchKeyword: "DDR5 16GB 2枚組 デスクトップ",
      excludeKeywords: ["SODIMM", "SO-DIMM", "ノート"],
    },
  },
];

async function run(): Promise<void> {
  console.log("🔧 watchlist_items 更新開始...\n");

  const colRef = db.collection("watchlist_items");

  // name → docId のマップを構築（__resolve: プレフィックスの解決用）
  const snap = await colRef.get();
  const nameToDocId = new Map<string, string>();
  for (const doc of snap.docs) {
    const name = (doc.data() as { name?: string }).name ?? "";
    if (name) nameToDocId.set(name, doc.id);
  }
  console.log(`既存件数: ${snap.size} 件\n`);

  let updated = 0;
  let added = 0;
  let skipped = 0;

  for (const entry of updates) {
    let docId = entry.docId;

    // __resolve: プレフィックスの場合は name フィールドで既存 docId を検索
    if (docId.startsWith("__resolve:")) {
      const targetName = docId.slice("__resolve:".length);
      const resolvedId = nameToDocId.get(targetName);
      if (!resolvedId) {
        console.log(`  ⏭  スキップ (ドキュメント未発見): ${targetName}`);
        skipped++;
        continue;
      }
      docId = resolvedId;
    }

    const isNew = !snap.docs.some((d) => d.id === docId);

    await colRef.doc(docId).set(entry.data, { merge: true });

    if (isNew) {
      console.log(`  ✅ 新規追加: ${docId}`);
      added++;
    } else {
      console.log(`  🔄 更新: ${docId}`);
      updated++;
    }

    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n完了: ${added} 件追加, ${updated} 件更新, ${skipped} 件スキップ`);
}

run().catch((e) => {
  console.error("❌ 失敗:", e);
  process.exit(1);
});
