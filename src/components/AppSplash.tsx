import { Flame } from "lucide-react";

/**
 * Branded loading screen shown while the session / route resolves.
 * Replaces the previous blank-screen flash on slow connections.
 */
export function AppSplash({ label = "Loading your forge…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-background px-6"
      style={{ backgroundImage: "var(--gradient-glow)", backgroundRepeat: "no-repeat" }}
    >
      <div
        className="animate-pulse-glow flex h-16 w-16 items-center justify-center rounded-2xl text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        <Flame className="h-8 w-8" />
      </div>
      <p className="mt-5 text-sm font-medium text-muted-foreground">{label}</p>
      <div className="mt-4 h-1 w-32 overflow-hidden rounded-full bg-muted">
        <div className="animate-sweep h-full w-1/3 rounded-full" style={{ background: "var(--gradient-xp)" }} />
      </div>
    </div>
  );
}
