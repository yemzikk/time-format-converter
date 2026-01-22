const formatCards = document.querySelectorAll(".format-card");
const statusDiv = document.getElementById("status");

let currentMode = "24to12";
let isApplying = false;

function showStatus(message, isError = false) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${isError ? "error" : "success"} show`;

  setTimeout(() => {
    statusDiv.classList.remove("show");
    setTimeout(() => {
      statusDiv.textContent = "";
      statusDiv.className = "status";
    }, 300);
  }, 2500);
}

function updateActiveCard(mode) {
  formatCards.forEach((card) => {
    if (card.dataset.mode === mode) {
      card.classList.add("active");
      card.setAttribute("aria-selected", "true");
    } else {
      card.classList.remove("active");
      card.setAttribute("aria-selected", "false");
    }
  });
  currentMode = mode;
}

async function applyMode(mode) {
  if (isApplying || mode === currentMode) return;

  isApplying = true;
  updateActiveCard(mode);

  try {
    await chrome.storage.sync.set({ mode });

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab?.id) {
      await chrome.tabs.reload(tab.id);
      showStatus("Applied successfully");
    } else {
      showStatus("Saved successfully");
    }
  } catch (error) {
    console.error("Error applying settings:", error);
    showStatus("Error applying settings", true);
    // Revert to previous mode
    updateActiveCard(currentMode);
  } finally {
    isApplying = false;
  }
}

// Load saved mode and initialize
chrome.storage.sync.get({ mode: "24to12" }, ({ mode }) => {
  currentMode = mode;
  updateActiveCard(mode);
});

// Add click handlers to cards
formatCards.forEach((card) => {
  const mode = card.dataset.mode;

  card.addEventListener("click", () => {
    applyMode(mode);
  });

  // Keyboard accessibility
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      applyMode(mode);
    }
  });
});
