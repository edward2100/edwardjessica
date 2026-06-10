alter table invitation_groups
add column if not exists max_guests integer not null default 1
check (max_guests between 1 and 10);

with guest_counts as (
  select invitation_group_id, count(*)::integer as guest_count
  from guests
  group by invitation_group_id
)
update invitation_groups
set max_guests = greatest(1, least(10, coalesce(guest_counts.guest_count, 1)))
from guest_counts
where guest_counts.invitation_group_id = invitation_groups.id
  and invitation_groups.source = 'admin';
