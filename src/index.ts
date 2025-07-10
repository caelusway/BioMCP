#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { DatabaseManager } from './database/manager.js';
import { TwitterAnalytics } from './analytics/twitter.js';
import { DiscordAnalytics } from './analytics/discord.js';
import { TelegramAnalytics } from './analytics/telegram.js';
import { GovernanceAnalytics } from './analytics/governance.js';
import { LiquidityPoolAnalytics } from './analytics/liquidity.js';
import { DaoManager } from './dao/manager.js';
import { Logger } from './utils/logger.js';
import { AuthManager } from './middleware/auth.js';
import express from 'express';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Initialize analytics modules
const logger = new Logger('BioAnalyticsMCP');
const authManager = new AuthManager();
const dbManager = new DatabaseManager();
const twitterAnalytics = new TwitterAnalytics(dbManager);
const discordAnalytics = new DiscordAnalytics(dbManager);
const telegramAnalytics = new TelegramAnalytics(dbManager);
const governanceAnalytics = new GovernanceAnalytics(dbManager);
const liquidityAnalytics = new LiquidityPoolAnalytics(dbManager);
const daoManager = new DaoManager(dbManager);

// Function to create and configure a server instance
function createServer(): McpServer {
  const server = new McpServer({
    name: 'bio-analytics-mcp',
    version: '1.0.0'
  });

  // Register tools using the modern API
  server.registerTool(
    'list_daos',
    {
      title: 'List DAOs',
      description: 'List all DAOs in the system with pagination support',
      inputSchema: {
        limit: z.number().min(1).max(100).default(50).describe('Maximum number of DAOs to return'),
        offset: z.number().min(0).default(0).describe('Number of DAOs to skip')
      }
    },
    async ({ limit, offset }) => {
      const result = await daoManager.listDAOs(limit, offset);
      return result;
    }
  );

  server.registerTool(
    'get_dao_overview',
    {
      title: 'Get DAO Overview',
      description: 'Get comprehensive overview of a specific DAO including all metrics',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze')
      }
    },
    async ({ dao_name }) => {
      const result = await daoManager.getDaoOverview(dao_name);
      return result;
    }
  );

  server.registerTool(
    'get_twitter_metrics',
    {
      title: 'Get Twitter Metrics',
      description: 'Get Twitter engagement metrics for a specific DAO',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze'),
        days: z.number().min(1).max(365).default(30).describe('Number of days to analyze (1-365)'),
        metrics: z.array(z.enum(['engagement', 'reach', 'sentiment', 'mentions', 'hashtags']))
          .default(['engagement', 'reach', 'sentiment'])
          .describe('Specific metrics to calculate')
      }
    },
    async ({ dao_name, days, metrics }) => {
      const result = await twitterAnalytics.getMetrics(dao_name, days, metrics);
      return result;
    }
  );

  server.registerTool(
    'get_comprehensive_analysis',
    {
      title: 'Get Comprehensive Analysis',
      description: 'Get comprehensive analysis across all platforms and metrics for a DAO',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze'),
        days: z.number().min(1).max(365).default(30).describe('Number of days to analyze')
      }
    },
    async ({ dao_name, days }) => {
      const result = await daoManager.getComprehensiveAnalysis(dao_name, days);
      return result;
    }
  );

  // Discord Analytics Tools
  server.registerTool(
    'get_discord_activity',
    {
      title: 'Get Discord Activity',
      description: 'Get Discord activity metrics for a specific DAO',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze'),
        days: z.number().min(1).max(365).default(30).describe('Number of days to analyze (1-365)')
      }
    },
    async ({ dao_name, days }) => {
      const result = await discordAnalytics.getActivity(dao_name, days);
      return result;
    }
  );

  server.registerTool(
    'get_discord_top_users',
    {
      title: 'Get Discord Top Users',
      description: 'Get top Discord users by activity for a specific DAO',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze'),
        limit: z.number().min(1).max(50).default(10).describe('Number of top users to return'),
        days: z.number().min(1).max(365).default(30).describe('Number of days to analyze')
      }
    },
    async ({ dao_name, limit, days }) => {
      const result = await discordAnalytics.getTopUsers(dao_name, limit, days);
      return result;
    }
  );

  server.registerTool(
    'get_discord_channel_stats',
    {
      title: 'Get Discord Channel Statistics',
      description: 'Get Discord channel statistics for a specific DAO',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze'),
        days: z.number().min(1).max(365).default(30).describe('Number of days to analyze')
      }
    },
    async ({ dao_name, days }) => {
      const result = await discordAnalytics.getChannelStats(dao_name, days);
      return result;
    }
  );

  server.registerTool(
    'get_discord_community_growth',
    {
      title: 'Get Discord Community Growth',
      description: 'Get Discord community growth metrics for a specific DAO',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze'),
        days: z.number().min(1).max(365).default(30).describe('Number of days to analyze')
      }
    },
    async ({ dao_name, days }) => {
      const result = await discordAnalytics.getCommunityGrowth(dao_name, days);
      return result;
    }
  );

  // Telegram Analytics Tools
  server.registerTool(
    'get_telegram_metrics',
    {
      title: 'Get Telegram Metrics',
      description: 'Get Telegram engagement metrics for a specific DAO',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze'),
        days: z.number().min(1).max(365).default(30).describe('Number of days to analyze')
      }
    },
    async ({ dao_name, days }) => {
      const result = await telegramAnalytics.getMetrics(dao_name, days);
      return result;
    }
  );

  server.registerTool(
    'get_telegram_chat_growth',
    {
      title: 'Get Telegram Chat Growth',
      description: 'Get Telegram chat growth metrics for a specific DAO',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze'),
        days: z.number().min(1).max(365).default(30).describe('Number of days to analyze')
      }
    },
    async ({ dao_name, days }) => {
      const result = await telegramAnalytics.getChatGrowth(dao_name, days);
      return result;
    }
  );

  server.registerTool(
    'get_telegram_hourly_activity',
    {
      title: 'Get Telegram Hourly Activity',
      description: 'Get Telegram hourly activity patterns for a specific DAO',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze'),
        days: z.number().min(1).max(365).default(30).describe('Number of days to analyze')
      }
    },
    async ({ dao_name, days }) => {
      const result = await telegramAnalytics.getHourlyActivity(dao_name, days);
      return result;
    }
  );

  // Governance Analytics Tools
  server.registerTool(
    'get_governance_proposals',
    {
      title: 'Get Governance Proposals',
      description: 'Get governance proposals for a specific DAO',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze'),
        status: z.string().optional().describe('Filter by proposal status (active, closed, etc.)'),
        limit: z.number().min(1).max(50).default(10).describe('Number of proposals to return')
      }
    },
    async ({ dao_name, status, limit }) => {
      const result = await governanceAnalytics.getProposals(dao_name, status, limit);
      return result;
    }
  );

  server.registerTool(
    'get_governance_participation',
    {
      title: 'Get Governance Participation',
      description: 'Analyze governance participation patterns for a specific DAO',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze'),
        days: z.number().min(1).max(365).default(90).describe('Number of days to analyze')
      }
    },
    async ({ dao_name, days }) => {
      const result = await governanceAnalytics.analyzeParticipation(dao_name, days);
      return result;
    }
  );

  // Liquidity Analytics Tools
  server.registerTool(
    'get_liquidity_metrics',
    {
      title: 'Get Liquidity Metrics',
      description: 'Get liquidity pool metrics for a specific DAO',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze'),
        pool_name: z.string().optional().describe('Optional specific pool name to filter'),
        days: z.number().min(1).max(365).default(30).describe('Number of days to analyze')
      }
    },
    async ({ dao_name, pool_name, days }) => {
      const result = await liquidityAnalytics.getMetrics(dao_name, pool_name, days);
      return result;
    }
  );

  server.registerTool(
    'get_liquidity_tvl_history',
    {
      title: 'Get Liquidity TVL History',
      description: 'Get historical TVL (Total Value Locked) data for a specific DAO',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze'),
        pool_name: z.string().optional().describe('Optional specific pool name to filter'),
        days: z.number().min(1).max(365).default(30).describe('Number of days to analyze')
      }
    },
    async ({ dao_name, pool_name, days }) => {
      const result = await liquidityAnalytics.getHistoricalTVL(dao_name, pool_name, days);
      return result;
    }
  );

  server.registerTool(
    'get_liquidity_alerts',
    {
      title: 'Get Liquidity Alerts',
      description: 'Get liquidity-related alerts and notifications for a specific DAO',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze'),
        days: z.number().min(1).max(30).default(7).describe('Number of days to analyze')
      }
    },
    async ({ dao_name, days }) => {
      const result = await liquidityAnalytics.getAlerts(dao_name, days);
      return result;
    }
  );

  server.registerTool(
    'get_pool_volumes',
    {
      title: 'Get Pool Volumes',
      description: 'Get trading volume data for liquidity pools',
      inputSchema: {
        dao_name: z.string().min(1).max(100).describe('Name of the DAO to analyze'),
        pool_name: z.string().optional().describe('Optional specific pool name to filter'),
        days: z.number().min(1).max(365).default(30).describe('Number of days to analyze')
      }
    },
    async ({ dao_name, pool_name, days }) => {
      const result = await liquidityAnalytics.getPoolVolumes(dao_name, pool_name, days);
      return result;
    }
  );

  // Database Tools
  server.registerTool(
    'get_database_stats',
    {
      title: 'Get Database Statistics',
      description: 'Get database connection and statistics information',
      inputSchema: {}
    },
    async () => {
      const result = await dbManager.getDatabaseStats();
      return result;
    }
  );

  server.registerTool(
    'execute_custom_query',
    {
      title: 'Execute Custom Query',
      description: 'Execute a custom SELECT query on the database (read-only)',
      inputSchema: {
        query: z.string().min(1).max(1000).describe('SQL SELECT query to execute'),
        limit: z.number().min(1).max(100).default(50).describe('Maximum number of results to return')
      }
    },
    async ({ query, limit }) => {
      const result = await dbManager.executeCustomQuery(query, limit);
      return result;
    }
  );

  return server;
}

