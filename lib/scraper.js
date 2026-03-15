import { load } from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DEFAULT_BROWSER_TIMEOUT_MS = readPositiveNumber(process.env.PLAYWRIGHT_TIMEOUT_MS, 25000);
const DEFAULT_RENDER_WAIT_MS = readPositiveNumber(process.env.PLAYWRIGHT_RENDER_WAIT_MS, 1200);
const DEFAULT_NETWORK_IDLE_WAIT_MS = readPositiveNumber(process.env.PLAYWRIGHT_NETWORK_IDLE_WAIT_MS, 3500);
const BROWSER_WAIT_SELECTORS = [
  "[data-product-price]",
  "[itemprop='price']",
  ".price",
  ".product-price",
  ".money",
  'script[type="application/ld+json"]'
];

const PRICE_META_SELECTORS = [
  ['meta[property="product:price:amount"]', "product:price:amount"],
  ['meta[property="product:price:sale_amount"]', "product:price:sale_amount"],
  ['meta[property="og:price:amount"]', "og:price:amount"],
  ['meta[itemprop="price"]', "meta[itemprop=price]"],
  ['meta[name="price"]', "meta[name=price]"]
];

const CURRENCY_META_SELECTORS = [
  'meta[property="product:price:currency"]',
  'meta[property="og:price:currency"]',
  'meta[itemprop="priceCurrency"]',
  'meta[name="currency"]'
];

const SHOPIFY_SELECTORS = [
  [".price__current .price-item--sale", "shopify:price-item-sale"],
  [".price__current .price-item--last", "shopify:price-item-last"],
  [".price__current .price-item--regular", "shopify:price-item-regular"],
  [".product__info-container .price-item--sale", "shopify:product-info-sale"],
  [".product__info-container .price-item--last", "shopify:product-info-last"],
  [".product__info-container .price-item--regular", "shopify:product-info-regular"],
  [".price .money", "shopify:money"],
  ["[data-product-price]", "shopify:data-product-price"]
];

const HEURISTIC_SELECTORS = [
  "[data-product-price]",
  "[data-price]",
  "[data-test*='price' i]",
  "[class*='price' i]",
  "[id*='price' i]",
  "[itemprop='price']",
  ".price",
  ".product-price",
  ".money"
];

const CURRENCY_SYMBOLS = {
  $: "USD",
  "£": "GBP",
  "€": "EUR",
  "¥": "JPY",
  "₹": "INR",
  "C$": "CAD",
  "A$": "AUD"
};

let browserPromise = null;

export async function fetchPage(url) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "en-US,en;q=0.9",
      accept: "text/html,application/xhtml+xml"
    }
  });

  return {
    ok: response.ok,
    status: response.status,
    finalUrl: response.url,
    html: await response.text()
  };
}

export async function scrapePrice(url, selectorHint = "") {
  const htmlAttempt = await attemptPriceResolution({
    url,
    selectorHint,
    fetchMode: "html",
    fetcher: fetchPage
  });

  if (htmlAttempt.success || !browserFallbackEnabled()) {
    return htmlAttempt;
  }

  const browserAttempt = await attemptPriceResolution({
    url,
    selectorHint,
    fetchMode: "browser",
    fetcher: fetchBrowserPage
  });

  if (browserAttempt.success) {
    return browserAttempt;
  }

  return {
    success: false,
    outcome: htmlAttempt.outcome,
    httpStatus: browserAttempt.httpStatus ?? htmlAttempt.httpStatus,
    pageTitle: browserAttempt.pageTitle || htmlAttempt.pageTitle,
    errorMessage: [
      `HTML fetch: ${htmlAttempt.errorMessage}`,
      `Browser fallback: ${browserAttempt.errorMessage}`
    ].join(" "),
    fetchMode: browserAttempt.fetchMode
  };
}

