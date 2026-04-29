import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, AlertCircle } from "lucide-react";
import { getJournalWeeklySummary, type WeeklySummary } from "@/lib/journal-ai.functions";

export function WeeklyJournalSummary() {
  const [data, setData] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await getJournalWeeklySummary();
        if (active) setData(res);
      } catch {
        if (active)
          setData({
            summary: "Reflection unavailable right now.",
            highlight: null,
            caution: null,
            fromCache: false,
          });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-border p-5"
        style={{ background: "var(--gradient-card)" }}
      >
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Weekly reflection</h2>
        </div>
        <div className="space-y-2">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-4/5" />
          <div className="skeleton h-3 w-2/3" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      className="rounded-2xl border border-border p-5"
      style={{ background: "var(--gradient-card)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Weekly reflection</h2>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{data.summary}</p>
      {(data.highlight || data.caution) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.highlight && (
            <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/5 p-3">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <p className="text-xs text-foreground/85">{data.highlight}</p>
            </div>
          )}
          {data.caution && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-xs text-foreground/85">{data.caution}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
