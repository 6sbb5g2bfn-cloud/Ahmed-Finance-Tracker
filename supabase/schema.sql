-- ============================================================================
-- Finance Tracker — Supabase schema
--
-- How to use: open your Supabase project -> SQL Editor -> New query,
-- paste this whole file, and click "Run". It is safe to run once on a
-- fresh project. Every table is scoped to auth.uid() via Row Level
-- Security, so each signed-in user only ever sees their own rows.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ACCOUNTS
-- ---------------------------------------------------------------------------
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'bank',
  initial_balance numeric not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CATEGORIES
-- ---------------------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('expense', 'income', 'both')),
  icon text not null default 'Tag',
  core boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- TRANSACTIONS  (the core ledger — everything else derives from this)
-- ---------------------------------------------------------------------------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('expense', 'income', 'transfer')),
  amount numeric not null check (amount > 0),
  category_id uuid references categories(id) on delete set null,
  account_id uuid not null references accounts(id) on delete cascade,
  to_account_id uuid references accounts(id) on delete set null,
  date date not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_date_idx on transactions (user_id, date desc);
create index if not exists transactions_account_idx on transactions (account_id);

-- ---------------------------------------------------------------------------
-- RECURRING PAYMENTS  (subscriptions, bills, fixed commitments — one shape)
-- ---------------------------------------------------------------------------
create table if not exists recurring_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  commitment_type text not null default 'subscription',
  amount numeric not null,
  frequency text not null default 'monthly',
  start_date date not null,
  end_date date,
  category_id uuid references categories(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  active boolean not null default true,
  posted_dates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- INSTALLMENTS
-- ---------------------------------------------------------------------------
create table if not exists installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  total_amount numeric not null,
  monthly_payment numeric not null,
  number_of_payments int not null,
  start_date date not null,
  category_id uuid references categories(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  payments jsonb not null default '[]'::jsonb,  -- [{id, date, amount}]
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- DEBTS  (money owed either direction)
-- ---------------------------------------------------------------------------
create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('owe', 'owed')),
  person text not null,
  amount numeric not null,
  date date not null,
  due_date date,
  notes text not null default '',
  status text not null default 'open',
  payments jsonb not null default '[]'::jsonb,  -- [{id, date, amount, accountId}]
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- BUDGETS  (one per category)
-- ---------------------------------------------------------------------------
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  amount numeric not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SAVINGS GOALS
-- ---------------------------------------------------------------------------
create table if not exists savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target numeric not null,
  target_date date,
  account_id uuid references accounts(id) on delete set null,
  contributions jsonb not null default '[]'::jsonb,  -- [{id, date, amount, accountId}]
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ASSETS  (gold, property, stocks, other holdings — mark-to-market)
-- ---------------------------------------------------------------------------
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'other',
  current_value numeric not null,
  cost_basis numeric not null default 0,
  purchase_date date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- USER SETTINGS  (one row per user — currency, theme)
-- ---------------------------------------------------------------------------
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'SAR',
  theme text not null default 'light',
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY — every table is locked to its owner's rows only.
-- ============================================================================
alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table recurring_payments enable row level security;
alter table installments enable row level security;
alter table debts enable row level security;
alter table budgets enable row level security;
alter table savings_goals enable row level security;
alter table assets enable row level security;
alter table user_settings enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'accounts','categories','transactions','recurring_payments',
    'installments','debts','budgets','savings_goals','assets'
  ])
  loop
    execute format('drop policy if exists "owner_select" on %I', t);
    execute format('drop policy if exists "owner_insert" on %I', t);
    execute format('drop policy if exists "owner_update" on %I', t);
    execute format('drop policy if exists "owner_delete" on %I', t);
    execute format('create policy "owner_select" on %I for select using (auth.uid() = user_id)', t);
    execute format('create policy "owner_insert" on %I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "owner_update" on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "owner_delete" on %I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

drop policy if exists "owner_select" on user_settings;
drop policy if exists "owner_upsert" on user_settings;
drop policy if exists "owner_update_settings" on user_settings;
create policy "owner_select" on user_settings for select using (auth.uid() = user_id);
create policy "owner_upsert" on user_settings for insert with check (auth.uid() = user_id);
create policy "owner_update_settings" on user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Done. Every table above requires a signed-in user (auth.uid()) that
-- matches the row's user_id for every operation — there is no way for
-- one user to read or write another user's data through this schema.
