#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const scriptPath = path.resolve(__dirname, 'build-city-manifests.js');
const result = spawnSync(process.execPath, [scriptPath, '--city', 'shaoguan'], {
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
