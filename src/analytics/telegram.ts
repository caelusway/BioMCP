import { DatabaseManager } from '../database/manager.js';
import { Logger } from '../utils/logger.js';
import { subDays, format } from 'date-fns';

export class TelegramAnalytics {
  private db: DatabaseManager;
  private logger: Logger;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.logger = new Logger('TelegramAnalytics');
  }

  async getMetrics(daoName: string, days: number = 30): Promise<any> {
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

      // Get basic Telegram metrics
      const basicMetricsQuery = `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT chat_id) as active_chats,
          COUNT(DISTINCT DATE(timestamp)) as active_days
        FROM telegram_messages
        WHERE timestamp >= $1 AND timestamp <= $2
      `;

      const basicMetrics = await this.db.query(basicMetricsQuery, [startDate, endDate]);
      const basic = basicMetrics.rows[0];

      results.basic_metrics = {
        total_messages: parseInt(basic.total_messages) || 0,
        unique_users: parseInt(basic.unique_users) || 0,
        active_chats: parseInt(basic.active_chats) || 0,
        active_days: parseInt(basic.active_days) || 0,
        avg_messages_per_day: basic.active_days > 0 ? 
          Math.round((parseInt(basic.total_messages) || 0) / parseInt(basic.active_days)) : 0
      };

      // Get daily activity
      const dailyActivityQuery = `
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as messages,
          COUNT(DISTINCT user_id) as unique_users
        FROM telegram_messages
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

      // Get top chats
      const topChatsQuery = `
        SELECT 
          chat_title,
          chat_type,
          COUNT(*) as message_count,
          COUNT(DISTINCT user_id) as unique_users
        FROM telegram_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY chat_title, chat_type
        ORDER BY message_count DESC
        LIMIT 10
      `;

      const topChats = await this.db.query(topChatsQuery, [startDate, endDate]);
      results.top_chats = topChats.rows.map(row => ({
        chat_title: row.chat_title,
        chat_type: row.chat_type,
        message_count: parseInt(row.message_count),
        unique_users: parseInt(row.unique_users)
      }));

      // Get top users
      const topUsersQuery = `
        SELECT 
          username,
          first_name,
          last_name,
          COUNT(*) as message_count,
          COUNT(DISTINCT chat_id) as chats_active,
          MIN(timestamp) as first_message,
          MAX(timestamp) as last_message
        FROM telegram_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY username, first_name, last_name
        ORDER BY message_count DESC
        LIMIT 10
      `;

      const topUsers = await this.db.query(topUsersQuery, [startDate, endDate]);
      results.top_users = topUsers.rows.map(row => ({
        username: row.username,
        first_name: row.first_name,
        last_name: row.last_name,
        message_count: parseInt(row.message_count),
        chats_active: parseInt(row.chats_active),
        first_message: row.first_message,
        last_message: row.last_message
      }));

      // Get category breakdown
      const categoryBreakdownQuery = `
        SELECT 
          category,
          COUNT(*) as message_count,
          COUNT(DISTINCT user_id) as unique_users
        FROM telegram_messages
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

      // Get message types
      const messageTypesQuery = `
        SELECT 
          message_type,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users
        FROM telegram_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY message_type
        ORDER BY count DESC
      `;

      const messageTypes = await this.db.query(messageTypesQuery, [startDate, endDate]);
      results.message_types = messageTypes.rows.map(row => ({
        type: row.message_type,
        count: parseInt(row.count),
        unique_users: parseInt(row.unique_users)
      }));

      // Get attachment analysis
      const attachmentQuery = `
        SELECT 
          COUNT(*) as total_with_attachments,
          COUNT(DISTINCT user_id) as users_with_attachments
        FROM telegram_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        AND jsonb_array_length(attachments) > 0
      `;

      const attachments = await this.db.query(attachmentQuery, [startDate, endDate]);
      results.content_analysis = {
        messages_with_attachments: parseInt(attachments.rows[0].total_with_attachments) || 0,
        users_sharing_attachments: parseInt(attachments.rows[0].users_with_attachments) || 0
      };

      // Get reply analysis
      const replyQuery = `
        SELECT 
          COUNT(*) as total_replies,
          COUNT(DISTINCT user_id) as users_replying
        FROM telegram_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        AND reply_to_message_id IS NOT NULL
      `;

      const replies = await this.db.query(replyQuery, [startDate, endDate]);
      results.reply_analysis = {
        total_replies: parseInt(replies.rows[0].total_replies) || 0,
        users_replying: parseInt(replies.rows[0].users_replying) || 0
      };

      // Get forward analysis
      const forwardQuery = `
        SELECT 
          COUNT(*) as total_forwards,
          COUNT(DISTINCT user_id) as users_forwarding
        FROM telegram_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        AND forward_from_chat_id IS NOT NULL
      `;

      const forwards = await this.db.query(forwardQuery, [startDate, endDate]);
      results.forward_analysis = {
        total_forwards: parseInt(forwards.rows[0].total_forwards) || 0,
        users_forwarding: parseInt(forwards.rows[0].users_forwarding) || 0
      };

      return {
        content: [
          {
            type: 'text',
            text: `Telegram Analytics for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting Telegram metrics for ${daoName}:`, error);
      throw error;
    }
  }

  async getChatGrowth(daoName: string, days: number = 30): Promise<any> {
    try {
      const startDate = subDays(new Date(), days);
      const endDate = new Date();

      // Get chat growth metrics
      const growthQuery = `
        SELECT 
          chat_title,
          chat_type,
          DATE(timestamp) as date,
          COUNT(DISTINCT user_id) as daily_unique_users,
          COUNT(*) as daily_messages
        FROM telegram_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY chat_title, chat_type, DATE(timestamp)
        ORDER BY chat_title, date
      `;

      const growth = await this.db.query(growthQuery, [startDate, endDate]);
      
      // Group by chat
      const chatGrowth = growth.rows.reduce((acc: any, row: any) => {
        const key = `${row.chat_title} (${row.chat_type})`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push({
          date: format(new Date(row.date), 'yyyy-MM-dd'),
          daily_unique_users: parseInt(row.daily_unique_users),
          daily_messages: parseInt(row.daily_messages)
        });
        return acc;
      }, {});

      const results = {
        dao_name: daoName,
        period: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
          days: days
        },
        chat_growth: chatGrowth
      };

      return {
        content: [
          {
            type: 'text',
            text: `Telegram Chat Growth Analysis for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting Telegram chat growth for ${daoName}:`, error);
      throw error;
    }
  }

  async getHourlyActivity(daoName: string, days: number = 30): Promise<any> {
    try {
      const startDate = subDays(new Date(), days);
      const endDate = new Date();

      // Get hourly activity patterns
      const hourlyActivityQuery = `
        SELECT 
          EXTRACT(HOUR FROM timestamp) as hour,
          COUNT(*) as message_count,
          COUNT(DISTINCT user_id) as unique_users
        FROM telegram_messages
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY EXTRACT(HOUR FROM timestamp)
        ORDER BY hour
      `;

      const hourlyActivity = await this.db.query(hourlyActivityQuery, [startDate, endDate]);
      
      const results = {
        dao_name: daoName,
        period: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
          days: days
        },
        hourly_activity: hourlyActivity.rows.map(row => ({
          hour: parseInt(row.hour),
          message_count: parseInt(row.message_count),
          unique_users: parseInt(row.unique_users)
        }))
      };

      return {
        content: [
          {
            type: 'text',
            text: `Telegram Hourly Activity Analysis for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting Telegram hourly activity for ${daoName}:`, error);
      throw error;
    }
  }
} 