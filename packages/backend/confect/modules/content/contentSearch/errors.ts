import { Schema } from "effect";

export class ContentSearchInputError extends Schema.TaggedError<ContentSearchInputError>()(
  "ContentSearchInputError",
  { message: Schema.String }
) {}

export class ContentSyncBatchSizeError extends Schema.TaggedError<ContentSyncBatchSizeError>()(
  "ContentSyncBatchSizeError",
  { message: Schema.String }
) {}
