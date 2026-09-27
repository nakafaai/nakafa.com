/** Public path prefix for server-bound forum attachment uploads. */
export const FORUM_ATTACHMENT_UPLOAD_PATH_PREFIX =
  "/internal/forum-attachments/upload";

/** Maximum lifetime of one unused forum attachment upload capability. */
export const FORUM_PENDING_UPLOAD_EXPIRATION_MS = 2 * 60 * 60 * 1000;

/**
 * Keeps one upload capability exclusive for the maximum action runtime.
 *
 * @see https://docs.convex.dev/production/state/limits#execution-time-and-scheduling
 */
export const FORUM_PENDING_UPLOAD_LEASE_MS = 30 * 60 * 1000;
