import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Library, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { lifeFrom } from "@/lib/lifeos-db";
import { askKnowledge } from "@/lib/life-coach.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/knowledge")({
  head: () => ({ meta: [{ title: "Knowledge — Forge" }] }),
  component: KnowledgePage,
});

type Note = {
  id: string;
  title: string;
  content: string;
  source_type: string;
  tags: string[] | null;
  updated_at: string;
};

function KnowledgePage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ answer: string; sources: string[] } | null>(null);
  const [asking, setAsking] = useState(false);

  const load = async () => {
    const { data } = await lifeFrom("knowledge_notes").select("*").order("updated_at", { ascending: false }).limit(60);
    setNotes((data as Note[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  const add = async () => {
    if (!title.trim() || !content.trim()) return toast.error("Title and content required");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await lifeFrom("knowledge_notes").insert({
      user_id: u.user.id,
      title: title.trim(),
      content: content.trim(),
      source_type: "note",
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    if (error) return toast.error(error.message);
    setTitle("");
    setContent("");
    setTags("");
    toast.success("Note saved");
    void load();
  };

  const ask = async () => {
    if (!question.trim()) return;
    setAsking(true);
    try {
      setAnswer(await askKnowledge({ data: { question } }));
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-5 animate-page-in">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Library className="h-6 w-6 text-primary" /> Knowledge Base
        </h1>
        <p className="text-sm text-muted-foreground">Notes, journals, highlights — searchable by AI.</p>
      </header>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <div className="flex gap-2">
          <Input placeholder="What did I learn about…?" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <Button onClick={ask} disabled={asking} className="gap-1">
            <Search className="h-4 w-4" /> Ask
          </Button>
        </div>
        {answer && (
          <div className="rounded-xl bg-muted/40 p-3 text-sm">
            <p>{answer.answer}</p>
            {answer.sources?.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">Sources: {answer.sources.join(" · ")}</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Content" value={content} onChange={(e) => setContent(e.target.value)} rows={4} />
        <Input placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
        <Button onClick={add} className="w-full gap-2">
          <Plus className="h-4 w-4" /> Add note
        </Button>
      </div>

      <ul className="space-y-2">
        {notes.map((n) => (
          <li key={n.id} className="rounded-xl border border-border bg-card p-3">
            <p className="text-sm font-semibold">{n.title}</p>
            <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{n.content}</p>
            <p className="mt-2 text-[10px] uppercase text-muted-foreground">
              {n.source_type}
              {n.tags?.length ? ` · ${n.tags.join(", ")}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
