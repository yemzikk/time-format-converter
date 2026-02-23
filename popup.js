const options = document.querySelectorAll(".option");
const statusEl = document.getElementById("status");
const globalToggleInput = document.getElementById("globalToggle");
const siteToggleInput = document.getElementById("siteToggle");
const siteHostEl = document.getElementById("siteHost");
const siteToggleRow = document.getElementById("siteToggleRow");

let currentMode = "24to12";
let isApplying = false;
let currentHostname = "";
let disabledSites = [];
let globallyEnabled = false;

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = `status ${isError ? "error" : "success"} show`;
  setTimeout(() => statusEl.classList.remove("show"), 2000);
}

function setLoading(loading) {
  options.forEach((opt) => (opt.disabled = loading));
  globalToggleInput.disabled = loading;
  siteToggleInput.disabled = loading;
}

function updateSelection(mode) {
  options.forEach((opt) => {
    const isActive = opt.dataset.mode === mode;
    opt.classList.toggle("active", isActive);
    opt.setAttribute("aria-checked", isActive);
  });
}

function updateOptionsState() {
  options.forEach((opt) => opt.classList.toggle("dimmed", !globallyEnabled));
}

function updateGlobalUI() {
  siteToggleRow.style.display = globallyEnabled ? "flex" : "none";
}

// Sends the current state to the active tab's content script.
// Returns true if the message was delivered, false if the tab has no content script.
async function notifyContentScript() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return false;
    await chrome.tabs.sendMessage(tab.id, {
      action: "updateState",
      mode: currentMode,
      globallyEnabled,
      disabledSites,
    });
    return true;
  } catch {
    // Tab has no content script (chrome://, about:, PDF, etc.)
    return false;
  }
}

async function applyMode(mode) {
  if (isApplying) return;

  const prevMode = currentMode;
  currentMode = mode;
  isApplying = true;
  setLoading(true);
  updateSelection(mode);

  try {
    await chrome.storage.sync.set({ mode });
    const reached = await notifyContentScript();
    showStatus(reached ? "Applied" : "Saved");
  } catch (err) {
    console.error("Error:", err);
    currentMode = prevMode;
    updateSelection(prevMode);
    showStatus("Failed to apply", true);
  } finally {
    isApplying = false;
    setLoading(false);
  }
}

async function toggleGlobal() {
  if (isApplying) return;

  const newState = globalToggleInput.checked;
  const prevState = !newState;
  isApplying = true;
  setLoading(true);

  try {
    await chrome.storage.sync.set({ globallyEnabled: newState });
    globallyEnabled = newState;
    updateGlobalUI();
    updateOptionsState();
    const reached = await notifyContentScript();
    showStatus(newState ? "Enabled for all sites" : "Disabled for all sites");
    if (!reached && newState) {
      // Content script not reachable on this tab type; state is saved
    }
  } catch (err) {
    console.error("Error toggling global state:", err);
    globallyEnabled = prevState;
    globalToggleInput.checked = prevState;
    updateGlobalUI();
    updateOptionsState();
    showStatus("Failed to toggle", true);
  } finally {
    isApplying = false;
    setLoading(false);
  }
}

async function toggleSite() {
  if (isApplying || !currentHostname) return;

  const siteEnabled = siteToggleInput.checked; // checked = site is ON
  const prevDisabledSites = [...disabledSites];
  isApplying = true;
  setLoading(true);

  // checked means site is enabled → remove from disabled list
  disabledSites = siteEnabled
    ? disabledSites.filter((s) => s !== currentHostname)
    : [...disabledSites, currentHostname];

  try {
    await chrome.storage.sync.set({ disabledSites });
    await notifyContentScript();
    showStatus(siteEnabled ? "Enabled for this site" : "Disabled for this site");
  } catch (err) {
    console.error("Error toggling site:", err);
    disabledSites = prevDisabledSites;
    siteToggleInput.checked = !siteEnabled;
    showStatus("Failed to toggle", true);
  } finally {
    isApplying = false;
    setLoading(false);
  }
}

async function initSiteToggle() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab?.url) {
      const url = new URL(tab.url);
      currentHostname = url.hostname;
      siteHostEl.textContent = currentHostname;
      siteToggleInput.checked = !disabledSites.includes(currentHostname);
    } else {
      siteToggleRow.style.display = "none";
    }
  } catch (err) {
    console.error("Error getting tab:", err);
    siteToggleRow.style.display = "none";
  }
}

// Bootstrap
chrome.storage.sync.get(
  { mode: "24to12", disabledSites: [], globallyEnabled: false },
  (data) => {
    currentMode = data.mode;
    disabledSites = data.disabledSites;
    globallyEnabled = data.globallyEnabled;

    updateSelection(currentMode);
    globalToggleInput.checked = globallyEnabled;
    updateGlobalUI();
    updateOptionsState();
    initSiteToggle();
  },
);

options.forEach((opt) =>
  opt.addEventListener("click", () => applyMode(opt.dataset.mode)),
);
globalToggleInput.addEventListener("change", toggleGlobal);
siteToggleInput.addEventListener("change", toggleSite);
