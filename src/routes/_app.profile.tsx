import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Trophy, Flame, Sparkles, Award, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { rankFor, rankInfo, levelFromXp, xpForLevel } from "@/lib/xp";
import { XpBar } from "@/components/XpBar";
import { signOut } from "@/lib/auth";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — Forge" }] }),
  component: ProfilePage,
});

type Profile = {
  display_name: string | null;
  xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
};

const BADGES = [
  { key: "first_step", label: "First Step", desc: "Complete your first action", check: (p: Profile) => p.xp > 0 },
  { key: "streak_3", label: "On Fire", desc: "3-day streak", check: (p: Profile) => p.longest_streak >= 3 },
  { key: "streak_7", label: "Unstoppable", desc: "7-day streak", check: (p: Profile) => p.longest_streak >= 7 },
  { key: "streak_30", label: "Legend", desc: "30-day streak", check: (p: Profile) => p.longest_streak >= 30 },
  { key: "level_5", label: "Adept", desc: "Reach level 5", check: (p: Profile) => p.level >= 5 },
  { key: "level_10", label: "Veteran", desc: "Reach level 10", check: (p: Profile) => p.level >= 10 },
  { key: "xp_500", label: "Grinder", desc: "Earn 500 XP", check: (p: Profile) => p.xp >= 500 },
  { key: "xp_1000", label: "Warrior", desc: "Earn 1000 XP", check: (p: Profile) => p.xp >= 1000 },
];

function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setEmail(u.user?.email ?? null);
      if (u.user) {
        const { data } = await supabase
          .from("profiles")
          .select("display_name,xp,level,current_streak,longest_streak")
          .eq("id", u.user.id)
          .maybeSingle();
        if (data) setProfile(data);
      }
    })();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  if (!profile) return <div className="h-64 animate-pulse rounded-3xl bg-card" />;

  // level progress
  const { level: lvl, into: rem, needed: need } = levelFromXp(profile.xp);
  const { current, next } = rankInfo(lvl);
  const xpForCurrentRank = xpForLevel(current.min);
  const xpForNextRank = next ? xpForLevel(next.min) : null;
  const rankProgressPct =
    next && xpForNextRank
      ? Math.min(
          100,
          Math.round(((profile.xp - xpForCurrentRank) / (xpForNextRank - xpForCurrentRank)) * 100),
        )
      : 100;
  const xpToNextRank = xpForNextRank ? Math.max(0, xpForNextRank - profile.xp) : 0;

  return (
    <div className="space-y-5 animate-page-in">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-3xl border border-border p-6 text-center"
        style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)" }}
      >
        <div
          className="animate-pulse-glow mx-auto flex h-20 w-20 items-center justify-center rounded-3xl text-primary-foreground"
          style={{ background: "var(--gradient-primary)" }}
        >
          <span className="text-2xl font-bold">{lvl}</span>
        </div>
        <h1 className="mt-3 text-xl font-bold text-foreground">{profile.display_name ?? "Adventurer"}</h1>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          <span className="mr-1">{current.glyph}</span>
          {rankFor(lvl)} · {email}
        </p>

        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>Level {lvl}</span>
            <span>{rem}/{need} XP</span>
          </div>
          <XpBar into={rem} needed={need} />
        </div>

        {/* Rank progress */}
        <div className="mt-5 rounded-2xl border border-border bg-card/50 p-4 text-left">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rank progress</p>
              <p className="text-sm font-semibold text-foreground">
                {current.glyph} {current.title}
                {next && <span className="text-muted-foreground"> → {next.glyph} {next.title}</span>}
              </p>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {next ? `${xpToNextRank} XP to go` : "Max rank"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${rankProgressPct}%`, background: "var(--gradient-primary)" }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Sparkles className="h-5 w-5 text-primary" />} value={profile.xp} label="Total XP" />
        <Stat icon={<Flame className="h-5 w-5 text-warning" />} value={profile.current_streak} label="Current" />
        <Stat icon={<Trophy className="h-5 w-5 text-accent" />} value={profile.longest_streak} label="Best" />
      </div>

      <Link
        to="/life"
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
      >
        <Compass className="h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-semibold">Life OS</p>
          <p className="text-xs text-muted-foreground">Goals, coach, focus, reviews & more</p>
        </div>
      </Link>

      {/* Achievements */}
      <div>
        <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Achievements</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BADGES.map((b) => {
            const unlocked = b.check(profile);
            return (
              <div
                key={b.key}
                className="flex flex-col items-center rounded-2xl border border-border p-3 text-center transition-all"
                style={{
                  background: "var(--gradient-card)",
                  opacity: unlocked ? 1 : 0.4,
                  boxShadow: unlocked ? "var(--shadow-glow-cyan)" : undefined,
                }}
              >
                <div
                  className="mb-1.5 flex h-10 w-10 items-center justify-center rounded-2xl"
                  style={{ background: unlocked ? "var(--gradient-primary)" : "var(--muted)" }}
                >
                  <Award className={unlocked ? "h-5 w-5 text-primary-foreground" : "h-5 w-5 text-muted-foreground"} />
                </div>
                <p className="text-xs font-semibold text-foreground">{b.label}</p>
                <p className="text-[10px] text-muted-foreground">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={handleSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-muted-foreground hover:text-destructive"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div
      className="rounded-2xl border border-border p-4 text-center"
      style={{ background: "var(--gradient-card)" }}
    >
      <div className="flex justify-center">{icon}</div>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
