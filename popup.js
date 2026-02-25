const options = document.querySelectorAll(".option");
const statusEl = document.getElementById("status");
const globalToggleInput = document.getElementById("globalToggle");
const siteToggleInput = document.getElementById("siteToggle");
const siteHostEl = document.getElementById("siteHost");
const siteToggleRow = document.getElementById("siteToggleRow");

let currentMode = "24to12";
let isApplying = false;
let currentHostname = "";
let disabledSites = [];  // blacklist: excluded when global is ON
let enabledSites = [];   // whitelist: included when global is OFF
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
  // Before the hostname is resolved, use the global flag as a best guess.
  // initSiteToggle calls this again once currentHostname is known.
  const siteActive = currentHostname
    ? globallyEnabled
      ? !disabledSites.includes(currentHostname)
      : enabledSites.includes(currentHostname)
    : globallyEnabled;
  options.forEach((opt) => opt.classList.toggle("dimmed", !siteActive));
}

// Reflect whether the current site is active (accounts for both global mode and site lists)
function refreshSiteToggle() {
  if (!currentHostname) return;
  const isActive = globallyEnabled
    ? !disabledSites.includes(currentHostname)
    : enabledSites.includes(currentHostname);
  siteToggleInput.checked = isActive;
}

// Sends the current state to the active tab's content script.
// Returns true if delivered, false if the tab has no content script.
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
      enabledSites,
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
    // Reflect the correct active state for the current site after global change
    refreshSiteToggle();
    updateOptionsState();
    await notifyContentScript();
    showStatus(newState ? "Enabled for all sites" : "Disabled for all sites");
  } catch (err) {
    console.error("Error toggling global state:", err);
    globallyEnabled = prevState;
    globalToggleInput.checked = prevState;
    refreshSiteToggle();
    updateOptionsState();
    showStatus("Failed to toggle", true);
  } finally {
    isApplying = false;
    setLoading(false);
  }
}

async function toggleSite() {
  if (isApplying || !currentHostname) return;

  const siteActive = siteToggleInput.checked; // checked = site is ON
  const prevDisabledSites = [...disabledSites];
  const prevEnabledSites = [...enabledSites];
  isApplying = true;
  setLoading(true);

  if (globallyEnabled) {
    // Blacklist mode: toggling OFF adds to disabledSites, ON removes
    disabledSites = siteActive
      ? disabledSites.filter((s) => s !== currentHostname)
      : [...disabledSites, currentHostname];
  } else {
    // Whitelist mode: toggling ON adds to enabledSites, OFF removes
    enabledSites = siteActive
      ? [...enabledSites.filter((s) => s !== currentHostname), currentHostname]
      : enabledSites.filter((s) => s !== currentHostname);
  }

  try {
    await chrome.storage.sync.set({ disabledSites, enabledSites });
    await notifyContentScript();
    updateOptionsState();
    showStatus(siteActive ? "Enabled for this site" : "Disabled for this site");
  } catch (err) {
    console.error("Error toggling site:", err);
    disabledSites = prevDisabledSites;
    enabledSites = prevEnabledSites;
    siteToggleInput.checked = !siteActive;
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
      siteToggleRow.style.display = "flex";
      refreshSiteToggle();
      updateOptionsState();
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
  { mode: "24to12", disabledSites: [], enabledSites: [], globallyEnabled: false },
  (data) => {
    currentMode = data.mode;
    disabledSites = data.disabledSites;
    enabledSites = data.enabledSites;
    globallyEnabled = data.globallyEnabled;

    updateSelection(currentMode);
    globalToggleInput.checked = globallyEnabled;
    updateOptionsState(); // preliminary: dims options before hostname is resolved
    initSiteToggle();     // refines once hostname is known
  },
);

options.forEach((opt) =>
  opt.addEventListener("click", () => applyMode(opt.dataset.mode)),
);
globalToggleInput.addEventListener("change", toggleGlobal);
siteToggleInput.addEventListener("change", toggleSite);
