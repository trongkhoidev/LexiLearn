-- Ensure we can upsert answers reliably
-- Run in Supabase SQL Editor.

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'uniq_submission_answer_idx'
  ) then
    create unique index uniq_submission_answer_idx
      on public.submission_answers (submission_id, question_index);
  end if;
end $$;

