import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Entry = {
  id: string;
  amount: number;
  kind: string;
  occurred_on: string;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  habit_checkin: "Habit check-in",
  task: "Quest completed",
  journal: "Journal entry",
  planner: "Event completed",
};

export function ActivityLog() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("xp_ledger")
        .select("id,amount,kind,occurred_on,created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (!active) return;
      setEntries((data ?? []) as Entry[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  return (
    <div
      className="rounded-2xl border border-border p-5"
      style={{ background: "var(--gradient-card)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Recent XP activity</h2>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-8 animate-pulse rounded-lg bg-muted/50" />
          <div className="h-8 animate-pulse rounded-lg bg-muted/50" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Complete a habit, quest, or journal entry to start your XP trail.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between text-xs">
              <span className="text-foreground/90">{KIND_LABEL[e.kind] ?? e.kind}</span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="text-[10px]">{new Date(e.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                <span className="font-semibold text-success">+{e.amount} XP</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
