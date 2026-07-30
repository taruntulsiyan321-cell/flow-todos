import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookMarked, Plus, Quote, Check } from "lucide-react";
import { toast } from "sonner";
import { lifeFrom } from "@/lib/lifeos-db";
import { LEARNING_KINDS } from "@/lib/lifeos";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/learning")({
  head: () => ({ meta: [{ title: "Learning — Forge" }] }),
  component: LearningPage,
});

type Item = {
  id: string;
  kind: string;
  title: string;
  author: string | null;
  status: string;
  progress: number;
  key_learnings: string | null;
};

type Highlight = {
  id: string;
  learning_item_id: string | null;
  quote: string;
  note: string | null;
  action_item: string | null;
  applied: boolean;
  created_at: string;
};

function LearningPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [kind, setKind] = useState("book");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [quote, setQuote] = useState("");
  const [note, setNote] = useState("");
  const [action, setAction] = useState("");
  const [itemId, setItemId] = useState("");

  const load = async () => {
    const [i, h] = await Promise.all([
      lifeFrom("learning_items").select("*").order("updated_at", { ascending: false }).limit(50),
      lifeFrom("reading_highlights").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setItems((i.data as Item[]) ?? []);
    setHighlights((h.data as Highlight[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  const stale = highlights.filter((h) => !h.applied && Date.now() - +new Date(h.created_at) > 1000 * 60 * 60 * 24 * 30);

  const addItem = async () => {
    if (!title.trim()) return toast.error("Title required");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await lifeFrom("learning_items").insert({
      user_id: u.user.id,
      kind,
      title: title.trim(),
      author: author.trim() || null,
      started_on: new Date().toISOString().slice(0, 10),
    });
    if (error) return toast.error(error.message);
    setTitle("");
    setAuthor("");
    toast.success("Added to learning tracker");
    void load();
  };

  const addHighlight = async () => {
    if (!quote.trim()) return toast.error("Quote required");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await lifeFrom("reading_highlights")
      .insert({
        user_id: u.user.id,
        learning_item_id: itemId || null,
        quote: quote.trim(),
        note: note.trim() || null,
        action_item: action.trim() || null,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    await lifeFrom("knowledge_notes").insert({
      user_id: u.user.id,
      title: quote.trim().slice(0, 80),
      content: `${quote.trim()}${note ? `\n\nNote: ${note}` : ""}${action ? `\n\nAction: ${action}` : ""}`,
      source_type: "highlight",
      source_id: data?.id,
      tags: ["highlight", kind],
    });
    setQuote("");
    setNote("");
    setAction("");
    toast.success("Highlight saved");
    void load();
  };

  const markApplied = async (id: string) => {
    await lifeFrom("reading_highlights")
      .update({ applied: true, applied_at: new Date().toISOString() })
      .eq("id", id);
    void load();
  };

  return (
    <div className="space-y-5 animate-page-in">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BookMarked className="h-6 w-6 text-accent" /> Learning & Reading
        </h1>
      </header>

      {stale.length > 0 && (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm font-medium text-warning">
            You highlighted an idea {Math.floor((Date.now() - +new Date(stale[0].created_at)) / (1000 * 60 * 60 * 24))}{" "}
            days ago but never applied it.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">“{stale[0].quote.slice(0, 140)}”</p>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {LEARNING_KINDS.map((k) => (
          <button
            key={k.key}
            onClick={() => setKind(k.key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs",
              kind === k.key ? "border-accent text-accent" : "border-border text-muted-foreground",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Author / creator" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <Button onClick={addItem} className="w-full gap-2">
          <Plus className="h-4 w-4" /> Add {kind}
        </Button>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-border bg-card px-3 py-2">
            <p className="text-sm font-medium">
              {item.title} <span className="text-xs text-muted-foreground">· {item.kind}</span>
            </p>
            {item.author && <p className="text-xs text-muted-foreground">{item.author}</p>}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${item.progress}%`, background: "var(--gradient-primary)" }} />
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Quote className="h-3.5 w-3.5" /> Reading companion
        </p>
        <select
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
        >
          <option value="">Unlinked highlight</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.title}
            </option>
          ))}
        </select>
        <Textarea placeholder="Quote / highlight" value={quote} onChange={(e) => setQuote(e.target.value)} />
        <Input placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
        <Input placeholder="Action item" value={action} onChange={(e) => setAction(e.target.value)} />
        <Button onClick={addHighlight} className="w-full">
          Save highlight
        </Button>
      </div>

      <ul className="space-y-2">
        {highlights.map((h) => (
          <li key={h.id} className="rounded-xl border border-border bg-card p-3">
            <p className="text-sm italic text-foreground">“{h.quote}”</p>
            {h.action_item && <p className="mt-1 text-xs text-accent">Action: {h.action_item}</p>}
            {!h.applied && (
              <button onClick={() => markApplied(h.id)} className="mt-2 flex items-center gap-1 text-xs text-success">
                <Check className="h-3.5 w-3.5" /> Mark applied
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
