export function StatusPill({ tracker, compact = false }) {
  const recentlyChanged = tracker.last_change_at && Date.now() - new Date(tracker.last_change_at).getTime() < 1000 * 60 * 60 * 48;
  const status = recentlyChanged && tracker.status === "active" ? "changed" : tracker.status;

  const labels = {
    active: "Active",
    paused: "Paused",
    needs_review: "Needs review",
    changed: "Changed"
  };

  return <span className={`status-pill status-${status}`}>{compact ? labels[status] || status : labels[status] || "Unknown"}</span>;
}
