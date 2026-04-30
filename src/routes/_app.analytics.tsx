import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Sparkles, TrendingUp, Smile } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Forge" }] }),
  component: AnalyticsPage,
});

type LedgerRow = { amount: number; kind: string; occurred_on: string };
type Mood = { entry_date: string; mood: number | null };

const KIND_LABEL: Record<string, string> = {
  habit_checkin: "Habits",
  task: "Quests",
  planner: "Planner",
  journal: "Journal",
};

const KIND_COLOR: Record<string, string> = {
  habit_checkin: "var(--warning)",
  task: "var(--accent)",
  planner: "var(--primary)",
  journal: "var(--success)",
};

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function lastNDays(n: number) {
  const out: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(isoDay(d));
  }
  return out;
}

function AnalyticsPage() {
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [habitTotal, setHabitTotal] = useState(0);
  const [habitCheckins7, setHabitCheckins7] = useState(0);
  const [tasksCompleted7, setTasksCompleted7] = useState(0);
  const [tasksCreated7, setTasksCreated7] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const since7 = new Date();
      since7.setDate(since7.getDate() - 6);
      const sinceISO = isoDay(since7);

      const [ledgerRes, moodRes, habitsRes, checkRes, tasksDoneRes, tasksMadeRes] =
        await Promise.all([
          supabase
            .from("xp_ledger")
            .select("amount,kind,occurred_on")
            .gte("occurred_on", sinceISO),
          supabase
            .from("journal_entries")
            .select("entry_date,mood")
            .gte("entry_date", sinceISO),
          supabase.from("habits").select("id").eq("archived", false),
          supabase
            .from("habit_checkins")
            .select("id", { count: "exact", head: true })
            .gte("completed_on", sinceISO),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("completed", true)
            .gte("completed_at", `${sinceISO}T00:00:00Z`),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .gte("created_at", `${sinceISO}T00:00:00Z`),
        ]);

      if (!active) return;
      setLedger(ledgerRes.data ?? []);
      setMoods((moodRes.data ?? []).filter((m) => m.mood != null));
      setHabitTotal((habitsRes.data ?? []).length);
      setHabitCheckins7(checkRes.count ?? 0);
      setTasksCompleted7(tasksDoneRes.count ?? 0);
      setTasksCreated7(tasksMadeRes.count ?? 0);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const days = useMemo(() => lastNDays(7), []);

  const xpByDay = useMemo(() => {
    const map: Record<string, number> = {};
    days.forEach((d) => (map[d] = 0));
    for (const r of ledger) map[r.occurred_on] = (map[r.occurred_on] ?? 0) + r.amount;
    return days.map((d) => ({ day: d, xp: map[d] ?? 0 }));
  }, [ledger, days]);

  const xpByKind = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of ledger) map[r.kind] = (map[r.kind] ?? 0) + r.amount;
    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([kind, amt]) => ({ kind, amt, pct: Math.round((amt / total) * 100) }));
  }, [ledger]);

  const totalXp7 = useMemo(() => ledger.reduce((a, b) => a + b.amount, 0), [ledger]);
  const maxXp = Math.max(1, ...xpByDay.map((d) => d.xp));
  const habitRate = habitTotal === 0 ? 0 : Math.round((habitCheckins7 / (habitTotal * 7)) * 100);
  const taskRate = tasksCreated7 === 0 ? 0 : Math.round((tasksCompleted7 / tasksCreated7) * 100);
  const avgMood =
    moods.length === 0 ? null : moods.reduce((a, b) => a + (b.mood ?? 0), 0) / moods.length;

  const moodByDay = useMemo(() => {
    const map: Record<string, number[]> = {};
    days.forEach((d) => (map[d] = []));
    for (const m of moods) {
      if (m.mood != null && map[m.entry_date] !== undefined) map[m.entry_date].push(m.mood);
    }
    return days.map((d) => ({
      day: d,
      avg: map[d].length ? map[d].reduce((a, b) => a + b, 0) / map[d].length : null,
    }));
  }, [moods, days]);

  const labelDay = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" })[0];

  if (loading) {
    return (
      <div className="space-y-4 animate-page-in">
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-page-in">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <BarChart3 className="h-6 w-6 text-primary" />
          Analytics
        </h1>
        <p className="text-sm text-muted-foreground">Last 7 days at a glance.</p>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="XP earned" value={totalXp7} icon={<Sparkles className="h-4 w-4 text-primary" />} />
        <Stat label="Habit rate" value={`${habitRate}%`} icon={<TrendingUp className="h-4 w-4 text-warning" />} />
        <Stat label="Quest rate" value={`${taskRate}%`} icon={<TrendingUp className="h-4 w-4 text-accent" />} />
        <Stat
          label="Avg mood"
          value={avgMood == null ? "—" : `${avgMood.toFixed(1)}/5`}
          icon={<Smile className="h-4 w-4 text-success" />}
        />
      </div>

      {/* XP per day bar chart */}
      <div
        className="rounded-2xl border border-border p-5"
        style={{ background: "var(--gradient-card)" }}
      >
        <h2 className="mb-4 text-sm font-semibold text-foreground">XP per day</h2>
        <div className="flex h-44 items-end justify-between gap-2">
          {xpByDay.map(({ day, xp }) => {
            const h = Math.max(4, Math.round((xp / maxXp) * 160));
            return (
              <div key={day} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-medium text-muted-foreground">{xp || ""}</span>
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${h}px`,
                    background: xp > 0 ? "var(--gradient-xp)" : "var(--muted)",
                    boxShadow: xp > 0 ? "var(--shadow-glow)" : undefined,
                  }}
                />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {labelDay(day)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* XP source breakdown */}
      <div
        className="rounded-2xl border border-border p-5"
        style={{ background: "var(--gradient-card)" }}
      >
        <h2 className="mb-3 text-sm font-semibold text-foreground">Where your XP came from</h2>
        {xpByKind.length === 0 ? (
          <p className="text-xs text-muted-foreground">No XP yet this week.</p>
        ) : (
          <div className="space-y-3">
            {xpByKind.map(({ kind, amt, pct }) => (
              <div key={kind}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {KIND_LABEL[kind] ?? kind}
                  </span>
                  <span className="text-muted-foreground">
                    {amt} XP · {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: KIND_COLOR[kind] ?? "var(--primary)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mood trend */}
      <div
        className="rounded-2xl border border-border p-5"
        style={{ background: "var(--gradient-card)" }}
      >
        <h2 className="mb-4 text-sm font-semibold text-foreground">Mood trend</h2>
        {moods.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No journal entries this week. Add one to see your mood trend.
          </p>
        ) : (
          <div className="flex h-32 items-end justify-between gap-2">
            {moodByDay.map(({ day, avg }) => {
              const h = avg == null ? 4 : Math.round((avg / 5) * 110);
              return (
                <div key={day} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {avg == null ? "" : avg.toFixed(1)}
                  </span>
                  <div
                    className="w-full rounded-t-md transition-all"
                    style={{
                      height: `${h}px`,
                      background:
                        avg == null
                          ? "var(--muted)"
                          : "linear-gradient(180deg, var(--success), var(--primary))",
                    }}
                  />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {labelDay(day)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border border-border p-3 text-center"
      style={{ background: "var(--gradient-card)" }}
    >
      <div className="flex justify-center">{icon}</div>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
