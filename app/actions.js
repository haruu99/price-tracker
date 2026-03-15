"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  countTrackers,
  createTracker,
  deleteTracker,
  getTrackerById,
  setTrackerStatus,
  updateProfile,
  updateTrackerBasics
} from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { requireCurrentAccount } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkTrackerById } from "@/lib/tracker-service";

function redirectWithState(path, state) {
  const nextParams = new URLSearchParams();
  if (state.kind) nextParams.set("kind", state.kind);
  if (state.message) nextParams.set("message", state.message);
  if (state.trackerId) nextParams.set("tracker", String(state.trackerId));
  if (state.preview) nextParams.set("preview", "1");
  const query = nextParams.toString();
  const nextPath = query ? `${path}?${query}` : path;
  redirect(nextPath);
}

function readAlertEmail(formData) {
  return String(formData.get("alertEmail") || "")
    .trim()
    .toLowerCase();
}

async function buildCheckFeedback(userId, trackerId, result, emptySuccessMessage) {
  const tracker = await getTrackerById(trackerId, userId);
  const trackerName = tracker?.label || result.pageTitle || tracker?.domain || "Product";

  if (result.outcome && result.outcome !== "ok") {
    return {
      kind: "error",
      message: `Tracker saved, but the price could not be confirmed yet. ${result.errorMessage || "Try Advanced options if the page is tricky."}`
    };
  }

  if (result.currentPriceMinor !== null && result.currentPriceMinor !== undefined) {
    return {
      kind: "success",
      message: `${trackerName} detected at ${formatMoney(result.currentPriceMinor, result.currency || tracker?.currency || "USD")}.`
    };
  }

  return {
    kind: "success",
    message: emptySuccessMessage
  };
}

export async function updateProfileAction(formData) {
  const { user } = await requireCurrentAccount();
  const alertEmail = readAlertEmail(formData);
  const displayName = String(formData.get("displayName") || "").trim();

  if (!alertEmail || !alertEmail.includes("@")) {
    redirectWithState("/", { kind: "error", message: "Enter a valid alert email." });
  }

  await updateProfile(user.id, { alertEmail, displayName });
  revalidatePath("/");
  redirectWithState("/", { kind: "success", message: "Account updated." });
}

export async function createTrackerAction(formData) {
  const { user, profile } = await requireCurrentAccount();
  const label = String(formData.get("label") || "").trim();
  const url = String(formData.get("url") || "").trim();
  const selectorHint = String(formData.get("selectorHint") || "").trim();

  if (!url) {
    redirectWithState("/", { kind: "error", message: "Paste a competitor product URL to start tracking." });
  }

  const trackerCount = await countTrackers(user.id);
  const trackerLimit = Number(profile.url_limit || 10);
  if (trackerCount >= trackerLimit) {
    redirectWithState("/", { kind: "error", message: `Your current plan is limited to ${trackerLimit} tracked URLs.` });
  }

  let trackerId;
  let result;

  try {
    trackerId = await createTracker({ userId: user.id, label, url, selectorHint });
    result = await checkTrackerById(trackerId, { force: true, userId: user.id });
  } catch (error) {
    redirectWithState("/", { kind: "error", message: error instanceof Error ? error.message : "Could not create tracker." });
  }

  revalidatePath("/");
  revalidatePath(`/trackers/${trackerId}`);
  const feedback = await buildCheckFeedback(user.id, trackerId, result, "Tracker added.");
  redirectWithState("/", {
    kind: feedback.kind,
    message: feedback.message,
    trackerId,
    preview: feedback.kind === "success" && result.outcome === "ok"
  });
}

export async function checkTrackerNowAction(formData) {
  const { user } = await requireCurrentAccount();
  const trackerId = Number(formData.get("trackerId"));
  const from = String(formData.get("from") || "/");

  let result;

  try {
    result = await checkTrackerById(trackerId, { force: true, userId: user.id });
  } catch (error) {
    redirectWithState(from, { kind: "error", message: error instanceof Error ? error.message : "Check failed." });
  }

  revalidatePath("/");
  revalidatePath(`/trackers/${trackerId}`);
  const feedback = await buildCheckFeedback(user.id, trackerId, result, "Tracker checked.");
  redirectWithState(from, {
    kind: feedback.kind,
    message: feedback.message,
    trackerId,
    preview: feedback.kind === "success" && result.outcome === "ok"
  });
}

export async function toggleTrackerPauseAction(formData) {
  const { user } = await requireCurrentAccount();
  const trackerId = Number(formData.get("trackerId"));
  const status = String(formData.get("status") || "paused");
  const from = String(formData.get("from") || "/");

  await setTrackerStatus(trackerId, user.id, status);
  revalidatePath("/");
  revalidatePath(`/trackers/${trackerId}`);
  redirectWithState(from, { kind: "success", message: status === "paused" ? "Tracker paused." : "Tracker resumed." });
}

export async function deleteTrackerAction(formData) {
  const { user } = await requireCurrentAccount();
  const trackerId = Number(formData.get("trackerId"));
  const from = String(formData.get("from") || "/");
  await deleteTracker(trackerId, user.id);
  revalidatePath("/");
  redirectWithState(from === `/trackers/${trackerId}` ? "/" : from, { kind: "success", message: "Tracker deleted." });
}

export async function updateTrackerAction(formData) {
  const { user } = await requireCurrentAccount();
  const trackerId = Number(formData.get("trackerId"));
  const label = String(formData.get("label") || "").trim();
  const selectorHint = String(formData.get("selectorHint") || "").trim();

  if (!(await getTrackerById(trackerId, user.id))) {
    redirectWithState("/", { kind: "error", message: "Tracker not found." });
  }

  await updateTrackerBasics(trackerId, { userId: user.id, label, selectorHint });
  revalidatePath("/");
  revalidatePath(`/trackers/${trackerId}`);
  redirectWithState(`/trackers/${trackerId}`, { kind: "success", message: "Tracker updated." });
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  redirectWithState("/", { kind: "success", message: "Signed out." });
}
