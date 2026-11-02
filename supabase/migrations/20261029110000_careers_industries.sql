-- /careers by industry (plan §2.1, build-spec §3): Skills Framework sectors linked to Kaplan degrees, their
-- entry and early-career roles, module → skill links, and every receipted figure. Loaded by
-- `npm run data:load -- --only=careers` from data/raw/careers-*.json (scripts/careers/build-careers-data.mjs).
-- Natural text ids, every foreign key indexed, RLS on, public read-only; writes go through the service role only.
-- The older careers* tables stay as they are.

-- 16 Skills Framework sectors linked to at least one Kaplan degree (Q23).
create table public.career_industries (
  id text primary key,                       -- slug, e.g. 'financial-services' (lib/careers/industries.ts)
  sector text not null,                      -- Skills Framework sector name, as published
  short text not null check (char_length(short) <= 30),
  sf_role_total smallint not null,           -- roles the Skills Framework lists for the sector
  entry_role_count smallint not null,        -- Kaplan 360++'s rule: entry and early-career roles (career_roles rows)
  mom_industry text,                         -- one of MOM's 14 Occupational Wages industry groups, as printed
  mom_basis text not null,                   -- "Kaplan 360++'s mapping: …", incl. a group shared with other sectors
  mom_wage_sheet text,                       -- the OWT Table 4 sheet pay is compared within, e.g. 'T4.7'
  jobstreet_industries text[] not null default '{}',
  jobstreet_basis text,
  sort_order smallint not null
);

-- Degree → industry, each with its basis (Q9).
create table public.career_degree_industries (
  programme_id text not null references public.kaplan_programmes (id),
  industry_id text not null references public.career_industries (id) on delete cascade,
  basis text not null,
  shared_skills text[] not null default '{}',
  primary key (programme_id, industry_id)
);
create index career_degree_industries_industry_idx on public.career_degree_industries (industry_id);

-- Roles (Q24): one row per Skills Framework role, parenthesised variants folded in.
create table public.career_roles (
  id text primary key,                       -- slug; '-<industry>' suffix only when a title repeats across sectors
  industry_id text not null references public.career_industries (id) on delete cascade,
  title text not null,                       -- SF title as published (variant suffix folded into variants)
  short text not null check (char_length(short) <= 30),
  track text not null,
  tier text not null check (tier in ('entry', 'early-career')),
  mean_proficiency numeric(3, 2) not null,
  variants text[] not null default '{}',     -- '(Corporate Banking)', '(Insurance)', …
  ssoc_code text,                            -- MOM occupation joined to the role
  ssoc_basis text,                           -- "Kaplan 360++'s match: …" or the same-title sentence; null when none
  mom_needs boolean not null default false,  -- per-industry JV 2025 rank or the COMPASS SOL (never the all-industry top 10)
  high_pay boolean not null default false,   -- median in the top 25% of the industry's wage table (Kaplan 360++'s rule)
  hot boolean generated always as (mom_needs or high_pay) stored,
  high_pay_rule text,                        -- "Kaplan 360++'s rule: …" when high_pay
  search_term text,                          -- for the openings check
  search_scope text,
  sort_order smallint not null,
  redirect_from text[] not null default '{}' -- old /careers/<slug> ids that 308 here
);
create index career_roles_industry_idx on public.career_roles (industry_id);

create table public.career_role_skills (
  role_id text not null references public.career_roles (id) on delete cascade,
  skill text not null,                       -- SF technical skill title
  level smallint not null check (level between 1 and 6),
  key boolean not null,                      -- one of the role's key skills (m in "n of m")
  sort_order smallint not null,
  primary key (role_id, skill)
);