// Main function to start the server
async function main() {
  try {
    // Initialize database connection
    await dbManager.connect();
    logger.info('Database connection established');

    // Check if running in HTTP mode
    // Default to HTTP mode for Railway/production deployments
    const isRailway = process.env.MCP_HTTP_MODE;
    const isHttpMode = process.env.MCP_HTTP_MODE === 'true' || 
                       process.argv.includes('--http') || 
                       isRailway || 
                       process.env.NODE_ENV === 'production' ||
                       !!process.env.PORT; // Force HTTP mode if PORT is set
    
    // Use Railway's PORT environment variable if available
    const httpPort = parseInt(process.env.PORT || process.env.MCP_HTTP_PORT || '3000');
    const httpHost = '0.0.0.0'; // Always bind to all interfaces for Railway
    
    // Enhanced logging for Railway debugging
    logger.info(`🔍 Deployment Detection:`);
    logger.info(`   - Railway Environment: ${isRailway}`);
    logger.info(`   - HTTP Mode: ${isHttpMode}`);
    logger.info(`   - PORT from env: ${process.env.PORT || 'not set'}`);
    logger.info(`   - Using port: ${httpPort}`);
    logger.info(`   - Using host: ${httpHost}`);
    logger.info(`   - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

    if (isHttpMode) {
      // Start HTTP server for MCP Inspector using StreamableHTTPServerTransport
      const app = express();
      
      // Apply middleware
      app.use(authManager.corsMiddleware);
      app.use(express.json());
      app.use(authManager.rateLimitMiddleware);

      // Map to store transports by session ID
      const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

      // Handle POST requests for client-to-server communication
      // Make MCP endpoint publicly accessible for Railway deployment
      app.post('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          // Reuse existing transport
          transport = transports[sessionId];
        } else {
          // Create new transport
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId) => {
              transports[sessionId] = transport;
            }
          });

          // Clean up transport when closed
          transport.onclose = () => {
            if (transport.sessionId) {
              delete transports[transport.sessionId];
            }
          };

          const server = createServer();
          await server.connect(transport);
        }

        // Handle the request
        await transport.handleRequest(req, res, req.body);
      });

      // Handle GET requests for server-to-client notifications via SSE
      app.get('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
          res.status(400).send('Invalid or missing session ID');
          return;
        }
        
        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
      });

      // Handle DELETE requests for session termination
      app.delete('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
          res.status(400).send('Invalid or missing session ID');
          return;
        }
        
        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
      });

      // Health check endpoint for Railway
      app.get('/health', (req, res) => {
        res.status(200).json({ 
          status: 'healthy', 
          service: 'Bio Analytics MCP',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });
      });

      // Status endpoint with database connectivity check
      app.get('/status', async (req, res) => {
        try {
          const dbStats = await dbManager.getDatabaseStats();
          res.status(200).json({
            status: 'operational',
            service: 'Bio Analytics MCP',
            database: 'connected',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            analytics: {
              tools_available: 20,
              daos_tracked: dbStats.daos_count || 0
            }
          });
        } catch (error) {
          res.status(503).json({
            status: 'degraded',
            service: 'Bio Analytics MCP',
            database: 'disconnected',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          });
        }
      });

      // Authentication endpoint
      app.post('/auth/login', express.json(), (req, res) => {
        try {
          const { userId, permissions } = req.body;
          
          if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
          }

          if (!authManager.validateUser(userId)) {
            return res.status(403).json({ error: 'User not authorized' });
          }

          const sessionId = authManager.createSession(userId, permissions);
          res.json({ 
            sessionId, 
            expiresIn: 3600,
            message: 'Authentication successful' 
          });
        } catch (error) {
          res.status(400).json({ 
            error: error instanceof Error ? error.message : 'Authentication failed' 
          });
        }
      });

      // Authentication status endpoint
      app.get('/auth/status', authManager.validateApiKey, (req, res) => {
        const stats = authManager.getStats();
        res.json({
          ...stats,
          timestamp: new Date().toISOString()
        });
      });

      // Basic info endpoint
      app.get('/', (req, res) => {
        res.json({
          service: 'Bio Analytics MCP',
          description: 'Analytics platform for Biotechnology and Science DAOs',
          version: '1.0.0',
          port: httpPort,
          host: httpHost,
          isRailway: isRailway,
          endpoints: {
            health: '/health',
            status: '/status',
            mcp: '/mcp',
            auth: '/auth/login',
            'auth-status': '/auth/status'
          },
          documentation: 'https://github.com/your-repo/BioMCP',
          authentication: {
            enabled: authManager.getStats().authEnabled,
            type: 'API Key + Session'
          }
        });
      });

      // Simple test endpoint for Railway connectivity
      app.get('/ping', (req, res) => {
        res.json({
          message: 'pong',
          timestamp: new Date().toISOString(),
          railway: isRailway,
          port: httpPort
        });
      });

      const server = app.listen(httpPort, httpHost, () => {
        logger.info(`✅ Bio Analytics MCP HTTP Server listening on ${httpHost}:${httpPort}`);
        logger.info(`🔗 Health check: http://${httpHost}:${httpPort}/health`);
        logger.info(`🔗 MCP Inspector: http://${httpHost}:${httpPort}/mcp`);
        logger.info(`🔗 Service info: http://${httpHost}:${httpPort}/`);
        
        if (isRailway) {
          logger.info('🚀 Railway deployment detected - Server ready for external connections');
          logger.info(`🌐 Railway should expose this service on HTTPS automatically`);
        }
      });

      // Enhanced error handling for Railway
      server.on('error', (error: any) => {
        logger.error('❌ Server error:', error);
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${httpPort} is already in use`);
        } else if (error.code === 'EACCES') {
          logger.error(`Permission denied to bind to port ${httpPort}`);
        }
        process.exit(1);
      });

      // Handle server startup timeout
      const startupTimeout = setTimeout(() => {
        logger.error('⏰ Server startup timeout - Railway might have issues');
        process.exit(1);
      }, 30000);

      server.on('listening', () => {
        clearTimeout(startupTimeout);
        logger.info('🎯 Server is now accepting connections');
      });

    } else {
      // Start STDIO server for command-line usage
      const server = createServer();
      const transport = new StdioServerTransport();
      await server.connect(transport);
      
      logger.info('Bio Analytics MCP Server started successfully (STDIO mode)');
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  process.stderr.write('\nReceived SIGINT, shutting down gracefully...\n');
  try {
    await dbManager.disconnect();
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  process.stderr.write('\nReceived SIGTERM, shutting down gracefully...\n');
  try {
    await dbManager.disconnect();
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  process.exit(0);
});

// Start the server
main().catch((error) => {
  process.stderr.write(`Failed to start server: ${error}\n`);
  process.exit(1);
}); 