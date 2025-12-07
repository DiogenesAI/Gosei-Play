#!/usr/bin/env node

/**
 * Start Development Environment
 * Cross-platform script to start both client and server
 * Replaces: start.bat, start.sh
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';

console.log('🚀 Starting Gosei Play Development Environment...\n');

// Start client
console.log('📱 Starting React client...');
const clientCmd = isWindows ? 'npm.cmd' : 'npm';
const client = spawn(clientCmd, ['start'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true
});

// Start server
console.log('🖥️  Starting Node.js server...\n');
const serverCmd = isWindows ? 'npm.cmd' : 'npm';
const server = spawn(serverCmd, ['start'], {
    cwd: path.join(process.cwd(), 'server'),
    stdio: 'inherit',
    shell: true
});

// Handle exit
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    client.kill();
    server.kill();
    process.exit(0);
});

client.on('error', (err) => {
    console.error('❌ Client error:', err);
});

server.on('error', (err) => {
    console.error('❌ Server error:', err);
});

console.log('✅ Development environment started!');
console.log('📝 Client: http://localhost:3000');
console.log('📝 Server: http://localhost:3001');
console.log('\n💡 Press Ctrl+C to stop\n');
