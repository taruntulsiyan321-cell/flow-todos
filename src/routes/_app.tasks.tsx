import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Check, Trash2, Loader2, X, Briefcase, Heart, GraduationCap, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { celebrateXp, deductXp } from "@/lib/feedback";

export const Route = createFileRoute("/_app/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Forge" }] }),
  component: TasksPage,
});

type Task = {
  id: string;
  title: string;
  notes: string | null;
  category: "work" | "health" | "study" | "personal";
  priority: "high" | "medium" | "low";
  due_date: string | null;
  completed: boolean;
  xp_reward: number;
};

const CATEGORIES = [
  { id: "work", label: "Work", Icon: Briefcase },
  { id: "health", label: "Health", Icon: Heart },
  { id: "study", label: "Study", Icon: GraduationCap },
  { id: "personal", label: "Personal", Icon: Sparkles },
] as const;

const PRIORITY_STYLES: Record<Task["priority"], { label: string; color: string }> = {
  high: { label: "High", color: "var(--destructive)" },
  medium: { label: "Med", color: "var(--warning)" },
  low: { label: "Low", color: "var(--success)" },
};

const PRIORITY_XP: Record<Task["priority"], number> = { high: 25, medium: 15, low: 8 };

const taskSchema = z.object({
  title: z.string().trim().min(1, "Title required").max(120),
  notes: z.string().trim().max(500).optional(),
});

function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<"all" | Task["category"]>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("id,title,notes,category,priority,due_date,completed,xp_reward")
      .order("completed", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (t: Task, btnEl?: Element | null) => {
    const next = !t.completed;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: next } : x)));
    const { error } = await supabase.from("tasks").update({ completed: next }).eq("id", t.id);
    if (error) {
      toast.error(error.message);
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: !next } : x)));
      return;
    }
    if (next) {
      celebrateXp({ amount: t.xp_reward, origin: btnEl, message: `Quest complete! +${t.xp_reward} XP` });
      const row = (btnEl as HTMLElement | null)?.closest("li");
      if (row) {
        row.classList.add("animate-celebrate");
        setTimeout(() => row.classList.remove("animate-celebrate"), 950);
      }
    } else {
      deductXp({ amount: t.xp_reward, origin: btnEl, message: `−${t.xp_reward} XP removed` });
    }
  };

  const remove = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { toast.error(error.message); load(); }
  };

  const visible = filter === "all" ? tasks : tasks.filter((t) => t.category === filter);
  const remaining = tasks.filter((t) => !t.completed).length;

  return (
    <div className="space-y-5 animate-page-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quests</h1>
          <p className="text-sm text-muted-foreground">{remaining} active</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          <Plus className="h-4 w-4" /> New
        </button>
      </div>

      {/* Category filter */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
        {CATEGORIES.map(({ id, label, Icon }) => (
          <FilterChip
            key={id}
            active={filter === id}
            onClick={() => setFilter(id)}
            label={label}
            icon={<Icon className="h-3.5 w-3.5" />}
          />
        ))}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-card" />)}
        </div>
      ) : visible.length === 0 ? (
        <div
          className="rounded-3xl border border-dashed border-border p-10 text-center"
          style={{ background: "var(--gradient-card)" }}
        >
          <p className="text-sm text-muted-foreground">
            {tasks.length === 0 ? "No quests yet — add one to start earning XP." : "No quests in this category."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((t) => {
            const cat = CATEGORIES.find((c) => c.id === t.category)!;
            const CatIcon = cat.Icon;
            return (
              <li
                key={t.id}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl border border-border p-3.5 transition-all",
                  t.completed && "opacity-60",
                )}
                style={{ background: "var(--gradient-card)" }}
              >
                <button
                  onClick={(e) => toggle(t, e.currentTarget)}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-all active:scale-90",
                    t.completed ? "border-transparent text-primary-foreground" : "border-border hover:border-primary",
                  )}
                  style={t.completed ? { background: "var(--gradient-primary)" } : undefined}
                >
                  {t.completed && <Check className="h-4 w-4 animate-check-pop" strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium text-foreground", t.completed && "line-through")}>{t.title}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><CatIcon className="h-3 w-3" />{cat.label}</span>
                    <span style={{ color: PRIORITY_STYLES[t.priority].color }}>● {PRIORITY_STYLES[t.priority].label}</span>
                    <span>+{t.xp_reward} XP</span>
                  </div>
                </div>
                <button
                  onClick={() => remove(t.id)}
                  className="rounded-lg p-1.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showAdd && <AddTaskSheet onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function FilterChip({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}{label}
    </button>
  );
}

function AddTaskSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<Task["category"]>("personal");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = taskSchema.safeParse({ title, notes: notes || undefined });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSaving(false); return; }
    const { error } = await supabase.from("tasks").insert({
      user_id: u.user.id,
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      category,
      priority,
      xp_reward: PRIORITY_XP[priority],
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Quest added!");
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
          <h2 className="text-lg font-bold text-foreground">New quest</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            maxLength={120}
            autoFocus
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none focus:border-primary"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            maxLength={500}
            rows={2}
            className="w-full resize-none rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
          />

          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Category</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategory(id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-medium transition-colors",
                    category === id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Priority</label>
            <div className="flex gap-2">
              {(["high","medium","low"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold capitalize transition-colors",
                    priority === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                  )}
                >
                  {p} <span className="text-[10px] opacity-70">+{PRIORITY_XP[p]}</span>
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
          Add quest
        </button>
      </form>
    </div>
  );
}
