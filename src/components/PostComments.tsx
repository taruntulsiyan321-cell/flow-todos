import { useEffect, useState } from "react";
import { Heart, Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { triggerFeedback } from "@/lib/feedback";

type Comment = {
  id: string;
  user_id: string;
  body: string;
  like_count: number;
  created_at: string;
  display_name: string | null;
  liked_by_me: boolean;
};

export function PostComments({
  postId,
  communityId,
  me,
}: {
  postId: string;
  communityId: string;
  me: string;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  // Lightweight count fetch
  useEffect(() => {
    void (async () => {
      const { count: c } = await supabase
        .from("community_post_comments")
        .select("*", { count: "exact", head: true })
        .eq("post_id", postId);
      setCount(c ?? 0);
    })();
  }, [postId]);

  useEffect(() => {
    if (!open) return;
    void load();
    const channel = supabase
      .channel(`comments:${postId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_post_comments", filter: `post_id=eq.${postId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, postId]);

  async function load() {
    setLoading(true);
    const { data: raw } = await supabase
      .from("community_post_comments")
      .select("id, user_id, body, like_count, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(200);
    const list = (raw ?? []) as Omit<Comment, "display_name" | "liked_by_me">[];
    const ids = Array.from(new Set(list.map((c) => c.user_id)));
    const [profilesRes, likesRes] = await Promise.all([
      ids.length
        ? supabase.from("profiles").select("id, display_name").in("id", ids)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
      list.length
        ? supabase
            .from("community_post_comment_likes")
            .select("comment_id")
            .eq("user_id", me)
            .in("comment_id", list.map((c) => c.id))
        : Promise.resolve({ data: [] as { comment_id: string }[] }),
    ]);
    const nameMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.display_name]));
    const liked = new Set((likesRes.data ?? []).map((l) => l.comment_id));
    setComments(
      list.map((c) => ({
        ...c,
        display_name: nameMap.get(c.user_id) ?? "Member",
        liked_by_me: liked.has(c.id),
      })),
    );
    setCount(list.length);
    setLoading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || text.length > 1000) return;
    setPosting(true);
    try {
      const { error } = await supabase.from("community_post_comments").insert({
        post_id: postId,
        community_id: communityId,
        user_id: me,
        body: text,
      });
      if (error) throw error;
      setBody("");
      triggerFeedback("light");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't comment");
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(c: Comment) {
    setComments((prev) =>
      prev.map((x) =>
        x.id === c.id
          ? { ...x, liked_by_me: !x.liked_by_me, like_count: x.like_count + (x.liked_by_me ? -1 : 1) }
          : x,
      ),
    );
    triggerFeedback("light");
    if (c.liked_by_me) {
      await supabase
        .from("community_post_comment_likes")
        .delete()
        .eq("comment_id", c.id)
        .eq("user_id", me);
    } else {
      await supabase
        .from("community_post_comment_likes")
        .insert({ comment_id: c.id, user_id: me });
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this comment?")) return;
    const { error } = await supabase.from("community_post_comments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== id));
    setCount((n) => Math.max(0, (n ?? 1) - 1));
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {count ?? 0} {count === 1 ? "comment" : "comments"}
      </button>

      {open && (
        <div className="mt-3 animate-fade-in space-y-3 border-t border-border pt-3">
          {loading ? (
            <div className="h-8 animate-pulse rounded-lg bg-card/40" />
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Be the first to reply.</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="animate-fade-in rounded-xl border border-border bg-background/40 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">{c.display_name}</span>
                    <span className="text-muted-foreground">
                      {new Date(c.created_at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{c.body}</p>
                  <div className="mt-1.5 flex items-center gap-3">
                    <button
                      onClick={() => toggleLike(c)}
                      className={`flex items-center gap-1 text-xs transition-colors ${
                        c.liked_by_me ? "text-primary" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Heart className={`h-3 w-3 ${c.liked_by_me ? "fill-current" : ""}`} />
                      {c.like_count}
                    </button>
                    {c.user_id === me && (
                      <button
                        onClick={() => remove(c.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={submit} className="flex items-center gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a comment…"
              maxLength={1000}
              className="flex-1 rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={posting || !body.trim()}
              className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {posting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
