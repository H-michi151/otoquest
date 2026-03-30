"use client";
import { gameData } from "@/lib/mockData";
import { useState, useRef, useEffect } from "react";

const { player, leaderboard, battleHistory, monsters } = gameData;

type DamageEvent = { id: number; value: number; x: number; y: number; color: string };
type BattlePhase = "idle" | "select" | "casting" | "monster_hit" | "monster_attack" | "player_hit" | "won" | "lost";

const spellEffects: Record<string, { color: string; overlay: string; text: string }> = {
  fire:      { color: "#ef4444", overlay: "rgba(239,68,68,0.18)",   text: "🔥" },
  ice:       { color: "#60a5fa", overlay: "rgba(96,165,250,0.18)",  text: "❄️" },
  lightning: { color: "#facc15", overlay: "rgba(250,204,21,0.22)",  text: "⚡" },
  heal:      { color: "#22c55e", overlay: "rgba(34,197,94,0.15)",   text: "💚" },
};

export default function GuildPage() {
  const [tab, setTab] = useState<"status" | "battle" | "ranking">("status");

  // Battle state
  const [phase, setPhase] = useState<BattlePhase>("idle");
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [currentMonster, setCurrentMonster] = useState(monsters[0]);
  const [monsterHp, setMonsterHp] = useState(monsters[0].hp);
  const [playerHp, setPlayerHp] = useState(player.savemon.hp);
  const [playerMp, setPlayerMp] = useState(player.savemon.mp);
  const [damages, setDamages] = useState<DamageEvent[]>([]);
  const [activeSpell, setActiveSpell] = useState<string | null>(null);
  const [monsterShake, setMonsterShake] = useState(false);
  const [playerShake, setPlayerShake] = useState(false);
  const [victoryAnim, setVictoryAnim] = useState(false);
  const dmgIdRef = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  const gpPct  = Math.round((player.dailyGp / player.dailyGpLimit) * 100);
  const hpPct  = Math.round((playerHp / player.savemon.maxHp) * 100);
  const mpPct  = Math.round((playerMp / player.savemon.maxMp) * 100);
  const mhpPct = Math.round((monsterHp / currentMonster.hp) * 100);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [battleLog]);

  const addLog = (line: string) => setBattleLog((l) => [...l, line]);

  const spawnDamage = (value: number, x: number, y: number, color: string) => {
    const id = ++dmgIdRef.current;
    setDamages((d) => [...d, { id, value, x, y, color }]);
    setTimeout(() => setDamages((d) => d.filter((e) => e.id !== id)), 1300);
  };

  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const castSkill = async (skill: typeof player.skills[0]) => {
    if (phase !== "select" || playerMp < skill.mp) return;
    setPhase("casting");
    setActiveSpell(skill.element ?? "fire");
    setPlayerMp((m) => m - skill.mp);
    addLog(`${player.name} は ${skill.name} を唱えた！`);

    await delay(400);
    const dmg = Math.floor(Math.random() * 60 + 80);
    setMonsterShake(true);
    setTimeout(() => setMonsterShake(false), 500);
    spawnDamage(dmg, 60, 20, spellEffects[skill.element ?? "fire"].color);
    await delay(250);
    setActiveSpell(null);

    if (skill.element === "heal") {
      const healed = Math.min(player.savemon.maxHp - playerHp, 80);
      setPlayerHp((h) => Math.min(player.savemon.maxHp, h + healed));
      addLog(`HPが ${healed} 回復した！`);
      setPhase("select");
      return;
    }

    const newMHp = Math.max(0, monsterHp - dmg);
    setMonsterHp(newMHp);
    addLog(`${currentMonster.name} に ${dmg} のダメージ！`);
    await delay(300);

    if (newMHp <= 0) {
      addLog(`${currentMonster.name} を倒した！`);
      addLog(`経験値 ${currentMonster.xp} GP + ${currentMonster.gp} GP 獲得！`);
      setVictoryAnim(true);
      setPhase("won");
      return;
    }

    // Monster counter-attack
    setPhase("monster_attack");
    await delay(500);
    addLog(`${currentMonster.name} の こうげき！`);
    const mDmg = Math.floor(Math.random() * 20 + 15);
    setPlayerShake(true);
    setTimeout(() => setPlayerShake(false), 500);
    spawnDamage(mDmg, 30, 60, "#ef4444");
    const newPHp = Math.max(0, playerHp - mDmg);
    setPlayerHp(newPHp);
    addLog(`${player.name} は ${mDmg} のダメージを受けた！`);
    await delay(400);

    if (newPHp <= 0) {
      addLog("　${player.name} は 倒れてしまった...");
      setPhase("lost");
    } else {
      setPhase("select");
    }
  };

  const startBattle = (monster: typeof monsters[0]) => {
    setCurrentMonster(monster);
    setMonsterHp(monster.hp);
    setPlayerHp(player.savemon.hp);
    setPlayerMp(player.savemon.mp);
    setBattleLog([`${monster.name} が あらわれた！`]);
    setVictoryAnim(false);
    setPhase("select");
  };

  const endBattle = () => {
    setPhase("idle");
    setBattleLog([]);
    setVictoryAnim(false);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* ページタイトル */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1e40af", marginBottom: 4 }}>
          🏚️ モンスターハウス — 勇者たちの試練の場
        </h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          購入最適化で得たGPを使って強力なモンスターを倒し、勇者としての称号を手に入れよう！
        </p>
        <div
          style={{
            marginTop: 8,
            padding: "5px 12px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 6,
            display: "inline-block",
            fontSize: 11,
            color: "#1d4ed8",
          }}
        >
          💡 GPは購入最適化（キャンペーン・最安値購入等）で獲得できます
        </div>
      </div>

      {/* タブ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { id: "status",  label: "🧙‍♂️ 冒険者情報" },
          { id: "battle",  label: "⚔️ バトル" },
          { id: "ranking", label: "🏆 ランキング" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: tab === t.id ? "2px solid #1e40af" : "1px solid #e2e8f0",
              background: tab === t.id ? "#1e40af" : "white",
              color: tab === t.id ? "white" : "#374151",
              fontWeight: tab === t.id ? 700 : 400,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ========== 冒険者情報タブ ========== */}
      {tab === "status" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 }}>
          {/* キャラクターカード */}
          <div className="dq-card dq-card-gold" style={{ padding: 24 }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 88 }}>{player.savemon.emoji}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#1e40af", marginTop: 6 }}>
                {player.savemon.name}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Lv.{player.savemon.level}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{player.savemon.evolution}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
              {[
                { label: "こうげき力", value: player.savemon.attack, color: "#dc2626" },
                { label: "しゅび力",   value: player.savemon.defense, color: "#2563eb" },
                { label: "すばやさ",   value: player.savemon.speed,   color: "#d97706" },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center", padding: 8, background: "rgba(255,255,255,0.7)", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 9, color: "#64748b" }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            {/* HP */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={{ fontWeight: 700 }}>HP</span>
                <span style={{ color: "#64748b" }}>{player.savemon.hp} / {player.savemon.maxHp}</span>
              </div>
              <div className="hp-bar"><div className="hp-bar-fill" style={{ width: `${hpPct}%` }} /></div>
            </div>
            {/* MP */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={{ fontWeight: 700 }}>MP</span>
                <span style={{ color: "#64748b" }}>{player.savemon.mp} / {player.savemon.maxMp}</span>
              </div>
              <div className="hp-bar"><div className="mp-bar-fill" style={{ width: `${mpPct}%` }} /></div>
            </div>
            {/* GP */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={{ fontWeight: 700, color: "#d97706" }}>⚔️ 今日のGP</span>
                <span style={{ color: "#64748b" }}>{player.dailyGp} / {player.dailyGpLimit}</span>
              </div>
              <div className="hp-bar"><div className="gp-bar-fill" style={{ width: `${gpPct}%` }} /></div>
            </div>
          </div>

          {/* 右側 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* プレイヤー情報 */}
            <div className="dq-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 36 }}>{player.classEmoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{player.name}</div>
                  <div style={{ fontSize: 12, color: "#d97706", fontWeight: 600 }}>{player.class} · {player.league}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#d97706" }}>{player.gp.toLocaleString()} GP</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>通算</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12, fontSize: 11, textAlign: "center" }}>
                <div><div style={{ color: "#64748b" }}>勝率</div><div style={{ fontWeight: 700, color: "#059669" }}>{player.winRate}%</div></div>
                <div><div style={{ color: "#64748b" }}>総バトル</div><div style={{ fontWeight: 700 }}>{player.totalBattles}</div></div>
                <div><div style={{ color: "#64748b" }}>ランク</div><div style={{ fontWeight: 700, color: "#d97706" }}>#{player.rank}</div></div>
              </div>
            </div>

            {/* 呪文・特技 */}
            <div className="dq-card" style={{ padding: 16 }}>
              <div className="section-header"><span>✨</span><h2>おぼえている呪文・特技</h2></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {player.skills.map((skill) => (
                  <div key={skill.name} style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 16 }}>{skill.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{skill.name}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "#2563eb", fontWeight: 600 }}>MP{skill.mp}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, lineHeight: 1.4 }}>{skill.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 装備 */}
            <div className="dq-card" style={{ padding: 16 }}>
              <div className="section-header"><span>🛡️</span><h2>装備</h2></div>
              {Object.values(player.equipment).map((eq, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < 2 ? "1px solid #f1f5f9" : "none" }}>
                  <span style={{ fontSize: 18 }}>{eq.emoji}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{eq.name}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{eq.bonus}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* バトル履歴 */}
            <div className="dq-card" style={{ padding: 16 }}>
              <div className="section-header"><span>📜</span><h2>最近のバトル</h2></div>
              {battleHistory.map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < battleHistory.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                  <span style={{ fontSize: 18 }}>{b.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#1e293b" }}>{b.opponent}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{b.date}</div>
                  </div>
                  <span className={b.result === "win" ? "badge-green" : "badge-red"}>
                    {b.result === "win" ? "WIN" : "LOSS"}
                  </span>
                  {b.gpGained > 0 && (
                    <span style={{ fontSize: 11, color: "#d97706", fontWeight: 700 }}>+{b.gpGained}GP</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========== バトルタブ ========== */}
      {tab === "battle" && (
        <div>
          {/* モンスター選択 */}
          {phase === "idle" && (
            <div>
              <div className="section-header"><span>🏚️</span><h2>モンスターを選んで戦え！</h2></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 24 }}>
                {monsters.map((m) => (
                  <div
                    key={m.name}
                    className="dq-card"
                    style={{ padding: 16, textAlign: "center", cursor: "pointer" }}
                    onClick={() => startBattle(m)}
                  >
                    <div style={{ fontSize: 44 }}>{m.emoji}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginTop: 8 }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>Lv.{m.level}</div>
                    <div style={{ fontSize: 11, color: "#059669", marginTop: 4 }}>+{m.gp}GP</div>
                    <button
                      className="btn-primary"
                      style={{ marginTop: 10, width: "100%", fontSize: 12, padding: "6px 0" }}
                      onClick={(e) => { e.stopPropagation(); startBattle(m); }}
                    >
                      たたかう
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* バトル画面 */}
          {phase !== "idle" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* 左：バトルフィールド */}
              <div>
                <div
                  className="dq-card"
                  style={{
                    padding: 0,
                    overflow: "hidden",
                    position: "relative",
                    background: "linear-gradient(180deg, #1e3a8a 0%, #1e40af 40%, #065f46 100%)",
                    minHeight: 320,
                  }}
                >
                  {/* スペルオーバーレイ */}
                  {activeSpell && (
                    <div
                      className="spell-overlay"
                      style={{ background: spellEffects[activeSpell].overlay }}
                    />
                  )}

                  {/* ダメージ浮上テキスト */}
                  {damages.map((d) => (
                    <div
                      key={d.id}
                      className="damage-number"
                      style={{ color: d.color, left: `${d.x}%`, top: `${d.y}%` }}
                    >
                      {d.value}
                    </div>
                  ))}

                  {/* 勝利エフェクト */}
                  {victoryAnim && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30 }}>
                      <div
                        className="victory-burst"
                        style={{ fontSize: 80, filter: "drop-shadow(0 0 20px gold)" }}
                      >
                        🏆
                      </div>
                    </div>
                  )}

                  {/* 敵モンスター */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", padding: "20px 28px 0", position: "relative" }}>
                    <div style={{ textAlign: "right", marginBottom: 4 }}>
                      <div style={{ fontSize: 11, color: "#93c5fd", fontWeight: 600 }}>{currentMonster.name} (Lv.{currentMonster.level})</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: "#93c5fd" }}>HP</span>
                        <div style={{ width: 80, height: 8, background: "rgba(0,0,0,0.4)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${mhpPct}%`, height: "100%", background: mhpPct > 50 ? "#22c55e" : mhpPct > 25 ? "#fbbf24" : "#ef4444", borderRadius: 4, transition: "width 0.4s" }} />
                        </div>
                        <span style={{ fontSize: 10, color: "white" }}>{monsterHp}/{currentMonster.hp}</span>
                      </div>
                    </div>
                    <div
                      className={`battle-monster ${monsterShake ? "animate-shake" : ""}`}
                      style={{
                        fontSize: 80,
                        filter: phase === "won" ? "brightness(0)" : undefined,
                        opacity: phase === "won" ? 0.2 : 1,
                        transition: "opacity 0.5s",
                      }}
                    >
                      {currentMonster.emoji}
                    </div>
                  </div>

                  {/* 自キャラ */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "8px 28px 20px", position: "relative" }}>
                    <div
                      className={playerShake ? "animate-shake" : ""}
                      style={{ fontSize: 60 }}
                    >
                      {player.classEmoji}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontSize: 11, color: "#a7f3d0", fontWeight: 600 }}>{player.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: "#a7f3d0" }}>HP</span>
                        <div style={{ width: 80, height: 8, background: "rgba(0,0,0,0.4)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${Math.round(playerHp / player.savemon.maxHp * 100)}%`, height: "100%", background: playerHp > 100 ? "#22c55e" : playerHp > 50 ? "#fbbf24" : "#ef4444", borderRadius: 4, transition: "width 0.4s" }} />
                        </div>
                        <span style={{ fontSize: 10, color: "white" }}>{playerHp}/{player.savemon.maxHp}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 10, color: "#93c5fd" }}>MP</span>
                        <div style={{ width: 80, height: 5, background: "rgba(0,0,0,0.4)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${Math.round(playerMp / player.savemon.maxMp * 100)}%`, height: "100%", background: "#60a5fa", borderRadius: 3, transition: "width 0.4s" }} />
                        </div>
                        <span style={{ fontSize: 10, color: "white" }}>{playerMp}/{player.savemon.maxMp}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* コマンド */}
                {phase === "select" && (
                  <div className="dq-card animate-fade-in" style={{ padding: 16, marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                      ▼ コマンド
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {player.skills.map((skill) => (
                        <button
                          key={skill.name}
                          className="btn-secondary"
                          onClick={() => castSkill(skill)}
                          disabled={playerMp < skill.mp}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 12px",
                            opacity: playerMp < skill.mp ? 0.4 : 1,
                            fontFamily: "'Noto Sans JP', sans-serif",
                          }}
                        >
                          <span style={{ fontSize: 18 }}>{skill.emoji}</span>
                          <div style={{ textAlign: "left" }}>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{skill.name}</div>
                            <div style={{ fontSize: 10, color: "#94a3b8" }}>MP {skill.mp}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {phase === "casting" && (
                  <div className="dq-card animate-fade-in" style={{ padding: 14, marginTop: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 22 }}>
                      {activeSpell ? spellEffects[activeSpell].text : "⚡"}
                    </div>
                    <div style={{ fontSize: 13, color: "#374151" }}>呪文詠唱中...</div>
                  </div>
                )}

                {(phase === "won" || phase === "lost") && (
                  <div
                    className="dq-card animate-bounce-in"
                    style={{
                      padding: 20,
                      marginTop: 8,
                      textAlign: "center",
                      background: phase === "won" ? "#f0fdf4" : "#fff5f5",
                      border: `1px solid ${phase === "won" ? "#86efac" : "#fca5a5"}`,
                    }}
                  >
                    <div style={{ fontSize: 36 }}>{phase === "won" ? "🏆" : "💀"}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: phase === "won" ? "#059669" : "#dc2626", marginTop: 6 }}>
                      {phase === "won" ? "しょうり！" : "やられてしまった..."}
                    </div>
                    {phase === "won" && (
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                        +{currentMonster.xp} EXP&nbsp;·&nbsp;+{currentMonster.gp} GP 獲得
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
                      <button className="btn-primary" onClick={endBattle}>
                        モンスター選択へ
                      </button>
                      {phase === "won" && (
                        <button className="btn-secondary" onClick={() => startBattle(currentMonster)}>
                          もう一度たたかう
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 右：バトルログ */}
              <div className="dq-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: 13, color: "#374151" }}>
                  📜 バトルログ
                </div>
                <div
                  ref={logRef}
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "12px 16px",
                    fontFamily: "monospace",
                    fontSize: 13,
                    lineHeight: 2,
                    background: "#fafafa",
                    minHeight: 280,
                    maxHeight: 400,
                  }}
                >
                  {battleLog.map((line, i) => (
                    <div
                      key={i}
                      className="animate-fade-in"
                      style={{
                        color: line.includes("ダメージ") && !line.includes("受けた")
                          ? "#dc2626"
                          : line.includes("受けた")
                          ? "#d97706"
                          : line.includes("回復")
                          ? "#059669"
                          : line.includes("倒した") || line.includes("ひっさつ") || line.includes("しょうり")
                          ? "#1e40af"
                          : "#374151",
                        fontWeight: line.includes("倒した") || line.includes("しょうり") ? 700 : 400,
                      }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== ランキングタブ ========== */}
      {tab === "ranking" && (
        <div className="dq-card" style={{ padding: 24 }}>
          <div className="section-header"><span>🏆</span><h2>モンスターハウス ランキング</h2></div>
          {leaderboard.map((entry) => (
            <div
              key={entry.rank}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 12px",
                marginBottom: 8,
                borderRadius: 10,
                background: entry.isMe ? "#eff6ff" : "#fafafa",
                border: entry.isMe ? "2px solid #1e40af" : "1px solid #f1f5f9",
              }}
            >
              <div
                style={{
                  width: 36, height: 36,
                  borderRadius: "50%",
                  background:
                    entry.rank === 1 ? "linear-gradient(135deg,#fbbf24,#d97706)" :
                    entry.rank === 2 ? "linear-gradient(135deg,#94a3b8,#64748b)" :
                    entry.rank === 3 ? "linear-gradient(135deg,#b45309,#92400e)" : "#f1f5f9",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 900,
                  color: entry.rank <= 3 ? "white" : "#64748b",
                  flexShrink: 0,
                }}
              >
                {entry.rank}
              </div>
              <span style={{ fontSize: 26 }}>{entry.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: entry.isMe ? 700 : 500, color: entry.isMe ? "#1e40af" : "#1e293b" }}>
                    {entry.name}
                  </span>
                  {entry.isMe && <span className="badge-blue">あなた</span>}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                  Lv.{entry.level}&nbsp;{entry.class}&nbsp;·&nbsp;{entry.league}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#d97706" }}>
                  {entry.totalGp.toLocaleString()} GP
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
