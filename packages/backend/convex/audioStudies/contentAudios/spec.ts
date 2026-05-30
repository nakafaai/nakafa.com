import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import tables from "@repo/backend/convex/audioStudies/schema";
import { audioContentRefValidator } from "@repo/backend/convex/lib/validators/audio";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { type Infer, v } from "convex/values";
import { Schema } from "effect";

export const contentAudioIoFailedCode = "CONTENT_AUDIO_IO_FAILED";
export const contentAudioNotFoundCode = "CONTENT_AUDIO_NOT_FOUND";
export const contentAudioDuplicateLimitExceededCode =
  "CONTENT_AUDIO_DUPLICATE_LIMIT_EXCEEDED";

export const contentAudioRecordValidator = tables.contentAudios.validator;

export const contentAudioIdArgs = {
  contentAudioId: vv.id("contentAudios"),
};
export const contentAudioIdArgsValidator = v.object(contentAudioIdArgs);

export const saveAudioScriptArgs = {
  ...contentAudioIdArgs,
  script: v.string(),
};
export const saveAudioScriptArgsValidator = v.object(saveAudioScriptArgs);

export const saveGeneratedAudioArgs = {
  ...contentAudioIdArgs,
  storageId: v.id("_storage"),
  duration: v.number(),
  size: v.number(),
};
export const saveGeneratedAudioArgsValidator = v.object(saveGeneratedAudioArgs);

export const markContentAudioFailedArgs = {
  ...contentAudioIdArgs,
  error: v.string(),
};
export const markContentAudioFailedArgsValidator = v.object(
  markContentAudioFailedArgs
);

export const updateContentAudioHashArgs = {
  contentRef: audioContentRefValidator,
  newHash: v.string(),
};
export const updateContentAudioHashArgsValidator = v.object(
  updateContentAudioHashArgs
);

export const createOrGetContentAudioArgs = {
  contentRef: audioContentRefValidator,
  locale: localeValidator,
  contentHash: v.string(),
};
export const createOrGetContentAudioArgsValidator = v.object(
  createOrGetContentAudioArgs
);

export type ContentAudioRecord = Doc<"contentAudios">;
export type ContentAudioIdArgs = Infer<typeof contentAudioIdArgsValidator>;
export type SaveAudioScriptArgs = Infer<typeof saveAudioScriptArgsValidator>;
export type SaveGeneratedAudioArgs = Infer<
  typeof saveGeneratedAudioArgsValidator
>;
export type MarkContentAudioFailedArgs = Infer<
  typeof markContentAudioFailedArgsValidator
>;
export type UpdateContentAudioHashArgs = Infer<
  typeof updateContentAudioHashArgsValidator
>;
export type CreateOrGetContentAudioArgs = Infer<
  typeof createOrGetContentAudioArgsValidator
>;

/** Raised when a content-audio row cannot be found for a workflow step. */
export class ContentAudioNotFoundError extends Schema.TaggedError<ContentAudioNotFoundError>()(
  "ContentAudioNotFoundError",
  {
    code: Schema.Literal(contentAudioNotFoundCode),
    message: Schema.String,
  }
) {}

/** Raised when duplicate content-audio rows exceed the repair limit. */
export class ContentAudioDuplicateLimitExceededError extends Schema.TaggedError<ContentAudioDuplicateLimitExceededError>()(
  "ContentAudioDuplicateLimitExceededError",
  {
    code: Schema.Literal(contentAudioDuplicateLimitExceededCode),
    message: Schema.String,
  }
) {}

/** Raised when Convex storage or database IO fails in content-audio mutations. */
export class ContentAudioIoError extends Schema.TaggedError<ContentAudioIoError>()(
  "ContentAudioIoError",
  {
    code: Schema.Literal(contentAudioIoFailedCode),
    message: Schema.String,
  }
) {}

export type ContentAudioMutationError =
  | ContentAudioDuplicateLimitExceededError
  | ContentAudioIoError
  | ContentAudioNotFoundError;
