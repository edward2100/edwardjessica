alter table invitation_groups
add column if not exists flow text not null default 'generic'
check (flow in ('generic', 'overseas', 'family'));

update invitation_groups
set flow = private_notes->>'inviteFlow'
where private_notes ? 'inviteFlow'
  and private_notes->>'inviteFlow' in ('generic', 'overseas', 'family');
