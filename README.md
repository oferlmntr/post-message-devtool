# postMessage DevTools

<div align="center">

![postMessage DevTools Logo](docs/logo.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub issues](https://img.shields.io/github/issues/oferlmntr/post-message-devtool)](https://github.com/oferlmntr/post-message-devtool/issues)
[![GitHub stars](https://img.shields.io/github/stars/oferlmntr/post-message-devtool)](https://github.com/oferlmntr/post-message-devtool/stargazers)

A Chrome DevTools extension for monitoring and debugging postMessage events on web pages. Built with Manifest V3.

[Installation](#installation) • [Features](#features) • [Screenshots](#screenshots) • [Usage](#usage) • [Contributing](#contributing)

</div>

## 🚀 Features

- **Dedicated DevTools Panel**: View postMessage events in a specialized panel within Chrome DevTools
- **Real-time Monitoring**: Capture and display postMessage events as they occur
- **Syntax Highlighting**: JSON data is nicely formatted with color-coded syntax highlighting
- **Collapsible JSON**: View a compact summary by default, expand to see full details
- **Structured Display**: View message source, origin, and data in a clean, organized format
- **Preserve Log Option**: Keep message history when navigating between pages
- **Dark Mode Support**: Automatically adapts to your browser's dark/light mode preference
- **Advanced Filtering**: Filter messages by origin or content to find relevant information
- **Manifest V3 Compatible**: Uses the latest Chrome extension format

## 📸 Screenshots

![postMessage DevTools Screenshot](docs/screenshot.png)

## 🔧 Installation

### From Chrome Web Store (Coming Soon)

The extension will be available in the Chrome Web Store soon.

### From Source (Development)

1. Clone this repository:
   ```
   git clone https://github.com/oferlmntr/post-message-devtool.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" by toggling the switch in the top-right corner

4. Click "Load unpacked" and select the directory containing the extension

5. The extension is now installed! Open DevTools (F12 or Cmd+Opt+I on Mac) and look for the "postMessage" tab

## 📖 Usage

1. Open Chrome DevTools on any webpage (F12 or Cmd+Opt+I on Mac)
2. Navigate to the "postMessage" tab
3. As postMessage events occur on the page, they will appear in the panel
4. Use the controls at the top to:
   - Clear the current messages
   - Toggle "Preserve log" to keep messages when navigating
   - Open the filter panel to find specific content

## 📚 How It Works

The extension injects a content script that captures all postMessage events on the page. These events are sent to the background service worker, which maintains a history of messages and communicates with the DevTools panel when it's open.

## 🧩 Use Cases

- **Debugging Cross-Origin Communication**: Easily view messages sent between frames or windows
- **Front-end Development**: Understand message flow in complex applications
- **Security Testing**: Analyze postMessage usage for potential vulnerabilities
- **API Debugging**: Inspect data passed through postMessage interfaces
- **Framework Development**: Debug messaging systems built on top of postMessage

## 🤝 Contributing

Contributions are welcome and appreciated! Please feel free to submit a Pull Request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for more information on how to contribute to this project.

## 📃 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Based on the initial work by [rohitcoder](https://github.com/rohitcoder)
- Inspired by the need for better postMessage debugging tools in web development

## 📞 Contact

If you have any questions or feedback, please open an issue on the GitHub repository. 