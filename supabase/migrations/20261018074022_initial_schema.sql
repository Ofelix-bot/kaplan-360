-- Kaplan 360++ initial schema.
-- Access model: the public site reads with the publishable key (anon role), read-only.
-- The data pipeline writes with the secret key (service_role, which bypasses RLS).
-- Raw job postings and their quotes are service-role only; the site reads aggregates.
-- Natural text ids (slugs) keep pipeline upserts idempotent.

-- Sources ---------------------------------------------------------------------------------

create table public.sources (
  id text primary key,
  kind text not null check (kind in ('website', 'document', 'dataset', 'survey', 'ranking')),
  title text not null,
  url text,
  file_path text,               -- for private documents: path in the source-documents bucket
  publisher text,
  retrieved_at date,
  is_private boolean not null default false,
  notes text
);

-- Disciplines (the 13 areas Kaplan's programmes cover) -------------------------------------

create table public.disciplines (
  id text primary key,
  label text not null
);

-- Institutions ----------------------------------------------------------------------------

create table public.institutions (
  id text primary key,
  name text not null,
  country text,
  qs_id text unique,
  qs_rank text,                 -- as published, e.g. "=100" or "1001-1200"
  qs_rank_value integer,        -- first number of qs_rank, for sorting
  qs_url text,
  kaggle_names text[] not null default '{}',
  kaggle_sources text[] not null default '{}',
  kaplan_partner boolean not null default false,
  student_pass boolean,         -- partner open to Student's Pass holders (null: not a partner)
  tier smallint not null check (tier in (1, 2)),
  website text,
  postgraduate_url text,
  source_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create index institutions_country_idx on public.institutions (country);
create index institutions_tier_idx on public.institutions (tier) where tier = 1;
create index institutions_qs_rank_value_idx on public.institutions (qs_rank_value);

-- Kaplan Singapore programmes --------------------------------------------------------------

create table public.kaplan_programmes (
  id text primary key,
  name text not null,
  level text not null check (level in ('diploma', 'advanced-diploma', 'top-up', 'bachelor-advanced-standing', 'bachelor-direct-honours')),
  discipline_id text not null references public.disciplines (id),
  awarding_body text not null,
  awarding_body_verified boolean not null default false,
  institution_id text references public.institutions (id),
  student_pass boolean,
  mode text,
  offered_this_intake boolean,
  source_url text not null,
  source_ids text[] not null default '{}'
);
create index kaplan_programmes_discipline_id_idx on public.kaplan_programmes (discipline_id);
create index kaplan_programmes_institution_id_idx on public.kaplan_programmes (institution_id);

-- Facts from Kaplan documents (fees, intakes, waivers, entry requirements, ...) -------------

create table public.kaplan_facts (
  id bigint generated always as identity primary key,
  source_id text not null references public.sources (id),
  page integer,
  institution_id text references public.institutions (id),
  kind text not null check (kind in (
    'intake', 'deadline', 'duration', 'fee', 'fee-waiver', 'entry-requirement', 'bridging',
    'textbooks', 'scholarship', 'refund', 'student-pass', 'orientation', 'graduate-survey',
    'institution', 'employer', 'note'
  )),
  label text not null,
  value jsonb,
  verbatim_quote text,
  valid_from date,
  valid_to date,
  status text not null default 'current' check (status in ('current', 'expired', 'flagged')),
  display boolean not null default true,
  flag text
);
create index kaplan_facts_source_id_idx on public.kaplan_facts (source_id);
create index kaplan_facts_institution_id_idx on public.kaplan_facts (institution_id);
create index kaplan_facts_kind_idx on public.kaplan_facts (kind);

-- Diploma → degree pathways (e.g. Murdoch direct entry) -------------------------------------

create table public.pathways (
  id bigint generated always as identity primary key,
  from_label text not null,     -- as printed in the source (may use older programme names)
  from_programme_id text references public.kaplan_programmes (id),
  to_degree text not null,
  to_institution_id text not null references public.institutions (id),
  bridging_required boolean,
  trending boolean not null default false,
  source_id text not null references public.sources (id),
  page integer
);
create index pathways_from_programme_id_idx on public.pathways (from_programme_id);
create index pathways_to_institution_id_idx on public.pathways (to_institution_id);
create index pathways_source_id_idx on public.pathways (source_id);

-- Postgraduate programmes (from official university pages) ----------------------------------

create table public.programmes (
  id text primary key,
  institution_id text not null references public.institutions (id),
  name text not null,
  degree_type text,             -- MSc, MA, MBA, Master of ..., etc.
  discipline_id text references public.disciplines (id),
  accepts_any_background boolean,  -- conversion programmes
  duration_months numeric(4, 1),
  intakes text[],
  tuition_amount numeric(12, 2),
  tuition_currency text,
  tuition_basis text,           -- total, per year, ...
  tuition_year text,
  ielts_overall numeric(2, 1),
  academic_requirement text,    -- verbatim
  source_url text not null,
  last_verified date not null,
  verification text not null check (verification in ('manual', 'automated')),
  needs_review boolean not null default false,
  extraction_notes text[] not null default '{}'
);
create index programmes_institution_id_idx on public.programmes (institution_id);
create index programmes_discipline_id_idx on public.programmes (discipline_id);

-- One row per extracted field, with the official wording it came from.
create table public.programme_evidence (
  id bigint generated always as identity primary key,
  programme_id text not null references public.programmes (id) on delete cascade,
  field text not null,
  value text,
  verbatim_quote text not null,
  source_url text not null,
  extracted_by text not null check (extracted_by in ('rules', 'claude', 'manual')),
  quote_verified boolean not null default false,  -- quote found verbatim in the fetched page
  retrieved_at date not null
);
create index programme_evidence_programme_id_idx on public.programme_evidence (programme_id);

-- Master's programme ↔ Kaplan programme matches.
create table public.programme_matches (
  programme_id text not null references public.programmes (id) on delete cascade,
  kaplan_programme_id text not null references public.kaplan_programmes (id),
  match_type text not null check (match_type in ('direct', 'conversion')),
  via_degree boolean not null default false,      -- diploma matches go through a Kaplan degree
  reason text,
  evidence_quote text,
  primary key (programme_id, kaplan_programme_id)
);
create index programme_matches_kaplan_programme_id_idx on public.programme_matches (kaplan_programme_id);

-- Careers ---------------------------------------------------------------------------------

create table public.careers (
  id text primary key,
  title text not null,
  discipline_ids text[] not null default '{}',
  summary text,
  median_salary numeric(10, 2),
  median_salary_source_id text references public.sources (id),
  sort_order smallint
);
create index careers_median_salary_source_id_idx on public.careers (median_salary_source_id);

-- Raw postings: service role only (see RLS below).
create table public.job_postings (
  id text primary key,
  career_id text not null references public.careers (id),
  company text not null,
  company_lists text[] not null default '{}',  -- fortune-global-500, linkedin-top-sg, ...
  title text not null,
  location text,
  url text not null,
  source text not null,                       -- mycareersfuture, company-site
  posted_at date,
  retrieved_at date not null,
  salary_min numeric(10, 2),
  salary_max numeric(10, 2),
  salary_period text
);
create index job_postings_career_id_idx on public.job_postings (career_id);

create table public.posting_requirements (
  id bigint generated always as identity primary key,
  posting_id text not null references public.job_postings (id) on delete cascade,
  requirement text not null,      -- normalised skill or qualification
  verbatim_quote text not null
);
create index posting_requirements_posting_id_idx on public.posting_requirements (posting_id);

-- Aggregates the site may read (written by the pipeline).
create table public.career_requirements (
  career_id text not null references public.careers (id) on delete cascade,
  requirement text not null,
  postings_with integer not null,
  postings_total integer not null,
  primary key (career_id, requirement)
);

create table public.career_companies (
  career_id text not null references public.careers (id) on delete cascade,
  company text not null,
  company_lists text[] not null default '{}',
  careers_url text,
  postings integer not null,
  primary key (career_id, company)
);

-- Graduate outcomes (employment surveys) -----------------------------------------------------

create table public.employment_records (
  id text primary key,
  region text not null,
  group_id text not null,
  institution text,
  cohort text not null,
  metric text not null,
  "values" jsonb not null,
  source_id text not null references public.sources (id),
  verbatim_quote text,
  show_on_page boolean not null default true
);
create index employment_records_source_id_idx on public.employment_records (source_id);

-- Access ----------------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'sources', 'disciplines', 'institutions', 'kaplan_programmes', 'kaplan_facts', 'pathways',
    'programmes', 'programme_evidence', 'programme_matches', 'careers', 'job_postings',
    'posting_requirements', 'career_requirements', 'career_companies', 'employment_records'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;

  -- Public, read-only tables.
  foreach t in array array[
    'sources', 'disciplines', 'institutions', 'kaplan_programmes', 'kaplan_facts', 'pathways',
    'programmes', 'programme_evidence', 'programme_matches', 'careers', 'career_requirements',
    'career_companies', 'employment_records'
  ] loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_public_read', t);
  end loop;
end $$;
-- job_postings and posting_requirements: RLS on, no grants, no policies → service role only.

-- Private bucket for source documents (e.g. the Degree Enrolment Day deck).
insert into storage.buckets (id, name, public)
values ('source-documents', 'source-documents', false)
on conflict (id) do nothing;
