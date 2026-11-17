-- Knight Duel: database setup. Run once in Supabase > SQL Editor > New query > Run.
-- Safe to re-run: it only creates what is missing.

create table if not exists public.characters (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name           text not null,
  gender         text not null check (gender in ('male','female')),
  class          text not null check (class in ('gladiator','knight','ranger','duelist','guardian')),
  armor_color    integer not null default 9345958 check (armor_color between 0 and 16777215),
  cloth_color    integer not null default 8000287 check (cloth_color between 0 and 16777215),
  level          integer not null default 1  check (level between 1 and 100),
  xp             integer not null default 0  check (xp between 0 and 100000000),
  gold           integer not null default 0  check (gold between 0 and 100000000),
  reputation     integer not null default 0  check (reputation between -1000000 and 1000000),
  inventory      jsonb not null default '[]'::jsonb,
  equipment      jsonb not null default '{}'::jsonb,
  weapon_mastery jsonb not null default '{}'::jsonb,
  quests         jsonb not null default '{"active":[],"done":[]}'::jsonb,
  progress       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint characters_name_format check (name ~ '^[A-Za-z0-9 ]{3,16}$'),
  constraint characters_inventory_type check (jsonb_typeof(inventory) = 'array'),
  constraint characters_json_size check (
    octet_length(inventory::text) < 20000 and octet_length(equipment::text) < 5000 and
    octet_length(weapon_mastery::text) < 5000 and octet_length(quests::text) < 20000 and
    octet_length(progress::text) < 20000)
);

-- knight names are unique across all players (case-insensitive)
create unique index if not exists characters_name_unique on public.characters (lower(name));
create index if not exists characters_user_idx on public.characters (user_id);

-- at most 5 knights per account
create or replace function public.characters_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.characters where user_id = new.user_id) >= 5 then
    raise exception 'You can have at most 5 knights';
  end if;
  return new;
end $$;
drop trigger if exists characters_limit_trg on public.characters;
create trigger characters_limit_trg before insert on public.characters
  for each row execute function public.characters_limit();

-- owner, name, class, gender and creation time can never be changed by an update; updated_at is set by the server
create or replace function public.characters_guard() returns trigger
language plpgsql as $$
begin
  new.id := old.id; new.user_id := old.user_id; new.created_at := old.created_at;
  new.name := old.name; new.class := old.class; new.gender := old.gender;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists characters_guard_trg on public.characters;
create trigger characters_guard_trg before update on public.characters
  for each row execute function public.characters_guard();

-- Row Level Security: a player can only touch their own rows
alter table public.characters enable row level security;
alter table public.characters force row level security;

drop policy if exists "own characters: select" on public.characters;
drop policy if exists "own characters: insert" on public.characters;
drop policy if exists "own characters: update" on public.characters;
drop policy if exists "own characters: delete" on public.characters;
create policy "own characters: select" on public.characters for select to authenticated using (auth.uid() = user_id);
create policy "own characters: insert" on public.characters for insert to authenticated with check (auth.uid() = user_id);
create policy "own characters: update" on public.characters for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own characters: delete" on public.characters for delete to authenticated using (auth.uid() = user_id);

-- logged-out visitors get nothing
revoke all on public.characters from anon;
grant select, insert, update, delete on public.characters to authenticated;
