// Enhanced regex patterns with better edge case handling
const TIME_24 =
  /\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b(?!\s*(AM|PM|am|pm))/g;
const TIME_12 =
  /\b(1[0-2]|0?[1-9]):([0-5]\d)(?::([0-5]\d))?\s*(AM|PM|am|pm)\b/gi;

const PROCESSED_ATTR = "data-time-converted";
const ORIGINAL_ATTR = "data-original";
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
let isReverting = false;
let isDisabledForSite = false;
let globallyEnabled = false;
let disabledSites = []; // fix: module-level variable so storage.onChanged can read it
let debounceTimer;

const currentHostname = window.location.hostname;

function convert24to12(match, h, m, s) {
  h = parseInt(h, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return s ? `${h}:${m}:${s} ${ampm}` : `${h}:${m} ${ampm}`;
}

function convert12to24(_match, h, m, s, ap) {
  h = parseInt(h, 10);
  if (ap.toUpperCase() === "PM" && h !== 12) h += 12;
  if (ap.toUpperCase() === "AM" && h === 12) h = 0;
  const hourStr = h.toString().padStart(2, "0");
  return s ? `${hourStr}:${m}:${s}` : `${hourStr}:${m}`;
}

function walk(node, mode) {
  if (node.nodeType === Node.TEXT_NODE) {
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
      span.setAttribute(ORIGINAL_ATTR, text); // store original for instant revert
      span.style.display = "inline";
      node.replaceWith(span);
    }
    return;
  }

  if (node.nodeType === Node.ELEMENT_NODE && !SKIP_TAGS.has(node.tagName)) {
    for (const child of Array.from(node.childNodes)) {
      walk(child, mode);
    }
  }
}

// Restores all converted spans back to their original text nodes
function revert() {
  if (!document.body) return;
  isReverting = true;
  clearTimeout(debounceTimer); // cancel any pending debounced apply
  try {
    for (const el of document.querySelectorAll(`[${PROCESSED_ATTR}]`)) {
      const original = el.getAttribute(ORIGINAL_ATTR);
      if (original !== null) {
        el.replaceWith(document.createTextNode(original));
      }
    }
  } finally {
    isReverting = false;
  }
}

function apply(mode) {
  if (isProcessing || !document.body || isDisabledForSite) return;
  isProcessing = true;
  try {
    walk(document.body, mode);
  } catch (error) {
    console.error("[Time Converter] Error applying conversion:", error);
  } finally {
    isProcessing = false;
  }
}

function debouncedApply() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (!isReverting && !isDisabledForSite) apply(currentMode);
  }, 250);
}

// Initial load
chrome.storage.sync.get(
  { mode: "24to12", disabledSites: [], globallyEnabled: false },
  ({ mode, disabledSites: sites, globallyEnabled: enabled }) => {
    currentMode = mode;
    globallyEnabled = enabled;
    disabledSites = sites;
    isDisabledForSite = !globallyEnabled || disabledSites.includes(currentHostname);

    if (!isDisabledForSite) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => apply(currentMode));
      } else {
        apply(currentMode);
      }
    }
  },
);

// Observe DOM changes for dynamically loaded content
const observer = new MutationObserver((mutations) => {
  if (isReverting || isDisabledForSite) return;
  const hasTextChanges = mutations.some(
    (mutation) =>
      mutation.type === "childList" &&
      (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0),
  );
  if (hasTextChanges) debouncedApply();
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
}

// Listen for instant state updates from the popup (no page reload needed)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "updateState") {
    const {
      mode: newMode,
      globallyEnabled: newGloballyEnabled,
      disabledSites: newDisabledSites,
    } = message;

    const wasDisabled = isDisabledForSite;
    const modeChanged = newMode !== currentMode;

    currentMode = newMode;
    globallyEnabled = newGloballyEnabled;
    disabledSites = newDisabledSites;
    isDisabledForSite =
      !globallyEnabled || disabledSites.includes(currentHostname);

    if (isDisabledForSite) {
      if (!wasDisabled) revert(); // was on, now off — revert
    } else {
      if (modeChanged) revert(); // switching mode — revert then re-apply
      apply(currentMode); // apply (idempotent; handles newly loaded content too)
    }

    sendResponse({ success: true });
  }
  return true;
});

// Sync state changes from other tabs / popup instances
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.mode) currentMode = changes.mode.newValue;
  if (changes.globallyEnabled) globallyEnabled = changes.globallyEnabled.newValue;
  if (changes.disabledSites) disabledSites = changes.disabledSites.newValue;

  // Recompute disabled state (the popup message handler already handles the
  // current tab; this covers changes coming from other contexts)
  isDisabledForSite =
    !globallyEnabled || disabledSites.includes(currentHostname);
});
