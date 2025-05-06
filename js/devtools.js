// Create a panel in chrome DevTools
chrome.devtools.panels.create(
  "postMessage", // Panel title
  "images/icon16.png", // Panel icon
  "panel.html", // Panel page
  (panel) => {
    // Panel created callback
    console.log("postMessage DevTools panel created");
  }
); 