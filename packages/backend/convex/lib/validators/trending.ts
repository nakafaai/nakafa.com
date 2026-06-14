import { contentSearchSummaryValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import {
  gradeValidator,
  materialValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { type Infer, v } from "convex/values";

/**
 * Validator for graph-backed trending subject items.
 */
export const trendingSubjectValidator = v.object({
  ...contentSearchSummaryValidator.fields,
  grade: gradeValidator,
  material: materialValidator,
  viewCount: v.number(),
});

export type TrendingSubject = Infer<typeof trendingSubjectValidator>;

/**
 * Validator for graph-backed recently viewed subject items.
 */
export const recentlyViewedSubjectValidator = v.object({
  ...contentSearchSummaryValidator.fields,
  grade: gradeValidator,
  lastViewedAt: v.number(),
  material: materialValidator,
});
