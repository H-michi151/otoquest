"use client";
import { currentUser } from "@/lib/mockData";
import { Bell } from "lucide-react";
import { useState } from "react";

export default function Header() {
  const [notifOpen, setNotifOpen] = useState(false);
  const gpPct = Math.round((currentUser.dailyGpToday / currentUser.dailyGpLimit) * 100);

  return (
    <header
      style={{
        height: 58,
        background: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 16,
        flexShrink: 0,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* 今月の節約 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 18 }}>💰</span>
        <span style={{ fontSize: 12, color: "#64748b" }}>今月の節約：</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#059669" }}>¥12,480</span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>/ ¥50,000予算</span>
      </div>

      {/* GP進捗 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginLeft: 12,
          padding: "4px 12px",
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: 20,
        }}
      >
        <span style={{ fontSize: 13 }}>⚔️</span>
        <div>
          <div style={{ fontSize: 10, color: "#92400e" }}>今日のGP</div>
          <div style={{ fontSize: 12, color: "#b45309", fontWeight: 700 }}>
            {currentUser.dailyGpToday}&nbsp;/&nbsp;{currentUser.dailyGpLimit}
          </div>
        </div>
        <div
          style={{
            width: 56,
            height: 6,
            background: "#fef3c7",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${gpPct}%`,
              height: "100%",
              background: "linear-gradient(90deg, #d97706, #fbbf24)",
              borderRadius: 3,
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* 通知ベル */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setNotifOpen(!notifOpen)}
          style={{
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            color: "#e11d48",
          }}
        >
          <Bell size={16} />
          <span
            style={{
              background: "#dc2626",
              color: "white",
              borderRadius: "50%",
              width: 16,
              height: 16,
              fontSize: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            3
          </span>
        </button>
        {notifOpen && (
          <div
            style={{
              position: "absolute",
              top: 42,
              right: 0,
              width: 290,
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "12px",
              zIndex: 100,
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
              通知
            </div>
            {[
              { icon: "⚠️", text: "イオンカードの解約を検討してください", time: "今" },
              { icon: "🎯", text: "楽天スーパーSALEの期限が近づいています", time: "1時間前" },
              { icon: "✨", text: "Sony WH-1000XM5が4.2%値下がりしました", time: "3時間前" },
            ].map((n, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: i < 2 ? "1px solid #f1f5f9" : "none",
                }}
              >
                <span style={{ fontSize: 16 }}>{n.icon}</span>
                <div>
                  <div style={{ fontSize: 12, color: "#374151" }}>{n.text}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{n.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ユーザー情報 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 12px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
        }}
      >
        <span style={{ fontSize: 22 }}>{currentUser.avatar}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>
            {currentUser.name}
          </div>
          <div style={{ fontSize: 10, color: "#d97706" }}>
            Lv.{currentUser.level}&nbsp;{currentUser.class}
          </div>
        </div>
      </div>
    </header>
  );
}
