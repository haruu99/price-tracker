# Price Tracker MVP

A narrow web app for small ecommerce sellers who only need one thing: paste competitor product URLs and get alerted when the price changes.

## What this version does

- stores up to 10 public competitor product URLs
- checks prices immediately when a tracker is added
- logs every scrape attempt and every price change
- supports manual re-checks from the dashboard
- supports scheduled background checks via GitHub Actions
- sends email alerts with Resend when configured, otherwise logs alerts inside the app

## Free-first stack

- Next.js App Router on Vercel Hobby
- Supabase Postgres for persistence
- GitHub Actions for scheduled price checks
- Resend for alert emails
- Playwright fallback only in GitHub Actions, not in normal Vercel requests

## Important MVP caveat

This app is still single-tenant. It is good for validating the product and the scraping workflow, but it does not have user auth or team accounts yet.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Install Chromium for the optional Playwright fallback:

```bash
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium
```

3. Copy the env file:

```bash
cp .env.example .env
```

4. Create a Supabase project and run [supabase/schema.sql](/Users/salel/Documents/New%20project/price-tracker/supabase/schema.sql) in the SQL editor.

5. Fill in your `.env` with:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL`
- `ALERT_FROM_EMAIL`
- `RESEND_API_KEY`

6. Start the app:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL`
- `ALERT_FROM_EMAIL`
- `RESEND_API_KEY`
- `CRON_SECRET`
- `PLAYWRIGHT_FALLBACK`
- `PLAYWRIGHT_TIMEOUT_MS`
- `PLAYWRIGHT_RENDER_WAIT_MS`
- `PLAYWRIGHT_NETWORK_IDLE_WAIT_MS`
- `CHECK_BATCH_SIZE`

Optional SMTP fallback is still supported:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

Recommended values:

- Vercel: `PLAYWRIGHT_FALLBACK=0`
- GitHub Actions: `PLAYWRIGHT_FALLBACK=1`

## Supabase setup

Run [supabase/schema.sql](/Users/salel/Documents/New%20project/price-tracker/supabase/schema.sql) once in your Supabase SQL editor. The schema creates:

- `settings`
- `trackers`
- `price_checks`
- `alerts`

## Vercel deployment

1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Add every variable from [\.env.vercel.example](/Users/salel/Documents/New%20project/price-tracker/.env.vercel.example).

4. Deploy on the Hobby plan.

## GitHub Actions scheduler

The scheduled worker lives in [scheduled-price-checks.yml](/Users/salel/Documents/New%20project/price-tracker/.github/workflows/scheduled-price-checks.yml).

It currently runs every 6 hours and can also be triggered manually from the GitHub Actions tab.

Add these GitHub Actions secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL`
- `ALERT_FROM_EMAIL`
- `RESEND_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

Use [\.env.github-actions.example](/Users/salel/Documents/New%20project/price-tracker/.env.github-actions.example) as the exact template.

The workflow installs Playwright, enables browser fallback, and runs:

```bash
npm run run:scheduled-checks
```

## Fastest path

If you want the shortest launch path, follow [free-launch-checklist.md](/Users/salel/Documents/New%20project/price-tracker/docs/free-launch-checklist.md).

## Cron endpoint

The app still exposes:

```text
GET /api/cron/check-prices
```

Protect it with either:

- `Authorization: Bearer <CRON_SECRET>`
- `?secret=<CRON_SECRET>`

This is useful for manual testing or if you later switch to an external scheduler.

## MVP boundaries

- public product pages only
- no login-required stores
- no add-to-cart pricing
- one price per URL
- optional selector hint for pages that need help
- browser fallback runs in GitHub Actions, but blocked or captcha-heavy sites can still fail
