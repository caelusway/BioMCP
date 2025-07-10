import { DatabaseManager } from '../database/manager.js';
import { Logger } from '../utils/logger.js';
import { subDays, format } from 'date-fns';

export class GovernanceAnalytics {
  private db: DatabaseManager;
  private logger: Logger;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.logger = new Logger('GovernanceAnalytics');
  }

  async getProposals(daoName: string, status?: string, limit: number = 10): Promise<any> {
    try {
      // First get the space_id for the DAO
      const spaceQuery = `
        SELECT id, space_id, name, description
        FROM governance_snapshot_spaces
        WHERE name ILIKE '%${daoName}%' OR space_id ILIKE '%${daoName}%'
        LIMIT 1
      `;

      const spaceResult = await this.db.query(spaceQuery);
      
      if (spaceResult.rows.length === 0) {
        throw new Error(`No governance space found for DAO: ${daoName}`);
      }

      const space = spaceResult.rows[0];
      
      // Build the proposals query
      let proposalsQuery = `
        SELECT 
          p.proposal_id,
          p.title,
          p.body,
          p.author,
          p.created_at_snapshot,
          p.start_time,
          p.end_time,
          p.state,
          p.link,
          p.choices,
          p.scores,
          p.scores_total,
          p.votes_count,
          p.processed,
          p.created_at,
          p.updated_at
        FROM governance_snapshot_proposals p
        WHERE p.space_id = $1
      `;

      const queryParams = [space.id];

      if (status) {
        proposalsQuery += ` AND p.state = $2`;
        queryParams.push(status);
      }

      proposalsQuery += ` ORDER BY p.created_at_snapshot DESC LIMIT $${queryParams.length + 1}`;
      queryParams.push(limit);

      const proposals = await this.db.query(proposalsQuery, queryParams);
      
      const results = {
        dao_name: daoName,
        space_info: {
          space_id: space.space_id,
          name: space.name,
          description: space.description
        },
        proposals: proposals.rows.map(row => ({
          proposal_id: row.proposal_id,
          title: row.title,
          body: row.body ? row.body.substring(0, 500) + '...' : null,
          author: row.author,
          created_at: new Date(row.created_at_snapshot * 1000).toISOString(),
          start_time: new Date(row.start_time * 1000).toISOString(),
          end_time: new Date(row.end_time * 1000).toISOString(),
          state: row.state,
          link: row.link,
          choices: row.choices,
          scores: row.scores,
          scores_total: parseFloat(row.scores_total) || 0,
          votes_count: parseInt(row.votes_count) || 0,
          processed: row.processed
        }))
      };

      return {
        content: [
          {
            type: 'text',
            text: `Governance Proposals for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting governance proposals for ${daoName}:`, error);
      throw error;
    }
  }

  async analyzeParticipation(daoName: string, days: number = 90): Promise<any> {
    try {
      const startDate = subDays(new Date(), days);
      const endDate = new Date();

      // Get space information
      const spaceQuery = `
        SELECT id, space_id, name, description
        FROM governance_snapshot_spaces
        WHERE name ILIKE '%${daoName}%' OR space_id ILIKE '%${daoName}%'
        LIMIT 1
      `;

      const spaceResult = await this.db.query(spaceQuery);
      
      if (spaceResult.rows.length === 0) {
        throw new Error(`No governance space found for DAO: ${daoName}`);
      }

      const space = spaceResult.rows[0];

      // Get participation metrics
      const participationQuery = `
        SELECT 
          COUNT(*) as total_proposals,
          COUNT(CASE WHEN state = 'active' THEN 1 END) as active_proposals,
          COUNT(CASE WHEN state = 'closed' THEN 1 END) as closed_proposals,
          AVG(votes_count) as avg_votes_per_proposal,
          AVG(scores_total) as avg_total_score,
          COUNT(DISTINCT author) as unique_authors
        FROM governance_snapshot_proposals
        WHERE space_id = $1
        AND created_at >= $2 AND created_at <= $3
      `;

      const participation = await this.db.query(participationQuery, [space.id, startDate, endDate]);
      const stats = participation.rows[0];

      // Get proposals over time
      const timelineQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as proposals_created,
          AVG(votes_count) as avg_votes,
          AVG(scores_total) as avg_score
        FROM governance_snapshot_proposals
        WHERE space_id = $1
        AND created_at >= $2 AND created_at <= $3
        GROUP BY DATE(created_at)
        ORDER BY date
      `;

      const timeline = await this.db.query(timelineQuery, [space.id, startDate, endDate]);

      // Get top authors
      const topAuthorsQuery = `
        SELECT 
          author,
          COUNT(*) as proposal_count,
          AVG(votes_count) as avg_votes,
          AVG(scores_total) as avg_score
        FROM governance_snapshot_proposals
        WHERE space_id = $1
        AND created_at >= $2 AND created_at <= $3
        GROUP BY author
        ORDER BY proposal_count DESC
        LIMIT 10
      `;

      const topAuthors = await this.db.query(topAuthorsQuery, [space.id, startDate, endDate]);

      // Get proposal states breakdown
      const statesQuery = `
        SELECT 
          state,
          COUNT(*) as count,
          AVG(votes_count) as avg_votes,
          AVG(scores_total) as avg_score
        FROM governance_snapshot_proposals
        WHERE space_id = $1
        AND created_at >= $2 AND created_at <= $3
        GROUP BY state
        ORDER BY count DESC
      `;

      const states = await this.db.query(statesQuery, [space.id, startDate, endDate]);

      // Get voting patterns
      const votingPatternsQuery = `
        SELECT 
          CASE 
            WHEN votes_count = 0 THEN 'no_votes'
            WHEN votes_count < 10 THEN 'low_participation'
            WHEN votes_count < 50 THEN 'medium_participation'
            ELSE 'high_participation'
          END as participation_level,
          COUNT(*) as proposal_count,
          AVG(votes_count) as avg_votes,
          AVG(scores_total) as avg_score
        FROM governance_snapshot_proposals
        WHERE space_id = $1
        AND created_at >= $2 AND created_at <= $3
        GROUP BY participation_level
        ORDER BY avg_votes DESC
      `;

      const votingPatterns = await this.db.query(votingPatternsQuery, [space.id, startDate, endDate]);

      const results = {
        dao_name: daoName,
        period: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
          days: days
        },
        space_info: {
          space_id: space.space_id,
          name: space.name
        },
        participation_metrics: {
          total_proposals: parseInt(stats.total_proposals) || 0,
          active_proposals: parseInt(stats.active_proposals) || 0,
          closed_proposals: parseInt(stats.closed_proposals) || 0,
          avg_votes_per_proposal: parseFloat(stats.avg_votes_per_proposal) || 0,
          avg_total_score: parseFloat(stats.avg_total_score) || 0,
          unique_authors: parseInt(stats.unique_authors) || 0
        },
        proposal_timeline: timeline.rows.map(row => ({
          date: format(new Date(row.date), 'yyyy-MM-dd'),
          proposals_created: parseInt(row.proposals_created),
          avg_votes: parseFloat(row.avg_votes) || 0,
          avg_score: parseFloat(row.avg_score) || 0
        })),
        top_authors: topAuthors.rows.map(row => ({
          author: row.author,
          proposal_count: parseInt(row.proposal_count),
          avg_votes: parseFloat(row.avg_votes) || 0,
          avg_score: parseFloat(row.avg_score) || 0
        })),
        state_breakdown: states.rows.map(row => ({
          state: row.state,
          count: parseInt(row.count),
          avg_votes: parseFloat(row.avg_votes) || 0,
          avg_score: parseFloat(row.avg_score) || 0
        })),
        voting_patterns: votingPatterns.rows.map(row => ({
          participation_level: row.participation_level,
          proposal_count: parseInt(row.proposal_count),
          avg_votes: parseFloat(row.avg_votes) || 0,
          avg_score: parseFloat(row.avg_score) || 0
        }))
      };

      return {
        content: [
          {
            type: 'text',
            text: `Governance Participation Analysis for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error analyzing governance participation for ${daoName}:`, error);
      throw error;
    }
  }

  async getTweetLogs(daoName: string, limit: number = 10): Promise<any> {
    try {
      // Get space information
      const spaceQuery = `
        SELECT id, space_id, name
        FROM governance_snapshot_spaces
        WHERE name ILIKE '%${daoName}%' OR space_id ILIKE '%${daoName}%'
        LIMIT 1
      `;

      const spaceResult = await this.db.query(spaceQuery);
      
      if (spaceResult.rows.length === 0) {
        throw new Error(`No governance space found for DAO: ${daoName}`);
      }

      const space = spaceResult.rows[0];

      // Get tweet logs
      const tweetLogsQuery = `
        SELECT 
          tl.tweet_id,
          tl.tweet_text,
          tl.status,
          tl.error_message,
          tl.retry_count,
          tl.posted_at,
          tl.created_at,
          p.title as proposal_title,
          p.proposal_id,
          p.state as proposal_state
        FROM governance_tweet_logs tl
        JOIN governance_snapshot_proposals p ON tl.proposal_id = p.id
        WHERE tl.space_id = $1
        ORDER BY tl.created_at DESC
        LIMIT $2
      `;

      const tweetLogs = await this.db.query(tweetLogsQuery, [space.id, limit]);

      // Get tweet statistics
      const tweetStatsQuery = `
        SELECT 
          status,
          COUNT(*) as count
        FROM governance_tweet_logs
        WHERE space_id = $1
        GROUP BY status
        ORDER BY count DESC
      `;

      const tweetStats = await this.db.query(tweetStatsQuery, [space.id]);

      const results = {
        dao_name: daoName,
        space_info: {
          space_id: space.space_id,
          name: space.name
        },
        tweet_logs: tweetLogs.rows.map(row => ({
          tweet_id: row.tweet_id,
          tweet_text: row.tweet_text,
          status: row.status,
          error_message: row.error_message,
          retry_count: parseInt(row.retry_count) || 0,
          posted_at: row.posted_at,
          created_at: row.created_at,
          proposal: {
            title: row.proposal_title,
            proposal_id: row.proposal_id,
            state: row.proposal_state
          }
        })),
        tweet_statistics: tweetStats.rows.map(row => ({
          status: row.status,
          count: parseInt(row.count)
        }))
      };

      return {
        content: [
          {
            type: 'text',
            text: `Governance Tweet Logs for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting governance tweet logs for ${daoName}:`, error);
      throw error;
    }
  }

  async getBotStatus(daoName: string): Promise<any> {
    try {
      // Get space information
      const spaceQuery = `
        SELECT id, space_id, name
        FROM governance_snapshot_spaces
        WHERE name ILIKE '%${daoName}%' OR space_id ILIKE '%${daoName}%'
        LIMIT 1
      `;

      const spaceResult = await this.db.query(spaceQuery);
      
      if (spaceResult.rows.length === 0) {
        throw new Error(`No governance space found for DAO: ${daoName}`);
      }

      const space = spaceResult.rows[0];

      // Get bot status
      const botStatusQuery = `
        SELECT 
          last_check_at,
          last_proposal_id,
          status,
          error_message,
          proposals_processed,
          tweets_posted,
          created_at,
          updated_at,
          last_historical_import_at
        FROM governance_bot_status
        WHERE space_id = $1
      `;

      const botStatus = await this.db.query(botStatusQuery, [space.id]);

      const results = {
        dao_name: daoName,
        space_info: {
          space_id: space.space_id,
          name: space.name
        },
        bot_status: botStatus.rows.length > 0 ? {
          last_check_at: botStatus.rows[0].last_check_at,
          last_proposal_id: botStatus.rows[0].last_proposal_id,
          status: botStatus.rows[0].status,
          error_message: botStatus.rows[0].error_message,
          proposals_processed: parseInt(botStatus.rows[0].proposals_processed) || 0,
          tweets_posted: parseInt(botStatus.rows[0].tweets_posted) || 0,
          created_at: botStatus.rows[0].created_at,
          updated_at: botStatus.rows[0].updated_at,
          last_historical_import_at: botStatus.rows[0].last_historical_import_at
        } : null
      };

      return {
        content: [
          {
            type: 'text',
            text: `Governance Bot Status for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting governance bot status for ${daoName}:`, error);
      throw error;
    }
  }
} 