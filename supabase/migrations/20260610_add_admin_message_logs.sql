create table if not exists admin_message_logs (
  id uuid primary key default gen_random_uuid(),
  invitation_group_id uuid not null references invitation_groups(id) on delete cascade,
  channel text not null check (channel in ('whatsapp')),
  message_type text not null check (message_type in ('invitation', 'rsvp_confirmation', 'travel_plans')),
  recipient text,
  message_preview text,
  sent_at timestamptz not null default now(),
  sent_by text
);

create index if not exists admin_message_logs_invitation_group_id_idx
on admin_message_logs(invitation_group_id);

create index if not exists admin_message_logs_message_type_idx
on admin_message_logs(message_type);

alter table admin_message_logs enable row level security;

drop policy if exists "admin manage message logs" on admin_message_logs;
create policy "admin manage message logs"
on admin_message_logs for all
using (is_admin())
with check (is_admin());
