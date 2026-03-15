import { getSupabaseAdmin } from "./supabase.js";
import { normalizeUrl } from "./url.js";

const TRACKER_STATUS_ORDER = {
  needs_review: 0,
  active: 1,
  paused: 2
};

function getClient() {
  return getSupabaseAdmin();
}

function unwrapSingle(response, fallback = null) {
  if (response.error) {
    throw response.error;
  }

  return response.data ?? fallback;
}

function ensureNoError(response) {
  if (response.error) {
    throw response.error;
  }
}

function withUserFilter(query, userId, column = "user_id") {
  return userId ? query.eq(column, userId) : query;
}

function sortTrackers(trackers) {
  return [...trackers].sort((left, right) => {
    const leftRank = TRACKER_STATUS_ORDER[left.status] ?? 99;
    const rightRank = TRACKER_STATUS_ORDER[right.status] ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime();
  });
}

function sortActiveTrackers(trackers) {
  return [...trackers].sort((left, right) => {
    const leftTime = new Date(left.last_checked_at || left.created_at || 0).getTime();
    const rightTime = new Date(right.last_checked_at || right.created_at || 0).getTime();
    return leftTime - rightTime;
  });
}

function isDuplicateUrlError(error) {
  return error?.code === "23505";
}

function buildFallbackEmail(userId) {
  return `${userId}@pending.local`;
}

export async function getProfile(userId) {
  if (!userId) {
    return null;
  }

  const response = await getClient().from("profiles").select("*").eq("id", userId).maybeSingle();
  return unwrapSingle(response);
}

export async function ensureProfile({ userId, email }) {
  if (!userId) {
    throw new Error("A signed-in user is required.");
  }

  const now = new Date().toISOString();
  const existing = await getProfile(userId);
  const safeEmail = email || existing?.email || buildFallbackEmail(userId);
  const alertEmail = existing?.alert_email || safeEmail;

  const response = await getClient()
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: safeEmail,
        alert_email: alertEmail,
        display_name: existing?.display_name || null,
        plan: existing?.plan || "starter",
        plan_status: existing?.plan_status || "beta",
        url_limit: existing?.url_limit || 10,
        updated_at: now
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  return unwrapSingle(response);
}

