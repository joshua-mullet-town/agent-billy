#!/usr/bin/env ts-node

import { spawn } from 'child_process';
import { config } from 'dotenv';

// Load environment variables
config();

console.log('🚀 Starting Agent Billy in production mode...');

// Start health server
const healthServer = spawn('ts-node', ['scripts/health-server.ts'], {
  stdio: ['inherit', 'inherit', 'inherit']
});

// Start Billy's main loop
const billyAgent = spawn('ts-node', ['scripts/run-agent-loop.ts', 'watch', '--interval', '60'], {
  stdio: ['inherit', 'inherit', 'inherit']
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  healthServer.kill('SIGTERM');
  billyAgent.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  healthServer.kill('SIGINT');
  billyAgent.kill('SIGINT');
});

// Monitor child processes
healthServer.on('exit', (code) => {
  console.log(`🏥 Health server exited with code ${code}`);
});

billyAgent.on('exit', (code) => {
  console.log(`🤖 Billy agent exited with code ${code}`);
  process.exit(code || 0);
});