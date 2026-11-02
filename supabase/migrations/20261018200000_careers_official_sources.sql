-- Careers come from official open data instead of job postings (decided 2026-10-18 after reading
-- MyCareersFuture's terms of use, which bar reproducing or deriving from its content):
--   pay: MOM Occupational Wage Tables (median monthly wages by SSOC occupation);
--   requirements: the Skills Framework (government-published job role skills);
--   companies: names (no logos) from each employer's own careers page.
-- The job-posting tables were never filled; they are dropped.

drop table if exists public.posting_requirements;
drop table if exists public.job_postings;

-- One career maps to one or more SSOC 2024 occupations; the first (sort_order 1) is the headline.
create table public.career_occupations (
  career_id text not null references public.careers (id) on delete cascade,
  ssoc_code text not null,
  occupation text not null,
  median_basic_wage numeric(10, 2),
  median_gross_wage numeric(10, 2),
  reference_period text not null,       -- e.g. "June 2025"
  source_id text not null references public.sources (id),
  sort_order smallint not null default 1,
  primary key (career_id, ssoc_code)
);
create index career_occupations_source_id_idx on public.career_occupations (source_id);

-- Requirements are listed by the official framework, not counted from postings.
alter table public.career_requirements
  drop column postings_with,
  drop column postings_total,
  add column kind text not null default 'technical' check (kind in ('technical', 'critical-core')),
  add column framework_job_role text,
  add column source_id text references public.sources (id),
  add column sort_order smallint;
create index career_requirements_source_id_idx on public.career_requirements (source_id);

alter table public.career_companies
  drop column postings,
  add column retrieved_at date;

alter table public.career_occupations enable row level security;
revoke all on public.career_occupations from anon, authenticated;
grant select on public.career_occupations to anon, authenticated;
create policy career_occupations_public_read on public.career_occupations for select to anon, authenticated using (true);
