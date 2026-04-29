import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WeeklySummary = {
  summary: string;
  highlight: string | null;
  caution: string | null;
  fromCache: boolean;
};

/**
 * Generates a short reflection over the user's last 7 days of journal entries
 * using Lovable AI Gateway. Uses in-memory cache via the response shape
 * (the client caches the result with TanStack Query / route loader).
 */
export const getJournalWeeklySummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WeeklySummary> => {
    const { supabase } = context;
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceStr = since.toISOString().slice(0, 10);

    const { data: entries, error } = await supabase
      .from("journal_entries")
      .select("entry_date,title,content,mood,tags")
      .gte("entry_date", sinceStr)
      .order("entry_date", { ascending: true });

    if (error) {
      return {
        summary: "Couldn't load your journal right now.",
        highlight: null,
        caution: null,
        fromCache: false,
      };
    }

    if (!entries || entries.length === 0) {
      return {
        summary:
          "No journal entries this week yet. Add one and I'll reflect with you.",
        highlight: null,
        caution: null,
        fromCache: false,
      };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        summary: `You wrote ${entries.length} entr${entries.length === 1 ? "y" : "ies"} this week. Keep showing up.`,
        highlight: null,
        caution: null,
        fromCache: false,
      };
    }

    const compact = entries
      .map((e) => {
        const mood = e.mood ? ` mood:${e.mood}/5` : "";
        const tags = e.tags?.length ? ` #${e.tags.join(" #")}` : "";
        return `[${e.entry_date}${mood}${tags}] ${e.title ? e.title + " — " : ""}${e.content.slice(0, 400)}`;
      })
      .join("\n");

    try {
      const res = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "You are a calm, warm coach reading a user's private journal. Reply ONLY by calling the reflect tool. Be specific, kind, second-person, present tense. Avoid generic platitudes.",
              },
              {
                role: "user",
                content: `Past 7 days of entries:\n${compact}\n\nReflect briefly.`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "reflect",
                  description: "Return a 2-sentence summary, one highlight, one caution.",
                  parameters: {
                    type: "object",
                    properties: {
                      summary: { type: "string", description: "2 sentences max." },
                      highlight: { type: "string", description: "One specific positive pattern, 1 short sentence." },
                      caution: { type: "string", description: "One gentle thing to watch, 1 short sentence." },
                    },
                    required: ["summary", "highlight", "caution"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "reflect" } },
          }),
        },
      );

      if (res.status === 429) {
        return {
          summary: "AI coach is busy — try again in a minute.",
          highlight: null,
          caution: null,
          fromCache: false,
        };
      }
      if (res.status === 402) {
        return {
          summary: "AI coach credits exhausted. Add credits in Settings → Workspace → Usage.",
          highlight: null,
          caution: null,
          fromCache: false,
        };
      }
      if (!res.ok) {
        return {
          summary: `You wrote ${entries.length} entr${entries.length === 1 ? "y" : "ies"} this week. Keep showing up.`,
          highlight: null,
          caution: null,
          fromCache: false,
        };
      }

      const data = await res.json();
      const tc = data?.choices?.[0]?.message?.tool_calls?.[0];
      if (tc?.function?.arguments) {
        const args = JSON.parse(tc.function.arguments);
        return {
          summary: String(args.summary ?? "").slice(0, 400),
          highlight: args.highlight ? String(args.highlight).slice(0, 200) : null,
          caution: args.caution ? String(args.caution).slice(0, 200) : null,
          fromCache: false,
        };
      }
      const text = data?.choices?.[0]?.message?.content;
      return {
        summary: typeof text === "string" ? text.slice(0, 400) : "Reflection unavailable.",
        highlight: null,
        caution: null,
        fromCache: false,
      };
    } catch (e) {
      console.error("weekly summary failed", e);
      return {
        summary: `You wrote ${entries.length} entr${entries.length === 1 ? "y" : "ies"} this week.`,
        highlight: null,
        caution: null,
        fromCache: false,
      };
    }
  });
