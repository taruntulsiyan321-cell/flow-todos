import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callForgeAI, parseJsonLoose } from "@/lib/ai";
import { contributionPercent, formatHourRange, mostProductiveHour } from "@/lib/lifeos";

export type EveningCoachReport = {
  wentWell: string;
  wentWrong: string;
  biggestDistraction: string;
  biggestAchievement: string;
  improveTomorrow: string;
  slippingHabits: string;
  goalAlignment: string;
  focusTomorrow: string;
  contributionNote: string;
  fromAI: boolean;
};

export type TimeIntelligence = {
  deepMinutes: number;
  shallowMinutes: number;
  interruptions: number;
  contextSwitches: number;
  productiveWindow: string;
  recommendation: string;
};

async function gatherDayContext(supabase: any, userId: string, day: string) {
  const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [
    profileRes,
    habitsRes,
    checkinsRes,
    tasksRes,
    journalRes,
    goalsRes,
    timeRes,
    energyRes,
    memoriesRes,
    manualRes,
    identityRes,
  ] = await Promise.all([
    supabase.from("profiles").select("display_name,xp,level,current_streak").eq("id", userId).maybeSingle(),
    supabase.from("habits").select("id,name").eq("archived", false),
    supabase.from("habit_checkins").select("habit_id,completed_on").gte("completed_on", sevenAgo),
    supabase
      .from("tasks")
      .select("id,title,completed,goal_id,postponed_count,last_postpone_reason,completed_at,created_at")
      .or(`created_at.gte.${day}T00:00:00Z,completed_at.gte.${day}T00:00:00Z`)
      .limit(60),
    supabase.from("journal_entries").select("entry_type,content,mood,structured,title").eq("entry_date", day),
    supabase.from("goals").select("id,title,horizon,progress,status").eq("status", "active").limit(40),
    supabase
      .from("time_logs")
      .select("start_time,duration_minutes,work_depth,interruptions,context_switches")
      .eq("log_date", day),
    supabase.from("energy_logs").select("energy,mood,stress,sleep_hours,motivation").eq("log_date", day),
    supabase.from("ai_memories").select("category,content,importance").order("importance", { ascending: false }).limit(20),
    supabase.from("operating_manual").select("insight").eq("active", true).limit(12),
    supabase.from("identity_statements").select("statement,evidence_count").eq("active", true).limit(10),
  ]);

  return {
    profile: profileRes.data,
    habits: habitsRes.data ?? [],
    checkins: checkinsRes.data ?? [],
    tasks: tasksRes.data ?? [],
    journal: journalRes.data ?? [],
    goals: goalsRes.data ?? [],
    timeLogs: timeRes.data ?? [],
    energy: energyRes.data ?? [],
    memories: memoriesRes.data ?? [],
    manual: manualRes.data ?? [],
    identity: identityRes.data ?? [],
  };
}

function buildTimeIntel(timeLogs: any[]): TimeIntelligence {
  let deep = 0;
  let shallow = 0;
  let interruptions = 0;
  let switches = 0;
  for (const t of timeLogs) {
    const mins = t.duration_minutes ?? 0;
    if (t.work_depth === "deep") deep += mins;
    else if (t.work_depth === "shallow" || t.work_depth === "meeting") shallow += mins;
    interruptions += t.interruptions ?? 0;
    switches += t.context_switches ?? 0;
  }
  const { hour } = mostProductiveHour(timeLogs);
  const window = formatHourRange(hour);
  return {
    deepMinutes: deep,
    shallowMinutes: shallow,
    interruptions,
    contextSwitches: switches,
    productiveWindow: window,
    recommendation: `Schedule difficult work between ${window}.`,
  };
}

