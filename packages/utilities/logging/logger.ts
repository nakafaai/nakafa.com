import pino from "pino";
import pinoPretty from "pino-pretty";

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

  // Only use pretty logging in development and when explicitly enabled
  const isDevelopment = process.env.NODE_ENV === "development";
  const shouldUsePretty = pretty && isDevelopment;

  if (shouldUsePretty) {
    try {
      // Use pino-pretty directly as a stream to avoid worker thread issues
      const prettyStream = pinoPretty({
        colorize,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
        messageFormat: service ? `[${service}] {msg}` : undefined,
        singleLine: false,
        hideObject: false,
      });

      return pino(baseConfig, prettyStream);
    } catch {
      // If pino-pretty fails, fallback to simple JSON logging
      return pino(baseConfig);
    }
  }

  // Raw JSON logger for production or when pretty is disabled
  return pino(baseConfig);
}

/**
 * Create a development-friendly logger that avoids worker thread issues
 * @param config Logger configuration options
 * @returns Logger instance optimized for development
 */
export function createDevLogger(config: LoggerConfig = {}) {
  const { level = "info", service } = config;

  // Simple development logger that doesn't use worker threads
  return pino({
    level,
    ...(service && { name: service }),
    // Use destination directly to avoid transport worker threads
    ...(process.env.NODE_ENV === "development" && {
      formatters: {
        level: (label) => ({ level: label }),
        log: (object) => object,
      },
    }),
  });
}

/**
 * Default logger instance for immediate use
 * Uses development-friendly configuration to prevent worker thread issues
 */
export const logger =
  process.env.NODE_ENV === "development"
    ? createDevLogger()
    : createLogger({ pretty: false });

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
  config: Omit<LoggerConfig, "service"> = {},
) {
  return createLogger({ ...config, service: serviceName });
}
