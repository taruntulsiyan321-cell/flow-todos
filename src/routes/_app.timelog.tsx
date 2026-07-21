import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Clock, Plus, Trash2, Play, Square, Sparkles, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
const toLocalDT = (iso: string) => {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
};
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDur = (m: number | null) => {
  if (m == null) return "—";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
};

function TimeLogPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayISO());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [activity, setActivity] = useState("");
  const [category, setCategory] = useState<string>("Work");
  const [start, setStart] = useState(toLocalDT(new Date().toISOString()));
  const [end, setEnd] = useState<string>("");
  const [notes, setNotes] = useState("");

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

  const resetForm = () => {
    setActivity("");
    setCategory("Work");
    setStart(toLocalDT(new Date().toISOString()));
    setEnd("");
    setNotes("");
  };

  const submit = async () => {
    if (!activity.trim()) return toast.error("What did you do?");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSaving(false);
      return;
    }
    const startISO = new Date(start).toISOString();
    const endISO = end ? new Date(end).toISOString() : null;
    const dur =
      endISO ? Math.max(0, Math.round((new Date(endISO).getTime() - new Date(startISO).getTime()) / 60000)) : null;
    const { error } = await supabase.from("time_logs").insert({
      user_id: u.user.id,
      activity: activity.trim(),
      category,
      log_date: startISO.slice(0, 10),
      start_time: startISO,
      end_time: endISO,
      duration_minutes: dur,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Logged");
    resetForm();
    setOpen(false);
    setDate(startISO.slice(0, 10));
    void load(startISO.slice(0, 10));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Clock className="h-6 w-6 text-primary" />
            Time Log
          </h1>
          <p className="text-sm text-muted-foreground">Record what you did — and when.</p>
        </div>
        <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (v) setStart(toLocalDT(new Date().toISOString())); }}>
          <SheetTrigger asChild>
            <Button size="sm" className="rounded-full" style={{ background: "var(--gradient-primary)" }}>
              <Plus className="h-4 w-4" /> Log
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>New time entry</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="t-act">Activity</Label>
                <Input id="t-act" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Deep work on project X" />
              </div>
              <div>
                <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => setCategory(c.label)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        category === c.label ? "border-primary text-foreground" : "border-border text-muted-foreground",
                      )}
                      style={category === c.label ? { background: "var(--gradient-card)", boxShadow: "var(--shadow-glow)" } : undefined}
                    >
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: c.color }} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="t-start">Start</Label>
                  <Input id="t-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="t-end">End (optional)</Label>
                  <Input id="t-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="t-notes">Notes (optional)</Label>
                <Textarea id="t-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Anything worth remembering..." />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={() => { setEnd(""); void submit(); }}
                  disabled={saving}
                >
                  <Play className="h-4 w-4" /> Start now
                </Button>
                <Button
                  className="flex-1 rounded-full"
                  style={{ background: "var(--gradient-primary)" }}
                  onClick={submit}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save entry"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Date picker + totals */}
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

      {byCategory.length > 0 && (
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
          <div className="h-20 animate-pulse rounded-2xl bg-card" />
          <div className="h-20 animate-pulse rounded-2xl bg-card" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm font-medium text-foreground">No entries yet</p>
          <p className="text-xs text-muted-foreground">Log your first activity for today.</p>
        </div>
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-5">
          {entries.map((e) => {
            const cat = CATEGORIES.find((c) => c.label === e.category) || CATEGORIES[5];
            const ongoing = !e.end_time;
            return (
              <li key={e.id} className="relative">
                <span
                  className="absolute -left-[27px] top-3 h-3 w-3 rounded-full ring-4 ring-background"
                  style={{ background: cat.color, boxShadow: ongoing ? "var(--shadow-glow)" : undefined }}
                />
                <article
                  className="rounded-2xl border border-border p-4 transition hover:border-primary/40"
                  style={{ background: "var(--gradient-card)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{e.activity}</p>
                        {ongoing && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary animate-pulse">
                            live
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {fmtTime(e.start_time)} {e.end_time ? `– ${fmtTime(e.end_time)}` : "· ongoing"} · {fmtDur(e.duration_minutes)}
                        {e.category ? ` · ${e.category}` : ""}
                      </p>
                      {e.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{e.notes}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      {ongoing && (
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
