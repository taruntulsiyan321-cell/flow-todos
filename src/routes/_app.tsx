import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MobileNav } from "@/components/MobileNav";
import { CommunityPushListener } from "@/components/CommunityPushListener";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth", search: { mode: "signin" as const } });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();

  // Force-redirect to /auth the moment the session is gone (logout, expiry).
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
        navigate({ to: "/auth", search: { mode: "signin" } });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <div
      className="app-texture min-h-screen bg-background pb-24"
      style={{ backgroundImage: "var(--gradient-glow)", backgroundRepeat: "no-repeat" }}
    >
      <div className="mx-auto max-w-2xl px-4 pb-8 pt-6 sm:px-6">
        <Outlet />
      </div>
      <MobileNav />
    </div>
  );
}
