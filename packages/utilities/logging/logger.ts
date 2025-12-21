import pino from "pino";

export interface LoggerConfig {
  level?: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  service?: string;
}

/**
 * Creates a logger instance with configurable options
 * @param config Logger configuration options
 * @returns Configured pino logger instance
 */
export function createLogger(config: LoggerConfig = {}) {
  const { level = "info", service } = config;

  return pino({
    level,
    ...(service && { name: service }),
  });
}

/**
 * Default logger instance for immediate use
 * Uses JSON logging in both development and production
 */
export const logger = createLogger();

/**
 * Create a child logger with additional context
 * @param context Additional context to include in all logs
 * @returns Child logger instance
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Create a service-specific logger
 * @param serviceName Name of the service
 * @param config Additional logger configuration
 * @returns Service-specific logger instance
 */
export function createServiceLogger(
  serviceName: string,
  config: Omit<LoggerConfig, "service"> = {}
) {
  return createLogger({ ...config, service: serviceName });
}
