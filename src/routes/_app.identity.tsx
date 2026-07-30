import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CircleUser, Plus } from "lucide-react";
import { toast } from "sonner";
import { lifeFrom } from "@/lib/lifeos-db";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/identity")({
  head: () => ({ meta: [{ title: "Identity — Forge" }] }),
  component: IdentityPage,
});

type Statement = { id: string; statement: string; evidence_count: number; active: boolean };

function IdentityPage() {
  const [rows, setRows] = useState<Statement[]>([]);
  const [text, setText] = useState("");

  const load = async () => {
    const { data } = await lifeFrom("identity_statements").select("*").eq("active", true).order("evidence_count", { ascending: false });
    setRows((data as Statement[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  const add = async () => {
    let statement = text.trim();
    if (!statement) return;
    if (!statement.toLowerCase().startsWith("i am")) {
      statement = `I am someone who ${statement.replace(/^i want to\s+/i, "").replace(/\.$/, "")}.`;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await lifeFrom("identity_statements").insert({
      user_id: u.user.id,
      statement,
    });
    if (error) return toast.error(error.message);
    await lifeFrom("ai_memories").insert({
      user_id: u.user.id,
      category: "strength",
      content: statement,
      importance: 4,
      source: "identity",
    });
    setText("");
    toast.success("Identity reinforced");
    void load();
  };

  const evidence = async (id: string, count: number) => {
    await lifeFrom("identity_statements").update({ evidence_count: count + 1 }).eq("id", id);
    void load();
  };

  return (
    <div className="space-y-5 animate-page-in">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CircleUser className="h-6 w-6 text-primary" /> Identity Builder
        </h1>
        <p className="text-sm text-muted-foreground">
          Not “I want to exercise” — “I am someone who never skips workouts.”
        </p>
      </header>

      <div className="flex gap-2">
        <Input placeholder="I am someone who…" value={text} onChange={(e) => setText(e.target.value)} />
        <Button onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-lg font-medium text-foreground">{r.statement}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{r.evidence_count} evidence action{r.evidence_count === 1 ? "" : "s"}</span>
              <button className="text-primary" onClick={() => evidence(r.id, r.evidence_count)}>
                + Log proof today
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
