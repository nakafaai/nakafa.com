import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  type TrendingSubject,
  trendingSubjectValidator,
} from "@repo/backend/convex/lib/validators/trending";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { type Infer, v } from "convex/values";
import { Schema } from "effect";

export const invalidTrendingRangeCode = "INVALID_TRENDING_RANGE";
export const trendingSubjectIoFailedCode = "TRENDING_SUBJECT_IO_FAILED";

export const maxTrendingRangeDays = 31;
export const maxTrendingSubjectsLimit = 24;

export const getTrendingSubjectsArgs = {
  locale: localeValidator,
  since: vv.number(),
  until: vv.number(),
  limit: vv.optional(vv.number()),
  minViews: vv.optional(vv.number()),
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

/** Raised when a caller asks for an unbounded trending range. */
export class InvalidTrendingRangeError extends Schema.TaggedError<InvalidTrendingRangeError>()(
  "InvalidTrendingRangeError",
  {
    code: Schema.Literal(invalidTrendingRangeCode),
    message: Schema.String,
  }
) {}

/** Raised when Convex IO fails while reading trending subjects. */
export class TrendingSubjectIoError extends Schema.TaggedError<TrendingSubjectIoError>()(
  "TrendingSubjectIoError",
  {
    code: Schema.Literal(trendingSubjectIoFailedCode),
    message: Schema.String,
  }
) {}
