// options.js

document.addEventListener("DOMContentLoaded", () => {
  // Load the saved settings
  chrome.storage.sync.get(
    [
      "enclosingLine",
      "arrow",
      "indentation",
      "includeLinks",
      //   "showSidebar",
      "activeUrls",
    ],
    (data) => {
      document.getElementById("enclosingLine").value =
        data.enclosingLine || "--------------------";
      document.getElementById("arrow").value = data.arrow || "+->";
      document.getElementById("indentation").value =
        data.indentation !== undefined ? data.indentation : 2;
      document.getElementById("includeLinks").checked =
        data.includeLinks !== false; // default is true
      //   document.getElementById("showSidebar").checked =
      // data.showSidebar !== false; // default is true
      document.getElementById("activeUrls").value = data.activeUrls
        ? data.activeUrls.join("\n")
        : "";

      // Update the preview
      updatePreview();
    }
  );

  // Save the settings
  document.getElementById("save").addEventListener("click", () => {
    const enclosingLine = document.getElementById("enclosingLine").value;
    const arrow = document.getElementById("arrow").value;
    const indentation = parseInt(
      document.getElementById("indentation").value,
      10
    );
    const includeLinks = document.getElementById("includeLinks").checked;
    // const showSidebar = document.getElementById("showSidebar").checked;
    const activeUrlsInput = document.getElementById("activeUrls").value;
    const activeUrls = activeUrlsInput
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    // Validate URL patterns
    const invalidPatterns = activeUrls.filter((url) => !isValidUrlPattern(url));
    if (invalidPatterns.length > 0) {
      alert(`Invalid URL patterns:\n${invalidPatterns.join("\n")}`);
      return;
    }

    chrome.storage.sync.set(
      {
        enclosingLine: enclosingLine,
        arrow: arrow,
        indentation: indentation,
        includeLinks: includeLinks,
        // showSidebar: showSidebar,
        activeUrls: activeUrls,
      },
      () => {
        // Send message to background script after saving settings
        chrome.runtime.sendMessage({ type: "settings_updated" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
            alert("An error occurred while saving settings.");
          } else {
            alert("Settings have been saved.");
          }
        });
      }
    );
  });

  // Update the preview when settings change
  document
    .getElementById("enclosingLine")
    .addEventListener("input", updatePreview);
  document.getElementById("arrow").addEventListener("input", updatePreview);
  document
    .getElementById("indentation")
    .addEventListener("input", updatePreview);
  document
    .getElementById("includeLinks")
    .addEventListener("change", updatePreview);
  document
    .getElementById("activeUrls")
    .addEventListener("input", updatePreview);

  // Function to update the preview
  function updatePreview() {
    const enclosingLine = document.getElementById("enclosingLine").value || "";
    const arrow = document.getElementById("arrow").value || "";
    const indentation =
      parseInt(document.getElementById("indentation").value, 10) || 0;
    const includeLinks = document.getElementById("includeLinks").checked;

    // Sample function history for preview
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

  // Function to generate preview text
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
      const indent = "  ".repeat(indentation * func.level);
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

  // Function to validate URL patterns
  function isValidUrlPattern(pattern) {
    try {
      // Replace wildcard with a placeholder
      const testUrl = pattern.replace(/\*/g, "example");
      new URL(testUrl);
      return true;
    } catch (e) {
      return false;
    }
  }
});
