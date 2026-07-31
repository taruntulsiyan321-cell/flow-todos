import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Plus, Smile, Meh, Frown, Heart, Zap, Trash2, Sparkles, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WeeklyJournalSummary } from "@/components/WeeklyJournalSummary";
import { dailyPrompt } from "@/lib/journal-prompts";
import { cacheGet, cacheSet, cacheInvalidate } from "@/lib/page-cache";
import { formatLocalDay } from "@/lib/dates";

export const Route = createFileRoute("/_app/journal")({
  head: () => ({ meta: [{ title: "Journal — Forge" }] }),
  component: JournalPage,
});

type Entry = {
  id: string;
  title: string | null;
  content: string;
  mood: number | null;
  tags: string[] | null;
  entry_date: string;
  created_at: string;
  entry_type?: string;
  structured?: Record<string, string> | null;
};

const MOODS = [
  { value: 1, Icon: Frown, label: "Rough", color: "var(--destructive)" },
  { value: 2, Icon: Meh, label: "Meh", color: "var(--warning)" },
  { value: 3, Icon: Smile, label: "Okay", color: "var(--accent)" },
  { value: 4, Icon: Heart, label: "Good", color: "var(--success)" },
  { value: 5, Icon: Zap, label: "Great", color: "var(--primary)" },
];

