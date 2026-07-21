import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Flame,
  Sparkles,
  CheckSquare,
  Trophy,
  Plus,
  BookOpen,
  BarChart3,
  Clock,
  Target,
  ArrowRight,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { XpBar } from "@/components/XpBar";
import { AiCoachCard } from "@/components/AiCoachCard";
import { ActivityLog } from "@/components/ActivityLog";
import { SmartReminders } from "@/components/SmartReminders";
import { rankFor } from "@/lib/xp";
import { cacheGet, cacheSet } from "@/lib/page-cache";

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
  "Showing up is the hardest part. You did it.",
  "Action is the antidote to anxiety.",
  "One percent better, every day.",
];

type Profile = {
  display_name: string | null;
  xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
};

type SuggestedAction =
  | { kind: "habit"; id: string; title: string; xp: number }
  | { kind: "task"; id: string; title: string; xp: number }
  | { kind: "journal" }
  | null;

type DashCache = {
  profile: Profile | null;
  habitsTotal: number;
  habitsDone: number;
  tasksTotal: number;
  tasksDone: number;
  openTaskCount: number;
  suggested: SuggestedAction;
};

function Dashboard() {
  const cached = cacheGet<DashCache>("dashboard");
  const [profile, setProfile] = useState<Profile | null>(cached?.profile ?? null);
  const [habitsTotal, setHabitsTotal] = useState(cached?.habitsTotal ?? 0);
  const [habitsDone, setHabitsDone] = useState(cached?.habitsDone ?? 0);
  const [tasksTotal, setTasksTotal] = useState(cached?.tasksTotal ?? 0);
  const [tasksDone, setTasksDone] = useState(cached?.tasksDone ?? 0);
  const [openTaskCount, setOpenTaskCount] = useState(cached?.openTaskCount ?? 0);
  const [suggested, setSuggested] = useState<SuggestedAction>(cached?.suggested ?? null);
  const [loading, setLoading] = useState(!cached);

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

      const [profileRes, habitsRes, checkinsRes, todayTasksRes, openTasksRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name,xp,level,current_streak,longest_streak")
          .eq("id", uid)
          .maybeSingle(),
        supabase.from("habits").select("id,name,xp_reward").eq("archived", false),
        supabase.from("habit_checkins").select("habit_id").eq("completed_on", today),
        supabase.from("tasks").select("id,completed").gte("created_at", `${today}T00:00:00Z`),
        supabase
          .from("tasks")
          .select("id,title,xp_reward,priority")
          .eq("completed", false)
          .order("priority", { ascending: true })
          .limit(5),
      ]);

      if (!active) return;
      if (profileRes.data) setProfile(profileRes.data);
      const habits = habitsRes.data ?? [];
      const habitIds = new Set(habits.map((h) => h.id));
      setHabitsTotal(habitIds.size);
      const doneToday = new Set((checkinsRes.data ?? []).map((c) => c.habit_id));
      setHabitsDone(Array.from(doneToday).filter((id) => habitIds.has(id)).length);
      const todayTasks = todayTasksRes.data ?? [];
      setTasksTotal(todayTasks.length);
      setTasksDone(todayTasks.filter((t) => t.completed).length);

      const openTasks = openTasksRes.data ?? [];
      setOpenTaskCount(openTasks.length);

      // Pick a suggested next action
      let nextSuggested: SuggestedAction = null;
      const remainingHabit = habits.find((h) => !doneToday.has(h.id));
      if (remainingHabit) {
        nextSuggested = {
          kind: "habit",
          id: remainingHabit.id,
          title: remainingHabit.name,
          xp: remainingHabit.xp_reward,
        };
      } else if (openTasks[0]) {
        nextSuggested = {
          kind: "task",
          id: openTasks[0].id,
          title: openTasks[0].title,
          xp: openTasks[0].xp_reward,
        };
      } else {
        nextSuggested = { kind: "journal" };
      }
      setSuggested(nextSuggested);

      const profileData = profileRes.data ?? null;
      cacheSet<DashCache>("dashboard", {
        profile: profileData,
        habitsTotal: habitIds.size,
        habitsDone: Array.from(doneToday).filter((id) => habitIds.has(id)).length,
        tasksTotal: todayTasks.length,
        tasksDone: todayTasks.filter((t) => t.completed).length,
        openTaskCount: openTasks.length,
        suggested: nextSuggested,
      });

      setLoading(false);
    })();
    return () => {
      active = false;
    };
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

  // Today's mission XP target
  const missionTarget = Math.max(50, habitsTotal * 10 + Math.min(tasksTotal, 3) * 15);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return "Up late";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = (profile?.display_name ?? "Adventurer").split(" ")[0];

  if (loading) {
    return (
      <div className="space-y-4 animate-page-in">
        <div className="skeleton h-40 rounded-3xl" />
        <div className="skeleton h-24 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
        </div>
        <div className="skeleton h-32 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-page-in">
      {/* Hero — greeting + level + streak */}
      <div
        className="relative overflow-hidden rounded-3xl border border-border p-6"
        style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{greeting},</p>
            <h1 className="truncate text-2xl font-bold text-foreground">{firstName}</h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5">
            <Flame className="h-4 w-4 text-warning" />
            <span className="text-sm font-bold text-foreground">{profile?.current_streak ?? 0}</span>
            <span className="text-xs text-muted-foreground">
              day{(profile?.current_streak ?? 0) === 1 ? "" : "s"}
            </span>
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

      {/* Today's Mission */}
      <div
        className="rounded-2xl border border-border p-5"
        style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-glow-cyan)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <Target className="h-4 w-4 text-primary" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Today's mission</p>
            </div>
            <p className="mt-1 text-base font-semibold text-foreground">
              {totalActions === 0
                ? "Add a habit or quest to begin"
                : `Complete ${totalActions} action${totalActions === 1 ? "" : "s"} for +${missionTarget} XP`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {doneActions} of {totalActions || "—"} done · {dailyPct}%
            </p>
          </div>
          <div
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-bold"
            style={{
              background: dailyPct === 100 ? "var(--gradient-primary)" : "var(--muted)",
              color: dailyPct === 100 ? "var(--primary-foreground)" : "var(--foreground)",
            }}
          >
            {dailyPct}%
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${dailyPct}%`, background: "var(--gradient-xp)" }}
          />
        </div>
      </div>

      {/* Suggested next action */}
      {suggested && (
        <SuggestedActionCard suggested={suggested} />
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <QuickLink to="/habits" icon={<Flame className="h-5 w-5 text-warning" />} label="Habits" sub={`${habitsDone}/${habitsTotal} today`} />
        <QuickLink to="/tasks" icon={<CheckSquare className="h-5 w-5 text-accent" />} label="Quests" sub={`${openTaskCount} open`} />
        <QuickLink to="/journal" icon={<BookOpen className="h-5 w-5 text-success" />} label="Journal" sub="Reflect & earn" />
        <QuickLink to="/communities" icon={<Users className="h-5 w-5 text-primary" />} label="Crew" sub="Communities" />
        <QuickLink to="/analytics" icon={<BarChart3 className="h-5 w-5 text-primary" />} label="Stats" sub="Weekly insights" />
        <QuickLink to="/timelog" icon={<Clock className="h-5 w-5 text-accent" />} label="Time Log" sub="What & when" />
      </div>

      {/* Smart nudges (with notification toggle) */}
      <SmartReminders />

      {/* AI coach */}
      <AiCoachCard />

      {/* Activity log — transparency */}
      <ActivityLog />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatChip icon={<Trophy className="h-4 w-4 text-warning" />} label="Best streak" value={profile?.longest_streak ?? 0} />
        <StatChip icon={<Sparkles className="h-4 w-4 text-primary" />} label="Total XP" value={profile?.xp ?? 0} />
        <StatChip icon={<Flame className="h-4 w-4 text-accent" />} label="Streak" value={profile?.current_streak ?? 0} />
      </div>

      {/* Quote */}
      <div className="rounded-2xl border border-border p-5 text-center" style={{ background: "var(--gradient-card)" }}>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Daily insight</p>
        <p className="mt-2 text-base font-medium italic text-foreground">"{quote}"</p>
      </div>
    </div>
  );
}

function SuggestedActionCard({ suggested }: { suggested: NonNullable<SuggestedAction> }) {
  let title = "";
  let sub = "";
  let to: "/habits" | "/tasks" | "/journal" = "/habits";

  if (suggested.kind === "habit") {
    title = `Knock out: ${suggested.title}`;
    sub = `+${suggested.xp} XP · habit check-in`;
    to = "/habits";
  } else if (suggested.kind === "task") {
    title = `Tackle: ${suggested.title}`;
    sub = `+${suggested.xp} XP · open quest`;
    to = "/tasks";
  } else {
    title = "Reflect for a moment";
    sub = "+20 XP · journal entry";
    to = "/journal";
  }

  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-2xl border border-primary/30 p-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-glow)" }}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Do this next</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

function QuickLink({ to, icon, label, sub }: { to: "/habits" | "/tasks" | "/journal" | "/analytics" | "/communities"; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-2xl border border-border p-4 transition-transform hover:scale-[1.02] active:scale-[0.98]"
      style={{ background: "var(--gradient-card)" }}
    >
      <div>
        <div className="mb-2">{icon}</div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <Plus className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
    </Link>
  );
}

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border p-3 text-center" style={{ background: "var(--gradient-card)" }}>
      <div className="flex justify-center">{icon}</div>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
