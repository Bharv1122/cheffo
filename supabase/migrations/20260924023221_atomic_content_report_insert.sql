-- Count durable reports rather than retaining a separate account-linked quota bucket.
create or replace function public.insert_ai_content_report_limited(
  p_user_id uuid,
  p_recipe_id uuid,
  p_source text,
  p_reason text,
  p_details text,
  p_content_title text,
  p_content_snapshot jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_report_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  if (select pg_catalog.count(*) from public.ai_content_reports
      where user_id = p_user_id and created_at >= pg_catalog.now() - interval '1 hour') >= 10 then
    return null;
  end if;
  insert into public.ai_content_reports(user_id, recipe_id, source, reason, details, content_title, content_snapshot)
  values (p_user_id, p_recipe_id, p_source, p_reason, p_details, p_content_title, p_content_snapshot)
  returning id into v_report_id;
  return v_report_id;
end;
$function$;
revoke all on function public.insert_ai_content_report_limited(uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.insert_ai_content_report_limited(uuid, uuid, text, text, text, text, jsonb) to service_role;
create index ai_content_reports_user_created_idx on public.ai_content_reports(user_id, created_at);
