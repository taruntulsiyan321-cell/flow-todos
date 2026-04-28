import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Plus, Smile, Meh, Frown, Heart, Zap, Trash2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
};

const MOODS = [
  { value: 1, Icon: Frown, label: "Rough", color: "var(--destructive)" },
  { value: 2, Icon: Meh, label: "Meh", color: "var(--warning)" },
  { value: 3, Icon: Smile, label: "Okay", color: "var(--accent)" },
  { value: 4, Icon: Heart, label: "Good", color: "var(--success)" },
  { value: 5, Icon: Zap, label: "Great", color: "var(--primary)" },
];

function JournalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number>(3);
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    setEntries(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    if (!content.trim()) {
      toast.error("Write something first");
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase.from("journal_entries").insert({
      user_id: u.user.id,
      title: title.trim() || null,
      content: content.trim(),
      mood,
      tags,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("+20 XP — entry saved");
    setTitle("");
    setContent("");
    setMood(3);
    setTagsInput("");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("journal_entries").delete().eq("id", id);
    setEntries((e) => e.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-5">
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
              <div>
                <Label htmlFor="j-title">Title (optional)</Label>
                <Input id="j-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A line about today..." />
              </div>
              <div>
                <Label htmlFor="j-content">Reflection</Label>
                <Textarea
                  id="j-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What happened? How did it feel? What did you learn?"
                  rows={6}
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
                        {new Date(e.entry_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
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
