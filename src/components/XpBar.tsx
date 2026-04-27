import { cn } from "@/lib/utils";

export function XpBar({
  into,
  needed,
  className,
}: {
  into: number;
  needed: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((into / Math.max(1, needed)) * 100));
  return (
    <div
      className={cn(
        "relative h-3 w-full overflow-hidden rounded-full border border-border bg-muted",
        className,
      )}
    >
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%`, background: "var(--gradient-xp)", boxShadow: "var(--shadow-glow)" }}
      />
      <div className="animate-shimmer absolute inset-0 rounded-full" />
    </div>
  );
}
