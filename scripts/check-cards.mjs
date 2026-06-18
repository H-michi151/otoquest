// scripts/check-cards.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ルート直下のサービスアカウントJSONを使用
const serviceAccount = require(path.join(__dirname, '../../otoquest-app-firebase-adminsdk-fbsvc-ef7e2f6916.json'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const users = await db.collection('users').listDocuments();
console.log(`ユーザー数: ${users.length}`);

for (const userRef of users) {
  const cards = await db.collection(`users/${userRef.id}/cards`).get();
  console.log(`\nuser: ${userRef.id} (カード数: ${cards.size})`);
  cards.forEach(card => {
    console.log(`  card: ${card.id}`);
    console.log('  fields:', JSON.stringify(card.data(), null, 4));
  });
}
