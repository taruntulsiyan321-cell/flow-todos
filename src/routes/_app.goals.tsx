import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Target, Plus, ChevronRight, Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { lifeFrom } from "@/lib/lifeos-db";
import { GOAL_HORIZONS, contributionPercent, type GoalHorizon } from "@/lib/lifeos";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/goals")({
  head: () => ({ meta: [{ title: "Goals — Forge" }] }),
  component: GoalsPage,
});

type Goal = {
  id: string;
  title: string;
  description: string | null;
  horizon: GoalHorizon;
  parent_id: string | null;
  progress: number;
  status: string;
  life_area: string | null;
  target_date: string | null;
};

function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [horizon, setHorizon] = useState<GoalHorizon>("monthly");
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [todayNote, setTodayNote] = useState("");

  const load = async () => {
    const { data } = await lifeFrom("goals")
      .select("id,title,description,horizon,parent_id,progress,status,life_area,target_date")
      .neq("status", "abandoned")
      .order("sort_order", { ascending: true });
    setGoals((data as Goal[]) ?? []);
    setLoading(false);

    const today = new Date().toISOString().slice(0, 10);
    const monthly = ((data as Goal[]) ?? []).find((g) => g.horizon === "monthly" && g.status === "active");
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id,completed,goal_id")
      .gte("created_at", `${today}T00:00:00Z`);
    const rows = tasks ?? [];
    const linked = rows.filter((t) => t.goal_id);
    const base = linked.length ? linked : rows;
    const pct = contributionPercent(base.filter((t) => t.completed).length, Math.max(1, base.length));
    setTodayNote(
      monthly
        ? `Today's work contributed ${pct}% toward your ${monthly.title}.`
        : `Today's work contributed ${pct}% toward your active goals.`,
    );
  };

  useEffect(() => {
    void load();
  }, []);

  const parents = useMemo(() => {
    const idx = GOAL_HORIZONS.findIndex((h) => h.key === horizon);
    if (idx <= 0) return [];
    const parentHorizon = GOAL_HORIZONS[idx - 1].key;
    return goals.filter((g) => g.horizon === parentHorizon && g.status === "active");
  }, [goals, horizon]);

  const visible = goals.filter((g) => g.horizon === horizon && g.status !== "abandoned");

  const add = async () => {
    if (!title.trim()) return toast.error("Title required");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await lifeFrom("goals").insert({
      user_id: u.user.id,
      title: title.trim(),
      horizon,
      parent_id: parentId || null,
    });
    if (error) return toast.error(error.message);
    setTitle("");
    setParentId("");
    toast.success("Goal added");
    void load();
  };

  const setProgress = async (id: string, progress: number) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, progress } : g)));
    await lifeFrom("goals").update({ progress, updated_at: new Date().toISOString() }).eq("id", id);
  };

  const complete = async (id: string) => {
    await lifeFrom("goals")
      .update({ status: "completed", progress: 100, completed_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Goal completed");
    void load();
  };

  const remove = async (id: string) => {
    await lifeFrom("goals").update({ status: "abandoned" }).eq("id", id);
    void load();
  };

  return (
    <div className="space-y-5 animate-page-in">
      <header>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Hierarchy</p>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Target className="h-6 w-6 text-primary" /> Goals
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Life Vision → 10y → 5y → 1y → Quarter → Month → Week → Day
        </p>
      </header>

      {todayNote && (
        <div
          className="rounded-2xl border border-border p-4 text-sm"
          style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-[10px] uppercase tracking-wider text-primary">Today → long-term</p>
          <p className="mt-1 font-medium text-foreground">{todayNote}</p>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {GOAL_HORIZONS.map((h) => (
          <button
            key={h.key}
            onClick={() => setHorizon(h.key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
              horizon === h.key
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            {h.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <Input placeholder={`New ${GOAL_HORIZONS.find((h) => h.key === horizon)?.label}…`} value={title} onChange={(e) => setTitle(e.target.value)} />
        {parents.length > 0 && (
          <select
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">Link to parent goal (optional)</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
        <Button onClick={add} className="w-full gap-2">
          <Plus className="h-4 w-4" /> Add goal
        </Button>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-card" />
      ) : visible.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">No goals at this level yet.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((g) => {
            const parent = goals.find((p) => p.id === g.parent_id);
            return (
              <li key={g.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{g.title}</p>
                    {parent && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Link2 className="h-3 w-3" /> {parent.title}
                      </p>
                    )}
                    {g.status === "completed" && (
                      <span className="mt-1 inline-block text-[10px] uppercase tracking-wider text-success">Completed</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {g.status === "active" && (
                      <button onClick={() => complete(g.id)} className="rounded-lg p-2 text-success hover:bg-muted" title="Complete">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => remove(g.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive">
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
