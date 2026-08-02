import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, Sparkles, TrendingUp, TrendingDown, Smile, Flame, Trophy, Target,
  CheckCircle2, Clock, Brain, Heart, Calendar, Download, Wand2, Award, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateAnalyticsInsights } from "@/lib/analytics-insights.functions";
import { localISODate } from "@/lib/dates";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Forge" }] }),
  component: AnalyticsPage,
});

type Range = "7d" | "30d" | "90d" | "365d";
const RANGE_LABEL: Record<Range, string> = {
  "7d": "This week",
  "30d": "This month",
  "90d": "Last 3 months",
  "365d": "This year",
};
const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isoDay(d: Date) {
  return localISODate(d);
}
function lastNDays(n: number) {
  const out: string[] = [];
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(t);
    d.setDate(t.getDate() - i);
    out.push(isoDay(d));
  }
  return out;
}
function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

type Ledger = { amount: number; kind: string; occurred_on: string; created_at: string };
type Mood = { entry_date: string; mood: number | null };
type Task = { id: string; created_at: string; completed: boolean; completed_at: string | null; due_date: string | null };
type Habit = { id: string; name: string; archived: boolean };
type HabitLog = { habit_id: string; completed_on: string; created_at: string };
type Profile = { xp: number; level: number; current_streak: number; longest_streak: number };

