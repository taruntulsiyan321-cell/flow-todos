import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Search, Trophy, Users, Lock, Globe, KeyRound, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/challenges/")({
  head: () => ({ meta: [{ title: "Challenges — Forge" }] }),
  component: ChallengesIndex,
});

type Challenge = {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  cadence: "daily" | "weekly";
  goal_per_period: number;
  goal_unit: string;
  is_public: boolean;
  max_participants: number | null;
  participant_count: number;
  created_by: string;
};

function ChallengesIndex() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [list, setList] = useState<Challenge[]>([]);
  const [mine, setMine] = useState<Challenge[]>([]);
  const [search, setSearch] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signin" } });
      return;
    }
    const COLS = "id,created_by,name,description,start_date,end_date,cadence,goal_per_period,goal_unit,is_public,max_participants,participant_count,created_at,updated_at";
    const [pub, joined, created] = await Promise.all([
      supabase.from("challenges").select(COLS).eq("is_public", true).order("start_date", { ascending: false }).limit(50),
      supabase.from("challenge_participants").select("challenge_id").eq("user_id", user.id),
      supabase.from("challenges").select(COLS).eq("created_by", user.id),
    ]);
    setList((pub.data ?? []) as unknown as Challenge[]);
    const joinedIds = new Set((joined.data ?? []).map((r: { challenge_id: string }) => r.challenge_id));
    let joinedRows: Challenge[] = [];
    if (joinedIds.size) {
      const { data } = await supabase.from("challenges").select(COLS).in("id", Array.from(joinedIds));
      joinedRows = (data ?? []) as unknown as Challenge[];
    }
    const map = new Map<string, Challenge>();
    [...(created.data ?? []) as Challenge[], ...joinedRows].forEach((c) => map.set(c.id, c));
    setMine(Array.from(map.values()).sort((a, b) => b.start_date.localeCompare(a.start_date)));
    setLoading(false);
  }

  async function joinByCode() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) return toast.error("Enter a valid invite code");
    setJoining(true);
    const { data, error } = await supabase.rpc("join_challenge_by_code", { p_code: trimmed });
    setJoining(false);
    if (error) return toast.error(error.message);
    toast.success("Joined challenge!");
    setCode("");
    navigate({ to: "/challenges/$id", params: { id: data as string } });
  }

  const filtered = list.filter((c) =>
    !search ? true : (c.name + " " + (c.description ?? "")).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Challenges</h1>
          <p className="text-sm text-muted-foreground">Compete, build streaks, win together.</p>
        </div>
        <Link
          to="/challenges/new"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-primary-foreground transition-transform active:scale-95"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          <Plus className="h-4 w-4" /> New
        </Link>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card/40 p-1">
        {(["browse", "mine"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-2 text-sm font-medium capitalize transition-all ${
              tab === t ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            style={tab === t ? { background: "var(--gradient-primary)" } : {}}
          >
            {t === "browse" ? "Browse" : "My Challenges"}
          </button>
        ))}
      </div>

      {tab === "browse" && (
        <>
          {/* Join by code */}
          <div className="rounded-2xl border border-border p-3" style={{ background: "var(--gradient-card)" }}>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5" /> Have an invite code?
            </div>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={8}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono tracking-widest focus:border-primary focus:outline-none"
              />
              <button
                onClick={joinByCode}
                disabled={joining}
                className="rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground transition-transform active:scale-95 disabled:opacity-50"
                style={{ background: "var(--gradient-primary)" }}
              >
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search public challenges…"
              className="w-full rounded-xl border border-border bg-card/50 py-2.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {loading ? (
            <SkeletonList />
          ) : filtered.length === 0 ? (
            <Empty msg="No public challenges yet — be the first to create one!" />
          ) : (
            <div className="space-y-3">
              {filtered.map((c) => <ChallengeCard key={c.id} c={c} />)}
            </div>
          )}
        </>
      )}

      {tab === "mine" && (
        loading ? <SkeletonList /> :
        mine.length === 0 ? <Empty msg="You haven't joined or created any challenges yet." /> : (
          <div className="space-y-3">{mine.map((c) => <ChallengeCard key={c.id} c={c} />)}</div>
        )
      )}
    </div>
  );
}

function ChallengeCard({ c }: { c: Challenge }) {
  const days = Math.max(0, Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000));
  return (
    <Link
      to="/challenges/$id"
      params={{ id: c.id }}
      preload="intent"
      className="block rounded-2xl border border-border p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50 active:scale-[0.99]"
      style={{ background: "var(--gradient-card)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {c.is_public ? <Globe className="h-3.5 w-3.5 text-primary" /> : <Lock className="h-3.5 w-3.5 text-amber-400" />}
            <h3 className="truncate font-semibold">{c.name}</h3>
          </div>
          {c.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>}
        </div>
        <Trophy className="h-5 w-5 shrink-0 text-primary" />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c.participant_count}{c.max_participants ? `/${c.max_participants}` : ""}</span>
        <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{days}d left</span>
        <span className="capitalize">{c.cadence} · {c.goal_per_period} {c.goal_unit}</span>
      </div>
    </Link>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-24 rounded-2xl" />
      ))}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {msg}
    </div>
  );
}
