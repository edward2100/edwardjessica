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

alter table travel_plans enable row level security;

drop policy if exists "admin manage travel plans" on travel_plans;
create policy "admin manage travel plans"
on travel_plans for all
using (is_admin())
with check (is_admin());
