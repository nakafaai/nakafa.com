import type { Logger as PinoLogger } from "pino";

export type Logger = PinoLogger;

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LogContext = {
  [key: string]: unknown;
};

export type ServiceLoggerOptions = {
  level?: LogLevel;
  pretty?: boolean;
  colorize?: boolean;
};

export type LogMethods = {
  trace: (msg: string, ...args: unknown[]) => void;
  debug: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
  fatal: (msg: string, ...args: unknown[]) => void;
};
