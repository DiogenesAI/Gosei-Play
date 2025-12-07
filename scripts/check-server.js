#!/usr/bin/env node

/**
 * Check Server Status
 * Cross-platform script to check if server is running
 * Replaces: check-server.bat
 */

const http = require('http');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const TIMEOUT = 5000;

console.log('🔍 Checking server status...\n');

function checkServer(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            if (res.statusCode === 200) {
                resolve({ status: 'online', code: res.statusCode });
            } else {
                resolve({ status: 'error', code: res.statusCode });
            }
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.setTimeout(TIMEOUT, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

async function main() {
    try {
        console.log(`📡 Checking: ${SERVER_URL}`);
        const result = await checkServer(SERVER_URL);

        console.log(`✅ Server is ${result.status}`);
        console.log(`📊 Status Code: ${result.code}`);
        console.log(`🌐 URL: ${SERVER_URL}\n`);

        process.exit(0);
    } catch (error) {
        console.log(`❌ Server is offline`);
        console.log(`📊 Error: ${error.message}`);
        console.log(`🌐 URL: ${SERVER_URL}\n`);

        console.log('💡 Tips:');
        console.log('  - Make sure the server is running: npm run dev');
        console.log('  - Check if port 3001 is available');
        console.log('  - Verify SERVER_URL environment variable\n');

        process.exit(1);
    }
}

main();
