import { unstable_noStore as noStore } from "next/cache";
import { AlertFeed } from "@/components/AlertFeed";
import { AuthCard } from "@/components/AuthCard";
import { MetricCard } from "@/components/MetricCard";
import { TrackerTable } from "@/components/TrackerTable";
import {
  checkTrackerNowAction,
  createTrackerAction,
  deleteTrackerAction,
  signOutAction,
  toggleTrackerPauseAction,
  updateProfileAction
} from "@/app/actions";
import { emailDeliveryReady } from "@/lib/alerts";
import { getCurrentAccount } from "@/lib/auth";
import { countTrackers, getTrackerById, listRecentAlerts, listTrackers } from "@/lib/db";
import { formatDateTime, formatMoney, formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function PublicHomePage({ params }) {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-split">
          <div className="hero-stack">
            <span className="eyebrow">Competitor price tracker</span>
            <h1>Paste 10 competitor URLs. Get alerted when prices move.</h1>
            <p>
              Built for small sellers manually checking competitor listings every day. Track public Shopify, Amazon, eBay,
              and DTC product pages from one clean dashboard.
            </p>

            {params?.message ? (
              <div className={`flash ${params.kind === "error" ? "error" : "success"}`}>{params.message}</div>
            ) : null}

            <div className="pill-row">
              <span className="platform-pill">Shopify sellers</span>
              <span className="platform-pill">Amazon listings</span>
              <span className="platform-pill">eBay listings</span>
              <span className="platform-pill">Email alerts</span>
            </div>

            <div className="grid public-value-grid">
              <MetricCard label="URL cap by design" value="10" note="Enough for the products sellers actually watch every day." />
              <MetricCard label="Checks that matter" value="Price only" note="No bulky analytics suite, no catalog crawl, no noise." />
              <MetricCard label="Best launch path" value="Direct SaaS" note="Standalone first, Shopify App Store after traction." />
            </div>
          </div>

          <AuthCard />
        </div>
      </section>

      <div className="grid dashboard-grid">
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Launch roadmap</h2>
              <p>The fastest route to revenue keeps the product narrow and the distribution layered.</p>
            </div>
          </div>

          <div className="roadmap-list">
            <div className="roadmap-item">
              <strong>Phase 1 · Private seller accounts</strong>
              <p>Give each seller their own login, alert inbox, tracker history, and 10-URL cap.</p>
            </div>
            <div className="roadmap-item">
              <strong>Phase 2 · Direct billing on your own site</strong>
              <p>Charge through a standalone checkout first so one codebase serves Shopify, Amazon, and eBay sellers.</p>
            </div>
            <div className="roadmap-item">
              <strong>Phase 3 · Reliability and retention</strong>
              <p>Move checks to a real queue, add retries, improve scrape health, and ship daily competitor digests.</p>
            </div>
            <div className="roadmap-item">
              <strong>Phase 4 · Distribution</strong>
              <p>Once direct SaaS traction is real, add a Shopify App Store version and only then deepen marketplace integrations.</p>
            </div>
          </div>
        </section>

        <section className="grid" style={{ gap: 18 }}>
          <section className="card">
            <div className="card-header">
              <div>
                <h3>MVP rules</h3>
                <p>These limits are what make the product cheap, sharp, and dependable.</p>
              </div>
            </div>
            <div className="inline-list">
              <div>
                <span>Supports</span>
                <strong>Public product URLs</strong>
              </div>
              <div>
                <span>Does not support</span>
                <strong>Login walls, carts, captcha-only flows</strong>
              </div>
              <div>
                <span>Starter cap</span>
                <strong>10 tracked URLs per seller</strong>
              </div>
              <div>
                <span>Why it wins</span>
                <strong>One problem solved well</strong>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>What the product needs next</h3>
                <p>Account privacy is the foundation. Billing and growth sit on top of it.</p>
              </div>
            </div>
            <ul className="feature-list">
              <li>Seller-scoped accounts and dashboards</li>
              <li>Direct Stripe billing on your own domain</li>
              <li>Queue-backed checks for harder pages and retries</li>
              <li>Later: Shopify App Store packaging for distribution</li>
            </ul>
          </section>
        </section>
      </div>
    </main>
  );
}

