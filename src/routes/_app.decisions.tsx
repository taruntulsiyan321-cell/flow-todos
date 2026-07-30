import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Scale, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { lifeFrom } from "@/lib/lifeos-db";
import { supabase } from "@/integrations/supabase/client";
import { evaluateDecision } from "@/lib/life-coach.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/decisions")({
  head: () => ({ meta: [{ title: "Decisions — Forge" }] }),
  component: DecisionsPage,
});

type Decision = {
  id: string;
  title: string;
  decision: string;
  reason: string | null;
  expected_outcome: string | null;
  risks: string | null;
  actual_outcome: string | null;
  confidence: number | null;
  quality_score: number | null;
  ai_evaluation: string | null;
  decided_on: string;
};

function DecisionsPage() {
  const [rows, setRows] = useState<Decision[]>([]);
  const [title, setTitle] = useState("");
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");
  const [expected, setExpected] = useState("");
  const [risks, setRisks] = useState("");
  const [confidence, setConfidence] = useState(6);

  const load = async () => {
    const { data } = await lifeFrom("decisions").select("*").order("decided_on", { ascending: false }).limit(40);
    setRows((data as Decision[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  const add = async () => {
    if (!title.trim() || !decision.trim()) return toast.error("Title and decision required");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await lifeFrom("decisions").insert({
      user_id: u.user.id,
      title: title.trim(),
      decision: decision.trim(),
      reason: reason.trim() || null,
      expected_outcome: expected.trim() || null,
      risks: risks.trim() || null,
      confidence,
    });
    if (error) return toast.error(error.message);
    setTitle("");
    setDecision("");
    setReason("");
    setExpected("");
    setRisks("");
    toast.success("Decision logged");
    void load();
  };

  const saveOutcome = async (id: string, actual_outcome: string) => {
    await lifeFrom("decisions").update({ actual_outcome, outcome_date: new Date().toISOString().slice(0, 10) }).eq("id", id);
    void load();
  };

  const evaluate = async (id: string) => {
    const res = await evaluateDecision({ data: { id } });
    toast.success(`Quality ${res.quality_score}/10`);
    void load();
  };

  return (
    <div className="space-y-5 animate-page-in">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Scale className="h-6 w-6 text-accent" /> Decision Journal
        </h1>
        <p className="text-sm text-muted-foreground">Inspired by Thinking in Bets — calibrate judgment over time.</p>
      </header>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <Input placeholder="Decision title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="What did you decide?" value={decision} onChange={(e) => setDecision(e.target.value)} />
        <Textarea placeholder="Reasoning" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Textarea placeholder="Expected outcome" value={expected} onChange={(e) => setExpected(e.target.value)} />
        <Textarea placeholder="Risks" value={risks} onChange={(e) => setRisks(e.target.value)} />
        <label className="flex items-center justify-between text-sm text-muted-foreground">
          Confidence {confidence}/10
          <input type="range" min={1} max={10} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-40" />
        </label>
        <Button onClick={add} className="w-full gap-2">
          <Plus className="h-4 w-4" /> Log decision
        </Button>
      </div>

      <ul className="space-y-3">
        {rows.map((d) => (
          <li key={d.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{d.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{d.decision}</p>
              </div>
              {d.quality_score != null && (
                <span className="rounded-full bg-primary/15 px-2 py-1 text-xs text-primary">{d.quality_score}/10</span>
              )}
            </div>
            {d.expected_outcome && <p className="mt-2 text-xs">Expected: {d.expected_outcome}</p>}
            {d.risks && <p className="text-xs text-warning">Risks: {d.risks}</p>}
            {!d.actual_outcome ? (
              <OutcomeForm onSave={(v) => saveOutcome(d.id, v)} />
            ) : (
              <p className="mt-2 text-sm text-success">Actual: {d.actual_outcome}</p>
            )}
            {d.ai_evaluation && <p className="mt-2 text-xs text-muted-foreground">{d.ai_evaluation}</p>}
            {d.actual_outcome && (
              <Button size="sm" variant="secondary" className="mt-3 gap-1" onClick={() => evaluate(d.id)}>
                <Sparkles className="h-3.5 w-3.5" /> Evaluate quality
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function OutcomeForm({ onSave }: { onSave: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="mt-3 flex gap-2">
      <Input placeholder="Actual outcome…" value={v} onChange={(e) => setV(e.target.value)} />
      <Button size="sm" onClick={() => v.trim() && onSave(v.trim())}>
        Save
      </Button>
    </div>
  );
}
