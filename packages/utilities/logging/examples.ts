/**
 * Usage examples for the logging utilities
 *
 * This file demonstrates various ways to use the logging utilities
 * across different scenarios and applications.
 */

import {
  createChildLogger,
  createLogger,
  createServiceLogger,
  createTimer,
  logCacheOperation,
  logDatabaseOperation,
  logError,
  logger,
  logHttpRequest,
  logMetric,
} from "./index";

// Constants for example values
const EXAMPLE_PORT = 3000;
const SUCCESS_STATUS = 200;
const UNAUTHORIZED_STATUS = 401;
const SERVER_ERROR_STATUS = 500;
const RESPONSE_TIME_MS = 45;
const SLOW_RESPONSE_TIME_MS = 120;
const ERROR_RESPONSE_TIME_MS = 2500;
const MEMORY_USAGE_MB = 512;
const ACTIVE_CONNECTIONS = 42;
const CACHE_HIT_RATIO = 0.85;
const SIMULATION_DELAY_MS = 100;
const SELECT_DURATION_MS = 45;
const AFFECTED_ROWS = 150;
const INSERT_DURATION_MS = 12;
const SINGLE_ROW = 1;
const UPDATE_DURATION_MS = 78;
const UPDATED_ROWS = 5;
const DELETE_DURATION_MS = 23;
const DELETED_ROWS = 12;
const CACHE_TTL_SECONDS = 3600;
const SESSION_TTL_SECONDS = 1800;
const METRIC_VALUE_MS = 250;
const AUTH_DELAY_MS = 50;
const QUERY_DELAY_MS = 75;
const TOTAL_RESPONSE_TIME_MS = 150;

/**
 * Example 1: Basic logging with default logger
 */
export function basicLoggingExample() {
  logger.trace("This is a trace message");
  logger.debug("This is a debug message");
  logger.info("This is an info message");
  logger.warn("This is a warning message");
  logger.error("This is an error message");
  logger.fatal("This is a fatal message");
}

/**
 * Example 2: Service-specific logger
 */
export function serviceLoggerExample() {
  // Create loggers for different services
  const apiLogger = createServiceLogger("api");
  const dbLogger = createServiceLogger("database");
  const cacheLogger = createServiceLogger("cache", { level: "debug" });

  apiLogger.info(`API server started on port ${EXAMPLE_PORT}`);
  dbLogger.info("Connected to PostgreSQL database");
  cacheLogger.debug("Redis connection established");
}

/**
 * Example 3: Child logger with context
 */
export function childLoggerExample() {
  const requestLogger = createChildLogger({
    requestId: "req-123",
    userId: "user-456",
    traceId: "trace-789",
  });

  requestLogger.info("Processing user request");
  requestLogger.warn("Rate limit approaching");
  requestLogger.info("Request completed successfully");
}

/**
 * Example 4: HTTP request logging
 */
export function httpRequestLoggingExample() {
  const apiLogger = createServiceLogger("api");

  // Log successful request
  logHttpRequest(apiLogger, {
    method: "GET",
    url: "/api/users",
    statusCode: SUCCESS_STATUS,
    duration: RESPONSE_TIME_MS,
  });

  // Log client error
  logHttpRequest(apiLogger, {
    method: "POST",
    url: "/api/login",
    statusCode: UNAUTHORIZED_STATUS,
    duration: SLOW_RESPONSE_TIME_MS,
  });

  // Log server error
  logHttpRequest(apiLogger, {
    method: "GET",
    url: "/api/data",
    statusCode: SERVER_ERROR_STATUS,
    duration: ERROR_RESPONSE_TIME_MS,
  });
}

/**
 * Example 5: Error logging with context
 */
