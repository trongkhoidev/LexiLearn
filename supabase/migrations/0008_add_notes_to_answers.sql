-- Add student_notes column to exam_answers
ALTER TABLE exam_answers ADD COLUMN IF NOT EXISTS student_notes TEXT;
