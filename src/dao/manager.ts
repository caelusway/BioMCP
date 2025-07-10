import { DatabaseManager } from '../database/manager.js';
import { TwitterAnalytics } from '../analytics/twitter.js';
import { DiscordAnalytics } from '../analytics/discord.js';
import { TelegramAnalytics } from '../analytics/telegram.js';
import { GovernanceAnalytics } from '../analytics/governance.js';
import { LiquidityPoolAnalytics } from '../analytics/liquidity.js';
import { Logger } from '../utils/logger.js';

export interface DAOOverview {
  name: string;
  slug: string;
  description?: string;
  website_url?: string;
  twitter_handle?: string;
  data_availability: {
    twitter: boolean;
    discord: boolean;
    telegram: boolean;
    governance: boolean;
    liquidity: boolean;
  };
  last_updated: string;
}

export class DaoManager {
  private db: DatabaseManager;
  private twitterAnalytics: TwitterAnalytics;
  private discordAnalytics: DiscordAnalytics;
  private telegramAnalytics: TelegramAnalytics;
  private governanceAnalytics: GovernanceAnalytics;
  private liquidityAnalytics: LiquidityPoolAnalytics;
  private logger: Logger;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.twitterAnalytics = new TwitterAnalytics(db);
    this.discordAnalytics = new DiscordAnalytics(db);
    this.telegramAnalytics = new TelegramAnalytics(db);
    this.governanceAnalytics = new GovernanceAnalytics(db);
    this.liquidityAnalytics = new LiquidityPoolAnalytics(db);
    this.logger = new Logger('DaoManager');
  }

  async listDAOs(limit: number = 50, offset: number = 0): Promise<any> {
    try {
      let registeredDAOs: any[] = [];
      
      // Get registered DAOs from the daos table if it exists
      const daosTableExists = await this.db.tableExists('daos');
      if (daosTableExists) {
        const daosQuery = `
          SELECT 
            name,
            slug,
            twitter_handle,
            description,
            website_url,
            created_at,
            updated_at
          FROM daos
          ORDER BY name
          LIMIT $1 OFFSET $2
        `;
        
        const daos = await this.db.query(daosQuery, [limit, offset]);
        registeredDAOs = daos.rows;
      } else {
        this.logger.info('daos table does not exist yet, skipping registered DAOs');
      }
      
      // Get all available DAOs from tweet tables
      const availableDAOs = await this.db.getDAONames();
      
      // Combine and create comprehensive DAO list
      const allDAOs = new Set([
        ...registeredDAOs.map(dao => dao.name.toLowerCase()),
        ...availableDAOs.map(dao => dao.toLowerCase())
      ]);

      const daoList = Array.from(allDAOs).map(daoName => {
        const registeredDAO = registeredDAOs.find(dao => 
          dao.name.toLowerCase() === daoName.toLowerCase()
        );
        
        // Get formatted display name
        const displayName = this.db.getDAODisplayName(daoName);
        
        // Check if this DAO has tweet data
        const tweetTableName = this.db.getDaoTableName(daoName, 'tweets');
        
        return {
          name: displayName,
          slug: registeredDAO?.slug || daoName.toLowerCase().replace(/\s+/g, '-'),
          internal_name: daoName,
          twitter_handle: registeredDAO?.twitter_handle,
          description: registeredDAO?.description,
          website_url: registeredDAO?.website_url,
          is_registered: !!registeredDAO,
          has_tweet_data: true, // We know it has tweet data since it's in availableDAOs
          tweet_table: tweetTableName,
          created_at: registeredDAO?.created_at,
          updated_at: registeredDAO?.updated_at
        };
      });

      // Sort by display name
      daoList.sort((a, b) => a.name.localeCompare(b.name));

      return {
        content: [
          {
            type: 'text',
            text: `Available DAOs (${daoList.length} total):\n\n${JSON.stringify(daoList, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error('Error listing DAOs:', error);
      throw error;
    }
  }

  async getDaoOverview(daoName: string): Promise<any> {
    try {
      const results: any = {
        dao_name: daoName,
        overview: {},
        data_availability: {
          twitter: false,
          discord: false,
          telegram: false,
          governance: false,
          liquidity: false
        },
        summary: {}
      };

      // Get basic DAO info from the daos table if it exists
      const daosTableExists = await this.db.tableExists('daos');
      if (daosTableExists) {
        const daoQuery = `
          SELECT 
            name,
            slug,
            twitter_handle,
            description,
            website_url,
            created_at,
            updated_at
          FROM daos
          WHERE name ILIKE $1 OR slug ILIKE $1
          LIMIT 1
        `;

        const dao = await this.db.query(daoQuery, [`%${daoName}%`]);
        
        if (dao.rows.length > 0) {
          results.overview = dao.rows[0];
        } else {
          results.overview = {
            name: daoName,
            slug: daoName.toLowerCase().replace(/\s+/g, '-'),
            description: 'DAO information not found in registry',
            is_registered: false
          };
        }
      } else {
        this.logger.info('daos table does not exist yet, using default DAO info');
        results.overview = {
          name: daoName,
          slug: daoName.toLowerCase().replace(/\s+/g, '-'),
          description: 'DAO registry table not initialized',
          is_registered: false
        };
      }

      // Check Twitter data availability
      const twitterTableName = this.db.getDaoTableName(daoName, 'tweets');
      const twitterExists = await this.db.tableExists(twitterTableName);
      results.data_availability.twitter = twitterExists;

      if (twitterExists) {
        const twitterCountQuery = `SELECT COUNT(*) as count FROM ${twitterTableName}`;
        const twitterCount = await this.db.query(twitterCountQuery);
        results.summary.twitter_tweets = parseInt(twitterCount.rows[0].count) || 0;
      }

      // Check Discord data availability
      const discordQuery = `SELECT COUNT(*) as count FROM discord_messages LIMIT 1`;
      try {
        const discordCount = await this.db.query(discordQuery);
        results.data_availability.discord = true;
        results.summary.discord_messages = parseInt(discordCount.rows[0].count) || 0;
      } catch (error) {
        results.data_availability.discord = false;
      }

      // Check Telegram data availability
      const telegramQuery = `SELECT COUNT(*) as count FROM telegram_messages LIMIT 1`;
      try {
        const telegramCount = await this.db.query(telegramQuery);
        results.data_availability.telegram = true;
        results.summary.telegram_messages = parseInt(telegramCount.rows[0].count) || 0;
      } catch (error) {
        results.data_availability.telegram = false;
      }

      // Check Governance data availability
      const governanceQuery = `
        SELECT COUNT(*) as count 
        FROM governance_snapshot_spaces 
        WHERE name ILIKE $1 OR space_id ILIKE $1
      `;
      try {
        const governanceCount = await this.db.query(governanceQuery, [`%${daoName}%`]);
        results.data_availability.governance = parseInt(governanceCount.rows[0].count) > 0;
        if (results.data_availability.governance) {
          results.summary.governance_spaces = parseInt(governanceCount.rows[0].count);
        }
      } catch (error) {
        results.data_availability.governance = false;
      }

      // Check Liquidity data availability
      const liquidityQuery = `SELECT COUNT(*) as count FROM lp_pool_snapshots LIMIT 1`;
      try {
        const liquidityCount = await this.db.query(liquidityQuery);
        results.data_availability.liquidity = true;
        results.summary.liquidity_snapshots = parseInt(liquidityCount.rows[0].count) || 0;
      } catch (error) {
        results.data_availability.liquidity = false;
      }

      return {
        content: [
          {
            type: 'text',
            text: `DAO Overview for ${daoName}:\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting DAO overview for ${daoName}:`, error);
      throw error;
    }
  }

  async getComprehensiveAnalysis(daoName: string, days: number = 30): Promise<any> {
    try {
      const results: any = {
        dao_name: daoName,
        analysis_period: {
          days: days,
          start_date: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0]
        },
        platforms: {}
      };

      // Get DAO overview first
      const overview = await this.getDaoOverview(daoName);
      const overviewData = JSON.parse(overview.content[0].text.split(':\n\n')[1]);
      results.overview = overviewData;

      // Twitter Analysis
      if (overviewData.data_availability.twitter) {
        try {
          const twitterMetrics = await this.twitterAnalytics.getMetrics(daoName, days);
          results.platforms.twitter = JSON.parse(twitterMetrics.content[0].text.split(':\n\n')[1]);
        } catch (error) {
          this.logger.warn(`Twitter analysis failed for ${daoName}:`, error);
          results.platforms.twitter = { error: 'Analysis failed' };
        }
      }

      // Discord Analysis
      if (overviewData.data_availability.discord) {
        try {
          const discordActivity = await this.discordAnalytics.getActivity(daoName, days);
          results.platforms.discord = JSON.parse(discordActivity.content[0].text.split(':\n\n')[1]);
        } catch (error) {
          this.logger.warn(`Discord analysis failed for ${daoName}:`, error);
          results.platforms.discord = { error: 'Analysis failed' };
        }
      }

      // Telegram Analysis
      if (overviewData.data_availability.telegram) {
        try {
          const telegramMetrics = await this.telegramAnalytics.getMetrics(daoName, days);
          results.platforms.telegram = JSON.parse(telegramMetrics.content[0].text.split(':\n\n')[1]);
        } catch (error) {
          this.logger.warn(`Telegram analysis failed for ${daoName}:`, error);
          results.platforms.telegram = { error: 'Analysis failed' };
        }
      }

      // Governance Analysis
      if (overviewData.data_availability.governance) {
        try {
          const governanceData = await this.governanceAnalytics.analyzeParticipation(daoName, days);
          results.platforms.governance = JSON.parse(governanceData.content[0].text.split(':\n\n')[1]);
        } catch (error) {
          this.logger.warn(`Governance analysis failed for ${daoName}:`, error);
          results.platforms.governance = { error: 'Analysis failed' };
        }
      }

      // Liquidity Analysis
      if (overviewData.data_availability.liquidity) {
        try {
          const liquidityMetrics = await this.liquidityAnalytics.getMetrics(daoName, undefined, days);
          results.platforms.liquidity = JSON.parse(liquidityMetrics.content[0].text.split(':\n\n')[1]);
        } catch (error) {
          this.logger.warn(`Liquidity analysis failed for ${daoName}:`, error);
          results.platforms.liquidity = { error: 'Analysis failed' };
        }
      }

      // Generate summary insights
      results.insights = this.generateInsights(results);

      return {
        content: [
          {
            type: 'text',
            text: `Comprehensive Analysis for ${daoName}:\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting comprehensive analysis for ${daoName}:`, error);
      throw error;
    }
  }

  async compareDAOs(daoNames: string[], metrics: string[] = ['social_activity', 'governance_participation', 'liquidity'], days: number = 30): Promise<any> {
    try {
      const results: any = {
        comparison_period: {
          days: days,
          start_date: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0]
        },
        daos: {},
        comparison_metrics: {},
        rankings: {}
      };

      // Analyze each DAO
      for (const daoName of daoNames) {
        try {
          const analysis = await this.getComprehensiveAnalysis(daoName, days);
          results.daos[daoName] = JSON.parse(analysis.content[0].text.split(':\n\n')[1]);
        } catch (error) {
          this.logger.warn(`Analysis failed for ${daoName}:`, error);
          results.daos[daoName] = { error: 'Analysis failed' };
        }
      }

      // Generate comparison metrics
      for (const metric of metrics) {
        results.comparison_metrics[metric] = this.compareMetric(results.daos, metric);
      }

      // Generate rankings
      results.rankings = this.generateRankings(results.daos, metrics);

      return {
        content: [
          {
            type: 'text',
            text: `DAO Comparison Analysis (${daoNames.join(', ')}):\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error comparing DAOs:`, error);
      throw error;
    }
  }

  private generateInsights(analysisData: any): any {
    const insights = {
      activity_level: 'unknown',
      engagement_quality: 'unknown',
      governance_health: 'unknown',
      recommendations: [] as string[]
    };

    // Analyze Twitter activity
    if (analysisData.platforms.twitter?.basic_metrics) {
      const twitter = analysisData.platforms.twitter.basic_metrics;
      if (twitter.total_tweets > 100 && twitter.avg_engagement_rate > 10) {
        insights.activity_level = 'high';
        insights.engagement_quality = 'good';
      } else if (twitter.total_tweets > 50 && twitter.avg_engagement_rate > 5) {
        insights.activity_level = 'medium';
        insights.engagement_quality = 'fair';
      } else {
        insights.activity_level = 'low';
        insights.engagement_quality = 'poor';
        insights.recommendations.push('Consider increasing social media engagement');
      }
    }

    // Analyze governance participation
    if (analysisData.platforms.governance?.participation_metrics) {
      const governance = analysisData.platforms.governance.participation_metrics;
      if (governance.avg_votes_per_proposal > 50) {
        insights.governance_health = 'healthy';
      } else if (governance.avg_votes_per_proposal > 20) {
        insights.governance_health = 'moderate';
      } else {
        insights.governance_health = 'low';
        insights.recommendations.push('Work on increasing governance participation');
      }
    }

    return insights;
  }

  private compareMetric(daos: any, metric: string): any {
    const comparison: any = {};
    
    for (const [daoName, daoData] of Object.entries(daos)) {
      if ((daoData as any).error) continue;
      
      const data = daoData as any;
      
      switch (metric) {
        case 'social_activity':
          comparison[daoName] = {
            twitter_tweets: data.platforms?.twitter?.basic_metrics?.total_tweets || 0,
            discord_messages: data.platforms?.discord?.basic_metrics?.total_messages || 0,
            telegram_messages: data.platforms?.telegram?.basic_metrics?.total_messages || 0,
            total_social_activity: (data.platforms?.twitter?.basic_metrics?.total_tweets || 0) +
                                   (data.platforms?.discord?.basic_metrics?.total_messages || 0) +
                                   (data.platforms?.telegram?.basic_metrics?.total_messages || 0)
          };
          break;
        
        case 'governance_participation':
          comparison[daoName] = {
            total_proposals: data.platforms?.governance?.participation_metrics?.total_proposals || 0,
            avg_votes_per_proposal: data.platforms?.governance?.participation_metrics?.avg_votes_per_proposal || 0,
            unique_authors: data.platforms?.governance?.participation_metrics?.unique_authors || 0
          };
          break;
        
        case 'liquidity':
          comparison[daoName] = {
            avg_tvl: data.platforms?.liquidity?.pool_metrics?.[0]?.avg_tvl_usd || 0,
            total_positions: data.platforms?.liquidity?.position_metrics?.total_positions || 0,
            avg_position_value: data.platforms?.liquidity?.position_metrics?.avg_position_value_usd || 0
          };
          break;
      }
    }
    
    return comparison;
  }

  private generateRankings(daos: any, metrics: string[]): any {
    const rankings: any = {};
    
    for (const metric of metrics) {
      const comparison = this.compareMetric(daos, metric);
      
      switch (metric) {
        case 'social_activity':
          rankings[metric] = Object.entries(comparison)
            .sort(([,a], [,b]) => (b as any).total_social_activity - (a as any).total_social_activity)
            .map(([name, data], index) => ({ rank: index + 1, dao: name, score: (data as any).total_social_activity }));
          break;
        
        case 'governance_participation':
          rankings[metric] = Object.entries(comparison)
            .sort(([,a], [,b]) => (b as any).avg_votes_per_proposal - (a as any).avg_votes_per_proposal)
            .map(([name, data], index) => ({ rank: index + 1, dao: name, score: (data as any).avg_votes_per_proposal }));
          break;
        
        case 'liquidity':
          rankings[metric] = Object.entries(comparison)
            .sort(([,a], [,b]) => (b as any).avg_tvl - (a as any).avg_tvl)
            .map(([name, data], index) => ({ rank: index + 1, dao: name, score: (data as any).avg_tvl }));
          break;
      }
    }
    
    return rankings;
  }
} 