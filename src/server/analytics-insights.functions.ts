import { createServerFn } from "@tanstack/react-start";

type StatsPayload = {
  productivity: number;
  discipline: number;
  consistency: number;
  focus: number;
  growth: number;
  wellness: number;
  bestDayName: string;
  bestHour: number;
  completionRate: number;
  weekVsLastWeekPct: number;
  monthVsLastMonthPct: number;
  currentStreak: number;
  longestStreak: number;
  habitName: string | null;
  weakHabitName: string | null;
  pendingTasks: number;
  overdueTasks: number;
  avgMood: number | null;
};

export const generateAnalyticsInsights = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as StatsPayload)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { insights: fallbackInsights(data) };
    }

    const sys = `You are a personal growth coach. Given a user's analytics, return 5 short, specific, motivating insights (each 1 sentence, max 110 chars). Focus on patterns, strengths, weak points, and one action. Use second person ("You"). No emojis. No numbering.`;
    const user = `Stats:\n${JSON.stringify(data, null, 2)}\n\nReturn JSON: {"insights":[5 strings]}`;

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_insights",
                description: "Return 5 short personalized insights",
                parameters: {
                  type: "object",
                  properties: {
                    insights: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 5 },
                  },
                  required: ["insights"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_insights" } },
        }),
      });
      if (!resp.ok) return { insights: fallbackInsights(data) };
      const j = await resp.json();
      const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) return { insights: fallbackInsights(data) };
      const parsed = JSON.parse(args);
      return { insights: (parsed.insights as string[]).slice(0, 5) };
    } catch {
      return { insights: fallbackInsights(data) };
    }
  });

function fallbackInsights(d: StatsPayload): string[] {
  const out: string[] = [];
  out.push(`You perform best on ${d.bestDayName}s — schedule deep work then.`);
  if (d.bestHour >= 0)
    out.push(`Your peak hour is around ${d.bestHour}:00 — protect that window.`);
  if (d.weekVsLastWeekPct >= 0)
    out.push(`You're up ${d.weekVsLastWeekPct}% vs last week. Keep the momentum.`);
  else out.push(`You're down ${Math.abs(d.weekVsLastWeekPct)}% vs last week — small wins reset it.`);
  if (d.weakHabitName) out.push(`"${d.weakHabitName}" is slipping — try a 2‑min version today.`);
  else out.push(`Your habits are consistent — consider raising the bar.`);
  if (d.overdueTasks > 0) out.push(`Clear ${d.overdueTasks} overdue task(s) to unblock the week.`);
  else out.push(`No overdue tasks — you're in control.`);
  return out.slice(0, 5);
}
