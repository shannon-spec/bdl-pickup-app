import { useState } from "react";

// ── Brand tokens ────────────────────────────────────────────────────
const C = {
  bg:       "#0A0A0A",
  surface:  "#131313",
  surface2: "#1A1A1A",
  border:   "#232323",
  border2:  "#2A2A2A",
  chalk:    "#FAFAFA",
  gray:     "#777777",
  orange:   "#E87722",
};

// ── Score tier system ───────────────────────────────────────────────
const TIERS = [
  { name: "POOR",   min: 0,  max: 29,  color: "#ef4444", bgAlpha: "rgba(239,68,68,0.12)",  w: 30 },
  { name: "BELOW",  min: 30, max: 44,  color: "#f97316", bgAlpha: "rgba(249,115,22,0.12)", w: 15 },
  { name: "AVG",    min: 45, max: 64,  color: "#888888", bgAlpha: "rgba(136,136,136,0.12)",w: 20 },
  { name: "STRONG", min: 65, max: 79,  color: "#3b82f6", bgAlpha: "rgba(59,130,246,0.12)", w: 15 },
  { name: "ELITE",  min: 80, max: 100, color: "#22c55e", bgAlpha: "rgba(34,197,94,0.12)",  w: 20 },
];

function tierOf(score) {
  return TIERS.find((t) => score >= t.min && score <= t.max) ?? TIERS[2];
}

// ── Mock data (matches the user's YTD data) ─────────────────────────
const DATA = {
  avgScore:        51,
  lastScore:       67,
  bestScore:       89,
  games:           38,
  scoredGames:     36,
  avgStrain:       15.4,
  avgHr:           144,
  avgCal:          967,
  avgHighZoneMin:  13,
  avgHighZonePct:  17,
  strainW:         15.3,
  strainL:         15.5,
  wGames:          23,
  lGames:          13,
};

