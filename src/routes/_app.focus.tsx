import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Brain, Pause, Play, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { lifeFrom } from "@/lib/lifeos-db";
import { AMBIENT_SOUNDS } from "@/lib/lifeos";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/focus")({
  head: () => ({ meta: [{ title: "Focus — Forge" }] }),
  component: FocusPage,
});

type Mode = "pomodoro" | "deep_work" | "custom";

function FocusPage() {
  const [mode, setMode] = useState<Mode>("pomodoro");
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [interruptions, setInterruptions] = useState(0);
  const [ambient, setAmbient] = useState("none");
  const [stats, setStats] = useState({ sessions: 0, focusMin: 0 });
  const tick = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await lifeFrom("focus_sessions")
        .select("actual_minutes,completed")
        .gte("started_at", since)
        .eq("completed", true);
      const rows = data ?? [];
      setStats({
        sessions: rows.length,
        focusMin: rows.reduce((a: number, r: any) => a + (r.actual_minutes ?? 0), 0),
      });
    })();
  }, [sessionId]);

  useEffect(() => {
    if (!running) {
      if (tick.current) window.clearInterval(tick.current);
      return;
    }
    tick.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          void finish(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (tick.current) window.clearInterval(tick.current);
    };
  }, [running]);

  const preset = (m: Mode) => {
    setMode(m);
    const mins = m === "pomodoro" ? 25 : m === "deep_work" ? 90 : minutes;
    setMinutes(mins);
    setRemaining(mins * 60);
    setRunning(false);
  };

  const start = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await lifeFrom("focus_sessions")
      .insert({
        user_id: u.user.id,
        mode,
        planned_minutes: minutes,
        ambient_sound: ambient === "none" ? null : ambient,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    setSessionId(data.id);
    setInterruptions(0);
    setRemaining(minutes * 60);
    setRunning(true);
    toast.success(mode === "deep_work" ? "Deep work started" : "Focus timer started");
  };

  const finish = async (completed: boolean) => {
    setRunning(false);
    if (!sessionId) return;
    const actual = Math.max(1, Math.round((minutes * 60 - remaining) / 60) || (completed ? minutes : 1));
    await lifeFrom("focus_sessions")
      .update({
        completed,
        actual_minutes: actual,
        interruptions,
        ended_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    const { data: u } = await supabase.auth.getUser();
    if (u.user && completed) {
      await lifeFrom("time_logs").insert({
        user_id: u.user.id,
        activity: mode === "deep_work" ? "Deep work" : "Focus session",
        category: "Work",
        work_depth: mode === "deep_work" || minutes >= 45 ? "deep" : "shallow",
        start_time: new Date(Date.now() - actual * 60000).toISOString(),
        end_time: new Date().toISOString(),
        duration_minutes: actual,
        interruptions,
        focus_session_id: sessionId,
        log_date: new Date().toISOString().slice(0, 10),
      });
    }
    setSessionId(null);
    if (completed) toast.success(`+ focus · ${actual}m logged`);
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const pct = Math.round(((minutes * 60 - remaining) / (minutes * 60 || 1)) * 100);

  return (
    <div className="space-y-5 animate-page-in">
      <header>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Deep Work</p>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Brain className="h-6 w-6 text-accent" /> Focus Mode
        </h1>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["pomodoro", "Pomodoro"],
            ["deep_work", "Deep Work"],
            ["custom", "Custom"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => preset(k)}
            className={cn(
              "rounded-xl border px-2 py-3 text-xs font-medium",
              mode === k ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className="relative overflow-hidden rounded-3xl border border-border p-8 text-center"
        style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-glow)" }}
      >
        <div
          className="absolute inset-x-0 bottom-0 h-1 bg-muted"
          aria-hidden
        >
          <div className="h-full transition-all" style={{ width: `${pct}%`, background: "var(--gradient-primary)" }} />
        </div>
        <p className="font-mono text-6xl font-bold tracking-tight text-foreground">
          {mm}:{ss}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {running ? "In the zone — distractions blocked by intention" : "Ready when you are"}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {!running ? (
            <Button onClick={start} className="gap-2">
              <Play className="h-4 w-4" /> Start
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setRunning(false)} className="gap-2">
                <Pause className="h-4 w-4" /> Pause
              </Button>
              <Button variant="destructive" onClick={() => finish(false)} className="gap-2">
                <Square className="h-4 w-4" /> Stop
              </Button>
            </>
          )}
          {running === false && remaining < minutes * 60 && remaining > 0 && (
            <Button onClick={() => setRunning(true)}>Resume</Button>
          )}
        </div>
        {running && (
          <button
            className="mt-4 text-xs text-warning underline"
            onClick={() => setInterruptions((n) => n + 1)}
          >
            Log interruption ({interruptions})
          </button>
        )}
      </div>

      {mode === "custom" && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="text-sm text-muted-foreground">Minutes</span>
          <input
            type="range"
            min={5}
            max={180}
            step={5}
            value={minutes}
            disabled={running}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMinutes(v);
              setRemaining(v * 60);
            }}
            className="flex-1"
          />
          <span className="w-10 text-right text-sm font-medium">{minutes}</span>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Volume2 className="h-3.5 w-3.5" /> Ambient
        </p>
        <div className="flex flex-wrap gap-2">
          {AMBIENT_SOUNDS.map((s) => (
            <button
              key={s.key}
              disabled={running}
              onClick={() => setAmbient(s.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                ambient === s.key ? "border-accent text-accent" : "border-border text-muted-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Ambient cues set intention (audio playback can be wired to local assets later).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">{stats.sessions}</p>
          <p className="text-xs text-muted-foreground">Sessions (7d)</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-accent">{stats.focusMin}m</p>
          <p className="text-xs text-muted-foreground">Focus minutes</p>
        </div>
      </div>
    </div>
  );
}
