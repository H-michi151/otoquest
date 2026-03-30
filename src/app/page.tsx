"use client";
import { currentUser, savingsStats, orders, campaigns, creditCards } from "@/lib/mockData";
import Link from "next/link";

export default function Dashboard() {
  const gpPct = Math.round((currentUser.dailyGpToday / currentUser.dailyGpLimit) * 100);
  const budgetPct = Math.round((currentUser.monthlySpent / currentUser.monthlyBudget) * 100);
  const activeOrders = orders.filter((o) => o.status !== "delivered");
  const reviewCard = creditCards.find((c) => c.recommendation === "cancel");
  const unenteredCampaigns = campaigns.filter((c) => c.status === "not_entered");

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* ページタイトル */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#f5c842", marginBottom: 4 }}>
          ⚔️ マイページ — 冒険者の館
        </h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          あなたの節約状況・注文・ポイントをすべて一元管理
        </p>
      </div>

      {/* 上部：主要KPI 4枚 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {/* 月節約額 */}
        <div className="dq-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>今月の節約額</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#34d399" }}>
            ¥{savingsStats.thisMonth.totalSaved.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: "#10b981", marginTop: 4 }}>
            先月比 +¥{(savingsStats.thisMonth.totalSaved - savingsStats.lastMonth.totalSaved).toLocaleString()}
          </div>
        </div>
        {/* 月間ポイント */}
        <div className="dq-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>今月獲得ポイント</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#f5c842" }}>
            {savingsStats.thisMonth.pointsEarned.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            ≒ ¥{savingsStats.thisMonth.pointsEarned.toLocaleString()} 相当
          </div>
        </div>
        {/* GP合計 */}
        <div className="dq-card dq-card-gold" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>⚔️ 冒険者GP合計</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#f5c842" }}>
            {currentUser.guildPoints.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: "#f5c842", marginTop: 4 }}>
            Lv.{currentUser.level} {currentUser.class}
          </div>
        </div>
        {/* 月予算消化 */}
        <div className="dq-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>月予算消化</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#e2e8f0" }}>
            {budgetPct}%
          </div>
          <div style={{ marginTop: 8 }}>
            <div className="hp-bar">
              <div
                className="hp-bar-fill"
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
              ¥{currentUser.monthlySpent.toLocaleString()} / ¥{currentUser.monthlyBudget.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 中部：注文管理・アラート */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* 配送中の注文 */}
        <div className="dq-card" style={{ padding: 20 }}>
          <div className="section-header">
            <span>📦</span>
            <h2>進行中の注文</h2>
            <Link href="/orders" style={{ marginLeft: "auto", fontSize: 11, color: "#3b82f6", textDecoration: "none" }}>
              すべて見る →
            </Link>
          </div>
          {activeOrders.map((order) => (
            <div
              key={order.id}
              style={{
                padding: "12px",
                marginBottom: 8,
                background: "rgba(15,23,42,0.6)",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.1)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{order.platformIcon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>
                    {order.productName}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{order.platform}</div>
                </div>
                <span
                  className={order.status === "shipped" ? "badge-blue" : "badge-yellow"}
                >
                  {order.status === "shipped" ? "配送中" : "準備中"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                🚚 {order.carrier} · 到着予定: {order.estimatedDelivery}
              </div>
            </div>
          ))}
        </div>

        {/* アラート */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* カード解約アラート */}
          {reviewCard && (
            <div className="dq-card dq-card-danger" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: "#fca5a5", fontWeight: 700, marginBottom: 8 }}>
                ⚠️ カード解約推奨
              </div>
              <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>
                {reviewCard.name}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                {reviewCard.cancelReason}
              </div>
              <Link
                href="/cards"
                style={{
                  display: "inline-block",
                  marginTop: 10,
                  fontSize: 11,
                  color: "#fca5a5",
                  textDecoration: "none",
                  border: "1px solid rgba(239,68,68,0.3)",
                  padding: "4px 10px",
                  borderRadius: 6,
                }}
              >
                詳細を確認 →
              </Link>
            </div>
          )}

          {/* 未エントリーキャンペーン */}
          {unenteredCampaigns[0] && (
            <div className="dq-card dq-card-purple" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: "#c4b5fd", fontWeight: 700, marginBottom: 8 }}>
                🎯 未エントリーキャンペーン
              </div>
              <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>
                {unenteredCampaigns[0].name}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0" }}>
                {unenteredCampaigns[0].platform} · 期限: {unenteredCampaigns[0].deadline}
              </div>
              <div style={{ fontSize: 12, color: "#34d399", fontWeight: 700 }}>
                +{unenteredCampaigns[0].potentialPoints.toLocaleString()} pt 獲得可能
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                他{unenteredCampaigns.length - 1}件の未エントリーあり
              </div>
            </div>
          )}

          {/* 今日のGP */}
          <div className="dq-card dq-card-gold" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: "#f5c842", fontWeight: 700, marginBottom: 8 }}>
              ⚔️ 今日のGP進捗
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f5c842" }}>
              {currentUser.dailyGpToday} / {currentUser.dailyGpLimit} GP
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="hp-bar">
                <div className="gp-bar-fill" style={{ width: `${gpPct}%` }} />
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>
              あと{currentUser.dailyGpLimit - currentUser.dailyGpToday} GP獲得可能
            </div>
          </div>
        </div>
      </div>

      {/* 下部：節約グラフ・キャンペーン一覧 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* シンプルな節約グラフ */}
        <div className="dq-card" style={{ padding: 20 }}>
          <div className="section-header">
            <span>📈</span>
            <h2>節約実績グラフ（6ヶ月）</h2>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100, marginTop: 8 }}>
            {savingsStats.history.map((item, i) => {
              const max = Math.max(...savingsStats.history.map((h) => h.saved));
              const h = Math.round((item.saved / max) * 90);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 10, color: "#34d399" }}>¥{(item.saved / 1000).toFixed(0)}k</div>
                  <div
                    style={{
                      width: "100%",
                      height: h,
                      background: i === 5
                        ? "linear-gradient(180deg,#f5c842,#d4a017)"
                        : "linear-gradient(180deg,#10b981,#047857)",
                      borderRadius: "4px 4px 0 0",
                    }}
                  />
                  <div style={{ fontSize: 10, color: "#475569" }}>{item.month}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* キャンペーン入力中一覧 */}
        <div className="dq-card" style={{ padding: 20 }}>
          <div className="section-header">
            <span>🎯</span>
            <h2>エントリー中キャンペーン</h2>
            <Link href="/campaigns" style={{ marginLeft: "auto", fontSize: 11, color: "#3b82f6", textDecoration: "none" }}>
              すべて見る →
            </Link>
          </div>
          {campaigns
            .filter((c) => c.status === "entered")
            .slice(0, 3)
            .map((camp) => (
              <div
                key={camp.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(148,163,184,0.1)",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: camp.platformColor,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>
                    {camp.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>
                    {camp.platform} · {camp.deadline}まで
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#34d399", fontWeight: 700 }}>
                  +{camp.potentialPoints.toLocaleString()}pt
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
