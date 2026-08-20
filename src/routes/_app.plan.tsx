import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Plus,
  Check,
  Trash2,
  Bell,
  BellOff,
  Copy,
  Target,
  ChevronDown,
  ChevronRight,
  CalendarPlus,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { lifeFrom } from "@/lib/lifeos-db";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fireNotification,
  getNotifyPermission,
  notificationsEnabled,
  requestNotificationPermission,
  setNotificationsEnabled,
} from "@/lib/notifications";
import { formatLocalDay, localISODate, shiftLocalISODate } from "@/lib/dates";
import { cacheGet, cacheSet, cacheInvalidate } from "@/lib/page-cache";
import { deleteWithUndo } from "@/lib/undo";

export const Route = createFileRoute("/_app/plan")({
  head: () => ({
    meta: [
      { title: "Plan — study weeks, days & goals | Forge" },
      {
        name: "description",
        content:
          "Plan your week in one place: schedule daily study blocks, break goals into sub-goals, and tick everything off as you go.",
      },
      { property: "og:title", content: "Plan — study weeks, days & goals | Forge" },
      {
        property: "og:description",
        content: "Day, week and goal planning with sub-goals that roll up into real progress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlanPage,
});

type DailyTodo = {
  id: string;
  title: string;
  scheduled_date: string;
  completed: boolean;
  completed_at: string | null;
  remind_at: string | null;
  sort_order: number;
  goal_id: string | null;
};

type Goal = {
  id: string;
  title: string;
  horizon: string;
  progress: number;
  status: string;
  target_date: string | null;
  parent_id: string | null;
};

const TABS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "goals", label: "Goals" },
  { key: "list", label: "List" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const TODO_COLS = "id,title,scheduled_date,completed,completed_at,remind_at,sort_order,goal_id";
const GOAL_COLS = "id,title,horizon,progress,status,target_date,parent_id";
const NOTEPAD_COLS = "id,title,completed,completed_at,sort_order,created_at";

type NotepadItem = {
  id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
};

/** Whole days from today until an end date (negative = overdue). */
function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1, d).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function DeadlineBadge({ iso, done }: { iso: string; done?: boolean }) {
  const left = daysUntil(iso);
  const tone = done
    ? "border-border text-muted-foreground"
    : left < 0
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : left <= 3
        ? "border-primary/50 bg-primary/10 text-primary"
        : "border-border text-muted-foreground";
  const text = done
    ? `done · ${formatLocalDay(iso, { month: "short", day: "numeric" })}`
    : left < 0
      ? `${Math.abs(left)}d overdue`
      : left === 0
        ? "due today"
        : left === 1
          ? "1 day left"
          : `${left} days left`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        tone,
      )}
      title={`Deadline: ${formatLocalDay(iso, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}`}
    >
      <CalendarDays className="h-3 w-3" />
      {text}
    </span>
  );
}


