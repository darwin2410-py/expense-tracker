-- Run this once in the Supabase SQL editor.
-- It only creates new tables. The habit tracker tables (habits, completions,
-- categories) are not touched. Expense categories live in their own table
-- because "categories" is already used by the habit tracker.

create table if not exists expense_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  color      text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount      bigint not null check (amount > 0),
  category_id uuid references expense_categories (id) on delete set null,
  note        text,
  date        date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists expenses_user_date on expenses (user_id, date desc);

-- Only let each user read and write their own rows
alter table expense_categories enable row level security;
alter table expenses           enable row level security;

drop policy if exists "own expense categories" on expense_categories;
drop policy if exists "own expenses" on expenses;

create policy "own expense categories" on expense_categories for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own expenses" on expenses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
