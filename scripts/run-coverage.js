#!/usr/bin/env node

const path = require('path');
const { execSync } = require('child_process');

// Get the path to nyc's wrap.js
const nycWrapPath = require.resolve('nyc/lib/wrap.js');

// Run the test with NYC instrumentation via environment variable
const env = { ...process.env };
env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --require ${nycWrapPath}`.trim();

try {
    execSync('node ./out/test/runTest.js', {
        stdio: 'inherit',
        env: env
    });
} catch (error) {
    // preserve exit code and surface it for CI
    process.exit(error.status || 1);
}

