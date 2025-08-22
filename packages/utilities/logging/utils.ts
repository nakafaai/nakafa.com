import type { LogContext, Logger } from "./types";

/**
 * Utility functions for enhanced logging functionality
 */

const SERVER_ERROR_CODE = 500;
const CLIENT_ERROR_CODE = 400;

/**
 * Log an HTTP request with structured data
 */
export function logHttpRequest(
  logger: Logger,
  requestData: {
    method: string;
    url: string;
    statusCode: number;
    duration: number;
  }
) {
  const { method, url, statusCode, duration } = requestData;

  let level: "info" | "warn" | "error" = "info";
  if (statusCode >= SERVER_ERROR_CODE) {
    level = "error";
  } else if (statusCode >= CLIENT_ERROR_CODE) {
    level = "warn";
  }

  logger[level](
    {
      type: "http_request",
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
    },
    `${method} ${url} - ${statusCode} (${duration}ms)`
  );
}

/**
 * Log an error with stack trace and additional context
 */
export function logError(
  logger: Logger,
  error: Error,
  context: LogContext = {}
) {
  logger.error(
    {
      type: "error",
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    },
    error.message
  );
}

/**
 * Log a performance metric
 */
export function logMetric(
  logger: Logger,
  metricData: {
    metric: string;
    value: number;
    unit?: string;
    context?: LogContext;
  }
) {
  const { metric, value, unit = "count", context = {} } = metricData;

  logger.info(
    {
      type: "metric",
      metric,
      value,
      unit,
      ...context,
    },
    `${metric}: ${value}${unit}`
  );
}

/**
 * Create a timer function for measuring execution time
 */
export function createTimer(
  logger: Logger,
  label: string,
  context: LogContext = {}
) {
  const start = Date.now();

  return () => {
    const duration = Date.now() - start;
    logger.info(
      {
        type: "timer",
        label,
        duration: `${duration}ms`,
        ...context,
      },
      `${label} completed in ${duration}ms`
    );

    return duration;
  };
}

/**
 * Log database operation with timing
 */
export function logDatabaseOperation(
  logger: Logger,
  operationData: {
    operation: string;
    table: string;
    duration: number;
    rowsAffected?: number;
  }
) {
  const { operation, table, duration, rowsAffected } = operationData;

  logger.debug(
    {
      type: "database_operation",
      operation,
      table,
      duration: `${duration}ms`,
      ...(rowsAffected !== undefined && { rowsAffected }),
    },
    `${operation} ${table} (${duration}ms)${rowsAffected !== undefined ? ` - ${rowsAffected} rows` : ""}`
  );
}

/**
 * Log cache operation (hit/miss)
 */
export function logCacheOperation(
  logger: Logger,
  cacheData: {
    key: string;
    hit: boolean;
    ttl?: number;
  }
) {
  const { key, hit, ttl } = cacheData;

  logger.debug(
    {
      type: "cache_operation",
      key,
      hit,
      ...(ttl !== undefined && { ttl: `${ttl}s` }),
    },
    `Cache ${hit ? "HIT" : "MISS"}: ${key}${ttl !== undefined ? ` (TTL: ${ttl}s)` : ""}`
  );
}
