import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookHeart, RefreshCw } from "lucide-react";
import { lifeFrom } from "@/lib/lifeos-db";
import { refreshOperatingManual } from "@/lib/life-coach.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/manual")({
  head: () => ({ meta: [{ title: "Operating Manual — Forge" }] }),
  component: ManualPage,
});

type Insight = { id: string; insight: string; confidence: number; evidence_count: number; updated_at: string };

function ManualPage() {
  const [rows, setRows] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await lifeFrom("operating_manual")
      .select("*")
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(40);
    setRows((data as Insight[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      await refreshOperatingManual({ data: {} });
      await load();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-page-in">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BookHeart className="h-6 w-6 text-accent" /> Personal Operating Manual
        </h1>
        <p className="text-sm text-muted-foreground">
          A living user manual for your life — patterns the AI learns from your data.
        </p>
      </header>

      <Button onClick={refresh} disabled={loading} className="w-full gap-2">
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        Refresh from last 30 days
      </Button>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm text-foreground">{r.insight}</p>
            <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              confidence {Math.round(r.confidence * 100)}% · evidence {r.evidence_count}
            </p>
          </li>
        ))}
        {!rows.length && (
          <p className="text-center text-sm text-muted-foreground">No insights yet — generate your first manual.</p>
        )}
      </ul>
    </div>
  );
}
