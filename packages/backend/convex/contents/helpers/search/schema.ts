import { learningGraphIdentityValidator } from "@repo/backend/convex/contents/graph";
import {
  localeValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";

export const contentSearchRefValidator = v.object({
  ...learningGraphIdentityValidator.fields,
  content_id: v.string(),
  locale: localeValidator,
  markdown_url: v.string(),
  route: v.string(),
  section: nakafaSectionValidator,
  url: v.string(),
});

export const contentSearchSummaryValidator = v.object({
  ...contentSearchRefValidator.fields,
  description: v.string(),
  title: v.string(),
});

export const contentSearchResultItemValidator = v.object({
  ...contentSearchSummaryValidator.fields,
  excerpt: v.string(),
});

export const contentSearchInputValidator = v.object({
  limit: v.number(),
  locale: localeValidator,
  offset: v.number(),
  queries: v.optional(v.array(v.string())),
  section: v.optional(nakafaSectionValidator),
});

export const contentSearchResultValidator = v.object({
  count: v.number(),
  has_more: v.boolean(),
  items: v.array(contentSearchResultItemValidator),
  limit: v.number(),
  next_offset: v.optional(v.number()),
  offset: v.number(),
});

export const contentSearchDocumentValidator = v.object({
  ...contentSearchSummaryValidator.fields,
  contentHash: v.string(),
  sourcePath: v.string(),
  syncedAt: v.number(),
  text: v.string(),
});
