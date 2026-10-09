import { learningPopularityWindowValues } from "@repo/backend/confect/contents/popularity";
import { publicFailure } from "@repo/backend/confect/failure";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { trendingSubjectValidator } from "@repo/backend/confect/lib/validators/trending";
import { Schema } from "effect";
export const trendingSubjectIoFailedCode = "TRENDING_SUBJECT_IO_FAILED";
export const maxTrendingSubjectsLimit = 24;
const learningPopularityWindowValidator = Schema.Literals([
  ...learningPopularityWindowValues,
]);
export const getTrendingSubjectsArgs = {
  locale: localeValidator,
  limit: Schema.optionalKey(Schema.Finite),
  minViews: Schema.optionalKey(Schema.Finite),
  windowKey: Schema.optionalKey(learningPopularityWindowValidator),
};
export const getTrendingSubjectsArgsValidator = Schema.Struct(
  getTrendingSubjectsArgs
);
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
