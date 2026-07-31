import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Clock, Trash2, Play, Square, Sparkles, Tag, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatLocalDay, localISODate, shiftLocalISODate } from "@/lib/dates";
import { lifeFrom } from "@/lib/lifeos-db";

export const Route = createFileRoute("/_app/timelog")({
  head: () => ({ meta: [{ title: "Time Log — Forge" }] }),
  component: TimeLogPage,
});

type Entry = {
  id: string;
  activity: string;
  category: string | null;
  log_date: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
};

const CATEGORIES = [
  { label: "Work", color: "var(--primary)", depth: "shallow" as const },
  { label: "Deep Work", color: "var(--accent)", depth: "deep" as const },
  { label: "Study", color: "var(--accent)", depth: "deep" as const },
  { label: "Exercise", color: "var(--warning)", depth: "shallow" as const },
  { label: "Meeting", color: "var(--muted-foreground)", depth: "meeting" as const },
  { label: "Personal", color: "var(--success)", depth: "shallow" as const },
  { label: "Break", color: "var(--muted-foreground)", depth: "break" as const },
  { label: "Other", color: "var(--muted-foreground)", depth: "shallow" as const },
];

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDur = (m: number | null) => {
  if (m == null) return "—";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
};
const toHHMM = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function entryTitle(e: Pick<Entry, "activity" | "category">) {
  if (e.activity && e.category && e.activity !== e.category) return e.activity;
  return e.activity || e.category || "Entry";
}

