const options = document.querySelectorAll(".option");
const statusEl = document.getElementById("status");
const siteToggle = document.getElementById("siteToggle");
const siteHostEl = document.getElementById("siteHost");
const globalToggle = document.getElementById("globalToggle");
const siteToggleContainer = document.getElementById("siteToogleContainer");

let currentMode = "24to12";
let isApplying = false;
let currentHostname = "";
let disabledSites = [];
let globallyEnabled = false;

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = `status ${isError ? "error" : "success"} show`;

  setTimeout(() => {
    statusEl.classList.remove("show");
  }, 2000);
}

function updateSelection(mode) {
  options.forEach((opt) => {
    const isActive = opt.dataset.mode === mode;
    opt.classList.toggle("active", isActive);
    opt.setAttribute("aria-checked", isActive);
  });
  currentMode = mode;
}

async function applyMode(mode) {
  if (isApplying || mode === currentMode) return;

  isApplying = true;
  updateSelection(mode);

  try {
    await chrome.storage.sync.set({ mode });

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab?.id) {
      await chrome.tabs.reload(tab.id);
      showStatus("Applied");
    } else {
      showStatus("Saved");
    }
  } catch (err) {
    console.error("Error:", err);
    showStatus("Failed to apply", true);
    updateSelection(currentMode);
  } finally {
    isApplying = false;
  }
}

function updateGlobalToggle(enabled) {
  const toggleText = globalToggle.querySelector(".toggle-text");
  if (enabled) {
    toggleText.textContent = "Disable for all sites";
    globalToggle.classList.add("enabled");
    siteToggleContainer.style.display = "block";
  } else {
    toggleText.textContent = "Enable for all sites";
    globalToggle.classList.remove("enabled");
    siteToggleContainer.style.display = "none";
  }
}

function updateSiteToggle(isDisabled) {
  const toggleText = siteToggle.querySelector(".toggle-text");
  if (isDisabled) {
    toggleText.textContent = "Enable for this site";
    siteToggle.classList.add("disabled");
  } else {
    toggleText.textContent = "Disable for this site";
    siteToggle.classList.remove("disabled");
  }
}

async function toggleGlobal() {
  const newState = !globallyEnabled;

  try {
    await chrome.storage.sync.set({ globallyEnabled: newState });
    globallyEnabled = newState;
    updateGlobalToggle(newState);

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab?.id) {
      await chrome.tabs.reload(tab.id);
      showStatus(newState ? "Enabled for all sites" : "Disabled for all sites");
    }
  } catch (err) {
    console.error("Error toggling global state:", err);
    showStatus("Failed to toggle", true);
  }
}

async function toggleSite() {
  if (!currentHostname) return;

  const isCurrentlyDisabled = disabledSites.includes(currentHostname);

  if (isCurrentlyDisabled) {
    disabledSites = disabledSites.filter((site) => site !== currentHostname);
  } else {
    disabledSites = [...disabledSites, currentHostname];
  }

  try {
    await chrome.storage.sync.set({ disabledSites });
    updateSiteToggle(!isCurrentlyDisabled);

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab?.id) {
      await chrome.tabs.reload(tab.id);
      showStatus(isCurrentlyDisabled ? "Enabled" : "Disabled");
    }
  } catch (err) {
    console.error("Error toggling site:", err);
    showStatus("Failed to toggle", true);
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

      if (globallyEnabled) {
        const isDisabled = disabledSites.includes(currentHostname);
        updateSiteToggle(isDisabled);
      } else {
        siteToggleContainer.style.display = "none";
      }
    }
  } catch (err) {
    console.error("Error getting tab:", err);
    siteToggleContainer.style.display = "none";
  }
}

chrome.storage.sync.get(
  { mode: "24to12", disabledSites: [], globallyEnabled: false },
  (data) => {
    currentMode = data.mode;
    disabledSites = data.disabledSites;
    globallyEnabled = data.globallyEnabled;
    updateSelection(currentMode);
    updateGlobalToggle(globallyEnabled);
    initSiteToggle();
  },
);

options.forEach((opt) => {
  opt.addEventListener("click", () => applyMode(opt.dataset.mode));
});

globalToggle.addEventListener("click", toggleGlobal);
siteToggle.addEventListener("click", toggleSite);
