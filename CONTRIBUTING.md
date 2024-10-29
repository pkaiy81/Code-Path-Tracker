# Contributing to Code Path Tracker

Thank you for your interest in contributing to **Code Path Tracker**! This is a JavaScript-based Chrome extension designed to track function history on OpenGrok and similar code browsing sites. Below are the guidelines to help you contribute effectively, including instructions for adding and testing new features.

---

## Getting Started

1. **Fork the repository**: Fork this repository and clone it to your local machine.
2. **Create a branch**: Create a feature branch (`feature/your-feature`) from `develop` for your work.
3. **Install dependencies** (if any): Currently, this project does not have package dependencies, but make sure to check if future updates add any.

## Making Changes

- **Follow coding standards**: Keep your code style consistent with the existing project.
- **Document your changes**: Add comments for complex logic and update documentation if new features or configurations are added.
- **Use meaningful commit messages**: Summarize the purpose of each change for clarity.

## Testing

Testing JavaScript for Chrome extensions can be challenging due to its reliance on the Chrome API and user interactions. Here’s a recommended approach:

1. **Manual Testing**: This extension is mostly tested through manual testing in a Chrome environment.
    - **Load the unpacked extension**:
      1. Open `chrome://extensions/`.
      2. Enable "Developer mode" (top right).
      3. Click "Load unpacked" and select the extension folder.
    - **Verify functionality**:
      - Test each feature, especially after adding new ones, by performing actions in the target environment (e.g., clicking functions on OpenGrok).
      - Ensure changes to the history are displayed correctly in the sidebar.
      - Test that the `+`, `-`, `↑`, and `↓` buttons behave as expected, moving functions as intended.
  
2. **Automated Testing with Mocks**: Although limited, you can use a testing framework like **Jest** or **Mocha** with **Sinon** to test parts of the code that don’t rely directly on Chrome APIs.
    - Mock Chrome API calls (`chrome.storage`, `chrome.runtime`, etc.) to simulate their behavior.
    - Write unit tests for helper functions like `generateUniqueId`, `isValidUrlPattern`, or any custom formatting functions.

3. **Edge Cases**:
    - Test for edge cases, such as moving functions when there are no functions of the same level.
    - Check behavior for invalid URL inputs in the edit URL functionality.
    - Verify that resizing the sidebar persists across sessions.

4. **End-to-End Tests** (Optional): Use tools like **Selenium** or **Puppeteer** to simulate user actions in a Chrome environment. This is more advanced but can provide comprehensive coverage.

## Pull Request Process

1. **Ensure all code is tested** and no errors appear in the console.
2. **Push your changes**: Push your feature branch to your GitHub fork.
3. **Open a pull request**: Submit a pull request (PR) from your fork’s feature branch to the `main` branch of this repository.

### Code Review

After submitting a PR, the maintainers will review your changes. Be prepared to address feedback or make further adjustments.

### Reporting Issues

If you encounter a bug or have suggestions for improvements, feel free to open an issue. Be sure to include any relevant information, such as steps to reproduce the bug or any error messages.

Thank you for your contributions!
