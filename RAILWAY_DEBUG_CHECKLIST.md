# Railway Debug Checklist - Port Exposure Issues

## 🔍 Current Status
✅ **Server works locally** - binding to 0.0.0.0:3000 successfully
❌ **Railway deployment not exposing port** - need to debug Railway-specific issues

## 🛠️ Railway Debugging Steps

### Step 1: Test with Simple Server
First, let's isolate if the issue is with Railway or our MCP server:

```bash
# Test with minimal server
npm run start:simple

# Or deploy simple version to Railway
# Rename railway-simple.json to railway.json temporarily
```

### Step 2: Check Railway Environment Variables
In Railway dashboard, verify these are **NOT** set:
- ❌ `PORT` - Railway sets this automatically
- ❌ `HOST` - Server handles this automatically
- ❌ `MCP_HTTP_MODE` - Server detects Railway automatically

### Step 3: Check Railway Logs
```bash
railway logs --follow
```

Look for these success indicators:
```
✅ Bio Analytics MCP HTTP Server listening on 0.0.0.0:[PORT]
🎯 Server is now accepting connections
```

### Step 4: Verify Railway Configuration

#### ✅ Correct railway.json:
```json
{
  "deploy": {
    "startCommand": "NODE_ENV=production npm start",
    "healthcheckPath": "/ping",
    "healthcheckTimeout": 300
  }
}
```

#### ❌ Common Mistakes:
- Setting custom PORT in Railway dashboard
- Using localhost instead of 0.0.0.0
- Health check timeout too short
- Missing health check endpoint

### Step 5: Railway Service Configuration

#### Check Railway Dashboard:
1. **Service Settings**:
   - ✅ Port should be auto-detected
   - ✅ Custom domain should be working
   - ✅ Health checks should be passing

2. **Environment Variables**:
   - ✅ Set: `NODE_ENV=production`
   - ✅ Set: Your database credentials
   - ❌ Don't set: `PORT`, `HOST`, `MCP_HTTP_MODE`

3. **Build Logs**:
   - ✅ `npm run build` should succeed
   - ✅ TypeScript compilation should be clean
   - ✅ No dependency errors

4. **Deploy Logs**:
   - ✅ Server should start without errors
   - ✅ Should bind to 0.0.0.0:[RAILWAY_PORT]
   - ✅ Health check should return 200

### Step 6: Test Railway Deployment

#### Test commands after deployment:
```bash
# Test health endpoint
curl https://your-app.railway.app/ping

# Test main endpoint
curl https://your-app.railway.app/

# Test with debug script
node scripts/railway-debug.js https://your-app.railway.app
```

### Step 7: Common Railway Issues & Solutions

#### Issue: "Service Unavailable"
**Cause**: Health check failing
**Solution**: 
- Check if `/ping` endpoint is accessible
- Verify server is binding to 0.0.0.0
- Check health check timeout

#### Issue: "Container Exit Code 1"
**Cause**: Server crashing on startup
**Solution**:
- Check Railway logs for error messages
- Verify database connection
- Check environment variables

#### Issue: "Port Already in Use"
**Cause**: Multiple services or incorrect port configuration
**Solution**:
- Don't set PORT in Railway dashboard
- Check if you have multiple services

#### Issue: "Health Check Timeout"
**Cause**: Server taking too long to start
**Solution**:
- Increase health check timeout to 300ms
- Check database connection speed
- Verify all dependencies are installed

### Step 8: Railway-Specific Fixes

#### 1. Update Server Code:
```typescript
// Always bind to 0.0.0.0 for Railway
const httpHost = '0.0.0.0';

// Use Railway's PORT
const httpPort = parseInt(process.env.PORT || '3000');

// Enhanced Railway detection
const isRailway = !!(process.env.RAILWAY_ENVIRONMENT || 
                    process.env.RAILWAY_PROJECT_NAME || 
                    process.env.RAILWAY_SERVICE_NAME || 
                    process.env.RAILWAY_PROJECT_ID);
```

#### 2. Add Railway-Specific Endpoints:
```typescript
// Simple ping endpoint for Railway health checks
app.get('/ping', (req, res) => {
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
});
```

#### 3. Enhanced Error Handling:
```typescript
server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});
```

## 🚀 Quick Fix Deployment

Try this streamlined approach:

1. **Use simple server first**:
   ```bash
   # Rename railway-simple.json to railway.json
   mv railway-simple.json railway.json
   
   # Deploy simple version
   git add . && git commit -m "Test simple server" && git push
   ```

2. **If simple server works, switch back**:
   ```bash
   # Restore original railway.json
   mv railway.json railway-simple.json
   git checkout railway.json
   
   # Deploy full MCP server
   git add . && git commit -m "Deploy full MCP server" && git push
   ```

## 📊 Success Indicators

When Railway deployment is working correctly:

1. **Railway Dashboard**: Service shows as "Running"
2. **Health Check**: Returns 200 OK
3. **Logs**: Show "Server is now accepting connections"
4. **URL**: `https://your-app.railway.app/ping` returns JSON
5. **MCP**: `https://your-app.railway.app/mcp` is accessible

## 🔧 Final Troubleshooting

If still not working:

1. **Check Railway Status**: https://status.railway.app
2. **Try Different Region**: Change Railway region in dashboard
3. **Contact Railway Support**: With logs and configuration
4. **Alternative**: Deploy to Heroku or Vercel as backup

---

**Remember**: The server works locally, so the issue is Railway-specific configuration, not the server code itself! 