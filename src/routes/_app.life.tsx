import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Target,
  Brain,
  Sparkles,
  CalendarRange,
  Battery,
  Flag,
  BookHeart,
  ShieldCheck,
  Clock,
  CalendarDays,
} from "lucide-react";

export const Route = createFileRoute("/_app/life")({
  head: () => ({ meta: [{ title: "Life OS — Forge" }] }),
  component: LifeHubPage,
});

const LINKS = [
  { to: "/schedule", label: "Daily Schedule", desc: "Today's to-dos & reminders", Icon: CalendarDays },
  { to: "/goals", label: "Goal Hierarchy", desc: "Vision → daily tasks", Icon: Target },
  { to: "/coach", label: "AI Life Coach", desc: "Evening reflection", Icon: Sparkles },
  { to: "/reviews", label: "Weekly / Monthly", desc: "GTD reviews", Icon: CalendarRange },
  { to: "/focus", label: "Focus Mode", desc: "Pomodoro & deep work", Icon: Brain },
  { to: "/timelog", label: "Time Log", desc: "What you did & when", Icon: Clock },
  { to: "/okrs", label: "Personal OKRs", desc: "Quarterly objectives", Icon: Flag },
  { to: "/energy", label: "Energy Tracker", desc: "Mood, sleep, stress", Icon: Battery },
  { to: "/manual", label: "Operating Manual", desc: "How you work best", Icon: BookHeart },
  { to: "/accountability", label: "Accountability", desc: "Did you keep promises?", Icon: ShieldCheck },
] as const;

function LifeHubPage() {
  return (
    <div className="space-y-5 animate-page-in">
      <header>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Flow Tools</p>
        <h1 className="text-2xl font-bold text-foreground">Life OS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Goals, habits, focus, reviews — connected by AI memory.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {LINKS.map(({ to, label, desc, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 active:scale-[0.99]"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold text-foreground">{label}</span>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
