-- Admission model parameters per programme (data/raw/admit-model.json, built by scripts/admit-model/).
-- Scale: C-tier-equivalent GPA on the 4-point scale. P = c * sigmoid((gpa4 + tier shift + delta - theta) / s),
-- times bg_factor for a C-tier or Singapore private-school applicant. Read-only for the site.

create table public.programme_admit_model (
  programme_id text primary key references public.programmes (id) on delete cascade,
  k numeric(5, 3) not null,            -- admitted median, C-tier-equivalent GPA
  k_se numeric(5, 3) not null,
  theta numeric(5, 3) not null,        -- admitted 25th percentile (the curve's midpoint)
  theta_se numeric(5, 3) not null,
  s numeric(5, 3) not null,            -- curve width
  c numeric(5, 3) not null,            -- ceiling
  cluster text not null check (cluster in ('taught', 'elite')),
  bg_factor numeric(5, 3) not null,    -- background factor for C-tier / private-school applicants
  n_cases integer not null,
  basis text not null check (basis in ('observed', 'blended', 'predicted')),
  no_case_yet boolean not null,
  subject_rank_qs integer,
  subject_rank_gras integer,
  applications_per_place numeric(6, 1),
  floor_level smallint,              -- stated minimum on the UK class scale (40 Third … 70 First), any route
  main_level smallint,               -- the main requirement before alternative routes
  floor_band_factor numeric(4, 3),   -- relative chance at the minimum band, by country (null: not measured)
  experience_class text not null check (experience_class in ('mba-exec', 'required', 'preferred', 'none')),
  policy_risks jsonb not null default '[]'::jsonb,  -- [{id, level, note, url}] from data/raw/policy-risks.json
  built_at date not null
);

-- One row of global parameters (tier shifts, private-school delta, curves, fit diagnostics).
create table public.admit_model_params (
  id text primary key,
  params jsonb not null,
  built_at date not null
);

alter table public.programme_admit_model enable row level security;
alter table public.admit_model_params enable row level security;
revoke all on public.programme_admit_model from anon, authenticated;
revoke all on public.admit_model_params from anon, authenticated;
grant select on public.programme_admit_model to anon, authenticated;
grant select on public.admit_model_params to anon, authenticated;
create policy programme_admit_model_public_read on public.programme_admit_model for select to anon, authenticated using (true);
create policy admit_model_params_public_read on public.admit_model_params for select to anon, authenticated using (true);
