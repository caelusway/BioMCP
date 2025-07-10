import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger.js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  oid: number;
  fields: any[];
}

export class DatabaseManager {
  private supabase: SupabaseClient | null = null;
  private logger: Logger;
  private supabaseConfig: SupabaseConfig;

  constructor() {
    this.logger = new Logger('DatabaseManager');
    this.supabaseConfig = this.loadSupabaseConfig();
  }

  private loadSupabaseConfig(): SupabaseConfig {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('Missing required Supabase environment variables: SUPABASE_URL and SUPABASE_ANON_KEY');
    }

    return {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY
    };
  }

  async connect(): Promise<void> {
    if (this.supabase) {
      this.logger.warn('Supabase client already exists');
      return;
    }

    const config = this.supabaseConfig;
    
    this.supabase = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // Test the connection with a simple health check
    try {
      // Use a simple query that doesn't depend on specific tables
      const { data, error } = await this.supabase.auth.getSession();
      if (error && error.message.includes('Invalid API key')) {
        this.logger.error('Invalid Supabase API key');
        throw new Error('Invalid Supabase API key');
      }
      this.logger.info('Supabase connection established successfully');
    } catch (error) {
      this.logger.error('Supabase connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.supabase = null;
    this.logger.info('Supabase connection closed');
  }

  async query<T extends Record<string, any> = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.supabase) {
      throw new Error('Supabase not connected');
    }

    try {
      const start = Date.now();
      
      // For Supabase, we need to use the PostgREST API
      // Parse the query to determine the table and build the appropriate Supabase query
      
      let result;
      if (text.toLowerCase().includes('select')) {
        // Extract table name from query
        const tableMatch = text.match(/from\s+(\w+)/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          
          // Handle common query patterns
          if (text.toLowerCase().includes('where') && text.toLowerCase().includes('ilike') && params) {
            // Handle ILIKE queries for DAO search
            const ilikeMatch = text.match(/(\w+)\s+ILIKE\s+\$(\d+)/i);
            if (ilikeMatch && params[parseInt(ilikeMatch[2]) - 1]) {
              const column = ilikeMatch[1];
              const value = params[parseInt(ilikeMatch[2]) - 1];
              const { data, error } = await this.supabase.from(tableName).select('*').ilike(column, value).limit(1);
              
              if (error) {
                throw error;
              }
              
              result = {
                rows: data || [],
                rowCount: data ? data.length : 0,
                command: 'SELECT',
                oid: 0,
                fields: []
              } as QueryResult<T>;
            } else {
              // Fallback to basic select
              const { data, error } = await this.supabase.from(tableName).select('*');
              
              if (error) {
                throw error;
              }
              
              result = {
                rows: data || [],
                rowCount: data ? data.length : 0,
                command: 'SELECT',
                oid: 0,
                fields: []
              } as QueryResult<T>;
            }
          } else if (text.toLowerCase().includes('limit') && params) {
            // Handle queries with LIMIT and OFFSET
            const limitMatch = text.match(/limit\s+\$(\d+)/i);
            const offsetMatch = text.match(/offset\s+\$(\d+)/i);
            
            let query = this.supabase.from(tableName).select('*');
            
            if (text.toLowerCase().includes('order by')) {
              const orderMatch = text.match(/order\s+by\s+(\w+)(?:\s+(asc|desc))?/i);
              if (orderMatch) {
                const column = orderMatch[1];
                const direction = orderMatch[2]?.toLowerCase() === 'desc' ? false : true;
                query = query.order(column, { ascending: direction });
              }
            }
            
            if (limitMatch && params[parseInt(limitMatch[1]) - 1]) {
              const limit = parseInt(params[parseInt(limitMatch[1]) - 1]);
              query = query.limit(limit);
            }
            
            if (offsetMatch && params[parseInt(offsetMatch[1]) - 1]) {
              const offset = parseInt(params[parseInt(offsetMatch[1]) - 1]);
              const limit = limitMatch ? parseInt(params[parseInt(limitMatch[1]) - 1]) : 50;
              query = query.range(offset, offset + limit - 1);
            }
            
            const { data, error } = await query;
            
            if (error) {
              throw error;
            }
            
            result = {
              rows: data || [],
              rowCount: data ? data.length : 0,
              command: 'SELECT',
              oid: 0,
              fields: []
            } as QueryResult<T>;
          } else {
            // Basic SELECT query
            const { data, error } = await this.supabase.from(tableName).select('*');
            
            if (error) {
              throw error;
            }
            
            result = {
              rows: data || [],
              rowCount: data ? data.length : 0,
              command: 'SELECT',
              oid: 0,
              fields: []
            } as QueryResult<T>;
          }
        } else {
          // Fallback: try to use a custom function if available
          const { data, error } = await this.supabase.rpc('execute_custom_query', {
            query: text,
            parameters: params || []
          });
          
          if (error) {
            throw new Error(`Custom query failed: ${error.message}`);
          }
          
          result = {
            rows: data || [],
            rowCount: data ? data.length : 0,
            command: 'SELECT',
            oid: 0,
            fields: []
          } as QueryResult<T>;
        }
      } else {
        throw new Error('Only SELECT queries are supported with Supabase');
      }

      const duration = Date.now() - start;
      this.logger.debug(`Supabase query executed in ${duration}ms: ${text.substring(0, 100)}...`);
      
      return result;
    } catch (error) {
      this.logger.error(`Supabase query failed: ${text}`, error);
      throw error;
    }
  }

  async getClient(): Promise<SupabaseClient> {
    if (!this.supabase) {
      throw new Error('Supabase not connected');
    }
    return this.supabase;
  }

  async transaction<T>(callback: (client: SupabaseClient) => Promise<T>): Promise<T> {
    // Supabase handles transactions automatically for individual operations
    // For multiple operations, we can use the callback directly
    const client = await this.getClient();
    return await callback(client);
  }

  // Helper method to get DAO table name from DAO name
  getDaoTableName(daoName: string, tableType: 'tweets' | 'discord' | 'telegram'): string {
    // Clean the DAO name to match the actual table naming convention
    const cleanName = daoName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Based on your schema, the naming convention is dao_<cleanname>_tweets
    if (tableType === 'tweets') {
      return `dao_${cleanName}_tweets`;
    } else if (tableType === 'discord') {
      return `discord_messages`; // Discord messages are in a centralized table
    } else if (tableType === 'telegram') {
      return `telegram_messages`; // Telegram messages are in a centralized table
    }
    
    return `dao_${cleanName}_${tableType}`;
  }

  // Helper method to check if a table exists
  async tableExists(tableName: string): Promise<boolean> {
    try {
      this.logger.info(`Checking if table '${tableName}' exists...`);
      
      // Try to query the table with a limit of 0 to avoid returning data
      const { data, error } = await this.supabase!.from(tableName).select('*').limit(0);
      
      if (error) {
        this.logger.info(`Table '${tableName}' check failed: ${error.message}`);
        
        // Check if it's a permission/access error vs table doesn't exist
        if (error.message.includes('permission denied') || 
            error.message.includes('relation') || 
            error.message.includes('does not exist')) {
          return false;
        }
        
        // For other errors, assume table doesn't exist
        return false;
      }
      
      this.logger.info(`Table '${tableName}' exists and is accessible`);
      return true;
    } catch (error) {
      this.logger.warn(`Exception checking table '${tableName}':`, error);
      return false;
    }
  }

  // Helper method to get all DAO names from existing tables
  async getDAONames(): Promise<string[]> {
    try {
      let daoNames: string[] = [];
      
      this.logger.info('Starting to get DAO names...');
      
      // First, get DAO names from the daos table if it exists
      const daosTableExists = await this.tableExists('daos');
      this.logger.info(`daos table exists: ${daosTableExists}`);
      
      if (daosTableExists) {
        try {
          const { data, error } = await this.supabase!.from('daos').select('name');
          
          if (error) {
            this.logger.warn('Could not fetch DAO names from daos table:', error);
          } else {
            this.logger.info(`Found ${data.length} DAOs in daos table`);
            daoNames = [...daoNames, ...data.map(row => row.name)];
          }
        } catch (err) {
          this.logger.error('Error querying daos table:', err);
        }
      }
      
      // Also, extract DAO names from individual tweet tables
      // Get all table names that match the pattern 'dao_*_tweets'
      this.logger.info('Checking for individual DAO tweet tables...');
      
      // Since RPC might not work, let's directly check our known tables
      const knownDAOTables = [
        'dao_athenadao_tweets',
        'dao_beeardai_tweets', 
        'dao_bioprotocol_tweets',
        'dao_cerebrumdao_tweets',
        'dao_cryodao_tweets',
        'dao_curetopiadao_tweets',
        'dao_d1ckdao_tweets',
        'dao_dalyadao_tweets',
        'dao_dogyearsdao_tweets',
        'dao_fatdao_tweets',
        'dao_gingersciencedao_tweets',
        'dao_gliodao_tweets',
        'dao_hairdao_tweets',
        'dao_hempydotscience_tweets',
        'dao_kidneydao_tweets',
        'dao_longcovidlabsdao_tweets',
        'dao_mesoreefdao_tweets',
        'dao_microbiomedao_tweets',
        'dao_microdao_tweets',
        'dao_moleculedao_tweets',
        'dao_mycodao_tweets',
        'dao_nootropicsdao_tweets',
        'dao_psydao_tweets',
        'dao_quantumbiodao_tweets',
        'dao_reflexdao_tweets',
        'dao_sleepdao_tweets',
        'dao_spectruthaidao_tweets',
        'dao_spinedao_tweets',
        'dao_stemdao_tweets',
        'dao_valleydao_tweets',
        'dao_vitadao_tweets',
        'dao_vitafastbio_tweets',
        'dao_vitarnabio_tweets'
      ];
      
      this.logger.info(`Checking ${knownDAOTables.length} known DAO tables...`);
      
      for (const tableName of knownDAOTables) {
        const exists = await this.tableExists(tableName);
        if (exists) {
          // Extract DAO name from table name
          const daoName = tableName.replace('dao_', '').replace('_tweets', '');
          daoNames.push(daoName);
          this.logger.info(`Found DAO: ${daoName} (table: ${tableName})`);
        }
      }
      
      this.logger.info(`Total DAOs found: ${daoNames.length}`);
      
      // Remove duplicates and return
      const uniqueDAOs = [...new Set(daoNames)];
      this.logger.info(`Unique DAOs: ${uniqueDAOs.length}`);
      return uniqueDAOs;
    } catch (error) {
      this.logger.error('Error getting DAO names:', error);
      return [];
    }
  }

  // Helper method to format DAO names for display
  formatDAOName(daoName: string): string {
    // Convert from table name format to display format
    return daoName
      .split(/(?=[A-Z])/) // Split on capital letters
      .join(' ')
      .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
      .replace(/dao/gi, 'DAO') // Make DAO uppercase
      .replace(/ai/gi, 'AI') // Make AI uppercase
      .replace(/bio/gi, 'Bio') // Capitalize Bio
      .trim();
  }

  // Helper method to get DAO display name from table name or slug
  getDAODisplayName(daoNameOrSlug: string): string {
    // If it's a table name, extract the DAO name
    if (daoNameOrSlug.startsWith('dao_') && daoNameOrSlug.endsWith('_tweets')) {
      const extractedName = daoNameOrSlug.replace('dao_', '').replace('_tweets', '');
      return this.formatDAOName(extractedName);
    }
    
    // If it's already a clean name, just format it
    return this.formatDAOName(daoNameOrSlug);
  }

  // Execute custom queries with safety checks
  async executeCustomQuery(query: string, limit: number = 100): Promise<any> {
    // Basic safety checks
    const lowerQuery = query.toLowerCase().trim();
    
    // Block dangerous operations
    const dangerousKeywords = ['drop', 'delete', 'update', 'insert', 'alter', 'create', 'truncate'];
    for (const keyword of dangerousKeywords) {
      if (lowerQuery.includes(keyword)) {
        throw new Error(`Dangerous operation detected: ${keyword}. Only SELECT queries are allowed.`);
      }
    }

    // Ensure it's a SELECT query
    if (!lowerQuery.startsWith('select')) {
      throw new Error('Only SELECT queries are allowed');
    }

    // Add limit if not present
    if (!lowerQuery.includes('limit')) {
      query += ` LIMIT ${limit}`;
    }

    const result = await this.query(query);
    
    return {
      content: [
        {
          type: 'text',
          text: `Custom Query Results:\n\n${JSON.stringify(result.rows, null, 2)}`
        }
      ]
    };
  }

  async getDatabaseStats(): Promise<any> {
    try {
      // Check table existence
      const daosTableExists = await this.tableExists('daos');
      const discordTableExists = await this.tableExists('discord_messages');
      const telegramTableExists = await this.tableExists('telegram_messages');
      const governanceTableExists = await this.tableExists('governance_snapshot_spaces');
      
      let dao_count = 0;
      let registeredDAOs = 0;
      let tweetTables = 0;
      
      // Count registered DAOs
      if (daosTableExists) {
        const { data: daoData, error: daoError } = await this.supabase!.from('daos').select('*');
        if (!daoError && daoData) {
          registeredDAOs = daoData.length;
        }
      }
      
      // Count DAO tweet tables and get total DAOs
      const allDAONames = await this.getDAONames();
      dao_count = allDAONames.length;
      
      // Count how many have tweet tables
      for (const daoName of allDAONames) {
        const tweetTableName = this.getDaoTableName(daoName, 'tweets');
        const exists = await this.tableExists(tweetTableName);
        if (exists) {
          tweetTables++;
        }
      }
      
      // Get additional stats
      let totalTweets = 0;
      let totalDiscordMessages = 0;
      let totalTelegramMessages = 0;
      let totalGovernanceSpaces = 0;
      
      // Count tweets across all DAO tables
      for (const daoName of allDAONames) {
        const tweetTableName = this.getDaoTableName(daoName, 'tweets');
        const exists = await this.tableExists(tweetTableName);
        if (exists) {
          try {
            const { data, error } = await this.supabase!.from(tweetTableName).select('*', { count: 'exact' });
            if (!error && data) {
              totalTweets += data.length;
            }
          } catch (err) {
            // Skip if table access fails
          }
        }
      }
      
      // Count Discord messages
      if (discordTableExists) {
        try {
          const { data, error } = await this.supabase!.from('discord_messages').select('*', { count: 'exact' });
          if (!error && data) {
            totalDiscordMessages = data.length;
          }
        } catch (err) {
          // Skip if table access fails
        }
      }
      
      // Count Telegram messages
      if (telegramTableExists) {
        try {
          const { data, error } = await this.supabase!.from('telegram_messages').select('*', { count: 'exact' });
          if (!error && data) {
            totalTelegramMessages = data.length;
          }
        } catch (err) {
          // Skip if table access fails
        }
      }
      
      // Count governance spaces
      if (governanceTableExists) {
        try {
          const { data, error } = await this.supabase!.from('governance_snapshot_spaces').select('*', { count: 'exact' });
          if (!error && data) {
            totalGovernanceSpaces = data.length;
          }
        } catch (err) {
          // Skip if table access fails
        }
      }
      
      const stats = {
        timestamp: new Date().toISOString(),
        connection_status: 'connected',
        dao_count: dao_count,
        registered_daos: registeredDAOs,
        daos_with_tweet_data: tweetTables,
        database_type: 'supabase',
        tables: {
          daos_exists: daosTableExists,
          discord_messages_exists: discordTableExists,
          telegram_messages_exists: telegramTableExists,
          governance_spaces_exists: governanceTableExists
        },
        data_summary: {
          total_tweets: totalTweets,
          total_discord_messages: totalDiscordMessages,
          total_telegram_messages: totalTelegramMessages,
          total_governance_spaces: totalGovernanceSpaces
        },
        available_daos: allDAONames
      };

      return {
        content: [
          {
            type: 'text',
            text: `Database Statistics:\n\n${JSON.stringify(stats, null, 2)}`
          }
        ]
      };
    } catch (error) {
      this.logger.error('Error getting database stats:', error);
      throw error;
    }
  }
} 