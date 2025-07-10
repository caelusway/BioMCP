import { Logger } from '../utils/logger.js';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  environment: string;
  logLevel: string;
}

export interface MCPConfig {
  name: string;
  version: string;
  description: string;
  capabilities: {
    tools: boolean;
    resources: boolean;
  };
}

export class ConfigManager {
  private logger: Logger;
  private config: any;

  constructor() {
    this.logger = new Logger('ConfigManager');
    this.config = this.loadConfig();
  }

  private loadConfig(): any {
    const config = {
      database: this.loadDatabaseConfig(),
      server: this.loadServerConfig(),
      mcp: this.loadMCPConfig()
    };

    this.logger.info('Configuration loaded successfully');
    return config;
  }

  private loadDatabaseConfig(): DatabaseConfig {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'dao_analytics',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000')
    };
  }

  private loadServerConfig(): ServerConfig {
    return {
      port: parseInt(process.env.SERVER_PORT || '3000'),
      host: process.env.SERVER_HOST || 'localhost',
      environment: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info'
    };
  }

  private loadMCPConfig(): MCPConfig {
    return {
      name: process.env.MCP_NAME || 'dao-analytics-mcp',
      version: process.env.MCP_VERSION || '1.0.0',
      description: process.env.MCP_DESCRIPTION || 'MCP server for DAO analytics and social media monitoring',
      capabilities: {
        tools: true,
        resources: true
      }
    };
  }

  getDatabaseConfig(): DatabaseConfig {
    return this.config.database;
  }

  getServerConfig(): ServerConfig {
    return this.config.server;
  }

  getMCPConfig(): MCPConfig {
    return this.config.mcp;
  }

  get(key: string): any {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      value = value[k];
      if (value === undefined) {
        return undefined;
      }
    }
    
    return value;
  }

  isDevelopment(): boolean {
    return this.config.server.environment === 'development';
  }

  isProduction(): boolean {
    return this.config.server.environment === 'production';
  }

  validateConfig(): boolean {
    const required = [
      'database.host',
      'database.port',
      'database.database',
      'database.user',
      'database.password'
    ];

    for (const key of required) {
      const value = this.get(key);
      if (value === undefined || value === '') {
        this.logger.error(`Missing required configuration: ${key}`);
        return false;
      }
    }

    return true;
  }
} 