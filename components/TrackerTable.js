import Link from "next/link";
import { formatDateTime, formatMoney, formatRelativeTime } from "@/lib/format";
import { PriceChangeSummary } from "@/components/PriceChangeSummary";
import { StatusPill } from "@/components/StatusPill";

export function TrackerTable({ trackers, actions }) {
  return (
    <section className="table-shell">
      <div className="card-header" style={{ padding: "18px 18px 0" }}>
        <div>
          <h2>Tracked Competitors</h2>
          <p>Keep this tight for the MVP: up to 10 product URLs, checked on demand or by the scheduled worker.</p>
        </div>
      </div>

      {trackers.length ? (
        <div className="table-scroll">
          <table className="tracker-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Current</th>
                <th>Movement</th>
                <th>Last checked</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trackers.map((tracker) => (
                <tr key={tracker.id}>
                  <td>
                    <div className="tracker-main">
                      <span className="tracker-label">{tracker.label || tracker.domain}</span>
                      <a href={tracker.url} target="_blank" rel="noreferrer" className="tracker-meta mono">
                        {tracker.domain}
                      </a>
                      {tracker.last_error ? <span className="muted-meta">{tracker.last_error}</span> : null}
                    </div>
                  </td>
                  <td>
                    <div className="price-cell">
                      <strong className="price-main">{formatMoney(tracker.current_price_minor, tracker.currency || "USD")}</strong>
                      <span className="price-subtle">{tracker.last_checked_at ? "Latest detected price" : "Waiting for first successful check"}</span>
                    </div>
                  </td>
                  <td>
                    <PriceChangeSummary tracker={tracker} />
                  </td>
                  <td>
                    <div className="price-cell">
                      <strong>{formatRelativeTime(tracker.last_checked_at)}</strong>
                      <span className="price-subtle">{formatDateTime(tracker.last_checked_at)}</span>
                    </div>
                  </td>
                  <td>
                    <StatusPill tracker={tracker} />
                  </td>
                  <td>
                    <div className="table-actions">
                      <form action={actions.checkNow}>
                        <input type="hidden" name="trackerId" value={tracker.id} />
                        <button className="table-action" type="submit">
                          Check now
                        </button>
                      </form>

                      <form action={actions.togglePause}>
                        <input type="hidden" name="trackerId" value={tracker.id} />
                        <input type="hidden" name="status" value={tracker.status === "paused" ? "active" : "paused"} />
                        <button className="table-action" type="submit">
                          {tracker.status === "paused" ? "Resume" : "Pause"}
                        </button>
                      </form>

                      <Link href={`/trackers/${tracker.id}`} className="table-action">
                        Details
                      </Link>

                      <form action={actions.deleteTracker}>
                        <input type="hidden" name="trackerId" value={tracker.id} />
                        <button className="table-action danger" type="submit">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: 18 }}>
          <div className="empty-state">
            Add your first competitor product.
            <br />
            Example: <span className="mono">https://brand.com/products/linen-shirt</span>
          </div>
        </div>
      )}
    </section>
  );
}
