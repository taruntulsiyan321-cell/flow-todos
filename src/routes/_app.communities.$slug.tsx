import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Users,
  Lock,
  Globe,
  Trophy,
  MessageSquare,
  MessagesSquare,
  Flame,
  Target,
  Heart,
  Send,
  LogOut,
  Copy,
  Check,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { rankFor } from "@/lib/xp";
import { PostComments } from "@/components/PostComments";
import { CommunityChat } from "@/components/CommunityChat";
import { RankTrack } from "@/components/RankTrack";

export const Route = createFileRoute("/_app/communities/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Forge` }] }),
  component: CommunityDetail,
});

type Community = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  is_private: boolean;
  invite_code: string;
  member_count: number;
  banner_url: string | null;
  created_by: string;
};

type Membership = { role: "member" | "moderator" | "admin"; joined_at: string };

type Post = {
  id: string;
  user_id: string;
  body: string;
  title: string | null;
  auto_kind: string | null;
  like_count: number;
  created_at: string;
  display_name: string | null;
  liked_by_me: boolean;
};

type MemberRow = {
  user_id: string;
  role: string;
  display_name: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
};

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  starts_on: string;
  ends_on: string;
  target_xp: number;
  joined: boolean;
};

type Tab = "feed" | "chat" | "leaderboard" | "members" | "challenges" | "rank";

