import { contentSearchSummaryValidator } from "@repo/backend/confect/contents/helpers/search/schema";
import { materialDomainValidator } from "@repo/backend/confect/lib/validators/contents";
import { Schema } from "effect";
/**
 * Validator for graph-backed trending subject items.
 */
export const trendingSubjectValidator = Schema.Struct({
  ...contentSearchSummaryValidator.fields,
  contextKey: Schema.String,
  href: Schema.String,
  materialDomain: materialDomainValidator,
  viewCount: Schema.Finite,
});
export type TrendingSubject = Schema.Schema.Type<
  typeof trendingSubjectValidator
>;

/**
 * Validator for graph-backed recently viewed subject items.
 */
export const recentlyViewedSubjectValidator = Schema.Struct({
  ...contentSearchSummaryValidator.fields,
  contextKey: Schema.String,
  href: Schema.String,
  lastViewedAt: Schema.Finite,
  materialDomain: materialDomainValidator,
});
