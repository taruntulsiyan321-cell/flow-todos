import { supabase } from "@/integrations/supabase/client";

/** Untyped table accessor for Life OS tables until supabase gen types are refreshed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lifeFrom = (table: string) => (supabase as any).from(table) as ReturnType<typeof supabase.from>;
