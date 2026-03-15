import nodemailer from "nodemailer";
import { formatMoney } from "./format.js";

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });
}

export function emailDeliveryReady() {
  return Boolean(process.env.ALERT_FROM_EMAIL && (process.env.RESEND_API_KEY || getTransport()));
}

export async function sendPriceAlert({ tracker, recipient, previousPriceMinor, currentPriceMinor, currency }) {
  const from = process.env.ALERT_FROM_EMAIL;

  if (!from) {
    return {
      status: "logged"
    };
  }

  const subject = `${tracker.label || tracker.domain} price changed`;
  const previousPrice = formatMoney(previousPriceMinor, currency);
  const currentPrice = formatMoney(currentPriceMinor, currency);
  const appUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const detailUrl = `${appUrl}/trackers/${tracker.id}`;

  const payload = {
    from,
    to: recipient,
    subject,
    text: [
      `${tracker.label || tracker.domain} changed price.`,
      `Old price: ${previousPrice}`,
      `New price: ${currentPrice}`,
      `Product URL: ${tracker.url}`,
      `Tracker detail: ${detailUrl}`
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #1b2a1d;">
        <h2>${escapeHtml(tracker.label || tracker.domain)} changed price</h2>
        <p><strong>Old price:</strong> ${escapeHtml(previousPrice)}</p>
        <p><strong>New price:</strong> ${escapeHtml(currentPrice)}</p>
        <p><a href="${detailUrl}">Open tracker detail</a></p>
        <p><a href="${tracker.url}">Open product page</a></p>
      </div>
    `
  };

  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Resend delivery failed with HTTP ${response.status}. ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();
    return {
      status: "sent",
      providerId: data.id || null,
      sentAt: new Date().toISOString()
    };
  }

  const transport = getTransport();
  if (!transport) {
    return {
      status: "logged"
    };
  }

  const info = await transport.sendMail(payload);

  return {
    status: "sent",
    providerId: info.messageId,
    sentAt: new Date().toISOString()
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
