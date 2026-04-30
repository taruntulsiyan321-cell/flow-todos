import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/communities/new")({
  head: () => ({ meta: [{ title: "New community — Forge" }] }),
  component: NewCommunity,
});

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes only"),
  description: z.string().trim().max(500).optional(),
  category: z.enum(["fitness", "mindfulness", "study", "productivity", "general"]),
  is_private: z.boolean(),
});

const CATEGORIES = ["fitness", "mindfulness", "study", "productivity", "general"] as const;

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function NewCommunity() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("productivity");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      name,
      slug: slug || slugify(name),
      description: description || undefined,
      category,
      is_private: isPrivate,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("communities")
        .insert({
          name: parsed.data.name,
          slug: parsed.data.slug,
          description: parsed.data.description ?? null,
          category: parsed.data.category,
          is_private: parsed.data.is_private,
          created_by: user.id,
        })
        .select("slug")
        .single();
      if (error) throw error;

      toast.success("Community created!");
      navigate({ to: "/communities/$slug", params: { slug: data.slug } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't create community";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("That slug is already taken — try another.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-page-in space-y-5">
      <Link
        to="/communities"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Create a community</h1>
        <p className="text-sm text-muted-foreground">Bring your tribe together around a goal.</p>
      </header>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-border p-5"
        style={{ background: "var(--gradient-card)" }}
      >
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) setSlug(slugify(e.target.value));
            }}
            placeholder="e.g. 5 AM Club"
            maxLength={60}
            className="mt-1 w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">URL slug</label>
          <div className="mt-1 flex items-center rounded-xl border border-border bg-input">
            <span className="pl-4 text-sm text-muted-foreground">/communities/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="five-am-club"
              maxLength={40}
              className="flex-1 bg-transparent px-2 py-3 text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="What's this community about?"
            className="mt-1 w-full resize-none rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Category</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  category === c
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border p-4">
          <div>
            <div className="text-sm font-medium text-foreground">Private community</div>
            <div className="text-xs text-muted-foreground">Members can only join with the invite code</div>
          </div>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="h-5 w-5 accent-primary"
          />
        </label>

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create community
        </button>
      </form>
    </div>
  );
}
