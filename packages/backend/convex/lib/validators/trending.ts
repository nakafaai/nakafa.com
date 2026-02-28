import { type Infer, v } from "convex/values";
import { gradeValidator, materialValidator } from "./contents";

/**
 * Validator for trending subject item.
 */
export const trendingSubjectValidator = v.object({
  id: v.id("subjectSections"),
  title: v.string(),
  description: v.optional(v.string()),
  slug: v.string(),
  viewCount: v.number(),
  grade: gradeValidator,
  material: materialValidator,
});

export type TrendingSubject = Infer<typeof trendingSubjectValidator>;

/**
 * Validator for recently viewed subject item.
 */
export const recentlyViewedSubjectValidator = v.object({
  id: v.id("subjectSections"),
  title: v.string(),
  description: v.optional(v.string()),
  slug: v.string(),
  grade: gradeValidator,
  material: materialValidator,
  viewedAt: v.number(),
});