function PlanPage() {
  const [tab, setTab] = useState<TabKey>("today");

  return (
    <div className="animate-page-in">
      <header className="border-b border-border pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Your command centre
        </p>
        <h1 className="font-display text-3xl font-extrabold text-foreground">Plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Map the whole week, break big goals into sub-goals, then tick off each day.
        </p>
      </header>

      <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 rounded-full border px-4 py-2 text-sm font-semibold transition-all active:scale-95",
                tab === t.key
                  ? "border-primary/50 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
              style={
                tab === t.key
                  ? { background: "var(--gradient-card)", boxShadow: "var(--shadow-glow)" }
                  : undefined
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {tab === "today" ? <DailyPlanner /> : tab === "week" ? <WeekBoard /> : <GoalsPanel />}
      </div>
    </div>
  );
}

/* ─────────────── shared helpers ─────────────── */

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/* ─────────────── Today: single-day to-do list ─────────────── */

function DailyPlanner() {
  const today = localISODate();
  const [date, setDate] = useState(today);
  const [todos, setTodos] = useState<DailyTodo[]>(cacheGet<DailyTodo[]>(`plan-day-${today}`) ?? []);
  const [loading, setLoading] = useState(!cacheGet(`plan-day-${today}`));
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [goalId, setGoalId] = useState("");
  const [saving, setSaving] = useState(false);
  const [notifyOn, setNotifyOn] = useState(notificationsEnabled());
  const [history, setHistory] = useState<{ date: string; total: number; done: number }[]>([]);

  const goalTitle = (id: string | null) => goals.find((g) => g.id === id)?.title ?? null;

  const load = async (d = date) => {
    const cached = cacheGet<DailyTodo[]>(`plan-day-${d}`);
    if (cached) setTodos(cached);
    setLoading(!cached);
    const { data, error } = await lifeFrom("daily_todos")
      .select(TODO_COLS)
      .eq("scheduled_date", d)
      .order("completed", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    const rows = (data as DailyTodo[]) ?? [];
    setTodos(rows);
    cacheSet(`plan-day-${d}`, rows);
    setLoading(false);
  };

  const loadGoals = async () => {
    const { data } = await lifeFrom("goals")
      .select(GOAL_COLS)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    setGoals((data as Goal[]) ?? []);
  };

  const loadHistory = async () => {
    const { data } = await lifeFrom("daily_todos")
      .select("scheduled_date,completed")
      .gte("scheduled_date", shiftLocalISODate(today, -13))
      .lte("scheduled_date", today)
      .order("scheduled_date", { ascending: false });
    const map = new Map<string, { total: number; done: number }>();
    for (const row of data ?? []) {
      const cur = map.get(row.scheduled_date) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (row.completed) cur.done += 1;
      map.set(row.scheduled_date, cur);
    }
    setHistory([...map.entries()].map(([d, v]) => ({ date: d, ...v })).slice(0, 14));
  };

  useEffect(() => {
    void load(date);
  }, [date]);

  useEffect(() => {
    void loadGoals();
    void loadHistory();
  }, []);

  useEffect(() => {
    if (!notifyOn || date !== today) return;
    const fired = new Set<string>();
    const tick = () => {
      if (!notificationsEnabled()) return;
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      for (const t of todos) {
        if (t.completed || !t.remind_at) continue;
        if (t.remind_at.slice(0, 5) === hhmm && !fired.has(t.id)) {
          fired.add(t.id);
          fireNotification("Today's plan", t.title);
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [todos, notifyOn, date, today]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const iso = shiftLocalISODate(today, i - 1);
        const d = new Date(iso + "T12:00:00");
        return { iso, day: d.getDate(), weekday: d.toLocaleDateString(undefined, { weekday: "short" }) };
      }),
    [today],
  );

  const doneCount = todos.filter((t) => t.completed).length;
  const pct = todos.length ? Math.round((doneCount / todos.length) * 100) : 0;

  const add = async () => {
    if (!title.trim()) return toast.error("Add a task title");
    setSaving(true);
    const uid = await currentUserId();
    if (!uid) return setSaving(false);
    const { error } = await lifeFrom("daily_todos").insert({
      user_id: uid,
      title: title.trim(),
      scheduled_date: date,
      remind_at: remindAt || null,
      goal_id: goalId || null,
      sort_order: todos.length,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setTitle("");
    setRemindAt("");
    cacheInvalidate("plan-day-");
    void load();
    void loadHistory();
  };

  const toggle = async (todo: DailyTodo) => {
    const next = !todo.completed;
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id ? { ...t, completed: next, completed_at: next ? new Date().toISOString() : null } : t,
      ),
    );
    const { error } = await lifeFrom("daily_todos")
      .update({
        completed: next,
        completed_at: next ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", todo.id);
    cacheInvalidate("plan-day-");
    if (error) {
      toast.error(error.message);
      return void load();
    }
    void loadHistory();
  };

  const remove = async (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    cacheInvalidate("plan-day-");
    await deleteWithUndo({
      table: "daily_todos",
      id,
      label: "Task",
      refresh: async () => {
        cacheInvalidate("plan-day-");
        await load();
        await loadHistory();
      },
    });
  };


  const copyPreviousDay = async () => {
    const uid = await currentUserId();
    if (!uid) return;
    const { data, error } = await lifeFrom("daily_todos")
      .select("title,remind_at,goal_id")
      .eq("scheduled_date", shiftLocalISODate(date, -1));
    if (error) return toast.error(error.message);
    if (!data?.length) return toast.message("Nothing to copy from the previous day");
    const rows = data.map(
      (r: { title: string; remind_at: string | null; goal_id: string | null }, i: number) => ({
        user_id: uid,
        title: r.title,
        remind_at: r.remind_at,
        goal_id: r.goal_id,
        scheduled_date: date,
        sort_order: todos.length + i,
      }),
    );
    const { error: insErr } = await lifeFrom("daily_todos").insert(rows);
    if (insErr) return toast.error(insErr.message);
    toast.success(`Copied ${rows.length} task${rows.length === 1 ? "" : "s"}`);
    cacheInvalidate("plan-day-");
    void load();
    void loadHistory();
  };

  const toggleNotify = async () => {
    if (notifyOn) {
      setNotificationsEnabled(false);
      setNotifyOn(false);
      return void toast("Reminders muted");
    }
    const perm = getNotifyPermission();
    if (perm === "unsupported") return toast.error("Notifications not supported here");
    if (perm === "denied") return toast.error("Enable notifications in your browser settings");
    const r = await requestNotificationPermission();
    setNotifyOn(r === "granted");
    if (r === "granted") toast.success("You'll get reminders for timed tasks");
  };

  return (
    <div className="space-y-5">
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d) => {
          const active = d.iso === date;
          return (
            <button
              key={d.iso}
              onClick={() => setDate(d.iso)}
              className={cn(
                "flex w-14 shrink-0 flex-col items-center rounded-2xl border py-2 text-xs transition-all active:scale-95",
                active ? "border-primary/60 text-primary" : "border-border text-muted-foreground",
              )}
              style={active ? { background: "var(--gradient-card)", boxShadow: "var(--shadow-glow)" } : undefined}
            >
              <span className="uppercase">{d.weekday}</span>
              <span className="font-display text-lg font-bold text-foreground">{d.day}</span>
              {d.iso === today && (
                <span className="text-[9px] uppercase tracking-wider text-primary">Today</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="h-9 w-40"
        />
        {date !== today && (
          <button onClick={() => setDate(today)} className="text-xs text-primary underline">
            Jump to today
          </button>
        )}
        <button
          onClick={toggleNotify}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground"
          aria-label={notifyOn ? "Mute reminders" : "Enable reminders"}
        >
          {notifyOn ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
        </button>
      </div>

      <div className="rounded-2xl border border-border p-4" style={{ background: "var(--gradient-card)" }}>
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            {formatLocalDay(date, { weekday: "short", month: "short", day: "numeric" })} · {doneCount}/
            {todos.length} done
          </span>
          <button onClick={copyPreviousDay} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Copy className="h-3.5 w-3.5" /> Copy previous day
          </button>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: "var(--gradient-primary)" }}
          />
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
        <Input
          placeholder="What needs to get done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
        />
        <div className="flex flex-wrap gap-2">
          <Input
            type="time"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
            className="h-10 w-28"
            title="Reminder time"
          />
          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            title="Link to a goal"
          >
            <option value="">No goal</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.parent_id ? "↳ " : ""}
                {g.title}
              </option>
            ))}
          </select>
          <Button onClick={add} disabled={saving} className="gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-32 rounded-2xl" />
      ) : todos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <p className="font-display font-semibold text-foreground">Nothing planned for this day</p>
          <p className="mt-1 text-sm text-muted-foreground">Add tasks above — future days work too.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {todos.map((t) => (
            <li
              key={t.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-border p-3.5 transition-all",
                t.completed && "opacity-60",
              )}
              style={{ background: "var(--gradient-card)" }}
            >
              <button
                onClick={() => toggle(t)}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition active:scale-90",
                  t.completed ? "border-transparent text-primary-foreground" : "border-border",
                )}
                style={t.completed ? { background: "var(--gradient-primary)" } : undefined}
                aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
              >
                {t.completed && <Check className="h-4 w-4" strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", t.completed && "line-through")}>{t.title}</p>
                <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                  <span>{t.remind_at ? `Remind ${t.remind_at.slice(0, 5)}` : "No reminder"}</span>
                  {goalTitle(t.goal_id) && (
                    <span className="flex items-center gap-1 text-primary">
                      <Link2 className="h-3 w-3" /> {goalTitle(t.goal_id)}
                    </span>
                  )}
                  {t.completed_at && (
                    <span>
                      · Done{" "}
                      {new Date(t.completed_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => remove(t.id)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Past days
          </h2>
          <ul className="space-y-1.5">
            {history.map((h) => (
              <li key={h.date}>
                <button
                  onClick={() => setDate(h.date)}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40"
                >
                  <span>{formatLocalDay(h.date, { weekday: "short", month: "short", day: "numeric" })}</span>
                  <span className="text-muted-foreground">
                    {h.done}/{h.total} done
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Week board: plan 7 days at once ─────────────── */

function startOfWeek(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const day = d.getDay();
  return shiftLocalISODate(iso, day === 0 ? -6 : 1 - day);
}

function WeekBoard() {
  const today = localISODate();
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const [todos, setTodos] = useState<DailyTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});


  const weekEnd = shiftLocalISODate(weekStart, 6);
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const iso = shiftLocalISODate(weekStart, i);
        const d = new Date(iso + "T12:00:00");
        return {
          iso,
          label: d.toLocaleDateString(undefined, { weekday: "short" }),
          day: d.getDate(),
        };
      }),
    [weekStart],
  );

  const load = async () => {
    setLoading(true);
    const { data, error } = await lifeFrom("daily_todos")
      .select(TODO_COLS)
      .gte("scheduled_date", weekStart)
      .lte("scheduled_date", weekEnd)
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setTodos((data as DailyTodo[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const add = async (iso: string) => {
    const value = (draft[iso] ?? "").trim();
    if (!value) return;
    const uid = await currentUserId();
    if (!uid) return;
    setDraft((p) => ({ ...p, [iso]: "" }));
    const { data, error } = await lifeFrom("daily_todos")
      .insert({
        user_id: uid,
        title: value,
        scheduled_date: iso,
        sort_order: todos.filter((t) => t.scheduled_date === iso).length,
      })
      .select(TODO_COLS)
      .single();
    if (error) {
      setDraft((p) => ({ ...p, [iso]: value }));
      return toast.error(error.message);
    }
    // Append locally so you can keep typing block after block without a refetch.
    if (data) setTodos((prev) => [...prev, data as DailyTodo]);
    cacheInvalidate("plan-day-");
    inputRefs.current[iso]?.focus();
  };


  const toggle = async (t: DailyTodo) => {
    const next = !t.completed;
    setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: next } : x)));
    await lifeFrom("daily_todos")
      .update({
        completed: next,
        completed_at: next ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", t.id);
    cacheInvalidate("plan-day-");
  };

  const remove = async (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    cacheInvalidate("plan-day-");
    await deleteWithUndo({
      table: "daily_todos",
      id,
      label: "Block",
      refresh: async () => {
        cacheInvalidate("plan-day-");
        await load();
      },
    });
  };


  const total = todos.length;
  const done = todos.filter((t) => t.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div
        className="flex items-center justify-between rounded-2xl border border-border p-4"
        style={{ background: "var(--gradient-card)" }}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Week of {formatLocalDay(weekStart, { month: "short", day: "numeric" })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {done}/{total} blocks done
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-3xl font-extrabold text-primary">{pct}%</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setWeekStart(shiftLocalISODate(weekStart, -7))}>
          ← Prev
        </Button>
        <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(today))}>
          This week
        </Button>
        <Button variant="outline" size="sm" onClick={() => setWeekStart(shiftLocalISODate(weekStart, 7))}>
          Next →
        </Button>
      </div>

      {loading ? (
        <div className="skeleton h-64 rounded-2xl" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {days.map((d) => {
            const items = todos.filter((t) => t.scheduled_date === d.iso);
            const isToday = d.iso === today;
            return (
              <div
                key={d.iso}
                className={cn(
                  "rounded-2xl border p-3",
                  isToday ? "border-primary/50" : "border-border",
                )}
                style={{ background: "var(--gradient-card)" }}
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="font-display text-sm font-bold text-foreground">
                    {d.label} {d.day}
                    {isToday && <span className="ml-1.5 text-[10px] uppercase text-primary">today</span>}
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {items.filter((i) => i.completed).length}/{items.length}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {items.map((t) => (
                    <li key={t.id} className="group flex items-center gap-2 text-sm">
                      <button
                        onClick={() => toggle(t)}
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition active:scale-90",
                          t.completed ? "border-transparent text-primary-foreground" : "border-border",
                        )}
                        style={t.completed ? { background: "var(--gradient-primary)" } : undefined}
                        aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
                      >
                        {t.completed && <Check className="h-3 w-3" strokeWidth={3} />}
                      </button>
                      <span className={cn("min-w-0 flex-1 truncate", t.completed && "line-through opacity-60")}>
                        {t.title}
                      </span>
                      <button
                        onClick={() => remove(t.id)}
                        className="opacity-0 transition group-hover:opacity-100"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    ref={(el) => {
                      inputRefs.current[d.iso] = el;
                    }}
                    value={draft[d.iso] ?? ""}
                    onChange={(e) => setDraft((p) => ({ ...p, [d.iso]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void add(d.iso);
                      }
                    }}
                    placeholder="+ Add block"
                    className="min-w-0 flex-1 rounded-lg border border-dashed border-border bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
                  />
                  <button
                    onClick={() => void add(d.iso)}
                    disabled={!(draft[d.iso] ?? "").trim()}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-primary transition active:scale-90 disabled:opacity-40"
                    aria-label={`Add block on ${d.label} ${d.day}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Goals with sub-goals ─────────────── */

const HORIZONS = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "year_1", label: "Yearly" },
] as const;

type Horizon = (typeof HORIZONS)[number]["key"];

function GoalsPanel() {
  const [horizon, setHorizon] = useState<Horizon>("weekly");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [subDraft, setSubDraft] = useState<Record<string, string>>({});

  const label = horizon === "weekly" ? "weekly" : horizon === "monthly" ? "monthly" : "yearly";

  const load = async () => {
    setLoading(true);
    const { data, error } = await lifeFrom("goals")
      .select(GOAL_COLS)
      .eq("horizon", horizon)
      .neq("status", "abandoned")
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setGoals((data as Goal[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizon]);

  const parents = goals.filter((g) => !g.parent_id);
  const childrenOf = (id: string) => goals.filter((g) => g.parent_id === id);

  /** Progress is always derived: from sub-goals when they exist, else stored value. */
  const progressOf = (g: Goal) => {
    const kids = childrenOf(g.id);
    if (kids.length === 0) return Math.round(g.progress);
    return Math.round((kids.filter((k) => k.status === "completed").length / kids.length) * 100);
  };

  const syncParentProgress = async (parentId: string, nextGoals: Goal[]) => {
    const kids = nextGoals.filter((g) => g.parent_id === parentId);
    if (!kids.length) return;
    const pct = Math.round((kids.filter((k) => k.status === "completed").length / kids.length) * 100);
    await lifeFrom("goals")
      .update({
        progress: pct,
        status: pct === 100 ? "completed" : "active",
        completed_at: pct === 100 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parentId);
    setGoals((prev) =>
      prev.map((g) =>
        g.id === parentId ? { ...g, progress: pct, status: pct === 100 ? "completed" : "active" } : g,
      ),
    );
  };

  const addGoal = async () => {
    if (!title.trim()) return toast.error("Give the goal a name");
    const uid = await currentUserId();
    if (!uid) return;
    const { error } = await lifeFrom("goals").insert({
      user_id: uid,
      title: title.trim(),
      horizon,
      target_date: targetDate || null,
    });
    if (error) return toast.error(error.message);
    setTitle("");
    setTargetDate("");
    toast.success("Goal added");
    void load();
  };

  const addSubGoal = async (parent: Goal) => {
    const value = (subDraft[parent.id] ?? "").trim();
    if (!value) return;
    const uid = await currentUserId();
    if (!uid) return;
    setSubDraft((p) => ({ ...p, [parent.id]: "" }));
    const { error } = await lifeFrom("goals").insert({
      user_id: uid,
      title: value,
      horizon: parent.horizon,
      parent_id: parent.id,
      target_date: parent.target_date,
    });
    if (error) return toast.error(error.message);
    await load();
  };

  const toggleSub = async (sub: Goal) => {
    const nextStatus = sub.status === "completed" ? "active" : "completed";
    const next = goals.map((g) =>
      g.id === sub.id
        ? { ...g, status: nextStatus, progress: nextStatus === "completed" ? 100 : 0 }
        : g,
    );
    setGoals(next);
    await lifeFrom("goals")
      .update({
        status: nextStatus,
        progress: nextStatus === "completed" ? 100 : 0,
        completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
    if (sub.parent_id) await syncParentProgress(sub.parent_id, next);
  };

  const setManualProgress = async (g: Goal, progress: number) => {
    setGoals((prev) => prev.map((x) => (x.id === g.id ? { ...x, progress } : x)));
    await lifeFrom("goals")
      .update({ progress, updated_at: new Date().toISOString() })
      .eq("id", g.id);
  };

  const completeGoal = async (g: Goal) => {
    setGoals((prev) =>
      prev.map((x) => (x.id === g.id ? { ...x, status: "completed", progress: 100 } : x)),
    );
    await lifeFrom("goals")
      .update({ status: "completed", progress: 100, completed_at: new Date().toISOString() })
      .eq("id", g.id);
    toast.success("Goal completed");
  };

  const removeGoal = async (g: Goal) => {
    const affected = goals.filter((x) => x.id === g.id || x.parent_id === g.id);
    setGoals((prev) => prev.filter((x) => x.id !== g.id && x.parent_id !== g.id));
    await lifeFrom("goals").update({ status: "abandoned" }).eq("id", g.id);
    await lifeFrom("goals").update({ status: "abandoned" }).eq("parent_id", g.id);
    toast("Goal removed", {
      duration: 8000,
      action: {
        label: "Undo",
        onClick: () => {
          void (async () => {
            for (const x of affected) {
              await lifeFrom("goals").update({ status: x.status }).eq("id", x.id);
            }
            setGoals((prev) => [...prev, ...affected.filter((x) => !prev.some((p) => p.id === x.id))]);
            toast.success("Goal restored");
          })();
        },
      },
    });
  };


  const scheduleToday = async (g: Goal) => {
    const uid = await currentUserId();
    if (!uid) return;
    const { error } = await lifeFrom("daily_todos").insert({
      user_id: uid,
      title: g.title,
      scheduled_date: localISODate(),
      goal_id: g.id,
    });
    if (error) return toast.error(error.message);
    cacheInvalidate("plan-day-");
    toast.success("Added to today's plan");
  };

  const activeParents = parents.filter((g) => g.status !== "completed");
  const avg = activeParents.length
    ? Math.round(activeParents.reduce((a, g) => a + progressOf(g), 0) / activeParents.length)
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {HORIZONS.map((h) => (
          <button
            key={h.key}
            onClick={() => setHorizon(h.key)}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all active:scale-95",
              horizon === h.key
                ? "border-primary/50 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {h.label}
          </button>
        ))}
      </div>

      <div
        className="flex items-center justify-between rounded-2xl border border-border p-4"
        style={{ background: "var(--gradient-card)" }}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            {label} goals
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeParents.length} active · {parents.length - activeParents.length} completed
          </p>
        </div>
        <span className="font-display text-3xl font-extrabold text-primary">{avg}%</span>
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
        <Input
          placeholder={`New ${label} goal…`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void addGoal()}
        />
        <div className="flex gap-2">
          <Input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="h-10 w-40"
            title="Target date (optional)"
          />
          <Button onClick={addGoal} className="flex-1 gap-1">
            <Plus className="h-4 w-4" /> Add goal
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : parents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <Target className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-2 font-display font-semibold text-foreground">No {label} goals yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add one, then break it into sub-goals you can actually schedule.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {parents.map((g) => {
            const kids = childrenOf(g.id);
            const pct = progressOf(g);
            const expanded = open[g.id] ?? kids.length > 0;
            return (
              <li key={g.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => setOpen((p) => ({ ...p, [g.id]: !expanded }))}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  >
                    {expanded ? (
                      <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-display font-bold text-foreground">{g.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {kids.length > 0
                          ? `${kids.filter((k) => k.status === "completed").length}/${kids.length} sub-goals`
                          : "No sub-goals yet"}
                        {g.target_date
                          ? ` · by ${formatLocalDay(g.target_date, { month: "short", day: "numeric" })}`
                          : ""}
                        {g.status === "completed" ? " · Completed" : ""}
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="font-display text-lg font-extrabold text-primary">{pct}%</span>
                    <button
                      onClick={() => scheduleToday(g)}
                      className="rounded-lg p-2 text-muted-foreground hover:text-primary"
                      title="Add to today's plan"
                    >
                      <CalendarPlus className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeGoal(g)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete goal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: "var(--gradient-primary)" }}
                  />
                </div>

                {expanded && (
                  <div className="mt-3 space-y-2 border-l border-border pl-3">
                    {kids.map((k) => (
                      <div key={k.id} className="group flex items-center gap-2">
                        <button
                          onClick={() => toggleSub(k)}
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition active:scale-90",
                            k.status === "completed"
                              ? "border-transparent text-primary-foreground"
                              : "border-border",
                          )}
                          style={
                            k.status === "completed" ? { background: "var(--gradient-primary)" } : undefined
                          }
                          aria-label={k.status === "completed" ? "Mark incomplete" : "Mark complete"}
                        >
                          {k.status === "completed" && <Check className="h-3 w-3" strokeWidth={3} />}
                        </button>
                        <span
                          className={cn(
                            "min-w-0 flex-1 text-sm",
                            k.status === "completed" && "line-through opacity-60",
                          )}
                        >
                          {k.title}
                        </span>
                        <button
                          onClick={() => scheduleToday(k)}
                          className="rounded p-1 text-muted-foreground opacity-0 transition hover:text-primary group-hover:opacity-100"
                          title="Add to today's plan"
                        >
                          <CalendarPlus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeGoal(k)}
                          className="rounded p-1 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                          aria-label="Delete sub-goal"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}

                    <input
                      value={subDraft[g.id] ?? ""}
                      onChange={(e) => setSubDraft((p) => ({ ...p, [g.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && void addSubGoal(g)}
                      placeholder="+ Add sub-goal"
                      className="w-full rounded-lg border border-dashed border-border bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
                    />

                    {kids.length === 0 && g.status !== "completed" && (
                      <div className="pt-1">
                        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                          <span>Manual progress</span>
                          <span>{Math.round(g.progress)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={g.progress}
                          onChange={(e) => setManualProgress(g, Number(e.target.value))}
                          className="w-full accent-[var(--primary)]"
                        />
                        <button
                          onClick={() => completeGoal(g)}
                          className="mt-1 text-xs text-primary hover:underline"
                        >
                          Mark goal complete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
