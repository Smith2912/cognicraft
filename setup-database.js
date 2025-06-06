#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

console.log(`${colors.green}${colors.bold}🐘 Setting up PostgreSQL Database for CogniCraft${colors.reset}\n`);

// Database configuration from .env
const DB_CONFIG = {
    host: 'localhost',
    port: 5432,
    database: 'cognicraft',
    user: 'postgres',
    password: 'password' // Default from .env, user should change this
};

// Function to run psql commands
function runPsqlCommand(command, database = 'postgres') {
    return new Promise((resolve, reject) => {
        const psql = spawn('psql', [
            '-h', DB_CONFIG.host,
            '-p', DB_CONFIG.port.toString(),
            '-U', DB_CONFIG.user,
            '-d', database,
            '-c', command
        ], {
            stdio: 'pipe',
            env: { ...process.env, PGPASSWORD: DB_CONFIG.password }
        });

        let output = '';
        let error = '';

        psql.stdout.on('data', (data) => {
            output += data.toString();
        });

        psql.stderr.on('data', (data) => {
            error += data.toString();
        });

        psql.on('close', (code) => {
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(error || `Command failed with code ${code}`));
            }
        });
    });
}

// Function to check if PostgreSQL is running
function checkPostgreSQLConnection() {
    return new Promise((resolve) => {
        const psql = spawn('psql', [
            '-h', DB_CONFIG.host,
            '-p', DB_CONFIG.port.toString(),
            '-U', DB_CONFIG.user,
            '-d', 'postgres',
            '-c', 'SELECT version();'
        ], {
            stdio: 'pipe',
            env: { ...process.env, PGPASSWORD: DB_CONFIG.password }
        });

        psql.on('error', (error) => {
            // Handle case where psql command is not found
            if (error.code === 'ENOENT') {
                resolve(false);
            } else {
                resolve(false);
            }
        });

        psql.on('close', (code) => {
            resolve(code === 0);
        });
    });
}

async function setupDatabase() {
    try {
        console.log(`${colors.blue}Step 1: Checking PostgreSQL installation...${colors.reset}`);
        
        const isConnected = await checkPostgreSQLConnection();
        if (!isConnected) {
            console.log(`${colors.red}❌ PostgreSQL is not installed or not running${colors.reset}`);
            console.log(`\n${colors.yellow}${colors.bold}📥 INSTALL POSTGRESQL FIRST:${colors.reset}`);
            console.log(`${colors.green}1. Go to: ${colors.bold}https://www.postgresql.org/download/windows/${colors.reset}`);
            console.log(`${colors.green}2. Download PostgreSQL 16.x for Windows x86-64${colors.reset}`);
            console.log(`${colors.green}3. Run installer as Administrator${colors.reset}`);
            console.log(`${colors.green}4. Set password: ${colors.bold}password${colors.reset}${colors.green} (to match .env file)${colors.reset}`);
            console.log(`${colors.green}5. Use port: ${colors.bold}5432${colors.reset}${colors.green} (default)${colors.reset}`);
            console.log(`${colors.green}6. Install all components${colors.reset}`);
            
            console.log(`\n${colors.blue}After installation, run this command again:${colors.reset}`);
            console.log(`${colors.bold}npm run setup:db${colors.reset}`);
            
            console.log(`\n${colors.yellow}Alternative - Chocolatey (run PowerShell as Admin):${colors.reset}`);
            console.log(`${colors.bold}choco install postgresql --confirm${colors.reset}`);
            process.exit(1);
        }
        
        console.log(`${colors.green}✅ PostgreSQL connection successful${colors.reset}`);

        console.log(`\n${colors.blue}Step 2: Creating database '${DB_CONFIG.database}'...${colors.reset}`);
        
        try {
            await runPsqlCommand(`CREATE DATABASE ${DB_CONFIG.database};`);
            console.log(`${colors.green}✅ Database '${DB_CONFIG.database}' created successfully${colors.reset}`);
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log(`${colors.yellow}⚠️  Database '${DB_CONFIG.database}' already exists${colors.reset}`);
            } else {
                throw error;
            }
        }

        console.log(`\n${colors.blue}Step 3: Testing database connection...${colors.reset}`);
        
        const result = await runPsqlCommand('SELECT current_database(), current_user;', DB_CONFIG.database);
        console.log(`${colors.green}✅ Successfully connected to database${colors.reset}`);
        
        console.log(`\n${colors.green}${colors.bold}🎉 Database setup complete!${colors.reset}`);
        console.log(`${colors.green}Database URL: postgresql://${DB_CONFIG.user}:${DB_CONFIG.password}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}${colors.reset}`);
        
        console.log(`\n${colors.blue}Next steps:${colors.reset}`);
        console.log(`1. Run: ${colors.yellow}npm run start:dev${colors.reset} to start both servers`);
        console.log(`2. The backend will automatically sync database tables`);
        console.log(`3. Frontend: http://localhost:5173`);
        console.log(`4. Backend API: http://localhost:3001`);

    } catch (error) {
        console.error(`${colors.red}❌ Database setup failed:${colors.reset}`, error.message);
        
        console.log(`\n${colors.yellow}Troubleshooting tips:${colors.reset}`);
        console.log(`1. Make sure PostgreSQL is installed and running`);
        console.log(`2. Check if the password '${DB_CONFIG.password}' is correct`);
        console.log(`3. Verify PostgreSQL is listening on port ${DB_CONFIG.port}`);
        console.log(`4. Try connecting manually: psql -h ${DB_CONFIG.host} -U ${DB_CONFIG.user} -d postgres`);
        
        process.exit(1);
    }
}

// Run setup
setupDatabase(); 