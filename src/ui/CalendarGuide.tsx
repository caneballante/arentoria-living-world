/** The season guide: every month in order, grouped by season, with "now" marked. Presentational only. */
import type { CalendarGuide as Guide } from "./types";

const SEASON_LABEL = { winter: "Winter", spring: "Spring", summer: "Summer", autumn: "Autumn" } as const;
const ORDINAL = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

export function CalendarGuide({ guide, compact = false }: { guide: Guide; compact?: boolean }) {
  // Group consecutive slots that share a season (winter appears at both ends of the year).
  const groups: { season: Guide["slots"][number]["season"]; slots: Guide["slots"] }[] = [];
  for (const s of guide.slots) {
    const last = groups[groups.length - 1];
    if (last && last.season === s.season) last.slots.push(s);
    else groups.push({ season: s.season, slots: [s] });
  }
  const c = guide.current;
  return (
    <div className={`calendar-guide${compact ? " compact" : ""}`} aria-label="Where we are in the year">
      <div className="cg-seasons">
        {groups.map((g, i) => (
          <div key={i} className={`cg-season cg-${g.season}`}>
            <div className="cg-season-name">{SEASON_LABEL[g.season]}</div>
            <ol className="cg-months">
              {g.slots.map((s) => (
                <li key={s.name} className={`${s.current ? "cg-now" : ""}${s.covered && !s.current ? " cg-covered" : ""}${s.kind === "intercalary" ? " cg-intercalary" : ""}`} title={`${s.name}${s.number ? ` (month ${s.number})` : ""}: ${s.character}${s.festivals.length ? `. ${s.festivals.join(", ")}` : ""}`}>
                  <span className="cg-num">{s.number ?? "·"}</span>
                  <span className="cg-name">
                    {s.name}
                    {s.festivals.length > 0 && <span className="cg-fest" aria-label="citywide festival"> ✦</span>}
                  </span>
                  {s.current && <span className="cg-tag">now · day {c.day}</span>}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="cg-caption">
        <strong>{c.name}</strong>
        {c.number ? `, the ${ORDINAL(c.number)} of 13 months` : ""} ({SEASON_LABEL[c.season].toLowerCase()}, {guide.year} CY): {c.character.charAt(0).toLowerCase() + c.character.slice(1)}.
        {guide.next ? ` Next: ${guide.next.name}, ${guide.next.character.charAt(0).toLowerCase() + guide.next.character.slice(1)}.` : ""}
        <span className="cg-legend"> ✦ citywide festival</span>
      </p>
    </div>
  );
}
