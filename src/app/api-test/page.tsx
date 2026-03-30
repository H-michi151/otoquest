"use client";
import { useState, useEffect } from "react";
import { Search, CheckCircle, AlertCircle, Loader, Key, Copy, ExternalLink } from "lucide-react";

// 安全な文字列変換ヘルパー（オブジェクトが誤ってReact childになるのを防ぐ）
const toStr = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v, null, 2);
};

interface RakutenResult {
  itemName: string;
  shop: string;
  price: number;
  point_rate: number;
  review_average: number;
  review_count: number;
  url: string;
  imageUrl?: string | null;
}

// APIレスポンスは型が実行時に変わる可能性があるため unknown フィールドを含む
interface ApiResponse {
  source?: string;
  fetched_at?: string;
  keyword?: string;
  total?: number;
  page?: number;
  results?: RakutenResult[];
  error?: unknown;       // エラー文字列（またはまれにオブジェクト）
  hint?: unknown;        // ヒント文字列（複数行もある）
  detail?: unknown;      // 詳細（JSON文字列またはオブジェクト）
  auth_method_used?: string;
  endpoint_used?: string;
  received_format?: string;
}

const SESSION_KEY = "rakuten_app_id";

export default function RakutenApiTestPage() {
  const [appId, setAppId] = useState("");
  const [keyword, setKeyword] = useState("RTX 4070");
  const [hits, setHits] = useState("10");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  // セッションストレージからAPIキーを復元
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) setAppId(saved);
  }, []);

  const saveKey = () => {
    sessionStorage.setItem(SESSION_KEY, appId);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const clearKey = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAppId("");
  };

  const runSearch = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    setResponse(null);
    try {
      const params = new URLSearchParams({ keyword, hits });
      // アクセスキー形式を自動判別してパラメータ名を切り替え
      if (appId.trim()) {
        const key = appId.trim();
        if (key.startsWith("pk_")) {
          // 新API: Bearerトークン + applicationId（UUID）の両方が必要
          params.set("accessKey", key);
          // UUIDのアプリケーションIDも一緒に送る（route.tsがenv変数をフォールバックに使う）
          const savedAppId = sessionStorage.getItem("rakuten_application_id") || "";
          if (savedAppId) params.set("appId", savedAppId);
        } else {
          params.set("applicationId", key); // 旧API: クエリパラメータ認証
        }
      }

      const res = await fetch(`/api/rakuten/search?${params.toString()}`);
      const data: ApiResponse = await res.json();
      setResponse(data);
    } catch (e) {
      setResponse({
        source: "楽天市場",
        fetched_at: new Date().toISOString(),
        keyword,
        total: 0,
        page: 1,
        results: [],
        error: String(e),
      });
    } finally {
      setLoading(false);
    }
  };

  const copyJson = () => {
    if (response) navigator.clipboard.writeText(JSON.stringify(response, null, 2));
  };

  // APIから返ってきたレスポンスをチェック
  // error フィールドは文字列またはオブジェクトである可能性がある
  const hasResults = response && !response.error && (response.results ?? []).length > 0;
  const hasError = !!(response?.error);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
          🔗 楽天市場 API接続テスト
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          楽天 Ichiba Item Search API へのリアルタイム接続テスト。アクセスキーを入力して検索を実行してください。
        </p>
        {/* 認証方式ガイド */}
        <div style={{ marginTop: 8, padding: "10px 14px", background: "#eff6ff", borderRadius: 8, fontSize: 11, color: "#1e40af", border: "1px solid #bfdbfe" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>📋 楽天Developersのキー種類と使い方</div>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #bfdbfe" }}>
                <th style={{ textAlign: "left", padding: "3px 8px", fontWeight: 700 }}>登録タイプ</th>
                <th style={{ textAlign: "left", padding: "3px 8px", fontWeight: 700 }}>使うキー</th>
                <th style={{ textAlign: "left", padding: "3px 8px", fontWeight: 700 }}>形式</th>
                <th style={{ textAlign: "left", padding: "3px 8px", fontWeight: 700 }}>認証方式</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "3px 8px" }}>APIバックエンドサービス</td>
                <td style={{ padding: "3px 8px", color: "#059669", fontWeight: 700 }}>アクセスキー ✅</td>
                <td style={{ padding: "3px 8px", fontFamily: "monospace" }}>pk_xxx...</td>
                <td style={{ padding: "3px 8px" }}>Bearer（自動）</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 8px" }}>Webアプリケーション</td>
                <td style={{ padding: "3px 8px", color: "#059669", fontWeight: 700 }}>アプリID ✅</td>
                <td style={{ padding: "3px 8px", fontFamily: "monospace" }}>1234567890...</td>
                <td style={{ padding: "3px 8px" }}>applicationId（自動）</td>
              </tr>
              <tr style={{ color: "#dc2626" }}>
                <td style={{ padding: "3px 8px" }}>どちらでも</td>
                <td style={{ padding: "3px 8px", fontWeight: 700 }}>アプリケーションID ❌</td>
                <td style={{ padding: "3px 8px", fontFamily: "monospace" }}>UUID形式</td>
                <td style={{ padding: "3px 8px" }}>使用不可（OAuth用）</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* API設定パネル */}
      <div className="dq-card" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <Key size={14} color="#1e40af" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>API設定</span>
          <a
            href="https://webservice.rakuten.co.jp/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: "auto", fontSize: 11, color: "#1e40af", display: "flex", alignItems: "center", gap: 3 }}
          >
            <ExternalLink size={10} />
            楽天Webサービスでアプリ登録
          </a>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              type="password"
              placeholder={appId.startsWith("pk_")
                ? "✅ アクセスキー（pk_...）検出済み — 新API(2022)で接続します"
                : /^\d+$/.test(appId) && appId.length > 0
                  ? "✅ アプリID（数字）検出済み — 旧API(2017)で接続します"
                  : "アクセスキー（pk_で始まる）またはアプリID（数字）を入力"}
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: `1px solid ${appId.startsWith("pk_") || (/^\d+$/.test(appId) && appId.length > 0) ? "#86efac" : "#e2e8f0"}`,
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
                background: appId.startsWith("pk_") || (/^\d+$/.test(appId) && appId.length > 0) ? "#f0fdf4" : "white",
                boxSizing: "border-box",
              }}
            />
            {appId && (
              <div style={{ marginTop: 4, fontSize: 10, paddingLeft: 2 }}>
                {appId.startsWith("pk_")
                  ? <span style={{ color: "#059669", fontWeight: 700 }}>⚡ 新API（Bearer認証）で接続</span>
                  : /^[0-9a-f-]{36}$/i.test(appId)
                    ? <span style={{ color: "#dc2626", fontWeight: 700 }}>❌ UUID（アプリケーションID）は使用不可 → アクセスキー（pk_）を使ってください</span>
                    : /^\d+$/.test(appId)
                      ? <span style={{ color: "#059669", fontWeight: 700 }}>🔑 旧API（applicationId認証）で接続</span>
                      : <span style={{ color: "#d97706" }}>形式が不明 — pk_またはnum形式を確認してください</span>}
              </div>
            )}
          </div>
          <button
            onClick={saveKey}
            style={{
              padding: "10px 14px", borderRadius: 8,
              border: "1px solid #86efac",
              background: savedMsg ? "#bbf7d0" : "#f0fdf4",
              color: "#065f46", fontSize: 12,
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            }}
          >
            {savedMsg ? "✅ 保存済" : "💾 セッション保存"}
          </button>
          {appId && (
            <button
              onClick={clearKey}
              style={{
                padding: "10px 14px", borderRadius: 8,
                border: "1px solid #fca5a5",
                background: "#fff1f2",
                color: "#dc2626", fontSize: 12,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              🗑️ 削除
            </button>
          )}
        </div>

        <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
          ※ セッション保存はブラウザを閉じると消えます。
          永続保存は <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>.env.local</code> の
          <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>RAKUTEN_ACCESS_KEY=pk_...</code> （新API）または
          <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>RAKUTEN_APP_ID=数字</code> （旧API）に設定してください。
        </div>
      </div>

      {/* 検索設定 */}
      <div className="dq-card" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 }}>🔍 検索設定</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>キーワード</label>
            <input
              className="dq-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="商品名を入力（例：RTX 4070）"
              style={{ fontSize: 13 }}
            />
          </div>
          <div style={{ width: 80 }}>
            <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>件数</label>
            <select
              value={hits}
              onChange={(e) => setHits(e.target.value)}
              style={{
                width: "100%", padding: "9px 8px", borderRadius: 8,
                border: "1px solid #e2e8f0", fontSize: 13,
                fontFamily: "inherit", outline: "none",
              }}
            >
              <option value="3">3件</option>
              <option value="5">5件</option>
              <option value="10">10件</option>
              <option value="20">20件</option>
              <option value="30">30件</option>
            </select>
          </div>
          <div style={{ paddingTop: 20 }}>
            <button
              className="btn-primary"
              onClick={runSearch}
              disabled={loading || !keyword.trim()}
              style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
              {loading ? "検索中..." : "テスト実行"}
            </button>
          </div>
        </div>

        {/* APIリクエストプレビュー */}
        <div style={{ marginTop: 12, padding: "8px 12px", background: "#f8fafc", borderRadius: 6, fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
          <span style={{ color: "#94a3b8" }}>GET </span>
          <span style={{ color: "#1e40af" }}>/api/rakuten/search</span>
          <span>?keyword=</span><span style={{ color: "#059669" }}>{keyword || "..."}</span>
          <span>&hits=</span><span style={{ color: "#059669" }}>{hits}</span>
          <span>&sort=+itemPrice</span>
          {appId && <span style={{ color: "#d97706" }}>&applicationId=***</span>}
        </div>
      </div>

      {/* 結果表示 */}
      {loading && (
        <div className="dq-card" style={{ padding: 32, textAlign: "center" }}>
          <Loader size={28} color="#1e40af" style={{ margin: "0 auto 8px" }} />
          <div style={{ fontSize: 14, color: "#64748b" }}>楽天市場 APIに接続中...</div>
        </div>
      )}

      {hasError && (
        <div className="dq-card" style={{ padding: 18, border: "1px solid #fca5a5", background: "#fff1f2" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <AlertCircle size={16} color="#dc2626" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>エラー</span>
            {response!.endpoint_used && (
              <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 4 }}>({toStr(response!.endpoint_used)})</span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "#9f1239", marginBottom: 4, whiteSpace: "pre-wrap" }}>
            {toStr(response!.error)}
          </div>
          {Boolean(response!.hint) && (
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, whiteSpace: "pre-wrap", background: "#fffbeb", padding: "8px 10px", borderRadius: 6 }}>
              💡 {toStr(response!.hint)}
            </div>
          )}
          {Boolean(response!.detail) && (
            <pre style={{ fontSize: 11, color: "#374151", marginTop: 8, overflowX: "auto", background: "#f8fafc", padding: 8, borderRadius: 4, whiteSpace: "pre-wrap" }}>
              {toStr(response!.detail)}
            </pre>
          )}
        </div>
      )}

      {hasResults && (
        <div>
          {/* サマリ */}
          <div className="dq-card" style={{ padding: 14, marginBottom: 10, background: "#f0fdf4", border: "1px solid #86efac" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={16} color="#059669" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>
                接続成功 — {(response!.total ?? 0).toLocaleString()}件ヒット（上位{(response!.results ?? []).length}件を表示）
              </span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#64748b" }}>
                {response!.endpoint_used && <span style={{ marginRight: 8 }}>{toStr(response!.endpoint_used)}</span>}
                取得日時: {new Date(toStr(response!.fetched_at ?? "")).toLocaleString("ja-JP")}
              </span>
            </div>
          </div>

          {/* タブ切り替え */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button
              onClick={() => setShowRaw(false)}
              style={{
                padding: "6px 14px", borderRadius: 6,
                border: !showRaw ? "2px solid #1e40af" : "1px solid #e2e8f0",
                background: !showRaw ? "#eff6ff" : "white",
                color: !showRaw ? "#1e40af" : "#374151",
                fontSize: 12, fontWeight: !showRaw ? 700 : 400,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              📋 結果カード表示
            </button>
            <button
              onClick={() => setShowRaw(true)}
              style={{
                padding: "6px 14px", borderRadius: 6,
                border: showRaw ? "2px solid #1e40af" : "1px solid #e2e8f0",
                background: showRaw ? "#eff6ff" : "white",
                color: showRaw ? "#1e40af" : "#374151",
                fontSize: 12, fontWeight: showRaw ? 700 : 400,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {"{ }"} JSONデータ表示
            </button>
            <button
              onClick={copyJson}
              style={{
                marginLeft: "auto",
                padding: "6px 14px", borderRadius: 6,
                border: "1px solid #e2e8f0", background: "white",
                color: "#374151", fontSize: 12,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <Copy size={12} />
              JSONコピー
            </button>
          </div>

          {!showRaw && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(response!.results ?? []).map((item, i) => (
                <div
                  key={i}
                  className="dq-card"
                  style={{
                    padding: 14,
                    borderLeft: i === 0 ? "4px solid #1e40af" : "4px solid #e2e8f0",
                    background: i === 0 ? "#fafeff" : "white",
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {/* 順位 */}
                    <div
                      style={{
                        minWidth: 28, height: 28, borderRadius: "50%",
                        background: i === 0 ? "#1e40af" : "#f1f5f9",
                        color: i === 0 ? "white" : "#64748b",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>

                    {/* 商品画像 */}
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.itemName}
                        style={{ width: 60, height: 60, objectFit: "contain", borderRadius: 6, border: "1px solid #e2e8f0", flexShrink: 0 }}
                      />
                    )}

                    {/* メイン情報 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 4, lineHeight: 1.4 }}>
                        {item.itemName}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                        {item.shop}
                      </div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 18, fontWeight: 900, color: "#059669" }}>
                          ¥{item.price.toLocaleString()}
                        </span>
                        <span style={{ fontSize: 12, color: "#d97706", fontWeight: 600 }}>
                          ポイント{item.point_rate}倍
                        </span>
                        <span style={{ fontSize: 11, color: "#d97706" }}>
                          +{Math.floor(item.price * item.point_rate / 100).toLocaleString()}pt獲得見込み
                        </span>
                        {item.review_count > 0 && (
                          <span style={{ fontSize: 11, color: "#64748b" }}>
                            ⭐ {item.review_average} ({item.review_count}件)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* リンク */}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "6px 12px", borderRadius: 6,
                        background: "#cc0000", color: "white",
                        fontSize: 11, fontWeight: 700,
                        textDecoration: "none", flexShrink: 0,
                        display: "flex", alignItems: "center", gap: 4,
                      }}
                    >
                      <ExternalLink size={10} />
                      楽天で見る
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showRaw && (
            <div className="dq-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: "#1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>application/json</span>
                <button
                  onClick={copyJson}
                  style={{ fontSize: 11, color: "#64748b", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}
                >
                  <Copy size={10} /> コピー
                </button>
              </div>
              <pre
                style={{
                  margin: 0, padding: 16,
                  background: "#0f172a",
                  color: "#e2e8f0",
                  fontSize: 12,
                  fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                  overflowX: "auto",
                  maxHeight: 600,
                  overflowY: "auto",
                }}
              >
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 空結果 */}
      {response && !hasError && (response.results ?? []).length === 0 && !loading && (
        <div className="dq-card" style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 14 }}>「{response.keyword}」に一致する商品が見つかりませんでした。</div>
        </div>
      )}

      {/* 未実行 */}
      {!response && !loading && (
        <div className="dq-card" style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
            楽天API接続テスト
          </div>
          <div style={{ fontSize: 13 }}>
            上のフォームにアプリIDとキーワードを入力して「テスト実行」をクリック
          </div>
          <div style={{ marginTop: 16, padding: "12px 20px", background: "#fffbeb", borderRadius: 8, display: "inline-block", textAlign: "left", fontSize: 12, color: "#92400e" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>📌 アプリID取得手順</div>
            <ol style={{ margin: 0, paddingLeft: 16, lineHeight: 2 }}>
              <li><a href="https://webservice.rakuten.co.jp/" target="_blank" rel="noopener noreferrer" style={{ color: "#1e40af" }}>webservice.rakuten.co.jp</a> にアクセス</li>
              <li>楽天IDでログイン → 「アプリ登録」</li>
              <li>アプリ名・URLを適当に入力して発行</li>
              <li>発行された「アプリID」をここに貼り付け</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
