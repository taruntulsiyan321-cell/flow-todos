import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Compass } from "lucide-react";
import { toast } from "sonner";
import { lifeFrom } from "@/lib/lifeos-db";
import { LIFE_AREA_DEFAULTS } from "@/lib/lifeos";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/wheel")({
  head: () => ({ meta: [{ title: "Life Areas — Forge" }] }),
  component: WheelPage,
});

type Area = { id: string; area_key: string; label: string; score: number; target_score: number };

function WheelPage() {
  const [areas, setAreas] = useState<Area[]>([]);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    let { data } = await lifeFrom("life_areas").select("*").order("label");
    if (!data?.length) {
      await lifeFrom("life_areas").insert(
        LIFE_AREA_DEFAULTS.map((a) => ({
          user_id: u.user!.id,
          area_key: a.key,
          label: a.label,
          score: 5,
        })),
      );
      ({ data } = await lifeFrom("life_areas").select("*").order("label"));
    }
    setAreas((data as Area[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  const neglected = useMemo(
    () => [...areas].sort((a, b) => a.score / a.target_score - b.score / b.target_score).slice(0, 2),
    [areas],
  );

  const setScore = async (area: Area, score: number) => {
    setAreas((prev) => prev.map((a) => (a.id === area.id ? { ...a, score } : a)));
    const { data: u } = await supabase.auth.getUser();
    await lifeFrom("life_areas").update({ score, updated_at: new Date().toISOString() }).eq("id", area.id);
    if (u.user) {
      await lifeFrom("life_area_logs").insert({
        user_id: u.user.id,
        area_key: area.area_key,
        score,
      });
    }
  };

  return (
    <div className="space-y-5 animate-page-in">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Compass className="h-6 w-6 text-accent" /> Life Areas
        </h1>
        <p className="text-sm text-muted-foreground">Wheel of Life — spot neglected domains.</p>
      </header>

      {neglected.length > 0 && (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          Neglected: {neglected.map((a) => a.label).join(" & ")}. Schedule one action this week.
        </div>
      )}

      <div className="mx-auto max-w-xs">
        <WheelSvg areas={areas} />
      </div>

      <ul className="space-y-3">
        {areas.map((a) => (
          <li key={a.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium">{a.label}</span>
              <span className="text-muted-foreground">
                {a.score}/{a.target_score}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={a.score}
              onChange={(e) => setScore(a, Number(e.target.value))}
              className="w-full"
            />
          </li>
        ))}
      </ul>

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => toast.message("Tip", { description: "Raise the lowest area by one point through a tiny habit." })}
      >
        Get balance tip
      </Button>
    </div>
  );
}

function WheelSvg({ areas }: { areas: Area[] }) {
  if (!areas.length) return <div className="aspect-square animate-pulse rounded-full bg-card" />;
  const cx = 100;
  const cy = 100;
  const r = 80;
  const n = areas.length;
  const pts = areas.map((a, i) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = (a.score / 10) * r;
    return `${cx + Math.cos(ang) * rr},${cy + Math.sin(ang) * rr}`;
  });
  return (
    <svg viewBox="0 0 200 200" className="w-full">
      {[2, 4, 6, 8, 10].map((s) => (
        <circle key={s} cx={cx} cy={cy} r={(s / 10) * r} fill="none" stroke="oklch(0.28 0.05 280)" strokeWidth="0.5" />
      ))}
      <polygon points={pts.join(" ")} fill="oklch(0.7 0.24 295 / 0.35)" stroke="oklch(0.7 0.24 295)" strokeWidth="2" />
    </svg>
  );
}
