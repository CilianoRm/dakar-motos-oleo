-- Execute UMA vez no Supabase. Não execute banco.sql novamente.
-- Acrescenta créditos de folga/férias ao módulo de funcionários.
create table if not exists public.funcionarios_creditos (
 funcionario_id text primary key references public.funcionarios(id) on delete cascade,
 dias integer not null default 0,
 updated_at timestamptz not null default now()
);
alter table public.pontos_funcionarios add column if not exists status text;
alter table public.pontos_funcionarios add column if not exists observacao text;
alter table public.pontos_funcionarios add column if not exists updated_at timestamptz not null default now();
alter table public.funcionarios_creditos enable row level security;
drop policy if exists funcionarios_creditos_select on public.funcionarios_creditos;
create policy funcionarios_creditos_select on public.funcionarios_creditos for select to anon,authenticated using(true);
drop policy if exists funcionarios_creditos_insert on public.funcionarios_creditos;
create policy funcionarios_creditos_insert on public.funcionarios_creditos for insert to anon,authenticated with check(true);
drop policy if exists funcionarios_creditos_update on public.funcionarios_creditos;
create policy funcionarios_creditos_update on public.funcionarios_creditos for update to anon,authenticated using(true) with check(true);
