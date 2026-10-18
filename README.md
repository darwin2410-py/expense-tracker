# Expense Tracker

Simple expense tracker built with React, Vite and Supabase. Installable as a PWA. Same setup as the habit tracker.

Features:

- Quick Add screen with its own numpad (no phone keyboard): `00`, `000` and `jt` (times a million), favorite categories by use, date and note chips, Undo after saving
- Bottom tab bar: Add, Activity, Budget, Insight, More
- Edit and delete expenses and income from Activity
- Default categories with emoji, plus add, rename, recolor, change the emoji and delete your own
- Month can start on your payday (1-28): totals, budgets, lists, Summary and CSV follow it
- Eye button hides every amount (kept per device)
- Monthly total, breakdown per category and income vs spending
- Monthly budgets, overall and per category
- Recurring expenses (rent, internet, ...) added on their day each month
- Search notes and filter by category
- Quick amounts and note suggestions that also pick the category
- Summary page comparing the last 6 or 12 months
- Export a month as CSV
- Works offline: new, edited and deleted entries sync when you are back online
- Dark mode

## Setup

```bash
npm install
```

Create `.env`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

You can use the same values as the habit tracker.

## Supabase

This app reuses the habit tracker's Supabase project and only adds two new tables.

1. Open the SQL editor in Supabase and run `supabase/create_tables.sql`, then `supabase/add_budgets_income_recurring.sql`, then `supabase/add_settings_and_emoji.sql`. They create:

   | Table | Columns |
   | --- | --- |
   | `expense_categories` | `id`, `user_id`, `name`, `color`, `emoji`, `created_at` |
   | `expenses` | `id`, `user_id`, `amount`, `category_id`, `note`, `date`, `recurring_id`, `created_at` |
   | `incomes` | `id`, `user_id`, `amount`, `note`, `date`, `created_at` |
   | `budgets` | `id`, `user_id`, `category_id` (empty for the overall budget), `amount`, `created_at` |
   | `recurring_expenses` | `id`, `user_id`, `amount`, `category_id`, `note`, `day_of_month`, `last_added_month`, `created_at` |
   | `user_settings` | `user_id` (primary key), `period_start_day`, `hide_amounts`, `updated_at` |

   Row level security is on, so each user only sees their own rows. The habit tables (`habits`, `completions`, `categories`) are not changed. Expense categories use their own table because `categories` already belongs to the habit tracker.

2. Under Authentication > URL Configuration, add the URL of this app (for example `https://your-expenses.vercel.app`) to the Redirect URLs. Keep the habit tracker URL there too.

3. Sign in with the same account you use for the habit tracker, or sign up for a new one. The default categories (Food, Transport, Shopping, Bills, Health, Entertainment, Other) are added on your first visit.

## Vercel

1. Push this repo to GitHub and import it in Vercel. It detects Vite, so the defaults work (build `npm run build`, output `dist`).
2. In Project Settings > Environment Variables, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Deploy. Then add the Vercel URL to Supabase as in step 2 above.

To install it on your phone, open the site and use "Add to Home Screen".

## Scripts

```bash
npm run dev     # start dev server
npm run build   # production build
npm run lint
npm test        # run unit tests
```

## How a few things work

- **Recurring expenses** are added by the app, not by the database. When you open the app on or after a rule's day, it adds that month's expense once. If you skip a whole month without opening the app, that month is not filled in. The unique `(recurring_id, date)` constraint stops duplicates when two devices open at the same time.
- **Payday periods**: with the month starting on the 25th, "September 2026" means 25 Sep - 24 Oct. Recurring expenses still use the calendar day of the month.
- **Offline**: expenses and income are cached per month on the device, and changes made offline wait in a queue (localStorage) until the connection is back. Categories, budgets, recurring rules and settings need a connection to change.