export function errorLoggingExample() {
  const appLogger = createServiceLogger("app");

  try {
    throw new Error("Something went wrong!");
  } catch (error) {
    logError(appLogger, error as Error, {
      userId: "user-123",
      action: "fetch_user_data",
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Example 6: Performance metrics logging
 */
export function metricsLoggingExample() {
  const metricsLogger = createServiceLogger("metrics");

  logMetric(metricsLogger, {
    metric: "response_time",
    value: METRIC_VALUE_MS,
    unit: "ms",
    context: { endpoint: "/api/users" },
  });

  logMetric(metricsLogger, {
    metric: "memory_usage",
    value: MEMORY_USAGE_MB,
    unit: "MB",
  });

  logMetric(metricsLogger, {
    metric: "active_connections",
    value: ACTIVE_CONNECTIONS,
    unit: "count",
  });

  logMetric(metricsLogger, {
    metric: "cache_hit_ratio",
    value: CACHE_HIT_RATIO,
    unit: "ratio",
    context: { cache_type: "redis" },
  });
}

/**
 * Example 7: Timer usage for measuring execution time
 */
export async function timerExample() {
  const perfLogger = createServiceLogger("performance");

  const endTimer = createTimer(perfLogger, "database_query", {
    query: "SELECT * FROM users",
    table: "users",
  });

  // Simulate async operation
  await new Promise((resolve) => setTimeout(resolve, SIMULATION_DELAY_MS));

  const duration = endTimer(); // Logs the execution time
  return duration;
}

/**
 * Example 8: Database operation logging
 */
export function databaseLoggingExample() {
  const dbLogger = createServiceLogger("database");

  logDatabaseOperation(dbLogger, {
    operation: "SELECT",
    table: "users",
    duration: SELECT_DURATION_MS,
    rowsAffected: AFFECTED_ROWS,
  });

  logDatabaseOperation(dbLogger, {
    operation: "INSERT",
    table: "orders",
    duration: INSERT_DURATION_MS,
    rowsAffected: SINGLE_ROW,
  });

  logDatabaseOperation(dbLogger, {
    operation: "UPDATE",
    table: "products",
    duration: UPDATE_DURATION_MS,
    rowsAffected: UPDATED_ROWS,
  });

  logDatabaseOperation(dbLogger, {
    operation: "DELETE",
    table: "sessions",
    duration: DELETE_DURATION_MS,
    rowsAffected: DELETED_ROWS,
  });
}

/**
 * Example 9: Cache operation logging
 */
export function cacheLoggingExample() {
  const cacheLogger = createServiceLogger("cache");

  logCacheOperation(cacheLogger, {
    key: "user:123",
    hit: true,
    ttl: CACHE_TTL_SECONDS,
  });

  logCacheOperation(cacheLogger, {
    key: "product:456",
    hit: false,
  });

  logCacheOperation(cacheLogger, {
    key: "session:789",
    hit: true,
    ttl: SESSION_TTL_SECONDS,
  });
}

/**
 * Example 10: Custom logger configuration
 */
export function customLoggerExample() {
  // Logger with custom configuration for testing
  const testLogger = createLogger({
    level: "debug",
    pretty: true,
    colorize: true,
    service: "test-runner",
  });

  // Logger for production-like environment
  const prodLogger = createLogger({
    level: "warn",
    pretty: false,
    colorize: false,
    service: "production-app",
  });

  testLogger.debug("This is a debug message in test mode");
  prodLogger.warn("This is a warning in production mode");
}

/**
 * Example 11: Complex application workflow
 */
export async function complexWorkflowExample() {
  // Create different loggers for different parts of the application
  const authLogger = createServiceLogger("auth");
  const apiLogger = createServiceLogger("api");
  const dbLogger = createServiceLogger("database");

  // Start request processing
  const requestContext = { requestId: "req-001", userId: "user-123" };
  const requestLogger = createChildLogger(requestContext);

  requestLogger.info("Starting request processing");

  // Authentication
  const authTimer = createTimer(
    authLogger,
    "user_authentication",
    requestContext
  );
  await new Promise((resolve) => setTimeout(resolve, AUTH_DELAY_MS));
  authTimer();

  // Database query
  const queryTimer = createTimer(dbLogger, "user_data_query", requestContext);
  await new Promise((resolve) => setTimeout(resolve, QUERY_DELAY_MS));
  const queryDuration = queryTimer();

  logDatabaseOperation(dbLogger, {
    operation: "SELECT",
    table: "users",
    duration: queryDuration,
    rowsAffected: SINGLE_ROW,
  });

  // API response
  logHttpRequest(apiLogger, {
    method: "GET",
    url: "/api/profile",
    statusCode: SUCCESS_STATUS,
    duration: TOTAL_RESPONSE_TIME_MS,
  });

  requestLogger.info("Request processing completed");
}
