import { formatMoney } from "@/lib/format";

export function PriceChangeSummary({ tracker, compact = false }) {
  const currentPrice = tracker.current_price_minor;
  const previousPrice = tracker.previous_price_minor;
  const currency = tracker.currency || "USD";

  if (currentPrice === null || currentPrice === undefined) {
    return (
      <div className="trend trend-flat">
        <strong>Waiting for first price</strong>
        {!compact ? <span className="price-subtle">We will show movement after the first successful check.</span> : null}
      </div>
    );
  }

  if (previousPrice === null || previousPrice === undefined || Number(previousPrice) === Number(currentPrice)) {
    return (
      <div className="trend trend-flat">
        <strong>No change yet</strong>
        {!compact ? <span className="price-subtle">Baseline captured. We are watching for movement.</span> : null}
      </div>
    );
  }

  const wentDown = Number(currentPrice) < Number(previousPrice);
  const directionClass = wentDown ? "trend-down" : "trend-up";
  const directionLabel = wentDown ? "Drop" : "Rise";

  return (
    <div className={`trend ${directionClass}`}>
      <strong>
        {formatMoney(previousPrice, currency)} -&gt; {formatMoney(currentPrice, currency)}
      </strong>
      <span className="trend-tag">{directionLabel}</span>
    </div>
  );
}
