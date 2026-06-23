# Herbal Consignment

React + Supabase app for tracking herbal consignment stock, sales, payments, expenses, and monthly reports.

## Setup

```bash
npm install
cp .env.example .env
```

Fill `.env`:

```text
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Use the base project URL only, without `/rest/v1/`.

In Supabase, run `supabase/schema.sql` in the SQL editor once. The schema enables RLS so signed-in users only see their own data.

## Run

```bash
npm run dev
```

## Check

```bash
npm test
npm run build
```

## Vercel

Add the same env vars in Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Then deploy the linked `herbal-consignment` project.

## Migration

After signing in, the app checks the old browser key `herbal_consignment_v1`. If old local data exists and Supabase is empty, it offers to import it. JSON backup import/export is still available in the Backup tab.