function CommunityDetail() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("feed");
  const [me, setMe] = useState<string | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    void boot();
  }, [slug]);

  async function boot() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);

    const { data: c } = await supabase
      .from("communities")
      .select("id, name, slug, description, category, is_private, member_count, banner_url, created_by")
      .eq("slug", slug)
      .maybeSingle();

    if (!c) {
      toast.error("Community not found or you don't have access");
      navigate({ to: "/communities" });
      return;
    }
    // Fetch invite code separately (RLS-protected to creator/admin only)
    const { data: codeData } = await supabase.rpc("get_community_invite_code", { p_community: (c as { id: string }).id });
    setCommunity({ ...(c as object), invite_code: (codeData as string) ?? "" } as Community);

    const { data: mem } = await supabase
      .from("community_members")
      .select("role, joined_at")
      .eq("community_id", c.id)
      .eq("user_id", user.id)
      .maybeSingle();
    setMembership(mem as Membership | null);

    setLoading(false);
  }

  async function join() {
    if (!community || !me) return;
    setJoining(true);
    try {
      const { error } = await supabase
        .from("community_members")
        .insert({ community_id: community.id, user_id: me });
      if (error) throw error;
      toast.success("Welcome to the crew!");
      await boot();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join");
    } finally {
      setJoining(false);
    }
  }

  async function leave() {
    if (!community || !me) return;
    if (community.created_by === me) {
      toast.error("Creators can't leave their own community.");
      return;
    }
    if (!confirm("Leave this community?")) return;
    const { error } = await supabase
      .from("community_members")
      .delete()
      .eq("community_id", community.id)
      .eq("user_id", me);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Left community");
    navigate({ to: "/communities" });
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-32 animate-pulse rounded-2xl border border-border bg-card/40" />
        <div className="h-24 animate-pulse rounded-2xl border border-border bg-card/40" />
      </div>
    );
  }
  if (!community) return null;

  const isMember = !!membership;
  const isAdmin = membership?.role === "admin" || membership?.role === "moderator";

  return (
    <div className="animate-page-in space-y-5">
      <Link
        to="/communities"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div
        className="overflow-hidden rounded-2xl border border-border"
        style={{ background: "var(--gradient-card)" }}
      >
        <div
          className="h-24"
          style={{ background: "var(--gradient-primary)", opacity: 0.5 }}
        />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-bold text-foreground">{community.name}</h1>
                {community.is_private ? (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Globe className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary capitalize">
                  {community.category}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {community.member_count}
                </span>
              </div>
              {community.description && (
                <p className="mt-3 text-sm text-muted-foreground">{community.description}</p>
              )}
            </div>
            <div className="shrink-0">
              {isMember ? (
                <button
                  onClick={leave}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-3.5 w-3.5" /> Leave
                </button>
              ) : (
                <button
                  onClick={join}
                  disabled={joining || community.is_private}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  {joining && <Loader2 className="h-3 w-3 animate-spin" />}
                  {community.is_private ? "Invite only" : "Join"}
                </button>
              )}
            </div>
          </div>
          {isAdmin && <InviteCodeRow code={community.invite_code} />}
        </div>
      </div>

      {!isMember && community.is_private && (
        <div className="rounded-2xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
          This community is private. Use an invite code to join.
        </div>
      )}

      {isMember && (
        <>
          <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card/60 p-1">
            {(
              [
                ["feed", "Feed", MessageSquare],
                ["chat", "Chat", MessagesSquare],
                ["rank", "Rank", Sparkles],
                ["leaderboard", "Board", Trophy],
                ["members", "Members", Users],
                ["challenges", "Quests", Target],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  tab === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          {tab === "feed" && me && <FeedTab communityId={community.id} me={me} />}
          {tab === "chat" && me && <CommunityChat communityId={community.id} me={me} />}
          {tab === "rank" && me && <RankTab communityId={community.id} me={me} />}
          {tab === "leaderboard" && <LeaderboardTab communityId={community.id} />}
          {tab === "members" && <MembersTab communityId={community.id} createdBy={community.created_by} />}
          {tab === "challenges" && me && (
            <ChallengesTab communityId={community.id} me={me} isAdmin={isAdmin} />
          )}
        </>
      )}
    </div>
  );
}

function InviteCodeRow({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-border bg-background/40 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Invite code</div>
        <div className="truncate font-mono text-sm text-foreground">{code}</div>
      </div>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            toast.success("Invite code copied");
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error("Copy failed");
          }
        }}
        className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function FeedTab({ communityId, me }: { communityId: string; me: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    void load();
  }, [communityId]);

  async function load() {
    setLoading(true);
    const { data: rawPosts } = await supabase
      .from("community_posts")
      .select("id, user_id, body, title, auto_kind, like_count, created_at")
      .eq("community_id", communityId)
      .order("created_at", { ascending: false })
      .limit(50);

    const ps = (rawPosts ?? []) as Omit<Post, "display_name" | "liked_by_me">[];

    const ids = Array.from(new Set(ps.map((p) => p.user_id)));
    const [profilesRes, likesRes] = await Promise.all([
      ids.length
        ? supabase.from("profiles").select("id, display_name").in("id", ids)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
      ps.length
        ? supabase
            .from("community_post_likes")
            .select("post_id")
            .eq("user_id", me)
            .in("post_id", ps.map((p) => p.id))
        : Promise.resolve({ data: [] as { post_id: string }[] }),
    ]);

    const nameMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.display_name]));
    const likedSet = new Set((likesRes.data ?? []).map((l) => l.post_id));

    setPosts(
      ps.map((p) => ({
        ...p,
        display_name: nameMap.get(p.user_id) ?? "Member",
        liked_by_me: likedSet.has(p.id),
      })),
    );
    setLoading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    if (text.length > 2000) {
      toast.error("Posts must be under 2000 characters");
      return;
    }
    setPosting(true);
    try {
      const { error } = await supabase.from("community_posts").insert({
        community_id: communityId,
        user_id: me,
        body: text,
      });
      if (error) throw error;
      setBody("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post");
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(p: Post) {
    // optimistic
    setPosts((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? { ...x, liked_by_me: !x.liked_by_me, like_count: x.like_count + (x.liked_by_me ? -1 : 1) }
          : x,
      ),
    );
    if (p.liked_by_me) {
      const { error } = await supabase
        .from("community_post_likes")
        .delete()
        .eq("post_id", p.id)
        .eq("user_id", me);
      if (error) void load();
    } else {
      const { error } = await supabase
        .from("community_post_likes")
        .insert({ post_id: p.id, user_id: me });
      if (error) void load();
    }
  }

  async function deletePost(id: string) {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("community_posts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-border p-3"
        style={{ background: "var(--gradient-card)" }}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Share an update with the crew…"
          className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{body.length}/2000</span>
          <button
            type="submit"
            disabled={posting || !body.trim()}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {posting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Post
          </button>
        </div>
      </form>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card/40" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Be the first to share something.
        </div>
      ) : (
        posts.map((p) => (
          <article
            key={p.id}
            className="rounded-2xl border border-border p-4"
            style={{ background: "var(--gradient-card)" }}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-foreground">{p.display_name}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(p.created_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{p.body}</p>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => toggleLike(p)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
                  p.liked_by_me
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Heart className={`h-3.5 w-3.5 ${p.liked_by_me ? "fill-current" : ""}`} />
                {p.like_count}
              </button>
              {p.user_id === me && (
                <button
                  onClick={() => deletePost(p.id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Delete
                </button>
              )}
            </div>
            <PostComments postId={p.id} communityId={communityId} me={me} />
          </article>
        ))
      )}
    </div>
  );
}

type Period = "week" | "month" | "all";

function LeaderboardTab({ communityId }: { communityId: string }) {
  const [period, setPeriod] = useState<Period>("week");
  const [metric, setMetric] = useState<"xp" | "streak">("xp");
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [periodXp, setPeriodXp] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, [communityId, period]);

  async function load() {
    setLoading(true);
    const { data: members } = await supabase
      .from("community_member_stats")
      .select("user_id, role, display_name, avatar_url, xp, level, current_streak, longest_streak")
      .eq("community_id", communityId);

    const memberRows = (members ?? []) as MemberRow[];
    setRows(memberRows);

    if (period !== "all" && memberRows.length > 0) {
      const since = new Date();
      if (period === "week") since.setDate(since.getDate() - 7);
      else since.setDate(since.getDate() - 30);
      const { data: ledger } = await supabase
        .from("xp_ledger")
        .select("user_id, amount")
        .gte("occurred_on", since.toISOString().slice(0, 10))
        .in("user_id", memberRows.map((m) => m.user_id));

      const totals: Record<string, number> = {};
      (ledger ?? []).forEach((l: { user_id: string; amount: number }) => {
        totals[l.user_id] = (totals[l.user_id] ?? 0) + l.amount;
      });
      setPeriodXp(totals);
    } else {
      setPeriodXp({});
    }
    setLoading(false);
  }

  const sorted = useMemo(() => {
    const arr = [...rows];
    if (metric === "streak") {
      arr.sort((a, b) => b.current_streak - a.current_streak || b.longest_streak - a.longest_streak);
    } else if (period === "all") {
      arr.sort((a, b) => b.xp - a.xp);
    } else {
      arr.sort((a, b) => (periodXp[b.user_id] ?? 0) - (periodXp[a.user_id] ?? 0));
    }
    return arr;
  }, [rows, metric, period, periodXp]);

  const medalFor = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-card/60 p-0.5">
          {(["xp", "streak"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                metric === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "xp" ? "XP" : "Streak"}
            </button>
          ))}
        </div>
        {metric === "xp" && (
          <div className="flex rounded-lg border border-border bg-card/60 p-0.5">
            {(["week", "month", "all"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {p === "all" ? "All time" : p}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card/40" />
      ) : (
        <ol
          className="divide-y divide-border overflow-hidden rounded-2xl border border-border"
          style={{ background: "var(--gradient-card)" }}
        >
          {sorted.map((m, i) => {
            const value =
              metric === "streak"
                ? m.current_streak
                : period === "all"
                  ? m.xp
                  : periodXp[m.user_id] ?? 0;
            const label = metric === "streak" ? `${value}-day` : `${value} XP`;
            return (
              <li key={m.user_id} className="flex items-center gap-3 p-3">
                <span className="w-6 text-center text-sm font-semibold text-muted-foreground">
                  {medalFor(i) || i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {m.display_name ?? "Member"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Lv {m.level} · {rankFor(m.level)}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                  {metric === "streak" && <Flame className="h-3.5 w-3.5" />}
                  {label}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function MembersTab({ communityId, createdBy }: { communityId: string; createdBy: string }) {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("community_member_stats")
        .select("user_id, role, display_name, avatar_url, xp, level, current_streak, longest_streak")
        .eq("community_id", communityId)
        .order("joined_at", { ascending: true });
      setRows((data ?? []) as MemberRow[]);
      setLoading(false);
    })();
  }, [communityId]);

  if (loading) return <div className="h-40 animate-pulse rounded-2xl border border-border bg-card/40" />;

  return (
    <ul
      className="divide-y divide-border overflow-hidden rounded-2xl border border-border"
      style={{ background: "var(--gradient-card)" }}
    >
      {rows.map((m) => (
        <li key={m.user_id} className="flex items-center gap-3 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
            {(m.display_name ?? "M").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
              {m.display_name ?? "Member"}
              {m.user_id === createdBy && (
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                  Founder
                </span>
              )}
              {m.role !== "member" && m.user_id !== createdBy && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.role}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Lv {m.level} · {rankFor(m.level)} · 🔥 {m.current_streak}
            </div>
          </div>
          <div className="text-xs font-semibold text-primary">{m.xp} XP</div>
        </li>
      ))}
    </ul>
  );
}

function ChallengesTab({
  communityId,
  me,
  isAdmin,
}: {
  communityId: string;
  me: string;
  isAdmin: boolean;
}) {
  const [list, setList] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState(7);
  const [targetXp, setTargetXp] = useState(100);

  useEffect(() => {
    void load();
  }, [communityId]);

  async function load() {
    setLoading(true);
    const { data: cs } = await supabase
      .from("community_challenges")
      .select("id, title, description, starts_on, ends_on, target_xp")
      .eq("community_id", communityId)
      .order("ends_on", { ascending: false });

    const cList = (cs ?? []) as Omit<Challenge, "joined">[];
    let joinedIds = new Set<string>();
    if (cList.length) {
      const { data: parts } = await supabase
        .from("community_challenge_participants")
        .select("challenge_id")
        .eq("user_id", me)
        .in("challenge_id", cList.map((c) => c.id));
      joinedIds = new Set((parts ?? []).map((p) => p.challenge_id));
    }
    setList(cList.map((c) => ({ ...c, joined: joinedIds.has(c.id) })));
    setLoading(false);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || days < 1 || targetXp < 10) return;
    setCreating(true);
    try {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + days);
      const { error } = await supabase.from("community_challenges").insert({
        community_id: communityId,
        created_by: me,
        title: title.trim(),
        description: description.trim() || null,
        starts_on: start.toISOString().slice(0, 10),
        ends_on: end.toISOString().slice(0, 10),
        target_xp: targetXp,
      });
      if (error) throw error;
      setTitle("");
      setDescription("");
      setShowForm(false);
      await load();
      toast.success("Challenge launched!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create");
    } finally {
      setCreating(false);
    }
  }

  async function toggleJoin(c: Challenge) {
    if (c.joined) {
      const { error } = await supabase
        .from("community_challenge_participants")
        .delete()
        .eq("challenge_id", c.id)
        .eq("user_id", me);
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("community_challenge_participants")
        .insert({ challenge_id: c.id, user_id: me });
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    await load();
  }

  return (
    <div className="space-y-3">
      {isAdmin && (
        <>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-primary/50 py-3 text-sm font-medium text-primary"
            >
              <Plus className="h-4 w-4" /> New challenge
            </button>
          ) : (
            <form
              onSubmit={create}
              className="space-y-3 rounded-2xl border border-border p-4"
              style={{ background: "var(--gradient-card)" }}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 7-day workout streak"
                maxLength={80}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the challenge"
                maxLength={600}
                rows={2}
                className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  Days
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={days}
                    onChange={(e) => setDays(Math.max(1, Math.min(90, +e.target.value)))}
                    className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Target XP
                  <input
                    type="number"
                    min={10}
                    max={100000}
                    value={targetXp}
                    onChange={(e) => setTargetXp(Math.max(10, +e.target.value))}
                    className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {creating && <Loader2 className="h-3 w-3 animate-spin" />} Launch
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card/40" />
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No challenges yet.
        </div>
      ) : (
        list.map((c) => {
          const today = new Date().toISOString().slice(0, 10);
          const active = c.starts_on <= today && c.ends_on >= today;
          const ended = c.ends_on < today;
          return (
            <div
              key={c.id}
              className="rounded-2xl border border-border p-4"
              style={{ background: "var(--gradient-card)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">{c.title}</h3>
                  {c.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" /> {c.target_xp} XP
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(c.starts_on).toLocaleDateString()} →{" "}
                      {new Date(c.ends_on).toLocaleDateString()}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        ended
                          ? "bg-muted text-muted-foreground"
                          : active
                            ? "bg-primary/15 text-primary"
                            : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {ended ? "Ended" : active ? "Active" : "Upcoming"}
                    </span>
                  </div>
                </div>
                {!ended && (
                  <button
                    onClick={() => toggleJoin(c)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      c.joined
                        ? "border border-border text-muted-foreground"
                        : "text-primary-foreground"
                    }`}
                    style={c.joined ? undefined : { background: "var(--gradient-primary)" }}
                  >
                    {c.joined ? "Joined" : "Join"}
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function RankTab({ communityId, me }: { communityId: string; me: string }) {
  const [loading, setLoading] = useState(true);
  const [myXp, setMyXp] = useState(0);
  const [weeklyXp, setWeeklyXp] = useState(0);
  const [position, setPosition] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [topMembers, setTopMembers] = useState<MemberRow[]>([]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, me]);

  async function load() {
    setLoading(true);
    const { data: members } = await supabase
      .from("community_member_stats")
      .select("user_id, role, display_name, avatar_url, xp, level, current_streak, longest_streak")
      .eq("community_id", communityId);
    const rows = ((members ?? []) as MemberRow[]).sort((a, b) => b.xp - a.xp);
    setTotal(rows.length);
    const idx = rows.findIndex((r) => r.user_id === me);
    setPosition(idx >= 0 ? idx + 1 : null);
    setTopMembers(rows.slice(0, 5));
    const mine = rows.find((r) => r.user_id === me);
    setMyXp(mine?.xp ?? 0);

    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { data: ledger } = await supabase
      .from("xp_ledger")
      .select("amount")
      .eq("user_id", me)
      .gte("occurred_on", since.toISOString().slice(0, 10));
    setWeeklyXp((ledger ?? []).reduce((s, l: { amount: number }) => s + l.amount, 0));
    setLoading(false);
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-2xl border border-border bg-card/40" />;
  }

  return (
    <div className="space-y-4">
      <RankTrack xp={myXp} weeklyXp={weeklyXp} rankInCrew={position} totalMembers={total} />

      <div
        className="rounded-2xl border border-border p-4"
        style={{ background: "var(--gradient-card)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Top of the crew
          </h3>
          <Trophy className="h-4 w-4 text-primary" />
        </div>
        <ol className="space-y-2">
          {topMembers.map((m, i) => {
            const isMe = m.user_id === me;
            return (
              <li
                key={m.user_id}
                className={`flex items-center gap-3 rounded-xl border p-2.5 transition-all ${
                  isMe ? "border-primary/50" : "border-border bg-background/40"
                }`}
                style={
                  isMe
                    ? {
                        background: "color-mix(in oklab, var(--primary) 12%, transparent)",
                        boxShadow: "0 0 16px color-mix(in oklab, var(--primary) 25%, transparent)",
                      }
                    : undefined
                }
              >
                <span className="w-6 text-center text-sm font-bold text-primary">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {m.display_name ?? "Member"} {isMe && <span className="text-xs text-primary">(you)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Lv {m.level} · {rankFor(m.level)}
                  </div>
                </div>
                <div className="text-sm font-semibold text-primary">{m.xp} XP</div>
              </li>
            );
          })}
        </ol>
      </div>

      <Link
        to="/partners"
        className="flex items-center justify-between rounded-2xl border border-border p-4 transition-all hover:border-primary/50"
        style={{ background: "var(--gradient-card)" }}
      >
        <div>
          <div className="text-sm font-semibold text-foreground">Find an accountability partner</div>
          <div className="text-xs text-muted-foreground">Pair up to climb faster.</div>
        </div>
        <Sparkles className="h-5 w-5 text-primary" />
      </Link>
    </div>
  );
}