function AnalyticsPage() {
  const [range, setRange] = useState<Range>("30d");
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkins, setCheckins] = useState<HabitLog[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [insights, setInsights] = useState<string[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const days = useMemo(() => lastNDays(RANGE_DAYS[range]), [range]);
  const sinceISO = days[0];
  const prevSinceISO = useMemo(() => {
    const d = new Date(sinceISO + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - RANGE_DAYS[range]);
    return isoDay(d);
  }, [sinceISO, range]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const [ledRes, moodRes, taskRes, habRes, ckRes, profRes] = await Promise.all([
        supabase.from("xp_ledger").select("amount,kind,occurred_on,created_at").gte("occurred_on", prevSinceISO),
        supabase.from("journal_entries").select("entry_date,mood").gte("entry_date", prevSinceISO),
        supabase.from("tasks").select("id,created_at,completed,completed_at,due_date").gte("created_at", `${prevSinceISO}T00:00:00Z`),
        supabase.from("habits").select("id,name,archived"),
        supabase.from("habit_checkins").select("habit_id,completed_on,created_at").gte("completed_on", prevSinceISO),
        supabase.from("profiles").select("xp,level,current_streak,longest_streak").maybeSingle(),
      ]);
      if (!active) return;
      setLedger(ledRes.data ?? []);
      setMoods((moodRes.data ?? []).filter((m) => m.mood != null));
      setTasks(taskRes.data ?? []);
      setHabits(habRes.data ?? []);
      setCheckins(ckRes.data ?? []);
      setProfile(profRes.data ?? null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [prevSinceISO]);

  // ===== Derived =====
  const inRange = (iso: string) => iso >= sinceISO;
  const inPrev = (iso: string) => iso >= prevSinceISO && iso < sinceISO;

  // Tasks
  const tasksInRange = tasks.filter((t) => t.created_at.slice(0, 10) >= sinceISO);
  const tasksCreated = tasksInRange.length;
  const completedInRange = tasks.filter(
    (t) => t.completed && t.completed_at && t.completed_at.slice(0, 10) >= sinceISO,
  );
  const tasksCompleted = completedInRange.length;
  const completionRate = tasksCreated === 0 ? 0 : Math.round((tasksCompleted / tasksCreated) * 100);
  const today = isoDay(new Date());
  const pendingTasks = tasks.filter((t) => !t.completed).length;
  const overdueTasks = tasks.filter((t) => !t.completed && t.due_date && t.due_date < today).length;
  const avgPerDay = (tasksCompleted / RANGE_DAYS[range]).toFixed(1);

  // Best day-of-week by completed tasks
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  completedInRange.forEach((t) => {
    if (t.completed_at) dayCounts[new Date(t.completed_at).getDay()]++;
  });
  const bestDayIdx = dayCounts.indexOf(Math.max(...dayCounts));
  const bestDayName = Math.max(...dayCounts) > 0 ? DAY_NAMES[bestDayIdx] : "—";

  // Best hour
  const hourCounts = new Array(24).fill(0) as number[];
  completedInRange.forEach((t) => {
    if (t.completed_at) hourCounts[new Date(t.completed_at).getHours()]++;
  });
  const bestHour = Math.max(...hourCounts) > 0 ? hourCounts.indexOf(Math.max(...hourCounts)) : -1;

  // Habits
  const activeHabits = habits.filter((h) => !h.archived);
  const checkinsInRange = checkins.filter((c) => inRange(c.completed_on));
  const possibleCheckins = activeHabits.length * RANGE_DAYS[range];
  const habitRate = possibleCheckins === 0 ? 0 : Math.round((checkinsInRange.length / possibleCheckins) * 100);
  const missedHabits = Math.max(0, possibleCheckins - checkinsInRange.length);

  const habitConsistency = activeHabits.map((h) => {
    const hits = checkinsInRange.filter((c) => c.habit_id === h.id).length;
    return { id: h.id, name: h.name, rate: RANGE_DAYS[range] === 0 ? 0 : hits / RANGE_DAYS[range], hits };
  });
  habitConsistency.sort((a, b) => b.rate - a.rate);
  const bestHabit = habitConsistency[0] ?? null;
  const weakHabit = habitConsistency.length > 1 ? habitConsistency[habitConsistency.length - 1] : null;

  // XP per day & per kind
  const xpByDay = days.map((d) => ({
    day: d,
    xp: ledger.filter((r) => r.occurred_on === d).reduce((a, b) => a + b.amount, 0),
  }));
  const totalXp = xpByDay.reduce((a, b) => a + b.xp, 0);
  const prevTotalXp = ledger
    .filter((r) => inPrev(r.occurred_on))
    .reduce((a, b) => a + b.amount, 0);
  const xpDelta = prevTotalXp === 0 ? (totalXp > 0 ? 100 : 0) : Math.round(((totalXp - prevTotalXp) / prevTotalXp) * 100);

  // Week vs week / month vs month
  const weekVsLastWeekPct = xpDelta;
  const monthVsLastMonthPct = xpDelta;

  // Activity heatmap matrix (7 cols × N weeks)
  const heatmap = days.map((d) => ({
    day: d,
    count: ledger.filter((r) => r.occurred_on === d).reduce((a, b) => a + b.amount, 0),
  }));

  // Active days, longest comeback
  const activeDaysSet = new Set(ledger.filter((r) => inRange(r.occurred_on)).map((r) => r.occurred_on));
  const activeDays = activeDaysSet.size;

  // Mood
  const avgMood = moods.length ? moods.reduce((a, b) => a + (b.mood ?? 0), 0) / moods.length : null;

  // ===== Scores =====
  const focusScore = clamp(Math.round((tasksCompleted / Math.max(1, RANGE_DAYS[range])) * 25 + completionRate * 0.4));
  const consistencyScore = clamp(Math.round((activeDays / RANGE_DAYS[range]) * 100));
  const disciplineScore = clamp(Math.round(habitRate * 0.7 + ((profile?.current_streak ?? 0) * 2)));
  const productivityScore = clamp(Math.round(focusScore * 0.5 + completionRate * 0.5));
  const growthScore = clamp(50 + Math.round(weekVsLastWeekPct / 2));
  const wellnessScore = clamp(
    Math.round(((avgMood ?? 3) / 5) * 60 + (consistencyScore * 0.3) + (overdueTasks > 5 ? -10 : 10)),
  );

  // ===== AI Insights =====
  useEffect(() => {
    if (loading) return;
    setInsightsLoading(true);
    setInsights(null);
    generateAnalyticsInsights({
      data: {
        productivity: productivityScore,
        discipline: disciplineScore,
        consistency: consistencyScore,
        focus: focusScore,
        growth: growthScore,
        wellness: wellnessScore,
        bestDayName,
        bestHour,
        completionRate,
        weekVsLastWeekPct,
        monthVsLastMonthPct,
        currentStreak: profile?.current_streak ?? 0,
        longestStreak: profile?.longest_streak ?? 0,
        habitName: bestHabit?.name ?? null,
        weakHabitName: weakHabit?.name ?? null,
        pendingTasks,
        overdueTasks,
        avgMood,
      },
    })
      .then((r) => setInsights(r.insights))
      .catch(() => setInsights(null))
      .finally(() => setInsightsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, range]);

  const exportReport = () => {
    const lines: string[] = [];
    lines.push(`# Personal Analytics — ${RANGE_LABEL[range]}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push("");
    lines.push(`## Scores`);
    lines.push(`- Productivity: ${productivityScore}/100`);
    lines.push(`- Discipline: ${disciplineScore}/100`);
    lines.push(`- Consistency: ${consistencyScore}/100`);
    lines.push(`- Focus: ${focusScore}/100`);
    lines.push(`- Growth: ${growthScore}/100`);
    lines.push(`- Wellness: ${wellnessScore}/100`);
    lines.push("");
    lines.push(`## Productivity`);
    lines.push(`- Tasks created: ${tasksCreated}`);
    lines.push(`- Tasks completed: ${tasksCompleted}`);
    lines.push(`- Completion rate: ${completionRate}%`);
    lines.push(`- Pending: ${pendingTasks} · Overdue: ${overdueTasks}`);
    lines.push(`- Avg/day: ${avgPerDay}`);
    lines.push(`- Best day: ${bestDayName} · Best hour: ${bestHour >= 0 ? bestHour + ":00" : "—"}`);
    lines.push("");
    lines.push(`## Habits`);
    lines.push(`- Habit completion rate: ${habitRate}%`);
    lines.push(`- Missed check-ins: ${missedHabits}`);
    lines.push(`- Most consistent: ${bestHabit?.name ?? "—"}`);
    lines.push(`- Weakest: ${weakHabit?.name ?? "—"}`);
    lines.push(`- Current streak: ${profile?.current_streak ?? 0} · Longest: ${profile?.longest_streak ?? 0}`);
    lines.push("");
    lines.push(`## Growth`);
    lines.push(`- XP this period: ${totalXp} (vs ${prevTotalXp} prior, ${xpDelta >= 0 ? "+" : ""}${xpDelta}%)`);
    lines.push(`- Active days: ${activeDays}/${RANGE_DAYS[range]}`);
    lines.push(`- Avg mood: ${avgMood == null ? "—" : avgMood.toFixed(2) + "/5"}`);
    if (insights) {
      lines.push("");
      lines.push(`## AI Insights`);
      insights.forEach((i) => lines.push(`- ${i}`));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${range}-${today}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
    <div className="space-y-6 animate-page-in pb-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <BarChart3 className="h-6 w-6 text-primary" />
            Personal Analytics
          </h1>
          <p className="text-sm text-muted-foreground">{RANGE_LABEL[range]} · understand and improve yourself.</p>
        </div>
        <button
          onClick={exportReport}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition hover:scale-105"
        >
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      {/* Range filter */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              range === r
                ? "border-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
            style={range === r ? { background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" } : undefined}
          >
            {RANGE_LABEL[r]}
          </button>
        ))}
      </div>

      {/* Smart Scores - rings */}
      <section>
        <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Smart scores</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <ScoreRing label="Productivity" value={productivityScore} color="var(--primary)" icon={<Zap className="h-3.5 w-3.5" />} />
          <ScoreRing label="Discipline" value={disciplineScore} color="var(--warning)" icon={<Target className="h-3.5 w-3.5" />} />
          <ScoreRing label="Consistency" value={consistencyScore} color="var(--accent)" icon={<Flame className="h-3.5 w-3.5" />} />
          <ScoreRing label="Focus" value={focusScore} color="oklch(0.78 0.2 330)" icon={<Brain className="h-3.5 w-3.5" />} />
          <ScoreRing label="Growth" value={growthScore} color="var(--success)" icon={<TrendingUp className="h-3.5 w-3.5" />} />
          <ScoreRing label="Wellness" value={wellnessScore} color="oklch(0.78 0.18 200)" icon={<Heart className="h-3.5 w-3.5" />} />
        </div>
      </section>

      {/* AI Insights */}
      <section
        className="rounded-2xl border border-border p-5"
        style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-glow-cyan)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Wand2 className="h-4 w-4 text-accent" />
            AI Insights
          </h2>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">personalized</span>
        </div>
        {insightsLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-4 rounded" />)}
          </div>
        ) : insights ? (
          <ul className="space-y-2">
            {insights.map((i, idx) => (
              <li
                key={idx}
                className="flex animate-page-in items-start gap-2 rounded-xl border border-border/40 bg-card/40 p-3 text-sm text-foreground"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{i}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Insights unavailable right now.</p>
        )}
      </section>

      {/* Productivity */}
      <section>
        <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Productivity</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Created" value={tasksCreated} icon={<CheckCircle2 className="h-4 w-4 text-primary" />} />
          <Stat label="Completed" value={tasksCompleted} icon={<CheckCircle2 className="h-4 w-4 text-success" />} />
          <Stat label="Rate" value={`${completionRate}%`} icon={<TrendingUp className="h-4 w-4 text-accent" />} />
          <Stat label="Avg/day" value={avgPerDay} icon={<Clock className="h-4 w-4 text-warning" />} />
          <Stat label="Pending" value={pendingTasks} icon={<Clock className="h-4 w-4 text-muted-foreground" />} />
          <Stat label="Overdue" value={overdueTasks} icon={<TrendingDown className="h-4 w-4 text-destructive" />} />
          <Stat label="Best day" value={bestDayName} icon={<Calendar className="h-4 w-4 text-primary" />} />
          <Stat label="Best hour" value={bestHour >= 0 ? `${bestHour}:00` : "—"} icon={<Clock className="h-4 w-4 text-primary" />} />
        </div>
      </section>

      {/* XP per day chart */}
      <Card title="XP per day">
        <BarsChart data={xpByDay.map((d) => ({ label: shortDay(d.day), value: d.xp }))} />
      </Card>

      {/* Habits */}
      <section>
        <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Habits</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Completion" value={`${habitRate}%`} icon={<Flame className="h-4 w-4 text-warning" />} />
          <Stat label="Missed" value={missedHabits} icon={<TrendingDown className="h-4 w-4 text-destructive" />} />
          <Stat label="Streak" value={profile?.current_streak ?? 0} icon={<Flame className="h-4 w-4 text-warning" />} />
          <Stat label="Longest" value={profile?.longest_streak ?? 0} icon={<Trophy className="h-4 w-4 text-accent" />} />
        </div>
        {habitConsistency.length > 0 && (
          <div
            className="mt-3 rounded-2xl border border-border p-5"
            style={{ background: "var(--gradient-card)" }}
          >
            <h3 className="mb-3 text-sm font-semibold text-foreground">Habit consistency</h3>
            <div className="space-y-3">
              {habitConsistency.slice(0, 8).map((h) => {
                const pct = Math.round(h.rate * 100);
                return (
                  <div key={h.id}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-foreground">{h.name}</span>
                      <span className="text-muted-foreground">{pct}% · {h.hits} check-ins</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 70 ? "var(--gradient-xp)" : pct >= 40 ? "var(--warning)" : "var(--destructive)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {bestHabit && (
              <p className="mt-3 text-xs text-muted-foreground">
                Most consistent: <span className="font-medium text-success">{bestHabit.name}</span>
                {weakHabit && weakHabit.id !== bestHabit.id && (
                  <> · Weakest: <span className="font-medium text-destructive">{weakHabit.name}</span></>
                )}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Activity heatmap */}
      <Card title="Activity heatmap">
        <Heatmap days={heatmap} />
      </Card>

      {/* Growth comparison */}
      <Card title="Growth — this period vs last">
        <div className="grid grid-cols-2 gap-4">
          <Compare label="XP earned" current={totalXp} previous={prevTotalXp} />
          <Compare label="Active days" current={activeDays} previous={ledger.filter((r) => inPrev(r.occurred_on)).length > 0 ? new Set(ledger.filter((r) => inPrev(r.occurred_on)).map((r) => r.occurred_on)).size : 0} />
        </div>
      </Card>

      {/* Mood */}
      {moods.length > 0 && (
        <Card title="Mood trend">
          <div className="flex items-center gap-3">
            <Smile className="h-8 w-8 text-success" />
            <div>
              <p className="text-2xl font-bold text-foreground">{avgMood?.toFixed(1)}<span className="text-base text-muted-foreground">/5</span></p>
              <p className="text-xs text-muted-foreground">average across {moods.length} entries</p>
            </div>
          </div>
        </Card>
      )}

      {/* Personal records / level */}
      {profile && (
        <Card title="Personal records">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Level" value={profile.level} icon={<Award className="h-4 w-4 text-primary" />} />
            <Stat label="Total XP" value={profile.xp} icon={<Sparkles className="h-4 w-4 text-primary" />} />
            <Stat label="Best streak" value={profile.longest_streak} icon={<Trophy className="h-4 w-4 text-accent" />} />
          </div>
        </Card>
      )}
    </div>
  );
}

// ===== Pieces =====

function shortDay(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short" })[0];
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border p-5" style={{ background: "var(--gradient-card)" }}>
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border p-3 text-center transition hover:scale-105"
      style={{ background: "var(--gradient-card)" }}>
      <div className="flex justify-center">{icon}</div>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function ScoreRing({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div
      className="flex flex-col items-center rounded-2xl border border-border p-3 transition hover:scale-105"
      style={{ background: "var(--gradient-card)" }}
    >
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={r} stroke="var(--muted)" strokeWidth="6" fill="none" />
          <circle
            cx="32" cy="32" r={r} stroke={color} strokeWidth="6" fill="none"
            strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 800ms ease-out", filter: `drop-shadow(0 0 4px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">{value}</div>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
    </div>
  );
}

function BarsChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-44 items-end justify-between gap-1">
      {data.map((d, i) => {
        const h = Math.max(4, Math.round((d.value / max) * 160));
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[9px] font-medium text-muted-foreground">{d.value || ""}</span>
            <div
              className="w-full rounded-t-md transition-all duration-700"
              style={{
                height: `${h}px`,
                background: d.value > 0 ? "var(--gradient-xp)" : "var(--muted)",
                boxShadow: d.value > 0 ? "var(--shadow-glow)" : undefined,
              }}
            />
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Heatmap({ days }: { days: { day: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  // group into weeks (cols)
  const weeks: { day: string; count: number }[][] = [];
  let week: typeof weeks[number] = [];
  // pad first week to start on Sunday
  const first = new Date(days[0].day + "T12:00:00");
  for (let i = 0; i < first.getDay(); i++) week.push({ day: "", count: -1 });
  days.forEach((d) => {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  });
  if (week.length) weeks.push(week);

  const intensity = (c: number) => {
    if (c < 0) return "transparent";
    if (c === 0) return "var(--muted)";
    const ratio = c / max;
    if (ratio > 0.75) return "oklch(0.7 0.24 295)";
    if (ratio > 0.5) return "oklch(0.7 0.2 270)";
    if (ratio > 0.25) return "oklch(0.7 0.18 240)";
    return "oklch(0.7 0.16 210)";
  };
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-1">
            {w.map((d, j) => (
              <div
                key={j}
                title={d.day ? `${d.day}: ${d.count} XP` : ""}
                className="h-3 w-3 rounded-sm transition-transform hover:scale-150"
                style={{ background: intensity(d.count) }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Compare({ label, current, previous }: { label: string; current: number; previous: number }) {
  const delta = previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100);
  const up = delta >= 0;
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{current}</p>
      <p className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${up ? "text-success" : "text-destructive"}`}>
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {up ? "+" : ""}{delta}% vs prior
      </p>
    </div>
  );
}
