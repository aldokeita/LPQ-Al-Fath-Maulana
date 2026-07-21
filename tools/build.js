#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const cwd = process.cwd();

function runNodeScript(scriptPath, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', (error) => {
      console.error(`[build] Failed to start ${scriptPath}: ${error.message}`);
      resolve(1);
    });

    child.on('close', (code) => resolve(code ?? 1));
  });
}

const llmsScript = path.join(cwd, 'tools', 'generate-llms.js');
const viteCli = path.join(cwd, 'node_modules', 'vite', 'bin', 'vite.js');

const llmsExitCode = await runNodeScript(llmsScript);

if (llmsExitCode !== 0) {
  console.warn(`[build] Warning: LLMS generator failed with exit code ${llmsExitCode}. Continuing with Vite build.`);
}

const viteExitCode = await runNodeScript(viteCli, ['build']);
process.exit(viteExitCode);
