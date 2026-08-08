import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MobileNav } from "@/components/MobileNav";
import { CommunityPushListener } from "@/components/CommunityPushListener";
import { DailyScheduleReminders } from "@/components/DailyScheduleReminders";
import { AppSplash } from "@/components/AppSplash";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { mode: "signin" as const } });
    }
  },
  // Never leave the user staring at a blank screen while auth resolves.
  pendingComponent: () => <AppSplash />,
  pendingMs: 300,
  pendingMinMs: 200,
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id ?? null);
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
      {userId && <CommunityPushListener userId={userId} />}
      {userId && <DailyScheduleReminders />}
      <div className="mx-auto max-w-2xl px-4 pb-8 pt-6 sm:px-6">
        <Outlet />
      </div>
      <MobileNav />
    </div>
  );
}
