-- Whether the stored fee was identified as the international (overseas) fee on the official page.
-- Rule-read fees that could not be confirmed as international are kept with false and needs_review.
alter table public.programmes
  add column tuition_international boolean not null default false;
