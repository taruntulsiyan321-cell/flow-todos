create or replace function public.calc_level(p_xp integer)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  lvl integer := 1;
  needed integer := 100;
  remaining integer := p_xp;
begin
  while remaining >= needed and lvl < 100 loop
    remaining := remaining - needed;
    lvl := lvl + 1;
    needed := lvl * 100;
  end loop;
  return lvl;
end;
$$;
revoke execute on function public.calc_level(integer) from anon, authenticated, public;