function fallbackEvening(ctx: Awaited<ReturnType<typeof gatherDayContext>>, day: string): EveningCoachReport {
  const done = ctx.tasks.filter((t: any) => t.completed).length;
  const open = ctx.tasks.length - done;
  const doneToday = new Set(
    ctx.checkins.filter((c: any) => c.completed_on === day).map((c: any) => c.habit_id),
  );
  const missed = ctx.habits.filter((h: any) => !doneToday.has(h.id)).map((h: any) => h.name);
  const monthly = ctx.goals.find((g: any) => g.horizon === "monthly");
  const linkedDone = ctx.tasks.filter((t: any) => t.completed && t.goal_id).length;
  const linkedTotal = ctx.tasks.filter((t: any) => t.goal_id).length || Math.max(1, ctx.tasks.length);
  const pct = contributionPercent(linkedDone || done, linkedTotal);

  return {
    wentWell: done > 0 ? `You completed ${done} task${done === 1 ? "" : "s"} today.` : "You showed up — that counts.",
    wentWrong: open > 3 ? `${open} tasks still open — scope may be too wide.` : "Nothing major broke; keep refining focus.",
    biggestDistraction: interruptionsLabel(ctx),
    biggestAchievement: ctx.tasks.find((t: any) => t.completed)?.title ?? "Keeping the streak alive",
    improveTomorrow: "Protect one 90-minute deep work block before noon.",
    slippingHabits: missed.length ? missed.slice(0, 3).join(", ") : "None — habit consistency looks solid.",
    goalAlignment:
      monthly
        ? `Today's work contributed ~${pct}% toward "${monthly.title}".`
        : `Today's work contributed ~${pct}% toward your active goals.`,
    focusTomorrow: missed[0] ? `Nail "${missed[0]}" first thing.` : "Ship your single most important task before checking messages.",
    contributionNote:
      monthly
        ? `Today's work contributed ${pct}% toward your ${monthly.title}.`
        : `Today's work contributed ${pct}% toward your active goals.`,
    fromAI: false,
  };
}

function interruptionsLabel(ctx: Awaited<ReturnType<typeof gatherDayContext>>) {
  const total = ctx.timeLogs.reduce((a: number, t: any) => a + (t.interruptions ?? 0), 0);
  if (total > 5) return `Interruptions (${total} logged) — shallow switches ate focus.`;
  const postponed = ctx.tasks.filter((t: any) => (t.postponed_count ?? 0) > 0);
  if (postponed.length) return `Postponing "${postponed[0].title}" — friction is the real distraction.`;
  return "Context switching / reactive work";
}

export const getEveningCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ day: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ context, data }): Promise<EveningCoachReport & { timeIntel: TimeIntelligence }> => {
    const day = data.day ?? new Date().toISOString().slice(0, 10);
    const { supabase, userId } = context as any;
    const ctx = await gatherDayContext(supabase, userId, day);
    const timeIntel = buildTimeIntel(ctx.timeLogs);
    const base = fallbackEvening(ctx, day);

    const memoryBlock = [
      ...ctx.memories.map((m: any) => `[${m.category}] ${m.content}`),
      ...ctx.manual.map((m: any) => `[manual] ${m.insight}`),
      ...ctx.identity.map((i: any) => `[identity] ${i.statement}`),
    ]
      .slice(0, 25)
      .join("\n");

    const prompt = `You are Forge, an elite AI life coach. Answer tonight's review for ${ctx.profile?.display_name ?? "the user"} on ${day}.

Stats:
- Tasks done: ${ctx.tasks.filter((t: any) => t.completed).length}/${ctx.tasks.length}
- Habits checked today: ${ctx.checkins.filter((c: any) => c.completed_on === day).length}/${ctx.habits.length}
- Deep work min: ${timeIntel.deepMinutes}, shallow: ${timeIntel.shallowMinutes}, interruptions: ${timeIntel.interruptions}
- Goals: ${ctx.goals.map((g: any) => `${g.horizon}:${g.title}(${g.progress}%)`).join("; ") || "none"}
- Energy logs: ${JSON.stringify(ctx.energy)}
- Journal: ${ctx.journal.map((j: any) => `${j.entry_type}:${(j.content || "").slice(0, 200)}`).join(" | ") || "none"}

Known user memory / operating manual:
${memoryBlock || "none yet"}

Respond strict JSON only:
{
  "wentWell":"...",
  "wentWrong":"...",
  "biggestDistraction":"...",
  "biggestAchievement":"...",
  "improveTomorrow":"...",
  "slippingHabits":"...",
  "goalAlignment":"...",
  "focusTomorrow":"...",
  "contributionNote":"Today's work contributed X% toward ..."
}
Max 28 words per field. Be specific, never generic.`;

    const text = await callForgeAI(prompt, "Return JSON only. No markdown.");
    if (!text) return { ...base, timeIntel };
    const parsed = parseJsonLoose<EveningCoachReport>(text, base);
    return { ...base, ...parsed, fromAI: true, timeIntel };
  });

export type WeeklyReviewPayload = {
  achievements: string[];
  failures: string[];
  timeDistribution: string;
  goalProgress: string;
  habitProgress: string;
  missedOpportunities: string[];
  improvements: string[];
  weeklyScore: number;
  summary: string;
};

