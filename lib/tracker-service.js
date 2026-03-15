import {
  createAlert,
  getSettings,
  getTrackerById,
  insertPriceCheck,
  listActiveTrackers,
  markTrackerFailure,
  markTrackerSuccess,
  updateAlert
} from "./db.js";
import { sendPriceAlert } from "./alerts.js";
import { scrapePrice } from "./scraper.js";
import { formatMoney } from "./format.js";

export async function checkTrackerById(id, options = {}) {
  const tracker = await getTrackerById(id);
  if (!tracker) {
    throw new Error("Tracker not found.");
  }

  if (tracker.status === "paused" && !options.force) {
    return {
      trackerId: Number(id),
      skipped: true,
      reason: "paused"
    };
  }

  const now = new Date().toISOString();

  const extraction = await scrapePrice(tracker.url, tracker.selector_hint);
  if (!extraction.success) {
    return recordFailure(tracker, {
      checkedAt: now,
      outcome: extraction.outcome,
      httpStatus: extraction.httpStatus,
      pageTitle: extraction.pageTitle,
      errorMessage: extraction.errorMessage
    });
  }

  const changed =
    tracker.current_price_minor !== null &&
    tracker.current_price_minor !== undefined &&
    Number(tracker.current_price_minor) !== Number(extraction.priceMinor);

  const previousPriceMinor = changed ? Number(tracker.current_price_minor) : tracker.previous_price_minor;
  const priceCheckId = await insertPriceCheck({
    trackerId: tracker.id,
    checkedAt: now,
    outcome: "ok",
    httpStatus: extraction.httpStatus,
    priceMinor: extraction.priceMinor,
    currency: extraction.currency,
    extractedFrom: extraction.extractedFrom,
    rawPriceText: extraction.rawPriceText,
    changed,
    pageTitle: extraction.pageTitle
  });

  await markTrackerSuccess(tracker.id, {
    currency: extraction.currency,
    currentPriceMinor: extraction.priceMinor,
    previousPriceMinor,
    status: tracker.status === "paused" ? "paused" : "active",
    lastCheckedAt: now,
    lastChangeAt: changed ? now : tracker.last_change_at,
    updatedAt: now
  });

  let alert;
  if (changed) {
    alert = await createAndSendAlert({
      tracker,
      priceCheckId,
      previousPriceMinor: Number(tracker.current_price_minor),
      currentPriceMinor: extraction.priceMinor,
      currency: extraction.currency
    });
  }

  return {
    trackerId: tracker.id,
    outcome: "ok",
    checkedAt: now,
    changed,
    currentPriceMinor: extraction.priceMinor,
    previousPriceMinor: changed ? Number(tracker.current_price_minor) : null,
    currency: extraction.currency,
    pageTitle: extraction.pageTitle,
    extractedFrom: extraction.extractedFrom,
    fetchMode: extraction.fetchMode,
    alert
  };
}

export async function runDueChecks(limit = 10) {
  const trackers = await listActiveTrackers(limit);
  const results = [];

  for (const tracker of trackers) {
    results.push(await checkTrackerById(tracker.id));
  }

  return {
    processed: trackers.length,
    changed: results.filter((result) => result.changed).length,
    failed: results.filter((result) => result.outcome === "fetch_error" || result.outcome === "parse_error").length,
    results
  };
}

async function createAndSendAlert({ tracker, priceCheckId, previousPriceMinor, currentPriceMinor, currency }) {
  const settings = await getSettings();
  if (!settings?.alert_email) {
    return null;
  }

  const message = `${tracker.label || tracker.domain} changed from ${formatMoney(previousPriceMinor, currency)} to ${formatMoney(currentPriceMinor, currency)}.`;
  const createdAt = new Date().toISOString();

  const alertId = await createAlert({
    trackerId: tracker.id,
    priceCheckId,
    recipient: settings.alert_email,
    status: "queued",
    message,
    createdAt
  });

  try {
    const delivery = await sendPriceAlert({
      tracker,
      recipient: settings.alert_email,
      previousPriceMinor,
      currentPriceMinor,
      currency
    });

    await updateAlert(alertId, {
      status: delivery.status,
      providerId: delivery.providerId,
      sentAt: delivery.sentAt,
      errorMessage: null
    });

    return {
      id: alertId,
      ...delivery
    };
  } catch (error) {
    await updateAlert(alertId, {
      status: "failed",
      providerId: null,
      sentAt: null,
      errorMessage: error instanceof Error ? error.message : "Delivery failed."
    });

    return {
      id: alertId,
      status: "failed"
    };
  }
}

async function recordFailure(tracker, payload) {
  const checkedAt = payload.checkedAt || new Date().toISOString();
  const consecutiveFailures = Number(tracker.consecutive_failures || 0) + 1;
  const status =
    tracker.status === "paused" ? "paused" : consecutiveFailures >= 2 ? "needs_review" : "active";

  await insertPriceCheck({
    trackerId: tracker.id,
    checkedAt,
    outcome: payload.outcome,
    httpStatus: payload.httpStatus,
    changed: false,
    pageTitle: payload.pageTitle,
    errorMessage: payload.errorMessage
  });

  await markTrackerFailure(tracker.id, {
    status,
    lastCheckedAt: checkedAt,
    lastError: payload.errorMessage,
    consecutiveFailures,
    updatedAt: checkedAt
  });

  return {
    trackerId: tracker.id,
    checkedAt,
    outcome: payload.outcome,
    errorMessage: payload.errorMessage
  };
}
