import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { isIOS, isStandalone } from "@/lib/notifications";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice?: Promise<unknown> };

const DISMISS_KEY = "forge:install-dismissed";

/**
 * Home-screen install card. Uses the native install prompt where available
 * (Android/Chrome/Edge) and falls back to iOS Share-sheet instructions.
 * Hidden entirely once the app runs standalone.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const iosDevice = isIOS();
    setIos(iosDevice);
    if (iosDevice) setVisible(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="animate-page-in relative overflow-hidden rounded-2xl border border-primary/30 p-4"
      style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-glow-cyan)" }}
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary-foreground"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Install Forge on your phone</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Get an app icon, full-screen mode, and reminders that actually reach you.
          </p>

          {ios ? (
            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <Share className="h-3.5 w-3.5 text-accent" /> Tap Share in Safari
              </p>
              <p className="flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-accent" /> Choose “Add to Home Screen”
              </p>
            </div>
          ) : (
            <button
              onClick={install}
              className="mt-3 inline-flex h-9 items-center justify-center rounded-xl px-4 text-xs font-semibold text-primary-foreground transition-transform active:scale-95"
              style={{ background: "var(--gradient-primary)" }}
            >
              Install app
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
