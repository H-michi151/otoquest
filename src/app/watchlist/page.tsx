"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  loadUserWatchlist,
  removeUserWatchlistItem,
  updateWatchlistCurrentPrice,
  type WatchlistDoc,
} from "@/lib/firebase";

export default function WatchlistPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<WatchlistDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // ======================================================
  // Firestoreからウォッチリスト読み込み
  // ======================================================
  const loadList = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const docs = await loadUserWatchlist(user.uid);
    setItems(docs);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadList(); }, [loadList]);

  // ======================================================
  // 一括更新: 各商品を楽天・Yahoo APIで再検索して currentPrice を更新
  // ======================================================
  const handleRefreshAll = async () => {
    if (!user || items.length === 0) return;
    setRefreshing(true);
    let updatedCount = 0;

    await Promise.all(
      items.map(async (item) => {
        try {
          const [rakutenRes, yahooRes] = await Promise.all([
            fetch(`/api/rakuten/search?${new URLSearchParams({ keyword: item.productName, hits: "5" })}`),
            fetch(`/api/yahoo/search?${new URLSearchParams({ keyword: item.productName, hits: "5" })}`),
          ]);
          const [rakutenData, yahooData] = await Promise.all([
            rakutenRes.json(),
            yahooRes.json(),
          ]);

          const prices: number[] = [];
          if (!rakutenData.error) {
            (rakutenData.results ?? []).forEach((r: { price: number }) => {
              if (r.price > 0) prices.push(r.price);
            });
          }
          if (!yahooData.error) {
            (yahooData.results ?? []).forEach((r: { price: number }) => {
              if (r.price > 0) prices.push(r.price);
            });
          }

          if (prices.length > 0) {
            const newMin = Math.min(...prices);
            await updateWatchlistCurrentPrice(user.uid, item.id, newMin);
            updatedCount++;
          }
        } catch {
          // 個別エラーは無視して続行
        }
      })
    );

    await loadList();
    setRefreshing(false);
    showToast(`🔄 ${updatedCount}件の価格を更新しました`);
  };

  // ======================================================
  // 削除
  // ======================================================
  const handleDelete = async (id: string, name: string) => {
    if (!user) return;
    setDeletingId(id);
    await removeUserWatchlistItem(user.uid, id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDeletingId(null);
    showToast(`🗑 「${name}」を削除しました`);
  };

  // ======================================================
  // 差額計算ヘルパー
  // ======================================================
  const getDiff = (item: WatchlistDoc) => item.currentPrice - item.registeredPrice;
  const getDiffPct = (item: WatchlistDoc) =>
    item.registeredPrice > 0
      ? ((getDiff(item) / item.registeredPrice) * 100).toFixed(1)
      : "0.0";

  // ======================================================
  // サマリー集計
  // ======================================================
  const totalSaved = items.reduce((sum, i) => {
    const d = getDiff(i);
    return sum + (d < 0 ? Math.abs(d) : 0);
  }, 0);
  const cheaper = items.filter((i) => getDiff(i) < 0).length;
  const more_expensive = items.filter((i) => getDiff(i) > 0).length;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* ===== ヘッダー ===== */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1e40af", marginBottom: 2 }}>
            👁 ウォッチリスト
          </h1>
          <p style={{ fontSize: 12, color: "#64748b" }}>
            登録商品の最安値を定期チェック。価格変動を一目で把握。
          </p>
        </div>
        <button
          onClick={handleRefreshAll}
          disabled={refreshing || items.length === 0}
          style={{
            marginLeft: "auto",
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: refreshing ? "#e2e8f0" : "#1e40af",
            color: refreshing ? "#94a3b8" : "white",
            fontWeight: 700,
            fontSize: 13,
            cursor: refreshing || items.length === 0 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "inherit",
            transition: "background 0.2s",
          }}
        >
          {refreshing ? "🔄 更新中..." : "🔄 一括更新"}
        </button>
      </div>

      {/* ===== サマリーカード ===== */}
      {items.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "登録商品数", value: `${items.length}件`, color: "#1e40af", bg: "#eff6ff" },
            { label: "値下がり", value: `${cheaper}件`, color: "#059669", bg: "#f0fdf4" },
            { label: "値上がり", value: `${more_expensive}件`, color: "#dc2626", bg: "#fff1f2" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: "14px 18px",
                borderRadius: 10,
                background: s.bg,
                border: `1px solid ${s.color}22`,
              }}
            >
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ===== 節約額バナー ===== */}
      {totalSaved > 0 && (
        <div style={{
          padding: "10px 16px",
          background: "#f0fdf4",
          border: "1px solid #86efac",
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          color: "#065f46",
          fontWeight: 600,
        }}>
          💡 登録時より値下がりした商品で合計 <strong>¥{totalSaved.toLocaleString()}</strong> 節約できるチャンスがあります
        </div>
      )}

      {/* ===== ローディング ===== */}
      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
          <div>読み込み中...</div>
        </div>
      )}

      {/* ===== 空状態 ===== */}
      {!loading && items.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: "48px 24px",
          background: "white",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          color: "#94a3b8",
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👁</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#374151" }}>
            ウォッチリストは空です
          </div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>
            商品検索画面の ⭐ ボタンから商品を追加してください
          </div>
          <button
            onClick={() => router.push("/search")}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "none",
              background: "#1e40af",
              color: "white",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            🔍 商品を検索する
          </button>
        </div>
      )}

      {/* ===== テーブル ===== */}
      {!loading && items.length > 0 && (
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  {["商品名", "プラットフォーム", "登録時最安値", "現在最安値", "差額", "登録日", "操作"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 14px",
                        textAlign: "left",
                        fontWeight: 700,
                        color: "#374151",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const diff = getDiff(item);
                  const pct = getDiffPct(item);
                  const isDown = diff < 0;
                  const isUp = diff > 0;
                  const isSame = diff === 0;

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: i % 2 === 0 ? "white" : "#fafafa",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#eff6ff"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "white" : "#fafafa"; }}
                    >
                      {/* 商品名 */}
                      <td style={{ padding: "12px 14px", maxWidth: 280 }}>
                        <button
                          onClick={() => router.push(`/search?q=${encodeURIComponent(item.productName)}`)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#1e40af",
                            fontWeight: 600,
                            fontSize: 13,
                            textAlign: "left",
                            fontFamily: "inherit",
                            padding: 0,
                            lineHeight: 1.4,
                          }}
                          title="クリックして検索"
                        >
                          {item.productName.length > 40
                            ? item.productName.slice(0, 40) + "..."
                            : item.productName}
                        </button>
                      </td>

                      {/* プラットフォーム */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <span style={{
                          padding: "3px 8px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 700,
                          background: item.platform === "楽天市場" ? "#fff5f5" : "#f0f4ff",
                          color: item.platform === "楽天市場" ? "#cc0000" : "#1a237e",
                        }}>
                          {item.platform === "楽天市場" ? "🦅 楽天" : "🛍️ Yahoo!"}
                        </span>
                      </td>

                      {/* 登録時最安値 */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>
                          ¥{item.registeredPrice.toLocaleString()}
                        </span>
                      </td>

                      {/* 現在最安値 */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <span style={{
                          fontSize: 14,
                          fontWeight: 900,
                          color: isDown ? "#059669" : isUp ? "#dc2626" : "#374151",
                        }}>
                          ¥{item.currentPrice.toLocaleString()}
                        </span>
                      </td>

                      {/* 差額 */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        {isSame ? (
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>変動なし</span>
                        ) : (
                          <div>
                            <span style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: isDown ? "#059669" : "#dc2626",
                            }}>
                              {isDown ? "▼" : "▲"} ¥{Math.abs(diff).toLocaleString()}
                            </span>
                            <div style={{
                              fontSize: 10,
                              color: isDown ? "#059669" : "#dc2626",
                              marginTop: 2,
                            }}>
                              {isDown ? "" : "+"}{pct}%
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 登録日 */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap", color: "#94a3b8", fontSize: 11 }}>
                        {item.registeredAt
                          ? new Date(item.registeredAt).toLocaleDateString("ja-JP")
                          : "—"}
                      </td>

                      {/* 操作 */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => router.push(`/search?q=${encodeURIComponent(item.productName)}`)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 5,
                              border: "1px solid #e2e8f0",
                              background: "white",
                              color: "#1e40af",
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            🔍 検索
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.productName)}
                            disabled={deletingId === item.id}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 5,
                              border: "1px solid #fca5a5",
                              background: "#fff1f2",
                              color: "#dc2626",
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: deletingId === item.id ? "not-allowed" : "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            {deletingId === item.id ? "..." : "🗑 削除"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* テーブルフッター */}
          <div style={{
            padding: "10px 16px",
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            fontSize: 11,
            color: "#94a3b8",
          }}>
            💡 商品名をクリックすると /search で再検索。🔄 一括更新で楽天・Yahooリアルデータを取得します。
          </div>
        </div>
      )}

      {/* ===== トースト通知 ===== */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "12px 24px",
          background: "#1e293b",
          color: "white",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          zIndex: 9999,
          pointerEvents: "none",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
