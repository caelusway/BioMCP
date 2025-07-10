import { DatabaseManager } from '../database/manager.js';
import { Logger } from '../utils/logger.js';
import { subDays, format } from 'date-fns';

export interface DiscordMetrics {
  total_messages: number;
  unique_users: number;
  active_channels: number;
  avg_messages_per_day: number;
  top_channels: Array<{ channel_name: string; message_count: number }>;
  user_activity: Array<{ username: string; message_count: number; last_active: string }>;
  daily_activity: Array<{ date: string; messages: number; unique_users: number }>;
  category_breakdown: Array<{ category: string; message_count: number }>;
}

export class DiscordAnalytics {
  private db: DatabaseManager;
  private logger: Logger;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.logger = new Logger('DiscordAnalytics');
  }

  async getActivity(daoName: string, days: number = 30): Promise<any> {
    try {
      const startDate = subDays(new Date(), days);
      const endDate = new Date();

      const results: any = {
        dao_name: daoName,
        period: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
          days: days
        }
      };

      // Get basic Discord activity metrics
      const basicMetricsQuery = `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(DISTINCT author_username) as unique_users,
          COUNT(DISTINCT channel_name) as active_channels,
          COUNT(DISTINCT DATE(timestamp)) as active_days
        FROM discord_messages
        WHERE timestamp >= $1 AND timestamp <= $2
      `;

      const basicMetrics = await this.db.query(basicMetricsQuery, [startDate, endDate]);
      const basic = basicMetrics.rows[0];

      results.basic_metrics = {
        total_messages: parseInt(basic.total_messages) || 0,
        unique_users: parseInt(basic.unique_users) || 0,
        active_channels: parseInt(basic.active_channels) || 0,
        active_days: parseInt(basic.active_days) || 0,
        avg_messages_per_day: basic.active_days > 0 ? 
          Math.round((parseInt(basic.total_messages) || 0) / parseInt(basic.active_days)) : 0
      };

      // Get daily activity
      const dailyActivityQuery = `
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as messages,
          COUNT(DISTINCT author_username) as unique_users
        FROM discord_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY DATE(timestamp)
        ORDER BY date
      `;

      const dailyActivity = await this.db.query(dailyActivityQuery, [startDate, endDate]);
      results.daily_activity = dailyActivity.rows.map(row => ({
        date: format(new Date(row.date), 'yyyy-MM-dd'),
        messages: parseInt(row.messages),
        unique_users: parseInt(row.unique_users)
      }));

      // Get top channels
      const topChannelsQuery = `
        SELECT 
          channel_name,
          COUNT(*) as message_count,
          COUNT(DISTINCT author_username) as unique_users
        FROM discord_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY channel_name
        ORDER BY message_count DESC
        LIMIT 10
      `;

      const topChannels = await this.db.query(topChannelsQuery, [startDate, endDate]);
      results.top_channels = topChannels.rows.map(row => ({
        channel_name: row.channel_name,
        message_count: parseInt(row.message_count),
        unique_users: parseInt(row.unique_users)
      }));

      // Get category breakdown
      const categoryBreakdownQuery = `
        SELECT 
          category,
          COUNT(*) as message_count,
          COUNT(DISTINCT author_username) as unique_users
        FROM discord_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY category
        ORDER BY message_count DESC
      `;

      const categoryBreakdown = await this.db.query(categoryBreakdownQuery, [startDate, endDate]);
      results.category_breakdown = categoryBreakdown.rows.map(row => ({
        category: row.category,
        message_count: parseInt(row.message_count),
        unique_users: parseInt(row.unique_users)
      }));

      // Get Discord TGE phase breakdown
      const phaseBreakdownQuery = `
        SELECT 
          discord_tge_phase,
          COUNT(*) as message_count,
          COUNT(DISTINCT author_username) as unique_users
        FROM discord_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY discord_tge_phase
        ORDER BY message_count DESC
      `;

      const phaseBreakdown = await this.db.query(phaseBreakdownQuery, [startDate, endDate]);
      results.tge_phase_breakdown = phaseBreakdown.rows.map(row => ({
        phase: row.discord_tge_phase,
        message_count: parseInt(row.message_count),
        unique_users: parseInt(row.unique_users)
      }));

      // Get thread activity
      const threadActivityQuery = `
        SELECT 
          COUNT(*) as total_thread_messages,
          COUNT(DISTINCT thread_name) as unique_threads,
          COUNT(DISTINCT author_username) as thread_participants
        FROM discord_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        AND is_thread = true
      `;

      const threadActivity = await this.db.query(threadActivityQuery, [startDate, endDate]);
      const thread = threadActivity.rows[0];

      results.thread_activity = {
        total_thread_messages: parseInt(thread.total_thread_messages) || 0,
        unique_threads: parseInt(thread.unique_threads) || 0,
        thread_participants: parseInt(thread.thread_participants) || 0
      };

      return {
        content: [
          {
            type: 'text',
            text: `Discord Activity Analysis for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting Discord activity for ${daoName}:`, error);
      throw error;
    }
  }

  async getTopUsers(daoName: string, limit: number = 10, days: number = 30): Promise<any> {
    try {
      const startDate = subDays(new Date(), days);
      const endDate = new Date();

      const topUsersQuery = `
        SELECT 
          author_username,
          author_display_name,
          COUNT(*) as message_count,
          COUNT(DISTINCT channel_name) as channels_active,
          COUNT(DISTINCT DATE(timestamp)) as days_active,
          MIN(timestamp) as first_message,
          MAX(timestamp) as last_message,
          COUNT(CASE WHEN is_thread = true THEN 1 END) as thread_messages
        FROM discord_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY author_username, author_display_name
        ORDER BY message_count DESC
        LIMIT $3
      `;

      const topUsers = await this.db.query(topUsersQuery, [startDate, endDate, limit]);
      
      const results = {
        dao_name: daoName,
        period: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
          days: days
        },
        top_users: topUsers.rows.map(row => ({
          username: row.author_username,
          display_name: row.author_display_name,
          message_count: parseInt(row.message_count),
          channels_active: parseInt(row.channels_active),
          days_active: parseInt(row.days_active),
          thread_messages: parseInt(row.thread_messages) || 0,
          first_message: row.first_message,
          last_message: row.last_message,
          avg_messages_per_day: Math.round(parseInt(row.message_count) / parseInt(row.days_active))
        }))
      };

      return {
        content: [
          {
            type: 'text',
            text: `Top ${limit} Discord Users for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting top Discord users for ${daoName}:`, error);
      throw error;
    }
  }

  async getChannelStats(daoName: string, days: number = 30): Promise<any> {
    try {
      const startDate = subDays(new Date(), days);
      const endDate = new Date();

      // Get channel statistics
      const channelStatsQuery = `
        SELECT 
          channel_name,
          category,
          COUNT(*) as message_count,
          COUNT(DISTINCT author_username) as unique_users,
          COUNT(DISTINCT DATE(timestamp)) as active_days,
          MIN(timestamp) as first_message,
          MAX(timestamp) as last_message,
          COUNT(CASE WHEN is_thread = true THEN 1 END) as thread_messages,
          COUNT(DISTINCT thread_name) as unique_threads
        FROM discord_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY channel_name, category
        ORDER BY message_count DESC
      `;

      const channelStats = await this.db.query(channelStatsQuery, [startDate, endDate]);
      
      const results: any = {
        dao_name: daoName,
        period: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
          days: days
        },
        channel_statistics: channelStats.rows.map(row => ({
          channel_name: row.channel_name,
          category: row.category,
          message_count: parseInt(row.message_count),
          unique_users: parseInt(row.unique_users),
          active_days: parseInt(row.active_days),
          thread_messages: parseInt(row.thread_messages) || 0,
          unique_threads: parseInt(row.unique_threads) || 0,
          first_message: row.first_message,
          last_message: row.last_message,
          avg_messages_per_day: Math.round(parseInt(row.message_count) / parseInt(row.active_days))
        }))
      };

      // Get hourly activity patterns
      const hourlyActivityQuery = `
        SELECT 
          EXTRACT(HOUR FROM timestamp) as hour,
          COUNT(*) as message_count,
          COUNT(DISTINCT author_username) as unique_users
        FROM discord_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY EXTRACT(HOUR FROM timestamp)
        ORDER BY hour
      `;

      const hourlyActivity = await this.db.query(hourlyActivityQuery, [startDate, endDate]);
      results.hourly_activity = hourlyActivity.rows.map(row => ({
        hour: parseInt(row.hour),
        message_count: parseInt(row.message_count),
        unique_users: parseInt(row.unique_users)
      }));

      return {
        content: [
          {
            type: 'text',
            text: `Discord Channel Statistics for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting Discord channel stats for ${daoName}:`, error);
      throw error;
    }
  }

  async getCommunityGrowth(daoName: string, days: number = 30): Promise<any> {
    try {
      const startDate = subDays(new Date(), days);
      const endDate = new Date();

      // Get community growth metrics
      const growthQuery = `
        SELECT 
          DATE(timestamp) as date,
          COUNT(DISTINCT author_username) as daily_unique_users,
          COUNT(*) as daily_messages
        FROM discord_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY DATE(timestamp)
        ORDER BY date
      `;

      const growth = await this.db.query(growthQuery, [startDate, endDate]);
      
      // Calculate cumulative unique users
      const uniqueUsersQuery = `
        SELECT 
          author_username,
          MIN(DATE(timestamp)) as first_seen
        FROM discord_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY author_username
        ORDER BY first_seen
      `;

      const uniqueUsers = await this.db.query(uniqueUsersQuery, [startDate, endDate]);
      
      // Calculate retention metrics
      const retentionQuery = `
        SELECT 
          author_username,
          COUNT(DISTINCT DATE(timestamp)) as active_days,
          MIN(timestamp) as first_message,
          MAX(timestamp) as last_message
        FROM discord_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY author_username
        ORDER BY active_days DESC
      `;

      const retention = await this.db.query(retentionQuery, [startDate, endDate]);
      
      const results = {
        dao_name: daoName,
        period: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
          days: days
        },
        daily_growth: growth.rows.map(row => ({
          date: format(new Date(row.date), 'yyyy-MM-dd'),
          daily_unique_users: parseInt(row.daily_unique_users),
          daily_messages: parseInt(row.daily_messages)
        })),
        new_users_by_day: uniqueUsers.rows.reduce((acc: any, user: any) => {
          const date = format(new Date(user.first_seen), 'yyyy-MM-dd');
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {}),
        retention_analysis: {
          total_users: retention.rows.length,
          highly_active_users: retention.rows.filter(u => parseInt(u.active_days) >= 7).length,
          moderately_active_users: retention.rows.filter(u => parseInt(u.active_days) >= 3 && parseInt(u.active_days) < 7).length,
          low_activity_users: retention.rows.filter(u => parseInt(u.active_days) < 3).length
        }
      };

      return {
        content: [
          {
            type: 'text',
            text: `Discord Community Growth Analysis for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting Discord community growth for ${daoName}:`, error);
      throw error;
    }
  }

  async getMessageTypes(daoName: string, days: number = 30): Promise<any> {
    try {
      const startDate = subDays(new Date(), days);
      const endDate = new Date();

      // Get message type analysis
      const messageTypesQuery = `
        SELECT 
          message_type,
          COUNT(*) as count,
          COUNT(DISTINCT author_username) as unique_users
        FROM discord_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY message_type
        ORDER BY count DESC
      `;

      const messageTypes = await this.db.query(messageTypesQuery, [startDate, endDate]);
      
      // Get attachment analysis
      const attachmentQuery = `
        SELECT 
          COUNT(*) as total_with_attachments,
          COUNT(DISTINCT author_username) as users_with_attachments
        FROM discord_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        AND jsonb_array_length(attachments) > 0
      `;

      const attachments = await this.db.query(attachmentQuery, [startDate, endDate]);
      
      // Get embed analysis
      const embedQuery = `
        SELECT 
          COUNT(*) as total_with_embeds,
          COUNT(DISTINCT author_username) as users_with_embeds
        FROM discord_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        AND jsonb_array_length(embeds) > 0
      `;

      const embeds = await this.db.query(embedQuery, [startDate, endDate]);
      
      const results = {
        dao_name: daoName,
        period: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
          days: days
        },
        message_types: messageTypes.rows.map(row => ({
          type: row.message_type,
          count: parseInt(row.count),
          unique_users: parseInt(row.unique_users)
        })),
        content_analysis: {
          messages_with_attachments: parseInt(attachments.rows[0].total_with_attachments) || 0,
          users_sharing_attachments: parseInt(attachments.rows[0].users_with_attachments) || 0,
          messages_with_embeds: parseInt(embeds.rows[0].total_with_embeds) || 0,
          users_sharing_embeds: parseInt(embeds.rows[0].users_with_embeds) || 0
        }
      };

      return {
        content: [
          {
            type: 'text',
            text: `Discord Message Types Analysis for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting Discord message types for ${daoName}:`, error);
      throw error;
    }
  }
} 