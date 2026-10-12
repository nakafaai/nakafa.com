import { learningPopularityWindowValidator } from "@repo/backend/confect/contents/schema";
import { publicFailure } from "@repo/backend/confect/failure";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { trendingSubjectValidator } from "@repo/backend/confect/lib/validators/trending";
import { Schema } from "effect";
export const trendingSubjectIoFailedCode = "TRENDING_SUBJECT_IO_FAILED";
// Temporary compatibility, the expand step of packages/backend/AGENTS.md: the
// web app stopped sending `windowKey` on 11 October 2026, in the change that
// stopped maintaining other windows, but an older web deployment still sends
// "7d" and Convex refuses an argument its validator does not name. The query
// ignores the value. Owner: ADR 0008. Exit: the web deployment without it has
// served production for 8 days, which is 20 October 2026, and no older web
// deployment still takes requests. Cleanup: delete the `windowKey` field below
// and its compatibility test.
export const getTrendingSubjectsArgs = {
  locale: localeValidator,
  windowKey: Schema.optionalKey(learningPopularityWindowValidator),
};
const getTrendingSubjectsArgsValidator = Schema.Struct(getTrendingSubjectsArgs);
export const getTrendingSubjectsResultValidator = Schema.mutable(
  Schema.Array(trendingSubjectValidator)
);
export type GetTrendingSubjectsArgs =
  typeof getTrendingSubjectsArgsValidator.Type;

/** Raised when Convex IO fails while reading trending materials. */
export class TrendingSubjectIoError extends Schema.TaggedError<TrendingSubjectIoError>()(
  "TrendingSubjectIoError",
  {
    code: Schema.Literal(trendingSubjectIoFailedCode),
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {}
export const TrendingSubjectIoErrorWire = publicFailure(TrendingSubjectIoError);