function TimeLogPage() {
  const today = localISODate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState<string | null>(null);
  const [recentDays, setRecentDays] = useState<{ date: string; minutes: number; count: number }[]>([]);

  const [manualTime, setManualTime] = useState(toHHMM(new Date()));
  const [manualEnd, setManualEnd] = useState("");
  const [manualCat, setManualCat] = useState("Work");
  const [manualActivity, setManualActivity] = useState("");

  const weekDays = useMemo(() => {
    // Center strip on selected date (±3 days)
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

  const load = async (d = date) => {
    setLoading(true);
    const { data } = await supabase
      .from("time_logs")
      .select("id,activity,category,log_date,start_time,end_time,duration_minutes,notes")
      .eq("log_date", d)
      .order("start_time", { ascending: true });
    setEntries((data ?? []) as Entry[]);
    setLoading(false);
  };

  const loadRecent = async () => {
    const since = shiftLocalISODate(today, -20);
    const { data } = await supabase
      .from("time_logs")
      .select("log_date,duration_minutes")
      .gte("log_date", since)
      .order("log_date", { ascending: false });
    const map = new Map<string, { minutes: number; count: number }>();
    for (const row of data ?? []) {
      const cur = map.get(row.log_date) ?? { minutes: 0, count: 0 };
      cur.minutes += row.duration_minutes ?? 0;
      cur.count += 1;
      map.set(row.log_date, cur);
    }
    setRecentDays(
      [...map.entries()]
        .map(([d, v]) => ({ date: d, minutes: v.minutes, count: v.count }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 14),
    );
  };

  useEffect(() => {
    void load(date);
  }, [date]);

  useEffect(() => {
    void loadRecent();
  }, []);

  const ongoing = useMemo(() => entries.find((e) => !e.end_time), [entries]);

  const insertEntry = async (payload: {
    activity: string;
    category: string;
    log_date: string;
    start_time: string;
    end_time: string | null;
    duration_minutes: number | null;
    notes?: string | null;
  }) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { error: { message: "Not signed in" } };
    const depth = CATEGORIES.find((c) => c.label === payload.category)?.depth ?? "shallow";
    const row = {
      user_id: u.user.id,
      ...payload,
      notes: payload.notes ?? null,
      work_depth: depth,
    };
    const { error } = await lifeFrom("time_logs").insert(row);
    if (!error) return { error: null };
    // Fallback without work_depth if column missing
    const { error: e2 } = await supabase.from("time_logs").insert({
      user_id: u.user.id,
      activity: payload.activity,
      category: payload.category,
      log_date: payload.log_date,
      start_time: payload.start_time,
      end_time: payload.end_time,
      duration_minutes: payload.duration_minutes,
      notes: payload.notes ?? null,
    });
    return { error: e2 };
  };

  const insertPoint = async (category: string, when: Date) => {
    setSaving(category);
    const iso = when.toISOString();
    const logDate = localISODate(when);
    const { error } = await insertEntry({
      activity: category,
      category,
      log_date: logDate,
      start_time: iso,
      end_time: iso,
      duration_minutes: 0,
    });
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success(`${category} · ${fmtTime(iso)}`);
    if (logDate !== date) setDate(logDate);
    else void load();
    void loadRecent();
  };

  const startTimer = async (category: string) => {
    setSaving(category);
    const iso = new Date().toISOString();
    const logDate = today;
    const { error } = await insertEntry({
      activity: category,
      category,
      log_date: logDate,
      start_time: iso,
      end_time: null,
      duration_minutes: null,
    });
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success(`Started ${category}`);
    if (logDate !== date) setDate(logDate);
    else void load();
    void loadRecent();
  };

  const stopOngoing = async (e: Entry) => {
    const nowISO = new Date().toISOString();
    const dur = Math.max(0, Math.round((Date.now() - new Date(e.start_time).getTime()) / 60000));
    const { error } = await supabase
      .from("time_logs")
      .update({ end_time: nowISO, duration_minutes: dur })
      .eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success(`Stopped · ${fmtDur(dur)}`);
    void load();
    void loadRecent();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("time_logs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setEntries((es) => es.filter((x) => x.id !== id));
    void loadRecent();
  };

  const submitManual = async () => {
    const [hh, mm] = manualTime.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return toast.error("Pick a start time");
    const [y, mo, d] = date.split("-").map(Number);
    const start = new Date(y, mo - 1, d, hh, mm, 0, 0);
    const label = manualActivity.trim() || manualCat;
    const notes = manualActivity.trim() && manualActivity.trim() !== manualCat ? manualActivity.trim() : null;

    if (!manualEnd) {
      setSaving(manualCat);
      const { error } = await insertEntry({
        activity: label,
        category: manualCat,
        log_date: date, // keep selected calendar day
        start_time: start.toISOString(),
        end_time: start.toISOString(),
        duration_minutes: 0,
        notes,
      });
      setSaving(null);
      if (error) return toast.error(error.message);
      toast.success(`${label} · ${fmtTime(start.toISOString())}`);
      setManualActivity("");
      void load();
      void loadRecent();
      return;
    }

    const [eh, em] = manualEnd.split(":").map(Number);
    if (Number.isNaN(eh) || Number.isNaN(em)) return toast.error("Pick an end time");
    const end = new Date(y, mo - 1, d, eh, em, 0, 0);
    if (end.getTime() <= start.getTime()) return toast.error("End must be after start");
    const dur = Math.round((end.getTime() - start.getTime()) / 60000);
    setSaving(manualCat);
    const { error } = await insertEntry({
      activity: label,
      category: manualCat,
      log_date: date,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration_minutes: dur,
      notes,
    });
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success(`${label} · ${fmtDur(dur)}`);
    setManualActivity("");
    setManualEnd("");
    void load();
    void loadRecent();
  };

  const totalMin = useMemo(
    () => entries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0),
    [entries],
  );
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      const key = e.category || "Other";
      m.set(key, (m.get(key) ?? 0) + (e.duration_minutes ?? 0));
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  return (
    <div className="space-y-5 animate-page-in">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Clock className="h-6 w-6 text-primary" />
          Time Log
        </h1>
        <p className="text-sm text-muted-foreground">
          Log what you did — browse any past day to see history.
        </p>
      </div>

      {/* Week strip + jump */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setDate(shiftLocalISODate(date, -7))}
            className="rounded-xl border border-border p-2 text-muted-foreground hover:text-foreground"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-medium text-foreground">
            {formatLocalDay(date, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
          </p>
          <button
            onClick={() => setDate(shiftLocalISODate(date, 7))}
            className="rounded-xl border border-border p-2 text-muted-foreground hover:text-foreground"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {weekDays.map((d) => {
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
      </div>

      {/* One-tap quick log */}
      <div
        className="rounded-3xl border border-border p-4"
        style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-glow)" }}
      >
        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Zap className="h-3.5 w-3.5 text-primary" /> Tap to log · now
        </p>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.label}
              onClick={() => insertPoint(c.label, new Date())}
              disabled={saving === c.label}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-border px-3 py-3 text-left transition-all",
                "hover:scale-[1.03] active:scale-95 disabled:opacity-60",
              )}
              style={{ background: "var(--gradient-card)" }}
            >
              <span
                className="mb-1.5 inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }}
              />
              <p className="text-sm font-semibold text-foreground">{c.label}</p>
              <p className="text-[10px] text-muted-foreground">now · {toHHMM(new Date())}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border/70 p-3">
          {ongoing ? (
            <>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-primary">Live</p>
                <p className="truncate text-sm font-semibold text-foreground">
                  {entryTitle(ongoing)} · started {fmtTime(ongoing.start_time)}
                </p>
                {ongoing.category && ongoing.activity !== ongoing.category && (
                  <p className="text-[10px] text-muted-foreground">{ongoing.category}</p>
                )}
              </div>
              <button
                onClick={() => stopOngoing(ongoing)}
                className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition active:scale-95"
              >
                <Square className="h-3.5 w-3.5" /> Stop
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Or start a live timer</p>
              <div className="flex gap-1.5 overflow-x-auto">
                {CATEGORIES.slice(0, 4).map((c) => (
                  <button
                    key={c.label}
                    onClick={() => startTimer(c.label)}
                    className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-primary/50 active:scale-95"
                  >
                    <Play className="h-3 w-3" style={{ color: c.color }} /> {c.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Manual entry */}
      <div className="rounded-2xl border border-border p-4" style={{ background: "var(--gradient-card)" }}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Add with details
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="col-span-1 flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Start</span>
            <Input type="time" value={manualTime} onChange={(e) => setManualTime(e.target.value)} className="h-10" />
          </label>
          <label className="col-span-1 flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">End · optional</span>
            <Input type="time" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} className="h-10" />
          </label>
          <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</span>
            <select
              value={manualCat}
              onChange={(e) => setManualCat(e.target.value)}
              className="h-10 rounded-md border border-border bg-transparent px-2 text-sm text-foreground"
            >
              {CATEGORIES.map((c) => (
                <option key={c.label} value={c.label} className="bg-background">
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">What you did</span>
            <Input
              type="text"
              placeholder="e.g. Design review"
              value={manualActivity}
              onChange={(e) => setManualActivity(e.target.value)}
              className="h-10"
            />
          </label>
        </div>
        <button
          onClick={submitManual}
          className="mt-3 h-10 w-full rounded-md px-4 text-sm font-semibold text-primary-foreground transition active:scale-95"
          style={{ background: "var(--gradient-primary)" }}
        >
          {manualEnd ? "Add range" : "Add at time"}
        </button>
      </div>

      <div
        className="flex items-center justify-between gap-3 rounded-2xl border border-border p-4"
        style={{ background: "var(--gradient-card)" }}
      >
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">This day</p>
          <p className="text-sm font-medium text-foreground">{entries.length} entries</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="text-xl font-bold text-foreground">{fmtDur(totalMin)}</p>
        </div>
      </div>

      {byCategory.length > 0 && totalMin > 0 && (
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--gradient-card)" }}>
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Tag className="h-3.5 w-3.5" /> By category
          </p>
          <div className="space-y-2">
            {byCategory.map(([cat, min]) => {
              const pct = totalMin > 0 ? (min / totalMin) * 100 : 0;
              const color = CATEGORIES.find((c) => c.label === cat)?.color || "var(--primary)";
              return (
                <div key={cat}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-foreground">{cat}</span>
                    <span className="text-muted-foreground">{fmtDur(min)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-2xl bg-card" />
          <div className="h-16 animate-pulse rounded-2xl bg-card" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm font-medium text-foreground">Nothing logged this day</p>
          <p className="text-xs text-muted-foreground">Tap a category or add details above.</p>
        </div>
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-5">
          {entries.map((e) => {
            const cat = CATEGORIES.find((c) => c.label === e.category) || CATEGORIES[5];
            const live = !e.end_time;
            const isPoint = e.end_time && e.duration_minutes === 0;
            const title = entryTitle(e);
            const showCat = Boolean(e.category && e.activity && e.activity !== e.category);
            return (
              <li key={e.id} className="relative">
                <span
                  className="absolute -left-[27px] top-3 h-3 w-3 rounded-full ring-4 ring-background"
                  style={{ background: cat.color, boxShadow: live ? "var(--shadow-glow)" : undefined }}
                />
                <article
                  className="rounded-2xl border border-border p-3 transition hover:border-primary/40"
                  style={{ background: "var(--gradient-card)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                        {showCat && (
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                            {e.category}
                          </span>
                        )}
                        {live && (
                          <span className="animate-pulse rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                            live
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {isPoint
                          ? fmtTime(e.start_time)
                          : `${fmtTime(e.start_time)}${e.end_time ? ` – ${fmtTime(e.end_time)}` : " · ongoing"} · ${fmtDur(e.duration_minutes)}`}
                      </p>
                      {e.notes && e.notes !== title && (
                        <p className="mt-1 text-xs text-muted-foreground">{e.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {live && (
                        <button
                          onClick={() => stopOngoing(e)}
                          className="rounded-lg p-1.5 text-primary hover:bg-primary/10"
                          aria-label="Stop"
                        >
                          <Square className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => remove(e.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}

      {recentDays.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent days (tap to open)
          </h2>
          <ul className="space-y-1.5">
            {recentDays.map((h) => (
              <li key={h.date}>
                <button
                  onClick={() => setDate(h.date)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm",
                    h.date === date ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <span>
                    {formatLocalDay(h.date, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <span className="text-muted-foreground">
                    {h.count} · {fmtDur(h.minutes)}
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
