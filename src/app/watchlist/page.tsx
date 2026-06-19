"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getIdToken } from "firebase/auth";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ===== 型 =====
type PriceEntry = { date: string; price: number; shop: string };
type WatchlistItem = {
  id: string;
  category: string;
  name: string;
  keyword: string;
  kakakuUrl?: string;
  currentPrice: number;
  previousPrice: number;
  currentShop: string;
  alertPrice: number;
  updatedAt: string | null;
  order: number;
  priceHistory: PriceEntry[];
};

type AuthUser = NonNullable<ReturnType<typeof useAuth>["user"]>;
async function authHeader(user: AuthUser) {
  const token = await getIdToken(user, false);
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const ADMIN_UID = (process.env.NEXT_PUBLIC_ADMIN_UID ?? "").trim();

// カテゴリ色
const CAT_COLOR: Record<string, { bg: string; color: string }> = {
  GPU:  { bg: "#ede9fe", color: "#7c3aed" },
  CPU:  { bg: "#dbeafe", color: "#1d4ed8" },
  MB:   { bg: "#dcfce7", color: "#15803d" },
  RAM:  { bg: "#fef3c7", color: "#b45309" },
  Disk: { bg: "#fee2e2", color: "#dc2626" },
};
function catStyle(cat: string) {
  return CAT_COLOR[cat] ?? { bg: "#f1f5f9", color: "#475569" };
}

// 差額表示
function PriceDiff({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0 || cur === 0) return <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>;
  const diff = cur - prev;
  const pct  = ((diff / prev) * 100).toFixed(1);
  const up   = diff > 0;
  const zero = diff === 0;
  return (
    <span style={{ fontSize: 12, color: zero ? "#94a3b8" : up ? "#dc2626" : "#059669", fontWeight: 700 }}>
      {zero ? "±0" : `${up ? "▲" : "▼"} ¥${Math.abs(diff).toLocaleString()} (${pct}%)`}
    </span>
  );
}

// 日付フォーマット
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ===== チャート画面 =====
const PERIODS = ["1ヶ月", "3ヶ月", "6ヶ月", "全期間"] as const;
type Period = typeof PERIODS[number];
function periodMs(p: Period): number {
  const d = { "1ヶ月": 30, "3ヶ月": 90, "6ヶ月": 180, "全期間": 99999 };
  return d[p] * 86400 * 1000;
}

function ChartView({ item, onBack }: { item: WatchlistItem; onBack: () => void }) {
  const [period, setPeriod] = useState<Period>("全期間");
  const now = Date.now();
  const filtered = item.priceHistory.filter((h) => {
    const ms = new Date(h.date).getTime();
    return now - ms <= periodMs(period);
  });
  const chartData = [...filtered].reverse().map((h) => ({ date: h.date.slice(5), price: h.price }));
  const prices = filtered.map((h) => h.price);
  const minP = prices.length ? Math.min(...prices) : 0;
  const maxP = prices.length ? Math.max(...prices) : 0;
  const avgP = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

  const diff = item.currentPrice - item.previousPrice;
  const diffPct = item.previousPrice > 0 ? ((diff / item.previousPrice) * 100).toFixed(1) : "0.0";
  const diffColor = diff < 0 ? "#059669" : diff > 0 ? "#dc2626" : "#94a3b8";

  return (
    <div>
      <button onClick={onBack} style={{ marginBottom: 16, padding: "6px 14px", borderRadius: 8,
        border: "1px solid #e2e8f0", background: "white", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
        ← 一覧に戻る
      </button>

      {/* ヘッダー */}
      <div className="dq-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ ...catStyle(item.category), padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
            {item.category}
          </span>
          <span style={{ fontSize: 22, fontWeight: 900, color: "#1e293b" }}>{item.name}</span>
          {item.currentPrice > 0 && (
            <>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#1e293b", marginLeft: 8 }}>
                ¥{item.currentPrice.toLocaleString()}
              </span>
              <span style={{ color: diffColor, fontWeight: 700, fontSize: 13 }}>
                {diff !== 0 ? `${diff < 0 ? "▼" : "▲"} ¥${Math.abs(diff).toLocaleString()} (${diffPct}%)` : ""}
              </span>
            </>
          )}
        </div>
        {item.currentShop && <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>最安: {item.currentShop}</div>}
      </div>

      {/* 期間タブ */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {PERIODS.map((p) => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit",
            fontSize: 12, fontWeight: period === p ? 700 : 400,
            background: period === p ? "#1e40af" : "#f1f5f9",
            color: period === p ? "white" : "#374151",
          }}>{p}</button>
        ))}
      </div>

      {/* チャート */}
      <div className="dq-card" style={{ padding: 16, marginBottom: 16 }}>
        {chartData.length < 2 ? (
          <div style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>データが不足しています</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [`¥${Number(v).toLocaleString()}`, "価格"]} />
              <Line type="monotone" dataKey="price" stroke="#1e40af" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 統計カード */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "最安値", val: minP > 0 ? `¥${minP.toLocaleString()}` : "—" },
          { label: "最高値", val: maxP > 0 ? `¥${maxP.toLocaleString()}` : "—" },
          { label: "平均価格", val: avgP > 0 ? `¥${avgP.toLocaleString()}` : "—" },
          { label: "更新回数", val: `${item.priceHistory.length}回` },
        ].map(({ label, val }) => (
          <div key={label} className="dq-card" style={{ padding: "10px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b" }}>{val}</div>
          </div>
        ))}
      </div>

      {/* 価格履歴テーブル */}
      <div className="dq-card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["日付", "価格", "前回比", "店舗"].map((h) => (
                <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#64748b", fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {item.priceHistory.slice(0, 30).map((h, i) => {
              const prev = item.priceHistory[i + 1];
              const d = prev ? h.price - prev.price : 0;
              return (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "7px 12px" }}>{h.date}</td>
                  <td style={{ padding: "7px 12px", fontWeight: 700 }}>¥{h.price.toLocaleString()}</td>
                  <td style={{ padding: "7px 12px", color: d < 0 ? "#059669" : d > 0 ? "#dc2626" : "#94a3b8" }}>
                    {d === 0 || !prev ? "—" : `${d < 0 ? "▼" : "▲"} ¥${Math.abs(d).toLocaleString()}`}
                  </td>
                  <td style={{ padding: "7px 12px", color: "#64748b" }}>{h.shop || "—"}</td>
                </tr>
              );
            })}
            {item.priceHistory.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>履歴なし</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== メインページ =====
export default function WatchlistPage() {
  const { user } = useAuth();
  const isAdmin = !!(user?.uid && ADMIN_UID && user.uid.trim() === ADMIN_UID);

  const [items, setItems]       = useState<WatchlistItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [chartItem, setChartItem] = useState<WatchlistItem | null>(null);

  // 価格更新ポップオーバー
  const [popoverId, setPopoverId]     = useState<string | null>(null);
  const [popPrice, setPopPrice]       = useState("");
  const [popShop, setPopShop]         = useState("");
  const [popUrl, setPopUrl]           = useState("");
  const [popSaving, setPopSaving]     = useState(false);

  // アラート編集
  const [alertEditId, setAlertEditId] = useState<string | null>(null);
  const [alertVal, setAlertVal]       = useState("");
  const [alertSaving, setAlertSaving] = useState(false);

  // 追加モーダル
  const [showAdd, setShowAdd]         = useState(false);
  const [addCat, setAddCat]           = useState("GPU");
  const [addName, setAddName]         = useState("");
  const [addKw, setAddKw]             = useState("");
  const [addAlert, setAddAlert]       = useState("");
  const [addSaving, setAddSaving]     = useState(false);

  // ===== データ取得 =====
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/watchlist");
      const data = await res.json() as { items: WatchlistItem[] };
      setItems(data.items ?? []);
    } catch (e) {
      console.error("[watchlist] load failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ===== 価格更新 =====
  const submitPrice = async (id: string) => {
    if (!user) return;
    setPopSaving(true);
    try {
      const headers = await authHeader(user);
      const body: Record<string, unknown> = {
        currentPrice: parseInt(popPrice) || 0,
        currentShop: popShop.trim(),
      };
      if (popUrl.trim()) body.kakakuUrl = popUrl.trim();
      await fetch(`/api/watchlist/${id}`, {
        method: "PUT", headers,
        body: JSON.stringify(body),
      });
      setPopoverId(null); setPopPrice(""); setPopShop(""); setPopUrl("");
      await load();
    } catch (e) { console.error(e); }
    setPopSaving(false);
  };

  // ===== 削除 =====
  const deleteItem = async (id: string, name: string) => {
    if (!user || !confirm(`「${name}」を削除しますか？`)) return;
    const headers = await authHeader(user);
    await fetch(`/api/watchlist/${id}`, { method: "DELETE", headers });
    await load();
  };

  // ===== アラート更新 =====
  const submitAlert = async (id: string) => {
    if (!user) return;
    setAlertSaving(true);
    try {
      const headers = await authHeader(user);
      await fetch(`/api/watchlist/${id}`, {
        method: "PUT", headers,
        body: JSON.stringify({ alertPrice: parseInt(alertVal) || 0 }),
      });
      setAlertEditId(null); setAlertVal("");
      await load();
    } catch (e) { console.error(e); }
    setAlertSaving(false);
  };

  // ===== アイテム追加 =====
  const submitAdd = async () => {
    if (!user || !addName.trim()) return;
    setAddSaving(true);
    try {
      const headers = await authHeader(user);
      await fetch("/api/watchlist", {
        method: "POST", headers,
        body: JSON.stringify({ category: addCat, name: addName.trim(), keyword: addKw.trim() || addName.trim(), alertPrice: parseInt(addAlert) || 0 }),
      });
      setShowAdd(false); setAddCat("GPU"); setAddName(""); setAddKw(""); setAddAlert("");
      await load();
    } catch (e) { console.error(e); }
    setAddSaving(false);
  };

  // ===== チャート画面 =====
  if (chartItem) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <ChartView item={chartItem} onBack={() => setChartItem(null)} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#7c3aed", marginBottom: 4 }}>👁 ウォッチリスト</h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>価格.com最安値の手動管理・価格推移チャート</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} style={{
            marginLeft: "auto", padding: "8px 16px", borderRadius: 8, border: "none",
            background: "linear-gradient(90deg,#7c3aed,#a855f7)", color: "white",
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>＋ 追加</button>
        )}
      </div>

      {/* テーブル */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>⏳ 読み込み中...</div>
      ) : (
        <div className="dq-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["カテゴリ", "型番", "価格.com最安", "前回比", "最安店舗", "更新日", "アラート", ...(isAdmin ? ["操作"] : [])].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 600, borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    {/* カテゴリ */}
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ ...catStyle(item.category), padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, display: "inline-block" }}>
                        {item.category}
                      </span>
                    </td>
                    {/* 型番 */}
                    <td style={{ padding: "10px 12px" }}>
                      <button onClick={() => setChartItem(item)} style={{
                        background: "none", border: "none", cursor: "pointer", color: "#1e40af",
                        fontWeight: 700, fontSize: 13, fontFamily: "inherit", padding: 0,
                      }}>{item.name}</button>
                    </td>
                    {/* 最安価格 */}
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#1e293b" }}>
                      {item.currentPrice > 0 ? `¥${item.currentPrice.toLocaleString()}` : <span style={{ color: "#94a3b8" }}>未登録</span>}
                    </td>
                    {/* 前回比 */}
                    <td style={{ padding: "10px 12px" }}>
                      <PriceDiff cur={item.currentPrice} prev={item.previousPrice} />
                    </td>
                    {/* 店舗 */}
                    <td style={{ padding: "10px 12px", color: "#64748b", fontSize: 12 }}>{item.currentShop || "—"}</td>
                    {/* 更新日 */}
                    <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 12 }}>{fmtDate(item.updatedAt)}</td>
                    {/* アラート */}
                    <td style={{ padding: "10px 12px" }}>
                      {alertEditId === item.id ? (
                        <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <input type="number" value={alertVal} onChange={(e) => setAlertVal(e.target.value)}
                            placeholder="0" style={{ width: 80, padding: "3px 6px", borderRadius: 5, border: "1px solid #e2e8f0", fontSize: 12, fontFamily: "inherit" }} />
                          <button onClick={() => submitAlert(item.id)} disabled={alertSaving} style={smallBtn("#059669")}>
                            {alertSaving ? "…" : "保存"}
                          </button>
                          <button onClick={() => setAlertEditId(null)} style={smallBtn("#94a3b8")}>✕</button>
                        </span>
                      ) : (
                        <span onClick={() => { setAlertEditId(item.id); setAlertVal(String(item.alertPrice || "")); }}
                          style={{ cursor: "pointer", fontSize: 11, padding: "2px 8px", borderRadius: 999,
                            background: item.alertPrice > 0 ? "#fef3c7" : "#f1f5f9",
                            color: item.alertPrice > 0 ? "#b45309" : "#94a3b8", fontWeight: item.alertPrice > 0 ? 700 : 400 }}>
                          {item.alertPrice > 0 ? `¥${item.alertPrice.toLocaleString()}以下` : "未設定"}
                        </span>
                      )}
                    </td>
                    {/* 操作（管理者のみ） */}
                    {isAdmin && (
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {/* 価格.comリンク */}
                          <a href={item.kakakuUrl || `https://search.kakaku.com/${encodeURIComponent(item.keyword)}/?act=Input`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: "#1e40af", textDecoration: "none", whiteSpace: "nowrap" }}>
                            🔍 価格.comで確認
                          </a>
                          {/* 価格入力ポップオーバー */}
                          {popoverId === item.id ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "#f8fafc", padding: 8, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                              <input type="number" value={popPrice} onChange={(e) => setPopPrice(e.target.value)}
                                placeholder="最安値（円）" style={{ ...inpSm }} />
                              <input value={popShop} onChange={(e) => setPopShop(e.target.value)}
                                placeholder="店舗名" style={{ ...inpSm }} />
                              <input value={popUrl} onChange={(e) => setPopUrl(e.target.value)}
                                placeholder="価格.com URL（任意）" style={{ ...inpSm }} />
                              <div style={{ display: "flex", gap: 4 }}>
                                <button onClick={() => submitPrice(item.id)} disabled={popSaving} style={smallBtn("#1e40af")}>
                                  {popSaving ? "…" : "更新"}
                                </button>
                                <button onClick={() => setPopoverId(null)} style={smallBtn("#94a3b8")}>✕</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setPopoverId(item.id); setPopPrice(String(item.currentPrice || "")); setPopShop(item.currentShop); setPopUrl(item.kakakuUrl ?? ""); }}
                              style={smallBtn("#7c3aed")}>
                              価格を入力
                            </button>
                          )}
                          {/* 削除 */}
                          <button onClick={() => deleteItem(item.id, item.name)} style={{ ...smallBtn("#dc2626"), marginTop: 2 }}>
                            🗑 削除
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
                      データがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== 追加モーダル（管理者のみ） ===== */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 24, width: 420, maxWidth: "95vw",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", marginBottom: 18 }}>＋ パーツを追加</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={lbl}>カテゴリ</label>
                <select value={addCat} onChange={(e) => setAddCat(e.target.value)} style={inp}>
                  {["GPU","CPU","MB","RAM","Disk","Case","ATX","CaseFan","CPUCooler","AIO","AddParts","Software","SF","その他"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>型番・名前</label>
                <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="例: RTX 5070 12G" style={inp} />
              </div>
              <div>
                <label style={lbl}>検索キーワード</label>
                <input value={addKw} onChange={(e) => setAddKw(e.target.value)} placeholder="例: RTX 5070 12GB" style={inp} />
              </div>
              <div>
                <label style={lbl}>アラート価格（任意）</label>
                <input type="number" value={addAlert} onChange={(e) => setAddAlert(e.target.value)} placeholder="0" style={inp} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={submitAdd} disabled={addSaving || !addName.trim()}
                style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
                  background: "linear-gradient(90deg,#7c3aed,#a855f7)", color: "white",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {addSaving ? "追加中…" : "💾 追加"}
              </button>
              <button onClick={() => setShowAdd(false)}
                style={{ flex: 1, padding: "11px 0", borderRadius: 10,
                  border: "1px solid #e2e8f0", background: "white",
                  color: "#64748b", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== スタイル定数 =====
const lbl: React.CSSProperties = { fontSize: 11, color: "#64748b", display: "block", marginBottom: 3 };
const inp: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0",
  fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" as const,
};
const inpSm: React.CSSProperties = {
  width: "100%", padding: "4px 7px", borderRadius: 5, border: "1px solid #e2e8f0",
  fontSize: 11, fontFamily: "inherit", boxSizing: "border-box" as const,
};
function smallBtn(color: string): React.CSSProperties {
  return {
    padding: "3px 10px", borderRadius: 5, border: "none", background: color,
    color: "white", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
  };
}
