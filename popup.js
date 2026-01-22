const options = document.querySelectorAll(".option");
const statusEl = document.getElementById("status");

let currentMode = "24to12";
let isApplying = false;

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

chrome.storage.sync.get({ mode: "24to12" }, ({ mode }) => {
  currentMode = mode;
  updateSelection(mode);
});

options.forEach((opt) => {
  opt.addEventListener("click", () => applyMode(opt.dataset.mode));
});
