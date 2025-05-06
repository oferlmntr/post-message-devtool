# Contributing to postMessage DevTools

Thank you for your interest in contributing to postMessage DevTools! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior to the project maintainers by opening an issue.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report. Following these guidelines helps maintainers understand your report, reproduce the behavior, and find related reports.

* **Use the GitHub issue search** — check if the issue has already been reported.
* **Check if the issue has been fixed** — try to reproduce it using the latest `main` branch.
* **Isolate the problem** — create a reduced test case and a live example if possible.

When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title** for the issue to identify the problem.
* **Describe the exact steps which reproduce the problem** in as much detail as possible.
* **Provide specific examples to demonstrate the steps**. Include links to files or GitHub projects, or copy/pasteable snippets.
* **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
* **Explain which behavior you expected to see instead and why.**
* **Include screenshots and animated GIFs** if possible.
* **Include your browser information** (which browser, version).

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion, from minor improvements to completely new features:

* **Use a clear and descriptive title** for the issue to identify the suggestion.
* **Provide a step-by-step description of the suggested enhancement** in as much detail as possible.
* **Provide specific examples to demonstrate the steps** or point to similar features in other extensions.
* **Describe the current behavior** and **explain which behavior you expected to see instead** and why.
* **Explain why this enhancement would be useful** to most users.
* **List some other tools or applications where this enhancement exists.**

### Pull Requests

* Fill in the required pull request template.
* Do not include issue numbers in the PR title.
* Include screenshots and animated GIFs in your pull request whenever possible.
* Follow the [style guides](#style-guides).
* Document new code based on the [documentation styleguide](#documentation-styleguide).
* End all files with a newline.

## Style Guides

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line
* Consider starting the commit message with an applicable emoji:
  * 🐛 `:bug:` when fixing a bug
  * ✨ `:sparkles:` when adding a new feature
  * 📚 `:books:` when adding or updating documentation
  * 🎨 `:art:` when improving the format/structure of the code
  * ⚡️ `:zap:` when improving performance
  * 🔧 `:wrench:` when updating configs

### JavaScript Styleguide

All JavaScript code should adhere to the [JavaScript Standard Style](https://standardjs.com/).

* Prefer the object spread operator (`{...anotherObj}`) to `Object.assign()`
* Inline `export`s with expressions whenever possible
  ```js
  // Use this:
  export default class ClassName {

  }

  // Instead of:
  class ClassName {

  }
  export default ClassName
  ```

### Documentation Styleguide

* Use [Markdown](https://daringfireball.net/projects/markdown).
* Reference methods and classes in markdown with the custom `{}` notation:
  * Reference classes with `{ClassName}`
  * Reference instance methods with `{ClassName.methodName}`
  * Reference class methods with `{ClassName.methodName()}`

## Development Setup

Here are the steps to set up the project for development:

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/post-message-devtool.git`
3. Install dependencies (if any)
4. Load the extension in Chrome for testing:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select your project directory

## Testing

When submitting a PR, please ensure your changes don't break existing functionality. Test your changes thoroughly in different scenarios:

1. With simple postMessage events
2. With complex nested data in postMessages
3. With cross-origin postMessages
4. With high frequency postMessage events

## Releases

Maintainers are responsible for creating releases. If you need a new release, please open an issue to request one.

## Thank You!

Your contributions to open source, large or small, make projects like this possible. Thank you for taking the time to contribute. 