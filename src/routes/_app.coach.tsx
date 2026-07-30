import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { getEveningCoach, type EveningCoachReport, type TimeIntelligence } from "@/lib/life-coach.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/coach")({
  head: () => ({ meta: [{ title: "AI Life Coach — Forge" }] }),
  component: CoachPage,
});

const QUESTIONS: { key: keyof EveningCoachReport; label: string }[] = [
  { key: "wentWell", label: "What went well today?" },
  { key: "wentWrong", label: "What went wrong?" },
  { key: "biggestDistraction", label: "Biggest distraction?" },
  { key: "biggestAchievement", label: "Biggest achievement?" },
  { key: "improveTomorrow", label: "What should be improved tomorrow?" },
  { key: "slippingHabits", label: "What habits are slipping?" },
  { key: "goalAlignment", label: "Did today's work align with long-term goals?" },
  { key: "focusTomorrow", label: "What's one thing to focus on tomorrow?" },
];

function CoachPage() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<(EveningCoachReport & { timeIntel: TimeIntelligence }) | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const res = await getEveningCoach({ data: { day: new Date().toISOString().slice(0, 10) } });
      setReport(res);
    } catch (e: any) {
      setReport(null);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-page-in">
      <header>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Evening ritual</p>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" /> AI Life Coach
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every evening: reflection, alignment, and one clear focus for tomorrow.
        </p>
      </header>

      <Button onClick={run} disabled={loading} className="w-full gap-2">
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Coaching…" : report ? "Refresh tonight's review" : "Run evening review"}
      </Button>

      {report?.contributionNote && (
        <div
          className="rounded-2xl border border-primary/40 p-4"
          style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-glow)" }}
        >
          <p className="text-[10px] uppercase tracking-wider text-primary">Goal contribution</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{report.contributionNote}</p>
        </div>
      )}

      {report?.timeIntel && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Deep work" value={`${report.timeIntel.deepMinutes}m`} />
          <Stat label="Shallow" value={`${report.timeIntel.shallowMinutes}m`} />
          <Stat label="Interruptions" value={`${report.timeIntel.interruptions}`} />
          <Stat label="Best window" value={report.timeIntel.productiveWindow} />
        </div>
      )}

      {report && (
        <ul className="space-y-3">
          {QUESTIONS.map((q) => (
            <li key={q.key} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{q.label}</p>
              <p className="mt-1 text-sm text-foreground">{String(report[q.key] ?? "—")}</p>
            </li>
          ))}
        </ul>
      )}

      {report && (
        <p className="text-center text-xs text-muted-foreground">
          {report.fromAI ? "Personalized with your memory & today's data" : "Heuristic coaching (AI gateway offline)"}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <p className="text-sm font-semibold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
