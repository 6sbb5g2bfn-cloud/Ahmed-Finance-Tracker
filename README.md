# Finance Tracker

A personal finance app — accounts, transactions, recurring bills, installments,
debts, budgets, savings goals, assets (gold/property/stocks), a dashboard, and
reports. This is the standalone version of the Claude artifact: same design,
same business logic, real persistent storage.

## Stack, and why

- **Frontend: Vite + React.** This app is a single authenticated personal
  tool with no public pages and nothing to be indexed by search engines, so
  Next.js's server-rendering machinery would add complexity without buying
  anything. Vite gives a plain client-side build that runs anywhere.
- **Backend: Supabase (Postgres + Auth).** Real relational storage, with
  Row Level Security so every row is locked to the user who owns it — no
  backend server for you to write or host. `supabase-js` talks to Postgres
  straight from the browser.
- **Hosting: Vercel.** Zero-config static hosting for a Vite build, connects
  directly to a GitHub repo, free tier is enough for personal use.

## What you get in this folder

```
finance-tracker/
├── supabase/schema.sql   <- run this once in your Supabase project
├── src/                  <- the app (screens, components, lib)
├── package.json
└── .env.example          <- copy to .env.local and fill in
```

---

## Setup — do these in order

### 1. Create a Supabase project
1. Go to https://supabase.com → sign up / sign in → **New project**.
2. Pick a name, a database password (save it somewhere), and a region.
3. Wait ~2 minutes for it to provision.

### 2. Run the database schema
1. In your Supabase project, open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this folder, copy the whole file, paste
   it into the editor, and click **Run**.
3. This creates all 9 tables (accounts, transactions, categories, recurring
   payments, installments, debts, budgets, savings goals, assets) plus a
   settings table, and turns on Row Level Security so each signed-in user
   only ever sees their own rows.

### 3. Get your API credentials
1. In Supabase: **Project Settings** → **API**.
2. Copy the **Project URL** and the **anon / public** key (not the
   `service_role` key — that one must never go in a frontend app).

### 4. Configure the app
```bash
cd finance-tracker
cp .env.example .env.local
```
Open `.env.local` and paste in your two values:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 5. Install and run locally
```bash
npm install
npm run dev
```
Open the URL it prints (usually `http://localhost:5173`). Create an
account (email + password) on the sign-up screen — this is your own account
in your own database, nobody else can see it.

> By default Supabase requires email confirmation before first sign-in.
> For personal use you can turn this off: **Authentication** → **Providers**
> → **Email** → disable "Confirm email". Otherwise, check your inbox for
> the confirmation link after signing up.

Once signed in, go to **Settings → Load sample data** if you want the same
realistic demo data the artifact shipped with, or just start adding your
own accounts and transactions.

---

## Deploy it for real (so you can open it from your iPhone)

### 6. Push to GitHub
```bash
cd finance-tracker
git init
git add .
git commit -m "Finance tracker"
```
Create a new empty repo on https://github.com/new, then:
```bash
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git branch -M main
git push -u origin main
```
(`.env.local` is already in `.gitignore` — your Supabase keys won't be committed.
The anon key is safe to expose publicly anyway; Row Level Security is what
actually protects your data, not keeping this key secret.)

### 7. Deploy on Vercel
1. Go to https://vercel.com → sign in with GitHub → **Add New... → Project**.
2. Import the repo you just pushed. Vercel auto-detects Vite — leave the
   build settings as-is.
3. Before deploying, add the same two environment variables from your
   `.env.local`: **Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**. In under a minute you'll have a real URL like
   `https://your-app.vercel.app`.

### 8. Use it from your iPhone
1. Open your `vercel.app` URL in **Safari** on your iPhone.
2. Tap the **Share** button → **Add to Home Screen**.
3. It now opens full-screen with no browser address bar, like a normal app.

Every future `git push` to `main` auto-deploys a new version — that's the
whole update workflow.

---

## Notes on what's real vs. simplified

- Every balance, budget %, installment/debt remaining, and net-worth figure
  is computed live from the raw rows in Postgres — nothing is hardcoded or
  cached in a way that can drift.
- Payment history (installment payments, debt payments, savings
  contributions, which recurring occurrences have been posted) is stored as
  a JSON array on the parent row rather than as separate tables. For data at
  personal-finance scale this is simpler and just as correct as a full join
  table; the core ledger (`transactions`) is a proper indexed table since
  that's the one that actually grows large and gets filtered/sorted.
- Auth is email + password via Supabase Auth. If you want Google/Apple
  sign-in later, that's a Supabase dashboard toggle plus a few lines in
  `src/screens/Auth.jsx` — not a redesign.
- This was written and syntax-checked without a live Supabase project or a
  real `npm install` (the environment it was built in has no network
  access), so give it a real run-through after step 5 before you rely on it
  — check the browser console if anything looks off, and the error will
  usually name the exact table or field.
