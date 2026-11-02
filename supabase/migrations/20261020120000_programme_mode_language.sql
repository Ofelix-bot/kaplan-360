-- Hong Kong, Macau and Singapore expansion (2026-10-20): part-time-only programmes are kept and
-- tagged rather than left out, the medium of instruction is recorded, and Kaplan's own
-- Singapore-taught master's are marked so they can be shown first to Kaplan degree students.

alter table public.programmes
  add column study_mode text check (study_mode in ('full-time', 'part-time', 'both')),
  add column teaching_language text,          -- as the page states it: "English", "Chinese", "Chinese and English", "Portuguese" …
  add column delivered_by text;               -- 'kaplan' for master's taught at Kaplan Singapore; null for the university's own campus

comment on column public.programmes.study_mode is 'full-time, part-time or both, from the official page; part-time-only programmes are usually not open to student-visa holders.';
comment on column public.programmes.teaching_language is 'Medium of instruction as written on the official page; null when not stated.';
comment on column public.programmes.delivered_by is 'kaplan when the programme is taught at Kaplan Singapore by a partner university.';
