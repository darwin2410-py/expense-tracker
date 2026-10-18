-- Run this once in the Supabase SQL editor, after add_budgets_income_recurring.sql.
-- Adds an emoji to expense categories and a per-user settings table.
-- Safe to run more than once, and it never drops anything.
-- The habit tracker tables are not touched.

alter table expense_categories add column if not exists emoji text;

-- Give the default categories their emoji when they have none yet
update expense_categories set emoji = case name
    when 'Food' then '🍜'
    when 'Transport' then '🚗'
    when 'Shopping' then '🛍️'
    when 'Bills' then '🧾'
    when 'Health' then '💊'
    when 'Entertainment' then '🎬'
    when 'Other' then '📦'
  end
where emoji is null
  and name in ('Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other');

-- period_start_day: the day of the month a budget period starts (payday).
-- hide_amounts is kept for later; the app keeps that choice per device.
create table if not exists user_settings (
  user_id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  period_start_day smallint not null default 1 check (period_start_day between 1 and 28),
  hide_amounts     boolean not null default false,
  updated_at       timestamptz not null default now()
);

alter table user_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'user_settings' and policyname = 'own settings') then
    create policy "own settings" on user_settings for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
