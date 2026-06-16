-- Journey Ledger — Phase 12B: `groups` mirror table
--
-- Adds the `groups` table for the group-workspace shell. Apply this in the
-- Supabase SQL Editor for a project that already has `trip_events` + `trips`.
-- (A fresh project should just run `supabase/bootstrap.sql`, which already
-- includes `groups`.) Idempotent.
--
-- IMPORTANT: this is NOT yet real group sharing. A group is owner-scoped — only
-- its creator can see it (own-row RLS). Shared membership / invite codes will
-- need a `group_members` table and broader policies in a later phase.
--
-- Column contract (matches src/db/replication.ts -> startGroupsReplication):
--   id text PK | updated_at bigint (epoch ms) | deleted boolean
--   user_id uuid (owner = auth.uid()) | data jsonb (name, description,
--   created_by, owner_id, created_at)

create table if not exists public.groups (
    id          text        primary key,
    updated_at  bigint      not null,
    deleted     boolean     not null default false,
    user_id     uuid        not null references auth.users (id) on delete cascade,
    data        jsonb       not null default '{}'::jsonb
);

create index if not exists groups_updated_at_idx on public.groups (updated_at);
create index if not exists groups_user_id_idx    on public.groups (user_id);

alter table public.groups enable row level security;

drop policy if exists "Users can select their own groups" on public.groups;
create policy "Users can select their own groups"
    on public.groups for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own groups" on public.groups;
create policy "Users can insert their own groups"
    on public.groups for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own groups" on public.groups;
create policy "Users can update their own groups"
    on public.groups for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'groups'
    ) then
        alter publication supabase_realtime add table public.groups;
    end if;
end
$$;
