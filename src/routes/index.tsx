import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { Flame, Target, Trophy, Clock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Forge — Daily Habits, Quests & Time Log" },
      {
        name: "description",
        content:
          "Forge turns daily discipline into a game: track habits, log your time, journal and earn XP as your streak grows.",
      },
      { property: "og:title", content: "Forge — Daily Habits, Quests & Time Log" },
      {
        property: "og:description",
        content: "Build streaks, complete quests, log your day, earn XP. Discipline made addictive.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

const FEATURES = [
  { Icon: Flame, label: "Streaks", copy: "Show up daily, watch the fire grow." },
  { Icon: Target, label: "Quests", copy: "Turn intentions into finished work." },
  { Icon: Clock, label: "Time log", copy: "One tap to record what you did." },
  { Icon: Trophy, label: "Ranks", copy: "Beginner to Legend, earned in XP." },
];

function Landing() {
  return (
    <div
      className="app-texture relative min-h-screen overflow-hidden bg-background"
      style={{ backgroundImage: "var(--gradient-glow)", backgroundRepeat: "no-repeat" }}
    >
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-14 sm:py-20">
        <div className="flex items-center gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-xl text-primary-foreground"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            <Flame className="h-5 w-5" />
          </span>
          <span className="font-display text-sm font-bold uppercase tracking-[0.22em] text-foreground">
            Forge
          </span>
        </div>

        <div className="mt-16 sm:mt-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            Daily discipline, forged
          </p>
          <h1 className="mt-4 font-display text-5xl font-extrabold leading-[0.95] text-foreground sm:text-6xl">
            Do the work.
            <br />
            Keep the streak.
          </h1>
          <p className="mt-5 max-w-md text-balance text-base text-muted-foreground">
            Habits, quests, journaling and a one-tap time log — all feeding a single XP
            ledger that never lies about your progress.
          </p>
        </div>

        <div className="mt-12 divide-y divide-border border-y border-border">
          {FEATURES.map(({ Icon, label, copy }) => (
            <div key={label} className="flex items-center gap-4 py-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-bold text-foreground">{label}</p>
                <p className="truncate text-xs text-muted-foreground">{copy}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-12">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="group inline-flex h-14 items-center justify-between rounded-2xl px-6 font-display text-base font-bold text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            <span>Start forging</span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signin" }}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-border bg-card px-6 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </div>
  );
}
