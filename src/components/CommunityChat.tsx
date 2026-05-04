import { useEffect, useRef, useState } from "react";
import { Loader2, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { censorForDisplay, loadBlockedWords, scan } from "@/lib/moderation";

type Msg = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  display_name: string | null;
};

export function CommunityChat({ communityId, me }: { communityId: string; me: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nameCache = useRef<Map<string, string | null>>(new Map());

  async function resolveName(id: string): Promise<string | null> {
    if (nameCache.current.has(id)) return nameCache.current.get(id) ?? null;
    const { data } = await supabase.from("profiles").select("display_name").eq("id", id).maybeSingle();
    const name = data?.display_name ?? null;
    nameCache.current.set(id, name);
    return name;
  }

  useEffect(() => {
    let mounted = true;
    void loadBlockedWords();
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("community_messages")
        .select("id, user_id, body, created_at")
        .eq("community_id", communityId)
        .order("created_at", { ascending: true })
        .limit(200);
      const list = (data ?? []) as Omit<Msg, "display_name">[];
      const ids = Array.from(new Set(list.map((m) => m.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", ids);
        (profs ?? []).forEach((p) => nameCache.current.set(p.id, p.display_name));
      }
      if (!mounted) return;
      setMessages(list.map((m) => ({ ...m, display_name: nameCache.current.get(m.user_id) ?? "Member" })));
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 1e9 }));
    })();

    const channel = supabase
      .channel(`chat:${communityId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_messages",
          filter: `community_id=eq.${communityId}`,
        },
        async (payload) => {
          const m = payload.new as Omit<Msg, "display_name">;
          const name = await resolveName(m.user_id);
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, { ...m, display_name: name ?? "Member" }],
          );
          requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }));
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [communityId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    if (text.length > 2000) {
      toast.error("Message too long");
      return;
    }

    // Client-side moderation pass — fast feedback before round-trip
    const result = await scan(text);
    if (result.severity === "blocked") {
      toast.error("Your message contains inappropriate language and cannot be posted.", {
        icon: <ShieldAlert className="h-4 w-4" />,
      });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from("community_messages")
        .insert({ community_id: communityId, user_id: me, body: text });
      if (error) {
        // Server-side trigger may still block (kept up to date in DB).
        if (/inappropriate|muted/i.test(error.message)) {
          toast.error(error.message);
        } else {
          throw error;
        }
        return;
      }
      if (result.severity === "censored") {
        toast.message("Some words were censored.");
      }
      setBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="flex h-[60vh] flex-col overflow-hidden rounded-2xl border border-border"
      style={{ background: "var(--gradient-card)" }}
    >
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-card/40" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Say hi to start the conversation 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === me;
            const safeBody = censorForDisplay(m.body);
            return (
              <div
                key={m.id}
                className={`flex animate-fade-in ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border border-border bg-background/60 text-foreground"
                  }`}
                >
                  {!mine && (
                    <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {m.display_name}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words">{safeBody}</p>
                  <div
                    className={`mt-0.5 text-right text-[10px] ${
                      mine ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(m.created_at).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border bg-background/40 p-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message the crew…"
          maxLength={2000}
          className="flex-1 rounded-full border border-border bg-input px-4 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="flex items-center justify-center rounded-full p-2.5 text-primary-foreground transition-transform active:scale-95 disabled:opacity-50"
          style={{ background: "var(--gradient-primary)" }}
          aria-label="Send"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
