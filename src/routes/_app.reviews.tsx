import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarRange, RefreshCw } from "lucide-react";
import {
  getMonthlyReview,
  getWeeklyReview,
  type MonthlyReviewPayload,
  type WeeklyReviewPayload,
} from "@/lib/life-coach.functions";
import { monthBounds, weekBounds } from "@/lib/lifeos";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/reviews")({
  head: () => ({ meta: [{ title: "Reviews — Forge" }] }),
  component: ReviewsPage,
});

function ReviewsPage() {
  const [tab, setTab] = useState<"weekly" | "monthly">("weekly");
  const [loading, setLoading] = useState(false);
  const [weekly, setWeekly] = useState<WeeklyReviewPayload | null>(null);
  const [monthly, setMonthly] = useState<MonthlyReviewPayload | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      if (tab === "weekly") {
        const w = weekBounds();
        setWeekly(await getWeeklyReview({ data: { start: w.start, end: w.end } }));
      } else {
        const m = monthBounds();
        setMonthly(await getMonthlyReview({ data: { start: m.start, end: m.end } }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-page-in">
      <header>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">GTD cadence</p>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CalendarRange className="h-6 w-6 text-warning" /> Reviews
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-2">
        {(["weekly", "monthly"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-xl border py-3 text-sm font-medium capitalize",
              tab === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <Button onClick={run} disabled={loading} className="w-full gap-2">
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        Generate {tab} review
      </Button>

      {tab === "weekly" && weekly && (
        <div className="space-y-3">
          <Score score={weekly.weeklyScore} label="Weekly score" />
          <Card title="Summary" body={weekly.summary} />
          <List title="Achievements" items={weekly.achievements} />
          <List title="Failures" items={weekly.failures} />
          <Card title="Time distribution" body={weekly.timeDistribution} />
          <Card title="Goal progress" body={weekly.goalProgress} />
          <Card title="Habit progress" body={weekly.habitProgress} />
          <List title="Missed opportunities" items={weekly.missedOpportunities} />
          <List title="Suggested improvements" items={weekly.improvements} />
        </div>
      )}

      {tab === "monthly" && monthly && (
        <div className="space-y-3">
          <Score score={monthly.monthlyScore} label="Monthly score" />
          <List title="Best achievements" items={monthly.bestAchievements} />
          <List title="Biggest mistakes" items={monthly.biggestMistakes} />
          <Card title="Productivity trends" body={monthly.productivityTrends} />
          <Card title="Habit consistency" body={monthly.habitConsistency} />
          <Card title="Goal completion" body={monthly.goalCompletion} />
          <Card title="Learning summary" body={monthly.learningSummary} />
          <Card title="Time allocation" body={monthly.timeAllocation} />
          <List title="AI recommendations" items={monthly.recommendations} />
        </div>
      )}
    </div>
  );
}

function Score({ score, label }: { score: number; label: string }) {
  return (
    <div className="rounded-2xl border border-border p-5 text-center" style={{ background: "var(--gradient-card)" }}>
      <p className="text-4xl font-bold text-primary">{score}</p>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm text-foreground">{body}</p>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-foreground">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
