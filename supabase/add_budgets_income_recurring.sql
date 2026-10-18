-- Run this once in the Supabase SQL editor, after create_tables.sql.
-- Adds budgets, income and recurring expenses. Safe to run more than once.
-- The habit tracker tables are not touched.

-- Monthly budgets. category_id null means the budget for all spending.
create table if not exists budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid references expense_categories (id) on delete cascade,
  amount      bigint not null check (amount > 0),
  created_at  timestamptz not null default now(),
  unique nulls not distinct (user_id, category_id)
);

create table if not exists incomes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount     bigint not null check (amount > 0),
  note       text,
  date       date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists incomes_user_date on incomes (user_id, date desc);

-- Expenses that come back every month on the same day (rent, internet, ...).
-- last_added_month is the last month ('YYYY-MM') the app added it for.
create table if not exists recurring_expenses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount           bigint not null check (amount > 0),
  category_id      uuid references expense_categories (id) on delete set null,
  note             text,
  day_of_month     smallint not null check (day_of_month between 1 and 31),
  last_added_month text,
  created_at       timestamptz not null default now()
);

-- Links an expense to the recurring rule that created it. The unique
-- constraint stops the same rule being added twice for one day.
alter table expenses add column if not exists recurring_id uuid references recurring_expenses (id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'expenses_recurring_date') then
    alter table expenses add constraint expenses_recurring_date unique (recurring_id, date);
  end if;
end $$;

-- Only let each user read and write their own rows
alter table budgets            enable row level security;
alter table incomes            enable row level security;
alter table recurring_expenses enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'budgets' and policyname = 'own budgets') then
    create policy "own budgets" on budgets for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'incomes' and policyname = 'own incomes') then
    create policy "own incomes" on incomes for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'recurring_expenses' and policyname = 'own recurring expenses') then
    create policy "own recurring expenses" on recurring_expenses for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
