// Create a panel in chrome DevTools
chrome.devtools.panels.create(
  "PostMessage", // Panel title
  "images/icon16.png", // Panel icon
  "panel.html", // Panel page
  (panel) => {
    // Panel created callback
    console.log("PostMessage DevTools panel created");
  }
); 