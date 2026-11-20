-- =====================================================================
--  Gecko Budget — base de données Supabase
--  À coller en entier dans Supabase > SQL Editor > New query > Run.
--  On peut le relancer sans risque : il ne supprime aucune donnée.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tables ----------------------------------------------------

-- Le foyer : nos réglages (prénoms, revenus, charges, enveloppes, cagnottes)
create table if not exists public.households (
  id           uuid primary key default gen_random_uuid(),
  invite_code  text unique not null,
  settings     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Qui fait partie de quel foyer (un compte = un seul foyer, 2 comptes max par foyer)
create table if not exists public.household_members (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists household_members_household_idx on public.household_members (household_id);

-- Les opérations : dépenses, rentrées, mouvements d'épargne
create table if not exists public.transactions (
  id           uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  kind         text not null check (kind in ('expense', 'income', 'saving')),
  amount       bigint not null,               -- en centimes
  category     text not null,
  person       smallint not null check (person in (1, 2)),
  date         date not null,
  note         text not null default '',
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists transactions_household_date_idx on public.transactions (household_id, date);

-- ---------- Mise à jour automatique de updated_at --------------------

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists households_touch on public.households;
create trigger households_touch before update on public.households
  for each row execute function public.touch_updated_at();

drop trigger if exists transactions_touch on public.transactions;
create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

-- ---------- Qui a le droit ? (RLS) -----------------------------------

create or replace function public.is_member(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members m where m.household_id = hid and m.user_id = auth.uid());
$$;

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.transactions      enable row level security;

-- Foyer : on ne voit et ne modifie que le sien. Création uniquement via create_household().
drop policy if exists "foyer lisible par ses membres" on public.households;
create policy "foyer lisible par ses membres" on public.households
  for select to authenticated using (public.is_member(id));
drop policy if exists "foyer modifiable par ses membres" on public.households;
create policy "foyer modifiable par ses membres" on public.households
  for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

-- Membres : on voit les membres de son foyer. Ajout uniquement via create/join_household().
drop policy if exists "membres visibles par le foyer" on public.household_members;
create policy "membres visibles par le foyer" on public.household_members
  for select to authenticated using (public.is_member(household_id));

-- Opérations : lecture / ajout / modification / suppression réservés aux membres du foyer.
drop policy if exists "operations du foyer" on public.transactions;
create policy "operations du foyer" on public.transactions
  for all to authenticated
  using (public.is_member(household_id))
  with check (public.is_member(household_id));

-- ---------- Créer / rejoindre le foyer -------------------------------

create or replace function public.new_invite_code() returns text
language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  return code;
end $$;

create or replace function public.create_household(initial_settings jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select household_id into hid from public.household_members where user_id = auth.uid();
  if hid is not null then return hid; end if;
  insert into public.households (invite_code, settings)
    values (public.new_invite_code(), coalesce(initial_settings, '{}'::jsonb))
    returning id into hid;
  insert into public.household_members (user_id, household_id) values (auth.uid(), hid);
  return hid;
end $$;

create or replace function public.join_household(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
  existing uuid;
  n int;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select household_id into existing from public.household_members where user_id = auth.uid();
  select id into hid from public.households where invite_code = upper(trim(code));
  if hid is null then raise exception 'CODE_INCONNU'; end if;
  if existing = hid then return hid; end if;
  if existing is not null then raise exception 'DEJA_DANS_UN_FOYER'; end if;
  select count(*) into n from public.household_members where household_id = hid;
  if n >= 2 then raise exception 'FOYER_COMPLET'; end if;
  insert into public.household_members (user_id, household_id) values (auth.uid(), hid);
  return hid;
end $$;

-- Quitter un foyer vide qu'on vient de créer par erreur (pour pouvoir en rejoindre un autre)
create or replace function public.leave_empty_household() returns void
language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
begin
  select household_id into hid from public.household_members where user_id = auth.uid();
  if hid is null then return; end if;
  if exists (select 1 from public.transactions where household_id = hid) then
    raise exception 'FOYER_NON_VIDE';
  end if;
  if (select count(*) from public.household_members where household_id = hid) > 1 then
    raise exception 'FOYER_PARTAGE';
  end if;
  delete from public.households where id = hid;
end $$;

revoke all on function public.create_household(jsonb) from public, anon;
revoke all on function public.join_household(text) from public, anon;
revoke all on function public.leave_empty_household() from public, anon;
grant execute on function public.create_household(jsonb) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.leave_empty_household() to authenticated;

-- ---------- Temps réel ------------------------------------------------

do $$
begin
  begin
    alter publication supabase_realtime add table public.transactions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.households;
  exception when duplicate_object then null;
  end;
end $$;
