import { learningContextInputValidator } from "@repo/backend/convex/contents/context";
import { graphContentIdValidator } from "@repo/backend/convex/contents/graph";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import {
  localeValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { type Infer, v } from "convex/values";
import { Schema } from "effect";

export const contentViewIoFailedCode = "CONTENT_VIEW_IO_FAILED";
export const contentViewRouteCollisionCode = "CONTENT_VIEW_ROUTE_COLLISION";

export const recordContentViewArgs = {
  contentId: graphContentIdValidator,
  context: v.optional(learningContextInputValidator),
  deviceId: v.string(),
  locale: localeValidator,
  publicPath: v.optional(v.string()),
  section: v.optional(nakafaSectionValidator),
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

/** Raised when published route shards exceed the bounded sync overlap. */
export class ContentViewRouteCollisionError extends Schema.TaggedError<ContentViewRouteCollisionError>()(
  "ContentViewRouteCollisionError",
  {
    code: Schema.Literal(contentViewRouteCollisionCode),
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
