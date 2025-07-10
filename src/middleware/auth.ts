import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.js';

interface AuthConfig {
  enableAuth: boolean;
  teamApiKey: string;
  allowedUsers: string[];
  sessionTimeout: number;
  corsOrigins: string[];
}

interface UserSession {
  userId: string;
  expiresAt: Date;
  permissions: string[];
}

export class AuthManager {
  private config: AuthConfig;
  private logger: Logger;
  private activeSessions = new Map<string, UserSession>();

  constructor() {
    this.logger = new Logger('AuthManager');
    this.config = {
      enableAuth: process.env.ENABLE_AUTH === 'true',
      teamApiKey: process.env.TEAM_API_KEY || '',
      allowedUsers: process.env.ALLOWED_USERS?.split(',') || [],
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600'),
      corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*']
    };

    this.logger.info(`Authentication ${this.config.enableAuth ? 'enabled' : 'disabled'}`);
    if (this.config.enableAuth) {
      this.logger.info(`Allowed users: ${this.config.allowedUsers.length}`);
      this.logger.info(`Session timeout: ${this.config.sessionTimeout}s`);
    }
  }

  // CORS middleware for MCP requests
  corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    
    if (this.config.corsOrigins.includes('*') || 
        (origin && this.config.corsOrigins.includes(origin))) {
      res.header('Access-Control-Allow-Origin', origin || '*');
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, MCP-Session-ID');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    
    next();
  };

  // API Key validation middleware
  validateApiKey = (req: Request, res: Response, next: NextFunction) => {
    if (!this.config.enableAuth) {
      return next();
    }

    const apiKey = req.headers['x-api-key'] || 
                   req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey || apiKey !== this.config.teamApiKey) {
      this.logger.warn(`Invalid API key attempt from ${req.ip}`);
      return res.status(401).json({ 
        error: 'Unauthorized: Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }

    this.logger.info(`API access granted for ${req.ip}`);
    next();
  };

  // User validation
  validateUser = (userId: string): boolean => {
    if (!this.config.enableAuth) return true;
    return this.config.allowedUsers.includes(userId);
  };

  // Session management
  createSession(userId: string, permissions: string[] = ['read']): string {
    if (!this.validateUser(userId)) {
      throw new Error('User not authorized');
    }

    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + this.config.sessionTimeout * 1000);
    
    this.activeSessions.set(sessionId, { 
      userId, 
      expiresAt, 
      permissions 
    });
    
    this.logger.info(`Session created for user: ${userId}`);
    return sessionId;
  }

  validateSession(sessionId: string): string | null {
    if (!sessionId || !this.config.enableAuth) return null;

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.expiresAt < new Date()) {
      this.activeSessions.delete(sessionId);
      this.logger.info(`Session expired for user: ${session.userId}`);
      return null;
    }

    // Extend session
    session.expiresAt = new Date(Date.now() + this.config.sessionTimeout * 1000);
    return session.userId;
  }

  // Session middleware for MCP requests
  sessionMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (!this.config.enableAuth) {
      return next();
    }

    const sessionId = req.headers['mcp-session-id'] as string;
    if (!sessionId) {
      return res.status(401).json({ 
        error: 'Unauthorized: No session ID',
        code: 'NO_SESSION'
      });
    }

    const userId = this.validateSession(sessionId);
    if (!userId) {
      return res.status(401).json({ 
        error: 'Unauthorized: Invalid or expired session',
        code: 'INVALID_SESSION'
      });
    }

    // Add user info to request
    (req as any).user = { userId };
    next();
  };

  // Rate limiting middleware
  rateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Simple rate limiting - can be enhanced with Redis
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100;

    if (!this.rateLimitStore) {
      this.rateLimitStore = new Map();
    }

    const clientRequests = this.rateLimitStore.get(clientId) || [];
    const recentRequests = clientRequests.filter((time: number) => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((windowMs - (now - recentRequests[0])) / 1000)
      });
    }

    recentRequests.push(now);
    this.rateLimitStore.set(clientId, recentRequests);
    next();
  };

  private rateLimitStore?: Map<string, number[]>;

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  // Authentication stats
  getStats() {
    return {
      authEnabled: this.config.enableAuth,
      activeSessions: this.activeSessions.size,
      allowedUsers: this.config.allowedUsers.length,
      sessionTimeout: this.config.sessionTimeout
    };
  }

  // Clean up expired sessions
  cleanup() {
    const now = new Date();
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.expiresAt < now) {
        this.activeSessions.delete(sessionId);
      }
    }
  }
}

export default AuthManager; 