export const getWeeklyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ start: z.string().optional(), end: z.string().optional() }).parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<WeeklyReviewPayload> => {
    const { supabase, userId } = context as any;
    const start = data.start ?? new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const end = data.end ?? new Date().toISOString().slice(0, 10);

    const [habits, checkins, tasks, goals, timeLogs, reviews] = await Promise.all([
      supabase.from("habits").select("id,name").eq("archived", false),
      supabase.from("habit_checkins").select("habit_id,completed_on").gte("completed_on", start).lte("completed_on", end),
      supabase.from("tasks").select("title,completed,completed_at").gte("created_at", `${start}T00:00:00Z`),
      supabase.from("goals").select("title,horizon,progress,status"),
      supabase.from("time_logs").select("duration_minutes,work_depth,category").gte("log_date", start).lte("log_date", end),
      supabase.from("life_reviews").select("id").eq("period", "weekly").eq("period_start", start).maybeSingle(),
    ]);

    const habitRows = habits.data ?? [];
    const ck = checkins.data ?? [];
    const taskRows = tasks.data ?? [];
    const goalRows = goals.data ?? [];
    const times = timeLogs.data ?? [];
    const done = taskRows.filter((t: any) => t.completed).length;
    const deep = times.filter((t: any) => t.work_depth === "deep").reduce((a: number, t: any) => a + (t.duration_minutes ?? 0), 0);
    const totalMin = times.reduce((a: number, t: any) => a + (t.duration_minutes ?? 0), 0);
    const habitRate =
      habitRows.length === 0
        ? 0
        : Math.round((ck.length / (habitRows.length * 7)) * 100);

    const fallback: WeeklyReviewPayload = {
      achievements: done ? [`Completed ${done} tasks`] : ["Showed up consistently"],
      failures: habitRate < 50 ? ["Habit consistency dipped below 50%"] : [],
      timeDistribution: `${Math.round(totalMin / 60)}h logged · ${Math.round(deep / 60)}h deep work`,
      goalProgress: goalRows
        .filter((g: any) => g.status === "active")
        .slice(0, 5)
        .map((g: any) => `${g.title}: ${g.progress}%`)
        .join("; ") || "No active goals",
      habitProgress: `${habitRate}% completion across habits`,
      missedOpportunities: deep < 120 ? ["Fewer than 2h of deep work this week"] : [],
      improvements: ["Block two deep-work mornings", "Close open loops on Friday"],
      weeklyScore: Math.min(100, Math.round(habitRate * 0.4 + Math.min(40, done * 4) + Math.min(20, deep / 30))),
      summary: "Solid week of reps — tighten deep work and habit follow-through.",
    };

    const prompt = `Generate a GTD-style weekly review JSON for ${start} to ${end}.
Tasks completed: ${done}/${taskRows.length}
Habit checkins: ${ck.length} across ${habitRows.length} habits
Time: ${totalMin} min (deep ${deep})
Goals: ${JSON.stringify(goalRows.slice(0, 12))}
Return JSON: {"achievements":[],"failures":[],"timeDistribution":"","goalProgress":"","habitProgress":"","missedOpportunities":[],"improvements":[],"weeklyScore":0-100,"summary":""}`;

    const text = await callForgeAI(prompt, "JSON only.");
    const payload = text ? parseJsonLoose(text, fallback) : fallback;

    await supabase.from("life_reviews").upsert(
      {
        user_id: userId,
        period: "weekly",
        period_start: start,
        period_end: end,
        payload,
        score: payload.weeklyScore,
      },
      { onConflict: "user_id,period,period_start" },
    );

    void reviews;
    return payload;
  });

export type MonthlyReviewPayload = {
  bestAchievements: string[];
  biggestMistakes: string[];
  productivityTrends: string;
  habitConsistency: string;
  goalCompletion: string;
  learningSummary: string;
  timeAllocation: string;
  recommendations: string[];
  monthlyScore: number;
};

