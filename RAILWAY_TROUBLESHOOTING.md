# Railway Port Exposure Troubleshooting Guide

## 🚨 Common Railway Port Issues & Solutions

### Problem: Railway not exposing port 3000
**This is the most common Railway deployment issue. Here's how to fix it:**

## ✅ Key Fixes Applied

### 1. **DO NOT Set PORT Environment Variable**
- ❌ **Wrong**: Setting `PORT=3000` in Railway dashboard
- ✅ **Correct**: Let Railway set `PORT` automatically
- Railway automatically injects the `PORT` environment variable

### 2. **Enhanced Server Configuration**
Updated `src/index.ts` with:
- ✅ Better Railway detection logic
- ✅ Forced HTTP mode when `PORT` is set
- ✅ Always bind to `0.0.0.0` (not `localhost`)
- ✅ Enhanced logging for debugging
- ✅ Improved error handling

### 3. **Updated Railway Configuration**
Updated `railway.json` with:
- ✅ Proper health check timeout (300ms)
- ✅ Explicit `NODE_ENV=production`
- ✅ Better restart policy

## 🔧 Environment Variables to Set

### ✅ Set These in Railway Dashboard:
```env
NODE_ENV=production
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MCP_API_KEY=your_secure_api_key
```

### ❌ DO NOT Set These:
```env
PORT=3000           # Railway sets this automatically
HOST=0.0.0.0       # Server handles this automatically
MCP_HTTP_MODE=true # Server detects Railway automatically
```

## 🛠️ Debugging Steps

### 1. Build and Deploy
```bash
# Build locally first
npm run build

# Deploy to Railway
git add .
git commit -m "Fix Railway port exposure"
git push origin main
```

### 2. Check Railway Logs
```bash
# If you have Railway CLI installed
railway logs --follow

# Or check in Railway dashboard
# Go to your project > Deployments > Click on latest deployment > View logs
```

### 3. Test Your Deployment
```bash
# After deployment, test with our debug script
node scripts/railway-debug.js https://your-app.railway.app
```

### 4. Verify Health Check
```bash
# Test health endpoint
curl https://your-app.railway.app/health

# Should return:
# {"status":"healthy","service":"Bio Analytics MCP","timestamp":"...","version":"1.0.0"}
```

## 🔍 Common Error Messages & Solutions

### Error: "Port already in use"
**Solution**: Don't set `PORT` in Railway dashboard

### Error: "EADDRINUSE"
**Solution**: Railway is trying to use a port that's already taken
- Check if you have multiple services running
- Ensure you're not setting `PORT` manually

### Error: "Health check failing"
**Solution**: 
- Verify `/health` endpoint is accessible
- Check if server is binding to `0.0.0.0`
- Ensure health check timeout is sufficient (300ms)

### Error: "Server not starting"
**Solution**:
- Check Railway logs for specific error messages
- Verify all environment variables are set
- Ensure database credentials are correct

## 📊 Expected Railway Logs

When deployment is successful, you should see:
```
🔍 Deployment Detection:
   - Railway Environment: true
   - HTTP Mode: true
   - PORT from env: 8080
   - Using port: 8080
   - Using host: 0.0.0.0
   - NODE_ENV: production
✅ Bio Analytics MCP HTTP Server listening on 0.0.0.0:8080
🔗 Health check: http://0.0.0.0:8080/health
🔗 MCP Inspector: http://0.0.0.0:8080/mcp
🔗 Service info: http://0.0.0.0:8080/
🚀 Railway deployment detected - Server ready for external connections
🌐 Railway should expose this service on HTTPS automatically
🎯 Server is now accepting connections
```

## 🌐 Testing Your Deployed MCP

### 1. Health Check
```bash
curl https://your-app.railway.app/health
```

### 2. Service Information
```bash
curl https://your-app.railway.app/
```

### 3. MCP Status
```bash
curl https://your-app.railway.app/status
```

### 4. Connect from Cursor
Update your `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "bio-analytics-remote": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/http-client",
        "https://your-app.railway.app/mcp"
      ],
      "env": {
        "MCP_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## 🚀 Quick Deployment Checklist

- [ ] **Build succeeds**: `npm run build`
- [ ] **Environment variables set** (except PORT)
- [ ] **Code pushed to GitHub**
- [ ] **Railway connected to GitHub repo**
- [ ] **Health check returns 200**
- [ ] **Logs show "Server is now accepting connections"**
- [ ] **MCP endpoint accessible**

## 📞 Still Having Issues?

### Debug Commands
```bash
# Test Railway deployment
node scripts/railway-debug.js https://your-app.railway.app

# Build and test locally
npm run build
NODE_ENV=production PORT=3000 npm start

# Check Railway logs
railway logs --follow
```

### Key Points to Remember
1. **Never set PORT manually** - Railway provides it
2. **Always bind to 0.0.0.0** - not localhost
3. **Use GitHub integration** - for automatic deploys
4. **Check health endpoint** - it should return 200
5. **Monitor Railway logs** - for specific error messages

---

**🎉 Success Indicator**: When you see "Server is now accepting connections" in Railway logs, your port exposure is working correctly! 