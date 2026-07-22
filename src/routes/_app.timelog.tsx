import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Clock, Trash2, Play, Square, Sparkles, Tag, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  { label: "Work", color: "var(--primary)" },
  { label: "Study", color: "var(--accent)" },
  { label: "Exercise", color: "var(--warning)" },
  { label: "Personal", color: "var(--success)" },
  { label: "Break", color: "var(--muted-foreground)" },
  { label: "Other", color: "var(--muted-foreground)" },
];

const todayISO = () => new Date().toISOString().slice(0, 10);
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

function TimeLogPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState<string | null>(null);

  // Manual quick-add: time + optional end time + category + optional activity
  const [manualTime, setManualTime] = useState(toHHMM(new Date()));
  const [manualEnd, setManualEnd] = useState("");
  const [manualCat, setManualCat] = useState("Work");
  const [manualActivity, setManualActivity] = useState("");

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

  useEffect(() => {
    void load(date);
  }, [date]);

  const ongoing = useMemo(() => entries.find((e) => !e.end_time), [entries]);

  const insertPoint = async (category: string, when: Date) => {
    setSaving(category);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSaving(null); return; }
    const iso = when.toISOString();
    const { error } = await supabase.from("time_logs").insert({
      user_id: u.user.id,
      activity: category,
      category,
      log_date: iso.slice(0, 10),
      start_time: iso,
      end_time: iso,
      duration_minutes: 0,
      notes: null,
    });
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success(`${category} · ${fmtTime(iso)}`);
    if (iso.slice(0, 10) !== date) setDate(iso.slice(0, 10));
    else void load();
  };

  const startTimer = async (category: string) => {
    setSaving(category);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSaving(null); return; }
    const iso = new Date().toISOString();
    const { error } = await supabase.from("time_logs").insert({
      user_id: u.user.id,
      activity: category,
      category,
      log_date: iso.slice(0, 10),
      start_time: iso,
      end_time: null,
      duration_minutes: null,
      notes: null,
    });
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success(`Started ${category}`);
    void load();
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
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("time_logs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setEntries((es) => es.filter((x) => x.id !== id));
  };

  const submitManual = async () => {
    const [hh, mm] = manualTime.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return toast.error("Pick a start time");
    const start = new Date(date + "T00:00:00");
    start.setHours(hh, mm, 0, 0);

    // No end time → point log (existing behavior)
    if (!manualEnd) {
      const label = manualActivity.trim() || manualCat;
      setSaving(manualCat);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setSaving(null); return; }
      const iso = start.toISOString();
      const { error } = await supabase.from("time_logs").insert({
        user_id: u.user.id,
        activity: label,
        category: manualCat,
        log_date: iso.slice(0, 10),
        start_time: iso,
        end_time: iso,
        duration_minutes: 0,
        notes: null,
      });
      setSaving(null);
      if (error) return toast.error(error.message);
      toast.success(`${label} · ${fmtTime(iso)}`);
      setManualActivity("");
      if (iso.slice(0, 10) !== date) setDate(iso.slice(0, 10)); else void load();
      return;
    }

    // With end time → range log
    const [eh, em] = manualEnd.split(":").map(Number);
    if (Number.isNaN(eh) || Number.isNaN(em)) return toast.error("Pick an end time");
    const end = new Date(date + "T00:00:00");
    end.setHours(eh, em, 0, 0);
    if (end.getTime() <= start.getTime()) return toast.error("End must be after start");
    const dur = Math.round((end.getTime() - start.getTime()) / 60000);
    const label = manualActivity.trim() || manualCat;
    setSaving(manualCat);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSaving(null); return; }
    const startIso = start.toISOString();
    const { error } = await supabase.from("time_logs").insert({
      user_id: u.user.id,
      activity: label,
      category: manualCat,
      log_date: startIso.slice(0, 10),
      start_time: startIso,
      end_time: end.toISOString(),
      duration_minutes: dur,
      notes: null,
    });
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success(`${label} · ${fmtDur(dur)}`);
    setManualActivity("");
    setManualEnd("");
    if (startIso.slice(0, 10) !== date) setDate(startIso.slice(0, 10)); else void load();
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
        <p className="text-sm text-muted-foreground">One tap. Time is added automatically.</p>
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

        {/* Live timer (optional) */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border/70 p-3">
          {ongoing ? (
            <>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-primary">Live</p>
                <p className="truncate text-sm font-semibold text-foreground">
                  {ongoing.category} · started {fmtTime(ongoing.start_time)}
                </p>
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
              <div className="flex gap-1.5">
                {CATEGORIES.slice(0, 4).map((c) => (
                  <button
                    key={c.label}
                    onClick={() => startTimer(c.label)}
                    className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-primary/50 active:scale-95"
                  >
                    <Play className="h-3 w-3" style={{ color: c.color }} /> {c.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Manual: just pick a time */}
      <div
        className="rounded-2xl border border-border p-4"
        style={{ background: "var(--gradient-card)" }}
      >
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Add at a specific time
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={manualTime}
            onChange={(e) => setManualTime(e.target.value)}
            className="h-10 w-32"
          />
          <select
            value={manualCat}
            onChange={(e) => setManualCat(e.target.value)}
            className="h-10 flex-1 rounded-md border border-border bg-transparent px-2 text-sm text-foreground"
          >
            {CATEGORIES.map((c) => (
              <option key={c.label} value={c.label} className="bg-background">
                {c.label}
              </option>
            ))}
          </select>
          <button
            onClick={submitManual}
            className="h-10 rounded-md px-4 text-sm font-semibold text-primary-foreground transition active:scale-95"
            style={{ background: "var(--gradient-primary)" }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Date + totals */}
      <div
        className="flex items-center justify-between gap-3 rounded-2xl border border-border p-4"
        style={{ background: "var(--gradient-card)" }}
      >
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Viewing</p>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 h-8 w-40 border-border bg-transparent p-2 text-sm"
          />
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
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: color }}
                    />
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
          <p className="mt-3 text-sm font-medium text-foreground">Nothing logged yet</p>
          <p className="text-xs text-muted-foreground">Tap any category above to log now.</p>
        </div>
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-5">
          {entries.map((e) => {
            const cat = CATEGORIES.find((c) => c.label === e.category) || CATEGORIES[5];
            const live = !e.end_time;
            const isPoint = e.end_time && e.duration_minutes === 0;
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
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{e.category || e.activity}</p>
                        {live && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary animate-pulse">
                            live
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {isPoint
                          ? fmtTime(e.start_time)
                          : `${fmtTime(e.start_time)}${e.end_time ? ` – ${fmtTime(e.end_time)}` : " · ongoing"} · ${fmtDur(e.duration_minutes)}`}
                      </p>
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
    </div>
  );
}