-- Module → skill links (Q22). basis 'rule' = map.json, 'claude' = map-api.json (Kaplan 360++'s reading).
create table public.career_degree_skills (
  programme_id text not null references public.kaplan_programmes (id),
  skill text not null,
  module text not null,
  module_kind text not null check (module_kind in ('core', 'elective')),
  basis text not null check (basis in ('rule', 'claude')),
  model text,                                -- 'claude-opus-5-5' for basis 'claude'
  primary key (programme_id, skill, module, basis)
);
create index career_degree_skills_skill_idx on public.career_degree_skills (skill);

-- Every receipted figure: MOM rows, wages, vacancy ranks, SOL, Jobstreet ad salaries, government, consultancy,
-- platform and regional facts. One shape, so one receipt model (lib/receipts/model.ts fromFact).
create table public.career_facts (
  id text primary key,                       -- the collector's id: 'mom-owt25-t4-6-25245', 'macro-169', 'lab-jsad-191'
  kind text not null check (kind in ('stat', 'wage', 'ad-salary', 'vacancy-rank', 'sol', 'entry-vacancy')),
  industry_id text references public.career_industries (id),   -- null = cross-industry or shared by several
  source_industry text,                      -- the publisher's own industry label
  metric text not null,
  value text not null,                       -- as printed
  value_num numeric,
  figures jsonb,                             -- {p25,median,p75} | {low,high} | {rank,rank2024,vacancies}
  unit text,
  period text,
  region text not null default 'singapore' check (region in ('singapore', 'asia-pacific', 'global')),
  region_label text,                         -- as printed: 'Southeast Asia', 'Global', …
  quote text not null,
  quote_kind text not null check (quote_kind in ('sentence', 'table-row', 'table-text', 'table-image', 'xlsx-row', 'chart-label', 'infographic-label')),
  quote_columns text,
  mark text[] not null default '{}',         -- words in the quote to highlight (the value)
  source_kind text not null check (source_kind in ('official', 'report', 'platform')),
  publisher text not null,
  title text not null,
  published text,                            -- as printed
  published_on date,                         -- when an exact date can be read from it
  url text not null,
  alt_url text,                              -- the API or data.gov.sg row, where one exists
  licence text,
  page smallint,
  where_ref text,                            -- 'Table 3, p. 20' | 'Sheet T4.6, row 44'
  sample text,
  note text,
  read_on date not null,
  verified_by text not null check (verified_by in ('text-match', 'row-rebuilt', 'page-image')),
  -- C4: a figure read from a page image never claims a word-for-word match.
  constraint career_facts_image_read check (quote_kind not in ('table-image', 'chart-label', 'infographic-label') or verified_by = 'page-image')
);
create index career_facts_industry_idx on public.career_facts (industry_id);
create index career_facts_kind_idx on public.career_facts (kind);

create table public.career_role_facts (
  role_id text not null references public.career_roles (id) on delete cascade,
  fact_id text not null references public.career_facts (id) on delete cascade,
  use text not null check (use in ('mom-needs-jv', 'mom-needs-sol', 'wage', 'ad-salary', 'entry-vacancy', 'trend')),
  basis text,                                -- "Kaplan 360++'s match: …" for joins that are not the same title
  primary key (role_id, fact_id, use)
);
create index career_role_facts_fact_idx on public.career_role_facts (fact_id);

-- The up-to-4 stats of "<Industry> now", per region (Q12, Q17, C3, C4). Missing slots stay missing.
create table public.career_industry_now (
  industry_id text not null references public.career_industries (id) on delete cascade,
  region text not null check (region in ('singapore', 'asia-pacific', 'global')),
  slot smallint not null check (slot between 1 and 4),
  fact_id text not null references public.career_facts (id),
  label text not null check (char_length(label) <= 30),
  primary key (industry_id, region, slot)
);
create index career_industry_now_fact_idx on public.career_industry_now (fact_id);

-- Openings for hot roles on employers' own careers sites (Q26), only employers that were checked.
create table public.career_role_employers (
  role_id text not null references public.career_roles (id) on delete cascade,
  employer_id text not null,
  company text not null,
  company_lists text[] not null default '{}',
  careers_url text,
  search_url text,
  openings integer not null default 0,
  status text not null check (status in ('ok', 'no-listing', 'failed')),
  checked_on date not null,
  primary key (role_id, employer_id)
);

-- Access: RLS on, public read-only, writes through the service role only (as initial_schema.sql).
do $$
declare t text;
begin
  foreach t in array array['career_industries', 'career_degree_industries', 'career_roles', 'career_role_skills',
    'career_degree_skills', 'career_facts', 'career_role_facts', 'career_industry_now', 'career_role_employers'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_public_read', t);
  end loop;
end $$;
