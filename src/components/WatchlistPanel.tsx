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

export default function WatchlistPanel() {
  const { user } = useAuth();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<WatchlistDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ===================================================
  // データ取得
  // ===================================================
  const loadList = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const docs = await loadUserWatchlist(user.uid);
    setItems(docs);
    setLoading(false);
  }, [user]);

  // 初回マウント時に取得
  useEffect(() => { loadList(); }, [loadList]);

  // ===================================================
  // 一括更新
  // ===================================================
  const handleRefreshAll = async () => {
    if (!user || items.length === 0) return;
    setRefreshing(true);
    await Promise.all(
      items.map(async (item) => {
        try {
          const [rRes, yRes] = await Promise.all([
            fetch(`/api/rakuten/search?${new URLSearchParams({ keyword: item.productName, hits: "5" })}`),
            fetch(`/api/yahoo/search?${new URLSearchParams({ keyword: item.productName, hits: "5" })}`),
          ]);
          const [rData, yData] = await Promise.all([rRes.json(), yRes.json()]);

          // excludeKeywords フィルター
          const excludeKws: string[] = (item as unknown as { excludeKeywords?: string[] }).excludeKeywords ?? [];
          function passesFilter(title: string): boolean {
            if (excludeKws.length === 0) return true;
            return !excludeKws.some((kw) =>
              title.toLowerCase().includes(kw.toLowerCase())
            );
          }

          const prices: number[] = [];
          if (!rData.error) {
            (rData.results ?? []).forEach((r: { itemName: string; price: number }) => {
              if (r.price > 0 && passesFilter(r.itemName)) prices.push(r.price);
            });
          }
          if (!yData.error) {
            (yData.results ?? []).forEach((r: { itemName: string; price: number }) => {
              if (r.price > 0 && passesFilter(r.itemName)) prices.push(r.price);
            });
          }
          if (prices.length > 0) {
            await updateWatchlistCurrentPrice(user.uid, item.id, Math.min(...prices));
          }
        } catch { /* 個別エラーは無視 */ }
      })
    );
    await loadList();
    setRefreshing(false);
  };

  // ===================================================
  // 削除
  // ===================================================
  const handleDelete = async (id: string) => {
    if (!user) return;
    setDeletingId(id);
    await removeUserWatchlistItem(user.uid, id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDeletingId(null);
  };

  // ===================================================
  // 差額ヘルパー
  // ===================================================
  const getDiff = (item: WatchlistDoc) => item.currentPrice - item.registeredPrice;

  // ユーザー未ログインなら非表示
  if (!user) return null;

  // 値下がり件数（バッジ用）
  const downCount = items.filter((i) => getDiff(i) < 0).length;

  return (
    <>
      {/* ===== 閉じた状態：フローティングボタン ===== */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9998,
            background: "#1e40af",
            color: "white",
            border: "none",
            borderRadius: 999,
            padding: "12px 18px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(30,64,175,0.35)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "inherit",
            transition: "opacity 0.2s, transform 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        >
          👁 ウォッチ
          <span style={{
            background: downCount > 0 ? "#059669" : "rgba(255,255,255,0.25)",
            borderRadius: 999,
            padding: "1px 8px",
            fontSize: 12,
            fontWeight: 700,
          }}>
            {items.length}件{downCount > 0 ? ` ▼${downCount}` : ""}
          </span>
        </button>
      )}

      {/* ===== 開いた状態：フローティングパネル ===== */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9998,
            width: 320,
            maxHeight: 500,
            background: "white",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* ヘッダー */}
          <div style={{
            padding: "12px 14px",
            background: "linear-gradient(135deg, #1e40af 0%, #4f46e5 100%)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "white", flex: 1 }}>
              👁 ウォッチリスト
              <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6, opacity: 0.8 }}>
                {items.length}件
              </span>
            </span>
            {/* 一括更新 */}
            <button
              onClick={handleRefreshAll}
              disabled={refreshing || items.length === 0}
              title="一括更新"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: 6,
                color: "white",
                fontSize: 14,
                cursor: refreshing || items.length === 0 ? "not-allowed" : "pointer",
                padding: "4px 8px",
                fontFamily: "inherit",
              }}
            >
              {refreshing ? "⏳" : "🔄"}
            </button>
            {/* 閉じる */}
            <button
              onClick={() => setOpen(false)}
              title="閉じる"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: 6,
                color: "white",
                fontSize: 14,
                cursor: "pointer",
                padding: "4px 8px",
                fontFamily: "inherit",
              }}
            >
              ✕
            </button>
          </div>

          {/* ボディ */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {/* ローディング */}
            {loading && (
              <div style={{ textAlign: "center", padding: 24, color: "#94a3b8", fontSize: 13 }}>
                ⏳ 読み込み中...
              </div>
            )}

            {/* 空状態 */}
            {!loading && items.length === 0 && (
              <div style={{ textAlign: "center", padding: "28px 16px", color: "#94a3b8" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👁</div>
                <div style={{ fontSize: 12 }}>ウォッチリストは空です</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  検索結果の ⭐ から追加できます
                </div>
              </div>
            )}

            {/* アイテムリスト */}
            {!loading && items.map((item) => {
              const diff = getDiff(item);
              const isDown = diff < 0;
              const isUp   = diff > 0;
              const pct    = item.registeredPrice > 0
                ? Math.abs((diff / item.registeredPrice) * 100).toFixed(1)
                : "0.0";

              return (
                <div
                  key={item.id}
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid #f1f5f9",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  {/* 商品情報 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* 商品名（クリックで検索遷移） */}
                    <button
                      onClick={() => { router.push(`/search?q=${encodeURIComponent(item.productName)}`); setOpen(false); }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#1e40af",
                        fontWeight: 600,
                        fontSize: 12,
                        textAlign: "left",
                        fontFamily: "inherit",
                        padding: 0,
                        display: "block",
                        width: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginBottom: 4,
                      }}
                      title={item.productName}
                    >
                      {item.productName.length > 28
                        ? item.productName.slice(0, 28) + "..."
                        : item.productName}
                    </button>

                    {/* 価格行 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {/* 登録時 */}
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        ¥{item.registeredPrice.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 10, color: "#cbd5e1" }}>→</span>
                      {/* 現在 */}
                      <span style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: isDown ? "#059669" : isUp ? "#dc2626" : "#374151",
                      }}>
                        ¥{item.currentPrice.toLocaleString()}
                      </span>
                      {/* 差額バッジ */}
                      {diff !== 0 && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 999,
                          background: isDown ? "#f0fdf4" : "#fff1f2",
                          color: isDown ? "#059669" : "#dc2626",
                        }}>
                          {isDown ? "▼" : "▲"} {pct}%
                        </span>
                      )}
                    </div>

                    {/* プラットフォーム */}
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>
                      {item.platform === "楽天市場" ? "🦅 楽天" : "🛍️ Yahoo!"}
                    </div>
                  </div>

                  {/* 削除ボタン */}
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    title="削除"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: deletingId === item.id ? "not-allowed" : "pointer",
                      color: "#cbd5e1",
                      fontSize: 14,
                      padding: 4,
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#dc2626"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#cbd5e1"; }}
                  >
                    {deletingId === item.id ? "⏳" : "🗑"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* フッター */}
          {items.length > 0 && (
            <div style={{
              padding: "8px 14px",
              borderTop: "1px solid #f1f5f9",
              background: "#fafafa",
              fontSize: 10,
              color: "#94a3b8",
              flexShrink: 0,
            }}>
              🔄 更新で最新価格に同期 　⭐ 検索結果から追加
            </div>
          )}
        </div>
      )}
    </>
  );
}
