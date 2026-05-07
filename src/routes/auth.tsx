import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Sparkles, Loader2, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { friendlyAuthError } from "@/lib/auth";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).catch("signin"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    // Skip the session redirect when returning from OAuth —
    // the URL hash will contain tokens that haven't been processed yet.
    if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — Forge" },
      { name: "description", content: "Sign in or create your Forge account." },
    ],
  }),
  component: AuthPage,
});

const credSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(72),
  displayName: z.string().trim().min(1).max(60).optional(),
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";

  // Handle OAuth callback — when the OAuth broker redirects back with tokens
  // in the URL hash (e.g. #access_token=...&refresh_token=...), extract them
  // and establish the Supabase session before navigating to /dashboard.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) return;

    setLoading(true);
    // Clear the hash so it doesn't get re-processed on re-renders
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          toast.error(friendlyAuthError(error));
          setLoading(false);
        } else {
          navigate({ to: "/dashboard" });
        }
      })
      .catch((err) => {
        toast.error(friendlyAuthError(err));
        setLoading(false);
      });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = credSchema.safeParse({
      email,
      password,
      displayName: isSignup ? displayName : undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: parsed.data.displayName },
          },
        });
        if (error) throw error;
        toast.success("Welcome to Forge! 🎉");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth`,
      });
      if (result.error) throw result.error;
      if (!result.redirected) navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(friendlyAuthError(err));
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-background px-5 py-10"
      style={{ backgroundImage: "var(--gradient-glow)" }}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-border p-7"
        style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-primary-foreground"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isSignup ? "Create account" : "Welcome back"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isSignup ? "Begin your journey." : "Continue your journey."}
            </p>
          </div>
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignup && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              maxLength={60}
              className="w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
              maxLength={255}
              className="w-full rounded-xl border border-border bg-input py-3 pl-10 pr-4 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={6}
              maxLength={72}
              className="w-full rounded-xl border border-border bg-input py-3 pl-10 pr-4 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {isSignup ? "Already have an account?" : "New to Forge?"}{" "}
          <Link
            to="/auth"
            search={{ mode: isSignup ? "signin" : "signup" }}
            className="font-medium text-primary hover:underline"
          >
            {isSignup ? "Sign in" : "Create one"}
          </Link>
        </p>
      </div>
    </div>
  );
}
