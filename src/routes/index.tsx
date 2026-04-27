import { createFileRoute, redirect } from "@tanstack/react-router";
import { Sparkles, Flame, Trophy, Target } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-background"
      style={{ backgroundImage: "var(--gradient-glow)" }}
    >
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center">
        <div
          className="animate-pulse-glow mb-8 flex h-20 w-20 items-center justify-center rounded-3xl text-primary-foreground"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Sparkles className="h-10 w-10" />
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-foreground">Forge</h1>
        <p className="mt-3 max-w-sm text-balance text-muted-foreground">
          Level up your life. Build habits, complete quests, earn XP.
        </p>

        <div className="mt-10 grid w-full grid-cols-3 gap-3">
          {[
            { Icon: Flame, label: "Streaks" },
            { Icon: Target, label: "Quests" },
            { Icon: Trophy, label: "Levels" },
          ].map(({ Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4"
              style={{ background: "var(--gradient-card)" }}
            >
              <Icon className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-12 flex w-full flex-col gap-3">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="inline-flex h-12 items-center justify-center rounded-xl px-6 text-base font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            Begin your journey
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signin" }}
            className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-card px-6 text-base font-medium text-foreground hover:bg-muted"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </div>
  );
}
