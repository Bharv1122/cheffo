-- Approval records are created and submitted by authenticated server routes.
-- Owners may read and delete their records, but must not rewrite vet decisions,
-- identity fields, recipe associations, or bearer-token hashes through the API.
begin;

revoke insert, update on table public.approvals from anon, authenticated;
drop policy if exists approvals_insert_own on public.approvals;
drop policy if exists approvals_update_own on public.approvals;

-- Preserve approvals_select_own and approvals_delete_own, used by the browser,
-- account export, and account deletion. Preserve existing service_role grants.
commit;
