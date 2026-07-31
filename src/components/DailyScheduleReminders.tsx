import { useEffect } from "react";
import { lifeFrom } from "@/lib/lifeos-db";
import { fireNotification, notificationsEnabled } from "@/lib/notifications";
import { localISODate } from "@/lib/dates";

/**
 * While the app is open, nudge for today's incomplete schedule items at their remind_at time.
 */
export function DailyScheduleReminders() {
  useEffect(() => {
    const firedKey = "forge:schedule-fired";
    const readFired = () => {
      try {
        return new Set<string>(JSON.parse(localStorage.getItem(firedKey) ?? "[]"));
      } catch {
        return new Set<string>();
      }
    };
    const writeFired = (set: Set<string>) => {
      localStorage.setItem(firedKey, JSON.stringify([...set]));
    };

    const check = async () => {
      if (!notificationsEnabled()) return;
      const today = localISODate();
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const { data } = await lifeFrom("daily_todos")
        .select("id,title,remind_at,completed")
        .eq("scheduled_date", today)
        .eq("completed", false)
        .not("remind_at", "is", null);
      const fired = readFired();
      let changed = false;
      for (const t of data ?? []) {
        const remind = String(t.remind_at).slice(0, 5);
        const key = `${today}:${t.id}:${remind}`;
        if (remind === hhmm && !fired.has(key)) {
          fireNotification("Daily schedule", t.title);
          fired.add(key);
          changed = true;
        }
      }
      // Drop old keys (other days)
      for (const k of [...fired]) {
        if (!k.startsWith(today)) {
          fired.delete(k);
          changed = true;
        }
      }
      if (changed) writeFired(fired);
    };

    void check();
    const id = window.setInterval(() => void check(), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