function JournalPage() {
  const cached = cacheGet<Entry[]>("journal");
  const [entries, setEntries] = useState<Entry[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number>(3);
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [entryType, setEntryType] = useState<"free" | "morning" | "evening">("free");
  const [structured, setStructured] = useState<Record<string, string>>({});
  const prompt = useMemo(() => dailyPrompt(), []);

  const structuredFields =
    entryType === "morning"
      ? [
          ["gratitude", "Gratitude"],
          ["intention", "Intention"],
          ["mit", "Most Important Task"],
          ["focus", "Today's Focus"],
        ]
      : entryType === "evening"
        ? [
            ["wins", "Wins"],
            ["mistakes", "Mistakes"],
            ["lessons", "Lessons"],
            ["reflection", "Reflection"],
            ["gratitude", "Gratitude"],
          ]
        : [];

  const usePrompt = () => {
    setOpen(true);
    setTitle((t) => t || prompt.prompt);
    setTagsInput((cur) => {
      const existing = cur.split(",").map((t) => t.trim()).filter(Boolean);
      const merged = Array.from(new Set([...existing, ...prompt.tags]));
      return merged.join(", ");
    });
  };

  const load = async () => {
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    const next = data ?? [];
    setEntries(next);
    cacheSet("journal", next);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    const structuredText = structuredFields
      .map(([k, label]) => `${label}: ${structured[k] ?? ""}`)
      .filter((l) => !l.endsWith(": "))
      .join("\n");
    const body = entryType === "free" ? content.trim() : [structuredText, content.trim()].filter(Boolean).join("\n\n");
    if (!body) {
      toast.error("Write something first");
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSaving(false);
      return;
    }
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const { lifeFrom } = await import("@/lib/lifeos-db");
    const { error } = await lifeFrom("journal_entries").insert({
      user_id: u.user.id,
      title: title.trim() || (entryType === "morning" ? "Morning journal" : entryType === "evening" ? "Evening journal" : null),
      content: body,
      mood,
      tags: [...tags, entryType],
      entry_type: entryType,
      structured,
    });
    setSaving(false);
    if (error) {
      const { error: e2 } = await supabase.from("journal_entries").insert({
        user_id: u.user.id,
        title: title.trim() || null,
        content: body,
        mood,
        tags,
      });
      if (e2) {
        toast.error(e2.message);
        return;
      }
    }
    // Mirror into knowledge base
    try {
      const { lifeFrom: lf } = await import("@/lib/lifeos-db");
      await lf("knowledge_notes").insert({
        user_id: u.user.id,
        title: title.trim() || `${entryType} journal`,
        content: body,
        source_type: "journal",
        tags: [...tags, "journal", entryType],
      });
    } catch {
      /* optional */
    }
    toast.success("+20 XP — entry saved");
    setTitle("");
    setContent("");
    setMood(3);
    setTagsInput("");
    setStructured({});
    setOpen(false);
    cacheInvalidate("dashboard");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("journal_entries").delete().eq("id", id);
    setEntries((e) => {
      const next = e.filter((x) => x.id !== id);
      cacheSet("journal", next);
      return next;
    });
    cacheInvalidate("dashboard");
  };

  return (
    <div className="space-y-5 animate-page-in">
      <WeeklyJournalSummary />

      {/* Daily prompt */}
      <button
        onClick={usePrompt}
        className="group block w-full rounded-2xl border border-primary/30 p-5 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
        style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-glow)" }}
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Today's prompt</p>
        </div>
        <p className="mt-2 text-sm font-medium text-foreground">{prompt.prompt}</p>
        <p className="mt-2 text-xs text-muted-foreground">Tap to start writing →</p>
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <BookOpen className="h-6 w-6 text-primary" />
            Journal
          </h1>
          <p className="text-sm text-muted-foreground">Reflect daily. +20 XP per entry.</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm" className="rounded-full" style={{ background: "var(--gradient-primary)" }}>
              <Plus className="h-4 w-4" /> New
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>New entry</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(["morning", "free", "evening"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEntryType(t)}
                    className={cn(
                      "rounded-xl border py-2 text-xs capitalize",
                      entryType === t ? "border-primary text-primary" : "border-border text-muted-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div>
                <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Mood</Label>
                <div className="flex justify-between gap-2">
                  {MOODS.map(({ value, Icon, label, color }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMood(value)}
                      className={cn(
                        "flex flex-1 flex-col items-center gap-1 rounded-2xl border p-3 transition",
                        mood === value ? "border-primary" : "border-border",
                      )}
                      style={mood === value ? { background: "var(--gradient-card)", boxShadow: "var(--shadow-glow)" } : undefined}
                    >
                      <Icon className="h-5 w-5" style={{ color }} />
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {structuredFields.map(([key, label]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Textarea
                    value={structured[key] ?? ""}
                    onChange={(e) => setStructured((s) => ({ ...s, [key]: e.target.value }))}
                    rows={2}
                    placeholder={label}
                  />
                </div>
              ))}
              <div>
                <Label htmlFor="j-title">Title (optional)</Label>
                <Input id="j-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A line about today..." />
              </div>
              <div>
                <Label htmlFor="j-content">{entryType === "free" ? "Reflection" : "Extra notes"}</Label>
                <Textarea
                  id="j-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What happened? How did it feel? What did you learn?"
                  rows={entryType === "free" ? 6 : 3}
                />
              </div>
              <div>
                <Label htmlFor="j-tags">Tags (comma separated)</Label>
                <Input id="j-tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="growth, gratitude, study" />
              </div>
              <Button className="w-full rounded-full" style={{ background: "var(--gradient-primary)" }} onClick={submit} disabled={saving}>
                {saving ? "Saving…" : "Save entry"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-card" />
          <div className="h-24 animate-pulse rounded-2xl bg-card" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm font-medium text-foreground">Your journal is empty</p>
          <p className="text-xs text-muted-foreground">Start with one sentence about today.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => {
            const m = MOODS.find((x) => x.value === e.mood);
            return (
              <article
                key={e.id}
                className="rounded-2xl border border-border p-4"
                style={{ background: "var(--gradient-card)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {m && <m.Icon className="h-5 w-5" style={{ color: m.color }} />}
                    <div>
                      <p className="text-sm font-semibold text-foreground">{e.title || "Untitled"}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {formatLocalDay(e.entry_date, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => remove(e.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">{e.content}</p>
                {e.tags && e.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {e.tags.map((t) => (
                      <span key={t} className="rounded-full border border-border bg-card/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
