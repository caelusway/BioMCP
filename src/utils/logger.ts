export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private context: string;
  private logLevel: LogLevel;
  private isMCPMode: boolean;

  constructor(context: string, logLevel: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.logLevel = parseInt(process.env.LOG_LEVEL || '1');
    
    // Detect if running in MCP mode (when stdin/stdout are used for MCP protocol)
    // Disable all logging in MCP mode for protocol compliance
    this.isMCPMode = !process.stdin.isTTY || process.env.MCP_MODE === 'true';
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [${level}] [${this.context}] ${message}`;
    
    if (data) {
      return `${baseMessage} ${JSON.stringify(data)}`;
    }
    
    return baseMessage;
  }

  debug(message: string, data?: any): void {
    if (this.isMCPMode) return; // Silent in MCP mode
    
    if (this.logLevel <= LogLevel.DEBUG) {
      // Output to stderr for MCP protocol compliance
      process.stderr.write(this.formatMessage('DEBUG', message, data) + '\n');
    }
  }

  info(message: string, data?: any): void {
    if (this.isMCPMode) return; // Silent in MCP mode
    
    if (this.logLevel <= LogLevel.INFO) {
      // Output to stderr for MCP protocol compliance
      process.stderr.write(this.formatMessage('INFO', message, data) + '\n');
    }
  }

  warn(message: string, data?: any): void {
    if (this.isMCPMode) return; // Silent in MCP mode
    
    if (this.logLevel <= LogLevel.WARN) {
      // Output to stderr for MCP protocol compliance
      process.stderr.write(this.formatMessage('WARN', message, data) + '\n');
    }
  }

  error(message: string, error?: any): void {
    if (this.isMCPMode) return; // Silent in MCP mode
    
    if (this.logLevel <= LogLevel.ERROR) {
      const errorMessage = error instanceof Error ? error.message : error;
      const stack = error instanceof Error ? error.stack : undefined;
      
      // Output to stderr for MCP protocol compliance
      process.stderr.write(this.formatMessage('ERROR', message, { error: errorMessage, stack }) + '\n');
    }
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  // Allow manual override for testing
  setMCPMode(enabled: boolean): void {
    this.isMCPMode = enabled;
  }
} 