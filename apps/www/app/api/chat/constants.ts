/**
 * Chat API error codes and HTTP status codes.
 * Shared between backend API and frontend for consistent error handling.
 * Error messages are handled by translations in @packages/internationalization/dictionaries/
 */

export const CHAT_ERRORS = {
  INSUFFICIENT_CREDITS: {
    code: "INSUFFICIENT_CREDITS",
    status: 402,
  },
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    status: 401,
  },
  BAD_REQUEST: {
    code: "BAD_REQUEST",
    status: 400,
  },
  RATE_LIMIT: {
    code: "RATE_LIMIT",
    status: 429,
  },
} as const;

export type ChatErrorCode =
  (typeof CHAT_ERRORS)[keyof typeof CHAT_ERRORS]["code"];
