-- Journey Ledger — Phase 12C: group membership + invite codes
--
-- Adds real group membership (`group_members`) and invite codes
-- (`group_invites`) on top of the Phase 12B `groups` table, so a group can
-- become visible to users other than its creator. Apply this in the Supabase
-- SQL Editor for a project that already has `groups` (Phase 12B). A fresh
-- project should run `supabase/bootstrap.sql`, which already includes all of
-- this. Idempotent.
--
-- WHAT THIS ENABLES (and what it does NOT)
--   * Account A creates a group, generates an invite code.
--   * Account B joins via the code (RPC) -> a membership row is created.
--   * Account B can now SELECT (see) the group, because the `groups` SELECT
--     policy is widened to "owner OR active member".
--   * Group TRIPS / EVENTS are still owner-scoped — cross-user trip/event
--     sharing is intentionally deferred to Phase 12D. This migration ONLY
--     covers membership + group visibility.
--
-- SECURITY MODEL
--   * Membership rows are written ONLY by SECURITY DEFINER code paths: the
--     owner-membership trigger (on group insert) and the join RPC. Clients have
--     NO direct INSERT/UPDATE/DELETE on group_members.
--   * Invite codes are managed (insert/select/revoke) ONLY by the group owner
--     via RLS. Ordinary users can NEVER list invite codes; they can only redeem
--     one through `join_group_by_invite_code`, which runs SECURITY DEFINER.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLES
-- -----------------------------------------------------------------------------

create table if not exists public.group_members (
    id          uuid        primary key default gen_random_uuid(),
    group_id    text        not null,
    user_id     uuid        not null references auth.users (id) on delete cascade,
    role        text        not null default 'member',   -- 'owner' | 'member'
    status      text        not null default 'active',    -- 'active' (room to grow)
    joined_at   timestamptz not null default now(),
    created_at  timestamptz not null default now(),
    unique (group_id, user_id)
);

create table if not exists public.group_invites (
    id          uuid        primary key default gen_random_uuid(),
    group_id    text        not null,
    code        text        not null unique,
    created_by  uuid        not null references auth.users (id) on delete cascade,
    created_at  timestamptz not null default now(),
    expires_at  timestamptz null,
    revoked     boolean     not null default false
);

create index if not exists group_members_group_id_idx on public.group_members (group_id);
create index if not exists group_members_user_id_idx   on public.group_members (user_id);
create index if not exists group_invites_group_id_idx  on public.group_invites (group_id);
create index if not exists group_invites_code_idx       on public.group_invites (code);

-- -----------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS (SECURITY DEFINER)
-- Used inside RLS policies. SECURITY DEFINER so the membership/ownership lookup
-- bypasses RLS and cannot recurse between the groups <-> group_members policies.
-- -----------------------------------------------------------------------------

create or replace function public.is_group_member(p_group_id text, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from public.group_members m
        where m.group_id = p_group_id
          and m.user_id = p_user_id
          and m.status = 'active'
    );
$$;

create or replace function public.is_group_owner(p_group_id text, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from public.groups g
        where g.id = p_group_id
          and g.user_id = p_user_id
    );
$$;

-- -----------------------------------------------------------------------------
-- 3. OWNER-MEMBERSHIP TRIGGER
-- When a group row is first inserted (via RxDB replication push), auto-create
-- the creator's 'owner' membership. Idempotent: ON CONFLICT DO NOTHING. Fires
-- only on real INSERT (not the UPDATE path of upsert), which is exactly once.
-- -----------------------------------------------------------------------------

create or replace function public.tg_groups_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.group_members (group_id, user_id, role, status)
    values (new.id, new.user_id, 'owner', 'active')
    on conflict (group_id, user_id) do nothing;
    return new;
end;
$$;

drop trigger if exists groups_after_insert_membership on public.groups;
create trigger groups_after_insert_membership
    after insert on public.groups
    for each row
    execute function public.tg_groups_after_insert();

-- -----------------------------------------------------------------------------
-- 4. JOIN-BY-INVITE-CODE RPC (SECURITY DEFINER)
-- The ONLY way a non-owner becomes a member. Validates the invite then inserts
-- an active 'member' row. No-op if already a member. Returns the group_id.
-- Raises a coded exception the client maps to a friendly message.
-- -----------------------------------------------------------------------------

create or replace function public.join_group_by_invite_code(invite_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_invite public.group_invites%rowtype;
    v_uid    uuid := auth.uid();
begin
    if v_uid is null then
        raise exception 'NOT_AUTHENTICATED';
    end if;

    select * into v_invite
    from public.group_invites
    where code = invite_code;

    if not found then
        raise exception 'INVALID_CODE';
    end if;

    if v_invite.revoked then
        raise exception 'REVOKED_CODE';
    end if;

    if v_invite.expires_at is not null and v_invite.expires_at < now() then
        raise exception 'EXPIRED_CODE';
    end if;

    insert into public.group_members (group_id, user_id, role, status)
    values (v_invite.group_id, v_uid, 'member', 'active')
    on conflict (group_id, user_id) do nothing;

    return v_invite.group_id;
end;
$$;

grant execute on function public.join_group_by_invite_code(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;

-- --- groups: widen SELECT to owner OR active member --------------------------
-- (replaces the Phase 12B owner-only SELECT policy). INSERT/UPDATE stay owner-
-- only — see bootstrap.sql / Phase 12B for those.
drop policy if exists "Users can select their own groups" on public.groups;
drop policy if exists "Members or owners can select groups" on public.groups;
create policy "Members or owners can select groups"
    on public.groups for select
    using (auth.uid() = user_id or public.is_group_member(id, auth.uid()));

-- --- group_members -----------------------------------------------------------
-- SELECT: your own membership rows, or (for owners) all members of your group.
-- NO client INSERT/UPDATE/DELETE: membership is written only by the owner
-- trigger and the join RPC (both SECURITY DEFINER, which bypass RLS).
drop policy if exists "Select own or owned group memberships" on public.group_members;
create policy "Select own or owned group memberships"
    on public.group_members for select
    using (user_id = auth.uid() or public.is_group_owner(group_id, auth.uid()));

-- --- group_invites -----------------------------------------------------------
-- Owner-only management. Ordinary users can never list codes; they redeem via
-- the join RPC. Owner inserts a client-generated code; created_by must be self.
drop policy if exists "Owners can select group invites" on public.group_invites;
create policy "Owners can select group invites"
    on public.group_invites for select
    using (public.is_group_owner(group_id, auth.uid()));

drop policy if exists "Owners can insert group invites" on public.group_invites;
create policy "Owners can insert group invites"
    on public.group_invites for insert
    with check (public.is_group_owner(group_id, auth.uid()) and created_by = auth.uid());

drop policy if exists "Owners can update group invites" on public.group_invites;
create policy "Owners can update group invites"
    on public.group_invites for update
    using (public.is_group_owner(group_id, auth.uid()))
    with check (public.is_group_owner(group_id, auth.uid()));

-- =============================================================================
-- Done. Groups are now visible to active members; membership is created via the
-- owner trigger + join RPC; invites are owner-managed. Group trips/events remain
-- owner-scoped (Phase 12D).
-- =============================================================================
