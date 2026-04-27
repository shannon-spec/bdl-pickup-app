import Link from "next/link";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import {
  GRADES,
  gradesFor,
  type GradeKey,
  type RatingContext,
} from "@/components/bdl/rating-key/copy";
import { ratingKeyStyles } from "@/components/bdl/rating-key/styles";
import { Pill } from "@/components/bdl/pill";

const TONE: Record<GradeKey, "neutral" | "brand" | "win" | "loss"> = {
  "Not Rated": "neutral",
  Novice: "neutral",
  Intermediate: "neutral",
  Advanced: "win",
  "Game Changer": "brand",
  Pro: "brand",
};

export const dynamic = "force-dynamic";
export const metadata = { title: "Grades · BDL" };

const ALL_GRADES: GradeKey[] = [
  "Not Rated",
  "Novice",
  "Intermediate",
  "Advanced",
  "Game Changer",
  "Pro",
];

function parseContext(raw?: string): RatingContext {
  return raw === "league" ? "league" : "player";
}

function parseGrade(raw?: string): GradeKey | null {
  if (!raw) return null;
  const decoded = decodeURIComponent(raw);
  return ALL_GRADES.includes(decoded as GradeKey)
    ? (decoded as GradeKey)
    : null;
}

export default async function GradesPage({
  searchParams,
}: {
  searchParams: Promise<{ context?: string; grade?: string }>;
}) {
  const sp = await searchParams;
  const context = parseContext(sp.context);
  const highlight = parseGrade(sp.grade);
  const grades = gradesFor(context);

  return (
    <>
      <TopBar active="/grades" />
      <PageFrame>
        <ContextHeader />

        <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

        <div className="rk-page">
          <header className="rk-page-header">
            <div className="rk-titles">
              <div className="rk-subtitle">
                Pickup Skill Tiers //{" "}
                {context === "player" ? "Players" : "Leagues"}
              </div>
              <h1 className="rk-title">Grades</h1>
              <p className="rk-blurb">
                Six tiers, applied to both players and leagues. Pick a tab to
                read the version that matters for your context.
              </p>
            </div>
          </header>

          <div className="rk-tabs" role="tablist">
            <Tab
              label="Players"
              active={context === "player"}
              hrefSearch={
                highlight
                  ? `?context=player&grade=${encodeURIComponent(highlight)}`
                  : "?context=player"
              }
            />
            <Tab
              label="Leagues"
              active={context === "league"}
              hrefSearch={
                highlight
                  ? `?context=league&grade=${encodeURIComponent(highlight)}`
                  : "?context=league"
              }
            />
          </div>

          <ul className="rk-rows" role="list">
            {GRADES.map((g) => {
              const def = grades[g];
              const active = g === highlight;
              return (
                <li
                  key={g}
                  id={`grade-${slug(g)}`}
                  className={`rk-row ${active ? "rk-row-active" : ""}`}
                  aria-current={active ? "true" : undefined}
                >
                  <div className="rk-label">
                    <Pill tone={TONE[g]}>{def.key}</Pill>
                  </div>
                  <p
                    className="rk-desc"
                    dangerouslySetInnerHTML={{ __html: def.bodyHtml }}
                  />
                </li>
              );
            })}
          </ul>

          <div className="rk-bottom">
            <Link href="/about" className="rk-secondary-link">
              About BDL →
            </Link>
          </div>
        </div>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}

function Tab({
  label,
  active,
  hrefSearch,
}: {
  label: string;
  active: boolean;
  hrefSearch: string;
}) {
  return (
    <Link
      href={`/grades${hrefSearch}`}
      role="tab"
      aria-selected={active}
      className={`rk-tab ${active ? "rk-tab-active" : ""}`}
      scroll={false}
    >
      {label}
    </Link>
  );
}

const slug = (g: GradeKey) => g.toLowerCase().replace(/\s+/g, "-");

const pageStyles = `
  ${ratingKeyStyles}

  .rk-page {
    --bdl-orange: #E87722;
    --court-black: #0A0A0A;
    --chalk: #FAFAFA;
    --stat-gray: #777777;
    --rk-surface: var(--surface);
    --rk-border: var(--hairline-2);
    color: var(--text);
    font-family: var(--font), -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--surface);
    border: 1px solid var(--hairline-2);
    border-radius: 16px;
    overflow: hidden;
  }
  .rk-page .rk-title {
    color: var(--text);
  }
  .rk-page .rk-subtitle {
    color: var(--text-3);
  }
  .rk-page .rk-grade-name {
    color: var(--text);
  }
  .rk-page .rk-desc {
    color: var(--text-2);
  }
  .rk-page .rk-row-active .rk-desc {
    color: var(--text);
  }
  .rk-page .rk-desc strong {
    color: var(--text);
    font-weight: 600;
  }
  .rk-page .rk-tab {
    text-decoration: none;
  }
  .rk-page .rk-tab:not(.rk-tab-active) {
    color: var(--text-3);
  }
  .rk-page .rk-tab:not(.rk-tab-active):hover {
    color: var(--text);
  }
  .rk-page .rk-row {
    border-top: 1px solid var(--hairline);
  }
  .rk-page-header {
    padding: 28px 28px 8px;
  }
  .rk-page .rk-tabs {
    margin: 16px 28px 4px;
    background: var(--surface-2);
    border: 1px solid var(--hairline-2);
  }
  .rk-page .rk-rows {
    padding: 0 28px 8px;
  }
  .rk-page .rk-row-active {
    background: rgba(232,119,34,0.08);
  }
  .rk-page .rk-blurb {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--text-3);
    max-width: 56ch;
    line-height: 1.55;
  }
  .rk-bottom {
    padding: 14px 28px 22px;
    border-top: 1px solid var(--hairline);
  }
  .rk-secondary-link {
    font-size: 13px;
    color: var(--text-3);
    text-decoration: none;
  }
  .rk-secondary-link:hover { color: var(--text); }

  @media (max-width: 600px) {
    .rk-page-header { padding: 22px 18px 6px; }
    .rk-page .rk-tabs { margin: 14px 18px 4px; }
    .rk-page .rk-rows { padding: 0 18px 8px; }
    .rk-bottom { padding: 14px 18px 22px; }
    .rk-page .rk-row {
      grid-template-columns: 1fr;
      gap: 8px;
    }
  }
`;
