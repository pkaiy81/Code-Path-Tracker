# Code Path Tracker

**Code Path Tracker** is a Chrome extension designed to track the function calls in code browsing tools like OpenGrok. By recording each clicked function in a custom history, Code Path Tracker helps developers better understand code flows and improves code review efficiency.

![Code Path Tracker](TODO)

## Features

- Automatically records clicked function names in a hierarchical history.
- Provides a sidebar for managing function history, including reordering, editing URLs, and copying formatted text.
- Allows customization through settings for template formatting, indentation, and URL inclusion.
- Supports URL pattern specification to activate only on certain sites.

## Installation

1. **From Chrome Web Store** (recommended):
   - Visit the [Code Path Tracker Chrome Web Store page](TODO) and click **Add to Chrome** to install the extension.

2. **From Source** (for development):
   - Clone or download this repository to your local machine.
   - Open Chrome and go to `chrome://extensions/`.
   - Enable **Developer mode**.
   - Select **Load unpacked** and choose the extension's directory.

## Usage

1. Visit any supported site like OpenGrok where Code Path Tracker is activated based on URL pattern settings.
2. Click on function names to add them to your history.
3. Manage the function history from the sidebar:
   - **Reorder functions** to reflect their call order or logical grouping.
   - **Edit URLs** by hovering over each function, allowing for quick corrections.
   - **Copy formatted text** using a custom template for documentation or code reviews.

## Settings

Access the settings from the Chrome extension menu.

Available options:

- **Custom Template**: Customize the format for copying history (e.g., indentation, enclosing line).
- **Indentation**: Adjust indentation for nested functions.
- **URL Patterns**: Define specific URL patterns to control where Code Path Tracker is enabled.
- **Include URLs Options**: Choose whether to include URLs in function names and set template characters.

## Contributing

We welcome contributions! To contribute:

1. Fork this repository.
2. Create a new branch (`git checkout -b feature/YourFeatureName`).
3. Commit your changes (`git commit -am 'Add new feature'`).
4. Push to the branch (`git push origin feature/YourFeatureName`).
5. Create a new Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Happy coding with Code Path Tracker!
