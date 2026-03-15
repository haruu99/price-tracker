import { unstable_noStore as noStore } from "next/cache";
import { AlertFeed } from "@/components/AlertFeed";
import { MetricCard } from "@/components/MetricCard";
import { TrackerTable } from "@/components/TrackerTable";
import {
  createTrackerAction,
  deleteTrackerAction,
  saveSettingsAction,
  startTrackingAction,
  checkTrackerNowAction,
  toggleTrackerPauseAction
} from "@/app/actions";
import { emailDeliveryReady } from "@/lib/alerts";
import { countTrackers, getSettings, getTrackerById, listRecentAlerts, listTrackers } from "@/lib/db";
import { formatDateTime, formatMoney, formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }) {
  noStore();
  const params = await searchParams;
  const [settings, trackers, alerts, trackerCount] = await Promise.all([
    getSettings(),
    listTrackers(),
    listRecentAlerts(8),
    countTrackers()
  ]);
  const previewTracker =
    params?.preview === "1" && params?.tracker ? await getTrackerById(Number(params.tracker)) : null;
  const latestChange = [...trackers]
    .filter((tracker) => tracker.last_change_at)
    .sort((left, right) => new Date(right.last_change_at).getTime() - new Date(left.last_change_at).getTime())[0];
  const latestCheck = [...trackers]
    .filter((tracker) => tracker.last_checked_at)
    .sort((left, right) => new Date(right.last_checked_at).getTime() - new Date(left.last_checked_at).getTime())[0];

  return (
    <main className="page-shell">
      <section className="hero">
        <span className="eyebrow">Competitor price tracker MVP</span>
        <h1>Paste 10 competitor URLs. Get alerted when prices move.</h1>
        <p>
          This version is intentionally narrow: public product pages, one price per URL, email alerts, and a clean history
          of every check.
        </p>

        {params?.message ? <div className={`flash ${params.kind === "error" ? "error" : "success"}`}>{params.message}</div> : null}

        <div className="grid stats-grid">
          <MetricCard label="Tracked competitors" value={`${trackerCount} / 10`} note="This stays intentionally small for the MVP." />
          <MetricCard
            label="Last price change detected"
            value={latestChange ? formatRelativeTime(latestChange.last_change_at) : "None yet"}
            note={latestChange ? `${latestChange.label || latestChange.domain}` : "We will highlight the latest move here."}
          />
          <MetricCard
            label="Latest price check"
            value={latestCheck ? formatRelativeTime(latestCheck.last_checked_at) : "No checks yet"}
            note={latestCheck ? `${latestCheck.label || latestCheck.domain} · ${formatDateTime(latestCheck.last_checked_at)}` : "Each new URL is checked right after you submit."}
          />
          <MetricCard
            label="Alert inbox"
            value={settings?.alert_email || "Not set"}
            note={emailDeliveryReady() ? "Email delivery is live." : "Alerts stay in-app until delivery is configured."}
          />
        </div>
      </section>

      <div className="grid dashboard-grid">
        <div className="grid" style={{ gap: 18 }}>
          <section className="card">
            <div className="card-header">
              <div>
                <h2>{settings ? "Add competitor product" : "Start tracking your first competitor"}</h2>
                <p>
                  {settings
                    ? "Paste a product URL and we will fetch the current price immediately."
                    : "Enter an alert email and one competitor URL. You should see the first price as soon as you submit."}
                </p>
              </div>
            </div>

            {!settings ? (
              <form action={startTrackingAction} className="form-stack">
                <label className="label">
                  <span>Competitor URL</span>
                  <input className="input" name="url" type="url" placeholder="Example: https://brand.com/products/linen-shirt" required />
                </label>
                <div className="form-row">
                  <label className="label">
                    <span>Product label</span>
                    <input className="input" name="label" placeholder="Black linen shirt" />
                  </label>
                  <label className="label">
                    <span>Alert email</span>
                    <input className="input" name="alertEmail" type="email" placeholder="you@shop.com" required />
                  </label>
                </div>
                <details className="advanced-panel">
                  <summary>Advanced options</summary>
                  <label className="label" style={{ marginTop: 12 }}>
                    <span>Selector hint</span>
                    <input className="input mono" name="selectorHint" placeholder='Example: [data-product-price] or meta[property="product:price:amount"]' />
                  </label>
                </details>
                <div className="button-row">
                  <button className="button" type="submit">
                    Track this competitor
                  </button>
                  <span className="subtle">We only support public product pages in the MVP.</span>
                </div>
              </form>
            ) : (
              <div className="grid" style={{ gap: 18 }}>
                <form action={createTrackerAction} className="form-stack">
                  <label className="label">
                    <span>Competitor URL</span>
                    <input className="input" name="url" type="url" placeholder="Example: https://brand.com/products/linen-shirt" required />
                  </label>
                  <div className="form-row">
                    <label className="label">
                      <span>Product label</span>
                      <input className="input" name="label" placeholder="Black linen shirt" />
                    </label>
                  </div>
                  <details className="advanced-panel">
                    <summary>Advanced options</summary>
                    <label className="label" style={{ marginTop: 12 }}>
                      <span>Selector hint</span>
                      <input className="input mono" name="selectorHint" placeholder='Example: [data-product-price] or meta[property="product:price:amount"]' />
                    </label>
                  </details>
                  <div className="button-row">
                    <button className="button" type="submit" disabled={trackerCount >= 10}>
                      Track this competitor
                    </button>
                    <span className="subtle">Alerts go to {settings.alert_email}. We fetch the price immediately after you submit.</span>
                  </div>
                </form>
              </div>
            )}
          </section>

          {previewTracker ? (
            <section className="card preview-card">
              <div className="card-header">
                <div>
                  <h3>Product detected</h3>
                  <p>The first scrape worked. This is the trust-building moment your users need.</p>
                </div>
              </div>
              <div className="preview-grid">
                <div>
                  <span className="preview-label">Product</span>
                  <strong className="preview-value">{previewTracker.label || previewTracker.domain}</strong>
                </div>
                <div>
                  <span className="preview-label">Current price</span>
                  <strong className="preview-value">
                    {formatMoney(previewTracker.current_price_minor, previewTracker.currency || "USD")}
                  </strong>
                </div>
                <div>
                  <span className="preview-label">Last checked</span>
                  <strong className="preview-value">{formatRelativeTime(previewTracker.last_checked_at)}</strong>
                </div>
              </div>
            </section>
          ) : null}

          <TrackerTable
            trackers={trackers}
            actions={{
              checkNow: checkTrackerNowAction,
              togglePause: toggleTrackerPauseAction,
              deleteTracker: deleteTrackerAction
            }}
          />
        </div>

        <div className="grid" style={{ gap: 18 }}>
          <AlertFeed alerts={alerts} />

          {settings ? (
            <section className="card">
              <div className="card-header">
                <div>
                  <h3>Alert destination</h3>
                  <p>Keep this dead simple for the MVP: one email inbox for all price changes.</p>
                </div>
              </div>
              <form action={saveSettingsAction} className="form-stack">
                <label className="label">
                  <span>Alert email</span>
                  <input className="input" name="alertEmail" type="email" defaultValue={settings.alert_email} required />
                </label>
                <div className="button-row">
                  <button className="button-secondary" type="submit">
                    Update alert email
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="card">
            <div className="card-header">
              <div>
                <h3>MVP Rules</h3>
                <p>These constraints keep the tool dependable and cheap to run.</p>
              </div>
            </div>
            <div className="inline-list">
              <div>
                <span>Supported pages</span>
                <strong>Public ecommerce product URLs</strong>
              </div>
              <div>
                <span>Not supported</span>
                <strong>Login walls, carts, captcha-only flows</strong>
              </div>
              <div>
                <span>Background checks</span>
                <strong>GitHub Actions on a schedule</strong>
              </div>
              <div>
                <span>Email delivery</span>
                <strong>{emailDeliveryReady() ? "Resend or SMTP live" : "Logs only until delivery is configured"}</strong>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
