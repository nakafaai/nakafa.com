import type { SchoolClassForumTag } from "@repo/backend/convex/classes/schema";

/** Minimum non-whitespace length for new forum titles and bodies. */
export const MIN_FORUM_THREAD_TEXT_LENGTH = 3;

export const DEFAULT_FORUM_POST_WINDOW = 15;
export const MAX_FORUM_POST_WINDOW = 50;
export const MAX_FORUM_POST_ATTACHMENTS = 10;
export const MAX_FORUM_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_FORUM_POST_MENTIONS = 20;
export const MAX_FORUM_REACTION_VARIANTS = 20;
export const MAX_FORUM_REACTION_VALUE_LENGTH = 32;
export const FORUM_REACTION_PREVIEW_LIMIT = 10;
export const FORUM_REACTION_PREVIEW_BATCH_LIMIT = 20;
export const FORUM_SAME_TIMESTAMP_POST_LIMIT = 200;
export const FORUM_UNREAD_SCAN_LIMIT = 200;
export const FORUM_UNREAD_COUNT_LIMIT = 26;

/** Tags that students are allowed to create directly. */
export const STUDENT_FORUM_TAGS = [
  "general",
  "question",
] as const satisfies SchoolClassForumTag[];

/** Non-image mime types supported for forum attachments. */
export const FORUM_ATTACHMENT_ALLOWED_MIME_TYPES = [
  "application/msword",
  "application/octet-stream",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

/** File extensions supported when browsers fall back to octet-stream. */
export const FORUM_ATTACHMENT_ALLOWED_EXTENSIONS = [
  ".doc",
  ".docx",
  ".pdf",
  ".txt",
] as const;
