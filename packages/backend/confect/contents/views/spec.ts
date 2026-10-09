import { learningContextInputValidator } from "@repo/backend/confect/contents/context";
import { graphContentIdValidator } from "@repo/backend/confect/contents/graph";
import { contentViewSectionValidator } from "@repo/backend/confect/contents/views/section";
import { publicFailure } from "@repo/backend/confect/failure";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { Schema } from "effect";

const contentViewIoFailedCode = "CONTENT_VIEW_IO_FAILED";

/** Current content families accepted by durable engagement history. */

export const recordContentViewArgs = {
  contentId: graphContentIdValidator,
  context: Schema.optionalKey(learningContextInputValidator),
  /** Present only after the browser granted analytics consent. */
  deviceId: Schema.optionalKey(Schema.String),
  locale: localeValidator,
  publicPath: Schema.String,
  section: contentViewSectionValidator,
};
const recordContentViewArgsValidator = Schema.Struct(recordContentViewArgs);
export const recordContentViewResultValidator = Schema.Struct({
  alreadyViewed: Schema.Boolean,
  isNewView: Schema.Boolean,
  success: Schema.Boolean,
});
export type RecordContentViewArgs = typeof recordContentViewArgsValidator.Type;

/** Raised when Convex IO fails while recording a content view. */
export class ContentViewIoError extends Schema.TaggedError<ContentViewIoError>()(
  "ContentViewIoError",
  {
    code: Schema.Literal(contentViewIoFailedCode),
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {}

/** Maps an unknown infrastructure failure into the content-view error channel. */
export const ContentViewIoErrorWire = publicFailure(ContentViewIoError);
export function toContentViewIoError(error: unknown) {
  return new ContentViewIoError({
    code: contentViewIoFailedCode,
    cause: error,
    message: "Unable to record the content view.",
  });
}