export const getMonthlyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ start: z.string().optional(), end: z.string().optional() }).parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<MonthlyReviewPayload> => {
    const { supabase, userId } = context as any;
    const start =
      data.start ??
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const end =
      data.end ??
      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

    const [tasks, checkins, habits, goals, learning, timeLogs] = await Promise.all([
      supabase.from("tasks").select("title,completed").gte("created_at", `${start}T00:00:00Z`),
      supabase.from("habit_checkins").select("habit_id").gte("completed_on", start).lte("completed_on", end),
      supabase.from("habits").select("id,name").eq("archived", false),
      supabase.from("goals").select("title,progress,status,horizon"),
      supabase.from("learning_items").select("title,kind,status,key_learnings").limit(30),
      supabase.from("time_logs").select("duration_minutes,category,work_depth").gte("log_date", start).lte("log_date", end),
    ]);

    const done = (tasks.data ?? []).filter((t: any) => t.completed).length;
    const habitN = (habits.data ?? []).length || 1;
    const days = Math.max(1, Math.round((+new Date(end) - +new Date(start)) / 86400000) + 1);
    const habitConsistency = Math.round((((checkins.data ?? []).length / (habitN * days)) * 100));
    const totalMin = (timeLogs.data ?? []).reduce((a: number, t: any) => a + (t.duration_minutes ?? 0), 0);

    const fallback: MonthlyReviewPayload = {
      bestAchievements: [`Completed ${done} tasks`],
      biggestMistakes: habitConsistency < 50 ? ["Inconsistent habits"] : [],
      productivityTrends: `${Math.round(totalMin / 60)} hours logged this month`,
      habitConsistency: `${habitConsistency}%`,
      goalCompletion: (goals.data ?? [])
        .slice(0, 6)
        .map((g: any) => `${g.title} ${g.progress}%`)
        .join("; ") || "n/a",
      learningSummary:
        (learning.data ?? [])
          .filter((l: any) => l.status === "completed" || l.key_learnings)
          .map((l: any) => l.title)
          .slice(0, 5)
          .join(", ") || "No learning items logged",
      timeAllocation: `${Math.round(totalMin / 60)}h total`,
      recommendations: ["Raise deep-work share", "Close one monthly goal early"],
      monthlyScore: Math.min(100, Math.round(habitConsistency * 0.5 + Math.min(50, done))),
    };

    const text = await callForgeAI(
      `Monthly life review ${start}→${end}. Data: tasksDone=${done}, habitConsistency=${habitConsistency}%, hours=${Math.round(totalMin / 60)}, goals=${JSON.stringify(goals.data ?? [])}, learning=${JSON.stringify(learning.data ?? [])}.
Return JSON {"bestAchievements":[],"biggestMistakes":[],"productivityTrends":"","habitConsistency":"","goalCompletion":"","learningSummary":"","timeAllocation":"","recommendations":[],"monthlyScore":0-100}`,
      "JSON only.",
    );
    const payload = text ? parseJsonLoose(text, fallback) : fallback;

    await supabase.from("life_reviews").upsert(
      {
        user_id: userId,
        period: "monthly",
        period_start: start,
        period_end: end,
        payload,
        score: payload.monthlyScore,
      },
      { onConflict: "user_id,period,period_start" },
    );

    return payload;
  });

export const refreshOperatingManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({}).parse(data ?? {}))
  .handler(async ({ context }): Promise<{ insights: string[] }> => {
    const { supabase, userId } = context as any;
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const [timeLogs, energy, checkins, tasks, journal] = await Promise.all([
      supabase.from("time_logs").select("start_time,duration_minutes,work_depth").gte("log_date", since),
      supabase.from("energy_logs").select("energy,mood,stress,sleep_hours,log_date").gte("log_date", since),
      supabase.from("habit_checkins").select("completed_on,habit_id").gte("completed_on", since),
      supabase.from("tasks").select("completed,completed_at,postponed_count").gte("created_at", `${since}T00:00:00Z`),
      supabase.from("journal_entries").select("mood,entry_date").gte("entry_date", since),
    ]);

    const { hour } = mostProductiveHour(timeLogs.data ?? []);
    const heuristic = [
      `You work best around ${formatHourRange(hour)}.`,
      "Protect 90-minute focus sessions for hard work.",
    ];
    const text = await callForgeAI(
      `Build a personal operating manual (short living insights) from:
time=${JSON.stringify((timeLogs.data ?? []).slice(0, 40))}
energy=${JSON.stringify((energy.data ?? []).slice(0, 40))}
habits=${JSON.stringify((checkins.data ?? []).slice(0, 40))}
tasks=${JSON.stringify((tasks.data ?? []).slice(0, 40))}
journal moods=${JSON.stringify((journal.data ?? []).slice(0, 40))}
Return JSON {"insights":["...","..."]} max 8 insights, each one sentence, pattern-based.`,
      "JSON only.",
    );
    const parsed = text ? parseJsonLoose<{ insights: string[] }>(text, { insights: heuristic }) : { insights: heuristic };
    for (const insight of parsed.insights.slice(0, 8)) {
      await supabase.from("operating_manual").insert({
        user_id: userId,
        insight,
        confidence: 0.6,
        evidence_count: 1,
      });
    }
    return parsed;
  });
