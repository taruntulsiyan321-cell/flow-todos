// Subscribes to realtime community events (new posts, comments, challenges, messages)
// and surfaces browser notifications using the existing notifications.ts helper.
// Activated globally in the app shell once a user is signed in.

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fireNotification, notificationsEnabled } from "@/lib/notifications";

type Profile = { id: string; display_name: string | null };

export function CommunityPushListener({ userId }: { userId: string }) {
  const nameMap = useRef<Map<string, string>>(new Map());
  const myCommunities = useRef<Set<string>>(new Set());
  const slugMap = useRef<Map<string, { name: string; slug: string }>>(new Map());

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      const { data: mems } = await supabase
        .from("community_members")
        .select("community_id")
        .eq("user_id", userId);
      const ids = (mems ?? []).map((m) => m.community_id as string);
      myCommunities.current = new Set(ids);
      if (ids.length === 0) return;

      const { data: comms } = await supabase
        .from("communities")
        .select("id, name, slug")
        .in("id", ids);
      (comms ?? []).forEach((c) => slugMap.current.set(c.id, { name: c.name, slug: c.slug }));
      if (cancelled) return;
    })();

    async function nameFor(id: string): Promise<string> {
      if (nameMap.current.has(id)) return nameMap.current.get(id)!;
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", id)
        .maybeSingle();
      const name = (data as Profile | null)?.display_name ?? "A member";
      nameMap.current.set(id, name);
      return name;
    }

    const channel = supabase
      .channel("community:push")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_posts" },
        async (payload) => {
          if (!notificationsEnabled()) return;
          const row = payload.new as { user_id: string; community_id: string; body: string };
          if (row.user_id === userId) return;
          if (!myCommunities.current.has(row.community_id)) return;
          const author = await nameFor(row.user_id);
          const c = slugMap.current.get(row.community_id);
          fireNotification(
            `New post in ${c?.name ?? "your crew"}`,
            `${author}: ${row.body.slice(0, 120)}`,
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_challenges" },
        async (payload) => {
          if (!notificationsEnabled()) return;
          const row = payload.new as { community_id: string; title: string };
          if (!myCommunities.current.has(row.community_id)) return;
          const c = slugMap.current.get(row.community_id);
          fireNotification(`New challenge in ${c?.name ?? "your crew"}`, row.title);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "partner_invites", filter: `to_user=eq.${userId}` },
        async (payload) => {
          if (!notificationsEnabled()) return;
          const row = payload.new as { from_user: string };
          const author = await nameFor(row.from_user);
          fireNotification("New accountability invite", `${author} wants to be your partner`);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return null;
}
