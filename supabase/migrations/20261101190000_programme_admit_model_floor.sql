-- Columns added after the first version of programme_admit_model (safe whether or not that version was pushed).
alter table public.programme_admit_model
  add column if not exists experience_class text not null default 'none',
  add column if not exists policy_risks jsonb not null default '[]'::jsonb,
  add column if not exists floor_level smallint,
  add column if not exists main_level smallint,
  add column if not exists floor_band_factor numeric(4, 3);
