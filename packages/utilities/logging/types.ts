import type { Logger as PinoLogger } from "pino";

export type Logger = PinoLogger;

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  [key: string]: unknown;
}

export interface ServiceLoggerOptions {
  colorize?: boolean;
  level?: LogLevel;
  pretty?: boolean;
}

export interface LogMethods {
  debug: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
  fatal: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  trace: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
}
