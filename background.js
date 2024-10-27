// background.js

// Function to inject content script into a tab
function injectContentScript(tab) {
  if (!tab || !tab.url) {
    console.log("Tab or tab.url is undefined, skipping injection.");
    return;
  }

  let url;
  try {
    url = new URL(tab.url);
  } catch (e) {
    console.error("Invalid URL:", tab.url);
    return;
  }

  // Only inject for http and https protocols
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    console.log(
      `Skipping injection into unsupported protocol: ${url.protocol} for URL: ${tab.url}`
    );
    return;
  }

  chrome.storage.sync.get(["activeUrls"], (data) => {
    const activeUrls = data.activeUrls || [];
    console.log("Active URLs from storage:", activeUrls);

    const isMatch = activeUrls.some((pattern) => {
      if (!pattern.endsWith("/*")) {
        pattern += "/*";
      }

      let basePattern = pattern.slice(0, -1); // Remove the '*' at the end

      let patternUrl;
      try {
        patternUrl = new URL(basePattern);
      } catch (e) {
        console.error("Invalid pattern URL:", pattern);
        return false;
      }

      if (url.protocol !== patternUrl.protocol) return false;
      if (url.hostname !== patternUrl.hostname) return false;
      if (url.port !== patternUrl.port) return false;
      if (!url.pathname.startsWith(patternUrl.pathname)) return false;

      console.log(`URL matches pattern: ${pattern}`);
      return true;
    });

    if (isMatch) {
      console.log(
        `Pattern matched. Injecting content_script.js into Tab ID: ${tab.id}`
      );
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          files: ["content_script.js"],
        })
        .then(() =>
          console.log(
            `Successfully injected content_script.js into Tab ID: ${tab.id}`
          )
        );
      // .catch((err) =>
      //   console.error(`Failed to inject script into Tab ID: ${tab.id}:`, err)
      // );
    } else {
      console.log(
        `No matching pattern for URL: ${tab.url}. Skipping injection.`
      );
    }
  });
}

// Function to check and inject content script for the active tab
function checkAndInjectActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
      console.log("No active tab found.");
      return;
    }
    const activeTab = tabs[0];
    if (!activeTab || !activeTab.url) {
      console.log("Active tab has no URL or is undefined, skipping injection.");
      return;
    }

    console.log(
      `Checking active tab: ID ${activeTab.id}, URL ${activeTab.url}`
    );
    injectContentScript(activeTab);
  });
}

// Listen for tab updates and inject content script only if complete
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    console.log(`Tab updated and complete: ID ${tabId}, URL ${tab.url}`);
    injectContentScript(tab);
  }
});

// Listen for tab activation to check the active tab
chrome.tabs.onActivated.addListener(() => {
  checkAndInjectActiveTab();
});

// Listen for messages from options or other parts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "settings_updated") {
    console.log(
      "Settings updated. Checking and injecting content script for active tab."
    );
    checkAndInjectActiveTab(); // Re-check active tab when settings are updated
    sendResponse({ status: "Settings updated" });
    return true; // Indicate that sendResponse is called asynchronously
  }

  // Handle check_allowed message to verify if the current page is allowed to display history
  if (message.type === "check_allowed") {
    chrome.storage.sync.get(["activeUrls"], (data) => {
      const activeUrls = data.activeUrls || [];
      const tabUrl = sender.tab ? sender.tab.url : null;

      if (!tabUrl) {
        sendResponse({ allowed: false });
        return;
      }

      let url;
      try {
        url = new URL(tabUrl);
      } catch (e) {
        console.error("Invalid tab URL:", tabUrl);
        sendResponse({ allowed: false });
        return;
      }

      const isMatch = activeUrls.some((pattern) => {
        if (!pattern.endsWith("/*")) {
          pattern += "/*";
        }

        let basePattern = pattern.slice(0, -1);

        let patternUrl;
        try {
          patternUrl = new URL(basePattern);
        } catch (e) {
          console.error("Invalid pattern URL:", pattern);
          return false;
        }

        if (url.protocol !== patternUrl.protocol) return false;
        if (url.hostname !== patternUrl.hostname) return false;
        if (url.port !== patternUrl.port) return false;
        if (!url.pathname.startsWith(patternUrl.pathname)) return false;

        return true;
      });

      sendResponse({ allowed: isMatch });
    });
    return true; // Allows sendResponse to be called asynchronously
  }
});