export function extractPrice(html, pageUrl, selectorHint = "") {
  const $ = load(html);
  const pageTitle = $("title").first().text().trim() || $('meta[property="og:title"]').attr("content")?.trim() || "";
  const currencyHint = readCurrencyMeta($);

  const selectorResult = selectorHint ? extractWithSelector($, selectorHint, currencyHint) : null;
  if (selectorResult) {
    return { ...selectorResult, pageTitle };
  }

  const jsonLd = extractJsonLdPrice($);
  if (jsonLd) {
    return { ...jsonLd, pageTitle };
  }

  const shopify = extractShopifyPrice($, currencyHint);
  if (shopify) {
    return { ...shopify, pageTitle };
  }

  const meta = extractMetaPrice($, currencyHint);
  if (meta) {
    return { ...meta, pageTitle };
  }

  const semantic = extractSemanticPrice($, currencyHint);
  if (semantic) {
    return { ...semantic, pageTitle };
  }

  const heuristic = extractHeuristicPrice($, currencyHint);
  if (heuristic) {
    return { ...heuristic, pageTitle };
  }

  return {
    pageTitle,
    error: `Couldn't find a reliable price on ${new URL(pageUrl).hostname}.`
  };
}

async function fetchBrowserPage(url) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: "en-US",
    viewport: { width: 1440, height: 960 }
  });
  const page = await context.newPage();

  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (["image", "media", "font"].includes(type)) {
      return route.abort();
    }

    return route.continue();
  });

  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: DEFAULT_BROWSER_TIMEOUT_MS
    });

    await waitForPriceSignals(page);

    return {
      ok: response ? response.ok() : true,
      status: response?.status() ?? null,
      finalUrl: page.url(),
      html: await page.content()
    };
  } finally {
    await context.close();
  }
}

async function attemptPriceResolution({ url, selectorHint, fetchMode, fetcher }) {
  let page;

  try {
    page = await fetcher(url);
  } catch (error) {
    return {
      success: false,
      outcome: "fetch_error",
      errorMessage: normalizeBrowserError(error, fetchMode),
      fetchMode
    };
  }

  if (!page.ok) {
    return {
      success: false,
      outcome: "fetch_error",
      httpStatus: page.status,
      pageTitle: page.pageTitle || "",
      errorMessage: `Page returned HTTP ${page.status ?? "unknown status"}.`,
      fetchMode
    };
  }

  const extraction = extractPrice(page.html, page.finalUrl || url, selectorHint);
  if (!("priceMinor" in extraction)) {
    return {
      success: false,
      outcome: "parse_error",
      httpStatus: page.status,
      pageTitle: extraction.pageTitle,
      errorMessage: extraction.error,
      fetchMode
    };
  }

  return {
    success: true,
    outcome: "ok",
    fetchMode,
    httpStatus: page.status,
    pageTitle: extraction.pageTitle,
    priceMinor: extraction.priceMinor,
    currency: extraction.currency,
    rawPriceText: extraction.rawPriceText,
    extractedFrom: fetchMode === "browser" ? `browser:${extraction.extractedFrom}` : extraction.extractedFrom
  };
}

function extractWithSelector($, selector, currencyHint) {
  try {
    const node = $(selector).first();
    if (!node.length) {
      return null;
    }

    const value =
      node.attr("content") ||
      node.attr("value") ||
      node.attr("data-price") ||
      node.attr("data-product-price") ||
      node.text();

    const parsed = parsePriceText(value, currencyHint);
    if (!parsed) {
      return null;
    }

    return {
      ...parsed,
      extractedFrom: `selector:${selector}`
    };
  } catch {
    return null;
  }
}

function extractMetaPrice($, currencyHint) {
  for (const [selector, label] of PRICE_META_SELECTORS) {
    const value = $(selector).attr("content");
    const parsed = parsePriceText(value, currencyHint);
    if (parsed) {
      return {
        ...parsed,
        extractedFrom: label
      };
    }
  }

  return null;
}

