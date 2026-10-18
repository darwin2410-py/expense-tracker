# Expense Tracker

Simple expense tracker built with React, Vite and Supabase. Installable as a PWA. Same setup as the habit tracker.

Features: add, edit and delete expenses (amount in IDR, category, note, date), default categories plus your own, monthly total with a breakdown per category, expenses grouped by day, dark mode.

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

1. Open the SQL editor in Supabase and run `supabase/create_tables.sql`. It creates:

   | Table | Columns |
   | --- | --- |
   | `expense_categories` | `id`, `user_id`, `name`, `color`, `created_at` |
   | `expenses` | `id`, `user_id`, `amount`, `category_id`, `note`, `date`, `created_at` |

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
