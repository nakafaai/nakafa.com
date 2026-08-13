import { learningContextInputValidator } from "@repo/backend/convex/contents/context";
import { graphContentIdValidator } from "@repo/backend/convex/contents/graph";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { type Infer, v } from "convex/values";
import { Schema } from "effect";

export const contentViewIoFailedCode = "CONTENT_VIEW_IO_FAILED";

/** Current content families accepted by durable engagement history. */
export const contentViewSectionValidator = v.union(
  v.literal("articles"),
  v.literal("material")
);

export const recordContentViewArgs = {
  contentId: graphContentIdValidator,
  context: v.optional(learningContextInputValidator),
  deviceId: v.string(),
  locale: localeValidator,
  publicPath: v.string(),
  section: contentViewSectionValidator,
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

/** Maps an unknown infrastructure failure into the content-view error channel. */
export function toContentViewIoError(error: unknown) {
  return new ContentViewIoError({
    code: contentViewIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}
