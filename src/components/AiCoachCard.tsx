import { useEffect, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { getCoachInsight, type CoachInsight } from "@/lib/ai-coach";

export function AiCoachCard() {
  const [data, setData] = useState<CoachInsight | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getCoachInsight();
      setData(result);
    } catch {
      setData({
        insight: "Keep going — every rep matters.",
        suggestions: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border p-5"
      style={{ background: "var(--gradient-card)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">AI coach</p>
            <p className="text-sm font-semibold text-foreground">Today's nudge</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-full border border-border p-1.5 text-muted-foreground transition hover:text-foreground"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !data ? (
        <div className="mt-4 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ) : data ? (
        <>
          <p className="mt-3 text-sm font-medium italic text-foreground">"{data.insight}"</p>
          {data.suggestions.length > 0 && (
            <ul className="mt-4 space-y-2">
              {data.suggestions.map((s, i) => (
                <li key={i} className="rounded-xl border border-border bg-card/40 p-3">
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
