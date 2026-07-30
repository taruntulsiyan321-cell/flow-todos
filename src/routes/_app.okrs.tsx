import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flag, Plus } from "lucide-react";
import { toast } from "sonner";
import { lifeFrom } from "@/lib/lifeos-db";
import { currentQuarter } from "@/lib/lifeos";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/okrs")({
  head: () => ({ meta: [{ title: "OKRs — Forge" }] }),
  component: OkrsPage,
});

type Okr = { id: string; objective: string; quarter: string; progress: number; status: string };
type KR = { id: string; okr_id: string; title: string; current_value: number; target_value: number; unit: string | null };

function OkrsPage() {
  const [okrs, setOkrs] = useState<Okr[]>([]);
  const [krs, setKrs] = useState<KR[]>([]);
  const [objective, setObjective] = useState("");
  const [krTitle, setKrTitle] = useState("");
  const [selected, setSelected] = useState<string>("");

  const load = async () => {
    const q = currentQuarter();
    const [o, k] = await Promise.all([
      lifeFrom("okrs").select("*").eq("quarter", q).order("created_at", { ascending: true }),
      lifeFrom("okr_key_results").select("*"),
    ]);
    setOkrs((o.data as Okr[]) ?? []);
    setKrs((k.data as KR[]) ?? []);
    if (!selected && o.data?.[0]) setSelected(o.data[0].id);
  };
  useEffect(() => {
    void load();
  }, []);

  const addOkr = async () => {
    if (!objective.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await lifeFrom("okrs").insert({
      user_id: u.user.id,
      quarter: currentQuarter(),
      objective: objective.trim(),
    });
    if (error) return toast.error(error.message);
    setObjective("");
    void load();
  };

  const addKr = async () => {
    if (!selected || !krTitle.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await lifeFrom("okr_key_results").insert({
      user_id: u.user.id,
      okr_id: selected,
      title: krTitle.trim(),
    });
    setKrTitle("");
    void load();
  };

  const bumpKr = async (kr: KR, delta: number) => {
    const next = Math.max(0, Math.min(kr.target_value, kr.current_value + delta));
    await lifeFrom("okr_key_results").update({ current_value: next }).eq("id", kr.id);
    const siblings = krs.filter((x) => x.okr_id === kr.okr_id).map((x) => (x.id === kr.id ? { ...x, current_value: next } : x));
    const progress =
      siblings.length === 0
        ? 0
        : Math.round(
            (siblings.reduce((a, s) => a + s.current_value / Math.max(1, s.target_value), 0) / siblings.length) * 100,
          );
    await lifeFrom("okrs").update({ progress }).eq("id", kr.okr_id);
    void load();
  };

  return (
    <div className="space-y-5 animate-page-in">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Flag className="h-6 w-6 text-primary" /> Personal OKRs
        </h1>
        <p className="text-sm text-muted-foreground">{currentQuarter()} — objectives & key results</p>
      </header>

      <div className="flex gap-2">
        <Input placeholder="New objective" value={objective} onChange={(e) => setObjective(e.target.value)} />
        <Button onClick={addOkr}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {okrs.map((o) => (
        <div
          key={o.id}
          className={`rounded-2xl border p-4 ${selected === o.id ? "border-primary" : "border-border"} bg-card`}
          onClick={() => setSelected(o.id)}
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold">{o.objective}</p>
            <span className="text-sm text-primary">{Math.round(o.progress)}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full" style={{ width: `${o.progress}%`, background: "var(--gradient-primary)" }} />
          </div>
          <ul className="mt-3 space-y-2">
            {krs
              .filter((k) => k.okr_id === o.id)
              .map((k) => (
                <li key={k.id} className="flex items-center justify-between text-sm">
                  <span>
                    {k.title}{" "}
                    <span className="text-muted-foreground">
                      {k.current_value}/{k.target_value}
                      {k.unit ?? ""}
                    </span>
                  </span>
                  <span className="flex gap-1">
                    <button className="rounded border border-border px-2" onClick={() => bumpKr(k, -1)}>
                      −
                    </button>
                    <button className="rounded border border-border px-2" onClick={() => bumpKr(k, 1)}>
                      +
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}

      {selected && (
        <div className="flex gap-2">
          <Input placeholder="Add key result" value={krTitle} onChange={(e) => setKrTitle(e.target.value)} />
          <Button onClick={addKr}>Add KR</Button>
        </div>
      )}
    </div>
  );
}
