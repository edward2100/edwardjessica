create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'guest_side') then
    create type guest_side as enum ('groom', 'bride', 'joint');
  end if;
  if not exists (select 1 from pg_type where typname = 'rsvp_status') then
    create type rsvp_status as enum ('pending', 'attending', 'declined');
  end if;
  if not exists (select 1 from pg_type where typname = 'meal_preference') then
    create type meal_preference as enum ('vegetarian', 'non_vegetarian', 'unset');
  end if;
  if not exists (select 1 from pg_type where typname = 'content_status') then
    create type content_status as enum ('draft', 'published');
  end if;
end $$;

create table if not exists admin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null default 'super_admin',
  created_at timestamptz not null default now()
);

create table if not exists site_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists content_versions (
  id uuid primary key default gen_random_uuid(),
  status content_status not null,
  content jsonb not null,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('hero', 'gallery', 'music')),
  url text not null,
  alt jsonb not null default '{"en":"","id":""}'::jsonb,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists invitation_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  greeting text not null,
  group_name text not null,
  phone text,
  email text,
  max_guests integer not null default 1 check (max_guests between 1 and 10),
  side guest_side not null default 'joint',
  source text not null default 'admin' check (source in ('admin', 'generic')),
  flow text not null default 'generic' check (flow in ('generic', 'overseas', 'family')),
  private_notes jsonb,
  eligible_events text[] not null default array['dinner'],
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table invitation_groups
add column if not exists source text not null default 'admin'
check (source in ('admin', 'generic'));

alter table invitation_groups
add column if not exists flow text not null default 'generic'
check (flow in ('generic', 'overseas', 'family'));

alter table invitation_groups
add column if not exists max_guests integer not null default 1
check (max_guests between 1 and 10);

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  invitation_group_id uuid not null references invitation_groups(id) on delete cascade,
  name text not null,
  meal_preference meal_preference not null default 'unset',
  created_at timestamptz not null default now()
);

create table if not exists rsvps (
  id uuid primary key default gen_random_uuid(),
  invitation_group_id uuid not null unique references invitation_groups(id) on delete cascade,
  status rsvp_status not null default 'pending',
  event_attendance jsonb not null default '{}'::jsonb,
  message text,
  submitted_at timestamptz,
  updated_at timestamptz,
  updated_by text check (updated_by in ('guest', 'admin'))
);

create table if not exists rsvp_history (
  id uuid primary key default gen_random_uuid(),
  invitation_group_id uuid not null references invitation_groups(id) on delete cascade,
  status rsvp_status not null,
  changed_by text not null check (changed_by in ('guest', 'admin')),
  changed_at timestamptz not null default now(),
  snapshot jsonb not null
);

create table if not exists invite_open_events (
  id uuid primary key default gen_random_uuid(),
  invitation_group_id uuid not null references invitation_groups(id) on delete cascade,
  opened_at timestamptz not null default now(),
  user_agent text
);

create table if not exists travel_plans (
  id uuid primary key default gen_random_uuid(),
  invitation_group_id uuid not null unique references invitation_groups(id) on delete cascade,
  arrival_at timestamptz not null,
  departure_at timestamptz not null,
  accommodation_option text not null check (accommodation_option in ('specific_roommates', 'assign_roommates', 'own_accommodation')),
  preferred_roommates text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table admin_profiles enable row level security;
alter table site_settings enable row level security;
alter table content_versions enable row level security;
alter table media_assets enable row level security;
alter table invitation_groups enable row level security;
alter table guests enable row level security;
alter table rsvps enable row level security;
alter table rsvp_history enable row level security;
alter table invite_open_events enable row level security;
alter table travel_plans enable row level security;

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from admin_profiles
    where user_id = auth.uid()
  );
$$;

drop policy if exists "published content readable" on content_versions;
create policy "published content readable"
on content_versions for select
using (status = 'published' or is_admin());

drop policy if exists "published media readable" on media_assets;
create policy "published media readable"
on media_assets for select
using (is_published or is_admin());

drop policy if exists "admin manage admin profiles" on admin_profiles;
create policy "admin manage admin profiles"
on admin_profiles for all
using (is_admin())
with check (is_admin());

drop policy if exists "admin manage settings" on site_settings;
create policy "admin manage settings"
on site_settings for all
using (is_admin())
with check (is_admin());

drop policy if exists "admin manage content" on content_versions;
create policy "admin manage content"
on content_versions for all
using (is_admin())
with check (is_admin());

drop policy if exists "admin manage media" on media_assets;
create policy "admin manage media"
on media_assets for all
using (is_admin())
with check (is_admin());

drop policy if exists "admin manage invitation groups" on invitation_groups;
create policy "admin manage invitation groups"
on invitation_groups for all
using (is_admin())
with check (is_admin());

drop policy if exists "admin manage guests" on guests;
create policy "admin manage guests"
on guests for all
using (is_admin())
with check (is_admin());

drop policy if exists "admin manage rsvps" on rsvps;
create policy "admin manage rsvps"
on rsvps for all
using (is_admin())
with check (is_admin());

drop policy if exists "admin read history" on rsvp_history;
create policy "admin read history"
on rsvp_history for select
using (is_admin());

drop policy if exists "admin read opens" on invite_open_events;
create policy "admin read opens"
on invite_open_events for select
using (is_admin());

drop policy if exists "admin manage travel plans" on travel_plans;
create policy "admin manage travel plans"
on travel_plans for all
using (is_admin())
with check (is_admin());

create or replace function public.get_invitation_by_code(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'group', to_jsonb(ig),
    'guests', coalesce(jsonb_agg(distinct to_jsonb(g)) filter (where g.id is not null), '[]'::jsonb),
    'rsvp', to_jsonb(r)
  )
  into result
  from invitation_groups ig
  left join guests g on g.invitation_group_id = ig.id
  left join rsvps r on r.invitation_group_id = ig.id
  where ig.code = upper(invite_code)
  group by ig.id, r.id;

  return result;
end;
$$;

insert into storage.buckets (id, name, public)
values ('wedding-media', 'wedding-media', true)
on conflict (id) do nothing;
