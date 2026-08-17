import { supabase } from "@/integrations/supabase/client";

export type SmartReminder = {
  id: string;
  tone: "info" | "warning" | "success";
  title: string;
  body: string;
};

/**
 * Generate smart in-app reminders from current state.
 * Pure derivation — no AI calls. Fast, deterministic, trustworthy.
 */
export async function buildSmartReminders(): Promise<SmartReminder[]> {
  const reminders: SmartReminder[] = [];

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return reminders;
  const today = new Date().toISOString().slice(0, 10);

  const [profileRes, habitsRes, checkinsRes, tasksRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("current_streak,longest_streak,last_active_date")
      .eq("id", u.user.id)
      .maybeSingle(),
    supabase.from("habits").select("id,name").eq("archived", false),
    supabase.from("habit_checkins").select("habit_id").eq("completed_on", today),
    supabase
      .from("daily_todos")
      .select("id,title,completed")
      .eq("scheduled_date", today)
      .eq("completed", false),
  ]);

  const habits = habitsRes.data ?? [];
  const doneIds = new Set((checkinsRes.data ?? []).map((c) => c.habit_id));
  const remainingHabits = habits.filter((h) => !doneIds.has(h.id));
  const openTodos = (tasksRes.data ?? []).filter((t) => !t.completed);
  const profile = profileRes.data;

  // Streak protection
  if (profile && profile.current_streak >= 2 && profile.last_active_date !== today) {
    reminders.push({
      id: "streak-protect",
      tone: "warning",
      title: `Don't lose your ${profile.current_streak}-day streak`,
      body: "One habit or planned task today keeps the fire burning.",
    });
  }

  // One habit left
  if (habits.length > 0 && remainingHabits.length === 1) {
    reminders.push({
      id: "one-habit-left",
      tone: "info",
      title: "Almost there",
      body: `Just "${remainingHabits[0].name}" left to clear today's habits.`,
    });
  }

  // No habits done yet today
  if (habits.length > 0 && doneIds.size === 0) {
    const h = new Date().getHours();
    if (h >= 11) {
      reminders.push({
        id: "no-habit-today",
        tone: "warning",
        title: "No habits checked in yet",
        body: `${habits.length} habit${habits.length === 1 ? "" : "s"} waiting. Pick the easiest one.`,
      });
    }
  }

  // Lots of open tasks
  if (openTodos.length >= 5) {
    reminders.push({
      id: "task-overflow",
      tone: "info",
      title: `${openTodos.length} tasks left in today's plan`,
      body: "Pick one and finish it — momentum beats backlog.",
    });
  }

  // Celebrate
  if (
    habits.length > 0 &&
    remainingHabits.length === 0 &&
    openTodos.length === 0
  ) {
    reminders.push({
      id: "all-clear",
      tone: "success",
      title: "Day cleared",
      body: "Habits done and your plan is empty. Reflect in your journal.",
    });
  }

  return reminders;
}
