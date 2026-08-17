import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CoachInsight = {
  insight: string;
  suggestions: { title: string; reason: string }[];
  source?: "ai" | "derived";
};

export const getCoachInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CoachInsight> => {
    const { supabase, userId } = context;
    const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    // ── 1. Derive a trustworthy insight from real state first ──────────
    let habitSummary = "no habits";
    let streak = 0;
    let name = "Adventurer";
    let todosOpen = 0;
    let todosDone = 0;
    let checkinCount = 0;
    let habitCount = 0;

    try {
      const [profileRes, habitsRes, checkinsRes, todosRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name,level,current_streak")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("habits").select("id,name").eq("archived", false),
        supabase.from("habit_checkins").select("habit_id,completed_on").gte("completed_on", sevenAgo),
        supabase.from("daily_todos").select("completed").eq("scheduled_date", today),
      ]);

      const habits = habitsRes.data ?? [];
      const checkins = checkinsRes.data ?? [];
      const todos = todosRes.data ?? [];
      habitCount = habits.length;
      checkinCount = checkins.length;
      streak = profileRes.data?.current_streak ?? 0;
      name = profileRes.data?.display_name ?? "Adventurer";
      todosDone = todos.filter((t) => t.completed).length;
      todosOpen = todos.length - todosDone;

      const byHabit = new Map<string, number>();
      for (const c of checkins) byHabit.set(c.habit_id, (byHabit.get(c.habit_id) ?? 0) + 1);
      habitSummary =
        habits.map((h) => `${h.name}: ${byHabit.get(h.id) ?? 0}/7 days`).join("; ") || "no habits";
    } catch (err) {
      console.error("coach: state read failed", err);
    }

    const derived: CoachInsight = {
      source: "derived",
      insight:
        todosOpen > 0
          ? `${todosDone}/${todosDone + todosOpen} of today's plan is done — clear one more block and the day tips in your favour.`
          : habitCount > 0 && checkinCount === 0
            ? "No check-ins this week yet. Pick the single easiest habit and do it now."
            : streak >= 3
              ? `A ${streak}-day streak is real momentum. Protect it with one small action today.`
              : "Plan three concrete blocks for today — clarity beats motivation.",
      suggestions: [
        { title: "Block your next hour", reason: "A named block is far more likely to happen." },
        { title: "Do the smallest habit first", reason: "An early win makes the rest cheaper." },
        { title: "Log the time you spend", reason: "What gets measured gets improved." },
      ],
    };

    // ── 2. Try to enrich with AI, but never hang the dashboard ─────────
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return derived;

    const prompt = `You are Forge, a concise self-improvement coach in a habit + study planning app.
User: "${name}", ${streak}-day streak.
Last 7 days habits: ${habitSummary}
Today's plan: ${todosDone} done, ${todosOpen} remaining.

Respond in strict JSON only:
{"insight":"<one motivating, specific sentence, max 22 words>","suggestions":[{"title":"<max 6 words>","reason":"<one short sentence>"}]}
Exactly 3 suggestions. No code fences, no extra prose.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        console.error("coach: gateway status", res.status);
        return derived;
      }
      const json = await res.json();
      const text: string = json?.choices?.[0]?.message?.content ?? "";
      const cleaned = text.replace(/```json|```/g, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start < 0 || end <= start) return derived;
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as CoachInsight;
      if (!parsed.insight) return derived;
      return {
        insight: parsed.insight,
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
        source: "ai",
      };
    } catch (err) {
      console.error("coach: ai call failed", err);
      return derived;
    }
  });
