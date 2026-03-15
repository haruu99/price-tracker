const TRACKING_PARAM_PREFIXES = ["utm_", "fbclid", "gclid", "mc_", "ref", "ref_", "source"];

export function normalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    throw new Error("Enter a product URL first.");
  }

  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS product URLs are supported.");
  }

  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();

  if ((parsed.protocol === "https:" && parsed.port === "443") || (parsed.protocol === "http:" && parsed.port === "80")) {
    parsed.port = "";
  }

  const nextParams = new URLSearchParams();
  for (const [key, value] of parsed.searchParams.entries()) {
    const lowered = key.toLowerCase();
    const shouldDrop = TRACKING_PARAM_PREFIXES.some((prefix) => lowered === prefix || lowered.startsWith(prefix));
    if (!shouldDrop) {
      nextParams.append(key, value);
    }
  }

  parsed.search = nextParams.toString();
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";

  return {
    url: parsed.toString(),
    domain: parsed.hostname.replace(/^www\./, "")
  };
}
