import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Battery } from "lucide-react";
import { toast } from "sonner";
import { lifeFrom } from "@/lib/lifeos-db";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/energy")({
  head: () => ({ meta: [{ title: "Energy — Forge" }] }),
  component: EnergyPage,
});

type Log = {
  id: string;
  log_date: string;
  energy: number;
  mood: number | null;
  stress: number | null;
  sleep_hours: number | null;
  motivation: number | null;
  note: string | null;
};

function EnergyPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [energy, setEnergy] = useState(3);
  const [mood, setMood] = useState(3);
  const [stress, setStress] = useState(3);
  const [sleep, setSleep] = useState(7);
  const [motivation, setMotivation] = useState(3);
  const [insight, setInsight] = useState("");

  const load = async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data } = await lifeFrom("energy_logs").select("*").gte("log_date", since).order("log_date", { ascending: false });
    setLogs((data as Log[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  const correlation = useMemo(() => {
    if (logs.length < 3) return "Log a few more days to reveal energy ↔ productivity patterns.";
    const avgEnergy = logs.reduce((a, l) => a + l.energy, 0) / logs.length;
    const avgSleep = logs.filter((l) => l.sleep_hours != null).reduce((a, l) => a + (l.sleep_hours ?? 0), 0) /
      Math.max(1, logs.filter((l) => l.sleep_hours != null).length);
    const highSleepHighEnergy = logs.filter((l) => (l.sleep_hours ?? 0) >= 7 && l.energy >= 4).length;
    return `Avg energy ${avgEnergy.toFixed(1)}/5 · avg sleep ${avgSleep.toFixed(1)}h · ${highSleepHighEnergy} high-energy days after 7h+ sleep.`;
  }, [logs]);

  const save = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await lifeFrom("energy_logs").insert({
      user_id: u.user.id,
      energy,
      mood,
      stress,
      sleep_hours: sleep,
      motivation,
    });
    if (error) return toast.error(error.message);
    toast.success("Energy logged");
    setInsight(correlation);
    void load();
  };

  return (
    <div className="space-y-5 animate-page-in">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Battery className="h-6 w-6 text-success" /> Energy Tracker
        </h1>
        <p className="text-sm text-muted-foreground">Track energy, mood, stress, sleep, motivation — correlate with output.</p>
      </header>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <Slider label="Energy" value={energy} onChange={setEnergy} />
        <Slider label="Mood" value={mood} onChange={setMood} />
        <Slider label="Stress" value={stress} onChange={setStress} />
        <Slider label="Motivation" value={motivation} onChange={setMotivation} />
        <label className="flex items-center justify-between text-sm">
          Sleep hours
          <input
            type="number"
            min={0}
            max={14}
            step={0.5}
            value={sleep}
            onChange={(e) => setSleep(Number(e.target.value))}
            className="w-20 rounded-lg border border-border bg-background px-2 py-1"
          />
        </label>
        <Button onClick={save} className="w-full">
          Log check-in
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        {insight || correlation}
      </div>

      <ul className="space-y-2">
        {logs.slice(0, 14).map((l) => (
          <li key={l.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm">
            <span>{l.log_date}</span>
            <span className="text-muted-foreground">
              E{l.energy} · M{l.mood ?? "–"} · S{l.stress ?? "–"} · {l.sleep_hours ?? "–"}h
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex justify-between text-muted-foreground">
        <span>{label}</span>
        <span>{value}/5</span>
      </span>
      <input type="range" min={1} max={5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </label>
  );
}