// ── Scale bar ───────────────────────────────────────────────────────
function ScaleBar({ score }) {
  const tier = tierOf(score);
  // needle: score maps directly to 0–100% along the bar
  const needlePct = score;

  return (
    <div style={{ width: "100%", userSelect: "none" }}>
      {/* Tier name labels */}
      <div style={{ display: "flex", marginBottom: 8 }}>
        {TIERS.map((t) => (
          <div
            key={t.name}
            style={{
              flex: t.w,
              textAlign: "center",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: "0.12em",
              color: t.name === tier.name ? t.color : C.gray,
              transition: "color 0.3s",
            }}
          >
            {t.name}
          </div>
        ))}
      </div>

      {/* Bar + needle */}
      <div style={{ position: "relative", paddingTop: 28 }}>
        {/* Needle */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${needlePct}%`,
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 800,
              fontSize: 11,
              color: tier.color,
              background: C.surface,
              border: `1px solid ${tier.color}`,
              borderRadius: 4,
              padding: "1px 7px",
              lineHeight: 1.5,
            }}
          >
            {score}
          </div>
          {/* Triangle */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: `7px solid ${tier.color}`,
            }}
          />
        </div>

        {/* Colored segments */}
        <div
          style={{
            display: "flex",
            height: 20,
            borderRadius: 6,
            overflow: "hidden",
            border: `1px solid ${C.border}`,
          }}
        >
          {TIERS.map((t) => (
            <div
              key={t.name}
              style={{
                flex: t.w,
                background: t.name === tier.name
                  ? t.color
                  : `${t.color}55`,
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>
      </div>

      {/* Range labels */}
      <div style={{ display: "flex", marginTop: 6 }}>
        {TIERS.map((t) => (
          <div
            key={t.name + "r"}
            style={{
              flex: t.w,
              textAlign: "center",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              fontSize: 9,
              color: t.name === tier.name ? t.color : "#444",
              letterSpacing: "0.04em",
            }}
          >
            {t.min}–{t.max}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Comparison chip ─────────────────────────────────────────────────
function ScoreChip({ label, score }) {
  const t = tierOf(score);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize: 9,
          letterSpacing: "0.14em",
          color: C.gray,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 800,
            fontSize: 30,
            color: t.color,
            lineHeight: 1,
          }}
        >
          {score}
        </span>
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            fontSize: 8,
            letterSpacing: "0.12em",
            color: t.color,
            opacity: 0.8,
            background: t.bgAlpha,
            padding: "2px 7px",
            borderRadius: 10,
          }}
        >
          {t.name}
        </span>
      </div>
    </div>
  );
}

// ── Stat block ──────────────────────────────────────────────────────
function StatBlock({ label, value, sub }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 7,
        padding: "0 12px",
      }}
    >
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize: 9,
          letterSpacing: "0.14em",
          color: C.gray,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 800,
          fontSize: 22,
          color: C.chalk,
          lineHeight: 1,
        }}
      >
        {value}
        {sub && (
          <span style={{ fontSize: 12, fontWeight: 600, color: C.gray, marginLeft: 4 }}>
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────
export default function WhoopScoreHero() {
  const [scope, setScope] = useState("league");
  const [range, setRange] = useState("ytd");

  const d = DATA;
  const avgTier = tierOf(d.avgScore);

  return (
    <div
      style={{
        padding: 24,
        background: C.bg,
        minHeight: "100vh",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@900&family=JetBrains+Mono:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          overflow: "hidden",
          maxWidth: 960,
          margin: "0 auto",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 24px",
            borderBottom: `1px solid ${C.border}`,
            background: C.bg,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Left */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 3, height: 14, background: C.orange, borderRadius: 2 }} />
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: "0.14em",
                color: C.chalk,
                textTransform: "uppercase",
              }}
            >
              WHOOP · BDL GAMES
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 20,
                fontSize: 10,
                fontWeight: 700,
                color: "#22c55e",
                letterSpacing: "0.08em",
              }}
            >
              <span style={{ fontSize: 7 }}>●</span> CONNECTED
            </div>
          </div>

          {/* Right controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Scope tabs */}
            <div
              style={{
                display: "flex",
                background: C.surface2,
                borderRadius: 20,
                padding: 2,
                border: `1px solid ${C.border}`,
              }}
            >
              {["league", "other"].map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 18,
                    border: "none",
                    background: scope === s ? C.surface : "transparent",
                    color: scope === s ? C.chalk : C.gray,
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 700,
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    boxShadow: scope === s ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {s === "league" ? "By League" : "All Other"}
                </button>
              ))}
            </div>

            {/* Range tabs */}
            <div
              style={{
                display: "flex",
                background: C.surface2,
                borderRadius: 20,
                padding: 2,
                border: `1px solid ${C.border}`,
              }}
            >
              {["mtd", "ytd"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 18,
                    border: "none",
                    background: range === r ? C.surface : "transparent",
                    color: range === r ? C.chalk : C.gray,
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 700,
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    boxShadow: range === r ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              style={{
                padding: "6px 14px",
                background: C.orange,
                border: "none",
                borderRadius: 8,
                color: C.chalk,
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                fontSize: 9,
                letterSpacing: "0.1em",
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              ↻ SYNC NOW
            </button>
          </div>
        </div>

        {/* ── Hero Score ── */}
        <div
          style={{
            position: "relative",
            padding: "52px 40px 48px",
            textAlign: "center",
            overflow: "hidden",
          }}
        >
          {/* Radial glow behind the number — tier color */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -60%)",
              width: 400,
              height: 400,
              background: `radial-gradient(circle, ${avgTier.color}22 0%, transparent 65%)`,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />

          {/* Content */}
          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Eye-brow label */}
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: "0.22em",
                color: C.gray,
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              BDL PERFORMANCE SCORE
            </div>

            {/* THE NUMBER */}
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 800,
                fontSize: 128,
                lineHeight: 1,
                color: avgTier.color,
                letterSpacing: "-0.04em",
                marginBottom: 12,
                textShadow: `0 0 80px ${avgTier.color}55`,
              }}
            >
              {d.avgScore}
            </div>

            {/* Tier badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 16px",
                background: avgTier.bgAlpha,
                border: `1px solid ${avgTier.color}44`,
                borderRadius: 20,
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: "0.12em",
                color: avgTier.color,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {avgTier.name}
            </div>

            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                fontSize: 12,
                color: C.gray,
                letterSpacing: "0.06em",
                marginBottom: 36,
              }}
            >
              Season average · {d.scoredGames} scored games
            </div>

            {/* AVG / LAST / BEST comparison row */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "stretch",
                background: C.surface2,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                overflow: "hidden",
                marginBottom: 48,
              }}
            >
              {[
                { label: "Season Avg", score: d.avgScore },
                { label: "Last Game",  score: d.lastScore },
                { label: "Season Best",score: d.bestScore },
              ].map((item, i) => (
                <div key={item.label} style={{ display: "flex" }}>
                  {i > 0 && (
                    <div style={{ width: 1, background: C.border, alignSelf: "stretch" }} />
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      padding: "16px 28px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 600,
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        color: C.gray,
                        textTransform: "uppercase",
                      }}
                    >
                      {item.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 800,
                        fontSize: 32,
                        color: tierOf(item.score).color,
                        lineHeight: 1,
                      }}
                    >
                      {item.score}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 700,
                        fontSize: 8,
                        letterSpacing: "0.1em",
                        color: tierOf(item.score).color,
                        background: tierOf(item.score).bgAlpha,
                        padding: "2px 8px",
                        borderRadius: 10,
                        textTransform: "uppercase",
                      }}
                    >
                      {tierOf(item.score).name}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Scale bar */}
            <ScaleBar score={d.avgScore} />
          </div>
        </div>

        {/* ── Secondary Stats ── */}
        <div
          style={{
            display: "flex",
            borderTop: `1px solid ${C.border}`,
            padding: "28px 0",
          }}
        >
          <StatBlock label="Avg Strain"     value="15.4" />
          <div style={{ width: 1, background: C.border }} />
          <StatBlock label="Avg HR"         value="144"  sub="bpm" />
          <div style={{ width: 1, background: C.border }} />
          <StatBlock label="Avg Calories"   value="967"  />
          <div style={{ width: 1, background: C.border }} />
          <StatBlock label="Avg Max Effort" value="13m"  sub="/ 17%" />
        </div>

        {/* ── W/L Strain ── */}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            padding: "0 24px 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 20px",
              background: C.surface2,
              border: `1px solid ${C.border}`,
              borderRadius: 24,
            }}
          >
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                fontSize: 9,
                letterSpacing: "0.14em",
                color: "#22c55e",
              }}
            >
              STRAIN W
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 800,
                fontSize: 16,
                color: C.chalk,
              }}
            >
              15.3
            </span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: C.gray }}>
              · 23 games
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 20px",
              background: C.surface2,
              border: `1px solid ${C.border}`,
              borderRadius: 24,
            }}
          >
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                fontSize: 9,
                letterSpacing: "0.14em",
                color: "#ef4444",
              }}
            >
              STRAIN L
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 800,
                fontSize: 16,
                color: C.chalk,
              }}
            >
              15.5
            </span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: C.gray }}>
              · 13 games
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
