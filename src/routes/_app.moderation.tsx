import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, ShieldAlert, Trash2, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadBlockedWords } from "@/lib/moderation";

export const Route = createFileRoute("/_app/moderation")({
  head: () => ({ meta: [{ title: "Moderation — Forge" }] }),
  component: ModerationPage,
});

type Word = { id: string; pattern: string; severity: "low" | "medium" | "high" };
type LogRow = {
  id: string;
  user_id: string;
  community_id: string | null;
  surface: string;
  original_text: string;
  cleaned_text: string | null;
  severity: string;
  matched_terms: string[];
  created_at: string;
};
type Offender = {
  user_id: string;
  display_name: string;
  blocked_count: number;
  censored_count: number;
  last_at: string;
};

function ModerationPage() {
  const [me, setMe] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"words" | "log" | "offenders">("words");

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      setMe(user.id);
      const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
      setIsAdmin(!!data);
    })();
  }, []);

  if (isAdmin === null) {
    return <div className="h-32 animate-pulse rounded-2xl border border-border bg-card/40" />;
  }
  if (!isAdmin) {
    return (
      <div className="animate-page-in space-y-4">
        <div className="rounded-2xl border border-border bg-card/60 p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-2 text-lg font-bold text-foreground">Moderation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This area is for platform moderators only.
          </p>
          {me && (
            <p className="mt-3 break-all text-[11px] text-muted-foreground">
              To grant access, add your user id to the platform admins table:
              <br />
              <code className="font-mono">{me}</code>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-in space-y-4">
      <h1 className="text-xl font-bold text-foreground">Moderation</h1>
      <div className="flex items-center gap-1 rounded-xl border border-border bg-card/60 p-1">
        {(["words", "log", "offenders"] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {id === "log" ? "Flagged" : id}
          </button>
        ))}
      </div>
      {tab === "words" && <WordsTab />}
      {tab === "log" && <LogTab />}
      {tab === "offenders" && <OffendersTab />}
    </div>
  );
}

function WordsTab() {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [pattern, setPattern] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("moderation_blocked_words")
      .select("id, pattern, severity")
      .order("pattern");
    setWords((data ?? []) as Word[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const p = pattern.trim().toLowerCase().replace(/[^a-z]/g, "");
    if (!p) return;
    const { error } = await supabase.from("moderation_blocked_words").insert({ pattern: p, severity });
    if (error) { toast.error(error.message); return; }
    setPattern("");
    await load();
    await loadBlockedWords(true);
    toast.success("Added");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("moderation_blocked_words").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setWords((w) => w.filter((x) => x.id !== id));
    await loadBlockedWords(true);
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={add}
        className="flex items-center gap-2 rounded-2xl border border-border p-3"
        style={{ background: "var(--gradient-card)" }}
      >
        <input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="word (letters only)"
          maxLength={40}
          className="flex-1 rounded-lg border border-border bg-input px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as "low" | "medium" | "high")}
          className="rounded-lg border border-border bg-input px-2 py-1.5 text-sm"
        >
          <option value="low">Low (censor)</option>
          <option value="medium">Medium (censor)</option>
          <option value="high">High (block)</option>
        </select>
        <button
          type="submit"
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </form>
      {loading ? (
        <div className="h-24 animate-pulse rounded-2xl border border-border bg-card/40" />
      ) : (
        <ul className="space-y-1.5">
          {words.map((w) => (
            <li
              key={w.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-foreground">{w.pattern}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                    w.severity === "high"
                      ? "bg-destructive/20 text-destructive"
                      : w.severity === "medium"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {w.severity}
                </span>
              </div>
              <button
                onClick={() => remove(w.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LogTab() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("moderation_log")
        .select("id, user_id, community_id, surface, original_text, cleaned_text, severity, matched_terms, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      setRows((data ?? []) as LogRow[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="h-24 animate-pulse rounded-2xl border border-border bg-card/40" />;
  if (!rows.length)
    return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No flagged messages.</div>;

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-2xl border border-border bg-card/60 p-3 text-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              <span
                className={`mr-2 rounded-full px-2 py-0.5 text-[10px] uppercase ${
                  r.severity === "blocked"
                    ? "bg-destructive/20 text-destructive"
                    : "bg-primary/15 text-primary"
                }`}
              >
                {r.severity}
              </span>
              {r.surface}
            </span>
            <span>{new Date(r.created_at).toLocaleString()}</span>
          </div>
          <p className="mt-1 break-words text-foreground">{r.original_text}</p>
          {r.matched_terms?.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              terms: {r.matched_terms.join(", ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function OffendersTab() {
  const [rows, setRows] = useState<Offender[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("moderation_repeat_offenders", { p_days: 30 });
      setRows((data ?? []) as Offender[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="h-24 animate-pulse rounded-2xl border border-border bg-card/40" />;
  if (!rows.length)
    return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No repeat offenders 🎉</div>;

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.user_id}
          className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-3"
        >
          <div>
            <div className="text-sm font-medium text-foreground">{r.display_name}</div>
            <div className="text-xs text-muted-foreground">
              {r.blocked_count} blocked · {r.censored_count} censored · last{" "}
              {new Date(r.last_at).toLocaleDateString()}
            </div>
          </div>
          <UserX className="h-4 w-4 text-muted-foreground" />
        </li>
      ))}
    </ul>
  );
}

