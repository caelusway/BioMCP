# Bio Analytics MCP

> **Model Context Protocol server for Bio/Science DAO analytics**

Comprehensive analytics platform for Bio/Science DAOs providing Twitter, Discord, Telegram, Governance, and Liquidity metrics through a unified MCP interface.

## 🧬 Featured DAOs (33 Bio/Science DAOs)

- **VitaDAO** - Longevity research funding
- **MoleculeDAO** - Drug discovery platform  
- **PsyDAO** - Psychedelic research
- **CerebrumDAO** - Brain health research
- **KidneyDAO** - Kidney disease research
- **And 28 more Bio/Science DAOs** - See full list with `list_daos` tool

## 🚀 Quick Start

### Installation

```bash
git clone <repository-url>
cd BioMCP
npm install
npm run build
```

### Environment Setup

Create a `.env` file:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
MCP_HTTP_MODE=false
MCP_HTTP_PORT=3000
```

### Usage

#### 1. As MCP Server (Recommended)
```bash
npm start
```

#### 2. As HTTP Server (for MCP Inspector)
```bash
MCP_HTTP_MODE=true npm start
```

## 📊 Available Analytics

### Core Tools (4)
- `list_daos` - List all available Bio/Science DAOs
- `get_dao_overview` - Comprehensive DAO overview
- `get_twitter_metrics` - Twitter engagement analytics
- `get_comprehensive_analysis` - Cross-platform analysis

### Discord Analytics (4)
- `get_discord_activity` - Activity metrics
- `get_discord_top_users` - Most active users
- `get_discord_channel_stats` - Channel statistics  
- `get_discord_community_growth` - Growth metrics

### Telegram Analytics (3)
- `get_telegram_metrics` - Engagement metrics
- `get_telegram_chat_growth` - Growth patterns
- `get_telegram_hourly_activity` - Activity patterns

### Governance Analytics (2)
- `get_governance_proposals` - Proposal data
- `get_governance_participation` - Participation analysis

### Liquidity Analytics (4)
- `get_liquidity_metrics` - Pool metrics
- `get_liquidity_tvl_history` - TVL history
- `get_liquidity_alerts` - Liquidity alerts
- `get_pool_volumes` - Trading volumes

### Database Tools (2)
- `get_database_stats` - Database statistics
- `execute_custom_query` - Custom SQL queries

## 🌐 Railway Deployment

### Automatic Deployment

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

### Manual Deployment

1. **Connect to Railway:**
```bash
npm install -g @railway/cli
railway login
```

2. **Initialize Project:**
```bash
railway init
railway link
```

3. **Set Environment Variables:**
```bash
railway variables set SUPABASE_URL=your_supabase_url
railway variables set SUPABASE_ANON_KEY=your_supabase_key
railway variables set MCP_HTTP_MODE=true
railway variables set MCP_HTTP_PORT=3000
```

4. **Deploy:**
```bash
railway up
```

## 📖 API Examples

### List All DAOs
```javascript
const daos = await mcpClient.call('list_daos', { limit: 10 });
console.log(daos); // Returns 33 Bio/Science DAOs
```

### Get DAO Analytics
```javascript
const vitaAnalytics = await mcpClient.call('get_comprehensive_analysis', {
  dao_name: 'VitaDAO',
  days: 30
});
```

### Twitter Metrics
```javascript
const twitterMetrics = await mcpClient.call('get_twitter_metrics', {
  dao_name: 'MoleculeDAO',
  days: 7,
  metrics: ['engagement', 'reach', 'sentiment']
});
```

## 🔧 Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run dev:watch
```

### Testing with MCP Inspector
```bash
MCP_HTTP_MODE=true npm start
# Visit http://localhost:3000/mcp
```

## 📁 Project Structure

```
src/
├── index.ts              # MCP server entry point
├── database/
│   └── manager.ts         # Supabase connection & queries
├── analytics/
│   ├── twitter.ts         # Twitter analytics
│   ├── discord.ts         # Discord analytics
│   ├── telegram.ts        # Telegram analytics
│   ├── governance.ts      # Governance analytics
│   └── liquidity.ts       # Liquidity analytics
├── dao/
│   └── manager.ts         # DAO management
└── utils/
    └── logger.ts          # Logging utilities
```

## 🏥 Bio/Science Focus

This MCP is specifically designed for **Biotechnology and Science** organizations:

- **Longevity Research** (VitaDAO, CryoDAO)
- **Drug Discovery** (MoleculeDAO, CuretopiaDAO)  
- **Mental Health** (PsyDAO, CerebrumDAO)
- **Specialized Research** (KidneyDAO, SpineDAO, SleepDAO)
- **AI/Tech for Science** (BeeardAI, SpectruthAI)
- **And many more Bio/Science DAOs**

## 📊 Data Sources

- **Twitter/X** - Social media analytics
- **Discord** - Community engagement
- **Telegram** - Chat metrics  
- **Snapshot** - Governance data
- **DeFi Protocols** - Liquidity metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built for the Bio/Science community** 🧬 **Powered by Model Context Protocol** 🤖 