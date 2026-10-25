-- Laminate Talk: üyelerin ilerleme kaydı (Supabase > SQL Editor > New query > yapıştır > Run)
create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.progress enable row level security;
-- Her üye sadece kendi kaydını görür ve değiştirir
create policy "kendi kaydini oku" on public.progress for select using (auth.uid() = user_id);
create policy "kendi kaydini ekle" on public.progress for insert with check (auth.uid() = user_id);
create policy "kendi kaydini guncelle" on public.progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
