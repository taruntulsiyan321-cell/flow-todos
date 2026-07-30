import { supabase } from "@/integrations/supabase/client";

/**
 * Untyped table accessor for Life OS tables until supabase gen types are refreshed.
 * Must return `any` — casting to ReturnType<typeof supabase.from> collapses inserts to `never`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lifeFrom = (table: string): any => (supabase as any).from(table);
