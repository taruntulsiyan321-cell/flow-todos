import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type AnyRow = Record<string, unknown>;

/**
 * Delete a row but keep a snapshot so the user can undo it from the toast.
 * The snapshot includes the primary key, so restoring puts the row back exactly
 * as it was (and DB triggers re-derive XP / streaks from real state).
 */
export async function deleteWithUndo(opts: {
  table: string;
  id: string;
  label: string;
  /** Refresh callback: called after delete and after a successful restore. */
  refresh?: () => void | Promise<void>;
}): Promise<boolean> {
  const table = supabase.from(opts.table as never);
  const { data: snapshot, error: readErr } = await (table.select("*") as never as {
    eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: AnyRow | null; error: { message: string } | null }> };
  })
    .eq("id", opts.id)
    .maybeSingle();

  if (readErr) {
    toast.error(readErr.message);
    return false;
  }

  const { error } = await (supabase.from(opts.table as never).delete() as never as {
    eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
  }).eq("id", opts.id);

  if (error) {
    toast.error(error.message);
    return false;
  }

  void opts.refresh?.();

  toast(`${opts.label} deleted`, {
    duration: 8000,
    action: snapshot
      ? {
          label: "Undo",
          onClick: () => {
            void (async () => {
              const { error: insErr } = await (supabase
                .from(opts.table as never)
                .insert(snapshot as never) as unknown as Promise<{ error: { message: string } | null }>);
              if (insErr) return toast.error(`Couldn't restore: ${insErr.message}`);
              toast.success(`${opts.label} restored`);
              await opts.refresh?.();
            })();
          },
        }
      : undefined,
  });

  return true;
}
