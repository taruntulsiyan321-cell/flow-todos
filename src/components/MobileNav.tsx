import { Link, useLocation } from "@tanstack/react-router";
import { Home, CheckSquare, Flame, User, BookOpen, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/dashboard", label: "Home", Icon: Home },
  { to: "/habits", label: "Habits", Icon: Flame },
  { to: "/tasks", label: "Tasks", Icon: CheckSquare },
  { to: "/journal", label: "Journal", Icon: BookOpen },
  { to: "/analytics", label: "Stats", Icon: BarChart3 },
  { to: "/profile", label: "Me", Icon: User },
] as const;

export function MobileNav() {
  const { pathname } = useLocation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/80 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2">
        {tabs.map(({ to, label, Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <span
                  className="absolute -top-px left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full"
                  style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
                />
              )}
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
