import { RANK_TITLES, levelFromXp, rankInfo } from "@/lib/xp";

export function RankTrack({
  xp,
  weeklyXp,
  rankInCrew,
  totalMembers,
}: {
  xp: number;
  weeklyXp?: number;
  rankInCrew?: number | null;
  totalMembers?: number;
}) {
  const { level } = levelFromXp(xp);
  const { current, next } = rankInfo(level);
  const minCurrent = current.min;
  const minNext = next?.min ?? minCurrent;
  const span = Math.max(1, minNext - minCurrent);
  const into = Math.min(span, Math.max(0, level - minCurrent));
  const pct = next ? Math.round((into / span) * 100) : 100;
  const levelsToNext = next ? Math.max(0, minNext - level) : 0;

  return (
    <div
      className="overflow-hidden rounded-2xl border border-border p-4 animate-fade-in"
      style={{ background: "var(--gradient-card)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Crew rank
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span
              className="text-2xl font-bold text-foreground"
              style={{ textShadow: "0 0 18px color-mix(in oklab, var(--primary) 40%, transparent)" }}
            >
              {current.glyph} {current.title}
            </span>
            <span className="text-xs text-muted-foreground">Lv {level}</span>
          </div>
        </div>
        {rankInCrew && totalMembers ? (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Position</div>
            <div className="text-lg font-bold text-primary">
              #{rankInCrew}
              <span className="ml-0.5 text-xs text-muted-foreground">/{totalMembers}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Progress to next rank */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{current.title}</span>
          {next ? <span>{next.glyph} {next.title}</span> : <span>Max</span>}
        </div>
        <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-muted/40">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: `${pct}%`,
              background: "var(--gradient-primary)",
              boxShadow: "0 0 12px color-mix(in oklab, var(--primary) 60%, transparent)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 w-16 -translate-x-full opacity-60 animate-[shimmer_2.4s_linear_infinite]"
            style={{
              background:
                "linear-gradient(90deg, transparent, color-mix(in oklab, var(--primary) 35%, transparent), transparent)",
            }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Lv {minCurrent}</span>
          <span>
            {next
              ? `${levelsToNext} ${levelsToNext === 1 ? "level" : "levels"} to ${next.title}`
              : "Legend reached"}
          </span>
          <span>Lv {minNext}</span>
        </div>
      </div>

      {/* Tier ladder */}
      <div className="mt-4 grid grid-cols-12 gap-1">
        {RANK_TITLES.map((r) => {
          const reached = level >= r.min;
          const isCurrent = r.title === current.title;
          return (
            <div
              key={r.title}
              title={`${r.title} · Lv ${r.min}`}
              className={`group relative flex h-7 items-center justify-center rounded-md text-[11px] transition-all ${
                isCurrent
                  ? "scale-110 text-primary-foreground"
                  : reached
                    ? "text-primary"
                    : "text-muted-foreground/50"
              }`}
              style={
                isCurrent
                  ? { background: "var(--gradient-primary)", boxShadow: "0 0 14px color-mix(in oklab, var(--primary) 55%, transparent)" }
                  : reached
                    ? { background: "color-mix(in oklab, var(--primary) 14%, transparent)" }
                    : { background: "color-mix(in oklab, var(--muted) 60%, transparent)" }
              }
            >
              <span>{r.glyph}</span>
            </div>
          );
        })}
      </div>

      {typeof weeklyXp === "number" && (
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">This week in crew</span>
          <span className="font-semibold text-primary">+{weeklyXp} XP</span>
        </div>
      )}
    </div>
  );
}
