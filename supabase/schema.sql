-- ============================================================================
-- Schéma Supabase — Budget MGA Dashboard
-- Phase 1 : Fondations données
-- ============================================================================
-- À exécuter dans Supabase Studio → SQL Editor (ou via `supabase db push`).
-- Chaque table est isolée par utilisateur via `user_id` + Row Level Security.
-- Les colonnes `deleted_at` / `updated_at` préparent la synchro offline-first
-- (phase 3) : on ne supprime jamais physiquement une ligne tant qu'elle n'a
-- pas été synchronisée partout (soft delete = "tombstone").
-- ============================================================================

create extension if not exists "pgcrypto"; -- pour gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Fonction utilitaire : met à jour updated_at automatiquement
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- Table : transactions
-- ============================================================================
create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null,
  description  text not null,
  category     text not null,
  type         text not null check (type in ('Revenu', 'Dépense')),
  amount       numeric(14, 2) not null check (amount >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_date_idx on public.transactions (date);
create index if not exists transactions_updated_at_idx on public.transactions (updated_at);

drop trigger if exists set_updated_at on public.transactions;
create trigger set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own" on public.transactions
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- Table : budget_lines
-- ============================================================================
create table if not exists public.budget_lines (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  category        text not null,
  month           smallint not null check (month between 1 and 12),
  year            smallint not null default extract(year from now()),
  planned_amount  numeric(14, 2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (user_id, category, month, year)
);

create index if not exists budget_lines_user_id_idx on public.budget_lines (user_id);
create index if not exists budget_lines_period_idx on public.budget_lines (year, month);

drop trigger if exists set_updated_at on public.budget_lines;
create trigger set_updated_at
  before update on public.budget_lines
  for each row execute function public.set_updated_at();

alter table public.budget_lines enable row level security;

drop policy if exists "budget_lines_select_own" on public.budget_lines;
create policy "budget_lines_select_own" on public.budget_lines
  for select using (auth.uid() = user_id);

drop policy if exists "budget_lines_insert_own" on public.budget_lines;
create policy "budget_lines_insert_own" on public.budget_lines
  for insert with check (auth.uid() = user_id);

drop policy if exists "budget_lines_update_own" on public.budget_lines;
create policy "budget_lines_update_own" on public.budget_lines
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "budget_lines_delete_own" on public.budget_lines;
create policy "budget_lines_delete_own" on public.budget_lines
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- Table : savings_goals
-- ============================================================================
create table if not exists public.savings_goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  target_amount   numeric(14, 2) not null check (target_amount >= 0),
  current_amount  numeric(14, 2) not null default 0,
  monthly_contribution numeric(14, 2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- Si la table existait déjà avant cette évolution (simulateur what-if / projections),
-- ajouter la colonne manuellement :
-- alter table public.savings_goals add column if not exists monthly_contribution numeric(14, 2) not null default 0;

create index if not exists savings_goals_user_id_idx on public.savings_goals (user_id);

drop trigger if exists set_updated_at on public.savings_goals;
create trigger set_updated_at
  before update on public.savings_goals
  for each row execute function public.set_updated_at();

alter table public.savings_goals enable row level security;

drop policy if exists "savings_goals_select_own" on public.savings_goals;
create policy "savings_goals_select_own" on public.savings_goals
  for select using (auth.uid() = user_id);

drop policy if exists "savings_goals_insert_own" on public.savings_goals;
create policy "savings_goals_insert_own" on public.savings_goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "savings_goals_update_own" on public.savings_goals;
create policy "savings_goals_update_own" on public.savings_goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "savings_goals_delete_own" on public.savings_goals;
create policy "savings_goals_delete_own" on public.savings_goals
  for delete using (auth.uid() = user_id);
