/**
 * Header key for request ID tracking.
 * Used for distributed tracing across services.
 */
const REQUEST_ID_HEADER = "X-Request-ID";
const RESERVED_CONTEXT_FIELDS = new Set(["requestId", "userId"]);

type LogLevel = "info" | "warn" | "error" | "debug";

/**
 * Contextual information for log entries.
 * Includes standard fields like requestId/userId and allows custom key-values.
 */
interface LogContext {
  requestId?: string;
  userId?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Structured logger for Convex backend.
 *
 * Provides consistent log formatting with context support (request ID, user ID).
 * Automatically handles object serialization for additional context fields.
 */
class Logger {
  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const prefix = context?.requestId ? `[${context.requestId}]` : "";
    const userId = context?.userId ? ` userId=${context.userId}` : "";
    const additionalContext = Object.entries(context || {})
      .filter(([key]) => !RESERVED_CONTEXT_FIELDS.has(key))
      .map(([key, value]) => ` ${key}=${JSON.stringify(value)}`)
      .join("");

    return `${prefix} [${level.toUpperCase()}]${userId} ${message}${additionalContext}`;
  }

  /**
   * Log an informational message.
   * @param message - The main log message
   * @param context - Optional context (requestId, userId, etc.)
   */
  info(message: string, context?: LogContext): void {
    console.info(this.formatMessage("info", message, context));
  }

  /**
   * Log a warning message.
   * @param message - The warning message
   * @param context - Optional context
   */
  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage("warn", message, context));
  }

  /**
   * Log an error message with optional error object.
   * Handles Error object serialization including stack traces.
   *
   * @param message - The error description
   * @param context - Optional context
   * @param error - The original error object or unknown value
   */
  error(message: string, context?: LogContext, error?: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack : undefined;

    console.error(this.formatMessage("error", message, context));
    if (errorMessage) {
      console.error(`  Error: ${errorMessage}`);
    }
    if (stackTrace) {
      console.error(`  Stack: ${stackTrace}`);
    }
  }

  /**
   * Log a debug message.
   * @param message - The debug message
   * @param context - Optional context
   */
  debug(message: string, context?: LogContext): void {
    console.debug(this.formatMessage("debug", message, context));
  }
}

export const logger = new Logger();

export { REQUEST_ID_HEADER };
