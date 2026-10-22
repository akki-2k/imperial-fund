create table if not exists public.fund_state (
  id text primary key check (id = 'shared'),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  version bigint not null default 1 check (version > 0)
);

alter table public.fund_state enable row level security;

drop policy if exists "Public can read shared fund" on public.fund_state;
create policy "Public can read shared fund"
  on public.fund_state for select to anon
  using (id = 'shared');

drop policy if exists "Public can create shared fund" on public.fund_state;
create policy "Public can create shared fund"
  on public.fund_state for insert to anon
  with check (id = 'shared');

drop policy if exists "Public can update shared fund" on public.fund_state;
create policy "Public can update shared fund"
  on public.fund_state for update to anon
  using (id = 'shared')
  with check (id = 'shared');

grant select, insert, update on public.fund_state to anon;