function extractSemanticPrice($, currencyHint) {
  const candidates = [
    $("meta[itemprop='price']").attr("content"),
    $("[itemprop='price']").first().attr("content"),
    $("[itemprop='price']").first().text()
  ];

  for (const candidate of candidates) {
    const parsed = parsePriceText(candidate, currencyHint);
    if (parsed) {
      return {
        ...parsed,
        extractedFrom: "semantic"
      };
    }
  }

  return null;
}

function extractShopifyPrice($, currencyHint) {
  for (const [selector, label] of SHOPIFY_SELECTORS) {
    const node = $(selector).first();
    if (!node.length) {
      continue;
    }

    const candidateText = [node.attr("content"), node.attr("data-price"), node.text()].filter(Boolean).find(Boolean);
    if (!candidateText || isLikelyReferencePrice(node, candidateText)) {
      continue;
    }

    const parsed = parsePriceText(candidateText, currencyHint);
    if (parsed) {
      return {
        ...parsed,
        extractedFrom: label
      };
    }
  }

  return null;
}

function extractHeuristicPrice($, currencyHint) {
  const seen = new Set();

  for (const selector of HEURISTIC_SELECTORS) {
    const nodes = $(selector).slice(0, 18).toArray();
    for (const element of nodes) {
      const node = $(element);
      const candidateText = [
        node.attr("content"),
        node.attr("data-price"),
        node.attr("data-product-price"),
        node.text()
      ]
        .filter(Boolean)
        .map((value) => String(value).trim())
        .find(Boolean);

      if (!candidateText || seen.has(candidateText)) {
        continue;
      }

      if (isLikelyReferencePrice(node, candidateText)) {
        continue;
      }

      seen.add(candidateText);
      const parsed = parsePriceText(candidateText, currencyHint);
      if (parsed) {
        return {
          ...parsed,
          extractedFrom: `heuristic:${selector}`
        };
      }
    }
  }

  return null;
}

function readCurrencyMeta($) {
  for (const selector of CURRENCY_META_SELECTORS) {
    const value = $(selector).attr("content") || $(selector).attr("value");
    if (value) {
      return String(value).trim().toUpperCase();
    }
  }

  return null;
}

function extractJsonLdPrice($) {
  const scripts = $('script[type="application/ld+json"]').toArray();

  for (const script of scripts) {
    const raw = $(script).contents().text();
    if (!raw) {
      continue;
    }

    const parsedJson = safeParseJson(raw);
    if (!parsedJson) {
      continue;
    }

    const candidate = findPriceInStructuredData(parsedJson);
    if (candidate) {
      const parsed = parsePriceText(String(candidate.price), candidate.currency || null);
      if (parsed) {
        return {
          ...parsed,
          extractedFrom: candidate.source || "json-ld"
        };
      }
    }
  }

  return null;
}

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function findPriceInStructuredData(value) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPriceInStructuredData(item);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  if (typeof value.price === "string" || typeof value.price === "number") {
    return {
      price: value.price,
      currency: value.priceCurrency || value.price_currency || null,
      source: "json-ld:price"
    };
  }

  if (typeof value.lowPrice === "string" || typeof value.lowPrice === "number") {
    return {
      price: value.lowPrice,
      currency: value.priceCurrency || null,
      source: "json-ld:lowPrice"
    };
  }

  if (value.offers) {
    const foundOffer = findPriceInStructuredData(value.offers);
    if (foundOffer) {
      return foundOffer;
    }
  }

  for (const nested of Object.values(value)) {
    const found = findPriceInStructuredData(nested);
    if (found) {
      return found;
    }
  }

  return null;
}

