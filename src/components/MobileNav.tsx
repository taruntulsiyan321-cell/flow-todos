import { Link, useLocation } from "@tanstack/react-router";
import { Home, CheckSquare, Flame, User, BookOpen, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/dashboard", label: "Home", Icon: Home },
  { to: "/habits", label: "Habits", Icon: Flame },
  { to: "/tasks", label: "Tasks", Icon: CheckSquare },
  { to: "/journal", label: "Journal", Icon: BookOpen },
  { to: "/life", label: "Life OS", Icon: Compass },
  { to: "/profile", label: "Me", Icon: User },
] as const;

export function MobileNav() {
  const { pathname } = useLocation();
  const activeIndex = tabs.findIndex((t) => pathname.startsWith(t.to));
  const widthPct = 100 / tabs.length;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/80 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative mx-auto flex max-w-2xl items-stretch justify-around px-2">
        {/* Sliding active indicator */}
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 h-0.5 rounded-full transition-[left] duration-300 ease-out"
            style={{
              left: `calc(${activeIndex * widthPct}% + ${widthPct / 2}% - 1.25rem)`,
              width: "2.5rem",
              background: "var(--gradient-primary)",
              boxShadow: "var(--shadow-glow)",
            }}
          />
        )}
        {tabs.map(({ to, label, Icon }, i) => {
          const active = i === activeIndex;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-all duration-200 active:scale-95",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className={cn("h-5 w-5 transition-transform duration-300", active && "scale-110")}
                strokeWidth={active ? 2.5 : 2}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
