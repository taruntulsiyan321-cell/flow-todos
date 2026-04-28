import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Plus, Check, Trash2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/planner")({
  head: () => ({ meta: [{ title: "Planner — Forge" }] }),
  component: PlannerPage,
});

type Event = {
  id: string;
  title: string;
  notes: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  category: string;
  completed: boolean;
};

const CATEGORIES = [
  { key: "personal", label: "Personal", color: "var(--primary)" },
  { key: "work", label: "Work", color: "var(--accent)" },
  { key: "health", label: "Health", color: "var(--success)" },
  { key: "learning", label: "Learning", color: "var(--warning)" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function PlannerPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [category, setCategory] = useState("personal");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("planner_events")
      .select("*")
      .eq("event_date", date)
      .order("start_time", { ascending: true, nullsFirst: false });
    setEvents(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [date]);

  const submit = async () => {
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("planner_events").insert({
      user_id: u.user.id,
      title: title.trim(),
      notes: notes.trim() || null,
      event_date: date,
      start_time: start || null,
      end_time: end || null,
      category,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Scheduled");
    setTitle("");
    setNotes("");
    setStart("");
    setEnd("");
    setCategory("personal");
    setOpen(false);
    load();
  };

  const toggle = async (e: Event) => {
    const next = !e.completed;
    const { error } = await supabase.from("planner_events").update({ completed: next }).eq("id", e.id);
    if (error) return toast.error(error.message);
    if (next) toast.success("+10 XP");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("planner_events").delete().eq("id", id);
    setEvents((s) => s.filter((x) => x.id !== id));
  };

  const days = useMemo(() => {
    const arr: { iso: string; day: number; weekday: string }[] = [];
    const base = new Date();
    for (let i = -2; i <= 4; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      arr.push({
        iso: d.toISOString().slice(0, 10),
        day: d.getDate(),
        weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
      });
    }
    return arr;
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Calendar className="h-6 w-6 text-accent" />
            Planner
          </h1>
          <p className="text-sm text-muted-foreground">Plan the day. +10 XP per completion.</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm" className="rounded-full" style={{ background: "var(--gradient-primary)" }}>
              <Plus className="h-4 w-4" /> Schedule
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>New event</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="p-title">Title</Label>
                <Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Morning run" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="p-start">Start</Label>
                  <Input id="p-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="p-end">End</Label>
                  <Input id="p-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCategory(c.key)}
                      className={cn(
                        "rounded-xl border p-2 text-xs font-medium transition",
                        category === c.key ? "border-primary text-foreground" : "border-border text-muted-foreground",
                      )}
                      style={category === c.key ? { background: "var(--gradient-card)" } : undefined}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="p-notes">Notes</Label>
                <Textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
              <Button className="w-full rounded-full" style={{ background: "var(--gradient-primary)" }} onClick={submit} disabled={saving}>
                {saving ? "Saving…" : "Schedule"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Day strip */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d) => {
          const active = d.iso === date;
          return (
            <button
              key={d.iso}
              onClick={() => setDate(d.iso)}
              className={cn(
                "flex min-w-[60px] flex-col items-center rounded-2xl border px-3 py-2 transition",
                active ? "border-primary text-foreground" : "border-border text-muted-foreground",
              )}
              style={active ? { background: "var(--gradient-card)", boxShadow: "var(--shadow-glow)" } : undefined}
            >
              <span className="text-[10px] uppercase tracking-wider">{d.weekday}</span>
              <span className="text-lg font-bold">{d.day}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-card" />
      ) : events.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <Calendar className="mx-auto h-8 w-8 text-accent" />
          <p className="mt-3 text-sm font-medium text-foreground">Nothing scheduled</p>
          <p className="text-xs text-muted-foreground">Tap Schedule to plan your day.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => {
            const cat = CATEGORIES.find((c) => c.key === e.category) ?? CATEGORIES[0];
            return (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-2xl border border-border p-3"
                style={{ background: "var(--gradient-card)" }}
              >
                <button
                  onClick={() => toggle(e)}
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition",
                    e.completed ? "border-transparent" : "border-border",
                  )}
                  style={e.completed ? { background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" } : undefined}
                >
                  {e.completed && <Check className="h-4 w-4 text-primary-foreground" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-semibold", e.completed ? "text-muted-foreground line-through" : "text-foreground")}>
                    {e.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: cat.color }} />
                    <span>{cat.label}</span>
                    {(e.start_time || e.end_time) && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {e.start_time?.slice(0, 5) ?? "—"}{e.end_time ? `–${e.end_time.slice(0, 5)}` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => remove(e.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
