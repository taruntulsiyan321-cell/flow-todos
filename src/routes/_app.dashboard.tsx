import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Flame, Sparkles, CheckSquare, Trophy, Plus, BookOpen, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { XpBar } from "@/components/XpBar";
import { AiCoachCard } from "@/components/AiCoachCard";
import { rankFor } from "@/lib/xp";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Forge" }] }),
  component: Dashboard,
});

const QUOTES = [
  "Small steps every day.",
  "Discipline is the bridge between goals and accomplishment.",
  "You are what you repeatedly do.",
  "The cave you fear holds the treasure you seek.",
  "Progress, not perfection.",
  "Win the morning, win the day.",
  "Consistency beats intensity.",
];

type Profile = {
  display_name: string | null;
  xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
};

function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [habitsTotal, setHabitsTotal] = useState(0);
  const [habitsDone, setHabitsDone] = useState(0);
  const [tasksTotal, setTasksTotal] = useState(0);
  const [tasksDone, setTasksDone] = useState(0);
  const [loading, setLoading] = useState(true);

  const quote = useMemo(() => {
    const idx = new Date().getDate() % QUOTES.length;
    return QUOTES[idx];
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const today = new Date().toISOString().slice(0, 10);

      const [profileRes, habitsRes, checkinsRes, tasksRes] = await Promise.all([
        supabase.from("profiles").select("display_name,xp,level,current_streak,longest_streak").eq("id", uid).maybeSingle(),
        supabase.from("habits").select("id").eq("archived", false),
        supabase.from("habit_checkins").select("habit_id").eq("completed_on", today),
        supabase.from("tasks").select("id,completed").gte("created_at", `${today}T00:00:00Z`),
      ]);

      if (!active) return;
      if (profileRes.data) setProfile(profileRes.data);
      const habitIds = new Set((habitsRes.data ?? []).map((h) => h.id));
      setHabitsTotal(habitIds.size);
      const doneToday = new Set((checkinsRes.data ?? []).map((c) => c.habit_id));
      setHabitsDone(Array.from(doneToday).filter((id) => habitIds.has(id)).length);
      const tasks = tasksRes.data ?? [];
      setTasksTotal(tasks.length);
      setTasksDone(tasks.filter((t) => t.completed).length);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  // Compute level progress from xp using same curve as DB
  const { level, into, needed } = useMemo(() => {
    const xp = profile?.xp ?? 0;
    let lvl = 1;
    let rem = xp;
    let need = lvl * 100;
    while (rem >= need && lvl < 100) {
      rem -= need;
      lvl += 1;
      need = lvl * 100;
    }
    return { level: lvl, into: rem, needed: need };
  }, [profile?.xp]);

  const totalActions = habitsTotal + tasksTotal;
  const doneActions = habitsDone + tasksDone;
  const dailyPct = totalActions === 0 ? 0 : Math.round((doneActions / totalActions) * 100);
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return "Up late";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  if (loading) {
    return <div className="space-y-4 animate-pulse"><div className="h-32 rounded-3xl bg-card" /><div className="h-24 rounded-2xl bg-card" /><div className="h-24 rounded-2xl bg-card" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header card — Hero / status */}
      <div
        className="relative overflow-hidden rounded-3xl border border-border p-6"
        style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{greeting},</p>
            <h1 className="text-2xl font-bold text-foreground">
              {profile?.display_name ?? "Adventurer"}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5">
            <Flame className="h-4 w-4 text-warning" />
            <span className="text-sm font-bold text-foreground">{profile?.current_streak ?? 0}</span>
            <span className="text-xs text-muted-foreground">day{(profile?.current_streak ?? 0) === 1 ? "" : "s"}</span>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span
                className="text-3xl font-bold"
                style={{
                  background: "var(--gradient-primary)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                LV {level}
              </span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {rankFor(level)}
              </span>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {into} / {needed} XP
            </span>
          </div>
          <XpBar into={into} needed={needed} />
        </div>
      </div>

      {/* Daily completion */}
      <div
        className="rounded-2xl border border-border p-5"
        style={{ background: "var(--gradient-card)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Today's quest</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {doneActions} / {totalActions || "—"} complete
            </p>
          </div>
          <div className="text-right">
            <p
              className="text-3xl font-bold"
              style={{
                background: "var(--gradient-xp)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {dailyPct}%
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${dailyPct}%`, background: "var(--gradient-xp)" }}
          />
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/habits" className="group flex items-center justify-between rounded-2xl border border-border p-4 transition-transform hover:scale-[1.02] active:scale-[0.98]" style={{ background: "var(--gradient-card)" }}>
          <div>
            <Flame className="mb-2 h-5 w-5 text-warning" />
            <p className="text-sm font-semibold text-foreground">Habits</p>
            <p className="text-xs text-muted-foreground">{habitsDone}/{habitsTotal} today</p>
          </div>
          <Plus className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        </Link>
        <Link to="/tasks" className="group flex items-center justify-between rounded-2xl border border-border p-4 transition-transform hover:scale-[1.02] active:scale-[0.98]" style={{ background: "var(--gradient-card)" }}>
          <div>
            <CheckSquare className="mb-2 h-5 w-5 text-accent" />
            <p className="text-sm font-semibold text-foreground">Tasks</p>
            <p className="text-xs text-muted-foreground">{tasksDone}/{tasksTotal} today</p>
          </div>
          <Plus className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        </Link>
        <Link to="/planner" className="group flex items-center justify-between rounded-2xl border border-border p-4 transition-transform hover:scale-[1.02] active:scale-[0.98]" style={{ background: "var(--gradient-card)" }}>
          <div>
            <Calendar className="mb-2 h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-foreground">Planner</p>
            <p className="text-xs text-muted-foreground">Schedule the day</p>
          </div>
          <Plus className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        </Link>
        <Link to="/journal" className="group flex items-center justify-between rounded-2xl border border-border p-4 transition-transform hover:scale-[1.02] active:scale-[0.98]" style={{ background: "var(--gradient-card)" }}>
          <div>
            <BookOpen className="mb-2 h-5 w-5 text-success" />
            <p className="text-sm font-semibold text-foreground">Journal</p>
            <p className="text-xs text-muted-foreground">Reflect & earn XP</p>
          </div>
          <Plus className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        </Link>
      </div>

      {/* AI coach */}
      <AiCoachCard />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatChip icon={<Trophy className="h-4 w-4 text-warning" />} label="Best streak" value={profile?.longest_streak ?? 0} />
        <StatChip icon={<Sparkles className="h-4 w-4 text-primary" />} label="Total XP" value={profile?.xp ?? 0} />
        <StatChip icon={<Flame className="h-4 w-4 text-accent" />} label="Streak" value={profile?.current_streak ?? 0} />
      </div>

      {/* Quote */}
      <div
        className="rounded-2xl border border-border p-5 text-center"
        style={{ background: "var(--gradient-card)" }}
      >
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Daily insight</p>
        <p className="mt-2 text-base font-medium italic text-foreground">"{quote}"</p>
      </div>
    </div>
  );
}

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
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
