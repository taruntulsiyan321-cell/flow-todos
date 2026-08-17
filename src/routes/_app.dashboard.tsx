import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Flame,
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
import { SmartReminders } from "@/components/SmartReminders";
import { InstallPrompt } from "@/components/InstallPrompt";
import { rankFor } from "@/lib/xp";
import { cacheGet, cacheSet } from "@/lib/page-cache";
import { localISODate } from "@/lib/dates";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Today — plan, habits & time | Forge" },
      {
        name: "description",
        content:
          "Your daily command centre: today's plan, habit streaks, time log and a daily insight to keep momentum.",
      },
      { property: "og:title", content: "Today — plan, habits & time | Forge" },
      {
        property: "og:description",
        content: "See today's plan, habits and streak at a glance, then get one focused next action.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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
  | { kind: "habit"; title: string; xp: number }
  | { kind: "todo"; title: string }
  | { kind: "journal" }
  | null;

type DashCache = {
  profile: Profile | null;
  habitsTotal: number;
  habitsDone: number;
  todosTotal: number;
  todosDone: number;
  suggested: SuggestedAction;
};

function Dashboard() {
  const cached = cacheGet<DashCache>("dashboard", 120_000);
  const [profile, setProfile] = useState<Profile | null>(cached?.profile ?? null);
  const [habitsTotal, setHabitsTotal] = useState(cached?.habitsTotal ?? 0);
  const [habitsDone, setHabitsDone] = useState(cached?.habitsDone ?? 0);
  const [todosTotal, setTodosTotal] = useState(cached?.todosTotal ?? 0);
  const [todosDone, setTodosDone] = useState(cached?.todosDone ?? 0);
  const [suggested, setSuggested] = useState<SuggestedAction>(cached?.suggested ?? null);
  const [loading, setLoading] = useState(!cached);

  const quote = useMemo(() => {
    const idx = new Date().getDate() % QUOTES.length;
    return QUOTES[idx];
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) return;
      const today = localISODate();

      const [profileRes, habitsRes, checkinsRes, todosRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name,xp,level,current_streak,longest_streak")
          .eq("id", uid)
          .maybeSingle(),
        supabase.from("habits").select("id,name,xp_reward").eq("archived", false),
        supabase.from("habit_checkins").select("habit_id").eq("completed_on", today),
        supabase
          .from("daily_todos")
          .select("id,title,completed")
          .eq("scheduled_date", today)
          .order("sort_order", { ascending: true }),
      ]);

      if (!active) return;
      if (profileRes.data) setProfile(profileRes.data);
      const habits = habitsRes.data ?? [];
      const habitIds = new Set(habits.map((h) => h.id));
      const doneToday = new Set((checkinsRes.data ?? []).map((c) => c.habit_id));
      const habitsDoneCount = [...doneToday].filter((id) => habitIds.has(id)).length;
      setHabitsTotal(habitIds.size);
      setHabitsDone(habitsDoneCount);

      const todos = todosRes.data ?? [];
      setTodosTotal(todos.length);
      const todosDoneCount = todos.filter((t) => t.completed).length;
      setTodosDone(todosDoneCount);

      const openTodo = todos.find((t) => !t.completed);
      const remainingHabit = habits.find((h) => !doneToday.has(h.id));
      const nextSuggested: SuggestedAction = openTodo
        ? { kind: "todo", title: openTodo.title }
        : remainingHabit
          ? { kind: "habit", title: remainingHabit.name, xp: remainingHabit.xp_reward }
          : { kind: "journal" };
      setSuggested(nextSuggested);

      cacheSet<DashCache>("dashboard", {
        profile: profileRes.data ?? null,
        habitsTotal: habitIds.size,
        habitsDone: habitsDoneCount,
        todosTotal: todos.length,
        todosDone: todosDoneCount,
        suggested: nextSuggested,
      });

      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Level progress mirrors the DB curve (derived, never incremented).
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

  const totalActions = habitsTotal + todosTotal;
  const doneActions = habitsDone + todosDone;
  const dailyPct = totalActions === 0 ? 0 : Math.round((doneActions / totalActions) * 100);
  const missionTarget = Math.max(50, habitsTotal * 10 + Math.min(todosTotal, 3) * 15);

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
          <RailLink to="/plan" icon={<CalendarDays className="h-4 w-4" />} label={`Plan ${todosDone}/${todosTotal}`} />
          <RailLink to="/habits" icon={<Flame className="h-4 w-4" />} label={`Habits ${habitsDone}/${habitsTotal}`} />
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
                  ? "Plan your day to begin"
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

        <FeedItem label="Daily insight">
          <AiCoachCard />
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
  let to: "/habits" | "/plan" | "/journal" = "/habits";

  if (suggested.kind === "todo") {
    title = `Next up: ${suggested.title}`;
    sub = "From today's plan";
    to = "/plan";
  } else if (suggested.kind === "habit") {
    title = `Knock out: ${suggested.title}`;
    sub = `+${suggested.xp} XP · habit check-in`;
    to = "/habits";
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
  to: "/habits" | "/journal" | "/analytics" | "/communities" | "/timelog" | "/plan" | "/challenges";
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
