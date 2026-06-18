// scripts/delete-manual-test.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const serviceAccount = require(path.join(__dirname, '../../otoquest-app-firebase-adminsdk-fbsvc-ef7e2f6916.json'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const TARGET_UID = 'xOo2YHyXKVarbhhzc5c9W7GUKvr2';
const TARGET_CARD = 'manual_test';

const ref = db.collection('users').doc(TARGET_UID).collection('cards').doc(TARGET_CARD);

// 削除前確認
const before = await ref.get();
if (!before.exists) {
  console.log('対象ドキュメントは存在しません（既に削除済み）');
  process.exit(0);
}
console.log('削除前:', JSON.stringify(before.data()));

await ref.delete();

// 削除後確認
const after = await ref.get();
console.log(`削除後 exists: ${after.exists}`);
if (!after.exists) {
  console.log('✅ manual_test を正常に削除しました');
}
