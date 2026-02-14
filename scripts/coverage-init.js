// Coverage initialization preload script for VS Code extension tests
// This script is loaded via NODE_OPTIONS=--require to enable NYC instrumentation

const path = require('path');
const nycWrap = require('nyc/lib/wrap.js');

// nyc/lib/wrap.js handles initialization
