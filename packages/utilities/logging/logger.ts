import pino from "pino";

export type LoggerConfig = {
  level?: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  pretty?: boolean;
  colorize?: boolean;
  service?: string;
};

/**
 * Creates a logger instance with configurable options
 * @param config Logger configuration options
 * @returns Configured pino logger instance
 */
export function createLogger(config: LoggerConfig = {}) {
  const { level = "info", pretty = true, colorize = true, service } = config;

  const baseConfig: pino.LoggerOptions = {
    level,
    ...(service && { name: service }),
  };

  // Disable pretty logging in production to prevent worker thread issues during builds
  // This maintains your preference for pretty by default in development
  const shouldUsePretty = pretty && process.env.NODE_ENV !== "production";

  if (shouldUsePretty) {
    try {
      return pino({
        ...baseConfig,
        transport: {
          target: "pino-pretty",
          options: {
            colorize,
            translateTime: "yyyy-mm-dd HH:MM:ss",
            ignore: "pid,hostname",
            messageFormat: service ? `[${service}] {msg}` : "{msg}",
          },
        },
      });
    } catch {
      // Fallback to raw JSON if pretty logging fails
      return pino(baseConfig);
    }
  }

  // Raw JSON logger for production or when pretty is disabled
  return pino(baseConfig);
}

/**
 * Default logger instance for immediate use
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
