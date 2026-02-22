// options.js

document.addEventListener("DOMContentLoaded", () => {
  const enclosingLineInput = document.getElementById("enclosingLine");
  const arrowInput = document.getElementById("arrow");
  const indentationInput = document.getElementById("indentation");
  const includeLinksInput = document.getElementById("includeLinks");
  const activeUrlsInput = document.getElementById("activeUrls");
  const activeUrlsError = document.getElementById("activeUrlsError");
  const statusMessage = document.getElementById("statusMessage");

  // Load the saved settings
  chrome.storage.sync.get(
    ["enclosingLine", "arrow", "indentation", "includeLinks", "activeUrls"],
    (data) => {
      enclosingLineInput.value = data.enclosingLine || "--------------------";
      arrowInput.value = data.arrow || "+->";
      indentationInput.value = data.indentation !== undefined ? data.indentation : 2;
      includeLinksInput.checked = data.includeLinks !== false; // default is true
      activeUrlsInput.value = data.activeUrls ? data.activeUrls.join("\n") : "";

      updatePreview();
      clearStatus();
    }
  );

  document.getElementById("save").addEventListener("click", () => {
    clearFieldError();

    const enclosingLine = enclosingLineInput.value;
    const arrow = arrowInput.value;
    const indentationValue = parseInt(indentationInput.value, 10);
    const indentation = Number.isFinite(indentationValue)
      ? Math.max(0, indentationValue)
      : 2;
    const includeLinks = includeLinksInput.checked;
    const activeUrls = activeUrlsInput.value
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    const invalidPatterns = activeUrls.filter((url) => !isValidUrlPattern(url));
    if (invalidPatterns.length > 0) {
      showFieldError(
        `Invalid URL pattern(s): ${invalidPatterns.join(", ")}. Please use valid URLs, e.g., https://example.com/*`
      );
      showStatus("Could not save settings.", "error");
      return;
    }

    indentationInput.value = indentation;

    chrome.storage.sync.set(
      {
        enclosingLine,
        arrow,
        indentation,
        includeLinks,
        activeUrls,
      },
      () => {
        chrome.runtime.sendMessage({ type: "settings_updated" }, () => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
            showStatus("An error occurred while saving settings.", "error");
          } else {
            showStatus("Settings saved.", "success");
          }
        });
      }
    );
  });

  enclosingLineInput.addEventListener("input", updatePreview);
  arrowInput.addEventListener("input", updatePreview);
  indentationInput.addEventListener("input", updatePreview);
  includeLinksInput.addEventListener("change", updatePreview);
  activeUrlsInput.addEventListener("input", () => {
    clearFieldError();
    updatePreview();
  });

  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type || ""}`.trim();
  }

  function clearStatus() {
    statusMessage.textContent = "";
    statusMessage.className = "status";
  }

  function showFieldError(message) {
    activeUrlsError.textContent = message;
    activeUrlsError.classList.add("visible");
  }

  function clearFieldError() {
    activeUrlsError.textContent = "";
    activeUrlsError.classList.remove("visible");
  }

  function updatePreview() {
    const enclosingLine = enclosingLineInput.value || "";
    const arrow = arrowInput.value || "";
    const indentation = parseInt(indentationInput.value, 10) || 0;
    const includeLinks = includeLinksInput.checked;

    const functionHistory = [
      { name: "demo()", link: "http://example.com/demo", level: 0 },
      { name: "test()", link: "http://example.com/test", level: 1 },
      { name: "test-nest()", link: "http://example.com/test-nest", level: 2 },
      { name: "test-nest2()", link: "http://example.com/test-nest2", level: 2 },
      { name: "test2()", link: "http://example.com/test2", level: 1 },
      { name: "test-nest()", link: "http://example.com/test-nest", level: 2 },
    ];

    const previewText = generatePreviewText(
      functionHistory,
      enclosingLine,
      arrow,
      indentation,
      includeLinks
    );
    document.getElementById("preview").textContent = previewText;
  }

  function generatePreviewText(
    functionHistory,
    enclosingLine,
    arrow,
    indentation,
    includeLinks
  ) {
    let formatted = "";
    formatted += enclosingLine + "\n";

    functionHistory.forEach((func) => {
      const indent = " ".repeat(indentation * func.level);
      const arrowSymbol = arrow || "+->";
      const name =
        includeLinks && func.link ? `${func.name} (${func.link})` : func.name;
      if (func.level === 0) {
        formatted += `${indent}${name}\n`;
      } else {
        formatted += `${indent}${arrowSymbol} ${name}\n`;
      }
    });

    formatted += enclosingLine;
    return formatted;
  }

  function isValidUrlPattern(pattern) {
    try {
      const testUrl = pattern.replace(/\*/g, "example");
      new URL(testUrl);
      return true;
    } catch (e) {
      return false;
    }
  }
});
