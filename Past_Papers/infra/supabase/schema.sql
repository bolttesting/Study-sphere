-- Supabase schema for StudySphere
-- Run in Supabase SQL editor

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name text not null default '',
  last_name text not null default '',
  role text not null check (role in ('Student', 'Admin')),
  class_name text check (class_name in ('9th', '10th')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  class_name text not null check (class_name in ('9th', '10th')),
  file_path text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.past_papers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  class_name text not null check (class_name in ('9th', '10th')),
  year text not null,
  exam_type text not null default 'Board',
  file_path text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Chat',
  mode text not null default 'GENERAL' check (mode in ('GENERAL', 'RAG')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.student_queries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  student_email text not null,
  class_name text check (class_name in ('9th', '10th')),
  question text not null,
  spider_result text not null default '',
  admin_answer text not null default '',
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notes_class_subject on public.notes(class_name, subject);
create index if not exists idx_past_papers_class_subject on public.past_papers(class_name, subject);
create index if not exists idx_sessions_user_updated on public.chat_sessions(user_id, updated_at desc);
create index if not exists idx_queries_status_created on public.student_queries(status, created_at desc);

alter table public.profiles enable row level security;
alter table public.notes enable row level security;
alter table public.past_papers enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.student_queries enable row level security;

-- Profiles
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
for select using (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update using (id = auth.uid());

-- Notes/Papers readable by authenticated users; mutable by Admin only.
drop policy if exists notes_select_auth on public.notes;
create policy notes_select_auth on public.notes
for select using (auth.uid() is not null);

drop policy if exists notes_admin_mutation on public.notes;
create policy notes_admin_mutation on public.notes
for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Admin')
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Admin')
);

drop policy if exists papers_select_auth on public.past_papers;
create policy papers_select_auth on public.past_papers
for select using (auth.uid() is not null);

drop policy if exists papers_admin_mutation on public.past_papers;
create policy papers_admin_mutation on public.past_papers
for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Admin')
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Admin')
);

-- Sessions/messages owned by user.
drop policy if exists sessions_owner_only on public.chat_sessions;
create policy sessions_owner_only on public.chat_sessions
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists messages_owner_only on public.chat_messages;
create policy messages_owner_only on public.chat_messages
for all using (
  exists (
    select 1 from public.chat_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.chat_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  )
);

-- Student queries: student can create/read own; admin can read/resolve all.
drop policy if exists queries_student_select on public.student_queries;
create policy queries_student_select on public.student_queries
for select using (
  student_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Admin')
);

drop policy if exists queries_student_insert on public.student_queries;
create policy queries_student_insert on public.student_queries
for insert with check (student_id = auth.uid());

drop policy if exists queries_admin_update on public.student_queries;
create policy queries_admin_update on public.student_queries
for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Admin')
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Admin')
);

-- Storage buckets
insert into storage.buckets (id, name, public)
values ('notes', 'notes', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('past-papers', 'past-papers', false)
on conflict (id) do nothing;
