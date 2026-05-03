import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Users, Lock, Globe, Search, Hash } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/communities/")({
  head: () => ({ meta: [{ title: "Communities — Forge" }] }),
  component: CommunitiesPage,
});

type Community = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  is_private: boolean;
  member_count: number;
  banner_url: string | null;
};

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "fitness", label: "Fitness" },
  { id: "mindfulness", label: "Mindfulness" },
  { id: "study", label: "Study" },
  { id: "productivity", label: "Productivity" },
  { id: "general", label: "General" },
] as const;

function CommunitiesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"discover" | "mine">("discover");
  const [list, setList] = useState<Community[]>([]);
  const [mine, setMine] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: all }, { data: members }] = await Promise.all([
      supabase
        .from("communities")
        .select("id, name, slug, description, category, is_private, member_count, banner_url")
        .order("member_count", { ascending: false })
        .limit(80),
      supabase
        .from("community_members")
        .select("community_id, communities(id, name, slug, description, category, is_private, member_count, banner_url)")
        .eq("user_id", user.id),
    ]);

    setList((all ?? []) as Community[]);
    setMine(((members ?? []).map((m: any) => m.communities).filter(Boolean)) as Community[]);
    setLoading(false);
  }

  async function joinByCode() {
    const code = inviteCode.trim().toLowerCase();
    if (!code) return;
    setJoining(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: c, error: e1 } = await supabase
        .from("communities")
        .select("id, slug")
        .eq("invite_code", code)
        .maybeSingle();
      if (e1) throw e1;
      if (!c) throw new Error("Invalid invite code");

      const { error: e2 } = await supabase
        .from("community_members")
        .insert({ community_id: c.id, user_id: user.id })
        .select()
        .maybeSingle();
      // duplicate is fine — they're already a member
      if (e2 && !String(e2.message).includes("duplicate")) throw e2;

      toast.success("Joined!");
      navigate({ to: "/communities/$slug", params: { slug: c.slug } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join");
    } finally {
      setJoining(false);
    }
  }

  const visible = (tab === "mine" ? mine : list).filter((c) => {
    if (tab === "discover" && c.is_private) return false;
    if (category !== "all" && c.category !== category) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="animate-page-in space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Communities</h1>
          <p className="text-sm text-muted-foreground">Build streaks together.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/challenges"
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            🏆 Challenges
          </Link>
          <Link
            to="/partners"
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Users className="h-4 w-4" /> Partners
          </Link>
          <Link
            to="/communities/new"
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-primary-foreground"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            <Plus className="h-4 w-4" /> New
          </Link>
        </div>
      </header>

      <div
        className="rounded-2xl border border-border p-3"
        style={{ background: "var(--gradient-card)" }}
      >
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Have an invite code? Paste it here"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            maxLength={32}
          />
          <button
            onClick={joinByCode}
            disabled={joining || !inviteCode.trim()}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Join
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 p-1">
        {(["discover", "mine"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "discover" ? "Discover" : `My communities${mine.length ? ` · ${mine.length}` : ""}`}
          </button>
        ))}
      </div>

      {tab === "discover" && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search communities"
              className="w-full rounded-xl border border-border bg-input py-2.5 pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  category === c.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card/40" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {tab === "mine"
            ? "You haven't joined any communities yet."
            : "No communities found. Try a different filter or create one."}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((c) => (
            <Link
              key={c.id}
              to="/communities/$slug"
              params={{ slug: c.slug }}
              className="block rounded-2xl border border-border p-4 transition-all hover:border-primary/50"
              style={{ background: "var(--gradient-card)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-foreground">{c.name}</h3>
                    {c.is_private ? (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  {c.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {c.category}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {c.member_count} {c.member_count === 1 ? "member" : "members"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
