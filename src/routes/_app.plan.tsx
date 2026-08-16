import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Plus,
  Check,
  Trash2,
  Bell,
  BellOff,
  Copy,
  Target,
  ChevronRight,
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

export const Route = createFileRoute("/_app/plan")({
  head: () => ({
    meta: [
      { title: "Plan — daily schedule & goals | Forge" },
      {
        name: "description",
        content:
          "One place to plan ahead: build daily to-do lists for any date and track weekly, monthly and yearly goals.",
      },
      { property: "og:title", content: "Plan — daily schedule & goals | Forge" },
      {
        property: "og:description",
        content: "Plan days in advance, tick them off daily, and steer weekly, monthly and yearly goals.",
      },
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
};

type Goal = {
  id: string;
  title: string;
  horizon: string;
  progress: number;
  status: string;
  target_date: string | null;
};

const TABS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "year_1", label: "Yearly" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function PlanPage() {
  const [tab, setTab] = useState<TabKey>("daily");

  return (
    <div className="animate-page-in">
      <header className="border-b border-border pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Everything you plan
        </p>
        <h1 className="font-display text-3xl font-extrabold text-foreground">Plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build your to-do list days in advance, then tick it off. Weekly, monthly and yearly goals
          live here too.
        </p>
      </header>

      <div className="-mx-4 border-b border-border px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all active:scale-95",
                tab === t.key
                  ? "border-primary/50 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
              style={tab === t.key ? { background: "var(--gradient-card)", boxShadow: "var(--shadow-glow)" } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {tab === "daily" ? <DailyPlanner /> : <GoalBoard horizon={tab} />}
      </div>
    </div>
  );
}

/* ─────────────── Daily to-do list (any date, plan ahead) ─────────────── */

function DailyPlanner() {
  const today = localISODate();
  const [date, setDate] = useState(today);
  const [todos, setTodos] = useState<DailyTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [notifyOn, setNotifyOn] = useState(notificationsEnabled());
  const [history, setHistory] = useState<{ date: string; total: number; done: number }[]>([]);

  const load = async (d = date) => {
    setLoading(true);
    const { data, error } = await lifeFrom("daily_todos")
      .select("id,title,scheduled_date,completed,completed_at,remind_at,sort_order")
      .eq("scheduled_date", d)
      .order("completed", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setTodos((data as DailyTodo[]) ?? []);
    setLoading(false);
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

  // Show yesterday → +5 days so tasks can be created in advance.
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
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setSaving(false);
    const { error } = await lifeFrom("daily_todos").insert({
      user_id: u.user.id,
      title: title.trim(),
      scheduled_date: date,
      remind_at: remindAt || null,
      sort_order: todos.length,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setTitle("");
    setRemindAt("");
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
    if (error) {
      toast.error(error.message);
      return void load();
    }
    void loadHistory();
  };

  const remove = async (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    const { error } = await lifeFrom("daily_todos").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return void load();
    }
    void loadHistory();
  };

  const copyPreviousDay = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await lifeFrom("daily_todos")
      .select("title,remind_at")
      .eq("scheduled_date", shiftLocalISODate(date, -1));
    if (error) return toast.error(error.message);
    if (!data?.length) return toast.message("Nothing to copy from the previous day");
    const rows = data.map((r: { title: string; remind_at: string | null }, i: number) => ({
      user_id: u.user!.id,
      title: r.title,
      remind_at: r.remind_at,
      scheduled_date: date,
      sort_order: todos.length + i,
    }));
    const { error: insErr } = await lifeFrom("daily_todos").insert(rows);
    if (insErr) return toast.error(insErr.message);
    toast.success(`Copied ${rows.length} task${rows.length === 1 ? "" : "s"}`);
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

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 sm:flex-row">
        <Input
          placeholder="What needs to get done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          className="flex-1"
        />
        <Input
          type="time"
          value={remindAt}
          onChange={(e) => setRemindAt(e.target.value)}
          className="w-full sm:w-32"
          title="Reminder time"
        />
        <Button onClick={add} disabled={saving} className="gap-1">
          <Plus className="h-4 w-4" /> Add
        </Button>
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
                <p className="text-[11px] text-muted-foreground">
                  {t.remind_at ? `Remind ${t.remind_at.slice(0, 5)}` : "No reminder"}
                  {t.completed_at
                    ? ` · Done ${new Date(t.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : ""}
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

/* ─────────────── Weekly / monthly / yearly goals ─────────────── */

function GoalBoard({ horizon }: { horizon: Exclude<TabKey, "daily"> }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const label = horizon === "weekly" ? "weekly" : horizon === "monthly" ? "monthly" : "yearly";

  const load = async () => {
    setLoading(true);
    const { data, error } = await lifeFrom("goals")
      .select("id,title,horizon,progress,status,target_date")
      .eq("horizon", horizon)
      .neq("status", "abandoned")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setGoals((data as Goal[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [horizon]);

  const add = async () => {
    if (!title.trim()) return toast.error("Give the goal a name");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await lifeFrom("goals").insert({
      user_id: u.user.id,
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

  const setProgress = async (id: string, progress: number) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, progress } : g)));
    await lifeFrom("goals").update({ progress, updated_at: new Date().toISOString() }).eq("id", id);
  };

  const complete = async (id: string) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, status: "completed", progress: 100 } : g)),
    );
    await lifeFrom("goals")
      .update({ status: "completed", progress: 100, completed_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Goal completed");
  };

  const remove = async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    await lifeFrom("goals").update({ status: "abandoned" }).eq("id", id);
  };

  const active = goals.filter((g) => g.status === "active");
  const avg = active.length
    ? Math.round(active.reduce((a, g) => a + g.progress, 0) / active.length)
    : 0;

  return (
    <div className="space-y-5">
      <div
        className="flex items-center justify-between rounded-2xl border border-border p-4"
        style={{ background: "var(--gradient-card)" }}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            {label} goals
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {active.length} active · {goals.length - active.length} completed
          </p>
        </div>
        <span className="font-display text-3xl font-extrabold text-primary">{avg}%</span>
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
        <Input
          placeholder={`New ${label} goal…`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
        />
        <div className="flex gap-2">
          <Input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="h-10 w-40"
            title="Target date (optional)"
          />
          <Button onClick={add} className="flex-1 gap-1">
            <Plus className="h-4 w-4" /> Add goal
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : goals.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <Target className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-2 font-display font-semibold text-foreground">No {label} goals yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Set one and track it to 100%.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => (
            <li key={g.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-bold text-foreground">{g.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {g.target_date ? `By ${formatLocalDay(g.target_date, { month: "short", day: "numeric" })}` : "No target date"}
                    {g.status === "completed" ? " · Completed" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {g.status === "active" && (
                    <button
                      onClick={() => complete(g.id)}
                      className="rounded-lg p-2 text-success hover:bg-muted"
                      title="Mark complete"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => remove(g.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete goal"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{Math.round(g.progress)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={g.progress}
                  onChange={(e) => setProgress(g.id, Number(e.target.value))}
                  className="w-full accent-[var(--primary)]"
                  disabled={g.status !== "active"}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
