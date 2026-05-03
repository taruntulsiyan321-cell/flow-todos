import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Trophy, Users, Lock, Globe, Calendar, Flame, Plus, Copy, Check,
  LogOut, Trash2, Loader2, Crown, Target,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/challenges/$id")({
  head: ({ params }) => ({ meta: [{ title: `Challenge — Forge` }] }),
  component: ChallengeDetail,
});

type Challenge = {
  id: string;
  created_by: string;
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
};

type LeaderRow = {
  user_id: string;
  display_name: string;
  total_progress: number;
  current_streak: number;
  longest_streak: number;
  last_log_date: string | null;
};

type Log = { id: string; log_date: string; amount: number; note: string | null };

function ChallengeDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [c, setC] = useState<Challenge | null>(null);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [myLogs, setMyLogs] = useState<Log[]>([]);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(1);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate({ to: "/auth", search: { mode: "signin" } }); return; }
    setMe(user.id);
    const COLS = "id,created_by,name,description,start_date,end_date,cadence,goal_per_period,goal_unit,is_public,max_participants,participant_count";
    const { data: ch, error } = await supabase.from("challenges").select(COLS).eq("id", id).maybeSingle();
    if (error || !ch) { toast.error("Challenge not found or private"); navigate({ to: "/challenges" }); return; }
    setC(ch as unknown as Challenge);
    setAmount((ch as unknown as Challenge).goal_per_period);
    if ((ch as { created_by: string }).created_by === user.id) {
      const { data: code } = await supabase.rpc("get_challenge_invite_code", { p_challenge: id });
      setInviteCode((code as string) ?? null);
    } else {
      setInviteCode(null);
    }

    const [{ data: lb }, { data: mine }, { data: part }] = await Promise.all([
      supabase.rpc("challenge_leaderboard", { p_challenge: id }),
      supabase.from("challenge_progress_logs").select("id, log_date, amount, note")
        .eq("challenge_id", id).eq("user_id", user.id).order("log_date", { ascending: false }).limit(30),
      supabase.from("challenge_participants").select("user_id").eq("challenge_id", id).eq("user_id", user.id).maybeSingle(),
    ]);
    setBoard((lb ?? []) as LeaderRow[]);
    setMyLogs((mine ?? []) as Log[]);
    setJoined(!!part);
    setLoading(false);
  }

  async function join() {
    setBusy(true);
    const { error } = await supabase.from("challenge_participants").insert({ challenge_id: id, user_id: me! });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Joined!");
    void load();
  }

  async function leave() {
    if (!confirm("Leave this challenge? Your progress logs will remain.")) return;
    setBusy(true);
    const { error } = await supabase.from("challenge_participants").delete().eq("challenge_id", id).eq("user_id", me!);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Left challenge");
    void load();
  }

  async function logProgress() {
    if (amount < 1) return;
    setBusy(true);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("challenge_progress_logs").upsert(
      { challenge_id: id, user_id: me!, log_date: today, amount, note: note.trim() || null },
      { onConflict: "challenge_id,user_id,log_date" },
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Progress logged! 🔥");
    setNote("");
    void load();
  }

  async function deleteLog(logId: string) {
    const { error } = await supabase.from("challenge_progress_logs").delete().eq("id", logId);
    if (error) return toast.error(error.message);
    void load();
  }

  async function deleteChallenge() {
    if (!confirm("Delete this challenge for everyone? This cannot be undone.")) return;
    const { error } = await supabase.from("challenges").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Challenge deleted");
    navigate({ to: "/challenges" });
  }

  function copyCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    toast.success("Invite code copied");
    setTimeout(() => setCopied(false), 1800);
  }

  if (loading || !c) {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    );
  }

  const isCreator = me === c.created_by;
  const daysLeft = Math.max(0, Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000));
  const myRow = board.find((r) => r.user_id === me);
  const myRank = myRow ? board.findIndex((r) => r.user_id === me) + 1 : null;

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      <div className="flex items-center justify-between">
        <Link to="/challenges" className="inline-flex items-center gap-1 rounded-lg p-2 text-sm hover:bg-card/60">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        {isCreator && (
          <button onClick={deleteChallenge} className="rounded-lg p-2 text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Header */}
      <div className="rounded-2xl border border-border p-5 animate-fade-in" style={{ background: "var(--gradient-card)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs">
              {c.is_public
                ? <span className="inline-flex items-center gap-1 text-primary"><Globe className="h-3 w-3" />Public</span>
                : <span className="inline-flex items-center gap-1 text-amber-400"><Lock className="h-3 w-3" />Private</span>}
              {isCreator && <span className="inline-flex items-center gap-1 text-primary"><Crown className="h-3 w-3" />Creator</span>}
            </div>
            <h1 className="mt-1 text-xl font-bold">{c.name}</h1>
            {c.description && <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>}
          </div>
          <Trophy className="h-8 w-8 shrink-0 text-primary" style={{ filter: "drop-shadow(0 0 12px color-mix(in oklab, var(--primary) 60%, transparent))" }} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <Stat icon={<Users className="h-3.5 w-3.5" />} label="Members" value={`${c.participant_count}${c.max_participants ? `/${c.max_participants}` : ""}`} />
          <Stat icon={<Calendar className="h-3.5 w-3.5" />} label="Days left" value={String(daysLeft)} />
          <Stat icon={<Target className="h-3.5 w-3.5" />} label="Goal" value={`${c.goal_per_period}/${c.cadence === "daily" ? "d" : "w"}`} />
        </div>

        {/* Invite (creator only) */}
        {isCreator && inviteCode && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
            <div className="text-xs">
              <div className="text-muted-foreground">Invite code (share to invite)</div>
              <div className="font-mono text-base tracking-widest text-primary">{inviteCode}</div>
            </div>
            <button onClick={copyCode} className="rounded-md p-2 hover:bg-card/60 active:scale-95 transition">
              {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        )}

        {/* Action */}
        <div className="mt-4">
          {!joined ? (
            <button onClick={join} disabled={busy}
              className="w-full rounded-xl py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
              {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Join Challenge"}
            </button>
          ) : (
            <button onClick={leave} disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" /> Leave
            </button>
          )}
        </div>
      </div>

      {/* Log progress */}
      {joined && (
        <div className="rounded-2xl border border-border p-4 animate-fade-in" style={{ background: "var(--gradient-card)" }}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Log today's progress</h2>
          <div className="flex items-center gap-2">
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(parseInt(e.target.value) || 1)}
              className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <span className="text-sm text-muted-foreground">{c.goal_unit}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Note (optional)"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <button onClick={logProgress} disabled={busy}
              className="rounded-lg p-2 text-primary-foreground transition-transform active:scale-95 disabled:opacity-50"
              style={{ background: "var(--gradient-primary)" }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>

          {myRow && (
            <div className="mt-3 flex items-center justify-around rounded-lg bg-background/40 px-3 py-2 text-xs">
              <span><span className="text-muted-foreground">Total</span> <span className="font-semibold text-primary">{myRow.total_progress}</span></span>
              <span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-amber-400" /> {myRow.current_streak}d</span>
              <span><span className="text-muted-foreground">Best</span> {myRow.longest_streak}d</span>
              {myRank && <span className="text-primary">#{myRank}</span>}
            </div>
          )}

          {myLogs.length > 0 && (
            <div className="mt-3 max-h-40 space-y-1 overflow-auto">
              {myLogs.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-background/40">
                  <span><span className="font-mono text-muted-foreground">{l.log_date}</span> · <span className="font-semibold text-primary">+{l.amount}</span> {l.note && <span className="text-muted-foreground">— {l.note}</span>}</span>
                  <button onClick={() => deleteLog(l.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      <div className="rounded-2xl border border-border p-4 animate-fade-in" style={{ background: "var(--gradient-card)" }}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Trophy className="h-4 w-4 text-primary" /> Leaderboard
        </h2>
        {board.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No participants yet.</div>
        ) : (
          <ol className="space-y-1.5">
            {board.map((r, i) => {
              const isMe = r.user_id === me;
              return (
                <li key={r.user_id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                    isMe ? "border border-primary/40" : "hover:bg-background/40"
                  }`}
                  style={isMe ? { background: "color-mix(in oklab, var(--primary) 10%, transparent)" } : {}}>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    i === 0 ? "text-primary-foreground" : i < 3 ? "text-primary" : "text-muted-foreground"
                  }`}
                    style={i === 0 ? { background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" } : i < 3 ? { background: "color-mix(in oklab, var(--primary) 14%, transparent)" } : { background: "color-mix(in oklab, var(--muted) 60%, transparent)" }}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.display_name}{isMe && <span className="ml-1 text-xs text-primary">(you)</span>}</div>
                    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-0.5"><Flame className="h-3 w-3 text-amber-400" />{r.current_streak}d</span>
                      <span>best {r.longest_streak}d</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-primary">{r.total_progress}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">{c.goal_unit}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/40 px-2 py-2 text-center">
      <div className="inline-flex items-center gap-1 text-muted-foreground">{icon}<span>{label}</span></div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
