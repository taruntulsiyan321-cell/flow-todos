import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for auth state.
 *
 * - Subscribes to `onAuthStateChange` BEFORE calling `getSession()` so that the
 *   initial session restore from localStorage isn't missed by a late listener.
 * - Exposes `ready` separately from `loading` so consumers (and queries) can
 *   wait for the session to be hydrated before issuing authenticated requests
 *   — this prevents the race where `auth.uid()` is null and RLS denies the read.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 1. Listener first so we never miss the INITIAL_SESSION event.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setReady(true);
    });

    // 2. Then resolve current session from storage.
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
        setReady(true);
      })
      .catch(() => {
        // Network blip on cold start — mark ready so UI doesn't hang forever.
        setReady(true);
      });

    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, ready, loading: !ready };
}

export async function signOut() {
  await supabase.auth.signOut();
}

/**
 * Translate raw Supabase auth errors into clear, friendly messages.
 */
export function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const m = raw.toLowerCase();

  if (m.includes("invalid login") || m.includes("invalid_credentials"))
    return "Invalid email or password.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email — check your inbox for the verification link.";
  if (m.includes("user already registered") || m.includes("already registered"))
    return "An account with this email already exists. Try signing in instead.";
  if (m.includes("password should be") || m.includes("weak password"))
    return "Please choose a stronger password (min 6 characters).";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("network") || m.includes("fetch") || m.includes("failed to fetch"))
    return "Network issue — please check your connection and try again.";
  if (m.includes("session") && m.includes("expired"))
    return "Your session expired — please sign in again.";
  if (m.includes("jwt") || m.includes("token"))
    return "Session expired. Please sign in again.";

  return raw || "Something went wrong. Please try again.";
}