function parsePriceText(input, currencyHint) {
  if (!input) {
    return null;
  }

  const text = String(input).replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }

  const withCurrency =
    text.match(/(C\$|A\$|[$£€¥₹]|USD|GBP|EUR|CAD|AUD|JPY|INR)\s*([0-9][0-9.,]*)/i) ||
    text.match(/([0-9][0-9.,]*)\s*(USD|GBP|EUR|CAD|AUD|JPY|INR)/i);

  const numberMatch = withCurrency ? withCurrency[2] || withCurrency[1] : text.match(/[0-9][0-9.,]*/)?.[0];
  if (!numberMatch) {
    return null;
  }

  const value = normalizeNumberString(numberMatch);
  if (value === null || value <= 0 || value > 1000000) {
    return null;
  }

  const token = withCurrency?.[1] || withCurrency?.[2] || detectCurrencySymbol(text) || currencyHint || "USD";
  const currency = normalizeCurrency(token);

  return {
    priceMinor: Math.round(value * 100),
    currency,
    rawPriceText: text
  };
}

function detectCurrencySymbol(text) {
  for (const symbol of Object.keys(CURRENCY_SYMBOLS)) {
    if (text.includes(symbol)) {
      return symbol;
    }
  }
  return null;
}

function normalizeCurrency(value) {
  const token = String(value || "")
    .trim()
    .toUpperCase();

  if (CURRENCY_SYMBOLS[token]) {
    return CURRENCY_SYMBOLS[token];
  }

  if (/^[A-Z]{3}$/.test(token)) {
    return token;
  }

  return "USD";
}

function isLikelyReferencePrice(node, text) {
  const className = `${node.attr("class") || ""} ${node.attr("id") || ""}`.toLowerCase();
  const normalizedText = String(text).trim().toLowerCase();

  const blockedMarkers = ["compare", "original", "was ", "save ", "you save", "unit price", "badge", "off "];
  return blockedMarkers.some((marker) => className.includes(marker) || normalizedText.includes(marker));
}

function normalizeNumberString(value) {
  let sanitized = String(value).replace(/[^0-9.,]/g, "");
  if (!sanitized) {
    return null;
  }

  const hasComma = sanitized.includes(",");
  const hasDot = sanitized.includes(".");

  if (hasComma && hasDot) {
    if (sanitized.lastIndexOf(",") > sanitized.lastIndexOf(".")) {
      sanitized = sanitized.replace(/\./g, "").replace(",", ".");
    } else {
      sanitized = sanitized.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = sanitized.split(",");
    const last = parts.at(-1) || "";
    sanitized = last.length === 2 ? parts.slice(0, -1).join("") + "." + last : parts.join("");
  }

  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

function browserFallbackEnabled() {
  return process.env.PLAYWRIGHT_FALLBACK === "1";
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((error) => {
      browserPromise = null;
      throw error;
    });
  }

  return browserPromise;
}

async function launchBrowser() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= "0";
  const { chromium } = await import("playwright");
  return chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== "0",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
}

async function waitForPriceSignals(page) {
  try {
    await page.waitForFunction(
      (selectors) =>
        selectors.some((selector) => document.querySelector(selector)) ||
        Boolean(document.querySelector('script[type="application/ld+json"]')),
      BROWSER_WAIT_SELECTORS,
      { timeout: Math.min(DEFAULT_BROWSER_TIMEOUT_MS, 4000) }
    );
  } catch {
    // Some pages never become fully idle even though the price is present.
  }

  await page.waitForLoadState("networkidle", { timeout: DEFAULT_NETWORK_IDLE_WAIT_MS }).catch(() => {});
  await page.waitForTimeout(DEFAULT_RENDER_WAIT_MS);
}

function normalizeBrowserError(error, fetchMode) {
  if (!(error instanceof Error)) {
    return fetchMode === "browser" ? "Browser fallback failed." : "Request failed.";
  }

  if (fetchMode === "browser" && /Executable doesn't exist|browserType\.launch/i.test(error.message)) {
    return "Browser fallback is not installed yet. Run `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium`.";
  }

  return error.message;
}

function readPositiveNumber(input, fallbackValue) {
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}
