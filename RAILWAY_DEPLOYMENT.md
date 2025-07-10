# Railway Deployment Guide for Bio Analytics MCP

This guide walks you through deploying the Bio Analytics MCP server to Railway and exposing it for external access.

## 🚀 Quick Deploy

### Option 1: Deploy from GitHub (Recommended)
1. Fork/clone this repository to your GitHub account
2. Connect your GitHub account to Railway
3. Create a new Railway project from your repository
4. Configure environment variables (see below)
5. Deploy!

### Option 2: Deploy via Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Set environment variables
railway variables set MCP_HTTP_MODE=true
railway variables set NODE_ENV=production
# Add your other environment variables...

# Deploy
railway up
```

## 🔧 Environment Variables

Configure these environment variables in your Railway project:

### Required Variables
```env
NODE_ENV=production
MCP_HTTP_MODE=true
```

### Database Configuration
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Authentication (Optional but Recommended)
```env
MCP_API_KEY=your_secure_api_key
MCP_AUTH_ENABLED=true
AUTHORIZED_USERS=user1,user2,user3
```

### Social Media APIs (Optional)
```env
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
DISCORD_BOT_TOKEN=your_discord_bot_token
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

## 🌐 Accessing Your Deployed MCP Server

Once deployed, Railway will provide you with a URL like: `https://your-app-name.railway.app`

### Health Check
```
GET https://your-app-name.railway.app/health
```

### MCP Endpoint
```
POST https://your-app-name.railway.app/mcp
```

### Server Status
```
GET https://your-app-name.railway.app/status
```

## 🔌 Connecting Cursor to Your Railway-Deployed MCP

### Method 1: Direct HTTP Connection
Create or update your Cursor MCP configuration (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "bio-analytics-remote": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/http-client",
        "https://your-app-name.railway.app/mcp"
      ],
      "env": {
        "MCP_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## 📊 Monitoring Your Deployment

### Railway Dashboard
- Monitor logs, metrics, and deployments in your Railway dashboard
- Set up alerts for service health

### Health Endpoints
- `/health` - Simple health check
- `/status` - Detailed service status including database connectivity
- `/` - Service information and available endpoints

### Logs
View real-time logs in Railway dashboard or via CLI:
```bash
railway logs --follow
```

## 🔧 Troubleshooting

### Common Issues

1. **Server not starting**
   - Check environment variables are set correctly
   - Verify database connection strings
   - Check Railway logs for specific error messages

2. **MCP connection fails**
   - Verify the Railway URL is correct
   - Check API key authentication
   - Ensure firewall/network allows HTTPS connections

3. **Database connection issues**
   - Verify Supabase credentials
   - Check if Supabase project is active
   - Ensure proper network access from Railway

### Port Configuration
The server automatically uses Railway's `PORT` environment variable. No manual port configuration needed!

### SSL/HTTPS
Railway automatically provides SSL certificates. All connections are secure by default.

## 🔐 Security Best Practices

1. **Use strong API keys** - Generate cryptographically secure keys
2. **Limit authorized users** - Only add necessary users to `AUTHORIZED_USERS`
3. **Monitor access logs** - Check `/auth/status` endpoint regularly
4. **Rotate credentials** - Periodically update API keys and database credentials
5. **Use environment variables** - Never hardcode sensitive information

## 🚀 Scaling

Railway automatically scales your MCP server based on demand. For high-traffic scenarios:

1. **Database optimization** - Ensure proper indexing in Supabase
2. **Rate limiting** - Already configured in the server
3. **Caching** - Consider implementing Redis for frequently accessed data
4. **Load balancing** - Railway handles this automatically

---

**Ready to deploy?** Push your code to GitHub and connect to Railway for automatic deployments! 🚀 