#!/usr/bin/env node

/**
 * Railway startup script for Bio Analytics MCP
 * Ensures proper server initialization and port exposure
 */

import { spawn } from 'child_process';
import { createServer } from 'http';

console.log('🚀 Railway Startup Script for Bio Analytics MCP');
console.log('🔍 Environment Detection:');
console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`   - PORT: ${process.env.PORT || 'not set'}`);
console.log(`   - Railway Project: ${process.env.RAILWAY_PROJECT_NAME || 'not set'}`);
console.log(`   - Railway Service: ${process.env.RAILWAY_SERVICE_NAME || 'not set'}`);

// Railway port detection
const port = process.env.PORT || 3000;
const host = '0.0.0.0';

console.log(`🌐 Will bind to: ${host}:${port}`);

// Test if we can bind to the port
const testServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Railway port test successful');
});

testServer.listen(port, host, () => {
  console.log(`✅ Port ${port} is available`);
  testServer.close();
  
  // Start the actual MCP server
  console.log('🎯 Starting Bio Analytics MCP Server...');
  
  const mcpProcess = spawn('node', ['dist/index.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: port.toString(),
      HOST: host
    }
  });

  mcpProcess.on('error', (error) => {
    console.error('❌ Failed to start MCP server:', error);
    process.exit(1);
  });

  mcpProcess.on('exit', (code) => {
    console.log(`🔄 MCP server exited with code ${code}`);
    process.exit(code);
  });

  // Handle shutdown signals
  process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    mcpProcess.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    mcpProcess.kill('SIGTERM');
  });

}).on('error', (error) => {
  console.error(`❌ Cannot bind to port ${port}:`, error);
  if (error.code === 'EADDRINUSE') {
    console.error(`   Port ${port} is already in use`);
  } else if (error.code === 'EACCES') {
    console.error(`   Permission denied to bind to port ${port}`);
  }
  process.exit(1);
}); 