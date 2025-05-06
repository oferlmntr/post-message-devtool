const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  // Normalize URL by removing query string and trailing slash
  let url = req.url.split('?')[0];
  if (url.endsWith('/') && url.length > 1) {
    url = url.slice(0, -1);
  }
  
  // Default to index.html for root path
  if (url === '/') {
    url = '/index.html';
  }
  
  // Resolve the file path
  const filePath = path.join(__dirname, url);
  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
  // Read the file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found
        res.writeHead(404);
        res.end(`File not found: ${url}`);
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server error: ${error.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}/`);
  console.log(`Open this URL in Chrome with your extension loaded`);
}); 