// Enhanced regex patterns with better edge case handling
const TIME_24 =
  /\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b(?!\s*(AM|PM|am|pm))/g;
const TIME_12 =
  /\b(1[0-2]|0?[1-9]):([0-5]\d)(?::([0-5]\d))?\s*(AM|PM|am|pm)\b/gi;

const PROCESSED_ATTR = "data-time-converted";
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "INPUT",
  "TEXTAREA",
  "CODE",
  "PRE",
  "NOSCRIPT",
  "SVG",
]);

let currentMode = "24to12";
let isProcessing = false;

function convert24to12(match, h, m, s) {
  h = parseInt(h, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return s ? `${h}:${m}:${s} ${ampm}` : `${h}:${m} ${ampm}`;
}

function convert12to24(match, h, m, s, ap) {
  h = parseInt(h, 10);
  const isPM = ap.toUpperCase() === "PM";
  const isAM = ap.toUpperCase() === "AM";

  if (isPM && h !== 12) h += 12;
  if (isAM && h === 12) h = 0;

  const hourStr = h.toString().padStart(2, "0");
  return s ? `${hourStr}:${m}:${s}` : `${hourStr}:${m}`;
}

function walk(node, mode) {
  if (node.nodeType === Node.TEXT_NODE) {
    // Skip if parent is already processed or is a skip tag
    const parent = node.parentElement;
    if (
      !parent ||
      parent.hasAttribute(PROCESSED_ATTR) ||
      SKIP_TAGS.has(parent.tagName)
    ) {
      return;
    }

    const text = node.nodeValue;
    if (!text || text.trim().length === 0) return;

    const newText =
      mode === "24to12"
        ? text.replace(TIME_24, convert24to12)
        : text.replace(TIME_12, convert12to24);

    if (newText !== text) {
      const span = document.createElement("span");
      span.textContent = newText;
      span.setAttribute(PROCESSED_ATTR, "true");
      span.style.display = "inline";
      node.replaceWith(span);
    }
    return;
  }

  if (node.nodeType === Node.ELEMENT_NODE && !SKIP_TAGS.has(node.tagName)) {
    // Process children
    const children = Array.from(node.childNodes);
    for (const child of children) {
      walk(child, mode);
    }
  }
}

function apply(mode) {
  if (isProcessing || !document.body) return;
  isProcessing = true;

  try {
    walk(document.body, mode);
  } catch (error) {
    console.error("[Time Converter] Error applying conversion:", error);
  } finally {
    isProcessing = false;
  }
}

// Debounce function for mutation observer
let debounceTimer;
function debounce(func, delay) {
  return function (...args) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(this, args), delay);
  };
}

// Initial load
chrome.storage.sync.get({ mode: "24to12" }, ({ mode }) => {
  currentMode = mode;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => apply(currentMode));
  } else {
    apply(currentMode);
  }
});

// Observe DOM changes with debouncing to prevent excessive processing
const debouncedApply = debounce(() => {
  apply(currentMode);
}, 250);

const observer = new MutationObserver((mutations) => {
  // Only process if there are actual text changes
  const hasTextChanges = mutations.some(
    (mutation) =>
      mutation.type === "childList" &&
      (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0),
  );

  if (hasTextChanges) {
    debouncedApply();
  }
});

if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.mode) {
    currentMode = changes.mode.newValue;
  }
});
