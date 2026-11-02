-- "How should I prepare?": a short "Before applying" list per programme, drafted at build time by
-- Claude from the programme's own official quotes (scripts/pipeline/prepare-ai.ts). Read-only for
-- the site, like the rest of the programme data.

create table public.programme_prepare (
  programme_id text primary key references public.programmes (id) on delete cascade,
  steps text[] not null,
  model text not null,
  built_at date not null
);

alter table public.programme_prepare enable row level security;
revoke all on public.programme_prepare from anon, authenticated;
grant select on public.programme_prepare to anon, authenticated;
create policy programme_prepare_public_read on public.programme_prepare for select to anon, authenticated using (true);
