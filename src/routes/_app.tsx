import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { MobileNav } from "@/components/MobileNav";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth", search: { mode: "signin" as const } });
    }
  },
  component: AppLayout,
});

function AppLayout() {
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
