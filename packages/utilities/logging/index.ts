/**
 * Logging utilities for Nakafa project
 *
 * This package provides a comprehensive logging solution using Pino
 * with support for both pretty-printed development logs and raw JSON
 * production logs.
 *
 * Features:
 * - Environment-aware configuration (pretty in dev, raw in prod)
 * - Colorful output with emoji indicators
 * - Service-specific loggers
 * - Child loggers for contextual logging
 * - Utility functions for common logging patterns
 *
 * @example
 * ```typescript
 * import { logger, createServiceLogger } from '@repo/utilities/logging'
 *
 * // Use default logger
 * logger.info('Application started')
 *
 * // Create service-specific logger
 * const apiLogger = createServiceLogger('api')
 * apiLogger.info('API server listening on port 3000')
 * ```
 */

export type { LoggerConfig } from "./logger";
export {
  createChildLogger,
  createDevLogger,
  createLogger,
  createServiceLogger,
  logger,
} from "./logger";

export type {
  LogContext,
  Logger,
  LogLevel,
  LogMethods,
  ServiceLoggerOptions,
} from "./types";
export {
  createTimer,
  logCacheOperation,
  logDatabaseOperation,
  logError,
  logHttpRequest,
  logMetric,
} from "./utils";
