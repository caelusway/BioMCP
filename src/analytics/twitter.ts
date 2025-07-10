import { DatabaseManager } from '../database/manager.js';
import { Logger } from '../utils/logger.js';
import { subDays, format } from 'date-fns';

// Helper functions to replace lodash
function groupBy<T>(array: T[], key: string): Record<string, T[]> {
  return array.reduce((result, item) => {
    const group = (item as any)[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

function orderBy<T>(array: T[], keys: string[], orders: string[]): T[] {
  return [...array].sort((a, b) => {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const order = orders[i];
      const aVal = (a as any)[key];
      const bVal = (b as any)[key];
      
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

function sumBy<T>(array: T[], key: string): number {
  return array.reduce((sum, item) => sum + ((item as any)[key] || 0), 0);
}

export interface TwitterMetrics {
  total_tweets: number;
  total_engagement: number;
  avg_engagement_rate: number;
  top_hashtags: Array<{ hashtag: string; count: number }>;
  top_mentions: Array<{ mention: string; count: number }>;
  daily_activity: Array<{ date: string; tweets: number; engagement: number }>;
  sentiment_analysis?: {
    positive: number;
    negative: number;
    neutral: number;
  };
  engagement_breakdown: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    views: number;
  };
}

export interface Tweet {
  id: string;
  text: string;
  author_username: string;
  author_name: string;
  created_at: string;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  quote_count: number;
  view_count: number;
  hashtags: string[];
  mentions: string[];
  urls: string[];
  engagement_score: number;
}

export class TwitterAnalytics {
  private db: DatabaseManager;
  private logger: Logger;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.logger = new Logger('TwitterAnalytics');
  }

  async getMetrics(daoName: string, days: number = 30, metrics: string[] = ['engagement', 'reach', 'sentiment']): Promise<any> {
    try {
      const tableName = this.db.getDaoTableName(daoName, 'tweets');
      const tableExists = await this.db.tableExists(tableName);
      
      if (!tableExists) {
        throw new Error(`No Twitter data found for DAO: ${daoName}`);
      }

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

      // Get basic metrics
      const basicMetricsQuery = `
        SELECT 
          COUNT(*) as total_tweets,
          SUM(like_count + retweet_count + reply_count + quote_count) as total_engagement,
          AVG(like_count + retweet_count + reply_count + quote_count) as avg_engagement,
          SUM(like_count) as total_likes,
          SUM(retweet_count) as total_retweets,
          SUM(reply_count) as total_replies,
          SUM(quote_count) as total_quotes,
          SUM(view_count) as total_views,
          COUNT(DISTINCT author_username) as unique_authors
        FROM ${tableName}
        WHERE created_at >= $1 AND created_at <= $2
        AND type = 'tweet'
      `;

      const basicMetrics = await this.db.query(basicMetricsQuery, [startDate, endDate]);
      const basic = basicMetrics.rows[0];

      results.basic_metrics = {
        total_tweets: parseInt(basic.total_tweets) || 0,
        total_engagement: parseInt(basic.total_engagement) || 0,
        avg_engagement_rate: parseFloat(basic.avg_engagement) || 0,
        unique_authors: parseInt(basic.unique_authors) || 0,
        engagement_breakdown: {
          likes: parseInt(basic.total_likes) || 0,
          retweets: parseInt(basic.total_retweets) || 0,
          replies: parseInt(basic.total_replies) || 0,
          quotes: parseInt(basic.total_quotes) || 0,
          views: parseInt(basic.total_views) || 0
        }
      };

      // Get daily activity if requested
      if (metrics.includes('engagement') || metrics.includes('activity')) {
        const dailyActivityQuery = `
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as tweets,
            SUM(like_count + retweet_count + reply_count + quote_count) as engagement
          FROM ${tableName}
          WHERE created_at >= $1 AND created_at <= $2
          AND type = 'tweet'
          GROUP BY DATE(created_at)
          ORDER BY date
        `;

        const dailyActivity = await this.db.query(dailyActivityQuery, [startDate, endDate]);
        results.daily_activity = dailyActivity.rows.map(row => ({
          date: format(new Date(row.date), 'yyyy-MM-dd'),
          tweets: parseInt(row.tweets),
          engagement: parseInt(row.engagement) || 0
        }));
      }

      // Get hashtag analysis
      if (metrics.includes('hashtags') || metrics.includes('trends')) {
        const hashtagQuery = `
          SELECT 
            hashtag,
            COUNT(*) as count
          FROM ${tableName},
          jsonb_array_elements_text(hashtags) as hashtag
          WHERE created_at >= $1 AND created_at <= $2
          AND type = 'tweet'
          GROUP BY hashtag
          ORDER BY count DESC
          LIMIT 20
        `;

        const hashtags = await this.db.query(hashtagQuery, [startDate, endDate]);
        results.top_hashtags = hashtags.rows.map(row => ({
          hashtag: row.hashtag,
          count: parseInt(row.count)
        }));
      }

      // Get mention analysis
      if (metrics.includes('mentions') || metrics.includes('reach')) {
        const mentionQuery = `
          SELECT 
            mention,
            COUNT(*) as count
          FROM ${tableName},
          jsonb_array_elements_text(mentions) as mention
          WHERE created_at >= $1 AND created_at <= $2
          AND type = 'tweet'
          GROUP BY mention
          ORDER BY count DESC
          LIMIT 20
        `;

        const mentions = await this.db.query(mentionQuery, [startDate, endDate]);
        results.top_mentions = mentions.rows.map(row => ({
          mention: row.mention,
          count: parseInt(row.count)
        }));
      }

      // Get top authors
      const topAuthorsQuery = `
        SELECT 
          author_username,
          author_name,
          COUNT(*) as tweet_count,
          SUM(like_count + retweet_count + reply_count + quote_count) as total_engagement,
          AVG(like_count + retweet_count + reply_count + quote_count) as avg_engagement
        FROM ${tableName}
        WHERE created_at >= $1 AND created_at <= $2
        AND type = 'tweet'
        GROUP BY author_username, author_name
        ORDER BY total_engagement DESC
        LIMIT 10
      `;

      const topAuthors = await this.db.query(topAuthorsQuery, [startDate, endDate]);
      results.top_authors = topAuthors.rows.map(row => ({
        username: row.author_username,
        name: row.author_name,
        tweet_count: parseInt(row.tweet_count),
        total_engagement: parseInt(row.total_engagement) || 0,
        avg_engagement: parseFloat(row.avg_engagement) || 0
      }));

      return {
        content: [
          {
            type: 'text',
            text: `Twitter Analytics for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting Twitter metrics for ${daoName}:`, error);
      throw error;
    }
  }

  async getTopTweets(daoName: string, limit: number = 10, sortBy: string = 'like_count', days: number = 30): Promise<any> {
    try {
      const tableName = this.db.getDaoTableName(daoName, 'tweets');
      const tableExists = await this.db.tableExists(tableName);
      
      if (!tableExists) {
        throw new Error(`No Twitter data found for DAO: ${daoName}`);
      }

      const startDate = subDays(new Date(), days);
      const endDate = new Date();

      const validSortFields = ['like_count', 'retweet_count', 'reply_count', 'quote_count', 'view_count'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'like_count';

      const query = `
        SELECT 
          id,
          text,
          author_username,
          author_name,
          created_at,
          like_count,
          retweet_count,
          reply_count,
          quote_count,
          view_count,
          hashtags,
          mentions,
          urls,
          twitter_url,
          (like_count + retweet_count + reply_count + quote_count) as engagement_score
        FROM ${tableName}
        WHERE created_at >= $1 AND created_at <= $2
        AND type = 'tweet'
        ORDER BY ${sortField} DESC
        LIMIT $3
      `;

      const result = await this.db.query(query, [startDate, endDate, limit]);
      
      const tweets = result.rows.map(row => ({
        id: row.id,
        text: row.text,
        author: {
          username: row.author_username,
          name: row.author_name
        },
        created_at: row.created_at,
        engagement: {
          likes: row.like_count,
          retweets: row.retweet_count,
          replies: row.reply_count,
          quotes: row.quote_count,
          views: row.view_count,
          total_score: row.engagement_score
        },
        hashtags: row.hashtags || [],
        mentions: row.mentions || [],
        urls: row.urls || [],
        twitter_url: row.twitter_url
      }));

      return {
        content: [
          {
            type: 'text',
            text: `Top ${limit} Tweets for ${daoName} (sorted by ${sortBy})\n\n${JSON.stringify(tweets, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting top tweets for ${daoName}:`, error);
      throw error;
    }
  }

  async analyzeTrends(daoName: string, days: number = 30): Promise<any> {
    try {
      const tableName = this.db.getDaoTableName(daoName, 'tweets');
      const tableExists = await this.db.tableExists(tableName);
      
      if (!tableExists) {
        throw new Error(`No Twitter data found for DAO: ${daoName}`);
      }

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

      // Trending hashtags over time
      const hashtagTrendsQuery = `
        SELECT 
          DATE(created_at) as date,
          hashtag,
          COUNT(*) as count
        FROM ${tableName},
        jsonb_array_elements_text(hashtags) as hashtag
        WHERE created_at >= $1 AND created_at <= $2
        AND type = 'tweet'
        GROUP BY DATE(created_at), hashtag
        HAVING COUNT(*) >= 2
        ORDER BY date, count DESC
      `;

      const hashtagTrends = await this.db.query(hashtagTrendsQuery, [startDate, endDate]);
      
      // Group by date and get top hashtags per day
      const trendsByDate = groupBy(hashtagTrends.rows, 'date');
      results.daily_trending_hashtags = Object.entries(trendsByDate).map(([date, hashtagsArray]) => ({
        date,
        hashtags: (hashtagsArray as any[]).slice(0, 5).map((h: any) => ({
          hashtag: h.hashtag,
          count: parseInt(h.count)
        }))
      }));

      // Engagement trends
      const engagementTrendsQuery = `
        SELECT 
          DATE(created_at) as date,
          AVG(like_count) as avg_likes,
          AVG(retweet_count) as avg_retweets,
          AVG(reply_count) as avg_replies,
          AVG(quote_count) as avg_quotes,
          AVG(view_count) as avg_views
        FROM ${tableName}
        WHERE created_at >= $1 AND created_at <= $2
        AND type = 'tweet'
        GROUP BY DATE(created_at)
        ORDER BY date
      `;

      const engagementTrends = await this.db.query(engagementTrendsQuery, [startDate, endDate]);
      results.engagement_trends = engagementTrends.rows.map(row => ({
        date: format(new Date(row.date), 'yyyy-MM-dd'),
        avg_likes: parseFloat(row.avg_likes) || 0,
        avg_retweets: parseFloat(row.avg_retweets) || 0,
        avg_replies: parseFloat(row.avg_replies) || 0,
        avg_quotes: parseFloat(row.avg_quotes) || 0,
        avg_views: parseFloat(row.avg_views) || 0
      }));

      // Content type analysis
      const contentTypeQuery = `
        SELECT 
          CASE 
            WHEN jsonb_array_length(media) > 0 THEN 'media'
            WHEN jsonb_array_length(urls) > 0 THEN 'link'
            WHEN is_reply = true THEN 'reply'
            ELSE 'text'
          END as content_type,
          COUNT(*) as count,
          AVG(like_count + retweet_count + reply_count + quote_count) as avg_engagement
        FROM ${tableName}
        WHERE created_at >= $1 AND created_at <= $2
        AND type = 'tweet'
        GROUP BY content_type
        ORDER BY count DESC
      `;

      const contentTypes = await this.db.query(contentTypeQuery, [startDate, endDate]);
      results.content_type_analysis = contentTypes.rows.map(row => ({
        type: row.content_type,
        count: parseInt(row.count),
        avg_engagement: parseFloat(row.avg_engagement) || 0
      }));

      return {
        content: [
          {
            type: 'text',
            text: `Twitter Trends Analysis for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error analyzing Twitter trends for ${daoName}:`, error);
      throw error;
    }
  }

  async getInfluencerAnalysis(daoName: string, days: number = 30): Promise<any> {
    try {
      const tableName = this.db.getDaoTableName(daoName, 'tweets');
      const tableExists = await this.db.tableExists(tableName);
      
      if (!tableExists) {
        throw new Error(`No Twitter data found for DAO: ${daoName}`);
      }

      const startDate = subDays(new Date(), days);
      const endDate = new Date();

      // Get influencer metrics
      const influencerQuery = `
        SELECT 
          author_username,
          author_name,
          COUNT(*) as tweet_count,
          SUM(like_count) as total_likes,
          SUM(retweet_count) as total_retweets,
          SUM(reply_count) as total_replies,
          SUM(view_count) as total_views,
          AVG(like_count + retweet_count + reply_count + quote_count) as avg_engagement,
          MAX(like_count + retweet_count + reply_count + quote_count) as max_engagement
        FROM ${tableName}
        WHERE created_at >= $1 AND created_at <= $2
        AND type = 'tweet'
        GROUP BY author_username, author_name
        HAVING COUNT(*) >= 2
        ORDER BY avg_engagement DESC
        LIMIT 20
      `;

      const influencers = await this.db.query(influencerQuery, [startDate, endDate]);
      
      const results = {
        dao_name: daoName,
        period: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
          days: days
        },
        top_influencers: influencers.rows.map(row => ({
          username: row.author_username,
          name: row.author_name,
          tweet_count: parseInt(row.tweet_count),
          total_likes: parseInt(row.total_likes) || 0,
          total_retweets: parseInt(row.total_retweets) || 0,
          total_replies: parseInt(row.total_replies) || 0,
          total_views: parseInt(row.total_views) || 0,
          avg_engagement: parseFloat(row.avg_engagement) || 0,
          max_engagement: parseInt(row.max_engagement) || 0
        }))
      };

      return {
        content: [
          {
            type: 'text',
            text: `Twitter Influencer Analysis for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting influencer analysis for ${daoName}:`, error);
      throw error;
    }
  }
} 