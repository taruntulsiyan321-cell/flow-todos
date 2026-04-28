import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CoachInsight = {
  insight: string;
  suggestions: { title: string; reason: string }[];
};

export const getCoachInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CoachInsight> => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const [profileRes, habitsRes, checkinsRes, tasksRes, journalRes] = await Promise.all([
      supabase.from("profiles").select("display_name,xp,level,current_streak,longest_streak").eq("id", userId).maybeSingle(),
      supabase.from("habits").select("id,name,xp_reward").eq("archived", false),
      supabase.from("habit_checkins").select("habit_id,completed_on").gte("completed_on", sevenAgo),
      supabase.from("tasks").select("title,completed,priority,created_at").gte("created_at", `${sevenAgo}T00:00:00Z`).limit(40),
      supabase.from("journal_entries").select("mood,tags,entry_date").gte("entry_date", sevenAgo).limit(20),
    ]);

    const profile = profileRes.data;
    const habits = habitsRes.data ?? [];
    const checkins = checkinsRes.data ?? [];
    const tasks = tasksRes.data ?? [];
    const journal = journalRes.data ?? [];

    const checkinsByHabit = new Map<string, number>();
    for (const c of checkins) checkinsByHabit.set(c.habit_id, (checkinsByHabit.get(c.habit_id) ?? 0) + 1);
    const habitSummary = habits.map((h) => `${h.name}: ${checkinsByHabit.get(h.id) ?? 0}/7 days`).join("; ") || "no habits";
    const taskDone = tasks.filter((t) => t.completed).length;
    const moods = journal.map((j) => j.mood).filter(Boolean) as number[];
    const avgMood = moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : "n/a";

    const prompt = `You are Forge, a concise self-improvement coach in a gamified RPG productivity app. The user is "${profile?.display_name ?? "Adventurer"}" at level ${profile?.level ?? 1} with a ${profile?.current_streak ?? 0}-day streak.

Last 7 days:
- Habits: ${habitSummary}
- Tasks completed: ${taskDone}/${tasks.length}
- Avg mood (1–5): ${avgMood}
- Journal entries: ${journal.length}

Respond in strict JSON only:
{"insight": "<one motivating sentence (max 22 words) reflecting their pattern>", "suggestions": [{"title":"<short habit or action, max 6 words>","reason":"<one sentence reason"}, ...]}
Provide 3 suggestions. No code fences, no extra prose.`;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        insight: "Keep showing up — small reps compound into big level-ups.",
        suggestions: [
          { title: "Add a morning anchor habit", reason: "A reliable cue stabilizes the rest of your day." },
          { title: "Journal one win tonight", reason: "Naming wins reinforces momentum." },
          { title: "Plan tomorrow's top 3", reason: "Pre-deciding reduces friction." },
        ],
      };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      return {
        insight: "Consistency over intensity — one small action today beats a perfect plan tomorrow.",
        suggestions: [
          { title: "Two-minute kickoff", reason: "Lower the bar to start." },
          { title: "Reflect for 60 seconds", reason: "Awareness drives growth." },
          { title: "Hydrate now", reason: "Easy win, instant lift." },
        ],
      };
    }
    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned) as CoachInsight;
      if (!parsed.suggestions) parsed.suggestions = [];
      return parsed;
    } catch {
      return {
        insight: "Steady is strong — keep stacking days.",
        suggestions: [
          { title: "Pick one habit to nail today", reason: "Focus beats spread." },
          { title: "Write one journal line", reason: "Reflection compounds." },
          { title: "Schedule one focus block", reason: "Intent beats reaction." },
        ],
      };
    }
  });
