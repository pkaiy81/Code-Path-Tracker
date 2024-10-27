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
  // Check if the current page is allowed to show the sidebar
  try {
    const allowed = await checkIfAllowed();
    if (!allowed) {
      console.log(
        "This page is not allowed to show function history. Exiting."
      );
      return; // Exit if the page is not allowed
    }

    console.log("Page is allowed. Proceeding with function history display.");

    // Guard to prevent multiple injections
    if (window.hasContentScript) {
      console.log("Content script already injected.");
      return;
    }
    window.hasContentScript = true;

    // Initialize function history as a flat list with level
    let functionHistory = [];

    // Variable to store the sidebar element
    let sidebar = null;

    // Indentation setting (number of pixels per level)
    let indentation = 20; // Default value

    // Flags based on options
    let includeLinks = false;
    let arrow = "+->";
    let enclosingLine = "--------------------";

    // Load settings
    loadSettings().then(() => {
      createHistorySidebar();
      injectStyles(); // Inject CSS after sidebar creation
      loadHistory();
    });

    // Function to load settings
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
                : 20; // pixels
            includeLinks = data.includeLinks || false;
            resolve();
          }
        );
      });
    }

    // Function to load the history
    function loadHistory() {
      chrome.storage.local.get("functionHistory", (data) => {
        functionHistory = data.functionHistory || [];
        updateHistoryDisplay();
      });
    }

    // Function to save the history
    function saveHistory() {
      try {
        chrome.storage.local.set({ functionHistory: functionHistory });
      } catch (e) {
        console.error("Error saving history:", e);
      }
    }

    // Function to generate a unique ID for each function
    function generateUniqueId() {
      return "id-" + Math.random().toString(36).substr(2, 16);
    }

    // Detect clicks on function name elements
    document.addEventListener("click", function (event) {
      const target = event.target.closest("a.intelliWindow-symbol");
      if (target) {
        const functionName = target.textContent.trim();
        const functionLink = target.href;
        const fullLink = new URL(functionLink, window.location.origin).href;

        // Add to history as a root function with level 0
        functionHistory.push({
          id: generateUniqueId(),
          name: functionName,
          link: includeLinks ? fullLink : null, // Include link based on settings
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

    // Function to update the history display
    function updateHistoryDisplay() {
      if (!sidebar) return;

      // Clear existing content except the resize handle
      const resizeHandle = sidebar.querySelector(".resize-handle");
      sidebar.innerHTML = "";

      // Add the resize handle back
      if (resizeHandle) {
        sidebar.appendChild(resizeHandle);
      }

      // Add a header to the sidebar
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
      copyButton.id = "copy-history-button";
      copyButton.style.fontSize = "12px";
      copyButton.style.marginRight = "5px";

      const clearButton = document.createElement("button");
      clearButton.textContent = "Clear All";
      clearButton.title = "Clear All History";
      clearButton.id = "clear-history-button";
      clearButton.style.fontSize = "12px";

      buttonsContainer.appendChild(copyButton);
      buttonsContainer.appendChild(clearButton);

      header.appendChild(title);
      header.appendChild(buttonsContainer);
      sidebar.appendChild(header);

      // Event listener for copy button
      copyButton.addEventListener("click", () => {
        copyFormattedHistory();
      });

      // Event listener for clear all button
      clearButton.addEventListener("click", () => {
        if (confirm("Are you sure you want to clear all history?")) {
          functionHistory = [];
          saveHistory();
          updateHistoryDisplay();
          showTemporaryMessage("All history cleared.");
        }
      });

      // Create a container for the history list
      const listContainer = document.createElement("div");
      listContainer.id = "function-history-list";

      // Build the list
      functionHistory.forEach((func, index) => {
        const item = createHistoryItem(func, index);
        listContainer.appendChild(item);
      });

      // Append the list to the sidebar
      sidebar.appendChild(listContainer);
    }

    // Function to create a history item with controls and URL editing
    function createHistoryItem(func, index) {
      const item = document.createElement("div");
      item.className = "function-history-item";
      item.dataset.index = index;

      // Controls container on the left side of the function name
      const controls = document.createElement("span");
      controls.className = "function-history-controls";
      controls.style.marginRight = "10px"; // Adjust the spacing to align with the function name

      // Add Sub-level Button
      const addButton = document.createElement("button");
      addButton.textContent = "+";
      addButton.title = "Increase Level";
      addButton.className = "add-sublevel-button";
      addButton.dataset.index = index;
      addButton.style.marginRight = "5px";

      // Decrease Sub-level Button
      const decreaseButton = document.createElement("button");
      decreaseButton.textContent = "-";
      decreaseButton.title = "Decrease Level";
      decreaseButton.className = "decrease-sublevel-button";
      decreaseButton.dataset.index = index;
      decreaseButton.style.marginRight = "5px";

      // Move Up Button
      const upButton = document.createElement("button");
      upButton.textContent = "↑";
      upButton.title = "Move Up";
      upButton.className = "move-up-button";
      upButton.dataset.index = index;
      upButton.style.marginRight = "5px";

      // Move Down Button
      const downButton = document.createElement("button");
      downButton.textContent = "↓";
      downButton.title = "Move Down";
      downButton.className = "move-down-button";
      downButton.dataset.index = index;
      downButton.style.marginRight = "5px";

      // Delete Button
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "×";
      deleteButton.title = "Delete";
      deleteButton.className = "delete-button";
      deleteButton.dataset.index = index;
      deleteButton.style.marginRight = "5px";

      // Append control buttons to the controls container
      controls.appendChild(addButton);
      controls.appendChild(decreaseButton);
      controls.appendChild(upButton);
      controls.appendChild(downButton);
      controls.appendChild(deleteButton);

      // sub-level element.
      const levelIndicator = document.createElement("span");
      levelIndicator.textContent = "-".repeat(func.level);
      levelIndicator.style.marginLeft = "5px"; // Add spacing between controls and level indicator

      // Function name with optional link and tooltip
      const nameSpan = document.createElement("span");
      nameSpan.style.position = "relative"; // For tooltip positioning

      if (includeLinks && func.link) {
        const link = document.createElement("a");
        link.href = func.link;
        link.textContent = func.name;
        link.target = "_blank";
        link.style.textDecoration = "none";
        link.style.color = "#007bff";
        nameSpan.appendChild(link);

        // Edit button for URL, appears only when URLs are enabled
        const editButton = document.createElement("button");
        editButton.textContent = "✎"; // Pencil icon
        editButton.title = "Edit URL";
        editButton.className = "edit-url-button";
        editButton.dataset.index = index;
        editButton.style.marginLeft = "5px";
        editButton.style.fontSize = "12px";
        editButton.style.cursor = "pointer";

        // Append edit button to the right of the function name
        nameSpan.appendChild(editButton);

        // Event listener for edit button
        editButton.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent triggering other click events
          const newUrl = prompt("Edit URL:", func.link);
          if (newUrl === null) return; // User cancelled
          const trimmedUrl = newUrl.trim();
          if (trimmedUrl === "") {
            alert("URL cannot be empty.");
            return;
          }
          if (!isValidUrlPattern(trimmedUrl)) {
            alert("Invalid URL format. Please enter a valid URL.");
            return;
          }
          // Update the URL in functionHistory
          functionHistory[index].link = trimmedUrl;
          saveHistory();
          updateHistoryDisplay();
          showTemporaryMessage("URL updated successfully.");
        });
      } else {
        nameSpan.textContent = func.name;
      }

      // Append controls, level indicator, and function name to item
      item.appendChild(controls); // Control buttons on the left
      item.appendChild(levelIndicator); // Level indicator after controls
      item.appendChild(nameSpan); // Function name with optional link

      return item;
    }

    // Variable to keep track of sidebar minimized state
    let isSidebarMinimized = false;

    // Function to create the history sidebar with a minimize button
    function createHistorySidebar() {
      sidebar = document.createElement("div");
      sidebar.id = "function-history-sidebar";

      // Set styles for the sidebar
      sidebar.style.position = "fixed";
      sidebar.style.top = "0";
      sidebar.style.right = "0";
      sidebar.style.width = "350px";
      sidebar.style.height = "100%";
      sidebar.style.backgroundColor = "#f9f9f9";
      sidebar.style.overflowY = "auto";
      sidebar.style.zIndex = "1000";
      sidebar.style.padding = "10px";
      sidebar.style.borderLeft = "1px solid #ccc";
      sidebar.style.fontFamily = "Arial, sans-serif";
      sidebar.style.fontSize = "14px";
      sidebar.style.boxSizing = "border-box";
      sidebar.style.transition = "width 0.3s ease"; // Smooth transition for minimize

      // Append the sidebar to the body
      document.body.appendChild(sidebar);

      // Create minimize button on the left side of the sidebar
      const minimizeButton = document.createElement("button");
      minimizeButton.textContent = "▼"; // Down arrow icon for minimize
      minimizeButton.title = "Minimize Sidebar";
      minimizeButton.id = "minimize-sidebar-button";
      minimizeButton.style.position = "fixed";
      minimizeButton.style.top = "10px";
      minimizeButton.style.right = "355px";
      minimizeButton.style.fontSize = "16px";
      minimizeButton.style.cursor = "pointer";
      minimizeButton.style.zIndex = "1001";

      // Append minimize button to the body so it stays fixed
      document.body.appendChild(minimizeButton);

      // Event listener for minimize button
      minimizeButton.addEventListener("click", toggleSidebarMinimize);

      // Create and append the resize handle
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

      // Attach event listeners for resizing
      attachResizeEventListeners(resizeHandle);

      // Attach control event listeners now that sidebar is created
      attachControlEventListeners();
    }

    // Function to toggle sidebar minimize
    function toggleSidebarMinimize() {
      const minimizeButton = document.getElementById("minimize-sidebar-button");

      if (isSidebarMinimized) {
        // Restore the sidebar to normal size
        sidebar.style.width = "350px";
        sidebar.style.padding = "10px";
        sidebar.style.overflowY = "auto";
        minimizeButton.textContent = "▼"; // Set back to down arrow
        minimizeButton.style.right = "355px"; // Update position to follow sidebar width
        isSidebarMinimized = false;
      } else {
        // Minimize the sidebar
        sidebar.style.width = "0px";
        sidebar.style.padding = "5px";
        sidebar.style.overflow = "hidden";
        minimizeButton.textContent = "▶"; // Change to right arrow when minimized
        minimizeButton.style.right = "35px"; // Adjust position to follow minimized sidebar width
        isSidebarMinimized = true;
      }
    }

    // Function to inject CSS styles
    function injectStyles() {
      const style = document.createElement("style");
      style.textContent = `
        .function-history-item {
          display: flex;
          align-items: center;
          margin-bottom: 5px;
          position: relative; /* For tooltip positioning */
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
  
        /* Resize Handle */
        .resize-handle {
          position: absolute;
          left: -5px;
          top: 0;
          width: 10px;
          height: 100%;
          cursor: ew-resize;
          z-index: 1001;
        }
  
        /* Tooltip for URL */
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

    // Function to attach resize event listeners
    function attachResizeEventListeners(handle) {
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
          // Set min and max width
          sidebar.style.width = `${newWidth}px`;
        }
      });

      document.addEventListener("mouseup", () => {
        if (isResizing) {
          isResizing = false;
          document.body.style.cursor = "default";
          document.body.style.userSelect = "auto";
        }
      });
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

        // Debugging log
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

        if (target.classList.contains("move-up-button")) {
          moveFunctionUp(index);
        }

        if (target.classList.contains("move-down-button")) {
          moveFunctionDown(index);
        }
      });
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

    // Function to move a function up by swapping with the previous function
    function moveFunctionUp(index) {
      if (index > 0 && index < functionHistory.length) {
        // Ensure both functions are at the same level
        if (functionHistory[index].level === functionHistory[index - 1].level) {
          [functionHistory[index - 1], functionHistory[index]] = [
            functionHistory[index],
            functionHistory[index - 1],
          ];
          saveHistory();
          updateHistoryDisplay();
          showTemporaryMessage("Function moved up.");
        } else {
          alert(
            "Cannot move function up. Ensure it is at the same hierarchy level as the function above."
          );
        }
      }
    }

    // Function to move a function down by swapping with the next function
    function moveFunctionDown(index) {
      if (index >= 0 && index < functionHistory.length - 1) {
        // Ensure both functions are at the same level
        if (functionHistory[index].level === functionHistory[index + 1].level) {
          [functionHistory[index + 1], functionHistory[index]] = [
            functionHistory[index],
            functionHistory[index + 1],
          ];
          saveHistory();
          updateHistoryDisplay();
          showTemporaryMessage("Function moved down.");
        } else {
          alert(
            "Cannot move function down. Ensure it is at the same hierarchy level as the function below."
          );
        }
      }
    }

    // Function to inject a temporary message
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

    // Function to copy formatted history
    function copyFormattedHistory() {
      let formatted = "";
      formatted += enclosingLine + "\n";

      functionHistory.forEach((func, index) => {
        const indent = " ".repeat(indentation * func.level);
        const arrowSymbol = arrow || "+->";
        const name =
          includeLinks && func.link ? `${func.name} (${func.link})` : func.name;

        // Omit arrow for top-level functions
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
        // Fallback method
        fallbackCopyTextToClipboard(formatted);
      }
    }

    // Fallback method to copy text to clipboard
    function fallbackCopyTextToClipboard(text) {
      const textArea = document.createElement("textarea");
      textArea.value = text;

      // Avoid scrolling to bottom
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

    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "settings_updated") {
        // Reload settings and update UI
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
