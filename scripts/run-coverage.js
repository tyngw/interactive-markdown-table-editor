#!/usr/bin/env node

const path = require('path');
const { execSync, spawn } = require('child_process');

// Get the path to nyc's wrap.js
const nycWrapPath = require.resolve('nyc/lib/wrap.js');

// Run the test with NYC instrumentation via environment variable
const env = { ...process.env };
env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --require ${nycWrapPath}`.trim();

// Debug logs to help CI analysis when coverage is not collected
// These prints are safe to keep temporarily; CI logs will surface the values.
console.log('CI-COVERAGE-DEBUG: nycWrapPath=', nycWrapPath);
console.log('CI-COVERAGE-DEBUG: NODE_OPTIONS (before exec)=', env.NODE_OPTIONS);
console.log('CI-COVERAGE-DEBUG: spawning node to run out/test/runTest.js (pid=', process.pid, ')');
console.log('CI-COVERAGE-DEBUG: env.CI=', env.CI);
console.log('CI-COVERAGE-DEBUG: All NODE_* env vars:', Object.keys(env).filter(k => k.startsWith('NODE')).map(k => `${k}=${env[k]}`).join(', '));

try {
    execSync('node ./out/test/runTest.js', {
        stdio: 'inherit',
        env: env
    });
} catch (error) {
    // preserve exit code and surface it for CI
    console.error('CI-COVERAGE-DEBUG: test runner exited with error', error && error.status);
    process.exit(error.status || 1);
}
