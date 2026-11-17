-- Knight Duel: Colosseum PvP rewards. ADDITIVE migration: run once in Supabase > SQL Editor > New query > Run
-- (after supabase/schema.sql). It creates one new table and one function; it does not change `characters`' structure or policies.
-- Safe to re-run.
--
-- How a ranked duel is rewarded:
--   1. Each player's game reports the result with pvp_report(match, my character, opponent character, winner).
--   2. Rewards are paid only when BOTH players' reports agree on the same winner (a lone report stays "pending").
--   3. Each character is rewarded at most once per match (duplicate calls are harmless).
--   4. Anti-farming caps: at most 12 rewarded matches per character per hour and 4 per character pair per day.
--   5. The reward amounts live here on the server; the client only displays what the server returns.
-- Limits (honest): two colluding accounts can still trade wins up to the caps, and the characters table itself still lets a signed-in
-- player edit their own row directly (that is how the existing training-bot rewards are saved). Closing that needs a separate hardening migration.

create table if not exists public.pvp_reports (
  match_key  text        not null check (length(match_key) between 8 and 64),
  char_id    uuid        not null references public.characters(id) on delete cascade,
  user_id    uuid        not null,
  opp_char   uuid        not null,
  winner     uuid        not null,
  rewarded   boolean     not null default false,
  created_at timestamptz not null default now(),
  primary key (match_key, char_id)
);
create index if not exists pvp_reports_char_idx on public.pvp_reports (char_id, created_at);

-- nobody can read or write reports directly; they are only reachable through pvp_report()
alter table public.pvp_reports enable row level security;
revoke all on public.pvp_reports from anon, authenticated;

create or replace function public.pvp_report(p_match text, p_my uuid, p_opp uuid, p_winner uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.characters; opp public.characters; mine public.pvp_reports; theirs public.pvp_reports;
  won boolean; g int; x int; r int; v_lv int; v_xp int; recent int; pair int; pw int; pl int;
begin
  if auth.uid() is null then return jsonb_build_object('status','error','msg','Sign in first'); end if;
  if p_match is null or length(p_match) < 8 or length(p_match) > 64 then
    return jsonb_build_object('status','error','msg','Bad match id'); end if;

  select * into me from public.characters where id = p_my and user_id = auth.uid();
  if not found then return jsonb_build_object('status','error','msg','Not your character'); end if;
  select * into opp from public.characters where id = p_opp;
  if not found or opp.user_id = me.user_id or p_winner not in (p_my, p_opp) then
    return jsonb_build_object('status','error','msg','Invalid match'); end if;

  insert into public.pvp_reports (match_key, char_id, user_id, opp_char, winner)
    values (p_match, p_my, auth.uid(), p_opp, p_winner)
    on conflict (match_key, char_id) do nothing;
  select * into mine from public.pvp_reports where match_key = p_match and char_id = p_my;
  if mine.opp_char <> p_opp or mine.winner <> p_winner then
    return jsonb_build_object('status','error','msg','Conflicting report'); end if;

  pw := coalesce((me.progress->>'pvpW')::int, 0); pl := coalesce((me.progress->>'pvpL')::int, 0);
  if mine.rewarded then   -- duplicate call: no second reward, just return the current totals
    return jsonb_build_object('status','done','lv',me.level,'xp',me.xp,'gold',me.gold,'rep',me.reputation,'pvpW',pw,'pvpL',pl); end if;

  select * into theirs from public.pvp_reports where match_key = p_match and char_id = p_opp;
  if not found then return jsonb_build_object('status','pending'); end if;
  if theirs.opp_char <> p_my or theirs.winner <> mine.winner then return jsonb_build_object('status','disputed'); end if;

  won := (mine.winner = p_my);
  select count(*) into recent from public.pvp_reports where char_id = p_my and rewarded and created_at > now() - interval '1 hour';
  select count(*) into pair   from public.pvp_reports where char_id = p_my and opp_char = p_opp and rewarded and created_at > now() - interval '1 day';
  if recent >= 12 or pair >= 4 then
    update public.pvp_reports set rewarded = true where match_key = p_match and char_id = p_my;
    return jsonb_build_object('status','capped','lv',me.level,'xp',me.xp,'gold',me.gold,'rep',me.reputation,'pvpW',pw,'pvpL',pl); end if;

  g := case when won then 50 else 10 end;   -- gold
  x := case when won then 60 else 20 end;   -- experience
  r := case when won then 8  else 0  end;   -- reputation
  v_lv := me.level; v_xp := me.xp + x;
  while v_lv < 100 and v_xp >= 100 * v_lv loop v_xp := v_xp - 100 * v_lv; v_lv := v_lv + 1; end loop;
  if won then pw := pw + 1; else pl := pl + 1; end if;

  update public.characters
     set level = v_lv, xp = v_xp,
         gold = least(gold + g, 100000000),
         reputation = least(reputation + r, 1000000),
         progress = coalesce(progress, '{}'::jsonb) || jsonb_build_object('pvpW', pw, 'pvpL', pl)
   where id = p_my
   returning * into me;
  if not found then return jsonb_build_object('status','error','msg','Could not update the character'); end if;

  update public.pvp_reports set rewarded = true where match_key = p_match and char_id = p_my;
  return jsonb_build_object('status','ok','won',won,'gain_gold',g,'gain_xp',x,'gain_rep',r,
                            'lv',me.level,'xp',me.xp,'gold',me.gold,'rep',me.reputation,'pvpW',pw,'pvpL',pl);
end $$;

revoke all on function public.pvp_report(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.pvp_report(text, uuid, uuid, uuid) to authenticated;
