// content_script.js

// Function to check if the current page is allowed to display history
function checkIfAllowed() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "check_allowed" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        console.error("Error checking if allowed or no response.");
        reject(false);
      } else {
        resolve(response.allowed);
      }
    });
  });
}

// Immediately invoked function expression to ensure the script only runs on allowed pages
(async function () {
  try {
    const allowed = await checkIfAllowed();
    if (!allowed) {
      console.log(
        "This page is not allowed to show function history. Exiting."
      );
      return;
    }

    if (window.hasContentScript) {
      console.log("Content script already injected.");
      return;
    }
    window.hasContentScript = true;

    let functionHistory = [];
    let sidebar = null;
    let indentation = 20;
    let includeLinks = false;
    let arrow = "+->";
    let enclosingLine = "--------------------";
    let sidebarWidth = 350;
    let hasAttachedGlobalKeyListener = false;

    // Load settings and sidebar state
    loadSettings().then(() => {
      chrome.storage.local.get(["sidebarWidth", "sidebarMinimized"], (data) => {
        sidebarWidth = data.sidebarWidth || 350;
        isSidebarMinimized = data.sidebarMinimized === true;
        createHistorySidebar();
        injectStyles();
        loadHistory();
      });
    });

    function loadSettings() {
      return new Promise((resolve) => {
        chrome.storage.sync.get(
          ["enclosingLine", "arrow", "indentation", "includeLinks"],
          (data) => {
            enclosingLine = data.enclosingLine || "--------------------";
            arrow = data.arrow || "+->";
            indentation =
              data.indentation !== undefined
                ? parseInt(data.indentation, 10)
                : 20;
            includeLinks = data.includeLinks || false;
            resolve();
          }
        );
      });
    }

    function loadHistory() {
      chrome.storage.local.get("functionHistory", (data) => {
        functionHistory = data.functionHistory || [];
        updateHistoryDisplay();
      });
    }

    function saveHistory() {
      try {
        chrome.storage.local.set({ functionHistory });
      } catch (e) {
        console.error("Error saving history:", e);
      }
    }

    function saveSidebarWidth() {
      chrome.storage.local.set({ sidebarWidth });
    }

    function saveSidebarMinimizedState() {
      chrome.storage.local.set({ sidebarMinimized: isSidebarMinimized });
    }

    function updateMinimizeButtonAccessibility(button) {
      if (!button) return;
      button.setAttribute("aria-expanded", String(!isSidebarMinimized));
      button.setAttribute(
        "aria-label",
        isSidebarMinimized ? "Expand sidebar" : "Minimize sidebar"
      );
    }

    function generateUniqueId() {
      return "id-" + Math.random().toString(36).substr(2, 16);
    }

    document.addEventListener("click", function (event) {
      const target = event.target.closest("a.intelliWindow-symbol");
      if (target) {
        const functionName = target.textContent.trim();
        const functionLink = target.href;
        const fullLink = new URL(functionLink, window.location.origin).href;

        functionHistory.push({
          id: generateUniqueId(),
          name: functionName,
          link: includeLinks ? fullLink : null,
          level: 0,
        });

        try {
          saveHistory();
          updateHistoryDisplay();
        } catch (e) {
          console.error("Error saving history:", e);
        }
      }
    });

    function updateHistoryDisplay() {
      if (!sidebar) return;

      const resizeHandle = sidebar.querySelector(".resize-handle");
      sidebar.innerHTML = "";
      sidebar.classList.toggle("is-minimized", isSidebarMinimized);

      if (resizeHandle) {
        sidebar.appendChild(resizeHandle);
      }

      const { header, copyButton, clearButton, exportButton, importButton } =
        buildHeader();
      sidebar.appendChild(header);

      copyButton.addEventListener("click", () => {
        copyFormattedHistory();
      });

      clearButton.addEventListener("click", () => {
        if (confirm("Are you sure you want to clear all history?")) {
          functionHistory = [];
          saveHistory();
          updateHistoryDisplay();
          showTemporaryMessage("All history cleared.");
        }
      });

      exportButton.addEventListener("click", exportHistory);
      importButton.addEventListener("click", triggerImportHistory);

      const listContainer = buildHistoryList();

      sidebar.appendChild(listContainer);
    }

    function buildHeader() {
      const header = document.createElement("div");
      header.className = "cpt-header";

      const title = document.createElement("h2");
      title.className = "cpt-title";
      title.textContent = "Function History";

      const buttonsContainer = document.createElement("div");
      buttonsContainer.className = "cpt-btn-group";

      const copyButton = document.createElement("button");
      copyButton.className = "cpt-btn";
      copyButton.textContent = "Copy";
      copyButton.title = "Copy Formatted History";

      const exportButton = document.createElement("button");
      exportButton.className = "cpt-btn";
      exportButton.textContent = "Export";
      exportButton.title = "Export History";

      const importButton = document.createElement("button");
      importButton.className = "cpt-btn";
      importButton.textContent = "Import";
      importButton.title = "Import History";

      const clearButton = document.createElement("button");
      clearButton.className = "cpt-btn";
      clearButton.textContent = "Clear All";
      clearButton.title = "Clear All History";

      buttonsContainer.appendChild(copyButton);
      buttonsContainer.appendChild(exportButton);
      buttonsContainer.appendChild(importButton);
      buttonsContainer.appendChild(clearButton);
      header.appendChild(title);
      header.appendChild(buttonsContainer);

      return { header, copyButton, clearButton, exportButton, importButton };
    }

    function buildHistoryList() {
      const listContainer = document.createElement("div");
      listContainer.id = "function-history-list";
      listContainer.className = "cpt-history-list";

      functionHistory.forEach((func, index) => {
        const item = createHistoryItem(func, index);
        listContainer.appendChild(item);
      });

      return listContainer;
    }

    function createHistoryItem(func, index) {
      const item = document.createElement("div");
      item.className = "function-history-item cpt-item";
      item.dataset.index = index;

      const controls = document.createElement("span");
      controls.className = "function-history-controls cpt-controls";

      const addButton = document.createElement("button");
      addButton.textContent = "+";
      addButton.title = "Increase Level";
      addButton.className = "add-sublevel-button cpt-btn";
      addButton.dataset.index = index;

      const decreaseButton = document.createElement("button");
      decreaseButton.textContent = "-";
      decreaseButton.title = "Decrease Level";
      decreaseButton.className = "decrease-sublevel-button cpt-btn";
      decreaseButton.dataset.index = index;

      const upButton = document.createElement("button");
      upButton.textContent = "↑";
      upButton.title = "Move Up";
      upButton.className = "move-up-button cpt-btn";
      upButton.dataset.index = index;

      const downButton = document.createElement("button");
      downButton.textContent = "↓";
      downButton.title = "Move Down";
      downButton.className = "move-down-button cpt-btn";
      downButton.dataset.index = index;

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "×";
      deleteButton.title = "Delete";
      deleteButton.className = "delete-button cpt-btn";
      deleteButton.dataset.index = index;

      controls.appendChild(addButton);
      controls.appendChild(decreaseButton);
      controls.appendChild(upButton);
      controls.appendChild(downButton);
      controls.appendChild(deleteButton);

      const levelIndicator = document.createElement("span");
      levelIndicator.className = "cpt-level-indicator";
      levelIndicator.textContent = "-".repeat(func.level);

      const nameSpan = document.createElement("span");
      nameSpan.className = "cpt-name";

      if (includeLinks && func.link) {
        const link = document.createElement("a");
        link.href = func.link;
        link.textContent = func.name;
        link.target = "_blank";
        link.className = "cpt-link";
        nameSpan.appendChild(link);

        const editButton = document.createElement("button");
        editButton.textContent = "✎";
        editButton.title = "Edit URL";
        editButton.className = "edit-url-button cpt-btn cpt-btn-edit";
        editButton.dataset.index = index;
        nameSpan.appendChild(editButton);

        editButton.addEventListener("click", (e) => {
          e.stopPropagation();
          const newUrl = prompt("Edit URL:", func.link);
          if (newUrl === null) return;
          const trimmedUrl = newUrl.trim();
          if (trimmedUrl === "") {
            alert("URL cannot be empty.");
            return;
          }
          if (!isValidUrlPattern(trimmedUrl)) {
            alert("Invalid URL format. Please enter a valid URL.");
            return;
          }
          functionHistory[index].link = trimmedUrl;
          saveHistory();
          updateHistoryDisplay();
          showTemporaryMessage("URL updated successfully.");
        });
      } else {
        nameSpan.textContent = func.name;
      }

      item.appendChild(controls);
      item.appendChild(levelIndicator);
      item.appendChild(nameSpan);

      return item;
    }

    let isSidebarMinimized = false;

    function applySidebarState(minimizeButton) {
      const button = minimizeButton || document.getElementById("minimize-sidebar-button");
      if (!sidebar || !button) return;

      if (isSidebarMinimized) {
        sidebar.style.width = "0px";
        sidebar.style.padding = "5px";
        sidebar.style.overflow = "hidden";
        sidebar.style.overflowY = "hidden";
        button.textContent = "▶";
        button.style.right = "35px";
        updateMinimizeButtonAccessibility(button);
        return;
      }

      sidebar.style.width = `${sidebarWidth}px`;
      sidebar.style.padding = "10px";
      sidebar.style.overflow = "";
      sidebar.style.overflowY = "auto";
      button.textContent = "▼";
      button.style.right = `${sidebarWidth + 5}px`;
      updateMinimizeButtonAccessibility(button);
    }

    function onGlobalKeyDown(event) {
      if (event.key === "Escape" && !isSidebarMinimized) {
        toggleSidebarMinimize();
      }
    }

    function createHistorySidebar() {
      sidebar = document.createElement("div");
      sidebar.id = "function-history-sidebar";
      sidebar.className = "cpt-sidebar";
      sidebar.style.width = `${sidebarWidth}px`;
      sidebar.setAttribute("role", "complementary");
      sidebar.setAttribute("aria-label", "Function History Sidebar");

      document.body.appendChild(sidebar);

      const minimizeButton = document.createElement("button");
      minimizeButton.textContent = "▼";
      minimizeButton.title = "Minimize Sidebar";
      minimizeButton.id = "minimize-sidebar-button";
      minimizeButton.className = "cpt-minimize-button cpt-btn";
      minimizeButton.style.right = `${sidebarWidth + 5}px`;
      minimizeButton.setAttribute("aria-controls", "function-history-sidebar");

      document.body.appendChild(minimizeButton);

      minimizeButton.addEventListener("click", toggleSidebarMinimize);
      applySidebarState(minimizeButton);

      const resizeHandle = document.createElement("div");
      resizeHandle.className = "resize-handle cpt-resize-handle";
      sidebar.appendChild(resizeHandle);

      attachResizeEventListeners(resizeHandle, minimizeButton);
      attachControlEventListeners();

      if (!hasAttachedGlobalKeyListener) {
        document.addEventListener("keydown", onGlobalKeyDown);
        hasAttachedGlobalKeyListener = true;
      }
    }

    // Function to attach event listeners to control buttons
    function attachControlEventListeners() {
      if (!sidebar) {
        console.error("Sidebar is not initialized.");
        return;
      }

      sidebar.addEventListener("click", function (event) {
        const target = event.target;
        const indexStr = target.dataset.index;
        if (indexStr === undefined) return;
        const index = parseInt(indexStr, 10);
        if (isNaN(index)) return;

        console.log(`Button clicked: ${target.className} at index ${index}`);

        if (target.classList.contains("delete-button")) {
          deleteFunctionAtIndex(index);
        }

        if (target.classList.contains("add-sublevel-button")) {
          addSublevelFunction(index);
        }

        if (target.classList.contains("decrease-sublevel-button")) {
          decreaseSublevelFunction(index);
        }

        // Use the moveFunctionUp and moveFunctionDown functions for "↑" and "↓" buttons
        if (target.classList.contains("move-up-button")) {
          moveFunctionUp(index);
        }

        if (target.classList.contains("move-down-button")) {
          moveFunctionDown(index);
        }
      });
    }

    function toggleSidebarMinimize() {
      const minimizeButton = document.getElementById("minimize-sidebar-button");
      if (!minimizeButton || !sidebar) return;

      isSidebarMinimized = !isSidebarMinimized;
      sidebar.classList.toggle("is-minimized", isSidebarMinimized);
      applySidebarState(minimizeButton);
      saveSidebarMinimizedState();
    }

    function attachResizeEventListeners(handle, minimizeButton) {
      let isResizing = false;

      handle.addEventListener("mousedown", (e) => {
        isResizing = true;
        document.body.style.cursor = "ew-resize";
        document.body.style.userSelect = "none";
      });

      document.addEventListener("mousemove", (e) => {
        if (!isResizing) return;
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 200 && newWidth < 600) {
          sidebarWidth = newWidth;
          applySidebarState(minimizeButton);
        }
      });

      document.addEventListener("mouseup", () => {
        if (isResizing) {
          isResizing = false;
          document.body.style.cursor = "default";
          document.body.style.userSelect = "auto";
          saveSidebarWidth();
        }
      });
    }

    function moveFunctionUp(index) {
      const targetLevel = functionHistory[index].level;
      let newIndex = -1;

      for (let i = index - 1; i >= 0; i--) {
        if (functionHistory[i].level === targetLevel) {
          newIndex = i;
          break;
        }
      }

      if (newIndex !== -1) {
        functionHistory.splice(
          newIndex,
          0,
          functionHistory.splice(index, 1)[0]
        );
        saveHistory();
        updateHistoryDisplay();
        showTemporaryMessage("Function moved up.");
      } else {
        showTemporaryMessage("No same level function to move up.");
      }
    }

    function moveFunctionDown(index) {
      const targetLevel = functionHistory[index].level;
      let newIndex = -1;

      for (let i = index + 1; i < functionHistory.length; i++) {
        if (functionHistory[i].level === targetLevel) {
          newIndex = i;
          break;
        }
      }

      if (newIndex !== -1) {
        functionHistory.splice(
          newIndex + 1,
          0,
          functionHistory.splice(index, 1)[0]
        );
        saveHistory();
        updateHistoryDisplay();
        showTemporaryMessage("Function moved down.");
      } else {
        showTemporaryMessage("No same level function to move down.");
      }
    }

    // Function to delete a function at a given index
    function deleteFunctionAtIndex(index) {
      if (index >= 0 && index < functionHistory.length) {
        functionHistory.splice(index, 1);
        saveHistory();
        updateHistoryDisplay();
        showTemporaryMessage("Function deleted successfully.");
      }
    }

    // Function to add a sub-level function (increase level by 1)
    function addSublevelFunction(index) {
      if (index >= 0 && index < functionHistory.length) {
        if (functionHistory[index].level >= 10) {
          // Optional: limit to 10 levels
          alert("Maximum hierarchy level reached.");
          return;
        }
        functionHistory[index].level += 1;
        saveHistory();
        updateHistoryDisplay();
        showTemporaryMessage("Function level increased.");
      }
    }

    // Function to decrease a sub-level function (decrease level by 1)
    function decreaseSublevelFunction(index) {
      if (index >= 0 && index < functionHistory.length) {
        if (functionHistory[index].level > 0) {
          functionHistory[index].level -= 1;
          saveHistory();
          updateHistoryDisplay();
          showTemporaryMessage("Function level decreased.");
        } else {
          alert("Function is already at the top level.");
        }
      }
    }

    function injectStyles() {
      const style = document.createElement("style");
      style.textContent = `
        :root {
          --cpt-bg: #f9f9f9;
          --cpt-text: #1f2937;
          --cpt-border: #d1d5db;
          --cpt-btn-bg: #ffffff;
          --cpt-btn-hover: #e5e7eb;
          --cpt-btn-border: #cbd5e1;
          --cpt-link: #2563eb;
          --cpt-focus: #3b82f6;
          --cpt-success: #4caf50;
          --cpt-success-text: #ffffff;
        }

        .cpt-sidebar {
          position: fixed;
          top: 0;
          right: 0;
          height: 100%;
          background-color: var(--cpt-bg);
          color: var(--cpt-text);
          overflow-y: auto;
          z-index: 1000;
          padding: 10px;
          border-left: 1px solid var(--cpt-border);
          font-family: Arial, sans-serif;
          font-size: 14px;
          box-sizing: border-box;
          transition: width 0.3s ease, padding 0.3s ease;
        }

        .cpt-sidebar.is-minimized {
          padding: 5px;
          overflow: hidden;
        }

        .cpt-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .cpt-title {
          margin: 0;
          font-size: 16px;
        }

        .cpt-btn-group {
          display: flex;
          gap: 5px;
        }

        .cpt-btn {
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid var(--cpt-btn-border);
          background: var(--cpt-btn-bg);
          color: var(--cpt-text);
          font-size: 12px;
          cursor: pointer;
          line-height: 1.2;
          transition: background-color 0.2s ease;
        }

        .cpt-btn:hover {
          background-color: var(--cpt-btn-hover);
        }

        .cpt-btn:focus-visible {
          outline: 2px solid var(--cpt-focus);
          outline-offset: 1px;
        }

        .cpt-item {
          display: flex;
          align-items: center;
          margin-bottom: 5px;
          position: relative;
          gap: 6px;
        }

        .cpt-controls {
          display: inline-flex;
          gap: 5px;
          margin-right: 6px;
        }

        .cpt-level-indicator {
          min-width: 8px;
        }

        .cpt-name {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .cpt-link {
          text-decoration: none;
          color: var(--cpt-link);
        }

        .cpt-minimize-button {
          position: fixed;
          top: 10px;
          z-index: 1001;
          font-size: 16px;
        }

        .cpt-btn-edit {
          padding: 2px 6px;
        }

        .cpt-resize-handle {
          position: absolute;
          left: -5px;
          top: 0;
          width: 10px;
          height: 100%;
          cursor: ew-resize;
          z-index: 1001;
        }

        .url-tooltip {
          position: absolute;
          background-color: #333;
          color: #fff;
          padding: 5px;
          border-radius: 3px;
          font-size: 12px;
          white-space: nowrap;
          z-index: 1002;
          display: none;
        }

        .cpt-toast {
          position: fixed;
          bottom: 10px;
          right: 10px;
          background-color: var(--cpt-success);
          color: var(--cpt-success-text);
          padding: 10px;
          border-radius: 5px;
          z-index: 1001;
        }
      `;
      document.head.appendChild(style);
    }

    function showTemporaryMessage(message) {
      const msg = document.createElement("div");
      msg.textContent = message;
      msg.className = "cpt-toast";
      document.body.appendChild(msg);

      setTimeout(() => {
        msg.remove();
      }, 2000);
    }

    function copyFormattedHistory() {
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

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(formatted)
          .then(() => {
            showTemporaryMessage("History copied to clipboard.");
          })
          .catch((err) => {
            console.error("Failed to copy: ", err);
            fallbackCopyTextToClipboard(formatted);
          });
      } else {
        fallbackCopyTextToClipboard(formatted);
      }
    }

    function fallbackCopyTextToClipboard(text) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand("copy");
        if (successful) {
          showTemporaryMessage("History copied to clipboard.");
        } else {
          showTemporaryMessage("Failed to copy history.");
        }
      } catch (err) {
        console.error("Fallback: Oops, unable to copy", err);
        showTemporaryMessage("Failed to copy history.");
      }

      document.body.removeChild(textArea);
    }

    function exportHistory() {
      try {
        const payload = {
          version: 1,
          exportedAt: new Date().toISOString(),
          functionHistory,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `code-path-history-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(downloadUrl);
        showTemporaryMessage("History exported.");
      } catch (error) {
        console.error("Failed to export history:", error);
        showTemporaryMessage("Failed to export history.");
      }
    }

    function migrateImportedData(parsedData) {
      if (Array.isArray(parsedData)) {
        return parsedData;
      }

      if (!parsedData || typeof parsedData !== "object") {
        throw new Error("Invalid import payload");
      }

      const importVersion = Number(parsedData.version || 1);
      if (importVersion === 1 && Array.isArray(parsedData.functionHistory)) {
        return parsedData.functionHistory;
      }

      throw new Error(`Unsupported import version: ${importVersion}`);
    }

    function isValidHttpUrl(urlValue) {
      try {
        const parsed = new URL(urlValue);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch (e) {
        return false;
      }
    }

    function triggerImportHistory() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";

      input.addEventListener("change", async () => {
        const file = input.files && input.files[0];
        if (!file) return;

        try {
          const content = await file.text();
          const parsed = JSON.parse(content);
          const importedHistory = migrateImportedData(parsed);

          const normalized = importedHistory.map((item) => ({
            id: item.id || generateUniqueId(),
            name: String(item.name || ""),
            link:
              item.link && isValidHttpUrl(String(item.link))
                ? String(item.link)
                : null,
            level: Number.isInteger(item.level) && item.level >= 0 ? item.level : 0,
          }));

          if (normalized.some((item) => item.name.length === 0)) {
            throw new Error("Invalid function name");
          }

          if (
            !confirm(
              `Import ${normalized.length} history items and replace the current history?`
            )
          ) {
            return;
          }

          functionHistory = normalized;
          saveHistory();
          updateHistoryDisplay();
          showTemporaryMessage("History imported.");
        } catch (error) {
          console.error("Failed to import history:", error);
          showTemporaryMessage("Invalid import file.");
        }
      });

      input.click();
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

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "settings_updated") {
        loadSettings().then(() => {
          if (sidebar) {
            updateHistoryDisplay();
          }
        });
      }
    });
  } catch (error) {
    console.error("Error in checking allowed status: ", error);
  }
})();
