import { Logger } from "effect";

/**
 * Writes script progress to standard output and warnings and failures to
 * standard error, so a caller that keeps only the error stream still sees why
 * a run failed.
 */
export const IndexingLogger = Logger.layer([
  Logger.withLeveledConsole(Logger.formatSimple),
]);
