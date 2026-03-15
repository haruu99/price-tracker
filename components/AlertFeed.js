import Link from "next/link";
import { formatDateTime } from "@/lib/format";

export function AlertFeed({ alerts }) {
  return (
    <section className="feed-card">
      <div className="card-header">
        <div>
          <h3>Recent Alerts</h3>
          <p>Every price change gets logged here, even if email delivery is not configured yet.</p>
        </div>
      </div>

      {alerts.length ? (
        <ul className="feed-list">
          {alerts.map((alert) => (
            <li className="feed-item" key={alert.id}>
              <strong>{alert.message}</strong>
              <p>{formatDateTime(alert.created_at)}</p>
              <p>
                <Link href={`/trackers/${alert.tracker_id}`} className="link-button">
                  Open tracker
                </Link>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          Price changes will appear here.
          <br />
          Once a competitor changes price, you will see the history here.
        </div>
      )}
    </section>
  );
}
