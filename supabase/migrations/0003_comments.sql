-- LexiLearn schema addons: comments (submission discussion)
-- Run in Supabase SQL Editor if table is missing.

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

-- Student can read/write comments on their own submissions
drop policy if exists "comments_student_crud_own" on public.comments;
create policy "comments_student_crud_own"
on public.comments
for all
using (
  submission_id in (
    select s.id from public.submissions s
    where s.student_id = auth.uid()
  )
)
with check (
  submission_id in (
    select s.id from public.submissions s
    where s.student_id = auth.uid()
  )
  and user_id = auth.uid()
);

-- Teacher can read/write comments for submissions in their classrooms
drop policy if exists "comments_teacher_crud_class" on public.comments;
create policy "comments_teacher_crud_class"
on public.comments
for all
using (
  submission_id in (
    select s.id
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    join public.classrooms c on c.id = a.classroom_id
    where c.teacher_id = auth.uid()
  )
)
with check (
  submission_id in (
    select s.id
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    join public.classrooms c on c.id = a.classroom_id
    where c.teacher_id = auth.uid()
  )
  and user_id = auth.uid()
);

