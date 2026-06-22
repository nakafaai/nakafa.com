import { learningPopularityWindowValues } from "@repo/backend/convex/contents/popularity";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  type TrendingSubject,
  trendingSubjectValidator,
} from "@repo/backend/convex/lib/validators/trending";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Schema } from "effect";

export const trendingSubjectIoFailedCode = "TRENDING_SUBJECT_IO_FAILED";

export const maxTrendingSubjectsLimit = 24;
const learningPopularityWindowValidator = literals(
  ...learningPopularityWindowValues
);

export const getTrendingSubjectsArgs = {
  locale: localeValidator,
  limit: vv.optional(vv.number()),
  minViews: vv.optional(vv.number()),
  windowKey: vv.optional(learningPopularityWindowValidator),
};

export const getTrendingSubjectsArgsValidator = v.object(
  getTrendingSubjectsArgs
);

export const getTrendingSubjectsResultValidator = vv.array(
  trendingSubjectValidator
);

export type GetTrendingSubjectsArgs = Infer<
  typeof getTrendingSubjectsArgsValidator
>;

export type GetTrendingSubjectsResult = TrendingSubject[];

/** Raised when Convex IO fails while reading trending subjects. */
export class TrendingSubjectIoError extends Schema.TaggedError<TrendingSubjectIoError>()(
  "TrendingSubjectIoError",
  {
    code: Schema.Literal(trendingSubjectIoFailedCode),
    message: Schema.String,
  }
) {}
