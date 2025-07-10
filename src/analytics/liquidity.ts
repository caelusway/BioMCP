import { DatabaseManager } from '../database/manager.js';
import { Logger } from '../utils/logger.js';
import { subDays, format } from 'date-fns';

export class LiquidityPoolAnalytics {
  private db: DatabaseManager;
  private logger: Logger;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.logger = new Logger('LiquidityPoolAnalytics');
  }

  async getMetrics(daoName: string, poolName?: string, days: number = 30): Promise<any> {
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

      // Get pool snapshots
      let poolQuery = `
        SELECT 
          pool_id,
          pool_name,
          token0_symbol,
          token1_symbol,
          AVG(current_price) as avg_price,
          AVG(tvl_usd) as avg_tvl,
          AVG(volume_24h_usd) as avg_volume_24h,
          AVG(total_positions) as avg_positions,
          AVG(in_range_positions) as avg_in_range_positions,
          AVG(out_of_range_positions) as avg_out_of_range_positions,
          AVG(total_value_usd) as avg_total_value,
          COUNT(*) as snapshot_count
        FROM lp_pool_snapshots
        WHERE timestamp >= $1 AND timestamp <= $2
      `;

      const queryParams: any[] = [startDate, endDate];

      if (poolName) {
        poolQuery += ` AND pool_name ILIKE $3`;
        queryParams.push(`%${poolName}%`);
      }

      poolQuery += ` GROUP BY pool_id, pool_name, token0_symbol, token1_symbol ORDER BY avg_tvl DESC`;

      const poolMetrics = await this.db.query(poolQuery, queryParams);
      
      results.pool_metrics = poolMetrics.rows.map(row => ({
        pool_id: row.pool_id,
        pool_name: row.pool_name,
        token_pair: `${row.token0_symbol}/${row.token1_symbol}`,
        avg_price: parseFloat(row.avg_price) || 0,
        avg_tvl_usd: parseFloat(row.avg_tvl) || 0,
        avg_volume_24h_usd: parseFloat(row.avg_volume_24h) || 0,
        avg_positions: parseFloat(row.avg_positions) || 0,
        avg_in_range_positions: parseFloat(row.avg_in_range_positions) || 0,
        avg_out_of_range_positions: parseFloat(row.avg_out_of_range_positions) || 0,
        avg_total_value_usd: parseFloat(row.avg_total_value) || 0,
        snapshot_count: parseInt(row.snapshot_count)
      }));

      // Get position snapshots
      let positionQuery = `
        SELECT 
          COUNT(*) as total_positions,
          AVG(position_value_usd) as avg_position_value,
          AVG(fees_usd) as avg_fees,
          COUNT(CASE WHEN in_range = true THEN 1 END) as in_range_count,
          COUNT(CASE WHEN in_range = false THEN 1 END) as out_of_range_count
        FROM lp_position_snapshots
        WHERE timestamp >= $1 AND timestamp <= $2
      `;

      const positionParams: any[] = [startDate, endDate];

      if (poolName) {
        positionQuery += ` AND pool_name ILIKE $3`;
        positionParams.push(`%${poolName}%`);
      }

      const positionMetrics = await this.db.query(positionQuery, positionParams);
      const position = positionMetrics.rows[0];

      results.position_metrics = {
        total_positions: parseInt(position.total_positions) || 0,
        avg_position_value_usd: parseFloat(position.avg_position_value) || 0,
        avg_fees_usd: parseFloat(position.avg_fees) || 0,
        in_range_count: parseInt(position.in_range_count) || 0,
        out_of_range_count: parseInt(position.out_of_range_count) || 0,
        in_range_percentage: position.total_positions > 0 ? 
          ((parseInt(position.in_range_count) || 0) / parseInt(position.total_positions) * 100).toFixed(2) : 0
      };

      // Get pool activities
      let activityQuery = `
        SELECT 
          activity_type,
          COUNT(*) as count,
          AVG(usd_value) as avg_value,
          SUM(usd_value) as total_value
        FROM lp_pool_activities
        WHERE timestamp >= $1 AND timestamp <= $2
      `;

      const activityParams: any[] = [startDate, endDate];

      if (poolName) {
        activityQuery += ` AND pool_name ILIKE $3`;
        activityParams.push(`%${poolName}%`);
      }

      activityQuery += ` GROUP BY activity_type ORDER BY count DESC`;

      const activities = await this.db.query(activityQuery, activityParams);
      results.pool_activities = activities.rows.map(row => ({
        activity_type: row.activity_type,
        count: parseInt(row.count),
        avg_value_usd: parseFloat(row.avg_value) || 0,
        total_value_usd: parseFloat(row.total_value) || 0
      }));

      // Get treasury transactions
      let treasuryQuery = `
        SELECT 
          transaction_type,
          COUNT(*) as count,
          AVG(amount) as avg_amount,
          SUM(amount) as total_amount,
          token_symbol
        FROM lp_treasury_transactions
        WHERE timestamp >= $1 AND timestamp <= $2
      `;

      const treasuryParams: any[] = [startDate, endDate];

      if (daoName) {
        treasuryQuery += ` AND dao_name ILIKE $3`;
        treasuryParams.push(`%${daoName}%`);
      }

      treasuryQuery += ` GROUP BY transaction_type, token_symbol ORDER BY count DESC`;

      const treasury = await this.db.query(treasuryQuery, treasuryParams);
      results.treasury_transactions = treasury.rows.map(row => ({
        transaction_type: row.transaction_type,
        token_symbol: row.token_symbol,
        count: parseInt(row.count),
        avg_amount: parseFloat(row.avg_amount) || 0,
        total_amount: parseFloat(row.total_amount) || 0
      }));

      // Get token prices
      const tokenPricesQuery = `
        SELECT 
          symbol,
          AVG(price_usd) as avg_price,
          MIN(price_usd) as min_price,
          MAX(price_usd) as max_price,
          COUNT(*) as price_points
        FROM lp_token_prices
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY symbol
        ORDER BY avg_price DESC
      `;

      const tokenPrices = await this.db.query(tokenPricesQuery, [startDate, endDate]);
      results.token_prices = tokenPrices.rows.map(row => ({
        symbol: row.symbol,
        avg_price_usd: parseFloat(row.avg_price) || 0,
        min_price_usd: parseFloat(row.min_price) || 0,
        max_price_usd: parseFloat(row.max_price) || 0,
        price_points: parseInt(row.price_points),
        volatility: row.max_price && row.min_price ? 
          (((parseFloat(row.max_price) - parseFloat(row.min_price)) / parseFloat(row.min_price)) * 100).toFixed(2) : 0
      }));

      // Get balance snapshots
      let balanceQuery = `
        SELECT 
          token_symbol,
          AVG(balance) as avg_balance,
          AVG(balance_usd) as avg_balance_usd,
          COUNT(*) as snapshot_count
        FROM lp_balance_snapshots
        WHERE timestamp >= $1 AND timestamp <= $2
      `;

      const balanceParams: any[] = [startDate, endDate];

      if (daoName) {
        balanceQuery += ` AND dao_name ILIKE $3`;
        balanceParams.push(`%${daoName}%`);
      }

      balanceQuery += ` GROUP BY token_symbol ORDER BY avg_balance_usd DESC`;

      const balances = await this.db.query(balanceQuery, balanceParams);
      results.balance_snapshots = balances.rows.map(row => ({
        token_symbol: row.token_symbol,
        avg_balance: parseFloat(row.avg_balance) || 0,
        avg_balance_usd: parseFloat(row.avg_balance_usd) || 0,
        snapshot_count: parseInt(row.snapshot_count)
      }));

      return {
        content: [
          {
            type: 'text',
            text: `Liquidity Pool Analytics for ${daoName}${poolName ? ` - ${poolName}` : ''}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting liquidity metrics for ${daoName}:`, error);
      throw error;
    }
  }

  async getHistoricalTVL(daoName: string, poolName?: string, days: number = 30): Promise<any> {
    try {
      const startDate = subDays(new Date(), days);
      const endDate = new Date();

      let tvlQuery = `
        SELECT 
          DATE(timestamp) as date,
          pool_name,
          AVG(tvl_usd) as avg_tvl,
          AVG(volume_24h_usd) as avg_volume,
          AVG(current_price) as avg_price
        FROM lp_pool_snapshots
        WHERE timestamp >= $1 AND timestamp <= $2
      `;

      const queryParams: any[] = [startDate, endDate];

      if (poolName) {
        tvlQuery += ` AND pool_name ILIKE $3`;
        queryParams.push(`%${poolName}%`);
      }

      tvlQuery += ` GROUP BY DATE(timestamp), pool_name ORDER BY date, pool_name`;

      const tvlData = await this.db.query(tvlQuery, queryParams);
      
      const results = {
        dao_name: daoName,
        pool_name: poolName || 'All Pools',
        period: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
          days: days
        },
        historical_tvl: tvlData.rows.map(row => ({
          date: format(new Date(row.date), 'yyyy-MM-dd'),
          pool_name: row.pool_name,
          avg_tvl_usd: parseFloat(row.avg_tvl) || 0,
          avg_volume_usd: parseFloat(row.avg_volume) || 0,
          avg_price: parseFloat(row.avg_price) || 0
        }))
      };

      return {
        content: [
          {
            type: 'text',
            text: `Historical TVL Analysis for ${daoName}${poolName ? ` - ${poolName}` : ''}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting historical TVL for ${daoName}:`, error);
      throw error;
    }
  }

  async getAlerts(daoName: string, days: number = 7): Promise<any> {
    try {
      const startDate = subDays(new Date(), days);
      const endDate = new Date();

      const alertsQuery = `
        SELECT 
          level,
          title,
          message,
          context,
          timestamp,
          source
        FROM lp_alerts
        WHERE timestamp >= $1 AND timestamp <= $2
        ORDER BY timestamp DESC
      `;

      const alerts = await this.db.query(alertsQuery, [startDate, endDate]);
      
      // Group alerts by level
      const alertsByLevel = alerts.rows.reduce((acc: any, alert: any) => {
        if (!acc[alert.level]) {
          acc[alert.level] = [];
        }
        acc[alert.level].push({
          title: alert.title,
          message: alert.message,
          context: alert.context,
          timestamp: alert.timestamp,
          source: alert.source
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
        alerts_summary: {
          total_alerts: alerts.rows.length,
          critical_alerts: (alertsByLevel.critical || []).length,
          warning_alerts: (alertsByLevel.warning || []).length,
          info_alerts: (alertsByLevel.info || []).length
        },
        alerts_by_level: alertsByLevel
      };

      return {
        content: [
          {
            type: 'text',
            text: `Liquidity Pool Alerts for ${daoName}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting liquidity alerts for ${daoName}:`, error);
      throw error;
    }
  }

  async getPoolVolumes(daoName: string, poolName?: string, days: number = 30): Promise<any> {
    try {
      const startDate = subDays(new Date(), days);
      const endDate = new Date();

      let volumeQuery = `
        SELECT 
          pool_name,
          date,
          volume_usd,
          volume_base,
          trades_count,
          source
        FROM lp_pool_volumes
        WHERE date >= $1 AND date <= $2
      `;

      const queryParams: any[] = [startDate, endDate];

      if (poolName) {
        volumeQuery += ` AND pool_name ILIKE $3`;
        queryParams.push(`%${poolName}%`);
      }

      volumeQuery += ` ORDER BY date DESC, pool_name`;

      const volumes = await this.db.query(volumeQuery, queryParams);
      
      const results = {
        dao_name: daoName,
        pool_name: poolName || 'All Pools',
        period: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
          days: days
        },
        volume_data: volumes.rows.map(row => ({
          pool_name: row.pool_name,
          date: format(new Date(row.date), 'yyyy-MM-dd'),
          volume_usd: parseFloat(row.volume_usd) || 0,
          volume_base: parseFloat(row.volume_base) || 0,
          trades_count: parseInt(row.trades_count) || 0,
          source: row.source
        })),
        volume_summary: {
          total_volume_usd: volumes.rows.reduce((sum, row) => sum + (parseFloat(row.volume_usd) || 0), 0),
          total_trades: volumes.rows.reduce((sum, row) => sum + (parseInt(row.trades_count) || 0), 0),
          avg_daily_volume: volumes.rows.length > 0 ? 
            volumes.rows.reduce((sum, row) => sum + (parseFloat(row.volume_usd) || 0), 0) / volumes.rows.length : 0
        }
      };

      return {
        content: [
          {
            type: 'text',
            text: `Pool Volume Analysis for ${daoName}${poolName ? ` - ${poolName}` : ''}\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Error getting pool volumes for ${daoName}:`, error);
      throw error;
    }
  }
} 