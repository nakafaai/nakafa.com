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

export type { LoggerConfig } from "@repo/utilities/logging/logger";
export {
  createChildLogger,
  createLogger,
  createServiceLogger,
  logger,
} from "@repo/utilities/logging/logger";

export type {
  LogContext,
  Logger,
  LogLevel,
  LogMethods,
  ServiceLoggerOptions,
} from "@repo/utilities/logging/types";
export {
  createTimer,
  logCacheOperation,
  logDatabaseOperation,
  logError,
  logHttpRequest,
  logMetric,
} from "@repo/utilities/logging/utils";
