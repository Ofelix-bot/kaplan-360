-- Employers hiring in Singapore per career, and benefits from official university pages (2026-10-19).

-- career_companies: one row per (career, employer) that was checked, with the number of Singapore
-- openings found on the employer's own careers site. Only names and counts are public.
alter table public.career_companies
  add column openings integer not null default 0,
  add column status text not null default 'ok' check (status in ('ok', 'no-listing', 'failed')),
  add column search_url text,
  add column employer_id text;

-- Benefits for prospective postgraduate students: scholarships, fee reductions, application-fee
-- waivers, application deadlines and events. Every field is backed by a verbatim quote (quotes).
create table public.benefits (
  id text primary key,
  institution_id text not null references public.institutions (id),
  kind text not null check (kind in ('scholarship', 'fee-reduction', 'application-fee-waiver', 'deadline', 'event')),
  title text not null,
  value text,
  amount numeric(12, 2),
  currency text,
  percent numeric(5, 2),
  for_international boolean,
  postgraduate_taught boolean,
  automatic boolean,
  intake text,
  deadline date,
  event_date date,
  format text,
  disciplines text,
  eligibility text,
  quotes jsonb not null default '{}',
  source_url text not null,
  retrieved_at date not null,
  -- Drafted by Claude from the quotes only, at build time; reviewed before display.
  checklist jsonb,
  checklist_model text,
  display boolean not null default true
);
create index benefits_institution_id_idx on public.benefits (institution_id);

alter table public.benefits enable row level security;
revoke all on public.benefits from anon, authenticated;
grant select on public.benefits to anon, authenticated;
create policy benefits_public_read on public.benefits for select to anon, authenticated using (true);
