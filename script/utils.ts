/**
 * Utility functions for scripts
 */

/**
 * Color-coded logger for console output
 */
export const logger = {
  // Colors and styles
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",

  // Foreground colors
  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    crimson: "\x1b[38m",
  },

  // Background colors
  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m",
    crimson: "\x1b[48m",
  },

  // Log methods
  info: (message: string): void => {
    // biome-ignore lint/suspicious/noConsole: For logging
    console.info(
      `${logger.fg.blue}${logger.bright}ℹ INFO:${logger.reset} ${message}`
    );
  },

  success: (message: string): void => {
    // biome-ignore lint/suspicious/noConsole: For logging
    console.info(
      `${logger.fg.green}${logger.bright}✓ SUCCESS:${logger.reset} ${message}`
    );
  },

  warn: (message: string): void => {
    // biome-ignore lint/suspicious/noConsole: For logging
    console.warn(
      `${logger.fg.yellow}${logger.bright}⚠ WARNING:${logger.reset} ${message}`
    );
  },

  error: (message: string): void => {
    // biome-ignore lint/suspicious/noConsole: For logging
    console.error(
      `${logger.fg.red}${logger.bright}✗ ERROR:${logger.reset} ${message}`
    );
  },

  header: (message: string): void => {
    // biome-ignore lint/suspicious/noConsole: For logging
    console.info(
      `\n${logger.fg.cyan}${logger.bright}═══════════════════════════════════════════════════════════════════${logger.reset}`
    );
    // biome-ignore lint/suspicious/noConsole: For logging
    console.info(
      `${logger.fg.cyan}${logger.bright}  ${message}${logger.reset}`
    );
    // biome-ignore lint/suspicious/noConsole: For logging
    console.info(
      `${logger.fg.cyan}${logger.bright}═══════════════════════════════════════════════════════════════════${logger.reset}\n`
    );
  },

  stats: (label: string, value: string | number): void => {
    // biome-ignore lint/suspicious/noConsole: For logging
    console.info(
      `${logger.fg.magenta}${logger.bright}▸ ${label}:${logger.reset} ${value}`
    );
  },

  progress: (current: number, total: number, label: string): void => {
    const percentage = Math.round((current / total) * 100);
    // biome-ignore lint/suspicious/noConsole: For logging
    console.info(
      `${logger.fg.cyan}${logger.bright}▸ ${label}:${logger.reset} ${current}/${total} (${percentage}%)`
    );
  },
};
