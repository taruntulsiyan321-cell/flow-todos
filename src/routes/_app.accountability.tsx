import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { lifeFrom } from "@/lib/lifeos-db";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/accountability")({
  head: () => ({ meta: [{ title: "Accountability — Forge" }] }),
  component: AccountabilityPage,
});

type Checkin = {
  id: string;
  checkin_date: string;
  kept_promises: boolean | null;
  promises_text: string | null;
  why_not: string | null;
  excuse_tags: string[] | null;
};

const EXCUSES = ["Too tired", "Too busy", "Unclear", "Fear", "Boring", "Unexpected"];

function AccountabilityPage() {
  const [rows, setRows] = useState<Checkin[]>([]);
  const [kept, setKept] = useState<boolean | null>(null);
  const [promises, setPromises] = useState("");
  const [whyNot, setWhyNot] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const load = async () => {
    const { data } = await lifeFrom("accountability_checkins")
      .select("*")
      .order("checkin_date", { ascending: false })
      .limit(30);
    setRows((data as Checkin[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  const recurring = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      for (const t of r.excuse_tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [rows]);

  const save = async () => {
    if (kept == null) return toast.error("Did you keep your promises?");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await lifeFrom("accountability_checkins").upsert(
      {
        user_id: u.user.id,
        checkin_date: new Date().toISOString().slice(0, 10),
        kept_promises: kept,
        promises_text: promises.trim() || null,
        why_not: kept ? null : whyNot.trim() || null,
        excuse_tags: kept ? [] : tags,
      },
      { onConflict: "user_id,checkin_date" },
    );
    if (error) return toast.error(error.message);
    toast.success("Accountability logged");
    void load();
  };

  return (
    <div className="space-y-5 animate-page-in">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="h-6 w-6 text-success" /> Accountability
        </h1>
        <p className="text-sm text-muted-foreground">12 Week Year style — did you do what you promised?</p>
      </header>

      {recurring.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm">
          Recurring excuses: {recurring.map(([t, n]) => `${t} (${n}×)`).join(" · ")}
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <Textarea placeholder="What did you promise today?" value={promises} onChange={(e) => setPromises(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setKept(true)}
            className={cn("rounded-xl border py-3 text-sm", kept === true ? "border-success text-success" : "border-border")}
          >
            Yes — kept it
          </button>
          <button
            onClick={() => setKept(false)}
            className={cn("rounded-xl border py-3 text-sm", kept === false ? "border-destructive text-destructive" : "border-border")}
          >
            No — missed it
          </button>
        </div>
        {kept === false && (
          <>
            <Textarea placeholder="Why not?" value={whyNot} onChange={(e) => setWhyNot(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {EXCUSES.map((e) => (
                <button
                  key={e}
                  onClick={() => setTags((t) => (t.includes(e) ? t.filter((x) => x !== e) : [...t, e]))}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    tags.includes(e) ? "border-warning text-warning" : "border-border text-muted-foreground",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
        <Button onClick={save} className="w-full">
          Save evening check-in
        </Button>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span>{r.checkin_date}</span>
              <span className={r.kept_promises ? "text-success" : "text-destructive"}>
                {r.kept_promises ? "Kept" : "Missed"}
              </span>
            </div>
            {r.why_not && <p className="text-xs text-muted-foreground">{r.why_not}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
