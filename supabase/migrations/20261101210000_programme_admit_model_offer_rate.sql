-- Offer rates from UK universities' published admissions statistics (scripts/admit-model/uk_official.py).
alter table programme_admit_model add column if not exists offer_rate numeric;
alter table programme_admit_model add column if not exists offer_rate_from text;   -- 'places-per-application' | 'unit-offer-rate'
alter table programme_admit_model add column if not exists official_unit text;     -- e.g. 'Oxford: Education'
