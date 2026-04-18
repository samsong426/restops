#!/usr/bin/env node
const { exec, spawn } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 3001;

// Start the server
const server = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
  env: { ...process.env, PORT },
  stdio: 'inherit',
});

server.on('error', (err) => { console.error('Failed to start server:', err); process.exit(1); });

// Open browser once server is ready
const tryOpen = (attempts = 0) => {
  const http = require('http');
  http.get(`http://localhost:${PORT}`, () => {
    const url = `http://localhost:${PORT}`;
    const cmd = process.platform === 'darwin' ? `open "${url}"`
              : process.platform === 'win32'  ? `start "" "${url}"`
              : `xdg-open "${url}"`;
    exec(cmd);
    console.log(`RestOps running at ${url}`);
  }).on('error', () => {
    if (attempts < 20) setTimeout(() => tryOpen(attempts + 1), 300);
  });
};

setTimeout(() => tryOpen(), 500);

process.on('SIGINT', () => { server.kill(); process.exit(); });
process.on('SIGTERM', () => { server.kill(); process.exit(); });
