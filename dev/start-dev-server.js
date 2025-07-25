#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..');

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname;
    
    // Default to dev/index.html for root requests
    if (pathname === '/') {
        pathname = '/dev/index.html';
    }
    
    const filePath = path.join(ROOT_DIR, pathname);
    
    // Security check - ensure the file is within our project directory
    if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }
    
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        
        const mimeType = getMimeType(filePath);
        res.writeHead(200, { 
            'Content-Type': mimeType,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        
        stream.on('error', (error) => {
            console.error('Error reading file:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 Internal Server Error');
        });
    });
});

server.listen(PORT, () => {
    console.log('🚀 Markdown Table Editor Development Server');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📍 Server running at: http://localhost:${PORT}/`);
    console.log(`🔧 Development mode: http://localhost:${PORT}/dev/`);
    console.log('');
    console.log('💡 Instructions:');
    console.log('   • Open the development URL in your browser');
    console.log('   • Edit HTML/CSS/JS files in the webview folder');
    console.log('   • Refresh the browser to see changes');
    console.log('   • No need to rebuild the VSCode extension!');
    console.log('');
    console.log('⚡ Press Ctrl+C to stop the server');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

process.on('SIGINT', () => {
    console.log('\n🛑 Stopping development server...');
    server.close(() => {
        console.log('✅ Development server stopped');
        process.exit(0);
    });
});