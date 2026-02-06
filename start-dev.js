#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting CogniCraft Development Environment...\n');

// Colors for console output
const colors = {
    backend: '\x1b[36m', // Cyan
    frontend: '\x1b[35m', // Magenta
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    green: '\x1b[32m'
};

// Function to spawn a process with colored output
function spawnWithColors(command, args, cwd, label, color) {
    const process = spawn(command, args, {
        cwd: cwd,
        stdio: 'pipe',
        shell: true
    });

    process.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                console.log(`${color}[${label}]${colors.reset} ${line}`);
            }
        });
    });

    process.stderr.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                console.log(`${color}[${label}]${colors.reset} ${line}`);
            }
        });
    });

    process.on('close', (code) => {
        console.log(`${color}[${label}]${colors.reset} Process exited with code ${code}`);
    });

    return process;
}

// Check if we're on Windows
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

console.log(`${colors.green}${colors.bold}Starting Backend Server...${colors.reset}`);
const backendProcess = spawnWithColors(
    npmCommand, 
    ['run', 'dev'], 
    join(__dirname, 'backend'),
    'Backend',
    colors.backend
);

console.log(`${colors.green}${colors.bold}Starting Frontend Server...${colors.reset}`);
const frontendProcess = spawnWithColors(
    npmCommand, 
    ['run', 'dev'], 
    __dirname,
    'Frontend',
    colors.frontend
);

// Handle process termination
function cleanup() {
    console.log('\n🛑 Shutting down development servers...');
    backendProcess.kill();
    frontendProcess.kill();
    process.exit(0);
}

// Handle Ctrl+C and other termination signals
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

console.log(`\n${colors.green}${colors.bold}✅ Development servers starting...${colors.reset}`);
console.log(`${colors.backend}Backend:${colors.reset} Running on http://localhost:3001`);
console.log(`${colors.frontend}Frontend:${colors.reset} Running on http://localhost:5173`);
console.log(`\n${colors.bold}Press Ctrl+C to stop both servers${colors.reset}\n`);

// Auto-open browser for frontend
setTimeout(() => {
    const url = 'http://localhost:5173';
    if (process.platform === 'win32') {
        spawn('cmd', ['/c', 'start', url], { stdio: 'ignore', shell: true });
    } else if (process.platform === 'darwin') {
        spawn('open', [url], { stdio: 'ignore' });
    } else {
        spawn('xdg-open', [url], { stdio: 'ignore' });
    }
}, 1000);
