-- Career requirements from two sources (decided 2026-10-18):
--   Skills Framework (SWDA): skill titles and proficiency levels only, with attribution and a link
--     (its terms bar reproducing content without written permission; descriptions are not kept);
--   O*NET 31.0 (USDOL/ETA, CC BY 4.0): skills with importance and level ratings, and software.
-- careers.summary holds the O*NET occupation description, credited on the page.

alter table public.career_requirements drop constraint career_requirements_kind_check;
alter table public.career_requirements
  add constraint career_requirements_kind_check check (kind in ('technical', 'critical-core', 'skill', 'software')),
  add column proficiency_level smallint,       -- Skills Framework level (1–6)
  add column importance numeric(4, 2),         -- O*NET importance (1–5)
  add column rating_level numeric(4, 2),       -- O*NET level (0–7)
  add column in_demand boolean,                -- O*NET software flagged "In Demand"
  add column occupation_code text;             -- O*NET-SOC code the rating belongs to

-- The same title can come from both sources ("Project Management"): the key includes the source.
alter table public.career_requirements drop constraint career_requirements_pkey;
alter table public.career_requirements alter column source_id set not null;
alter table public.career_requirements add primary key (career_id, source_id, kind, requirement);

alter table public.careers add column summary_source_id text references public.sources (id);
create index careers_summary_source_id_idx on public.careers (summary_source_id);
