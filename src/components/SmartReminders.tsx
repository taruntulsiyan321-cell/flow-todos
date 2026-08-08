import { useEffect, useState } from "react";
import { Bell, BellOff, Sparkles, AlertTriangle, Info, Trophy, Smartphone } from "lucide-react";
import { buildSmartReminders, type SmartReminder } from "@/lib/reminders";
import {
  fireNotification,
  getNotifyPermission,
  notificationsEnabled,
  notifySupportNote,
  requestNotificationPermission,
  setNotificationsEnabled,
} from "@/lib/notifications";
import { toast } from "sonner";

const TONE_STYLES: Record<SmartReminder["tone"], { color: string; Icon: typeof Info }> = {
  info: { color: "var(--accent)", Icon: Info },
  warning: { color: "var(--warning)", Icon: AlertTriangle },
  success: { color: "var(--success)", Icon: Trophy },
};

export function SmartReminders() {
  const [items, setItems] = useState<SmartReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [perm, setPerm] = useState(getNotifyPermission());
  const [enabled, setEnabled] = useState(notificationsEnabled());
  const [supportNote, setSupportNote] = useState<string | null>(null);

  useEffect(() => {
    setSupportNote(notifySupportNote());
  }, [enabled, perm]);

  useEffect(() => {
    let active = true;
    (async () => {
      const list = await buildSmartReminders();
      if (!active) return;
      setItems(list);
      setLoading(false);

      // Fire highest-priority warning to OS notification once on load (if enabled)
      if (notificationsEnabled() && list.length > 0) {
        const top = list.find((i) => i.tone === "warning") ?? list[0];
        fireNotification(top.title, top.body);
      }
    })();
    return () => { active = false; };
  }, []);

  const toggle = async () => {
    if (enabled) {
      setNotificationsEnabled(false);
      setEnabled(false);
      toast("Notifications muted");
      return;
    }
    if (perm === "denied") {
      toast.error("Permission denied. Enable notifications in your browser settings.");
      return;
    }
    if (perm === "unsupported") {
      toast.error("This browser doesn't support notifications.");
      return;
    }
    const r = await requestNotificationPermission();
    setPerm(r);
    setEnabled(r === "granted");
    if (r === "granted") {
      toast.success("Reminders enabled");
      fireNotification("Forge reminders enabled", "We'll nudge you about streaks and open quests.");
    } else if (r === "denied") {
      toast.error("Permission denied");
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border p-5" style={{ background: "var(--gradient-card)" }}>
        <div className="skeleton h-4 w-1/3 mb-3" />
        <div className="skeleton h-12 w-full" />
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-border p-5"
      style={{ background: "var(--gradient-card)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Smart nudges</h2>
        </div>
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          aria-label={enabled ? "Mute notifications" : "Enable notifications"}
        >
          {enabled ? <Bell className="h-3 w-3 text-primary" /> : <BellOff className="h-3 w-3" />}
          {enabled ? "On" : "Off"}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">All clear — nothing urgent right now. ✨</p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => {
            const { color, Icon } = TONE_STYLES[r.tone];
            return (
              <li
                key={r.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-card/40 p-3"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
