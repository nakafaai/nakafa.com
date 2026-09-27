import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { ContentViewIoErrorWire } from "@repo/backend/confect/contents/views/spec";
import { failureWire } from "@repo/backend/confect/failure";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { recentlyViewedSubjectValidator } from "@repo/backend/confect/lib/validators/trending";
import { Schema } from "effect";
/** Convex validator for bounded Continue Learning query inputs. */
export const getRecentlyViewedArgs = {
  locale: localeValidator,
  limit: Schema.optionalKey(Schema.Finite),
};

/** Validator-owned argument contract used by the internal query program. */
export const recentLearningIoFailedCode = "RECENT_LEARNING_IO_FAILED";

/** Raised when Continue Learning cannot read its ranked model. */
export class RecentLearningIoError extends Schema.TaggedError<RecentLearningIoError>()(
  "RecentLearningIoError",
  {
    code: Schema.Literal(recentLearningIoFailedCode),
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {}

/** Maps thrown Convex IO failures into the Continue Learning error channel. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
export const RecentLearningIoErrorWire = failureWire(RecentLearningIoError);
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "getRecentlyViewed",
    args: () => getRecentlyViewedArgs,
    returns: () => Schema.mutable(Schema.Array(recentlyViewedSubjectValidator)),
    error: () =>
      Schema.Union([
        RecentLearningIoErrorWire,
        ReleaseErrorWire,
        ContentViewIoErrorWire,
      ]),
  })
);
