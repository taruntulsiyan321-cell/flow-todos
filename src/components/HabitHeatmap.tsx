import { useEffect, useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { localISODate, shiftLocalISODate } from "@/lib/dates";

const DAYS = 91; // ~13 weeks

export function HabitHeatmap() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const since = shiftLocalISODate(localISODate(), -(DAYS - 1));
      const { data } = await supabase
        .from("habit_checkins")
        .select("completed_on")
        .gte("completed_on", since);
      if (!active) return;
      const map: Record<string, number> = {};
      for (const r of data ?? []) {
        map[r.completed_on] = (map[r.completed_on] ?? 0) + 1;
      }
      setCounts(map);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const days = useMemo(() => {
    const list: { date: string; count: number }[] = [];
    const today = localISODate();
    const startIso = shiftLocalISODate(today, -(DAYS - 1));
    const start = new Date(startIso + "T12:00:00");
    const leadPad = start.getDay(); // pad so grid starts on Sunday
    for (let i = 0; i < leadPad; i++) list.push({ date: "", count: -1 });
    for (let i = DAYS - 1; i >= 0; i--) {
      const date = shiftLocalISODate(today, -i);
      list.push({ date, count: counts[date] ?? 0 });
    }
    return list;
  }, [counts]);

  const max = Math.max(1, ...Object.values(counts));
  const totalCheckins = Object.values(counts).reduce((a, b) => a + b, 0);
  const activeDays = Object.keys(counts).length;

  const intensity = (n: number) => {
    if (n <= 0) return 0;
    const r = n / max;
    if (r < 0.25) return 1;
    if (r < 0.5) return 2;
    if (r < 0.85) return 3;
    return 4;
  };

  const bgFor = (lvl: number) => {
    switch (lvl) {
      case 0:
        return "color-mix(in oklab, var(--muted) 70%, transparent)";
      case 1:
        return "color-mix(in oklab, var(--primary) 25%, transparent)";
      case 2:
        return "color-mix(in oklab, var(--primary) 50%, transparent)";
      case 3:
        return "color-mix(in oklab, var(--primary) 75%, transparent)";
      default:
        return "var(--gradient-primary)";
    }
  };

  return (
    <div
      className="rounded-2xl border border-border p-5"
      style={{ background: "var(--gradient-card)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Last 90 days</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {totalCheckins} check-in{totalCheckins === 1 ? "" : "s"} · {activeDays} active day
          {activeDays === 1 ? "" : "s"}
        </p>
      </div>

      {loading ? (
        <div className="skeleton h-24 rounded-xl" />
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid grid-flow-col gap-1"
            style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}
          >
            {days.map((d, i) => {
              if (d.count < 0) return <div key={`p-${i}`} className="h-3 w-3" />;
              const lvl = intensity(d.count);
              return (
                <div
                  key={d.date}
                  title={`${d.date} · ${d.count} check-in${d.count === 1 ? "" : "s"}`}
                  className="h-3 w-3 rounded-[3px] transition-transform hover:scale-125"
                  style={{ background: bgFor(lvl) }}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((lvl) => (
          <span
            key={lvl}
            className="h-2.5 w-2.5 rounded-[2px]"
            style={{ background: bgFor(lvl) }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
