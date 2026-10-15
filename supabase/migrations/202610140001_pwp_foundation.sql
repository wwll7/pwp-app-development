create extension if not exists pgcrypto;

create type public.availability_state as enum ('free', 'busy', 'unset');
create type public.availability_source as enum ('manual', 'ics', 'sleep');

create table public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_user_id text not null unique,
  display_name text not null,
  avatar_url text,
  timezone text not null default 'UTC',
  default_interest smallint not null default 2 check (default_interest between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.availability_intervals (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.player_profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  state public.availability_state not null,
  source public.availability_source not null default 'manual',
  import_id uuid,
  source_key text,
  is_manual_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_intervals_valid_range check (ends_at > starts_at)
);

create table public.ics_imports (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.player_profiles(id) on delete cascade,
  calendar_name text,
  source_fingerprint text not null,
  imported_at timestamptz not null default now(),
  constraint ics_imports_player_fingerprint_unique unique (player_id, source_fingerprint)
);

alter table public.availability_intervals
  add constraint availability_intervals_import_fk
  foreign key (import_id) references public.ics_imports(id) on delete cascade;

create unique index availability_ics_source_key_unique
  on public.availability_intervals (player_id, import_id, source_key)
  where source is not distinct from 'ics' and source_key is not null;
create index availability_intervals_player_time_idx
  on public.availability_intervals (player_id, starts_at, ends_at);
create index availability_intervals_import_idx
  on public.availability_intervals (import_id);

create table public.sleep_schedules (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.player_profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_local time not null,
  ends_local time not null,
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sleep_schedules_distinct_range check (starts_local <> ends_local),
  constraint sleep_schedules_unique unique (player_id, weekday, starts_local, ends_local)
);

create table public.sleep_exceptions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.player_profiles(id) on delete cascade,
  exception_date date not null,
  is_sleeping boolean not null default false,
  created_at timestamptz not null default now(),
  constraint sleep_exceptions_unique unique (player_id, exception_date)
);

create table public.scoring_config (
  id boolean primary key default true check (id),
  free_points_per_hour numeric(5,2) not null default 5 check (free_points_per_hour >= 0),
  busy_points_per_hour numeric(5,2) not null default 0 check (busy_points_per_hour >= 0),
  default_interest_min smallint not null default 1 check (default_interest_min between 1 and 4),
  default_interest_max smallint not null default 4 check (default_interest_max between 1 and 4),
  default_interest_value smallint not null default 2 check (default_interest_value between default_interest_min and default_interest_max),
  updated_at timestamptz not null default now()
);
insert into public.scoring_config (id) values (true) on conflict (id) do nothing;

create table public.admin_allowlist (
  discord_user_id text primary key,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger player_profiles_updated_at before update on public.player_profiles for each row execute function public.set_updated_at();
create trigger availability_intervals_updated_at before update on public.availability_intervals for each row execute function public.set_updated_at();
create trigger sleep_schedules_updated_at before update on public.sleep_schedules for each row execute function public.set_updated_at();
create trigger scoring_config_updated_at before update on public.scoring_config for each row execute function public.set_updated_at();

alter table public.player_profiles enable row level security;
alter table public.availability_intervals enable row level security;
alter table public.ics_imports enable row level security;
alter table public.sleep_schedules enable row level security;
alter table public.sleep_exceptions enable row level security;
alter table public.scoring_config enable row level security;
alter table public.admin_allowlist enable row level security;

create policy profiles_select_authenticated on public.player_profiles for select to authenticated using (true);
create policy profiles_insert_self on public.player_profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_self on public.player_profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy availability_select_authenticated on public.availability_intervals for select to authenticated using (true);
create policy availability_insert_self on public.availability_intervals for insert to authenticated with check ((select auth.uid()) = player_id);
create policy availability_update_self on public.availability_intervals for update to authenticated using ((select auth.uid()) = player_id) with check ((select auth.uid()) = player_id);
create policy availability_delete_self on public.availability_intervals for delete to authenticated using ((select auth.uid()) = player_id);

create policy imports_self on public.ics_imports for all to authenticated using ((select auth.uid()) = player_id) with check ((select auth.uid()) = player_id);
create policy sleep_schedules_self on public.sleep_schedules for all to authenticated using ((select auth.uid()) = player_id) with check ((select auth.uid()) = player_id);
create policy sleep_exceptions_self on public.sleep_exceptions for all to authenticated using ((select auth.uid()) = player_id) with check ((select auth.uid()) = player_id);

create policy scoring_select_authenticated on public.scoring_config for select to authenticated using (true);
create policy scoring_admin_update on public.scoring_config for update to authenticated using (exists (select 1 from public.admin_allowlist a join public.player_profiles p on p.discord_user_id = a.discord_user_id where p.id = (select auth.uid()))) with check (exists (select 1 from public.admin_allowlist a join public.player_profiles p on p.discord_user_id = a.discord_user_id where p.id = (select auth.uid())));
create policy admins_select_authenticated on public.admin_allowlist for select to authenticated using (true);

revoke insert, update, delete on public.scoring_config from anon, authenticated;
grant select on public.scoring_config to authenticated;
revoke insert, update, delete on public.admin_allowlist from anon, authenticated;
grant select on public.admin_allowlist to authenticated;