export default async function HomePage({ searchParams }) {
  noStore();
  const params = await searchParams;
  const account = await getCurrentAccount();

  if (!account) {
    return <PublicHomePage params={params} />;
  }

  const { user, profile } = account;
  const [trackers, alerts, trackerCount] = await Promise.all([
    listTrackers(user.id),
    listRecentAlerts(user.id, 8),
    countTrackers(user.id)
  ]);

  const previewTracker =
    params?.preview === "1" && params?.tracker ? await getTrackerById(Number(params.tracker), user.id) : null;
  const latestChange = [...trackers]
    .filter((tracker) => tracker.last_change_at)
    .sort((left, right) => new Date(right.last_change_at).getTime() - new Date(left.last_change_at).getTime())[0];
  const latestCheck = [...trackers]
    .filter((tracker) => tracker.last_checked_at)
    .sort((left, right) => new Date(right.last_checked_at).getTime() - new Date(left.last_checked_at).getTime())[0];
  const trackerLimit = Number(profile.url_limit || 10);

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="account-header">
          <span className="eyebrow">Signed in as {profile.display_name || user.email}</span>
          <form action={signOutAction}>
            <button className="button-ghost" type="submit">
              Sign out
            </button>
          </form>
        </div>

        <h1>Paste 10 competitor URLs. Get alerted when prices move.</h1>
        <p>
          Your account is now private and seller-scoped. This is the foundation for direct billing, plan limits, and
          eventually a Shopify App Store version.
        </p>

        {params?.message ? <div className={`flash ${params.kind === "error" ? "error" : "success"}`}>{params.message}</div> : null}

        <div className="grid stats-grid">
          <MetricCard label="Tracked competitors" value={`${trackerCount} / ${trackerLimit}`} note={`Plan limit on ${profile.plan} right now.`} />
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
            value={profile.alert_email || user.email || "Not set"}
            note={emailDeliveryReady() ? "Email delivery is live." : "Alerts stay in-app until delivery is configured."}
          />
        </div>
      </section>

      <div className="grid dashboard-grid">
        <div className="grid" style={{ gap: 18 }}>
          <section className="card">
            <div className="card-header">
              <div>
                <h2>Add competitor product</h2>
                <p>Paste a product URL and we will fetch the current price immediately for your account.</p>
              </div>
            </div>

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
                <button className="button" type="submit" disabled={trackerCount >= trackerLimit}>
                  Track this competitor
                </button>
                <span className="subtle">Your {profile.plan} plan currently allows {trackerLimit} tracked URLs.</span>
              </div>
            </form>
          </section>

          {previewTracker ? (
            <section className="card preview-card">
              <div className="card-header">
                <div>
                  <h3>Product detected</h3>
                  <p>The first scrape worked. This is still the trust-building moment that converts sellers.</p>
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

          <section className="card">
            <div className="card-header">
              <div>
                <h3>Account settings</h3>
                <p>Each seller has a private inbox and a simple plan record now.</p>
              </div>
            </div>
            <form action={updateProfileAction} className="form-stack">
              <div className="form-row">
                <label className="label">
                  <span>Display name</span>
                  <input className="input" name="displayName" defaultValue={profile.display_name || ""} placeholder="Acme Shop" />
                </label>
                <label className="label">
                  <span>Alert email</span>
                  <input className="input" name="alertEmail" type="email" defaultValue={profile.alert_email || user.email || ""} required />
                </label>
              </div>
              <div className="button-row">
                <button className="button-secondary" type="submit">
                  Save account settings
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>Plan foundation</h3>
                <p>This is the monetization layer we can plug Stripe into next.</p>
              </div>
            </div>
            <div className="inline-list">
              <div>
                <span>Current plan</span>
                <strong>{profile.plan}</strong>
              </div>
              <div>
                <span>Plan status</span>
                <strong>{profile.plan_status}</strong>
              </div>
              <div>
                <span>URL cap</span>
                <strong>{trackerLimit} tracked products</strong>
              </div>
              <div>
                <span>Next monetization step</span>
                <strong>Stripe checkout for direct SaaS billing</strong>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>Distribution roadmap</h3>
                <p>Keep the product cross-platform first. Let the acquisition channels layer in later.</p>
              </div>
            </div>
            <div className="inline-list">
              <div>
                <span>Supports today</span>
                <strong>Shopify, Amazon, eBay public product pages</strong>
              </div>
              <div>
                <span>Best launch path</span>
                <strong>Standalone SaaS at your own domain</strong>
              </div>
              <div>
                <span>Next channel</span>
                <strong>Shopify App Store after direct traction</strong>
              </div>
              <div>
                <span>Why not yet</span>
                <strong>Marketplace-specific integrations add a lot of ops early</strong>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
