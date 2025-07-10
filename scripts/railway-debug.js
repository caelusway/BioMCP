#!/usr/bin/env node

/**
 * Railway debugging script for Bio Analytics MCP
 * Helps diagnose deployment and port exposure issues
 */

import https from 'https';
import http from 'http';
import { createServer } from 'http';

console.log('🔍 Railway Debugging Script for Bio Analytics MCP');
console.log('='.repeat(60));

// 1. Environment Variables Check
console.log('\n📋 Environment Variables:');
const envVars = [
  'NODE_ENV',
  'PORT',
  'HOST',
  'RAILWAY_ENVIRONMENT',
  'RAILWAY_PROJECT_NAME',
  'RAILWAY_SERVICE_NAME',
  'RAILWAY_PROJECT_ID',
  'RAILWAY_SERVICE_ID',
  'MCP_HTTP_MODE',
  'MCP_API_KEY',
  'SUPABASE_URL'
];

envVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`   ${varName}: ${value || '❌ NOT SET'}`);
});

// 2. Port Binding Test
console.log('\n🌐 Port Binding Test:');
const testPort = process.env.PORT || 3000;
const testHost = '0.0.0.0';

const testServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Railway port test successful',
    port: testPort,
    host: testHost,
    timestamp: new Date().toISOString()
  }));
});

testServer.listen(testPort, testHost, () => {
  console.log(`✅ Successfully bound to ${testHost}:${testPort}`);
  
  // Test HTTP request to ourselves
  const testReq = http.request({
    hostname: 'localhost',
    port: testPort,
    path: '/',
    method: 'GET'
  }, (res) => {
    console.log(`✅ HTTP self-test successful: ${res.statusCode}`);
    testServer.close();
    
    // 3. Railway URL Test (if provided)
    testRailwayUrl();
  });

  testReq.on('error', (error) => {
    console.log(`❌ HTTP self-test failed: ${error.message}`);
    testServer.close();
    testRailwayUrl();
  });

  testReq.end();

}).on('error', (error) => {
  console.log(`❌ Port binding failed: ${error.message}`);
  if (error.code === 'EADDRINUSE') {
    console.log(`   Port ${testPort} is already in use`);
  } else if (error.code === 'EACCES') {
    console.log(`   Permission denied to bind to port ${testPort}`);
  }
  testRailwayUrl();
});

function testRailwayUrl() {
  console.log('\n🌐 Railway URL Test:');
  
  const railwayUrl = process.argv[2];
  if (!railwayUrl) {
    console.log('⚠️  No Railway URL provided');
    console.log('   Usage: node scripts/railway-debug.js <railway-url>');
    console.log('   Example: node scripts/railway-debug.js https://your-app.railway.app');
    showRecommendations();
    return;
  }

  console.log(`Testing: ${railwayUrl}`);
  
  const testUrls = [
    `${railwayUrl}/health`,
    `${railwayUrl}/status`,
    `${railwayUrl}/`
  ];

  let completed = 0;
  const total = testUrls.length;

  testUrls.forEach(url => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, (res) => {
      console.log(`✅ ${url}: ${res.statusCode}`);
      completed++;
      if (completed === total) {
        showRecommendations();
      }
    });

    req.on('error', (error) => {
      console.log(`❌ ${url}: ${error.message}`);
      completed++;
      if (completed === total) {
        showRecommendations();
      }
    });

    req.setTimeout(5000, () => {
      console.log(`⏰ ${url}: Timeout`);
      req.destroy();
      completed++;
      if (completed === total) {
        showRecommendations();
      }
    });

    req.end();
  });
}

function showRecommendations() {
  console.log('\n💡 Railway Deployment Recommendations:');
  console.log('='.repeat(60));
  
  console.log('\n1. ✅ Essential Environment Variables:');
  console.log('   - NODE_ENV=production (set automatically by Railway)');
  console.log('   - PORT (set automatically by Railway)');
  console.log('   - Do NOT manually set PORT in Railway dashboard');
  
  console.log('\n2. 🔧 Required Variables to Set:');
  console.log('   - SUPABASE_URL=your_supabase_url');
  console.log('   - SUPABASE_ANON_KEY=your_anon_key');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  console.log('   - MCP_API_KEY=your_secure_api_key (optional but recommended)');
  
  console.log('\n3. 🚀 Railway Configuration:');
  console.log('   - Use GitHub integration for automatic deploys');
  console.log('   - Ensure railway.json is in your repo root');
  console.log('   - Health check should be at /health');
  
  console.log('\n4. 🔍 Common Issues:');
  console.log('   - Server not starting: Check Railway logs for errors');
  console.log('   - Port not exposed: Ensure server binds to 0.0.0.0');
  console.log('   - Health check failing: Verify /health endpoint works');
  console.log('   - Database errors: Check Supabase credentials');
  
  console.log('\n5. 🛠️ Debugging Steps:');
  console.log('   - Check Railway logs: railway logs --follow');
  console.log('   - Test health endpoint: curl https://your-app.railway.app/health');
  console.log('   - Verify environment variables in Railway dashboard');
  console.log('   - Check service metrics in Railway dashboard');
  
  console.log('\n📞 Need Help?');
  console.log('   - Railway logs: railway logs --follow');
  console.log('   - Railway dashboard: https://railway.app/dashboard');
  console.log('   - Test this script: node scripts/railway-debug.js <your-railway-url>');
  
  console.log('\n🎯 Ready to deploy? Push to GitHub and Railway will auto-deploy!');
} 