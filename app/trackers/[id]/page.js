import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import {
  checkTrackerNowAction,
  deleteTrackerAction,
  toggleTrackerPauseAction,
  updateTrackerAction
} from "@/app/actions";
import { PriceChangeSummary } from "@/components/PriceChangeSummary";
import { getTrackerById, getTrackerHistory } from "@/lib/db";
import { formatDateTime, formatMoney, formatOutcome, formatRelativeTime } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

export default async function TrackerDetailPage({ params, searchParams }) {
  noStore();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const tracker = await getTrackerById(id);

  if (!tracker) {
    notFound();
  }

  const history = await getTrackerHistory(id, 30);

  return (
    <main className="page-shell">
      <section className="hero">
        <Link href="/" className="eyebrow">
          Back to dashboard
        </Link>
        <h1 className="page-title">{tracker.label || tracker.domain}</h1>
        <p>
          Tracking <span className="mono">{tracker.domain}</span>. Every check lands in the history below so you can see
          what moved and what failed.
        </p>
        {resolvedSearchParams?.message ? (
          <div className={`flash ${resolvedSearchParams.kind === "error" ? "error" : "success"}`}>{resolvedSearchParams.message}</div>
        ) : null}
      </section>

      <div className="grid detail-grid" style={{ marginTop: 22 }}>
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Current price snapshot</h2>
              <p>Use this page when a tracker needs tuning or manual review.</p>
            </div>
            <StatusPill tracker={tracker} />
          </div>

          <div className="detail-value">{formatMoney(tracker.current_price_minor, tracker.currency || "USD")}</div>
          <p className="subtle">
            Previous: {formatMoney(tracker.previous_price_minor, tracker.currency || "USD")} · Last checked:{" "}
            {formatRelativeTime(tracker.last_checked_at)} · {formatDateTime(tracker.last_checked_at)}
          </p>
          <PriceChangeSummary tracker={tracker} />

          <div className="button-row" style={{ marginTop: 18 }}>
            <form action={checkTrackerNowAction}>
              <input type="hidden" name="trackerId" value={tracker.id} />
              <input type="hidden" name="from" value={`/trackers/${tracker.id}`} />
              <button className="button" type="submit">
                Check now
              </button>
            </form>

            <form action={toggleTrackerPauseAction}>
              <input type="hidden" name="trackerId" value={tracker.id} />
              <input type="hidden" name="status" value={tracker.status === "paused" ? "active" : "paused"} />
              <input type="hidden" name="from" value={`/trackers/${tracker.id}`} />
              <button className="button-secondary" type="submit">
                {tracker.status === "paused" ? "Resume tracking" : "Pause tracking"}
              </button>
            </form>

            <a href={tracker.url} target="_blank" rel="noreferrer" className="button-ghost">
              Open product page
            </a>
          </div>
        </section>

        <section className="grid" style={{ gap: 18 }}>
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Edit tracker</h3>
                <p>Selector hints are the escape hatch when auto-detection misses a page.</p>
              </div>
            </div>

            <form action={updateTrackerAction} className="form-stack">
              <input type="hidden" name="trackerId" value={tracker.id} />
              <label className="label">
                <span>Label</span>
                <input className="input" name="label" defaultValue={tracker.label || ""} />
              </label>
              <label className="label">
                <span>Selector hint</span>
                <input className="input mono" name="selectorHint" defaultValue={tracker.selector_hint || ""} />
              </label>
              <div className="button-row">
                <button className="button-secondary" type="submit">
                  Save changes
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>Tracker details</h3>
              </div>
            </div>

            <div className="inline-list">
              <div>
                <span>URL</span>
                <strong className="mono">{tracker.url}</strong>
              </div>
              <div>
                <span>Last change</span>
                <strong>{formatDateTime(tracker.last_change_at)}</strong>
              </div>
              <div>
                <span>Last error</span>
                <strong>{tracker.last_error || "None"}</strong>
              </div>
            </div>

            <div className="button-row" style={{ marginTop: 18 }}>
              <form action={deleteTrackerAction}>
                <input type="hidden" name="trackerId" value={tracker.id} />
                <input type="hidden" name="from" value={`/trackers/${tracker.id}`} />
                <button className="button-ghost" type="submit">
                  Delete tracker
                </button>
              </form>
            </div>
          </section>
        </section>
      </div>

      <section className="card" style={{ marginTop: 22 }}>
        <div className="card-header">
          <div>
            <h2>Check history</h2>
            <p>Every scrape result is stored here, including parse failures and HTTP errors.</p>
          </div>
        </div>

        {history.length ? (
          <ul className="history-list">
            {history.map((entry) => (
              <li className="history-item" key={entry.id}>
                <strong>
                  {formatOutcome(entry.outcome)}
                  {entry.changed ? ` · ${formatMoney(entry.price_minor, entry.currency || tracker.currency || "USD")}` : ""}
                </strong>
                <p>{formatDateTime(entry.checked_at)}</p>
                <p>
                  {entry.error_message || entry.extracted_from || entry.page_title || "No extra metadata captured for this check."}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">No checks yet for this tracker.</div>
        )}
      </section>
    </main>
  );
}
