-- Other tests named on the programme's official page, read by rule with the quote kept in
-- programme_evidence: minimum TOEFL iBT, PTE Academic and Duolingo scores, and whether the GRE /
-- GMAT is asked for (with a minimum score when the page states one).

alter table public.programmes
  add column toefl_total smallint check (toefl_total between 0 and 120),
  add column pte_overall smallint check (pte_overall between 10 and 90),
  add column duolingo smallint check (duolingo between 10 and 160),
  add column gre_status text check (gre_status in ('required', 'optional', 'not-required', 'mentioned')),
  add column gre_min smallint,
  add column gmat_status text check (gmat_status in ('required', 'optional', 'not-required', 'mentioned')),
  add column gmat_min smallint;
