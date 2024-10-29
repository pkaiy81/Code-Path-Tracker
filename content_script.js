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

    // Load settings and sidebar width
    loadSettings().then(() => {
      chrome.storage.local.get(["sidebarWidth"], (data) => {
        sidebarWidth = data.sidebarWidth || 350;
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

      if (resizeHandle) {
        sidebar.appendChild(resizeHandle);
      }

      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "center";
      header.style.marginBottom = "10px";

      const title = document.createElement("h2");
      title.textContent = "Function History";
      title.style.margin = "0";
      title.style.fontSize = "16px";

      const buttonsContainer = document.createElement("div");

      const copyButton = document.createElement("button");
      copyButton.textContent = "Copy";
      copyButton.title = "Copy Formatted History";
      copyButton.style.fontSize = "12px";
      copyButton.style.marginRight = "5px";

      const clearButton = document.createElement("button");
      clearButton.textContent = "Clear All";
      clearButton.title = "Clear All History";
      clearButton.style.fontSize = "12px";

      buttonsContainer.appendChild(copyButton);
      buttonsContainer.appendChild(clearButton);

      header.appendChild(title);
      header.appendChild(buttonsContainer);
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

      const listContainer = document.createElement("div");
      listContainer.id = "function-history-list";

      functionHistory.forEach((func, index) => {
        const item = createHistoryItem(func, index);
        listContainer.appendChild(item);
      });

      sidebar.appendChild(listContainer);
    }

    function createHistoryItem(func, index) {
      const item = document.createElement("div");
      item.className = "function-history-item";
      item.dataset.index = index;

      const controls = document.createElement("span");
      controls.className = "function-history-controls";
      controls.style.marginRight = "10px";

      const addButton = document.createElement("button");
      addButton.textContent = "+";
      addButton.title = "Increase Level";
      addButton.className = "add-sublevel-button";
      addButton.dataset.index = index;
      addButton.style.marginRight = "5px";

      const decreaseButton = document.createElement("button");
      decreaseButton.textContent = "-";
      decreaseButton.title = "Decrease Level";
      decreaseButton.className = "decrease-sublevel-button";
      decreaseButton.dataset.index = index;
      decreaseButton.style.marginRight = "5px";

      const upButton = document.createElement("button");
      upButton.textContent = "↑";
      upButton.title = "Move Up";
      upButton.className = "move-up-button";
      upButton.dataset.index = index;
      upButton.style.marginRight = "5px";

      const downButton = document.createElement("button");
      downButton.textContent = "↓";
      downButton.title = "Move Down";
      downButton.className = "move-down-button";
      downButton.dataset.index = index;
      downButton.style.marginRight = "5px";

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "×";
      deleteButton.title = "Delete";
      deleteButton.className = "delete-button";
      deleteButton.dataset.index = index;
      deleteButton.style.marginRight = "5px";

      controls.appendChild(addButton);
      controls.appendChild(decreaseButton);
      controls.appendChild(upButton);
      controls.appendChild(downButton);
      controls.appendChild(deleteButton);

      const levelIndicator = document.createElement("span");
      levelIndicator.textContent = "-".repeat(func.level);
      levelIndicator.style.marginLeft = "5px";

      const nameSpan = document.createElement("span");
      nameSpan.style.position = "relative";

      if (includeLinks && func.link) {
        const link = document.createElement("a");
        link.href = func.link;
        link.textContent = func.name;
        link.target = "_blank";
        link.style.textDecoration = "none";
        link.style.color = "#007bff";
        nameSpan.appendChild(link);

        const editButton = document.createElement("button");
        editButton.textContent = "✎";
        editButton.title = "Edit URL";
        editButton.className = "edit-url-button";
        editButton.dataset.index = index;
        editButton.style.marginLeft = "5px";
        editButton.style.fontSize = "12px";
        editButton.style.cursor = "pointer";
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

    function createHistorySidebar() {
      sidebar = document.createElement("div");
      sidebar.id = "function-history-sidebar";

      sidebar.style.position = "fixed";
      sidebar.style.top = "0";
      sidebar.style.right = "0";
      sidebar.style.width = `${sidebarWidth}px`;
      sidebar.style.height = "100%";
      sidebar.style.backgroundColor = "#f9f9f9";
      sidebar.style.overflowY = "auto";
      sidebar.style.zIndex = "1000";
      sidebar.style.padding = "10px";
      sidebar.style.borderLeft = "1px solid #ccc";
      sidebar.style.fontFamily = "Arial, sans-serif";
      sidebar.style.fontSize = "14px";
      sidebar.style.boxSizing = "border-box";
      sidebar.style.transition = "width 0.3s ease";

      document.body.appendChild(sidebar);

      const minimizeButton = document.createElement("button");
      minimizeButton.textContent = "▼";
      minimizeButton.title = "Minimize Sidebar";
      minimizeButton.id = "minimize-sidebar-button";
      minimizeButton.style.position = "fixed";
      minimizeButton.style.top = "10px";
      minimizeButton.style.right = `${sidebarWidth + 5}px`;
      minimizeButton.style.fontSize = "16px";
      minimizeButton.style.cursor = "pointer";
      minimizeButton.style.zIndex = "1001";

      document.body.appendChild(minimizeButton);

      minimizeButton.addEventListener("click", toggleSidebarMinimize);

      const resizeHandle = document.createElement("div");
      resizeHandle.className = "resize-handle";
      resizeHandle.style.position = "absolute";
      resizeHandle.style.left = "-5px";
      resizeHandle.style.top = "0";
      resizeHandle.style.width = "10px";
      resizeHandle.style.height = "100%";
      resizeHandle.style.cursor = "ew-resize";
      resizeHandle.style.zIndex = "1001";
      sidebar.appendChild(resizeHandle);

      attachResizeEventListeners(resizeHandle, minimizeButton);
      attachControlEventListeners();
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

      if (isSidebarMinimized) {
        sidebar.style.width = `${sidebarWidth}px`;
        sidebar.style.padding = "10px";
        sidebar.style.overflowY = "auto";
        minimizeButton.textContent = "▼";
        minimizeButton.style.right = `${sidebarWidth + 5}px`;
        isSidebarMinimized = false;
      } else {
        sidebar.style.width = "0px";
        sidebar.style.padding = "5px";
        sidebar.style.overflow = "hidden";
        minimizeButton.textContent = "▶";
        minimizeButton.style.right = "35px";
        isSidebarMinimized = true;
      }
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
          sidebar.style.width = `${newWidth}px`;
          minimizeButton.style.right = `${newWidth + 5}px`;
          sidebarWidth = newWidth;
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
        .function-history-item {
          display: flex;
          align-items: center;
          margin-bottom: 5px;
          position: relative;
        }
  
        .function-history-item span {
          margin-right: 10px;
        }
  
        .function-history-controls button {
          margin-right: 5px;
          padding: 2px 5px;
          font-size: 12px;
          cursor: pointer;
        }
  
        .function-history-controls button:hover {
          background-color: #e0e0e0;
        }
  
        #clear-history-button, #copy-history-button {
          padding: 5px 10px;
          font-size: 12px;
          cursor: pointer;
          margin-right: 5px;
        }
  
        #clear-history-button:hover, #copy-history-button:hover {
          background-color: #e0e0e0;
        }
  
        .resize-handle {
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
      `;
      document.head.appendChild(style);
    }

    function showTemporaryMessage(message) {
      const msg = document.createElement("div");
      msg.textContent = message;
      msg.style.position = "fixed";
      msg.style.bottom = "10px";
      msg.style.right = "10px";
      msg.style.backgroundColor = "#4caf50";
      msg.style.color = "white";
      msg.style.padding = "10px";
      msg.style.borderRadius = "5px";
      msg.style.zIndex = "1001";
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
