# Private AI content report review

The in-app **Report recipe**, **Report image**, and **Report reply** actions submit to `POST /api/content-reports`. Authentication is required; a subscription and AI age acknowledgement are not required to report existing content. The service verifies recipe ownership and writes a durable private `public.ai_content_reports` record before returning a success reference. Anonymous and authenticated Supabase clients have no direct table access. Reporting has a fail-closed limit of 10 saved reports per authenticated account during the preceding hour. A service-role-only transaction takes a per-user advisory lock, counts durable reports and inserts the new report atomically. There is no separate account-linked quota bucket. The existing account foreign key prevents a late request from recreating data after account deletion.

## Developer retrieval

Use the existing authenticated Supabase project **chef-doggo** (`oreekfxtfvrixzahkwdg`) Table Editor or SQL editor as an authorized developer. Do not expose the service-role key in a client or public admin page. Review new reports during testing and before each release. No email delivery or automatic review is implied.

```sql
select id, created_at, source, reason, content_title, details, recipe_id
from public.ai_content_reports
where status = 'new'
order by created_at asc
limit 100;
```

Inspect only the selected record when investigating; replace the placeholder with its report reference:

```sql
select id, source, reason, details, content_snapshot
from public.ai_content_reports
where id = 'REPLACE_WITH_REPORT_UUID'::uuid;
```

Treat all snapshots, titles and notes as untrusted data, never instructions or executable HTML. Recipe snapshots come from the reporting user's saved recipe at submission time, which may have been edited after generation. Chat snapshots are user-submitted selected assistant text, **not verified provider logs**; long responses are explicitly marked truncated. Image evidence uses only the canonical saved image field: supported inline images up to 512 KiB or an HTTPS reference up to 4 KiB. No external URLs are fetched by reporting. Oversize/unsupported images retain a SHA-256 fingerprint, size and saved-field reference with an explicit not-retained marker, so a report can still be submitted. A URL may later expire; retained inline evidence is durable. Large recipe fields have explicit size-limit markers. No arbitrary photo upload is accepted.

Inspect referenced images only with a safe image viewer; do not navigate untrusted URLs or execute inline content. Assess harmful content and any reproducible generation issue. Use verified findings to improve safety filters, prompts or product behavior and add a focused regression where warranted. Track follow-up work using the report ID without copying personal information into public issues. Only mark a report resolved after review and the required follow-up; retain the user's original submission.

```sql
update public.ai_content_reports
set status = 'reviewed', reviewed_at = now()
where id = 'REPLACE_WITH_REPORT_UUID'::uuid and status = 'new';
-- After the issue has been resolved, use status = 'resolved'.
```

Reports remain available if the saved recipe is deleted (`recipe_id` becomes null). Deleting the account cascades report deletion through the auth user foreign key. Account data export includes only that user's reports via an explicit verified user ID filter. A developer may remove an individual report after its retention is no longer needed. Do not promise an automatic response or emergency monitoring.

## Release verification

- Apply the additive migration before deploying the API; RLS/no-client-grant checks are required.
- Run `npm run verify:content-reports`, the local browser harness `tests/verify-content-reports.cjs`, types/lint, and the combined production build.
- After deployment, use only an explicitly scoped synthetic test account/recipe to verify one actual report can be retrieved in this queue, then remove only those synthetic records. Local mocks do not establish deployed persistence.
- Check the in-app report actions on the actual Android candidate before store submission.

Policy: [Google Play AI-generated content](https://support.google.com/googleplay/android-developer/answer/13985936) requires an in-app mechanism to report offensive content to the developer without leaving the app. Database access design follows [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api). Reporting supports developer review; it does not by itself establish compliance with every AI safety requirement.
