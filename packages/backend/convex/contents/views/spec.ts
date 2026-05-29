import {
  contentViewRefValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { type Infer, v } from "convex/values";
import { Schema } from "effect";

export const contentViewIoFailedCode = "CONTENT_VIEW_IO_FAILED";

export const recordContentViewArgs = {
  contentRef: contentViewRefValidator,
  deviceId: v.string(),
  locale: localeValidator,
};

export const recordContentViewArgsValidator = v.object(recordContentViewArgs);

export const recordContentViewResultValidator = v.object({
  alreadyViewed: v.boolean(),
  isNewView: v.boolean(),
  success: v.boolean(),
});

export type RecordContentViewArgs = Infer<
  typeof recordContentViewArgsValidator
>;

export type RecordContentViewResult = Infer<
  typeof recordContentViewResultValidator
>;

/** Raised when Convex IO fails while recording a content view. */
export class ContentViewIoError extends Schema.TaggedError<ContentViewIoError>()(
  "ContentViewIoError",
  {
    code: Schema.Literal(contentViewIoFailedCode),
    message: Schema.String,
  }
) {}
