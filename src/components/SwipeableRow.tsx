import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Touch swipe wrapper.
 * - swipe left  -> onSwipeLeft (e.g. delete)
 * - swipe right -> onSwipeRight (e.g. complete)
 * Falls back to plain children on desktop / non-touch.
 */
export function SwipeableRow({
  children,
  onSwipeLeft,
  onSwipeRight,
  threshold = 70,
  leftHint,
  rightHint,
  className,
}: {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  leftHint?: React.ReactNode;
  rightHint?: React.ReactNode;
  className?: string;
}) {
  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setAnimating(false);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const delta = e.touches[0].clientX - startX.current;
    // Clamp so it can't drag forever
    setDx(Math.max(-140, Math.min(140, delta)));
  };
  const onTouchEnd = () => {
    setAnimating(true);
    if (dx <= -threshold && onSwipeLeft) onSwipeLeft();
    else if (dx >= threshold && onSwipeRight) onSwipeRight();
    setDx(0);
    startX.current = null;
  };

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      {/* Background hints */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4 text-xs font-semibold">
        <span className={cn("text-success transition-opacity", dx > 20 ? "opacity-100" : "opacity-0")}>
          {rightHint}
        </span>
        <span className={cn("ml-auto text-destructive transition-opacity", dx < -20 ? "opacity-100" : "opacity-0")}>
          {leftHint}
        </span>
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${dx}px)`,
          transition: animating ? "transform 200ms ease-out" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
