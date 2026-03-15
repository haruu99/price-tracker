# Free Launch Checklist

This is the fastest path to a fully free traction test:

- `Frontend`: Vercel Hobby
- `Database`: Supabase Free
- `Scheduler`: GitHub Actions
- `Email`: Resend Free

## 1. Create Supabase

1. Create a new Supabase project.
2. Open the SQL editor.
3. Run [schema.sql](/Users/salel/Documents/New%20project/price-tracker/supabase/schema.sql).
4. Copy:

- Project URL
- Publishable key
- Service role key

5. In `Authentication -> URL Configuration`, set:

- `Site URL`: your deployed app URL
- `Redirect URL`: `https://your-app.vercel.app/auth/confirm`

Add `http://localhost:3000/auth/confirm` too for local testing.

## 2. Create Resend

1. Create a Resend account.
2. Add and verify a sending domain, or use a tested sender if available.
3. Copy your API key.
4. Choose a sender address for `ALERT_FROM_EMAIL`.

## 3. Configure Vercel

1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Add every variable from [\.env.vercel.example](/Users/salel/Documents/New%20project/price-tracker/.env.vercel.example).
4. Replace `APP_BASE_URL` with your real Vercel URL.
5. Deploy.

You must also paste `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` into Vercel now because the app has real seller sign-in.

## 4. Configure GitHub Actions secrets

In your GitHub repo, go to `Settings -> Secrets and variables -> Actions` and add:

- `APP_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALERT_FROM_EMAIL`
- `RESEND_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

The exact values are templated in [\.env.github-actions.example](/Users/salel/Documents/New%20project/price-tracker/.env.github-actions.example).

## 5. Enable the scheduler

1. Open the `Actions` tab in GitHub.
2. Enable workflows if GitHub asks.
3. Run `Scheduled Price Checks` once with `Run workflow`.
4. Confirm it succeeds.

After that, GitHub will run the scheduled checks every 6 hours.

## 6. Smoke test the app

1. Open the Vercel app URL.
2. Request a magic link and sign in.
3. Add your alert email and one competitor URL.
4. Confirm the first scrape succeeds.
5. Open Supabase and verify rows exist in:

- `profiles`
- `trackers`
- `price_checks`

## 7. Smoke test alerts

1. Trigger the GitHub workflow manually.
2. Check the workflow logs.
3. Verify new rows appear in `price_checks`.
4. If a price change occurred, verify a row appears in `alerts`.

## Notes

- Vercel should keep `PLAYWRIGHT_FALLBACK=0`.
- GitHub Actions should keep `PLAYWRIGHT_FALLBACK=1`.
- If Resend is not configured yet, the app still logs alerts in the dashboard and database.
- For public launch, Supabase Auth should use custom SMTP so any seller can receive magic links.
