"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { addUserCard, loadUserCards, deleteUserCard } from "@/lib/firebase";

const TEST_CARD_ID = "test_card_debug_001";

export default function TestFirestorePage() {
  const { user } = useAuth();
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const append = (msg: string) => setLog((prev) => [...prev, `${new Date().toISOString().slice(11, 23)} ${msg}`]);

  const runTest = async () => {
    if (!user) { append("❌ 未ログイン — ログインしてから実行してください"); return; }
    setRunning(true);
    setLog([]);
    append(`✅ UID: ${user.uid}`);

    // Step 1: addUserCard
    try {
      append("▶ addUserCard() 呼び出し中...");
      await addUserCard(user.uid, {
        id: TEST_CARD_ID,
        name: "【テスト用カード】削除してOK",
        limit: 10000,
        pointRate: 1.0,
        color: "#888888",
      });
      append("✅ addUserCard() 完了");
    } catch (e) {
      append(`❌ addUserCard() 失敗: ${e instanceof Error ? e.message : String(e)}`);
      setRunning(false);
      return;
    }

    // Step 2: loadUserCards で確認
    try {
      append("▶ loadUserCards() で確認中...");
      const cards = await loadUserCards(user.uid);
      const found = cards.find((c) => c.id === TEST_CARD_ID);
      if (found) {
        append(`✅ Firestoreに書き込み確認済: ${JSON.stringify(found)}`);
      } else {
        append("⚠️ addUserCard は成功したが loadUserCards で見つからない（遅延の可能性）");
      }
    } catch (e) {
      append(`❌ loadUserCards() 失敗: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Step 3: テストデータ削除
    try {
      append("▶ テストデータ削除中...");
      await deleteUserCard(user.uid, TEST_CARD_ID);
      append("✅ テストデータ削除完了");
    } catch (e) {
      append(`❌ deleteUserCard() 失敗: ${e instanceof Error ? e.message : String(e)}`);
    }

    append("🏁 テスト完了");
    setRunning(false);
  };

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 16px", fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        🔧 Firestore 書き込みテスト（一時ページ）
      </h1>
      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
        UID: {user?.uid ?? "（未ログイン）"}
      </p>
      <button
        onClick={runTest}
        disabled={running || !user}
        style={{
          padding: "10px 24px", borderRadius: 8, border: "none",
          background: running ? "#94a3b8" : "#1e40af",
          color: "white", fontWeight: 700, fontSize: 14,
          cursor: running ? "not-allowed" : "pointer", marginBottom: 20,
        }}
      >
        {running ? "テスト実行中..." : "テスト開始"}
      </button>
      <div style={{
        background: "#0f172a", color: "#e2e8f0", padding: 16,
        borderRadius: 10, fontSize: 12, lineHeight: 1.8,
        minHeight: 200, whiteSpace: "pre-wrap",
      }}>
        {log.length === 0 ? "（ログなし）" : log.join("\n")}
      </div>
    </div>
  );
}
