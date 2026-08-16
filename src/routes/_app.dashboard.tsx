import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Flame,
  Sparkles,
  CheckSquare,
  BookOpen,
  BarChart3,
  Clock,
  Target,
  ArrowRight,
  Users,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { XpBar } from "@/components/XpBar";
import { AiCoachCard } from "@/components/AiCoachCard";
import { ActivityLog } from "@/components/ActivityLog";
import { SmartReminders } from "@/components/SmartReminders";
import { InstallPrompt } from "@/components/InstallPrompt";
import { rankFor } from "@/lib/xp";
import { cacheGet, cacheSet } from "@/lib/page-cache";
import { localISODate } from "@/lib/dates";

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
      const today = localISODate();

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
    <div className="animate-page-in">
      {/* ── Masthead ───────────────────────────────────────── */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border pb-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {greeting}
          </p>
          <h1 className="truncate font-display text-3xl font-extrabold text-foreground">
            {firstName}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5">
            <Flame className="h-4 w-4 text-primary" />
            <span className="font-display text-sm font-bold text-foreground">
              {profile?.current_streak ?? 0}
            </span>
          </span>
          <span className="rounded-full border border-primary/40 px-3 py-1.5 font-display text-sm font-bold text-primary">
            LV {level}
          </span>
        </div>
      </header>

      {/* ── Level strip ────────────────────────────────────── */}
      <div className="border-b border-border py-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {rankFor(level)}
          </span>
          <span className="font-display text-xs font-semibold text-muted-foreground">
            {into} / {needed} XP
          </span>
        </div>
        <XpBar into={into} needed={needed} />
      </div>

      {/* ── Tool rail ──────────────────────────────────────── */}
      <div className="-mx-4 border-b border-border px-4 py-4 sm:-mx-6 sm:px-6">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <RailLink to="/plan" icon={<CalendarDays className="h-4 w-4" />} label="Plan" />
          <RailLink to="/habits" icon={<Flame className="h-4 w-4" />} label={`Habits ${habitsDone}/${habitsTotal}`} />
          <RailLink to="/tasks" icon={<CheckSquare className="h-4 w-4" />} label={`Quests ${openTaskCount}`} />
          <RailLink to="/timelog" icon={<Clock className="h-4 w-4" />} label="Time log" />
          <RailLink to="/journal" icon={<BookOpen className="h-4 w-4" />} label="Journal" />
          <RailLink to="/analytics" icon={<BarChart3 className="h-4 w-4" />} label="Stats" />
          <RailLink to="/communities" icon={<Users className="h-4 w-4" />} label="Crew" />
          <RailLink to="/challenges" icon={<Target className="h-4 w-4" />} label="Challenges" />
        </div>
      </div>


      {/* ── Today feed ─────────────────────────────────────── */}
      <div className="relative mt-6 space-y-6 pl-7">
        <span
          aria-hidden
          className="absolute bottom-2 left-[7px] top-2 w-px"
          style={{ background: "var(--gradient-xp)", opacity: 0.35 }}
        />

        <FeedItem label="Today's mission" accent>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-lg font-bold text-foreground">
                {totalActions === 0
                  ? "Add a habit or quest to begin"
                  : `${totalActions} action${totalActions === 1 ? "" : "s"} · +${missionTarget} XP`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {doneActions} of {totalActions || "—"} complete
              </p>
            </div>
            <span className="shrink-0 font-display text-3xl font-extrabold text-primary">
              {dailyPct}%
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${dailyPct}%`, background: "var(--gradient-xp)" }}
            />
          </div>
        </FeedItem>

        {suggested && (
          <FeedItem label="Do this next">
            <SuggestedActionCard suggested={suggested} />
          </FeedItem>
        )}

        <FeedItem label="Nudges">
          <InstallPrompt />
          <SmartReminders />
        </FeedItem>

        <FeedItem label="Coach">
          <AiCoachCard />
        </FeedItem>

        <FeedItem label="Recent activity">
          <ActivityLog />
        </FeedItem>

        <FeedItem label="All time">
          <div className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card">
            <StatChip label="Best streak" value={profile?.longest_streak ?? 0} />
            <StatChip label="Total XP" value={profile?.xp ?? 0} />
            <StatChip label="Streak" value={profile?.current_streak ?? 0} />
          </div>
        </FeedItem>

        <FeedItem label="Daily insight">
          <p className="font-display text-lg font-semibold leading-snug text-foreground">
            “{quote}”
          </p>
        </FeedItem>
      </div>
    </div>
  );
}

function FeedItem({
  label,
  accent,
  children,
}: {
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="relative">
      <span
        aria-hidden
        className="absolute -left-7 top-1.5 h-[15px] w-[15px] rounded-full border-2 border-background"
        style={{
          background: accent ? "var(--gradient-primary)" : "var(--muted)",
          boxShadow: accent ? "var(--shadow-glow)" : undefined,
        }}
      />
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="space-y-3">{children}</div>
    </section>
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
      className="group flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-card p-4 transition-all hover:border-primary/60 active:scale-[0.99]"
      style={{ boxShadow: "var(--shadow-glow)" }}
    >
      <div className="min-w-0">
        <p className="truncate font-display text-base font-bold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

function RailLink({
  to,
  icon,
  label,
}: {
  to: "/habits" | "/tasks" | "/journal" | "/analytics" | "/communities" | "/timelog" | "/goals" | "/coach" | "/focus" | "/life" | "/schedule";
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary active:scale-95"
    >
      <span className="text-primary">{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 py-4 text-center">
      <p className="font-display text-xl font-extrabold text-foreground">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
