"use client";
import { campaigns } from "@/lib/mockData";
import { useState } from "react";

export default function CampaignsPage() {
  const [entries, setEntries] = useState<string[]>(
    campaigns.filter((c) => c.status === "entered").map((c) => c.id)
  );

  const toggle = (id: string) => {
    setEntries((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const entered = campaigns.filter((c) => entries.includes(c.id));
  const unEntered = campaigns.filter((c) => !entries.includes(c.id));
  const totalPotential = entered.reduce((s, c) => s + c.potentialPoints, 0);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#f5c842", marginBottom: 4 }}>
          🎯 キャンペーン管理 — 自動エントリー最大化
        </h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          全ECサイト・クレカキャンペーンを一元管理。エントリー漏れを防ぎポイントを最大化
        </p>
      </div>

      {/* サマリー */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "エントリー中", value: `${entered.length}件`, color: "#34d399" },
          { label: "未エントリー（推奨）", value: `${unEntered.length}件`, color: "#ef4444" },
          { label: "獲得予定ポイント合計", value: `${totalPotential.toLocaleString()}pt`, color: "#f5c842" },
        ].map((s) => (
          <div key={s.label} className="dq-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: "#64748b" }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 未エントリー（要対応） */}
      {unEntered.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-header">
            <span>🚨</span>
            <h2 style={{ color: "#fca5a5" }}>未エントリー — 今すぐ登録が必要</h2>
          </div>
          {unEntered.map((camp) => (
            <div key={camp.id} className="dq-card dq-card-danger" style={{ padding: 20, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: camp.platformColor,
                    marginTop: 4,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                    {camp.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{camp.description}</div>
                  <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11 }}>
                    <span style={{ color: "#64748b" }}>📱 {camp.platform}</span>
                    <span style={{ color: "#ef4444" }}>⏰ 期限: {camp.deadline}</span>
                    <span style={{ color: "#f5c842" }}>🏷️ {camp.category}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#34d399" }}>
                    +{camp.potentialPoints.toLocaleString()}pt
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>獲得可能</div>
                  <button
                    className="btn-primary"
                    onClick={() => toggle(camp.id)}
                    style={{ fontSize: 12 }}
                  >
                    ✨ 今すぐエントリー
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* エントリー済み */}
      <div>
        <div className="section-header">
          <span>✅</span>
          <h2>エントリー済みキャンペーン</h2>
        </div>
        {entered.map((camp) => (
          <div key={camp.id} className="dq-card" style={{ padding: 18, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: camp.platformColor,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{camp.name}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {camp.platform} · 期限: {camp.deadline} · {camp.category}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#34d399" }}>
                    +{camp.potentialPoints.toLocaleString()}pt
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>還元率 {camp.bonusRate}%</div>
                </div>
                <span className="badge-green">✓ 登録済</span>
                <button
                  onClick={() => toggle(camp.id)}
                  className="btn-danger"
                  style={{ fontSize: 11 }}
                >
                  解除
                </button>
              </div>
            </div>

            {/* 残り期間バー */}
            {camp.deadline && (() => {
              const now = new Date();
              const end = new Date(camp.deadline);
              const total = end.getTime() - new Date("2026-03-01").getTime();
              const remain = end.getTime() - now.getTime();
              const pct = Math.max(0, Math.min(100, Math.round((remain / total) * 100)));
              return (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>
                    期間残り {Math.max(0, Math.round(remain / 86400000))}日
                  </div>
                  <div className="hp-bar">
                    <div
                      className={`hp-bar-fill${pct < 25 ? " danger" : pct < 50 ? " warning" : ""}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {/* 一括エントリー */}
      {unEntered.length > 0 && (
        <div
          className="dq-card dq-card-gold"
          style={{ padding: 20, marginTop: 24, textAlign: "center" }}
        >
          <div style={{ fontSize: 14, color: "#e2e8f0", marginBottom: 12 }}>
            🤖 AIが未エントリー{unEntered.length}件を自動エントリーします
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
            これらを一度に登録すると最大{unEntered.reduce((s, c) => s + c.potentialPoints, 0).toLocaleString()}pt追加獲得の見込みです
          </div>
          <button
            className="btn-primary"
            style={{ fontSize: 14, padding: "12px 32px" }}
            onClick={() => setEntries(campaigns.map((c) => c.id))}
          >
            ⚔️ 一括自動エントリー（{unEntered.length}件）
          </button>
        </div>
      )}
    </div>
  );
}
