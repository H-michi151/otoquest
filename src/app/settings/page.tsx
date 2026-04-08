"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "otoquest_user_settings";

export interface UserSettings {
  budget: number;
  rakutenRate: number;
  yahooRate: number;
  rakutenCoupon: number;
  yahooCoupon: number;
  kakakuEnabled: boolean;
}

export const defaultSettings: UserSettings = {
  budget: 30000,
  rakutenRate: 1,
  yahooRate: 1,
  rakutenCoupon: 0,
  yahooCoupon: 0,
  kakakuEnabled: false,
};

export function loadSettings(): UserSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: UserSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const set = <K extends keyof UserSettings>(k: K, v: UserSettings[K]) =>
    setSettings((prev) => ({ ...prev, [k]: v }));

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => {
      router.push("/compare");
    }, 800);
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1e40af", marginBottom: 4 }}>
          ⚙️ ユーザー設定
        </h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          還元率・クーポン・購入価格ラインを設定してください。設定後は自動的に価格比較画面へ移動します。
        </p>
      </div>

      {/* 購入価格ライン */}
      <div className="dq-card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="section-header">
          <span>💴</span>
          <h2>購入価格ライン</h2>
        </div>
        <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 6 }}>
          この金額以下なら「購入推奨」と判定します
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16, color: "#64748b" }}>¥</span>
          <input
            type="number"
            className="dq-input"
            value={settings.budget}
            onChange={(e) => set("budget", Number(e.target.value))}
            style={{ width: 160 }}
          />
        </div>
      </div>

      {/* 楽天設定 */}
      <div className="dq-card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="section-header">
          <span>🦅</span>
          <h2>楽天市場</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 6, fontWeight: 600 }}>
              ポイント還元率（%）
            </label>
            <input
              type="number"
              className="dq-input"
              value={settings.rakutenRate}
              step="0.5"
              min="0"
              max="30"
              onChange={(e) => set("rakutenRate", Number(e.target.value))}
            />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
              楽天カード利用時は通常3〜5%
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 6, fontWeight: 600 }}>
              クーポン割引額（円）
            </label>
            <input
              type="number"
              className="dq-input"
              value={settings.rakutenCoupon}
              step="100"
              min="0"
              onChange={(e) => set("rakutenCoupon", Number(e.target.value))}
            />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
              利用予定のクーポン金額
            </div>
          </div>
        </div>
      </div>

      {/* Yahoo!設定 */}
      <div className="dq-card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="section-header">
          <span>🛍️</span>
          <h2>Yahoo!ショッピング</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 6, fontWeight: 600 }}>
              ポイント還元率（%）
            </label>
            <input
              type="number"
              className="dq-input"
              value={settings.yahooRate}
              step="0.5"
              min="0"
              max="20"
              onChange={(e) => set("yahooRate", Number(e.target.value))}
            />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
              PayPayカード利用時は通常2〜3%
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 6, fontWeight: 600 }}>
              クーポン割引額（円）
            </label>
            <input
              type="number"
              className="dq-input"
              value={settings.yahooCoupon}
              step="100"
              min="0"
              onChange={(e) => set("yahooCoupon", Number(e.target.value))}
            />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
              利用予定のクーポン金額
            </div>
          </div>
        </div>
      </div>

      {/* 価格.com */}
      <div className="dq-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>📋 価格.com 比較を有効にする</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              価格.comの最安値を手動入力して3社比較できます
            </div>
          </div>
          <div
            onClick={() => set("kakakuEnabled", !settings.kakakuEnabled)}
            style={{
              width: 48,
              height: 26,
              borderRadius: 13,
              background: settings.kakakuEnabled ? "#1e40af" : "#e2e8f0",
              cursor: "pointer",
              position: "relative",
              transition: "all 0.2s",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 3,
                left: settings.kakakuEnabled ? 26 : 3,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                transition: "left 0.2s",
              }}
            />
          </div>
        </div>
      </div>

      {/* 保存ボタン */}
      {saved ? (
        <div
          style={{
            padding: "14px 20px",
            borderRadius: 10,
            background: "#d1fae5",
            border: "1px solid #6ee7b7",
            color: "#065f46",
            fontWeight: 700,
            fontSize: 14,
            textAlign: "center",
          }}
        >
          ✅ 保存完了！価格比較ページへ移動中… +5GP獲得！
        </div>
      ) : (
        <button className="btn-primary" onClick={handleSave} style={{ width: "100%", fontSize: 15 }}>
          💾 保存して価格比較へ →
        </button>
      )}
    </div>
  );
}
