"use client";
import { orders } from "@/lib/mockData";

const statusLabel: Record<string, { label: string; color: string; bg: string }> = {
  preparing: { label: "準備中", color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  shipped: { label: "配送中", color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  delivered: { label: "配達完了", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
};

export default function OrdersPage() {
  const active = orders.filter((o) => o.status !== "delivered");
  const delivered = orders.filter((o) => o.status === "delivered");

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#f5c842", marginBottom: 4 }}>
          📦 注文・発送管理 — 全EC一元管理
        </h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Amazon・楽天・ヨドバシ等すべての注文状況をひとつの画面で確認
        </p>
      </div>

      {/* サマリー */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "配送中", value: `${orders.filter(o => o.status === "shipped").length}件`, icon: "🚚", color: "#60a5fa" },
          { label: "準備中", value: `${orders.filter(o => o.status === "preparing").length}件`, icon: "📋", color: "#fbbf24" },
          { label: "完了（今月）", value: `${delivered.length}件`, icon: "✅", color: "#34d399" },
        ].map((s) => (
          <div key={s.label} className="dq-card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 32 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 進行中の注文 */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-header">
          <span>🚚</span>
          <h2>進行中の注文</h2>
        </div>
        {active.map((order) => (
          <div key={order.id} className="dq-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>{order.platformIcon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                  {order.productName}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {order.platform} · 注文日: {order.orderDate} · ¥{order.price.toLocaleString()}
                </div>
              </div>
              <div
                style={{
                  padding: "4px 12px",
                  borderRadius: 20,
                  background: statusLabel[order.status].bg,
                  color: statusLabel[order.status].color,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {statusLabel[order.status].label}
              </div>
            </div>

            {/* タイムライン */}
            <div style={{ display: "flex", gap: 0 }}>
              {order.timeline.map((step, i) => (
                <div key={i} style={{ flex: 1, position: "relative" }}>
                  {/* 繋ぎ線 */}
                  {i < order.timeline.length - 1 && (
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        left: "50%",
                        right: "-50%",
                        height: 2,
                        background: step.done
                          ? "linear-gradient(90deg,#3b82f6,#60a5fa)"
                          : "rgba(148,163,184,0.2)",
                        zIndex: 0,
                      }}
                    />
                  )}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", zIndex: 1 }}>
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: step.done
                          ? "linear-gradient(135deg,#3b82f6,#60a5fa)"
                          : "rgba(148,163,184,0.2)",
                        border: step.done ? "none" : "2px solid rgba(148,163,184,0.3)",
                      }}
                    />
                    <div style={{ fontSize: 10, color: step.done ? "#93c5fd" : "#475569", textAlign: "center", lineHeight: 1.3 }}>
                      {step.event}
                    </div>
                    <div style={{ fontSize: 9, color: "#334155", textAlign: "center" }}>{step.date}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 配送情報 */}
            <div
              style={{
                marginTop: 14,
                padding: "8px 12px",
                background: "rgba(15,23,42,0.5)",
                borderRadius: 6,
                display: "flex",
                gap: 20,
                fontSize: 11,
                color: "#94a3b8",
              }}
            >
              <span>🚛 {order.carrier}</span>
              <span>📋 追跡: {order.trackingNumber}</span>
              <span>📅 到着予定: {order.estimatedDelivery}</span>
              <span style={{ color: "#34d399" }}>+{order.pointsEarned.toLocaleString()}pt 獲得予定</span>
            </div>
          </div>
        ))}
      </div>

      {/* 配達完了 */}
      <div>
        <div className="section-header">
          <span>✅</span>
          <h2>配達完了</h2>
        </div>
        {delivered.map((order) => (
          <div
            key={order.id}
            className="dq-card"
            style={{ padding: 16, marginBottom: 10, opacity: 0.7 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>{order.platformIcon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
                  {order.productName}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  {order.platform} · {order.orderDate} · ¥{order.price.toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="badge-green">✓ 配達完了</span>
                <div style={{ fontSize: 11, color: "#f5c842", marginTop: 4 }}>
                  +{order.pointsEarned.toLocaleString()}pt
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
