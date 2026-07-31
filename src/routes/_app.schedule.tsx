import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, Check, Trash2, Bell, BellOff, Copy } from "lucide-react";
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

export const Route = createFileRoute("/_app/schedule")({
  head: () => ({ meta: [{ title: "Daily Schedule — Forge" }] }),
  component: SchedulePage,
});

type DailyTodo = {
  id: string;
  title: string;
  notes: string | null;
  scheduled_date: string;
  completed: boolean;
  completed_at: string | null;
  remind_at: string | null;
  sort_order: number;
};

function SchedulePage() {
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
      .select("id,title,notes,scheduled_date,completed,completed_at,remind_at,sort_order")
      .eq("scheduled_date", d)
      .order("completed", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setTodos((data as DailyTodo[]) ?? []);
    setLoading(false);
  };

  const loadHistory = async () => {
    const sinceStr = shiftLocalISODate(localISODate(), -13);
    const { data } = await lifeFrom("daily_todos")
      .select("scheduled_date,completed")
      .gte("scheduled_date", sinceStr)
      .order("scheduled_date", { ascending: false });
    const map = new Map<string, { total: number; done: number }>();
    for (const row of data ?? []) {
      const cur = map.get(row.scheduled_date) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (row.completed) cur.done += 1;
      map.set(row.scheduled_date, cur);
    }
    setHistory(
      [...map.entries()].map(([d, v]) => ({ date: d, total: v.total, done: v.done })).slice(0, 14),
    );
  };

  useEffect(() => {
    void load(date);
  }, [date]);

  useEffect(() => {
    void loadHistory();
  }, []);

  // In-tab reminders for today's incomplete todos with remind_at
  useEffect(() => {
    if (!notifyOn || date !== today) return;
    const fired = new Set<string>();
    const tick = () => {
      if (!notificationsEnabled()) return;
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      for (const t of todos) {
        if (t.completed || !t.remind_at) continue;
        const remind = t.remind_at.slice(0, 5);
        if (remind === hhmm && !fired.has(t.id)) {
          fired.add(t.id);
          fireNotification("Daily schedule", t.title);
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [todos, notifyOn, date]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const iso = shiftLocalISODate(date, i - 3);
      const d = new Date(iso + "T12:00:00");
      return {
        iso,
        day: d.getDate(),
        weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
      };
    });
  }, [date]);

  const doneCount = todos.filter((t) => t.completed).length;

  const add = async () => {
    if (!title.trim()) return toast.error("Add a task title");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSaving(false);
      return;
    }
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
    toast.success("Added to schedule");
    void load();
    void loadHistory();
  };

  const toggle = async (todo: DailyTodo) => {
    const next = !todo.completed;
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id
          ? { ...t, completed: next, completed_at: next ? new Date().toISOString() : null }
          : t,
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
      void load();
      return;
    }
    if (next) toast.success("Done");
    void loadHistory();
  };

  const remove = async (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    const { error } = await lifeFrom("daily_todos").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      void load();
      return;
    }
    void loadHistory();
  };

  const copyYesterday = async () => {
    const yIso = shiftLocalISODate(date, -1);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await lifeFrom("daily_todos")
      .select("title,notes,remind_at")
      .eq("scheduled_date", yIso);
    if (error) return toast.error(error.message);
    if (!data?.length) return toast.message("Nothing to copy from previous day");
    const rows = data.map((r: { title: string; notes: string | null; remind_at: string | null }, i: number) => ({
      user_id: u.user!.id,
      title: r.title,
      notes: r.notes,
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
      toast("Schedule notifications muted");
      return;
    }
    const perm = getNotifyPermission();
    if (perm === "unsupported") return toast.error("Notifications not supported here");
    if (perm === "denied") return toast.error("Enable notifications in browser settings");
    const r = await requestNotificationPermission();
    setNotifyOn(r === "granted");
    if (r === "granted") {
      toast.success("You'll get reminders for timed tasks");
      fireNotification("Daily Schedule", "Reminders enabled for today's tasks.");
    }
  };

  return (
    <div className="space-y-5 animate-page-in">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Today's plan</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <CalendarDays className="h-6 w-6 text-primary" /> Daily Schedule
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add what you must finish today. Check them off — every day is saved.
          </p>
        </div>
        <button
          onClick={toggleNotify}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground"
          aria-label={notifyOn ? "Mute reminders" : "Enable reminders"}
        >
          {notifyOn ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
        </button>
      </header>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d) => {
          const active = d.iso === date;
          const isToday = d.iso === today;
          return (
            <button
              key={d.iso}
              onClick={() => setDate(d.iso)}
              className={cn(
                "flex w-14 shrink-0 flex-col items-center rounded-2xl border py-2 text-xs transition",
                active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
              )}
            >
              <span className="uppercase">{d.weekday}</span>
              <span className="text-lg font-bold text-foreground">{d.day}</span>
              {isToday && <span className="text-[9px] uppercase tracking-wider text-primary">Today</span>}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
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
      </div>

      <div
        className="rounded-2xl border border-border p-4"
        style={{ background: "var(--gradient-card)" }}
      >
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {doneCount}/{todos.length} done
          </span>
          <button
            onClick={copyYesterday}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Copy className="h-3.5 w-3.5" /> Copy previous day
          </button>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${todos.length ? Math.round((doneCount / todos.length) * 100) : 0}%`,
              background: "var(--gradient-primary)",
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 sm:flex-row">
        <Input
          placeholder="What do you need to finish?"
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
        <div className="h-32 animate-pulse rounded-2xl bg-card" />
      ) : todos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <p className="font-medium text-foreground">No tasks for this day</p>
          <p className="mt-1 text-sm text-muted-foreground">Add your must-dos above.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {todos.map((t) => (
            <li
              key={t.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-border p-3.5",
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
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent days
          </h2>
          <ul className="space-y-1.5">
            {history.map((h) => (
              <li key={h.date}>
                <button
                  onClick={() => setDate(h.date)}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm hover:border-primary/40"
                >
                  <span>
                    {formatLocalDay(h.date, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
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
