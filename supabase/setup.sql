create table if not exists public.fund_state (
  id text primary key check (id = 'shared'),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  version bigint not null default 1 check (version > 0)
);

alter table public.fund_state enable row level security;

revoke all on table public.fund_state from anon, authenticated;
grant select on table public.fund_state to anon, authenticated;
grant insert, update on table public.fund_state to authenticated;

drop policy if exists "Public can read shared fund" on public.fund_state;
drop policy if exists "Signed-in users can read shared fund" on public.fund_state;
create policy "Everyone can read shared fund"
  on public.fund_state for select to anon, authenticated
  using (id = 'shared');

drop policy if exists "Public can create shared fund" on public.fund_state;
drop policy if exists "Fund admins can create shared fund" on public.fund_state;
create policy "Fund admins can create shared fund"
  on public.fund_state for insert to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'fund_role') = 'admin');

drop policy if exists "Public can update shared fund" on public.fund_state;
drop policy if exists "Fund admins can update shared fund" on public.fund_state;
create policy "Fund admins can update shared fund"
  on public.fund_state for update to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'fund_role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'fund_role') = 'admin');

grant select, insert, update on public.fund_state to service_role;
