alter table invitation_groups
add column if not exists source text not null default 'admin'
check (source in ('admin', 'generic'));
