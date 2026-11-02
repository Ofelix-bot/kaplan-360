-- The finder's subject strength, industry recognition and Singapore recognition badges (lib/finder/criteria.ts),
-- loaded by scripts/data/load-finder-standing.mjs from data/raw/subject-strength.json, qs-employer-2027.json,
-- compass-top-tier.json and professional-badges.json. Read-only for the site.

-- QS by Subject 2026 (rank as published, a band past 50; Employer reputation) and ShanghaiRanking GRAS 2025 per
-- university and discipline. *_value is the rank's first number, for sorting.
create table public.institution_subject_standing (
  institution_id text not null references public.institutions (id) on delete cascade,
  discipline_id text not null references public.disciplines (id) on delete cascade,
  qs_rank text,
  qs_rank_value integer,
  qs_subject text,
  gras_rank text,
  gras_rank_value integer,
  employer_score numeric(4, 1),
  employer_rank text,
  employer_subject text,
  primary key (institution_id, discipline_id)
);
create index institution_subject_standing_discipline_idx on public.institution_subject_standing (discipline_id);

-- University-wide QS WUR 2027 Employer Reputation, and MOM's COMPASS C2 top-tier listing: group A (every faculty) or
-- B (the faculties named, as [{name, agency, disciplines}]).
alter table public.institutions
  add column qs_employer_score numeric(4, 1),
  add column qs_employer_rank text,
  add column compass_group text check (compass_group in ('A', 'B')),
  add column compass_faculties jsonb;

-- Singapore professional recognition this master's itself counts toward.
create table public.programme_badges (
  programme_id text not null references public.programmes (id) on delete cascade,
  kind text not null check (kind in ('psychology', 'accounting', 'law')),
  body text not null,
  note text not null,
  url text not null,
  primary key (programme_id, kind, body)
);

-- One row: the sources behind the tables above (titles, links, retrieval dates, the badge rules).
create table public.finder_standing_sources (
  id text primary key,
  sources jsonb not null,
  built_at date not null
);

alter table public.institution_subject_standing enable row level security;
alter table public.programme_badges enable row level security;
alter table public.finder_standing_sources enable row level security;
revoke all on public.institution_subject_standing from anon, authenticated;
revoke all on public.programme_badges from anon, authenticated;
revoke all on public.finder_standing_sources from anon, authenticated;
grant select on public.institution_subject_standing to anon, authenticated;
grant select on public.programme_badges to anon, authenticated;
grant select on public.finder_standing_sources to anon, authenticated;
create policy institution_subject_standing_public_read on public.institution_subject_standing for select to anon, authenticated using (true);
create policy programme_badges_public_read on public.programme_badges for select to anon, authenticated using (true);
create policy finder_standing_sources_public_read on public.finder_standing_sources for select to anon, authenticated using (true);
