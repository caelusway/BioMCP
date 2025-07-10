#!/usr/bin/env node

/**
 * Minimal Railway test server to isolate deployment issues
 * This will help identify if the problem is with Railway or our MCP server
 */

const express = require('express');
const app = express();

// Railway port detection
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

console.log('🚀 Railway Simple Test Server');
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🌐 Port: ${PORT} (from env: ${process.env.PORT || 'not set'})`);
console.log(`🌐 Host: ${HOST}`);
console.log(`📦 Railway Project: ${process.env.RAILWAY_PROJECT_NAME || 'not set'}`);
console.log(`📦 Railway Service: ${process.env.RAILWAY_SERVICE_NAME || 'not set'}`);

// Simple endpoints
app.get('/', (req, res) => {
  res.json({
    message: 'Railway Simple Test Server is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: PORT,
    host: HOST,
    headers: req.headers,
    railway: {
      project: process.env.RAILWAY_PROJECT_NAME,
      service: process.env.RAILWAY_SERVICE_NAME,
      environment: process.env.RAILWAY_ENVIRONMENT
    }
  });
});

app.get('/ping', (req, res) => {
  res.json({
    message: 'pong',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    port: PORT,
    uptime: process.uptime()
  });
});

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`✅ Server listening on ${HOST}:${PORT}`);
  console.log(`🔗 Test URL: http://${HOST}:${PORT}/`);
  console.log(`🔗 Health: http://${HOST}:${PORT}/health`);
  console.log(`🔗 Ping: http://${HOST}:${PORT}/ping`);
  console.log('🎯 Server is ready for Railway deployment!');
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  } else if (error.code === 'EACCES') {
    console.error(`Permission denied to bind to port ${PORT}`);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
}); 