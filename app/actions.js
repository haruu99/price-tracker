"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  countTrackers,
  createTracker,
  deleteTracker,
  getTrackerById,
  saveSettings,
  setTrackerStatus,
  updateTrackerBasics
} from "@/lib/db";
import { formatMoney } from "@/lib/format";
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

async function buildCheckFeedback(trackerId, result, emptySuccessMessage) {
  const tracker = await getTrackerById(trackerId);
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

export async function saveSettingsAction(formData) {
  const alertEmail = readAlertEmail(formData);
  const shopName = String(formData.get("shopName") || "").trim();

  if (!alertEmail || !alertEmail.includes("@")) {
    redirectWithState("/", { kind: "error", message: "Enter a valid alert email." });
  }

  await saveSettings({ shopName, alertEmail });
  revalidatePath("/");
  redirectWithState("/", { kind: "success", message: "Settings saved." });
}

export async function startTrackingAction(formData) {
  const alertEmail = readAlertEmail(formData);
  const label = String(formData.get("label") || "").trim();
  const url = String(formData.get("url") || "").trim();
  const selectorHint = String(formData.get("selectorHint") || "").trim();

  if (!alertEmail || !alertEmail.includes("@")) {
    redirectWithState("/", { kind: "error", message: "Enter a valid alert email." });
  }

  if (!url) {
    redirectWithState("/", { kind: "error", message: "Paste a competitor product URL to start tracking." });
  }

  const trackerCount = await countTrackers();
  if (trackerCount >= 10) {
    redirectWithState("/", { kind: "error", message: "The MVP is limited to 10 tracked URLs." });
  }

  await saveSettings({ shopName: "", alertEmail });

  try {
    const trackerId = await createTracker({ label, url, selectorHint });
    const result = await checkTrackerById(trackerId, { force: true });
    revalidatePath("/");
    revalidatePath(`/trackers/${trackerId}`);
    const feedback = await buildCheckFeedback(trackerId, result, "First tracker added.");
    redirectWithState("/", {
      kind: feedback.kind,
      message: feedback.message,
      trackerId,
      preview: feedback.kind === "success" && result.outcome === "ok"
    });
  } catch (error) {
    redirectWithState("/", { kind: "error", message: error instanceof Error ? error.message : "Could not start tracking." });
  }
}

export async function createTrackerAction(formData) {
  const label = String(formData.get("label") || "").trim();
  const url = String(formData.get("url") || "").trim();
  const selectorHint = String(formData.get("selectorHint") || "").trim();

  const trackerCount = await countTrackers();
  if (trackerCount >= 10) {
    redirectWithState("/", { kind: "error", message: "The MVP is limited to 10 tracked URLs." });
  }

  try {
    const trackerId = await createTracker({ label, url, selectorHint });
    const result = await checkTrackerById(trackerId, { force: true });
    revalidatePath("/");
    revalidatePath(`/trackers/${trackerId}`);
    const feedback = await buildCheckFeedback(trackerId, result, "Tracker added.");
    redirectWithState("/", {
      kind: feedback.kind,
      message: feedback.message,
      trackerId,
      preview: feedback.kind === "success" && result.outcome === "ok"
    });
  } catch (error) {
    redirectWithState("/", { kind: "error", message: error instanceof Error ? error.message : "Could not create tracker." });
  }
}

export async function checkTrackerNowAction(formData) {
  const trackerId = Number(formData.get("trackerId"));
  const from = String(formData.get("from") || "/");

  try {
    const result = await checkTrackerById(trackerId, { force: true });
    revalidatePath("/");
    revalidatePath(`/trackers/${trackerId}`);
    const feedback = await buildCheckFeedback(trackerId, result, "Tracker checked.");
    redirectWithState(from, {
      kind: feedback.kind,
      message: feedback.message,
      trackerId,
      preview: feedback.kind === "success" && result.outcome === "ok"
    });
  } catch (error) {
    redirectWithState(from, { kind: "error", message: error instanceof Error ? error.message : "Check failed." });
  }
}

export async function toggleTrackerPauseAction(formData) {
  const trackerId = Number(formData.get("trackerId"));
  const status = String(formData.get("status") || "paused");
  const from = String(formData.get("from") || "/");

  await setTrackerStatus(trackerId, status);
  revalidatePath("/");
  revalidatePath(`/trackers/${trackerId}`);
  redirectWithState(from, { kind: "success", message: status === "paused" ? "Tracker paused." : "Tracker resumed." });
}

export async function deleteTrackerAction(formData) {
  const trackerId = Number(formData.get("trackerId"));
  const from = String(formData.get("from") || "/");
  await deleteTracker(trackerId);
  revalidatePath("/");
  redirectWithState(from === `/trackers/${trackerId}` ? "/" : from, { kind: "success", message: "Tracker deleted." });
}

export async function updateTrackerAction(formData) {
  const trackerId = Number(formData.get("trackerId"));
  const label = String(formData.get("label") || "").trim();
  const selectorHint = String(formData.get("selectorHint") || "").trim();

  if (!(await getTrackerById(trackerId))) {
    redirectWithState("/", { kind: "error", message: "Tracker not found." });
  }

  await updateTrackerBasics(trackerId, { label, selectorHint });
  revalidatePath("/");
  revalidatePath(`/trackers/${trackerId}`);
  redirectWithState(`/trackers/${trackerId}`, { kind: "success", message: "Tracker updated." });
}
