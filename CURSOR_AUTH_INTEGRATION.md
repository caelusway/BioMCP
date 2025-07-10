# 🔐 Cursor Authentication Integration Guide

This guide shows how to securely integrate the **Bio Analytics MCP** with Cursor IDE using authentication after Railway deployment.

## 🚀 Step 1: Railway Deployment with Auth

### Environment Variables for Railway

Set these environment variables in your Railway deployment:

```bash
# Database (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# Server (Required)
MCP_HTTP_MODE=true
MCP_HTTP_PORT=3000

# Authentication (Required for Security)
ENABLE_AUTH=true
TEAM_API_KEY=your-secure-production-api-key
ALLOWED_USERS=your-email@company.com,team@company.com
SESSION_TIMEOUT=3600
CORS_ORIGINS=https://cursor.sh,https://cursor.ai

# Optional
NODE_ENV=production
LOG_LEVEL=1
```

### Deploy to Railway

```bash
# Option 1: Railway CLI
railway variables set SUPABASE_URL="https://your-project.supabase.co"
railway variables set SUPABASE_ANON_KEY="your_anon_key"
railway variables set MCP_HTTP_MODE="true"
railway variables set MCP_HTTP_PORT="3000"
railway variables set ENABLE_AUTH="true"
railway variables set TEAM_API_KEY="your-secure-api-key"
railway variables set ALLOWED_USERS="your-email@company.com"
railway variables set CORS_ORIGINS="https://cursor.sh,https://cursor.ai"
railway up

# Option 2: Railway Dashboard
# Set all variables above in Railway dashboard and deploy
```

## 🔧 Step 2: Configure Cursor MCP

### Method 1: HTTP MCP Integration (Recommended)

Create/update your Cursor MCP configuration file:

**Location**: `~/.cursor/mcp_servers.json` (macOS/Linux) or `%APPDATA%\Cursor\mcp_servers.json` (Windows)

```json
{
  "mcpServers": {
    "bio-analytics-mcp": {
      "command": "npx",
      "args": ["@modelcontextprotocol/http-client"],
      "env": {
        "MCP_HTTP_URL": "https://your-app.railway.app/mcp",
        "MCP_API_KEY": "your-secure-api-key"
      }
    }
  }
}
```

### Method 2: Custom HTTP Client

If you prefer a custom setup:

```json
{
  "mcpServers": {
    "bio-analytics-mcp": {
      "command": "node",
      "args": ["-e", "console.log('Connecting to Bio Analytics MCP...')"],
      "env": {
        "MCP_SERVER_URL": "https://your-app.railway.app",
        "MCP_API_KEY": "your-secure-api-key",
        "MCP_USER_ID": "your-email@company.com"
      }
    }
  }
}
```

## 📋 Step 3: Authentication Setup

### 1. Generate API Key

Create a secure API key for your team:

```bash
# Generate a secure API key
openssl rand -base64 32
# Example: K8vX2nR9mZ4pL7wQ5sF6tH3jC1bN8eM9
```

### 2. Test Authentication

Test your Railway deployment:

```bash
# Test health endpoint
curl https://your-app.railway.app/health

# Test authentication status
curl -H "X-API-Key: your-secure-api-key" \
     https://your-app.railway.app/auth/status

# Test MCP endpoint
curl -X POST https://your-app.railway.app/mcp \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-secure-api-key" \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "tools/list"
     }'
```

### 3. Create User Session (If Needed)

```bash
# Create a session for your user
curl -X POST https://your-app.railway.app/auth/login \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-secure-api-key" \
     -d '{
       "userId": "your-email@company.com",
       "permissions": ["read", "analytics"]
     }'
```

## 🎯 Step 4: Use in Cursor

### 1. Restart Cursor

After updating your MCP configuration, restart Cursor IDE.

### 2. Verify Integration

1. Open Cursor
2. Check that "Bio Analytics MCP" appears in your MCP servers list
3. Test with a simple query:

```
Can you list all the Bio DAOs available in the system?
```

### 3. Available Commands

Once connected, you can use these commands in Cursor:

```
# List all Bio/Science DAOs
"List all available Bio DAOs"

# Get DAO analytics
"Get comprehensive analytics for VitaDAO for the last 30 days"

# Twitter metrics
"Show me Twitter engagement metrics for MoleculeDAO"

# Discord activity
"What's the Discord activity for PsyDAO?"

# Governance analysis
"Analyze governance participation for CerebrumDAO"

# Custom queries
"Execute a custom query to find the most active Bio DAOs"
```

## 🔐 Security Features

### Authentication Layers

1. **API Key Authentication** - Required for all MCP requests
2. **User Authorization** - Only allowed users can access
3. **Session Management** - Time-limited sessions
4. **CORS Protection** - Restricted origins
5. **Rate Limiting** - Prevents abuse

### Best Practices

1. **Use Strong API Keys**
   ```bash
   # Generate strong keys
   openssl rand -base64 32
   ```

2. **Limit User Access**
   ```bash
   ALLOWED_USERS=your-email@company.com,team-lead@company.com
   ```

3. **Set Short Session Timeouts**
   ```bash
   SESSION_TIMEOUT=3600  # 1 hour
   ```

4. **Restrict CORS Origins**
   ```bash
   CORS_ORIGINS=https://cursor.sh,https://cursor.ai
   ```

## 🚨 Troubleshooting

### Common Issues

1. **Authentication Failed**
   ```bash
   # Check API key
   curl -H "X-API-Key: your-api-key" https://your-app.railway.app/auth/status
   ```

2. **User Not Authorized**
   ```bash
   # Verify user is in ALLOWED_USERS
   railway variables get ALLOWED_USERS
   ```

3. **CORS Issues**
   ```bash
   # Check CORS settings
   railway variables get CORS_ORIGINS
   ```

4. **Connection Refused**
   ```bash
   # Verify Railway deployment
   curl https://your-app.railway.app/health
   ```

### Debug Mode

Enable debug logging in Railway:

```bash
railway variables set LOG_LEVEL="3"
railway variables set NODE_ENV="development"
```

## 📊 Monitoring

### Check Authentication Status

```bash
# Get auth stats
curl -H "X-API-Key: your-api-key" \
     https://your-app.railway.app/auth/status
```

### Monitor Usage

```bash
# Check server status
curl https://your-app.railway.app/status
```

### Railway Logs

```bash
# View real-time logs
railway logs --follow
```

## 🔄 Advanced Configuration

### Multiple Environments

Set up different environments:

```json
{
  "mcpServers": {
    "bio-analytics-dev": {
      "command": "npx",
      "args": ["@modelcontextprotocol/http-client"],
      "env": {
        "MCP_HTTP_URL": "https://dev-bio-analytics.railway.app/mcp",
        "MCP_API_KEY": "dev-api-key"
      }
    },
    "bio-analytics-prod": {
      "command": "npx",
      "args": ["@modelcontextprotocol/http-client"],
      "env": {
        "MCP_HTTP_URL": "https://bio-analytics.railway.app/mcp",
        "MCP_API_KEY": "prod-api-key"
      }
    }
  }
}
```

### Custom Headers

Add custom headers for tracking:

```json
{
  "mcpServers": {
    "bio-analytics-mcp": {
      "command": "npx",
      "args": ["@modelcontextprotocol/http-client"],
      "env": {
        "MCP_HTTP_URL": "https://your-app.railway.app/mcp",
        "MCP_API_KEY": "your-api-key",
        "MCP_USER_AGENT": "Cursor-IDE/1.0",
        "MCP_TRACKING_ID": "your-team-id"
      }
    }
  }
}
```

## 🎉 Success Checklist

- [ ] ✅ Railway deployment successful
- [ ] ✅ Environment variables configured
- [ ] ✅ API key generated and secure
- [ ] ✅ Authentication endpoints responding
- [ ] ✅ Cursor MCP configuration updated
- [ ] ✅ Cursor IDE restarted
- [ ] ✅ Bio Analytics MCP appears in Cursor
- [ ] ✅ Test query returns Bio DAO data
- [ ] ✅ All 20 analytics tools available

## 📞 Support

- **Authentication Issues**: Check Railway logs and environment variables
- **Cursor Integration**: Restart Cursor and verify MCP configuration
- **API Access**: Ensure API key is correct and user is authorized
- **Performance**: Monitor Railway metrics and adjust rate limits

---

**🔐 Secure Bio Analytics for Cursor** | **🧬 20 Analytics Tools** | **�� Railway Hosted** 