-- LexiLearn Supabase RLS Policies
-- Run this in Supabase SQL Editor (in order).
-- Assumption: auth.uid() maps to public.profiles.id

-- =========================
-- 1) PROFILES
-- =========================
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

-- =========================
-- 2) CLASSROOMS / MEMBERS
-- =========================
alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;

drop policy if exists "classrooms_teacher_select_own" on public.classrooms;
create policy "classrooms_teacher_select_own"
on public.classrooms
for select
using (teacher_id = auth.uid());

drop policy if exists "classrooms_teacher_insert" on public.classrooms;
create policy "classrooms_teacher_insert"
on public.classrooms
for insert
with check (teacher_id = auth.uid());

drop policy if exists "classrooms_teacher_update" on public.classrooms;
create policy "classrooms_teacher_update"
on public.classrooms
for update
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "classrooms_teacher_delete" on public.classrooms;
create policy "classrooms_teacher_delete"
on public.classrooms
for delete
using (teacher_id = auth.uid());

drop policy if exists "classroom_members_teacher_manage" on public.classroom_members;
create policy "classroom_members_teacher_manage"
on public.classroom_members
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

drop policy if exists "classroom_members_student_select_own" on public.classroom_members;
create policy "classroom_members_student_select_own"
on public.classroom_members
for select
using (student_id = auth.uid());

-- =========================
-- 3) ASSIGNMENTS / TARGETS
-- =========================
alter table public.assignments enable row level security;
alter table public.assignment_targets enable row level security;

drop policy if exists "assignments_teacher_manage" on public.assignments;
create policy "assignments_teacher_manage"
on public.assignments
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

drop policy if exists "assignments_student_select_targets" on public.assignments;
create policy "assignments_student_select_targets"
on public.assignments
for select
using (
  id in (
    select assignment_id
    from public.assignment_targets
    where student_id = auth.uid()
       or classroom_id in (
         select classroom_id
         from public.classroom_members
         where student_id = auth.uid()
           and status = 'active'
       )
  )
);

drop policy if exists "assignment_targets_teacher_manage" on public.assignment_targets;
create policy "assignment_targets_teacher_manage"
on public.assignment_targets
for all
using (
  -- IMPORTANT: do NOT reference public.assignments here, or it can cause
  -- "infinite recursion detected in policy for relation assignments"
  -- when selecting assignments -> assignment_targets (RLS) -> assignments (RLS).
  classroom_id in (
    select id
    from public.classrooms
    where teacher_id = auth.uid()
  )
)
with check (
  classroom_id in (
    select id
    from public.classrooms
    where teacher_id = auth.uid()
  )
);

drop policy if exists "assignment_targets_student_select_own" on public.assignment_targets;
create policy "assignment_targets_student_select_own"
on public.assignment_targets
for select
using (
  student_id = auth.uid()
  or classroom_id in (
    select classroom_id
    from public.classroom_members
    where student_id = auth.uid()
      and status = 'active'
  )
);

-- =========================
-- 4) SUBMISSIONS / ANSWERS
-- =========================
alter table public.submissions enable row level security;
alter table public.submission_answers enable row level security;

drop policy if exists "submissions_student_crud_own" on public.submissions;
create policy "submissions_student_crud_own"
on public.submissions
for all
using (student_id = auth.uid())
with check (student_id = auth.uid());

drop policy if exists "submissions_teacher_select_class" on public.submissions;
create policy "submissions_teacher_select_class"
on public.submissions
for select
using (
  assignment_id in (
    select a.id
    from public.assignments a
    join public.classrooms c on c.id = a.classroom_id
    where c.teacher_id = auth.uid()
  )
);

drop policy if exists "submission_answers_student_crud_own" on public.submission_answers;
create policy "submission_answers_student_crud_own"
on public.submission_answers
for all
using (
  submission_id in (
    select id from public.submissions
    where student_id = auth.uid()
  )
)
with check (
  submission_id in (
    select id from public.submissions
    where student_id = auth.uid()
  )
);

drop policy if exists "submission_answers_teacher_select_class" on public.submission_answers;
create policy "submission_answers_teacher_select_class"
on public.submission_answers
for select
using (
  submission_id in (
    select s.id
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    join public.classrooms  c on c.id = a.classroom_id
    where c.teacher_id = auth.uid()
  )
);

-- =========================
-- 5) DESKS / DESK ITEMS
-- =========================
alter table public.desks enable row level security;
alter table public.desk_items enable row level security;

drop policy if exists "desks_student_crud_own" on public.desks;
create policy "desks_student_crud_own"
on public.desks
for all
using (student_id = auth.uid())
with check (student_id = auth.uid());

drop policy if exists "desk_items_student_crud_own" on public.desk_items;
create policy "desk_items_student_crud_own"
on public.desk_items
for all
using (
  desk_id in (
    select id from public.desks
    where student_id = auth.uid()
  )
)
with check (
  desk_id in (
    select id from public.desks
    where student_id = auth.uid()
  )
);

-- =========================
-- 6) MATERIAL FOLDERS / MATERIALS
-- =========================
alter table public.material_folders enable row level security;
alter table public.materials enable row level security;

drop policy if exists "material_folders_teacher_manage" on public.material_folders;
create policy "material_folders_teacher_manage"
on public.material_folders
for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "materials_teacher_manage" on public.materials;
create policy "materials_teacher_manage"
on public.materials
for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "materials_student_select_by_class" on public.materials;
create policy "materials_student_select_by_class"
on public.materials
for select
using (
  visibility_scope = 'public'
  or folder_id in (
    select mf.id
    from public.material_folders mf
    where mf.classroom_id in (
      select classroom_id
      from public.classroom_members
      where student_id = auth.uid()
        and status = 'active'
    )
  )
);

-- =========================
-- 7) STUDY EVENTS / SNAPSHOTS / NOTIFICATIONS
-- =========================
alter table public.study_events enable row level security;
alter table public.progress_snapshots enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "study_events_user_crud_own" on public.study_events;
create policy "study_events_user_crud_own"
on public.study_events
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "progress_snapshots_user_select_own" on public.progress_snapshots;
create policy "progress_snapshots_user_select_own"
on public.progress_snapshots
for select
using (user_id = auth.uid());

drop policy if exists "notifications_user_crud_own" on public.notifications;
create policy "notifications_user_crud_own"
on public.notifications
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

