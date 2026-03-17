-- LexiLearn schema addons: announcements
-- Run in Supabase SQL Editor if these tables are missing.

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "announcements_teacher_manage" on public.announcements;
create policy "announcements_teacher_manage"
on public.announcements
for all
using (
  classroom_id in (
    select id from public.classrooms
    where teacher_id = auth.uid()
  )
)
with check (
  classroom_id in (
    select id from public.classrooms
    where teacher_id = auth.uid()
  )
);

drop policy if exists "announcements_student_select" on public.announcements;
create policy "announcements_student_select"
on public.announcements
for select
using (
  classroom_id in (
    select classroom_id
    from public.classroom_members
    where student_id = auth.uid()
      and status = 'active'
  )
);

