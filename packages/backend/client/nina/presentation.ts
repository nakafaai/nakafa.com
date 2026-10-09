import { Schema } from "effect";

export const DEFAULT_TITLE = "New Chat";
export const MAX_TITLE_LENGTH = 80;

export const NinaTitle = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(MAX_TITLE_LENGTH)
);

export const NINA_MESSAGES_PAGE_SIZE = 50;
