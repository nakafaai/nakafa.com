import type { MessageNamespace } from "@repo/internationalization/src/namespace";

/**
 * The messages of the student shell that every learn and app page renders around
 * its own messages: the header and its search command, the AI sheet, the sidebar,
 * and the account and consent parts of the sidebar. The locale route carries only
 * the messages of every page, so each layout that mounts the shell loads these.
 */
export const SHELL_MESSAGE_NAMESPACES = [
  "AnalyticsConsent",
  "Ai",
  "Articles",
  "Auth",
  "Holy",
  "Home",
  "Legal",
  "Metadata",
  "Notifications",
  "Utils",
] as const satisfies readonly MessageNamespace[];
