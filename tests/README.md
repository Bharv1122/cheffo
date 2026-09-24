# Local synthetic browser regressions

These optional tests use Playwright with the installed Microsoft Edge channel. They do not install dependencies, use real accounts, contact backend providers or read a real microphone. Supply an existing Playwright module with `PLAYWRIGHT_MODULE_PATH`, or have `playwright` available to Node. Evidence is written to `CHEFFO_TEST_OUTPUT_DIR` (existing folder) or the OS temporary directory.

For account/profile/Treats loading tests, start the existing Vite dev server on `127.0.0.1:5186`, then run `node tests/verify-account-scope.cjs`. The test serves `account-scope-harness.html`, intercepts only the Supabase module with a fully synthetic implementation, and blocks all nonlocalhost requests. Nine cases cover user switching, stale auth/data, free allowance, retained router navigation, profile partial updates and delayed recipe loading.

Run `node tests/verify-microphone-policy.cjs` to verify the actual `vercel.json` microphone policy against the former blanket block. Playwright provides a fake audio device; this is permission-policy testing, not real speech recognition or physical Android QA. No Vite server is needed for this test.

The build itself runs the dependency-free actual-handler regressions in `scripts/verify-llm-authorization.mjs` and `scripts/verify-account-deletion.mjs`, with fully mocked providers and no external requests. Source fixtures under this folder are not part of the production Vite entry point.
