const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }

  const extname = path.extname(filePath);
  let contentType = 'text/html';
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
      contentType = 'image/jpg';
      break;
    case '.svg':
      contentType = 'image/svg+xml';
      break;
    case '.tsx':
      // Serve .tsx as javascript for environments that transpile on the fly (like esm.sh setups)
      // or to prevent download-as-file behavior in some contexts.
      contentType = 'text/javascript'; 
      break;
    case '.ts':
      contentType = 'text/javascript';
      break;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if(error.code == 'ENOENT'){
         res.writeHead(404);
         res.end('File not found');
      }
      else {
        res.writeHead(500);
        res.end('Server error: '+error.code);
      }
    }
    else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});