import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Plus, Check, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { celebrateXp, deductXp } from "@/lib/feedback";

export const Route = createFileRoute("/_app/habits")({
  head: () => ({ meta: [{ title: "Habits — Forge" }] }),
  component: HabitsPage,
});

type Habit = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  xp_reward: number;
};

const HABIT_COLORS = ["primary", "accent", "warning", "success", "destructive"] as const;

const habitSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(60),
  description: z.string().trim().max(200).optional(),
});

function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [doneToday, setDoneToday] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [streaks, setStreaks] = useState<Record<string, number>>({});

  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    setLoading(true);
    const [habitsRes, checkinsRes, allCheckinsRes] = await Promise.all([
      supabase.from("habits").select("id,name,description,color,xp_reward").eq("archived", false).order("created_at", { ascending: true }),
      supabase.from("habit_checkins").select("habit_id").eq("completed_on", today),
      supabase.from("habit_checkins").select("habit_id,completed_on").order("completed_on", { ascending: false }).limit(500),
    ]);
    if (habitsRes.error) toast.error(habitsRes.error.message);
    setHabits(habitsRes.data ?? []);
    setDoneToday(new Set((checkinsRes.data ?? []).map((c) => c.habit_id)));

    // compute streak per habit
    const byHabit: Record<string, string[]> = {};
    for (const c of allCheckinsRes.data ?? []) {
      (byHabit[c.habit_id] ??= []).push(c.completed_on);
    }
    const streakMap: Record<string, number> = {};
    for (const [hid, dates] of Object.entries(byHabit)) {
      const set = new Set(dates);
      let streak = 0;
      const cur = new Date();
      // if not done today, start from yesterday
      if (!set.has(cur.toISOString().slice(0, 10))) {
        cur.setDate(cur.getDate() - 1);
      }
      while (set.has(cur.toISOString().slice(0, 10))) {
        streak++;
        cur.setDate(cur.getDate() - 1);
      }
      streakMap[hid] = streak;
    }
    setStreaks(streakMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleCheckin = async (habit: Habit, btnEl?: Element | null) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const isDone = doneToday.has(habit.id);
    if (isDone) {
      // Optimistic
      const next = new Set(doneToday); next.delete(habit.id); setDoneToday(next);
      const { error } = await supabase.from("habit_checkins").delete().eq("habit_id", habit.id).eq("completed_on", today);
      if (error) {
        const revert = new Set(next); revert.add(habit.id); setDoneToday(revert);
        return toast.error(error.message);
      }
      deductXp({ amount: habit.xp_reward, origin: btnEl, message: `−${habit.xp_reward} XP removed` });
      load();
    } else {
      const next = new Set(doneToday); next.add(habit.id); setDoneToday(next);
      const { error } = await supabase.from("habit_checkins").insert({
        habit_id: habit.id,
        user_id: u.user.id,
        completed_on: today,
      });
      if (error) {
        const revert = new Set(next); revert.delete(habit.id); setDoneToday(revert);
        return toast.error(error.message);
      }
      celebrateXp({ amount: habit.xp_reward, origin: btnEl, message: `+${habit.xp_reward} XP earned` });
      // Brief celebrate class on the row
      const row = (btnEl as HTMLElement | null)?.closest("li");
      if (row) {
        row.classList.add("animate-celebrate");
        setTimeout(() => row.classList.remove("animate-celebrate"), 950);
      }
      load();
    }
  };

  const deleteHabit = async (id: string) => {
    const { error } = await supabase.from("habits").update({ archived: true }).eq("id", id);
    if (error) return toast.error(error.message);
    setHabits(habits.filter((h) => h.id !== id));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Habits</h1>
          <p className="text-sm text-muted-foreground">
            {doneToday.size}/{habits.length} done today
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          <Plus className="h-4 w-4" /> New
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-card" />)}
        </div>
      ) : habits.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <ul className="space-y-3">
          {habits.map((h) => {
            const done = doneToday.has(h.id);
            const streak = streaks[h.id] ?? 0;
            return (
              <li
                key={h.id}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl border border-border p-4 transition-all",
                  done && "border-primary/40",
                )}
                style={{ background: "var(--gradient-card)", boxShadow: done ? "var(--shadow-glow)" : undefined }}
              >
                <button
                  onClick={(e) => toggleCheckin(h, e.currentTarget)}
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 transition-all active:scale-90",
                    done ? "border-transparent text-primary-foreground" : "border-border hover:border-primary",
                  )}
                  style={done ? { background: "var(--gradient-primary)" } : undefined}
                >
                  {done && <Check className="h-6 w-6 animate-check-pop" strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-semibold text-foreground", done && "line-through opacity-60")}>{h.name}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Flame className="h-3 w-3 text-warning" />
                      {streak} day{streak === 1 ? "" : "s"}
                    </span>
                    <span>·</span>
                    <span>+{h.xp_reward} XP</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteHabit(h.id)}
                  className="rounded-lg p-2 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete habit"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showAdd && <AddHabitSheet onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      className="rounded-3xl border border-dashed border-border p-10 text-center"
      style={{ background: "var(--gradient-card)" }}
    >
      <Flame className="mx-auto mb-3 h-10 w-10 text-warning" />
      <p className="font-semibold text-foreground">Forge your first habit</p>
      <p className="mt-1 text-sm text-muted-foreground">Daily check-ins build streaks and earn XP.</p>
      <button onClick={onAdd} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
        <Plus className="h-4 w-4" /> Add habit
      </button>
    </div>
  );
}

function AddHabitSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>("primary");
  const [xp, setXp] = useState(10);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = habitSchema.safeParse({ name, description: description || undefined });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSaving(false); return; }
    const { error } = await supabase.from("habits").insert({
      user_id: u.user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      color,
      xp_reward: xp,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Habit forged!");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-t-3xl border border-border p-6 sm:rounded-3xl"
        style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">New habit</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Habit name (e.g. Read 10 pages)"
            maxLength={60}
            autoFocus
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none focus:border-primary"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Why this matters (optional)"
            maxLength={200}
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
          />

          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Color</label>
            <div className="flex gap-2">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn("h-8 w-8 rounded-full border-2 transition-all", color === c ? "border-foreground scale-110" : "border-transparent")}
                  style={{ background: `var(--${c})` }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">XP per check-in</label>
            <div className="flex gap-2">
              {[5, 10, 15, 25].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setXp(v)}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                    xp === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  +{v}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Forge habit
        </button>
      </form>
    </div>
  );
}