export async function updateProfile(userId, { alertEmail, displayName }) {
  const response = await getClient()
    .from("profiles")
    .update({
      alert_email: alertEmail,
      display_name: displayName || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);

  ensureNoError(response);
}

export async function countTrackers(userId = null) {
  let query = getClient().from("trackers").select("id", { count: "exact", head: true });
  query = withUserFilter(query, userId);
  const response = await query;
  ensureNoError(response);
  return Number(response.count || 0);
}

export async function listTrackers(userId = null) {
  let query = getClient().from("trackers").select("*");
  query = withUserFilter(query, userId);
  const response = await query;
  return sortTrackers(unwrapSingle(response, []));
}

export async function getTrackerById(id, userId = null) {
  let query = getClient().from("trackers").select("*").eq("id", Number(id));
  query = withUserFilter(query, userId);
  const response = await query.maybeSingle();
  return unwrapSingle(response);
}

export async function getTrackerHistory(id, userId = null, limit = 25) {
  const tracker = await getTrackerById(id, userId);
  if (!tracker) {
    return [];
  }

  let query = getClient().from("price_checks").select("*").eq("tracker_id", Number(id));
  query = withUserFilter(query, userId);
  const response = await query.order("checked_at", { ascending: false }).limit(Number(limit));
  return unwrapSingle(response, []);
}

export async function listRecentAlerts(userId = null, limit = 10) {
  let alertsQuery = getClient().from("alerts").select("*");
  alertsQuery = withUserFilter(alertsQuery, userId);
  const alertsResponse = await alertsQuery.order("created_at", { ascending: false }).limit(Number(limit));

  const alerts = unwrapSingle(alertsResponse, []);
  if (!alerts.length) {
    return [];
  }

  const trackerIds = [...new Set(alerts.map((alert) => Number(alert.tracker_id)).filter(Boolean))];
  const trackersResponse = await getClient().from("trackers").select("id, label, url, domain").in("id", trackerIds);
  const trackers = unwrapSingle(trackersResponse, []);
  const trackerMap = new Map(trackers.map((tracker) => [Number(tracker.id), tracker]));

  return alerts.map((alert) => ({
    ...alert,
    ...(trackerMap.get(Number(alert.tracker_id)) || {})
  }));
}

export async function createTracker({ userId, label, url, selectorHint }) {
  if (!userId) {
    throw new Error("A signed-in user is required.");
  }

  const { url: normalizedUrl, domain } = normalizeUrl(url);
  const now = new Date().toISOString();

  const response = await getClient()
    .from("trackers")
    .insert({
      user_id: userId,
      label: label || null,
      url: normalizedUrl,
      normalized_url: normalizedUrl,
      domain,
      selector_hint: selectorHint || null,
      created_at: now,
      updated_at: now
    })
    .select("id")
    .single();

  if (response.error) {
    if (isDuplicateUrlError(response.error)) {
      throw new Error("That URL is already being tracked in your account.");
    }

    throw response.error;
  }

  return Number(response.data.id);
}

export async function updateTrackerBasics(id, { userId, label, selectorHint }) {
  let query = getClient()
    .from("trackers")
    .update({
      label: label || null,
      selector_hint: selectorHint || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", Number(id));

  query = withUserFilter(query, userId);
  const response = await query;
  ensureNoError(response);
}

export async function deleteTracker(id, userId = null) {
  let query = getClient().from("trackers").delete().eq("id", Number(id));
  query = withUserFilter(query, userId);
  const response = await query;
  ensureNoError(response);
}

export async function setTrackerStatus(id, userId, status) {
  let query = getClient()
    .from("trackers")
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", Number(id));

  query = withUserFilter(query, userId);
  const response = await query;
  ensureNoError(response);
}

export async function listActiveTrackers(limit = 25, userId = null) {
  let query = getClient().from("trackers").select("*").eq("status", "active");
  query = withUserFilter(query, userId);
  const response = await query.limit(Number(limit));
  return sortActiveTrackers(unwrapSingle(response, []));
}

export async function insertPriceCheck(payload) {
  const response = await getClient()
    .from("price_checks")
    .insert({
      user_id: payload.userId,
      tracker_id: Number(payload.trackerId),
      checked_at: payload.checkedAt,
      outcome: payload.outcome,
      http_status: payload.httpStatus ?? null,
      price_minor: payload.priceMinor ?? null,
      currency: payload.currency ?? null,
      extracted_from: payload.extractedFrom ?? null,
      raw_price_text: payload.rawPriceText ?? null,
      changed: Boolean(payload.changed),
      page_title: payload.pageTitle ?? null,
      error_message: payload.errorMessage ?? null
    })
    .select("id")
    .single();

  if (response.error) {
    throw response.error;
  }

  return Number(response.data.id);
}

export async function markTrackerSuccess(id, payload) {
  const response = await getClient()
    .from("trackers")
    .update({
      currency: payload.currency ?? null,
      current_price_minor: payload.currentPriceMinor,
      previous_price_minor: payload.previousPriceMinor ?? null,
      status: payload.status || "active",
      last_checked_at: payload.lastCheckedAt,
      last_change_at: payload.lastChangeAt ?? null,
      last_error: null,
      consecutive_failures: 0,
      updated_at: payload.updatedAt
    })
    .eq("id", Number(id));

  ensureNoError(response);
}

export async function markTrackerFailure(id, payload) {
  const response = await getClient()
    .from("trackers")
    .update({
      status: payload.status,
      last_checked_at: payload.lastCheckedAt,
      last_error: payload.lastError,
      consecutive_failures: payload.consecutiveFailures,
      updated_at: payload.updatedAt
    })
    .eq("id", Number(id));

  ensureNoError(response);
}

export async function createAlert(payload) {
  const response = await getClient()
    .from("alerts")
    .insert({
      user_id: payload.userId,
      tracker_id: Number(payload.trackerId),
      price_check_id: Number(payload.priceCheckId),
      recipient: payload.recipient,
      status: payload.status,
      provider_id: payload.providerId ?? null,
      sent_at: payload.sentAt ?? null,
      message: payload.message,
      error_message: payload.errorMessage ?? null,
      created_at: payload.createdAt
    })
    .select("id")
    .single();

  if (response.error) {
    throw response.error;
  }

  return Number(response.data.id);
}

export async function updateAlert(id, payload) {
  const response = await getClient()
    .from("alerts")
    .update({
      status: payload.status,
      provider_id: payload.providerId ?? null,
      sent_at: payload.sentAt ?? null,
      error_message: payload.errorMessage ?? null
    })
    .eq("id", Number(id));

  ensureNoError(response);
}
