import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Lightbulb, Plus } from "lucide-react";
import { toast } from "sonner";
import { lifeFrom } from "@/lib/lifeos-db";
import { IDEA_CATEGORIES } from "@/lib/lifeos";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ideas")({
  head: () => ({ meta: [{ title: "Idea Vault — Forge" }] }),
  component: IdeasPage,
});

type Idea = {
  id: string;
  title: string;
  body: string | null;
  category: string;
  cluster_key: string | null;
  status: string;
  created_at: string;
};

function clusterKey(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3)
    .sort()
    .join("-");
}

function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [category, setCategory] = useState("personal");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const load = async () => {
    const { data } = await lifeFrom("ideas").select("*").order("created_at", { ascending: false }).limit(100);
    setIdeas((data as Idea[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  const byCluster = useMemo(() => {
    const map = new Map<string, Idea[]>();
    for (const idea of ideas) {
      const key = idea.cluster_key || idea.category;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(idea);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [ideas]);

  const add = async () => {
    if (!title.trim()) return toast.error("Title required");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const ck = clusterKey(title);
    const { error } = await lifeFrom("ideas").insert({
      user_id: u.user.id,
      title: title.trim(),
      body: body.trim() || null,
      category,
      cluster_key: ck || null,
    });
    if (error) return toast.error(error.message);
    // Also drop into knowledge base
    await lifeFrom("knowledge_notes").insert({
      user_id: u.user.id,
      title: title.trim(),
      content: body.trim() || title.trim(),
      source_type: "idea",
      tags: [category, "idea"],
    });
    setTitle("");
    setBody("");
    toast.success("Idea captured");
    void load();
  };

  return (
    <div className="space-y-5 animate-page-in">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Lightbulb className="h-6 w-6 text-warning" /> Idea Vault
        </h1>
        <p className="text-sm text-muted-foreground">Capture instantly. Similar ideas auto-cluster.</p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {IDEA_CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs",
              category === c.key ? "border-warning text-warning" : "border-border text-muted-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <Input placeholder="Idea title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Details (optional)" value={body} onChange={(e) => setBody(e.target.value)} />
        <Button onClick={add} className="w-full gap-2">
          <Plus className="h-4 w-4" /> Capture
        </Button>
      </div>

      <div className="space-y-4">
        {byCluster.map(([key, group]) => (
          <div key={key}>
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Cluster · {key} ({group.length})
            </p>
            <ul className="space-y-2">
              {group.map((idea) => (
                <li key={idea.id} className="rounded-xl border border-border bg-card px-3 py-2">
                  <p className="text-sm font-medium">{idea.title}</p>
                  {idea.body && <p className="text-xs text-muted-foreground">{idea.body}</p>}
                  <p className="mt-1 text-[10px] uppercase text-muted-foreground">{idea.category}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
