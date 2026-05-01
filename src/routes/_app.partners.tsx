import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Flame, Loader2, Search, Trophy, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { rankFor } from "@/lib/xp";

export const Route = createFileRoute("/_app/partners")({
  head: () => ({ meta: [{ title: "Partners — Forge" }] }),
  component: PartnersPage,
});

type Profile = {
  id: string;
  display_name: string | null;
  xp: number;
  level: number;
  current_streak: number;
};

type Invite = {
  id: string;
  from_user: string;
  to_user: string;
  message: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
  other: Profile | null;
};

type Partner = {
  id: string;
  partner: Profile;
  created_at: string;
};

function PartnersPage() {
  const [me, setMe] = useState<string | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [incoming, setIncoming] = useState<Invite[]>([]);
  const [outgoing, setOutgoing] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    void boot();
  }, []);

  async function boot() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);
    await refresh(user.id);
    setLoading(false);
  }

  async function refresh(userId: string) {
    const [partsRes, invRes] = await Promise.all([
      supabase
        .from("partnerships")
        .select("id, user_a, user_b, created_at")
        .or(`user_a.eq.${userId},user_b.eq.${userId}`),
      supabase
        .from("partner_invites")
        .select("id, from_user, to_user, message, status, created_at")
        .or(`from_user.eq.${userId},to_user.eq.${userId}`)
        .order("created_at", { ascending: false }),
    ]);

    const partRows = (partsRes.data ?? []) as { id: string; user_a: string; user_b: string; created_at: string }[];
    const invRows = (invRes.data ?? []) as Omit<Invite, "other">[];

    const otherIds = new Set<string>();
    partRows.forEach((p) => otherIds.add(p.user_a === userId ? p.user_b : p.user_a));
    invRows.forEach((i) => otherIds.add(i.from_user === userId ? i.to_user : i.from_user));

    const idArr = Array.from(otherIds);
    const profileMap = new Map<string, Profile>();
    if (idArr.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, xp, level, current_streak")
        .in("id", idArr);
      (profs ?? []).forEach((p) => profileMap.set(p.id, p as Profile));
    }

    setPartners(
      partRows.map((p) => {
        const otherId = p.user_a === userId ? p.user_b : p.user_a;
        return {
          id: p.id,
          created_at: p.created_at,
          partner:
            profileMap.get(otherId) ??
            { id: otherId, display_name: "Partner", xp: 0, level: 1, current_streak: 0 },
        };
      }),
    );

    const inc: Invite[] = [];
    const out: Invite[] = [];
    invRows.forEach((i) => {
      const otherId = i.from_user === userId ? i.to_user : i.from_user;
      const enriched: Invite = { ...i, other: profileMap.get(otherId) ?? null };
      if (i.status !== "pending") return;
      if (i.to_user === userId) inc.push(enriched);
      else out.push(enriched);
    });
    setIncoming(inc);
    setOutgoing(out);
  }

  async function runSearch() {
    if (!me) return;
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, xp, level, current_streak")
      .ilike("display_name", `%${q}%`)
      .neq("id", me)
      .limit(10);
    setResults((data ?? []) as Profile[]);
    setSearching(false);
  }

  async function invite(profile: Profile) {
    if (!me) return;
    if (partners.some((p) => p.partner.id === profile.id)) {
      toast.error("Already partners");
      return;
    }
    const { error } = await supabase.from("partner_invites").insert({
      from_user: me,
      to_user: profile.id,
    });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Invite already sent" : error.message);
      return;
    }
    toast.success(`Invite sent to ${profile.display_name ?? "member"}`);
    setSearch("");
    setResults([]);
    if (me) await refresh(me);
  }

  async function accept(inv: Invite) {
    const { error } = await supabase.rpc("accept_partner_invite", { p_invite: inv.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Partnered up! 🤝");
    if (me) await refresh(me);
  }

  async function decline(inv: Invite) {
    const { error } = await supabase
      .from("partner_invites")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", inv.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (me) await refresh(me);
  }

  async function cancel(inv: Invite) {
    const { error } = await supabase.from("partner_invites").delete().eq("id", inv.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (me) await refresh(me);
  }

  async function dissolve(p: Partner) {
    if (!confirm(`End partnership with ${p.partner.display_name ?? "partner"}?`)) return;
    const { error } = await supabase.from("partnerships").delete().eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Partnership ended");
    if (me) await refresh(me);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl border border-border bg-card/40" />
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card/40" />
      </div>
    );
  }

  return (
    <div className="animate-page-in space-y-5">
      <Link
        to="/communities"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Crews
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Accountability Partners</h1>
        <p className="text-sm text-muted-foreground">
          Pair up with someone who keeps you sharp. Compare XP and streaks daily.
        </p>
      </div>

      {/* Search & invite */}
      <div
        className="rounded-2xl border border-border p-4"
        style={{ background: "var(--gradient-card)" }}
      >
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Find a partner
        </label>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-input px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search by display name…"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            onClick={runSearch}
            disabled={searching}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
          </button>
        </div>

        {results.length > 0 && (
          <ul className="mt-3 space-y-2">
            {results.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-2.5 animate-fade-in"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {r.display_name ?? "Member"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Lv {r.level} · {rankFor(r.level)} · 🔥 {r.current_streak}
                  </div>
                </div>
                <button
                  onClick={() => invite(r)}
                  className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Invite
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Incoming invites */}
      {incoming.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pending for you
          </h2>
          <ul className="space-y-2">
            {incoming.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-2xl border border-primary/30 p-3 animate-fade-in"
                style={{ background: "var(--gradient-card)", boxShadow: "0 0 24px color-mix(in oklab, var(--primary) 20%, transparent)" }}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {inv.other?.display_name ?? "A member"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Wants to be your accountability partner
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => decline(inv)}
                    className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive"
                    aria-label="Decline"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => accept(inv)}
                    className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-primary-foreground"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    <Check className="h-3.5 w-3.5" /> Accept
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Outgoing invites */}
      {outgoing.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Sent
          </h2>
          <ul className="space-y-2">
            {outgoing.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-2xl border border-border p-3"
                style={{ background: "var(--gradient-card)" }}
              >
                <div className="text-sm text-muted-foreground">
                  Waiting on{" "}
                  <span className="text-foreground">{inv.other?.display_name ?? "member"}</span>
                </div>
                <button
                  onClick={() => cancel(inv)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Active partners */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Your partners
        </h2>
        {partners.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No partners yet. Invite someone above to start.
          </div>
        ) : (
          <ul className="space-y-2">
            {partners.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-border p-4 animate-fade-in"
                style={{ background: "var(--gradient-card)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-foreground">
                      {p.partner.display_name ?? "Partner"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Lv {p.partner.level} · {rankFor(p.partner.level)}
                    </div>
                  </div>
                  <button
                    onClick={() => dissolve(p)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    End
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border bg-background/40 p-2.5">
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <Trophy className="h-3 w-3" /> Their XP
                    </div>
                    <div className="mt-0.5 text-lg font-bold text-primary">{p.partner.xp}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-2.5">
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <Flame className="h-3 w-3" /> Streak
                    </div>
                    <div className="mt-0.5 text-lg font-bold text-primary">
                      {p.partner.current_streak}d
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
